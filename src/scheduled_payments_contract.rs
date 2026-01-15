#![no_std]

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

// Interval constants (in seconds)
const INTERVAL_DAILY: u64 = 86400;      // 24 hours
const INTERVAL_WEEKLY: u64 = 604800;    // 7 days
const INTERVAL_MONTHLY: u64 = 2592000;  // 30 days

// 1. DATA STRUCTURES

/// Represents a recurring payment subscription
#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, PartialEq, Debug)]
pub struct Subscription<M: ManagedTypeApi> {
    pub id: u64,
    pub payer: ManagedAddress<M>,
    pub recipient: ManagedAddress<M>,
    pub token_identifier: EgldOrEsdtTokenIdentifier<M>,
    
    // Payment Details
    pub amount_per_payment: BigUint<M>,
    pub interval_seconds: u64,              // Time between payments
    pub next_payment_time: u64,             // Next scheduled payment timestamp
    
    // Tracking
    pub created_at: u64,
    pub payments_made: u64,
    pub total_payments: OptionalValue<u64>, // None = unlimited, Some(n) = limited
    
    // Balance & Status
    pub deposited_balance: BigUint<M>,      // Available balance in contract
    pub is_active: bool,
}

/// Interval type for better UX
#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, Copy, PartialEq, Debug)]
pub enum IntervalType {
    Daily,
    Weekly,
    Monthly,
    Custom(u64), // Custom interval in seconds
}

// 2. MAIN CONTRACT
#[multiversx_sc::contract]
pub trait ScheduledPaymentsContract {
    
    #[init]
    fn init(&self) {}

    // ==========================================
    // SUBSCRIPTION MANAGEMENT ENDPOINTS
    // ==========================================

    /// Creates a new subscription with an initial deposit
    /// The deposit should cover at least one payment
    #[payable("*")]
    #[endpoint(createSubscription)]
    fn create_subscription(
        &self,
        recipient: ManagedAddress,
        amount_per_payment: BigUint,
        interval_type: IntervalType,
        total_payments: OptionalValue<u64>,
    ) -> u64 {
        // Get payment info
        let (payment_token, payment_amount) = self.call_value().egld_or_single_fungible_esdt();
        let caller = self.blockchain().get_caller();
        
        // Validations
        require!(payment_amount > 0, "Must deposit funds");
        require!(amount_per_payment > 0, "Payment amount must be greater than zero");
        require!(caller != recipient, "Cannot create subscription to yourself");
        require!(
            payment_amount >= amount_per_payment,
            "Initial deposit must cover at least one payment"
        );

        // Validate total_payments if provided
        if let OptionalValue::Some(total) = total_payments {
            require!(total > 0, "Total payments must be greater than zero");
        }

        // Get interval in seconds
        let interval_seconds = self.get_interval_seconds(interval_type);
        require!(interval_seconds > 0, "Invalid interval");

        // Calculate next payment time
        let current_time = self.blockchain().get_block_timestamp();
        let next_payment_time = current_time + interval_seconds;

        // Create subscription
        let subscription_id = self.last_subscription_id().get() + 1;
        self.last_subscription_id().set(subscription_id);

        let subscription = Subscription {
            id: subscription_id,
            payer: caller.clone(),
            recipient: recipient.clone(),
            token_identifier: payment_token,
            amount_per_payment,
            interval_seconds,
            next_payment_time,
            created_at: current_time,
            payments_made: 0u64,
            total_payments,
            deposited_balance: payment_amount,
            is_active: true,
        };

        // Store subscription
        self.subscriptions(subscription_id).set(&subscription);
        
        // Track user subscriptions
        self.user_subscriptions(&caller).insert(subscription_id);
        
        // Emit event
        self.subscription_created_event(
            subscription_id,
            &caller,
            &recipient,
            &subscription.amount_per_payment,
            interval_seconds,
        );

        subscription_id
    }

