use multiversx_sc_scenario::*;
use scheduled_payments_contract::*; // Name from Cargo.toml
use multiversx_sc_scenario::imports::BlockchainStateWrapper;


#[test]
fn simple_flow_test() {
    let mut blockchain = BlockchainStateWrapper::new();
    let owner_address = blockchain.create_user_account(&rust_biguint!(0));
    let sender = blockchain.create_user_account(&rust_biguint!(0));
    let recipient = blockchain.create_user_account(&rust_biguint!(0));

    // 1. Deploy Contract
    let contract_wrapper = blockchain.create_sc_account(
        &rust_biguint!(0),
        Some(&owner_address), // fix: wrap in Some
        scheduled_payments_contract::contract_obj,
        "output/scheduled-payments-contract.wasm",
    );
    
    // let mut contract = contract_wrapper.contract_obj::<scheduled_payments_contract::ContractObj<DebugApi>>();

    // 2. Setup Tokens for Sender
    blockchain.set_esdt_balance(&sender, b"CASH-123456", &rust_biguint!(1000));

    // 3. Create Stream (1000 tokens, from time 0 to 100)
    blockchain
        .execute_esdt_transfer(
            &sender,
            &contract_wrapper,
            b"CASH-123456",
            0,
            &rust_biguint!(1000),
            |sc| {
                sc.create_stream(
                    recipient.clone().into(),
                    0,   // Start Time
                    100, // End Time
                );
            },
        )
        .assert_ok();

    // 4. Warp Time Forward (50 seconds passed)
    blockchain.set_block_timestamp(50);

    // 5. Recipient Claims
    blockchain
        .execute_tx(&recipient, &contract_wrapper, &rust_biguint!(0), |sc| {
            sc.claim(1); // Claim stream ID 1
        })
        .assert_ok();

    // 6. Verify Balance (Should have 500)
    blockchain.check_esdt_balance(&recipient, b"CASH-123456", &rust_biguint!(500));
}