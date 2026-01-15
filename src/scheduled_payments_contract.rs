#![no_std]

multiversx_sc::imports!();
multiversx_sc::derive_imports!();


// 1. DATA STRUCTURE
// We define the struct at the top level.
// The derives will now function correctly.
#[type_abi]
#[derive(TopEncode, TopDecode, NestedEncode, NestedDecode, Clone, PartialEq)]
pub struct Stream<M: ManagedTypeApi> {
    pub sender: ManagedAddress<M>,
    pub recipient: ManagedAddress<M>,
    pub token_identifier: TokenIdentifier<M>,
    
    // Money Flow
    pub total_deposit: BigUint<M>,      
    pub claimed_amount: BigUint<M>,     
    pub start_time: u64,                
    pub end_time: u64,                  
    
    // Status
    pub is_paused: bool,                
    pub cancellation_requested: bool,   
}

// 2. CONTRACT
#[multiversx_sc::contract]
pub trait CashflowContract {
    
    #[init]
    fn init(&self) {}

    // --- ENDPOINTS ---

    #[payable("*")]
    #[endpoint(createStream)]
    fn create_stream(
        &self,
        recipient: ManagedAddress,
        start_time: u64,
        end_time: u64,
    ) -> u64 {
        let payment = self.call_value().single_esdt();
        let payment_token = payment.token_identifier.clone();
        let payment_amount = payment.amount.clone();
        
        require!(payment_amount > 0, "Must send tokens");
        require!(end_time > start_time, "End time must be after start time");

        let sender = self.blockchain().get_caller();
        
        // Initialize the struct
        let new_stream = Stream {
            sender: sender.clone(),
            recipient,
            token_identifier: payment_token,
            total_deposit: payment_amount,
            claimed_amount: BigUint::zero(),
            start_time,
            end_time,
            is_paused: false,
            cancellation_requested: false,
        };

        let stream_id = self.last_stream_id().get() + 1;
        self.last_stream_id().set(stream_id);

        // Store it
        self.streams(stream_id).set(new_stream);

        // Emit Event
        self.create_stream_event(stream_id, &sender, (start_time, end_time));

        stream_id
    }

    #[endpoint(claim)]
    fn claim(&self, stream_id: u64) {
        // Use 'get()' to load from storage.
        let mut stream = self.streams(stream_id).get();
        
        let caller = self.blockchain().get_caller();
        require!(
            caller == stream.recipient || caller == stream.sender, 
            "Unauthorized"
        );

        let claimable = self.calculate_claimable_amount(&stream);
        
        // Return if nothing to claim
        if claimable == 0 {
            return;
        }

        stream.claimed_amount += &claimable;
        self.streams(stream_id).set(&stream);

        self.send().direct_esdt(
            &stream.recipient,
            &stream.token_identifier,
            0,
            &claimable
        );
    }

    #[endpoint(cancelStream)]
    fn cancel_stream(&self, stream_id: u64) {
        let mut stream = self.streams(stream_id).get();
        let caller = self.blockchain().get_caller();

        require!(caller == stream.sender, "Only the sender can cancel");
        require!(stream.end_time > 0, "Stream already cancelled or finished");

        // 1. Calculate what is owed up to NOW
        let claimable_now = self.calculate_claimable_amount(&stream);

        // 2. Distribute Funds
        // A. Send Recipient their vested share (if any)
        if claimable_now > 0 {
            self.send().direct_esdt(
                &stream.recipient,
                &stream.token_identifier,
                0,
                &claimable_now
            );
            stream.claimed_amount += &claimable_now;
        }

        // B. Send Sender the rest (Total Deposit - Total Claimed)
        let remaining_balance = &stream.total_deposit - &stream.claimed_amount;
        if remaining_balance > 0 {
            self.send().direct_esdt(
                &stream.sender,
                &stream.token_identifier,
                0,
                &remaining_balance
            );
        }

        // 3. Clear storage (or mark as 0 end_time to signify closed)
        // We set end_time to the current time effectively stopping the stream logic
        let current_time = self.blockchain().get_block_timestamp();
        stream.end_time = current_time; 
        
        // Save the final state (optional, or you can clear it to free storage bytes)
        self.streams(stream_id).set(&stream);
    }

    // --- HELPERS ---

    fn calculate_claimable_amount(&self, stream: &Stream<Self::Api>) -> BigUint {
        let current_time = self.blockchain().get_block_timestamp();
        
        if current_time < stream.start_time {
            return BigUint::zero();
        }

        let duration = stream.end_time - stream.start_time;
        let time_passed = if current_time > stream.end_time {
            duration
        } else {
            current_time - stream.start_time
        };

        // Standard Linear Vesting
        let total_vested = &stream.total_deposit * &BigUint::from(time_passed) / &BigUint::from(duration);
        
        if total_vested > stream.claimed_amount {
             total_vested - &stream.claimed_amount
        } else {
             BigUint::zero()
        }
    }

    // --- STORAGE & EVENTS ---

    #[view(getStream)]
    #[storage_mapper("streams")]
    fn streams(&self, id: u64) -> SingleValueMapper<Stream<Self::Api>>;

    #[view(getLastStreamId)]
    #[storage_mapper("lastStreamId")]
    fn last_stream_id(&self) -> SingleValueMapper<u64>;

    #[event("createStream")]
    fn create_stream_event(
        &self, 
        #[indexed] id: u64, 
        #[indexed] sender: &ManagedAddress, 
        times: (u64, u64)
    );
}