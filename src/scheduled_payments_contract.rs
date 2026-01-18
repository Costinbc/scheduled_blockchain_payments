#![no_std]

multiversx_sc::imports!();
multiversx_sc::derive_imports!();

const ROLE_NONE: u8 = 0;
const ROLE_USER: u8 = 1;
const ROLE_PROVIDER: u8 = 2;

const STATUS_ACTIVE: u8 = 1;
const STATUS_PENDING_USER_CANCEL: u8 = 2;
const STATUS_PENDING_PROVIDER_CANCEL: u8 = 3;
const STATUS_CANCELLED_BY_USER: u8 = 4;
const STATUS_CANCELLED_BY_PROVIDER: u8 = 5;
const STATUS_CANCELLED_INSUFFICIENT_FUNDS: u8 = 6;

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, PartialEq)]
pub struct Service<M: ManagedTypeApi> {
    pub id: u64,
    pub provider: ManagedAddress<M>,
    pub name: ManagedBuffer<M>,
    pub description: ManagedBuffer<M>,
    pub token_identifier: EgldOrEsdtTokenIdentifier<M>,
    pub amount_per_cycle: BigUint<M>,
    pub frequency_in_blocks: u64,
    pub active: bool,
}

#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone)]
pub struct Subscription<M: ManagedTypeApi> {
    pub id: u64,
    pub service_id: u64,
    pub client: ManagedAddress<M>,
    pub vendor: ManagedAddress<M>,
    pub token_identifier: EgldOrEsdtTokenIdentifier<M>,
    pub amount_per_cycle: BigUint<M>,
    pub frequency_in_blocks: u64,
    pub remaining_balance: BigUint<M>,
    pub last_payment_block: u64,
    pub next_payment_block: u64,
    pub status: u8,
    pub cancel_effective_block: u64,
}

#[multiversx_sc::contract]
pub trait SubscriptionContract {
    #[init]
    fn init(&self) {
        self.last_service_id().set(0);
        self.last_subscription_id().set(0);
    }

    // --- REGISTRATION ---

    #[endpoint(registerAsUser)]
    fn register_as_user(&self) {
        let caller = self.blockchain().get_caller();
        require!(
            self.user_role(&caller).is_empty(),
            "User already registered"
        );
        self.user_role(&caller).set(ROLE_USER);
    }

    #[endpoint(registerAsProvider)]
    fn register_as_provider(&self) {
        let caller = self.blockchain().get_caller();
        require!(
            self.user_role(&caller).is_empty(),
            "User already registered"
        );
        self.user_role(&caller).set(ROLE_PROVIDER);
    }

    // --- SERVICE PROVIDER: SERVICES ---

    #[endpoint(createService)]
    fn create_service(
        &self,
        name: ManagedBuffer,
        description: ManagedBuffer,
        amount_per_cycle: BigUint,
        frequency_in_blocks: u64,
        opt_token_id: OptionalValue<EgldOrEsdtTokenIdentifier>,
    ) -> u64 {
        let caller = self.blockchain().get_caller();
        require!(
            self.user_role(&caller).get() == ROLE_PROVIDER,
            "Only providers can create services"
        );
        require!(amount_per_cycle > 0, "Amount per cycle must be > 0");
        require!(frequency_in_blocks > 0, "Frequency must be > 0");

        let token_identifier = match opt_token_id {
            OptionalValue::Some(token) => token,
            OptionalValue::None => EgldOrEsdtTokenIdentifier::egld(),
        };

        let service_id = self.last_service_id().get() + 1;
        self.last_service_id().set(service_id);

        let service = Service {
            id: service_id,
            provider: caller.clone(),
            name,
            description,
            token_identifier,
            amount_per_cycle,
            frequency_in_blocks,
            active: true,
        };

        self.services(service_id).set(&service);
        self.service_ids().push(&service_id);
        self.provider_services(&caller).push(&service_id);

        service_id
    }

    #[endpoint(deactivateService)]
    fn deactivate_service(&self, service_id: u64) {
        let caller = self.blockchain().get_caller();
        let mut service = self.services(service_id).get();
        require!(caller == service.provider, "Only provider can deactivate");
        service.active = false;
        self.services(service_id).set(&service);
    }

    // --- USER: SUBSCRIPTIONS ---