    /// Cancel a subscription and return remaining balance to payer
    #[endpoint(cancelSubscription)]
    fn cancel_subscription(&self, subscription_id: u64) {
        require!(
            !self.subscriptions(subscription_id).is_empty(),
            "Subscription does not exist"
        );

        let mut subscription = self.subscriptions(subscription_id).get();
        let caller = self.blockchain().get_caller();

        // Only payer can cancel
        require!(
            caller == subscription.payer,
            "Only the payer can cancel this subscription"
        );
        require!(subscription.is_active, "Subscription is not active");

        // Mark as inactive
        subscription.is_active = false;
        
        // Return remaining balance to payer
        let remaining_balance = subscription.deposited_balance.clone();
        if remaining_balance > 0u64 {
            self.send().direct(
                &subscription.payer,
                &subscription.token_identifier,
                0,
                &remaining_balance,
            );
            subscription.deposited_balance = BigUint::zero();
        }

        // Update storage
        self.subscriptions(subscription_id).set(&subscription);

        // Emit event
        self.subscription_cancelled_event(
            subscription_id,
            &subscription.payer,
            &remaining_balance,
        );
    }

    /// Execute a scheduled payment (can be called by anyone)
    /// This is the key function that processes recurring payments
    #[endpoint(executePayment)]
    fn execute_payment(&self, subscription_id: u64) {
        require!(
            !self.subscriptions(subscription_id).is_empty(),
            "Subscription does not exist"
        );

        let mut subscription = self.subscriptions(subscription_id).get();
        
        // Check if subscription is active
        require!(subscription.is_active, "Subscription is not active");

        // Check if payment is due
        let current_time = self.blockchain().get_block_timestamp();
        require!(
            current_time >= subscription.next_payment_time,
            "Payment is not due yet"
        );

        // Check if subscription has enough balance
        require!(
            subscription.deposited_balance >= subscription.amount_per_payment,
            "Insufficient balance in subscription"
        );

        // Execute payment
        self.send().direct(
            &subscription.recipient,
            &subscription.token_identifier,
            0,
            &subscription.amount_per_payment,
        );

        // Update subscription state
        subscription.deposited_balance -= &subscription.amount_per_payment;
        subscription.payments_made += 1;
        subscription.next_payment_time += subscription.interval_seconds;

        // Check if subscription should be deactivated
        if let OptionalValue::Some(total) = subscription.total_payments {
            if subscription.payments_made >= total {
                subscription.is_active = false;
            }
        }

        // Deactivate if balance is insufficient for next payment
        if subscription.deposited_balance < subscription.amount_per_payment {
            subscription.is_active = false;
        }

        // Update storage
        self.subscriptions(subscription_id).set(&subscription);

        // Emit event
        self.payment_executed_event(
            subscription_id,
            &subscription.recipient,
            &subscription.amount_per_payment,
            subscription.payments_made,
        );
    }

    /// Add more funds to a subscription
    #[payable("*")]
    #[endpoint(topUpSubscription)]
    fn top_up_subscription(&self, subscription_id: u64) {
        require!(
            !self.subscriptions(subscription_id).is_empty(),
            "Subscription does not exist"
        );

        let mut subscription = self.subscriptions(subscription_id).get();
        let (payment_token, payment_amount) = self.call_value().egld_or_single_fungible_esdt();
        let caller = self.blockchain().get_caller();

        // Only payer can top up
        require!(
            caller == subscription.payer,
            "Only the payer can top up this subscription"
        );

        // Verify token matches
        require!(
            payment_token == subscription.token_identifier,
            "Token mismatch"
        );
        require!(payment_amount > 0, "Must send tokens");

        // Add to balance
        subscription.deposited_balance += &payment_amount;

        // Reactivate if was inactive due to insufficient balance
        if !subscription.is_active {
            // Check if should be reactivated
            let should_reactivate = if let OptionalValue::Some(total) = subscription.total_payments {
                subscription.payments_made < total
            } else {
                true
            };

            if should_reactivate {
                subscription.is_active = true;
            }
        }

        // Update storage
        self.subscriptions(subscription_id).set(&subscription);

        // Emit event
        self.subscription_topped_up_event(
            subscription_id,
            &caller,
            &payment_amount,
        );
    }

    // ==========================================
    // VIEW ENDPOINTS (Read-only)
    // ==========================================

    /// Get subscription details by ID
    #[view(getSubscription)]
    fn get_subscription(&self, subscription_id: u64) -> OptionalValue<Subscription<Self::Api>> {
        if self.subscriptions(subscription_id).is_empty() {
            OptionalValue::None
        } else {
            OptionalValue::Some(self.subscriptions(subscription_id).get())
        }
    }

