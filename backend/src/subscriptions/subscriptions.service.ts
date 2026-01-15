import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Address, Transaction, TokenTransfer } from '@multiversx/sdk-core/out';
import { ContractService } from './contract.service';
import { Subscription } from './entities/subscription.entity';
import { CreateSubscriptionDto, IntervalType } from './dto/create-subscription.dto';
import BigNumber from 'bignumber.js';

@Injectable()
export class SubscriptionsService {
  private readonly EGLD_DECIMALS = 18;

  constructor(
    private readonly contractService: ContractService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userAddress: string): Promise<Subscription[]> {
    try {
      const address = Address.fromBech32(userAddress);
      const subscriptionsData = await this.contractService.queryContract(
        'getUserSubscriptions',
        [address],
      );

      if (!subscriptionsData || subscriptionsData.length === 0) {
        return [];
      }

      return subscriptionsData.map((sub: any) => this.mapSubscription(sub));
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      return [];
    }
  }

  /**
   * Get a specific subscription by ID
   */
  async getSubscription(subscriptionId: number): Promise<Subscription | null> {
    try {
      const subscriptionData = await this.contractService.queryContract(
        'getSubscription',
        [subscriptionId],
      );

      if (!subscriptionData || !subscriptionData.is_some) {
        return null;
      }

      return this.mapSubscription(subscriptionData.value);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
  }

  /**
   * Check if payment is due for a subscription
   */
  async isPaymentDue(subscriptionId: number): Promise<boolean> {
    try {
      const result = await this.contractService.queryContract('isPaymentDue', [
        subscriptionId,
      ]);
      return result || false;
    } catch (error) {
      console.error('Error checking payment due:', error);
      return false;
    }
  }

  /**
   * Get time until next payment in seconds
   */
  async getTimeUntilNextPayment(
    subscriptionId: number,
  ): Promise<number | null> {
    try {
      const result = await this.contractService.queryContract(
        'getTimeUntilNextPayment',
        [subscriptionId],
      );

      if (!result || !result.is_some) {
        return null;
      }

      return result.value.toNumber();
    } catch (error) {
      console.error('Error getting time until next payment:', error);
      return null;
    }
  }

  /**
   * Generate unsigned transaction to create a subscription
   */
  async generateCreateSubscriptionTransaction(
    userAddress: string,
    dto: CreateSubscriptionDto,
  ): Promise<any> {
    try {
      const address = Address.fromBech32(userAddress);
      const account = await this.contractService
        .getNetworkProvider()
        .getAccount(address);

      // Convert EGLD amounts to wei (atomic units)
      const amountPerPaymentWei = this.egldToWei(dto.amountPerPayment);
      const initialDepositWei = this.egldToWei(dto.initialDeposit);

      // Validate amounts
      if (new BigNumber(initialDepositWei).lt(amountPerPaymentWei)) {
        throw new Error('Initial deposit must be at least one payment amount');
      }

      // Map interval type to contract enum
      const intervalTypeEnum = this.mapIntervalTypeToEnum(dto.intervalType);

      // Prepare recipient address
      const recipientAddress = Address.fromBech32(dto.recipient);

      // Build transaction
      const contract = this.contractService.getSmartContract();
      const transaction = contract.methods
        .createSubscription([
          recipientAddress,
          amountPerPaymentWei,
          intervalTypeEnum,
          dto.totalPayments || null,
        ])
        .withSender(address)
        .withValue(TokenTransfer.egldFromBigInteger(initialDepositWei))
        .withGasLimit(15_000_000)
        .withChainID(this.contractService.getChainId())
        .withNonce(account.nonce)
        .buildTransaction();

      return transaction.toPlainObject();
    } catch (error) {
      console.error('Error generating create subscription transaction:', error);
      throw error;
    }
  }

  /**
   * Generate unsigned transaction to cancel a subscription
   */
  async generateCancelSubscriptionTransaction(
    userAddress: string,
    subscriptionId: number,
  ): Promise<any> {
    try {
      const address = Address.fromBech32(userAddress);
      const account = await this.contractService
        .getNetworkProvider()
        .getAccount(address);

      const contract = this.contractService.getSmartContract();
      const transaction = contract.methods
        .cancelSubscription([subscriptionId])
        .withSender(address)
        .withValue(TokenTransfer.egldFromBigInteger('0'))
        .withGasLimit(10_000_000)
        .withChainID(this.contractService.getChainId())
        .withNonce(account.nonce)
        .buildTransaction();

      return transaction.toPlainObject();
    } catch (error) {
      console.error('Error generating cancel subscription transaction:', error);
      throw error;
    }
  }

  /**
   * Generate unsigned transaction to execute a payment
   */
  async generateExecutePaymentTransaction(
    userAddress: string,
    subscriptionId: number,
  ): Promise<any> {
    try {
      const address = Address.fromBech32(userAddress);
      const account = await this.contractService
        .getNetworkProvider()
        .getAccount(address);

      const contract = this.contractService.getSmartContract();
      const transaction = contract.methods
        .executePayment([subscriptionId])
        .withSender(address)
        .withValue(TokenTransfer.egldFromBigInteger('0'))
        .withGasLimit(10_000_000)
        .withChainID(this.contractService.getChainId())
        .withNonce(account.nonce)
        .buildTransaction();

      return transaction.toPlainObject();
    } catch (error) {
      console.error('Error generating execute payment transaction:', error);
      throw error;
    }
  }

  /**
   * Generate unsigned transaction to top up a subscription
   */
  async generateTopUpSubscriptionTransaction(
    userAddress: string,
    subscriptionId: number,
    amount: string,
  ): Promise<any> {
    try {
      const address = Address.fromBech32(userAddress);
      const account = await this.contractService
        .getNetworkProvider()
        .getAccount(address);

      const amountWei = this.egldToWei(amount);

      const contract = this.contractService.getSmartContract();
      const transaction = contract.methods
        .topUpSubscription([subscriptionId])
        .withSender(address)
        .withValue(TokenTransfer.egldFromBigInteger(amountWei))
        .withGasLimit(10_000_000)
        .withChainID(this.contractService.getChainId())
        .withNonce(account.nonce)
        .buildTransaction();

      return transaction.toPlainObject();
    } catch (error) {
      console.error('Error generating top up subscription transaction:', error);
      throw error;
    }
  }

  /**
   * Map raw subscription data from contract to Subscription entity
   */
  private mapSubscription(data: any): Subscription {
    const amountPerPayment = data.amount_per_payment?.toString() || '0';
    const depositedBalance = data.deposited_balance?.toString() || '0';
    const intervalSeconds = data.interval_seconds?.toNumber() || 0;

    return {
      id: data.id?.toNumber() || 0,
      payer: data.payer?.bech32() || '',
      recipient: data.recipient?.bech32() || '',
      tokenIdentifier: data.token_identifier?.toString() || 'EGLD',
      amountPerPayment,
      intervalSeconds,
      nextPaymentTime: data.next_payment_time?.toNumber() || 0,
      createdAt: data.created_at?.toNumber() || 0,
      paymentsMade: data.payments_made?.toNumber() || 0,
      totalPayments: data.total_payments?.is_some
        ? data.total_payments.value.toNumber()
        : null,
      depositedBalance,
      isActive: data.is_active || false,
      // Add human-readable fields
      amountPerPaymentEGLD: this.weiToEgld(amountPerPayment),
      depositedBalanceEGLD: this.weiToEgld(depositedBalance),
      nextPaymentDate: new Date(
        data.next_payment_time?.toNumber() * 1000,
      ).toISOString(),
      intervalType: this.getIntervalTypeName(intervalSeconds),
    };
  }

  /**
   * Convert EGLD to wei (atomic units)
   */
  private egldToWei(egld: string): string {
    return new BigNumber(egld)
      .multipliedBy(new BigNumber(10).pow(this.EGLD_DECIMALS))
      .toFixed(0);
  }

  /**
   * Convert wei to EGLD (human-readable)
   */
  private weiToEgld(wei: string): string {
    return new BigNumber(wei)
      .dividedBy(new BigNumber(10).pow(this.EGLD_DECIMALS))
      .toFixed();
  }

  /**
   * Map interval type to contract enum value
   */
  private mapIntervalTypeToEnum(intervalType: IntervalType): any {
    const mapping = {
      [IntervalType.Daily]: { name: 'Daily', fields: [] },
      [IntervalType.Weekly]: { name: 'Weekly', fields: [] },
      [IntervalType.Monthly]: { name: 'Monthly', fields: [] },
    };

    return mapping[intervalType];
  }

  /**
   * Get human-readable interval type name from seconds
   */
  private getIntervalTypeName(seconds: number): string {
    const DAY = 86400;
    const WEEK = 604800;
    const MONTH = 2592000;

    if (seconds === DAY) return 'Daily';
    if (seconds === WEEK) return 'Weekly';
    if (seconds === MONTH) return 'Monthly';
    return `Every ${seconds} seconds`;
  }
}
