import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import scheduledPaymentsAbi from 'contracts/scheduled-payments.abi.json';
import { contractAddress } from 'config';
import { Button } from 'components/Button';
import { OutputContainer } from 'components/OutputContainer';
import { signAndSendTransactions } from 'helpers';
import {
  AbiRegistry,
  Address,
  ProxyNetworkProvider,
  SmartContractController,
  SmartContractTransactionsFactory,
  TransactionsFactoryConfig,
  useGetAccount,
  useGetIsLoggedIn,
  useGetNetworkConfig
} from 'lib';
import { RouteNamesEnum } from 'localConstants';

// prettier-ignore
const styles = {
  container: 'choose-type-container flex flex-col items-center gap-6 max-w-3xl w-full mx-auto',
  title: 'text-2xl font-semibold text-primary',
  subtitle: 'text-secondary text-sm text-center',
  cardRow: 'grid grid-cols-1 md:grid-cols-2 gap-4 w-full',
  card: 'border border-secondary rounded-xl bg-secondary p-6 flex flex-col gap-3',
  cardTitle: 'text-lg font-semibold text-primary',
  cardDescription: 'text-secondary text-sm',
  buttonRow: 'flex gap-3'
} satisfies Record<string, string>;

const ROLE_NONE = 0;
const ROLE_USER = 1;
const ROLE_PROVIDER = 2;

export const ChooseType = () => {
  const navigate = useNavigate();
  const isLoggedIn = useGetIsLoggedIn();
  const { address } = useGetAccount();
  const { network } = useGetNetworkConfig();
  const [role, setRole] = useState<number>(ROLE_NONE);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const abi = useMemo(() => AbiRegistry.create(scheduledPaymentsAbi), []);
  const proxy = useMemo(
    () => new ProxyNetworkProvider(network.apiAddress),
    [network.apiAddress]
  );

  const getController = useCallback(() => {
    return new SmartContractController({
      chainID: network.chainId,
      networkProvider: proxy,
      abi
    });
  }, [abi, network.chainId, proxy]);

  const getFactory = useCallback(() => {
    return new SmartContractTransactionsFactory({
      config: new TransactionsFactoryConfig({ chainID: network.chainId }),
      abi
    });
  }, [abi, network.chainId]);

  const fetchRole = useCallback(async () => {
    if (!address) {
      return;
    }
    const controller = getController();
    const [result] = await controller.query({
      contract: Address.newFromBech32(contractAddress),
      function: 'getUserRole',
      arguments: [Address.newFromBech32(address)]
    });
    const value = result?.valueOf?.() ?? 0;
    setRole(Number(value));
  }, [address, getController]);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(RouteNamesEnum.home);
      return;
    }
    fetchRole().catch((err) => {
      console.error(err);
      setError('Failed to load role from chain.');
    });
  }, [fetchRole, isLoggedIn, navigate]);

  useEffect(() => {
    if (role !== ROLE_NONE) {
      navigate(RouteNamesEnum.dashboard);
    }
  }, [role, navigate]);

  const handleRegister = async (targetRole: number) => {
    if (!address) {
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const factory = getFactory();
      const functionName =
        targetRole === ROLE_USER ? 'registerAsUser' : 'registerAsProvider';
      const tx = await factory.createTransactionForExecute(
        Address.newFromBech32(address),
        {
          contract: Address.newFromBech32(contractAddress),
          function: functionName,
          gasLimit: 20_000_000n
        }
      );
      await signAndSendTransactions({
        transactions: [tx],
        transactionsDisplayInfo: {
          processingMessage: 'Registering role',
          errorMessage: 'Registration failed',
          successMessage: 'Registration complete'
        }
      });
      await fetchRole();
      navigate(RouteNamesEnum.dashboard);
    } catch (err) {
      console.error(err);
      setError('Unable to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>Choose your account type</div>
      <div className={styles.subtitle}>
        Pick how you want to use the platform. You can register only once.
      </div>
      {error && <div className='text-danger text-sm'>{error}</div>}
      <OutputContainer className='w-full'>
        <div className={styles.cardRow}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>User</div>
            <div className={styles.cardDescription}>
              Subscribe to services, top up balances, and manage your payments.
            </div>
            <div className={styles.buttonRow}>
              <Button
                disabled={isLoading}
                onClick={() => handleRegister(ROLE_USER)}
              >
                Continue as User
              </Button>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Service Provider</div>
            <div className={styles.cardDescription}>
              Create services, collect subscription fees, and manage subscribers.
            </div>
            <div className={styles.buttonRow}>
              <Button
                disabled={isLoading}
                onClick={() => handleRegister(ROLE_PROVIDER)}
              >
                Continue as Provider
              </Button>
            </div>
          </div>
        </div>
      </OutputContainer>
    </div>
  );
};
