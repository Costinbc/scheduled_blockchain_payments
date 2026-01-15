import { EnvironmentsEnum } from '@multiversx/sdk-dapp/out/types/enums.types';

const networkEnv = import.meta.env.VITE_NETWORK || 'devnet';

export const config = {
  environment: networkEnv as EnvironmentsEnum,
  apiUrl: import.meta.env.VITE_API_URL || 'https://devnet-api.multiversx.com',
  backendApiUrl: import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001',
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || '',
  chainId: networkEnv === 'mainnet' ? '1' : 'D',
};

export const apiTimeout = 6000;
export const transactionSize = 10;
export const walletConnectV2ProjectId = '9b1a9564f91cb659ffe21b73d5c4e2d8';