    #[payable("*")]
    #[endpoint(subscribe)]
    fn subscribe(&self, service_id: u64) -> u64 {
        let caller = self.blockchain().get_caller();
        require!(
            self.user_role(&caller).get() == ROLE_USER,
            "Only users can subscribe"
        );

        let service = self.services(service_id).get();
        require!(service.active, "Service is not active");

        let (payment_token, payment_amount) =
            self.call_value().egld_or_single_fungible_esdt();
        require!(
            payment_token == service.token_identifier,
            "Invalid payment token"
        );
        require!(
            payment_amount >= service.amount_per_cycle,
            "Deposit must cover at least one cycle"
        );

        let current_block = self.blockchain().get_block_nonce();

        let mut remaining_balance = payment_amount;
        self.send().direct(
            &service.provider,
            &service.token_identifier,
            0,
            &service.amount_per_cycle,
        );
        remaining_balance -= &service.amount_per_cycle;

        let sub_id = self.last_subscription_id().get() + 1;
        self.last_subscription_id().set(sub_id);

        let subscription = Subscription {
            id: sub_id,
            service_id,
            client: caller.clone(),
            vendor: service.provider.clone(),
            token_identifier: service.token_identifier.clone(),
            amount_per_cycle: service.amount_per_cycle.clone(),
            frequency_in_blocks: service.frequency_in_blocks,
            remaining_balance,
            last_payment_block: current_block,
            next_payment_block: current_block + service.frequency_in_blocks,
            status: STATUS_ACTIVE,
            cancel_effective_block: 0,
        };

        self.subscriptions(sub_id).set(&subscription);
        self.cancel_requested_by_is_set(sub_id).set(false);
        self.cancel_requested_by(sub_id).clear();
        self.user_subscriptions(&caller).push(&sub_id);
        self.provider_subscriptions(&service.provider).push(&sub_id);
        self.service_subscriptions(service_id).push(&sub_id);

        sub_id
    }

    #[payable("*")]
    #[endpoint(topUp)]
    fn top_up(&self, sub_id: u64) {
        let caller = self.blockchain().get_caller();
        let mut sub = self.subscriptions(sub_id).get();
        require!(caller == sub.client, "Only subscriber can top up");
        let (payment_token, payment_amount) =
            self.call_value().egld_or_single_fungible_esdt();
        require!(
            payment_token == sub.token_identifier,
            "Invalid payment token"
        );
        require!(payment_amount > 0, "Top up amount must be > 0");

        sub.remaining_balance += payment_amount;
        if sub.status != STATUS_ACTIVE {
            sub.status = STATUS_ACTIVE;
            let current_block = self.blockchain().get_block_nonce();
            sub.last_payment_block = current_block;
            sub.next_payment_block = current_block + sub.frequency_in_blocks;
        }
        self.subscriptions(sub_id).set(&sub);
    }

    #[endpoint(cancelSubscriptionByUser)]
    fn cancel_subscription_by_user(&self, sub_id: u64) {
        let caller = self.blockchain().get_caller();
        let mut sub = self.subscriptions(sub_id).get();
        require!(caller == sub.client, "Only subscriber can cancel");
        require!(
            sub.status == STATUS_ACTIVE,
            "Subscription not active"
        );

        sub.status = STATUS_PENDING_USER_CANCEL;
        sub.cancel_effective_block = sub.next_payment_block;
        self.subscriptions(sub_id).set(&sub);
        self.cancel_requested_by(sub_id).set(&caller);
        self.cancel_requested_by_is_set(sub_id).set(true);
    }

    #[endpoint(cancelSubscriptionByProvider)]
    fn cancel_subscription_by_provider(&self, sub_id: u64) {
        let caller = self.blockchain().get_caller();
        let mut sub = self.subscriptions(sub_id).get();
        require!(caller == sub.vendor, "Only provider can cancel");
        require!(
            sub.status == STATUS_ACTIVE,
            "Subscription not active"
        );

        sub.status = STATUS_PENDING_PROVIDER_CANCEL;
        sub.cancel_effective_block = sub.next_payment_block;
        self.subscriptions(sub_id).set(&sub);
        self.cancel_requested_by(sub_id).set(&caller);
        self.cancel_requested_by_is_set(sub_id).set(true);
    }

    // --- SCHEDULER: PAYMENTS ---

    #[endpoint(triggerPayment)]
    fn trigger_payment(&self, sub_id: u64) {
        let mut sub = self.subscriptions(sub_id).get();
        require!(sub.status == STATUS_ACTIVE, "Subscription not active");

        let current_block = self.blockchain().get_block_nonce();
        require!(
            current_block >= sub.next_payment_block,
            "Payment cycle not reached yet"
        );

        if sub.remaining_balance < sub.amount_per_cycle {
            if sub.remaining_balance > 0 {
                self.send().direct(
                    &sub.client,
                    &sub.token_identifier,
                    0,
                    &sub.remaining_balance,
                );
                sub.remaining_balance = BigUint::zero();
            }
            sub.status = STATUS_CANCELLED_INSUFFICIENT_FUNDS;
            sub.cancel_effective_block = current_block;
            self.subscriptions(sub_id).set(&sub);
            self.cancel_requested_by_is_set(sub_id).set(false);
            self.cancel_requested_by(sub_id).clear();
            return;
        }

        self.send().direct(
            &sub.vendor,
            &sub.token_identifier,
            0,
            &sub.amount_per_cycle,
        );
        sub.remaining_balance -= &sub.amount_per_cycle;
        sub.last_payment_block = current_block;
        sub.next_payment_block = current_block + sub.frequency_in_blocks;
        self.subscriptions(sub_id).set(&sub);
    }

