#![no_std]

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, PartialEq)]
pub struct Subscription<M: ManagedTypeApi> {
    pub client: ManagedAddress<M>,
    pub vendor: ManagedAddress<M>,
    pub token_identifier: TokenIdentifier<M>,
    
    // Subscription Terms
    pub amount_per_cycle: BigUint<M>,   
    pub frequency: u64,                 
    
    // State
    pub remaining_balance: BigUint<M>,  
    pub last_payment_time: u64,         
    pub start_time: u64,                
}

#[multiversx_sc::contract]
pub trait SubscriptionContract {
    
    #[init]
    fn init(&self) {}

    // 1. CLIENT: Create a Subscription (Deposits funds upfront)
    #[payable("*")]
    #[endpoint(createSubscription)]
    fn create_subscription(
        &self,
        vendor: ManagedAddress,
        amount_per_cycle: BigUint,
        frequency: u64,
    ) -> u64 {
        let payment = self.call_value().single_esdt();
        
        require!(payment.amount >= amount_per_cycle, "Deposit must cover at least one cycle");
        require!(frequency > 0, "Frequency must be > 0");

        let client = self.blockchain().get_caller();
        let current_time = self.blockchain().get_block_timestamp();
        
        // Create the Subscription Object
        let new_sub = Subscription {
            client: client.clone(),
            vendor: vendor.clone(),
            
            // FIX: Added .clone() here
            token_identifier: payment.token_identifier.clone(),
            
            amount_per_cycle: amount_per_cycle.clone(),
            frequency,
            
            // FIX: Added .clone() here
            remaining_balance: payment.amount.clone(),
            
            last_payment_time: current_time, 
            start_time: current_time,
        };

        let sub_id = self.last_id().get() + 1;
        self.last_id().set(sub_id);

        self.subscriptions(sub_id).set(&new_sub);

        // Indexing for Frontend
        self.client_subscriptions(&client).push(&sub_id);
        self.vendor_subscriptions(&vendor).push(&sub_id);

        sub_id
    }

    // 2. VENDOR: Charge the Subscription
    #[endpoint(triggerPayment)]
    fn trigger_payment(&self, sub_id: u64) {
        let mut sub = self.subscriptions(sub_id).get();
        let current_time = self.blockchain().get_block_timestamp();

        // 1. Check Cycle Logic
        let next_payment_due = sub.last_payment_time + sub.frequency;
        require!(current_time >= next_payment_due, "Payment cycle not reached yet");

        // 2. Check Balance
        require!(sub.remaining_balance >= sub.amount_per_cycle, "Insufficient funds for renewal");

        // 3. Update State
        sub.remaining_balance -= &sub.amount_per_cycle;
        sub.last_payment_time = current_time; 
        
        self.subscriptions(sub_id).set(&sub);

        // 4. Send Payment to Vendor
        self.send().direct_esdt(
            &sub.vendor,
            &sub.token_identifier,
            0,
            &sub.amount_per_cycle
        );
    }

    // 3. CLIENT: Cancel and Withdraw Remaining
    #[endpoint(cancelSubscription)]
    fn cancel_subscription(&self, sub_id: u64) {
        let sub = self.subscriptions(sub_id).get();
        let caller = self.blockchain().get_caller();

        require!(caller == sub.client, "Only client can cancel");

        // Refund remaining balance
        if sub.remaining_balance > 0 {
            self.send().direct_esdt(
                &sub.client,
                &sub.token_identifier,
                0,
                &sub.remaining_balance
            );
        }

        // Delete subscription
        self.subscriptions(sub_id).clear();
    }

    // --- VIEW FUNCTIONS ---

    #[view(getSubscription)]
    #[storage_mapper("subscriptions")]
    fn subscriptions(&self, id: u64) -> SingleValueMapper<Subscription<Self::Api>>;

    #[view(getLastId)]
    #[storage_mapper("lastId")]
    fn last_id(&self) -> SingleValueMapper<u64>;

    #[storage_mapper("clientSubscriptions")]
    fn client_subscriptions(&self, address: &ManagedAddress) -> VecMapper<u64>;

    #[storage_mapper("vendorSubscriptions")]
    fn vendor_subscriptions(&self, address: &ManagedAddress) -> VecMapper<u64>;

    #[view(getClientSubscriptions)]
    fn get_client_subscriptions(&self, address: ManagedAddress) -> ManagedVec<u64> {
        let mut out = ManagedVec::new();
        for id in self.client_subscriptions(&address).iter() {
            out.push(id);
        }
        out
    }

    #[view(getVendorSubscriptions)]
    fn get_vendor_subscriptions(&self, address: ManagedAddress) -> ManagedVec<u64> {
        let mut out = ManagedVec::new();
        for id in self.vendor_subscriptions(&address).iter() {
            out.push(id);
        }
        out
    }
}