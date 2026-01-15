import { useNavigate } from 'react-router-dom';
import { useGetIsLoggedIn } from '@multiversx/sdk-dapp/out/react/account/useGetIsLoggedIn';
import { RouteNamesEnum } from 'localConstants/routes';
import { useEffect } from 'react';

export const Home = () => {
  const isLoggedIn = useGetIsLoggedIn();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate(RouteNamesEnum.subscriptions);
    }
  }, [isLoggedIn, navigate]);

  return (
    <div className="max-w-4xl mx-auto text-center py-16">
      <h1 className="text-5xl font-bold mb-6 text-white">
        Blockchain Scheduled Payments
      </h1>
      <p className="text-xl text-slate-300 mb-12">
        Automate your recurring payments on the MultiversX blockchain
      </p>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="text-4xl mb-4">📅</div>
          <h3 className="text-lg font-semibold mb-2 text-white">Recurring Payments</h3>
          <p className="text-slate-400">
            Set up daily, weekly, or monthly automated payments
          </p>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-semibold mb-2 text-white">Secure & Trustless</h3>
          <p className="text-slate-400">
            Smart contracts ensure your payments are executed automatically
          </p>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="text-lg font-semibold mb-2 text-white">Full Control</h3>
          <p className="text-slate-400">
            Cancel or modify subscriptions anytime, funds are yours
          </p>
        </div>
      </div>

      <button
        onClick={() => navigate(RouteNamesEnum.unlock)}
        className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition-colors"
      >
        Connect Wallet to Get Started
      </button>
    </div>
  );
};
