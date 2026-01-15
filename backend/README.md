# Scheduled Payments Backend Service

NestJS backend service for interacting with the Scheduled Payments smart contract.

## Features

- 🔗 Smart contract interaction via MultiversX SDK
- 📝 Transaction generation endpoints
- 🔍 Query contract state
- 📚 Swagger API documentation
- ✅ Health monitoring

## Prerequisites

- Node.js v16+
- npm/pnpm/yarn
- Deployed smart contract on testnet
- Contract ABI file in `../output/` directory

## Installation

```bash
npm install
```

## Configuration

Create `.env` file:

```env
# Network Configuration
NETWORK=testnet
API_URL=https://testnet-api.multiversx.com
CHAIN_ID=T

# Contract Address (from deployment)
CONTRACT_ADDRESS=erd1qqqqqqqqqqqqqpgq...

# Server Configuration
PORT=3001
```

## Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server runs on `http://localhost:3001`

## API Documentation

Swagger UI available at: `http://localhost:3001/api`

## Endpoints

### Subscriptions

- `GET /subscriptions/user/:address` - Get user's subscriptions
- `GET /subscriptions/:id` - Get subscription by ID
- `GET /subscriptions/:id/payment-due` - Check if payment is due
- `GET /subscriptions/:id/time-until-payment` - Time until next payment
- `POST /subscriptions/create?address=erd1...` - Create subscription
- `POST /subscriptions/cancel/:id?address=erd1...` - Cancel subscription
- `POST /subscriptions/execute/:id?address=erd1...` - Execute payment
- `POST /subscriptions/top-up/:id?address=erd1...` - Top up subscription

### Health

- `GET /health` - Health check

## Project Structure

```
src/
├── main.ts                          # Entry point
├── app.module.ts                    # Root module
├── health/
│   └── health.controller.ts         # Health check
└── subscriptions/
    ├── subscriptions.module.ts      # Module
    ├── subscriptions.controller.ts  # REST endpoints
    ├── subscriptions.service.ts     # Business logic
    ├── contract.service.ts          # Contract interaction
    ├── dto/
    │   └── create-subscription.dto.ts
    └── entities/
        └── subscription.entity.ts
```

## License

MIT
