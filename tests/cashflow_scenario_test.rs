use multiversx_sc_scenario::*;
use scheduled_payments_contract::*; 
use multiversx_sc_scenario::imports::BlockchainStateWrapper;

#[test]
fn subscription_flow_test() {
    let mut blockchain = BlockchainStateWrapper::new();
    let owner_address = blockchain.create_user_account(&rust_biguint!(0));
    let client = blockchain.create_user_account(&rust_biguint!(0));
    let vendor = blockchain.create_user_account(&rust_biguint!(0));

    // 1. Deploy Contract
    let contract_wrapper = blockchain.create_sc_account(
        &rust_biguint!(0),
        Some(&owner_address),
        scheduled_payments_contract::contract_obj,
        "output/scheduled-payments-contract.wasm",
    );

    // 2. Setup Tokens for Client
    // Client has 100 tokens
    blockchain.set_esdt_balance(&client, b"USDC-123456", &rust_biguint!(100));

    // 3. Create Subscription
    // Deposit: 60 USDC
    // Cost: 10 USDC per cycle
    // Frequency: 30 seconds (for testing)
    blockchain
        .execute_esdt_transfer(
            &client,
            &contract_wrapper,
            b"USDC-123456",
            0,
            &rust_biguint!(60),
            |sc| {
                sc.create_subscription(
                    vendor.clone().into(),
                    rust_biguint!(10).into(), // FIX: Added .into() here
                    30,                
                );
            },
        )
        .assert_ok();

    // 4. Try to trigger payment IMMEDIATELY (Should fail, cycle not reached)
    blockchain
        .execute_tx(&vendor, &contract_wrapper, &rust_biguint!(0), |sc| {
            sc.trigger_payment(1);
        })
        .assert_user_error("Payment cycle not reached yet");

    // 5. Fast Forward 30 Seconds
    blockchain.set_block_timestamp(30);

    // 6. Vendor Triggers Payment (Should Success)
    blockchain
        .execute_tx(&vendor, &contract_wrapper, &rust_biguint!(0), |sc| {
            sc.trigger_payment(1);
        })
        .assert_ok();

    // 7. Check Vendor Balance (Should have 10)
    blockchain.check_esdt_balance(&vendor, b"USDC-123456", &rust_biguint!(10));

    // 8. Client Cancels
    blockchain
        .execute_tx(&client, &contract_wrapper, &rust_biguint!(0), |sc| {
            sc.cancel_subscription(1);
        })
        .assert_ok();

    // 9. Check Client Balance
    // Started with 100. Sent 60. Got refunded 50 (60 - 10 payment).
    // Should have 90.
    blockchain.check_esdt_balance(&client, b"USDC-123456", &rust_biguint!(90));
}