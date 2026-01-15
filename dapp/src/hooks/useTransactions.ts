import { useState } from 'react';
import axios from 'axios';
import { TransactionManager, refreshAccount, getAccountProvider } from 'lib';
import { Transaction } from '@multiversx/sdk-core';
import { config } from 'config';

export interface CreateSubscriptionData {
  recipient: string;
  amountPerPayment: string;
  initialDeposit: string;
  intervalType: 'Daily' | 'Weekly' | 'Monthly';
  totalPayments?: number;
}

export const useCreateSubscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSubscription = async (
    userAddress: string,
    data: CreateSubscriptionData
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get transaction from backend
      const response = await axios.post(
        `${config.backendApiUrl}/subscriptions/create?address=${userAddress}`,
        data
      );

      // Get provider and sign transaction
      const provider = getAccountProvider();
      const transaction = Transaction.fromPlainObject(response.data);
      const signedTransactions = await provider.signTransactions([transaction]);

      // Send and track transaction
      const txManager = TransactionManager.getInstance();
      const sentTransactions = await txManager.send(signedTransactions);
      
      const sessionId = await txManager.track(sentTransactions, {
        transactionsDisplayInfo: {
          processingMessage: 'Creating subscription...',
          errorMessage: 'Failed to create subscription',
          successMessage: 'Subscription created successfully!'
        }
      });

      // Refresh account to update balance
      await refreshAccount();

      return { sessionId, success: true };
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      setError(err.message || 'Failed to create subscription');
      return { sessionId: null, success: false };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createSubscription,
    isLoading,
    error
  };
};

export const useCancelSubscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelSubscription = async (
    userAddress: string,
    subscriptionId: number
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.backendApiUrl}/subscriptions/cancel/${subscriptionId}?address=${userAddress}`
      );

      const provider = getAccountProvider();
      const transaction = Transaction.fromPlainObject(response.data);
      const signedTransactions = await provider.signTransactions([transaction]);

      const txManager = TransactionManager.getInstance();
      const sentTransactions = await txManager.send(signedTransactions);
      
      const sessionId = await txManager.track(sentTransactions, {
        transactionsDisplayInfo: {
          processingMessage: 'Cancelling subscription...',
          errorMessage: 'Failed to cancel subscription',
          successMessage: 'Subscription cancelled successfully!'
        }
      });

      await refreshAccount();

      return { sessionId, success: true };
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
      return { sessionId: null, success: false };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    cancelSubscription,
    isLoading,
    error
  };
};

export const useExecutePayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executePayment = async (
    userAddress: string,
    subscriptionId: number
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.backendApiUrl}/subscriptions/execute/${subscriptionId}?address=${userAddress}`
      );

      const provider = getAccountProvider();
      const transaction = Transaction.fromPlainObject(response.data);
      const signedTransactions = await provider.signTransactions([transaction]);

      const txManager = TransactionManager.getInstance();
      const sentTransactions = await txManager.send(signedTransactions);
      
      const sessionId = await txManager.track(sentTransactions, {
        transactionsDisplayInfo: {
          processingMessage: 'Executing payment...',
          errorMessage: 'Failed to execute payment',
          successMessage: 'Payment executed successfully!'
        }
      });

      await refreshAccount();

      return { sessionId, success: true };
    } catch (err: any) {
      console.error('Error executing payment:', err);
      setError(err.message || 'Failed to execute payment');
      return { sessionId: null, success: false };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    executePayment,
    isLoading,
    error
  };
};

export const useTopUpSubscription = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topUpSubscription = async (
    userAddress: string,
    subscriptionId: number,
    amount: string
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${config.backendApiUrl}/subscriptions/top-up/${subscriptionId}?address=${userAddress}`,
        { amount }
      );

      const provider = getAccountProvider();
      const transaction = Transaction.fromPlainObject(response.data);
      const signedTransactions = await provider.signTransactions([transaction]);

      const txManager = TransactionManager.getInstance();
      const sentTransactions = await txManager.send(signedTransactions);
      
      const sessionId = await txManager.track(sentTransactions, {
        transactionsDisplayInfo: {
          processingMessage: 'Topping up subscription...',
          errorMessage: 'Failed to top up subscription',
          successMessage: 'Subscription topped up successfully!'
        }
      });

      await refreshAccount();

      return { sessionId, success: true };
    } catch (err: any) {
      console.error('Error topping up subscription:', err);
      setError(err.message || 'Failed to top up subscription');
      return { sessionId: null, success: false };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    topUpSubscription,
    isLoading,
    error
  };
};
