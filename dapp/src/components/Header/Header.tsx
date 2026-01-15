import { Link, useNavigate } from 'react-router-dom';
import { useGetIsLoggedIn } from '@multiversx/sdk-dapp/out/react/account/useGetIsLoggedIn';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { LogoutManager } from '@multiversx/sdk-dapp/out/managers/LogoutManager/LogoutManager';
import { RouteNamesEnum } from 'localConstants/routes';

export const Header = () => {
  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccount();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const logoutManager = LogoutManager.getInstance();
    await logoutManager.logout();
    navigate('/');
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to={RouteNamesEnum.home} className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">$</span>
            </div>
            <span className="text-xl font-bold text-white">
              Scheduled Payments
            </span>
          </Link>

          <nav className="flex items-center space-x-6">
            {isLoggedIn ? (
              <>
                <Link
                  to={RouteNamesEnum.dashboard}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to={RouteNamesEnum.subscriptions}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  My Subscriptions
                </Link>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-slate-400">
                    {shortenAddress(address)}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <Link
                to={RouteNamesEnum.unlock}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Connect Wallet
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
