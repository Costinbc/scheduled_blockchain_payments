import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnlockPanelManager } from '@multiversx/sdk-dapp/out/managers/UnlockPanelManager';
import { RouteNamesEnum } from 'localConstants/routes';

export const Unlock = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const unlockPanelManager = UnlockPanelManager.init({
      loginHandler: () => {
        navigate(RouteNamesEnum.subscriptions);
      },
      onClose: () => {
        navigate(RouteNamesEnum.home);
      }
    });

    unlockPanelManager.openUnlockPanel();

    return () => {
      // Cleanup if needed
    };
  }, [navigate]);

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
        <h2 className="text-2xl font-bold mb-6 text-center text-white">
          Connect Your Wallet
        </h2>
        <p className="text-slate-400 text-center">
          The wallet connection panel will appear shortly...
        </p>
      </div>
    </div>
  );
};
