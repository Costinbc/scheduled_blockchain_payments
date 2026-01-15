import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useGetUserSubscriptions } from 'hooks/useSubscriptions';
import { useCancelSubscription, useExecutePayment, useTopUpSubscription } from 'hooks/useTransactions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSync, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { RouteNamesEnum } from 'localConstants/routes';
import { SubscriptionCard } from './components/SubscriptionCard';

export const Subscriptions = () => {
  const { address } = useGetAccount();
  const { subscriptions, isLoading, refetch } = useGetUserSubscriptions(address);
  const { cancelSubscription, isLoading: isCancelling } = useCancelSubscription();
  const { executePayment, isLoading: isExecuting } = useExecutePayment();
  const { topUpSubscription, isLoading: isToppingUp } = useTopUpSubscription();

  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredSubscriptions = subscriptions?.filter(sub => {
    if (filter === 'active') return sub.isActive;
    if (filter === 'inactive') return !sub.isActive;
    return true;
  }) || [];

  const handleCancel = async (subscriptionId: number) => {
    if (!window.confirm('Are you sure you want to cancel this subscription? Remaining balance will be refunded.')) {
      return;
    }

    const result = await cancelSubscription(address, subscriptionId);
    if (result.success) {
      setTimeout(() => refetch(), 2000);
    }
  };

  const handleExecute = async (subscriptionId: number) => {
    const result = await executePayment(address, subscriptionId);
    if (result.success) {
      setTimeout(() => refetch(), 2000);
    }
  };

  const handleTopUp = async (subscriptionId: number, amount: string) => {
    const result = await topUpSubscription(address, subscriptionId, amount);
    if (result.success) {
      setTimeout(() => refetch(), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">My Subscriptions</h1>
        <div className="flex space-x-4">
          <button
            onClick={refetch}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faSync} className={isLoading ? 'animate-spin' : ''} />
            <span className="ml-2">Refresh</span>
          </button>
          <Link
            to={RouteNamesEnum.createSubscription}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="ml-2">New Subscription</span>
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          All ({subscriptions?.length || 0})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filter === 'active'
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
          Active ({subscriptions?.filter(s => s.isActive).length || 0})
        </button>
        <button
          onClick={() => setFilter('inactive')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filter === 'inactive'
              ? 'bg-slate-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <FontAwesomeIcon icon={faTimesCircle} className="mr-2" />
          Inactive ({subscriptions?.filter(s => !s.isActive).length || 0})
        </button>
      </div>

      {/* Subscriptions List */}
      {isLoading ? (
        <div className="text-center py-12">
          <FontAwesomeIcon icon={faSync} className="text-4xl text-blue-500 animate-spin mb-4" />
          <p className="text-slate-400">Loading subscriptions...</p>
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-slate-400 mb-4">
            {filter === 'all'
              ? 'No subscriptions yet'
              : `No ${filter} subscriptions`}
          </p>
          <Link
            to={RouteNamesEnum.createSubscription}
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Create Your First Subscription
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredSubscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onCancel={handleCancel}
              onExecute={handleExecute}
              onTopUp={handleTopUp}
              isProcessing={isCancelling || isExecuting || isToppingUp}
            />
          ))}
        </div>
      )}
    </div>
  );
};
