use multiversx_sc_snippets::imports::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;

// 1. Declare the module (Must match the filename 'scheduled_payments_contract_proxy.rs')
mod scheduled_payments_contract_proxy;

// 2. Import the struct
use scheduled_payments_contract_proxy::SubscriptionContractProxy;

const GATEWAY: &str = "https://devnet-gateway.multiversx.com";
const PEM_FILE: &str = "/home/vboxuser/Downloads/converted_wallet.pem";
const STATE_FILE: &str = "state.json";
const SYSTEM_SC_ADDRESS: &str = "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzllls8a5w6u";

pub async fn scheduled_payments_contract_cli() {
    env_logger::init();

    let mut interact = ContractInteractor::new().await;
    let wallet_address = interact.wallet_address.clone();

    println!("Wallet: {}", wallet_address.to_bech32("erd"));
    println!("Select action:");
    println!("1. Deploy Contract");
    println!("2. Issue Test Token (USDC)");
    println!("3. Create Subscription (Deposit 100, Cost 10/min)");
    println!("4. Trigger Payment");
    println!("5. Cancel Subscription");
    println!("6. View OUTGOING Subscriptions (As Client)");
    println!("7. View INCOMING Subscriptions (As Vendor)");

    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();

    match input.trim() {
        "1" => interact.deploy().await,
        "2" => interact.issue_token().await,
        "3" => interact.create_subscription().await,
        "4" => interact.trigger_payment().await,
        "5" => interact.cancel_subscription().await,
        "6" => interact.view_my_subscriptions(wallet_address).await,
        "7" => interact.view_incoming_subscriptions(wallet_address).await, 
        
        _ => println!("Invalid selection"),
    }
}

// --- STATE MANAGEMENT ---
#[derive(Debug, Default, Serialize, Deserialize)]
struct State {
    contract_address: Option<String>,
    token_id: Option<String>,
}

impl State {
    fn load() -> Self {
        if let Ok(content) = fs::read_to_string(STATE_FILE) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            State::default()
        }
    }

    fn save(&self) {
        let content = serde_json::to_string_pretty(self).unwrap();
        fs::write(STATE_FILE, content).unwrap();
    }
}

// --- INTERACTOR ---
struct ContractInteractor {
    interactor: Interactor,
    wallet_address: Address,
    contract_code: BytesValue,
    state: State,
}

impl ContractInteractor {
    async fn new() -> Self {
        let mut interactor = Interactor::new(GATEWAY).await;
        let wallet_address = interactor.register_wallet(Wallet::from_pem_file(PEM_FILE).unwrap()).await;
        
        let contract_code = BytesValue::interpret_from(
            "mxsc:../output/scheduled-payments-contract.mxsc.json",
            &InterpreterContext::default(),
        );

        ContractInteractor {
            interactor,
            wallet_address,
            contract_code,
            state: State::load(),
        }
    }

    async fn deploy(&mut self) {
        let new_address = self
            .interactor
            .tx()
            .from(&self.wallet_address)
            .gas(60_000_000)
            .typed(SubscriptionContractProxy)
            .init()
            .code(&self.contract_code)
            .returns(ReturnsNewAddress)
            .run()
            .await;

        let address_str = new_address.to_bech32("erd").to_string();
        println!("Contract Deployed: {}", address_str);
        
        self.state.contract_address = Some(address_str);
        self.state.save();
    }

    async fn issue_token(&mut self) {
        let token_name = "USDCTest";
        let token_ticker = "USDC";
        let initial_supply = RustBigUint::from(1_000_000u64) * RustBigUint::from(10u64).pow(18);
        
        println!("Issuing token... please wait (~1 min)");

        self.interactor
            .tx()
            .from(&self.wallet_address)
            .to(&Bech32Address::from_bech32_string(SYSTEM_SC_ADDRESS.to_string()))
            .gas(80_000_000)
            .egld(50_000_000_000_000_000u128) 
            .raw_call("issue")
            .argument(&token_name)
            .argument(&token_ticker)
            .argument(&initial_supply)
            .argument(&18u32)
            .argument(&"canFreeze")
            .argument(&"true")
            .argument(&"canWipe")
            .argument(&"true")
            .argument(&"canPause")
            .argument(&"true")
            .returns(ReturnsResult)
            .run()
            .await;

        println!("Transaction Sent. Enter the Token ID here (e.g., USDC-123456):");
        
        let mut token_id = String::new();
        io::stdin().read_line(&mut token_id).unwrap();
        let token_id = token_id.trim().to_string();
        
        self.state.token_id = Some(token_id);
        self.state.save();
    }