    #[endpoint(finalizeCancellation)]
    fn finalize_cancellation(&self, sub_id: u64) {
        let mut sub = self.subscriptions(sub_id).get();
        let is_pending = sub.status == STATUS_PENDING_USER_CANCEL
            || sub.status == STATUS_PENDING_PROVIDER_CANCEL;
        require!(is_pending, "Subscription not pending cancel");

        let current_block = self.blockchain().get_block_nonce();
        require!(
            current_block >= sub.cancel_effective_block,
            "Cancellation not effective yet"
        );

        sub.status = if sub.status == STATUS_PENDING_USER_CANCEL {
            STATUS_CANCELLED_BY_USER
        } else {
            STATUS_CANCELLED_BY_PROVIDER
        };

        if sub.remaining_balance > 0 {
            self.send().direct(
                &sub.client,
                &sub.token_identifier,
                0,
                &sub.remaining_balance,
            );
            sub.remaining_balance = BigUint::zero();
        }

        self.subscriptions(sub_id).set(&sub);
        self.cancel_requested_by_is_set(sub_id).set(false);
        self.cancel_requested_by(sub_id).clear();
    }

    // --- VIEWS ---

    #[view(getService)]
    #[storage_mapper("services")]
    fn services(&self, id: u64) -> SingleValueMapper<Service<Self::Api>>;

    #[view(getSubscription)]
    #[storage_mapper("subscriptions")]
    fn subscriptions(&self, id: u64) -> SingleValueMapper<Subscription<Self::Api>>;

    #[view(getAllServiceIds)]
    fn get_all_service_ids(&self) -> ManagedVec<u64> {
        let mut out = ManagedVec::new();
        for id in self.service_ids().iter() {
            out.push(id);
        }
        out
    }

    #[view(getProviderServices)]
    fn get_provider_services(&self, address: ManagedAddress) -> ManagedVec<u64> {
        let mut out = ManagedVec::new();
        for id in self.provider_services(&address).iter() {
            out.push(id);
        }
        out
    }

    #[view(getUserSubscriptions)]
    fn get_user_subscriptions(&self, address: ManagedAddress) -> ManagedVec<u64> {
        let mut out = ManagedVec::new();
        for id in self.user_subscriptions(&address).iter() {
            out.push(id);
        }
        out
    }

    #[view(getProviderSubscriptions)]
    fn get_provider_subscriptions(&self, address: ManagedAddress) -> ManagedVec<u64> {
        let mut out = ManagedVec::new();
        for id in self.provider_subscriptions(&address).iter() {
            out.push(id);
        }
        out
    }

    #[view(getServiceSubscriptions)]
    fn get_service_subscriptions(&self, service_id: u64) -> ManagedVec<u64> {
        let mut out = ManagedVec::new();
        for id in self.service_subscriptions(service_id).iter() {
            out.push(id);
        }
        out
    }

    #[view(getSubscriptionPaymentInfo)]
    fn get_subscription_payment_info(
        &self,
        sub_id: u64,
    ) -> MultiValue4<u8, u64, BigUint, BigUint> {
        let sub = self.subscriptions(sub_id).get();
        MultiValue4::from((sub.status, sub.next_payment_block, sub.remaining_balance, sub.amount_per_cycle))
    }

    #[view(getSubscriptionState)]
    fn get_subscription_state(&self, sub_id: u64) -> MultiValue3<u8, u64, u64> {
        let sub = self.subscriptions(sub_id).get();
        MultiValue3::from((sub.status, sub.next_payment_block, sub.cancel_effective_block))
    }

    #[view(getUserRole)]
    fn get_user_role(&self, address: ManagedAddress) -> u8 {
        if self.user_role(&address).is_empty() {
            return ROLE_NONE;
        }
        self.user_role(&address).get()
    }

    #[view(getLastServiceId)]
    #[storage_mapper("lastServiceId")]
    fn last_service_id(&self) -> SingleValueMapper<u64>;

    #[view(getLastSubscriptionId)]
    #[storage_mapper("lastSubscriptionId")]
    fn last_subscription_id(&self) -> SingleValueMapper<u64>;

    #[storage_mapper("serviceIds")]
    fn service_ids(&self) -> VecMapper<u64>;

    #[storage_mapper("providerServices")]
    fn provider_services(&self, address: &ManagedAddress) -> VecMapper<u64>;

    #[storage_mapper("userSubscriptions")]
    fn user_subscriptions(&self, address: &ManagedAddress) -> VecMapper<u64>;

    #[storage_mapper("providerSubscriptions")]
    fn provider_subscriptions(&self, address: &ManagedAddress) -> VecMapper<u64>;

    #[storage_mapper("serviceSubscriptions")]
    fn service_subscriptions(&self, service_id: u64) -> VecMapper<u64>;

    #[storage_mapper("userRole")]
    fn user_role(&self, address: &ManagedAddress) -> SingleValueMapper<u8>;

    #[storage_mapper("cancelRequestedBy")]
    fn cancel_requested_by(&self, sub_id: u64) -> SingleValueMapper<ManagedAddress>;

    #[storage_mapper("cancelRequestedByIsSet")]
    fn cancel_requested_by_is_set(&self, sub_id: u64) -> SingleValueMapper<bool>;
}