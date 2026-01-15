import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbiRegistry,
  Address,
  SmartContract,
  ResultsParser,
} from '@multiversx/sdk-core/out';
import { ApiNetworkProvider } from '@multiversx/sdk-network-providers/out';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ContractService implements OnModuleInit {
  private smartContract: SmartContract;
  private networkProvider: ApiNetworkProvider;
  private contractAddress: Address;
  private chainId: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Skip initialization if CONTRACT_ADDRESS is a placeholder
    const contractAddress = this.configService.get<string>('CONTRACT_ADDRESS');
    if (!contractAddress || contractAddress.includes('...')) {
      console.warn('⚠️  CONTRACT_ADDRESS not set or is a placeholder. Skipping contract initialization.');
      console.warn('📝 Deploy your contract first, then update CONTRACT_ADDRESS in .env');
      return;
    }
    this.initializeContract();
  }

  private initializeContract() {
    // Get configuration
    const apiUrl = this.configService.get<string>('API_URL');
    const contractAddressStr = this.configService.get<string>('CONTRACT_ADDRESS');
    this.chainId = this.configService.get<string>('CHAIN_ID');

    if (!apiUrl || !contractAddressStr || !this.chainId) {
      throw new Error(
        'Missing required environment variables: API_URL, CONTRACT_ADDRESS, CHAIN_ID',
      );
    }

    // Initialize network provider
    this.networkProvider = new ApiNetworkProvider(apiUrl);
    this.contractAddress = Address.fromBech32(contractAddressStr);

    // Load ABI
    const abiPath = path.join(
      __dirname,
      '../../..',
      'output',
      'scheduled-payments-contract.abi.json',
    );

    if (!fs.existsSync(abiPath)) {
      throw new Error(`ABI file not found at: ${abiPath}`);
    }

    const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
    const abiRegistry = AbiRegistry.create(abiJson);

    // Create smart contract instance
    this.smartContract = new SmartContract({
      address: this.contractAddress,
      abi: abiRegistry,
    });

    console.log('✅ Contract service initialized');
    console.log('📍 Contract address:', contractAddressStr);
    console.log('🌐 Network:', this.configService.get<string>('NETWORK'));
  }

  getSmartContract(): SmartContract {
    return this.smartContract;
  }

  getNetworkProvider(): ApiNetworkProvider {
    return this.networkProvider;
  }

  getContractAddress(): Address {
    return this.contractAddress;
  }

  getChainId(): string {
    return this.chainId;
  }

  /**
   * Query contract (read-only operation)
   */
  async queryContract(functionName: string, args: any[] = []): Promise<any> {
    const interaction = this.smartContract.methodsExplicit[functionName](args);
    const query = interaction.check().buildQuery();
    const queryResponse = await this.networkProvider.queryContract(query);
    const endpointDefinition = interaction.getEndpoint();
    const { firstValue } = new ResultsParser().parseQueryResponse(
      queryResponse,
      endpointDefinition,
    );

    return firstValue?.valueOf();
  }
}
