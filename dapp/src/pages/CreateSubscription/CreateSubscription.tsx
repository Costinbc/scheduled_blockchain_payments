import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useCreateSubscription, CreateSubscriptionData } from 'hooks/useTransactions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { RouteNamesEnum } from 'localConstants/routes';

export const CreateSubscription = () => {
  const { address } = useGetAccount();
  const navigate = useNavigate();
  const { createSubscription, isLoading } = useCreateSubscription();

  const [formData, setFormData] = useState<CreateSubscriptionData>({
    recipient: '',
    amountPerPayment: '',
    initialDeposit: '',
    intervalType: 'Daily',
    totalPayments: undefined
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.recipient) {
      newErrors.recipient = 'Recipient address is required';
    } else if (!formData.recipient.startsWith('erd1')) {
      newErrors.recipient = 'Invalid MultiversX address';
    }

    if (!formData.amountPerPayment) {
      newErrors.amountPerPayment = 'Amount per payment is required';
    } else if (parseFloat(formData.amountPerPayment) <= 0) {
      newErrors.amountPerPayment = 'Amount must be greater than 0';
    }

    if (!formData.initialDeposit) {
      newErrors.initialDeposit = 'Initial deposit is required';
    } else if (parseFloat(formData.initialDeposit) <= 0) {
      newErrors.initialDeposit = 'Deposit must be greater than 0';
    } else if (parseFloat(formData.initialDeposit) < parseFloat(formData.amountPerPayment)) {
      newErrors.initialDeposit = 'Deposit must be at least one payment amount';
    }

    if (formData.totalPayments !== undefined && formData.totalPayments <= 0) {
      newErrors.totalPayments = 'Total payments must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const result = await createSubscription(address, formData);

    if (result.success) {
      setTimeout(() => {
        navigate(RouteNamesEnum.subscriptions);
      }, 2000);
    }
  };

  const handleChange = (field: keyof CreateSubscriptionData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const estimatedPayments = formData.initialDeposit && formData.amountPerPayment
    ? Math.floor(parseFloat(formData.initialDeposit) / parseFloat(formData.amountPerPayment))
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(RouteNamesEnum.subscriptions)}
        className="mb-6 text-slate-400 hover:text-white transition-colors flex items-center"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
        Back to Subscriptions
      </button>

      <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
        <h1 className="text-2xl font-bold mb-6 text-white">Create New Subscription</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Recipient Address *
            </label>
            <input
              type="text"
              value={formData.recipient}
              onChange={(e) => handleChange('recipient', e.target.value)}
              placeholder="erd1qqqqqqqqqqqqqpgq..."
              className={`w-full px-4 py-3 bg-slate-700 border ${
                errors.recipient ? 'border-red-500' : 'border-slate-600'
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500`}
            />
            {errors.recipient && (
              <p className="text-red-500 text-sm mt-1">{errors.recipient}</p>
            )}
            <p className="text-slate-500 text-sm mt-1">
              The wallet address that will receive the payments
            </p>
          </div>

          {/* Amount Per Payment */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount Per Payment (EGLD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amountPerPayment}
              onChange={(e) => handleChange('amountPerPayment', e.target.value)}
              placeholder="1.5"
              className={`w-full px-4 py-3 bg-slate-700 border ${
                errors.amountPerPayment ? 'border-red-500' : 'border-slate-600'
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500`}
            />
            {errors.amountPerPayment && (
              <p className="text-red-500 text-sm mt-1">{errors.amountPerPayment}</p>
            )}
            <p className="text-slate-500 text-sm mt-1">
              The amount to send with each payment
            </p>
          </div>

          {/* Interval Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Payment Interval *
            </label>
            <select
              value={formData.intervalType}
              onChange={(e) => handleChange('intervalType', e.target.value as any)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="Daily">Daily (every 24 hours)</option>
              <option value="Weekly">Weekly (every 7 days)</option>
              <option value="Monthly">Monthly (every 30 days)</option>
            </select>
            <p className="text-slate-500 text-sm mt-1">
              How often payments will be executed
            </p>
          </div>

          {/* Initial Deposit */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Initial Deposit (EGLD) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.initialDeposit}
              onChange={(e) => handleChange('initialDeposit', e.target.value)}
              placeholder="10"
              className={`w-full px-4 py-3 bg-slate-700 border ${
                errors.initialDeposit ? 'border-red-500' : 'border-slate-600'
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500`}
            />
            {errors.initialDeposit && (
              <p className="text-red-500 text-sm mt-1">{errors.initialDeposit}</p>
            )}
            <p className="text-slate-500 text-sm mt-1">
              Funds to deposit upfront (covers ~{estimatedPayments} payments)
            </p>
          </div>

          {/* Total Payments (Optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Total Payments Limit (Optional)
            </label>
            <input
              type="number"
              min="1"
              value={formData.totalPayments || ''}
              onChange={(e) => handleChange('totalPayments', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Leave empty for unlimited"
              className={`w-full px-4 py-3 bg-slate-700 border ${
                errors.totalPayments ? 'border-red-500' : 'border-slate-600'
              } rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500`}
            />
            {errors.totalPayments && (
              <p className="text-red-500 text-sm mt-1">{errors.totalPayments}</p>
            )}
            <p className="text-slate-500 text-sm mt-1">
              Maximum number of payments before auto-cancellation (leave empty for unlimited)
            </p>
          </div>

          {/* Summary Box */}
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <h3 className="font-semibold text-white mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Amount:</span>
                <span className="text-white font-medium">{formData.amountPerPayment || '0'} EGLD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Interval:</span>
                <span className="text-white font-medium">{formData.intervalType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Initial Deposit:</span>
                <span className="text-white font-medium">{formData.initialDeposit || '0'} EGLD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Estimated Payments:</span>
                <span className="text-white font-medium">
                  {estimatedPayments} {formData.totalPayments ? `(limited to ${formData.totalPayments})` : '(unlimited)'}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>Processing...</>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                  Create Subscription
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(RouteNamesEnum.subscriptions)}
              disabled={isLoading}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
