# Scheduled Payments DApp

A decentralized application for managing recurring blockchain payments on MultiversX.

## Features

- 🔐 **Secure Wallet Connection** - Connect with xPortal, DeFi Wallet, Web Wallet, or Ledger
- 📅 **Recurring Payments** - Set up daily, weekly, or monthly automated payments
- 💰 **Full Control** - Cancel subscriptions anytime and get refunds
- ⚡ **Real-time Updates** - Track all your subscriptions in one place
- 🔒 **Smart Contract Powered** - Trustless, automated execution

## Prerequisites

- Node.js v16+ and npm/pnpm/yarn
- A MultiversX wallet (xPortal, DeFi Wallet, or Web Wallet)
- Backend service running (see `../backend/README.md`)
- Smart contract deployed on devnet/testnet/mainnet

## Installation

```bash
# Install dependencies
npm install
# or
pnpm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your configuration:
```env
VITE_NETWORK=devnet
VITE_API_URL=https://devnet-api.multiversX.com
VITE_BACKEND_API_URL=http://localhost:3001
VITE_CONTRACT_ADDRESS=erd1qqq... # Your deployed contract address
```

## Development

Start the development server:

```bash
npm run start
```

The app will be available at `http://localhost:3000`

## Building

Build for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Project Structure

```
dapp/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── Header/
│   │   ├── Footer/
│   │   └── Layout/
│   ├── pages/             # Page components
│   │   ├── Home/
│   │   ├── Dashboard/
│   │   ├── Subscriptions/
│   │   ├── CreateSubscription/
│   │   └── Unlock/
│   ├── hooks/             # Custom React hooks
│   │   ├── useSubscriptions.ts
│   │   └── useTransactions.ts
│   ├── config/            # Configuration
│   ├── routes/            # Route definitions
│   ├── localConstants/    # Constants
│   └── styles/            # Global styles
├── index.html
├── package.json
└── vite.config.ts
```

## Usage

### 1. Connect Your Wallet
- Click "Connect Wallet" and choose your preferred method
- Sign the authentication message

### 2. Create a Subscription
- Navigate to "Create Subscription"
- Fill in:
  - Recipient address
  - Amount per payment
  - Payment interval (Daily/Weekly/Monthly)
  - Initial deposit amount
  - (Optional) Total payment limit
- Sign the transaction

### 3. Manage Subscriptions
- View all subscriptions on the "My Subscriptions" page
- Execute payments when due
- Top up subscription balance
- Cancel subscriptions (get refund of remaining balance)

## Smart Contract Integration

The dApp interacts with the smart contract through:

1. **Backend API** - Generates unsigned transactions
2. **MultiversX SDK** - Signs and sends transactions
3. **Contract Queries** - Reads subscription data

All transactions are signed by the user's wallet - the dApp never has access to private keys.

## Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **@multiversx/sdk-dapp** - MultiversX integration
- **@multiversx/sdk-core** - Core blockchain operations
- **Axios** - HTTP client
- **React Router** - Navigation

## License

MIT
