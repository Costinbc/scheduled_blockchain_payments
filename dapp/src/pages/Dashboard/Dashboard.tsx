import { Link } from 'react-router-dom';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { RouteNamesEnum } from 'localConstants/routes';
import { useGetUserSubscriptions } from 'hooks/useSubscriptions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faList, faWallet } from '@fortawesome/free-solid-svg-icons';

export const Dashboard = () => {
  const { address } = useGetAccount();
  const { subscriptions, isLoading } = useGetUserSubscriptions(address);

  const activeSubscriptions = subscriptions?.filter(sub => sub.isActive) || [];
  const totalSubscriptions = subscriptions?.length || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Dashboard</h1>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Total Subscriptions</p>
              <p className="text-3xl font-bold text-white">{totalSubscriptions}</p>
            </div>
            <FontAwesomeIcon icon={faList} className="text-4xl text-blue-500" />
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Active</p>
              <p className="text-3xl font-bold text-green-500">{activeSubscriptions.length}</p>
            </div>
            <FontAwesomeIcon icon={faWallet} className="text-4xl text-green-500" />
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Inactive</p>
              <p className="text-3xl font-bold text-slate-500">{totalSubscriptions - activeSubscriptions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 p-8 rounded-lg border border-slate-700">
        <h2 className="text-xl font-semibold mb-6 text-white">Quick Actions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            to={RouteNamesEnum.createSubscription}
            className="flex items-center p-6 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
          >
            <FontAwesomeIcon icon={faPlus} className="text-2xl text-blue-500 mr-4" />
            <div>
              <h3 className="font-semibold text-white">Create Subscription</h3>
              <p className="text-sm text-slate-400">Set up a new recurring payment</p>
            </div>
          </Link>

          <Link
            to={RouteNamesEnum.subscriptions}
            className="flex items-center p-6 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600"
          >
            <FontAwesomeIcon icon={faList} className="text-2xl text-green-500 mr-4" />
            <div>
              <h3 className="font-semibold text-white">View All Subscriptions</h3>
              <p className="text-sm text-slate-400">Manage your existing subscriptions</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
