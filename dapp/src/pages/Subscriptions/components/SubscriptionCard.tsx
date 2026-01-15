import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendar, 
  faWallet, 
  faUser, 
  faCoins, 
  faClock,
  faPlay,
  faTrash,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'hooks/useSubscriptions';
import { formatDistance } from '../utils';

interface SubscriptionCardProps {
  subscription: Subscription;
  onCancel: (id: number) => void;
  onExecute: (id: number) => void;
  onTopUp: (id: number, amount: string) => void;
  isProcessing: boolean;
}

export const SubscriptionCard = ({
  subscription,
  onCancel,
  onExecute,
  onTopUp,
  isProcessing
}: SubscriptionCardProps) => {
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');

  const isPaymentDue = subscription.isActive && 
    Date.now() / 1000 >= subscription.nextPaymentTime;

  const timeUntilPayment = formatDistance(
    subscription.nextPaymentTime * 1000 - Date.now()
  );

  const handleTopUpSubmit = () => {
    if (topUpAmount && parseFloat(topUpAmount) > 0) {
      onTopUp(subscription.id, topUpAmount);
      setTopUpAmount('');
      setShowTopUp(false);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
  };

  return (
    <div className={`bg-slate-800 rounded-lg p-6 border ${
      subscription.isActive ? 'border-green-500/30' : 'border-slate-700'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              subscription.isActive
                ? 'bg-green-500/20 text-green-400'
                : 'bg-slate-600/50 text-slate-400'
            }`}>
              {subscription.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
              {subscription.intervalType}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white">
            Subscription #{subscription.id}
          </h3>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-3">
          <div className="flex items-center text-slate-300">
            <FontAwesomeIcon icon={faUser} className="w-5 mr-3 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Recipient</p>
              <p className="text-sm font-mono">{shortenAddress(subscription.recipient)}</p>
            </div>
          </div>

          <div className="flex items-center text-slate-300">
            <FontAwesomeIcon icon={faCoins} className="w-5 mr-3 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Amount per payment</p>
              <p className="text-sm font-semibold">{subscription.amountPerPaymentEGLD} EGLD</p>
            </div>
          </div>

          <div className="flex items-center text-slate-300">
            <FontAwesomeIcon icon={faCalendar} className="w-5 mr-3 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Payments made</p>
              <p className="text-sm">
                {subscription.paymentsMade}
                {subscription.totalPayments ? ` / ${subscription.totalPayments}` : ' / Unlimited'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center text-slate-300">
            <FontAwesomeIcon icon={faWallet} className="w-5 mr-3 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Balance</p>
              <p className="text-sm font-semibold">{subscription.depositedBalanceEGLD} EGLD</p>
            </div>
          </div>

          <div className="flex items-center text-slate-300">
            <FontAwesomeIcon icon={faClock} className="w-5 mr-3 text-slate-500" />
            <div>
              <p className="text-xs text-slate-500">Next payment</p>
              <p className="text-sm">
                {subscription.isActive ? (
                  isPaymentDue ? (
                    <span className="text-green-400 font-semibold">Ready to execute!</span>
                  ) : (
                    timeUntilPayment
                  )
                ) : (
                  'N/A'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Up Form */}
      {showTopUp && (
        <div className="mb-4 p-4 bg-slate-700 rounded-lg">
          <label className="block text-sm text-slate-300 mb-2">Top Up Amount (EGLD)</label>
          <div className="flex space-x-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Amount in EGLD"
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
            />
            <button
              onClick={handleTopUpSubmit}
              disabled={isProcessing || !topUpAmount || parseFloat(topUpAmount) <= 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setShowTopUp(false);
                setTopUpAmount('');
              }}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {subscription.isActive && isPaymentDue && (
          <button
            onClick={() => onExecute(subscription.id)}
            disabled={isProcessing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center"
          >
            <FontAwesomeIcon icon={faPlay} className="mr-2" />
            Execute Payment
          </button>
        )}

        {subscription.isActive && (
          <button
            onClick={() => setShowTopUp(!showTopUp)}
            disabled={isProcessing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center"
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Top Up
          </button>
        )}

        {subscription.isActive && (
          <button
            onClick={() => onCancel(subscription.id)}
            disabled={isProcessing}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center"
          >
            <FontAwesomeIcon icon={faTrash} className="mr-2" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