    /// Get all subscription IDs for a user
    #[view(getUserSubscriptionIds)]
    fn get_user_subscription_ids(&self, user: ManagedAddress) -> MultiValueEncoded<u64> {
        let mut result = MultiValueEncoded::new();
        for subscription_id in self.user_subscriptions(&user).iter() {
            result.push(subscription_id);
        }
        result
    }

    /// Get all subscriptions for a user (full data)
    #[view(getUserSubscriptions)]
    fn get_user_subscriptions(&self, user: ManagedAddress) -> MultiValueEncoded<Subscription<Self::Api>> {
        let mut result = MultiValueEncoded::new();
        for subscription_id in self.user_subscriptions(&user).iter() {
            if !self.subscriptions(subscription_id).is_empty() {
                let subscription = self.subscriptions(subscription_id).get();
                result.push(subscription);
            }
        }
        result
    }

    /// Check if a subscription is ready for payment
    #[view(isPaymentDue)]
    fn is_payment_due(&self, subscription_id: u64) -> bool {
        if self.subscriptions(subscription_id).is_empty() {
            return false;
        }

        let subscription = self.subscriptions(subscription_id).get();
        let current_time = self.blockchain().get_block_timestamp();

        subscription.is_active 
            && current_time >= subscription.next_payment_time
            && subscription.deposited_balance >= subscription.amount_per_payment
    }

    /// Get time until next payment
    #[view(getTimeUntilNextPayment)]
    fn get_time_until_next_payment(&self, subscription_id: u64) -> OptionalValue<u64> {
        if self.subscriptions(subscription_id).is_empty() {
            return OptionalValue::None;
        }

        let subscription = self.subscriptions(subscription_id).get();
        let current_time = self.blockchain().get_block_timestamp();

        if current_time >= subscription.next_payment_time {
            OptionalValue::Some(0u64)
        } else {
            OptionalValue::Some(subscription.next_payment_time - current_time)
        }
    }

    /// Get total number of subscriptions created
    #[view(getLastSubscriptionId)]
    fn get_last_subscription_id(&self) -> u64 {
        self.last_subscription_id().get()
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    fn get_interval_seconds(&self, interval_type: IntervalType) -> u64 {
        match interval_type {
            IntervalType::Daily => INTERVAL_DAILY,
            IntervalType::Weekly => INTERVAL_WEEKLY,
            IntervalType::Monthly => INTERVAL_MONTHLY,
            IntervalType::Custom(seconds) => seconds,
        }
    }

    // ==========================================
    // STORAGE MAPPERS
    // ==========================================

    #[storage_mapper("subscriptions")]
    fn subscriptions(&self, id: u64) -> SingleValueMapper<Subscription<Self::Api>>;

    #[storage_mapper("lastSubscriptionId")]
    fn last_subscription_id(&self) -> SingleValueMapper<u64>;

    #[storage_mapper("userSubscriptions")]
    fn user_subscriptions(&self, user: &ManagedAddress) -> UnorderedSetMapper<u64>;

    // ==========================================
    // EVENTS
    // ==========================================

    #[event("subscriptionCreated")]
    fn subscription_created_event(
        &self,
        #[indexed] subscription_id: u64,
        #[indexed] payer: &ManagedAddress,
        #[indexed] recipient: &ManagedAddress,
        amount_per_payment: &BigUint,
        interval_seconds: u64,
    );

    #[event("subscriptionCancelled")]
    fn subscription_cancelled_event(
        &self,
        #[indexed] subscription_id: u64,
        #[indexed] payer: &ManagedAddress,
        refunded_amount: &BigUint,
    );

    #[event("paymentExecuted")]
    fn payment_executed_event(
        &self,
        #[indexed] subscription_id: u64,
        #[indexed] recipient: &ManagedAddress,
        amount: &BigUint,
        payment_number: u64,
    );

    #[event("subscriptionToppedUp")]
    fn subscription_topped_up_event(
        &self,
        #[indexed] subscription_id: u64,
        #[indexed] payer: &ManagedAddress,
        amount: &BigUint,
    );
}