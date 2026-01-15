import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from 'config';

export interface Subscription {
  id: number;
  payer: string;
  recipient: string;
  tokenIdentifier: string;
  amountPerPayment: string;
  intervalSeconds: number;
  nextPaymentTime: number;
  createdAt: number;
  paymentsMade: number;
  totalPayments: number | null;
  depositedBalance: string;
  isActive: boolean;
  amountPerPaymentEGLD?: string;
  depositedBalanceEGLD?: string;
  nextPaymentDate?: string;
  intervalType?: string;
}

export const useGetUserSubscriptions = (address: string) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${config.backendApiUrl}/subscriptions/user/${address}`
      );
      setSubscriptions(response.data);
    } catch (err: any) {
      console.error('Error fetching subscriptions:', err);
      setError(err.message || 'Failed to fetch subscriptions');
      setSubscriptions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [address]);

  return {
    subscriptions,
    isLoading,
    error,
    refetch: fetchSubscriptions,
  };
};

export const useGetSubscription = (subscriptionId: number) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    if (!subscriptionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${config.backendApiUrl}/subscriptions/${subscriptionId}`
      );
      setSubscription(response.data);
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message || 'Failed to fetch subscription');
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [subscriptionId]);

  return {
    subscription,
    isLoading,
    error,
    refetch: fetchSubscription,
  };
};
