# scheduled_blockchain_payments

Subscription-based scheduled payments platform on MultiversX.

## Structure
- `src/` - smart contract
- `dapp/` - React dApp (based on mx-template-dapp)
- `scheduler/` - Python scheduler job (mx-sdk-py)
- `output/` - ABI output used by the dApp and scheduler

## Build + deploy smart contract
Build the contract and ABI:

```bash
cd /scheduled_blockchain_payments
cargo run build
```

Deploy using your preferred MultiversX tooling (devnet). After deployment, copy the
new contract address into:

```bash
 mxpy contract deploy     --bytecode="output/scheduled-payments-contract.wasm"     --pem="/pem/path"     --gas-limit=50000000     --proxy="https://devnet-gateway.multiversx.com"     --chain="D"     --send
 ```

- `dapp/src/config/config.devnet.ts`
- `scheduler/config.py`

Also sync the ABI for the dApp:

```bash
cp output/scheduled-payments-contract.abi.json dapp/src/contracts/scheduled-payments.abi.json
```

## Scheduler (env + run)
Create a virtualenv and install dependencies:

```bash
cd /scheduled_blockchain_payments/scheduler
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Update `scheduler/config.py`:
- `CONTRACT_ADDRESS`
- `PEM_PATH`
- `ACCOUNT_ADDRESS` (optional, can be derived from PEM)

Run:

```bash
python3 scheduler.py
```

## Dapp (install + run)
```bash
cd /Users/dandronic/to_be_deleted/BDPA/scheduled_blockchain_payments/dapp
npm install --global pnpm
pnpm install
pnpm start-devnet
```

## Contract address locations
Update the contract address in:
- `dapp/src/config/config.devnet.ts`
- `scheduler/config.py`