    async fn create_subscription(&mut self) {
        let contract_address_str = self.state.contract_address.as_ref().expect("Deploy first!");
        let contract_address = Bech32Address::from_bech32_string(contract_address_str.clone());
        
        let token_id_str = self.state.token_id.as_ref().expect("Issue token first!");
        let token_id = TokenIdentifier::from(token_id_str.as_str()); 
        
        // 1. Vendor Logic
        println!("Enter vendor address (bech32), or press Enter to use your wallet:");
        let mut vendor_input = String::new();
        io::stdin().read_line(&mut vendor_input).unwrap();
        
        let vendor_address = if vendor_input.trim().is_empty() {
            self.wallet_address.clone()
        } else {
            Bech32Address::from_bech32_string(vendor_input.trim().to_string())
                .to_address()
        };

        // 2. Frequency Logic
        println!("Enter frequency in seconds (e.g., 60 for 1 min, 86400 for 1 day):");
        let mut freq_str = String::new();
        io::stdin().read_line(&mut freq_str).unwrap();
        let frequency: u64 = freq_str.trim().parse().unwrap_or(60);

        let deposit_amount = BigUint::from(100u64) * BigUint::from(10u64).pow(18); 
        let cost_per_cycle = BigUint::from(10u64) * BigUint::from(10u64).pow(18); 

        self.interactor
            .tx()
            .from(&self.wallet_address)
            .to(&contract_address)
            .gas(120_000_000) 
            .typed(SubscriptionContractProxy)
            .create_subscription(vendor_address, cost_per_cycle, frequency)
            .single_esdt(&token_id, 0, &deposit_amount)
            .run()
            .await;

        println!("Subscription Created!");
    }

    async fn trigger_payment(&mut self) {
        println!("Enter Subscription ID to trigger:");
        let mut id_str = String::new();
        io::stdin().read_line(&mut id_str).unwrap();
        let sub_id: u64 = id_str.trim().parse().expect("Invalid ID");

        let contract_address_str = self.state.contract_address.as_ref().expect("Deploy first!");
        let contract_address = Bech32Address::from_bech32_string(contract_address_str.clone());

        self.interactor
            .tx()
            .from(&self.wallet_address)
            .to(&contract_address)
            .gas(10_000_000)
            .typed(SubscriptionContractProxy)
            .trigger_payment(sub_id)
            .run()
            .await;

        println!("Payment Triggered Successfully!");
    }

    async fn cancel_subscription(&mut self) {
        println!("Enter Subscription ID to cancel:");
        let mut id_str = String::new();
        io::stdin().read_line(&mut id_str).unwrap();
        let sub_id: u64 = id_str.trim().parse().expect("Invalid ID");

        let contract_address_str = self.state.contract_address.as_ref().expect("Deploy first!");
        let contract_address = Bech32Address::from_bech32_string(contract_address_str.clone());

        self.interactor
            .tx()
            .from(&self.wallet_address)
            .to(&contract_address)
            .gas(10_000_000)
            .typed(SubscriptionContractProxy)
            .cancel_subscription(sub_id)
            .run()
            .await;

        println!("Subscription Cancelled.");
    }

    async fn view_my_subscriptions(&mut self, address: Address) {
        let contract = self.state.contract_address.as_ref().expect("Deploy first!");
        let contract_address = Bech32Address::from_bech32_string(contract.clone());

        let result = self
            .interactor
            .query()
            .to(&contract_address)
            .typed(SubscriptionContractProxy)
            .get_client_subscriptions(address)
            .returns(ReturnsResultUnmanaged) // FIX: Added this line
            .run()
            .await;

        println!("My Subscription IDs: {:?}", result);
    }

    async fn view_incoming_subscriptions(&mut self, address: Address) {
        let contract = self.state.contract_address.as_ref().expect("Deploy first!");
        let contract_address = Bech32Address::from_bech32_string(contract.clone());

        let result = self
            .interactor
            .query()
            .to(&contract_address)
            .typed(SubscriptionContractProxy)
            .get_vendor_subscriptions(address)
            .returns(ReturnsResultUnmanaged) // FIX: Added this line
            .run()
            .await;

        println!("Incoming Subscription IDs (Vendor): {:?}", result);
    }
}