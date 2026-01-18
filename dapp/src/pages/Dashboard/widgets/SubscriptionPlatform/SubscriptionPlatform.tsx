import { useCallback, useEffect, useMemo, useState } from 'react';
import scheduledPaymentsAbi from 'contracts/scheduled-payments.abi.json';
import { contractAddress } from 'config';
import { Button } from 'components/Button';
import { Label } from 'components/Label';
import { OutputContainer } from 'components/OutputContainer';
import { signAndSendTransactions } from 'helpers';
import { ItemsIdentifiersEnum } from 'pages/Dashboard/dashboard.types';
import {
  AbiRegistry,
  Address,
  GAS_PRICE,
  ProxyNetworkProvider,
  SmartContractController,
  SmartContractTransactionsFactory,
  TransactionsFactoryConfig,
  useGetAccount,
  useGetNetworkConfig
} from 'lib';
import { BigUIntValue, BytesValue, U64Value } from '@multiversx/sdk-core/out';

// prettier-ignore
const styles = {
  container: 'subscription-platform flex flex-col gap-6 text-sm text-primary',
  headerRow: 'flex flex-wrap items-center gap-3',
  section: 'flex flex-col gap-3',
  sectionTitle: 'text-base font-semibold text-primary',
  sectionDescription: 'text-secondary',
  statusRow: 'flex flex-wrap items-center gap-2 text-secondary',
  card: 'border border-secondary rounded-xl bg-secondary p-4 flex flex-col gap-2',
  cardHeader: 'flex flex-wrap items-center justify-between gap-2',
  cardTitle: 'text-primary font-semibold',
  cardSubtle: 'text-secondary text-xs',
  input: 'bg-primary border border-secondary rounded-lg px-3 py-2 text-sm text-primary min-w-[200px]',
  inputFull: 'bg-primary border border-secondary rounded-lg px-3 py-2 text-sm text-primary w-full',
  inputGroup: 'flex flex-wrap items-end gap-3',
  buttonGroup: 'flex flex-wrap items-center gap-2',
  badge: 'px-2 py-1 text-xs rounded-lg bg-primary border border-secondary',
  error: 'text-danger text-sm',
  empty: 'text-secondary text-sm'
} satisfies Record<string, string>;

const ROLE_NONE = 0;
const ROLE_USER = 1;
const ROLE_PROVIDER = 2;

const STATUS_LABELS: Record<number, string> = {
  1: 'Active',
  2: 'Pending user cancel',
  3: 'Pending provider cancel',
  4: 'Cancelled by user',
  5: 'Cancelled by provider',
  6: 'Cancelled (insufficient funds)'
};

const toWei = (value: string) => {
  const sanitized = value.trim();
  if (!sanitized) {
    return 0n;
  }

  const [whole, fraction = ''] = sanitized.split('.');
  const wholePart = BigInt(whole || '0');
  const fractionPadded = (fraction + '0'.repeat(18)).slice(0, 18);
  const fractionPart = BigInt(fractionPadded || '0');
  return wholePart * 10n ** 18n + fractionPart;
};

const fromWei = (value: string) => {
  const raw = value || '0';
  const pad = raw.padStart(19, '0');
  const whole = pad.slice(0, -18);
  const fraction = pad.slice(-18).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
};

const decodeBytes = (value: unknown) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (Array.isArray(value)) {
    return new TextDecoder().decode(Uint8Array.from(value));
  }
  return String(value);
};

type ServiceView = {
  id: number;
  provider: string;
  name: string;
  description: string;
  token: string;
  amountPerCycle: string;
  frequencyInBlocks: number;
  active: boolean;
};

type SubscriptionView = {
  id: number;
  serviceId: number;
  client: string;
  vendor: string;
  amountPerCycle: string;
  frequencyInBlocks: number;
  remainingBalance: string;
  lastPaymentBlock: number;
  nextPaymentBlock: number;
  status: number;
  cancelEffectiveBlock: number;
};

export const SubscriptionPlatform = () => {
  const { address } = useGetAccount();
  const { network } = useGetNetworkConfig();

  const [role, setRole] = useState<number>(ROLE_NONE);
  const [services, setServices] = useState<ServiceView[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<SubscriptionView[]>([]);
  const [providerSubscriptions, setProviderSubscriptions] = useState<SubscriptionView[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string>('');
  const [lastArgs, setLastArgs] = useState<Record<string, unknown> | null>(null);
  const [accountBalance, setAccountBalance] = useState<string>('0');
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);

  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [newServiceAmount, setNewServiceAmount] = useState('0');
  const [newServiceFrequency, setNewServiceFrequency] = useState('60');
  const [subscribeAmounts, setSubscribeAmounts] = useState<Record<number, string>>({});
  const [topUpAmounts, setTopUpAmounts] = useState<Record<number, string>>({});

  const abi = useMemo(() => AbiRegistry.create(scheduledPaymentsAbi), []);
  const proxy = useMemo(() => new ProxyNetworkProvider(network.apiAddress), [network.apiAddress]);

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
    const controller = getController();
    const [result] = await controller.query({
      contract: Address.newFromBech32(contractAddress),
      function: 'getUserRole',
      arguments: [Address.newFromBech32(address)]
    });
    const value = result?.valueOf?.() ?? 0;
    setRole(Number(value));
  }, [address, getController]);

  const fetchServices = useCallback(async () => {
    const controller = getController();
    const [idsResult] = await controller.query({
      contract: Address.newFromBech32(contractAddress),
      function: 'getAllServiceIds',
      arguments: []
    });

    const ids = (idsResult?.valueOf?.() as number[]) || [];
    const servicesData: ServiceView[] = [];
    for (const id of ids) {
      try {
        const [serviceResult] = await controller.query({
          contract: Address.newFromBech32(contractAddress),
          function: 'getService',
          arguments: [new U64Value(id)]
        });
        const value = serviceResult?.valueOf?.();
        servicesData.push({
          id: Number(value?.id ?? id),
          provider: value?.provider?.toString?.() ?? '',
          name: decodeBytes(value?.name),
          description: decodeBytes(value?.description),
          token: value?.token_identifier?.toString?.() ?? 'EGLD',
          amountPerCycle: value?.amount_per_cycle?.toString?.() ?? '0',
          frequencyInBlocks: Number(value?.frequency_in_blocks ?? 0),
          active: Boolean(value?.active)
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown decode error';
        setWarnings((prev) => [
          ...prev,
          `Failed to decode service ${id}: ${message}`
        ]);
      }
    }

    setServices(servicesData);
  }, [getController]);

  const fetchUserSubscriptions = useCallback(async () => {
    if (!address) {
      return;
    }
    const controller = getController();
    const [idsResult] = await controller.query({
      contract: Address.newFromBech32(contractAddress),
      function: 'getUserSubscriptions',
      arguments: [Address.newFromBech32(address)]
    });

    const ids = (idsResult?.valueOf?.() as number[]) || [];
    const subsData: SubscriptionView[] = [];
    for (const id of ids) {
      try {
        const [subResult] = await controller.query({
          contract: Address.newFromBech32(contractAddress),
          function: 'getSubscription',
          arguments: [new U64Value(id)]
        });
        const value = subResult?.valueOf?.();
        subsData.push({
          id: Number(value?.id ?? id),
          serviceId: Number(value?.service_id ?? 0),
          client: value?.client?.toString?.() ?? '',
          vendor: value?.vendor?.toString?.() ?? '',
          amountPerCycle: value?.amount_per_cycle?.toString?.() ?? '0',
          frequencyInBlocks: Number(value?.frequency_in_blocks ?? 0),
          remainingBalance: value?.remaining_balance?.toString?.() ?? '0',
          lastPaymentBlock: Number(value?.last_payment_block ?? 0),
          nextPaymentBlock: Number(value?.next_payment_block ?? 0),
          status: Number(value?.status ?? 0),
          cancelEffectiveBlock: Number(value?.cancel_effective_block ?? 0)
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown decode error';
        setWarnings((prev) => [
          ...prev,
          `Failed to decode subscription ${id}: ${message}`
        ]);
      }
    }

    setUserSubscriptions(subsData);
  }, [address, getController]);

  const fetchProviderSubscriptions = useCallback(async () => {
    if (!address) {
      return;
    }
    const controller = getController();
    const [idsResult] = await controller.query({
      contract: Address.newFromBech32(contractAddress),
      function: 'getProviderSubscriptions',
      arguments: [Address.newFromBech32(address)]
    });

    const ids = (idsResult?.valueOf?.() as number[]) || [];
    const subsData: SubscriptionView[] = [];
    for (const id of ids) {
      try {
        const [subResult] = await controller.query({
          contract: Address.newFromBech32(contractAddress),
          function: 'getSubscription',
          arguments: [new U64Value(id)]
        });
        const value = subResult?.valueOf?.();
        subsData.push({
          id: Number(value?.id ?? id),
          serviceId: Number(value?.service_id ?? 0),
          client: value?.client?.toString?.() ?? '',
          vendor: value?.vendor?.toString?.() ?? '',
          amountPerCycle: value?.amount_per_cycle?.toString?.() ?? '0',
          frequencyInBlocks: Number(value?.frequency_in_blocks ?? 0),
          remainingBalance: value?.remaining_balance?.toString?.() ?? '0',
          lastPaymentBlock: Number(value?.last_payment_block ?? 0),
          nextPaymentBlock: Number(value?.next_payment_block ?? 0),
          status: Number(value?.status ?? 0),
          cancelEffectiveBlock: Number(value?.cancel_effective_block ?? 0)
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown decode error';
        setWarnings((prev) => [
          ...prev,
          `Failed to decode subscription ${id}: ${message}`
        ]);
      }
    }

    setProviderSubscriptions(subsData);
  }, [address, getController]);

  const refreshAll = useCallback(async () => {
    if (!address) {
      return;
    }
    setIsLoading(true);
    setError('');
    setWarnings([]);
    try {
      await fetchRole();
      await fetchServices();
      await fetchUserSubscriptions();
      await fetchProviderSubscriptions();
      const account = await proxy.getAccount(Address.newFromBech32(address));
      setAccountBalance(account.balance.toString());
      try {
        const status = await (proxy as any).getNetworkStatus();
        const block =
          status?.blockNonce ??
          status?.nonce ??
          status?.currentRound ??
          status?.current_round;
        if (typeof block === 'number') {
          setCurrentBlock(block);
        }
      } catch (err) {
        console.warn('Unable to fetch network status', err);
      }
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to refresh on-chain data: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [address, fetchProviderSubscriptions, fetchRole, fetchServices, fetchUserSubscriptions]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll();
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const formatError = (err: unknown) => {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  };

  const sendTransaction = async (
    functionName: string,
    args: any[] = [],
    nativeValue?: bigint,
    successMessage?: string
  ) => {
    const factory = getFactory();
    const tx = await factory.createTransactionForExecute(
      Address.newFromBech32(address),
      {
        contract: Address.newFromBech32(contractAddress),
        function: functionName,
        gasLimit: 30_000_000n,
        arguments: args,
        nativeTransferAmount: nativeValue
      }
    );

    await signAndSendTransactions({
      transactions: [tx],
      transactionsDisplayInfo: {
        processingMessage: `${functionName} pending`,
        errorMessage: `${functionName} failed`,
        successMessage: successMessage || `${functionName} success`
      }
    });
  };

  const handleRegister = async (desiredRole: number) => {
    if (!address) {
      return;
    }
    const fn = desiredRole === ROLE_USER ? 'registerAsUser' : 'registerAsProvider';
    setLastAction(fn);
    try {
      await sendTransaction(fn, []);
      await refreshAll();
    } catch (err) {
      setError(`Register failed: ${formatError(err)}`);
    }
  };

  const handleCreateService = async () => {
    if (
      !newServiceName ||
      !newServiceDescription ||
      !newServiceAmount ||
      !newServiceFrequency
    ) {
      return;
    }
    const amount = toWei(newServiceAmount);
    const frequency = Number(newServiceFrequency || '0');
    if (amount <= 0n) {
      setError('Create service failed: Fee per cycle must be greater than 0.');
      return;
    }
    if (frequency <= 0) {
      setError('Create service failed: Frequency must be greater than 0.');
      return;
    }
    setLastAction('createService');
    setLastArgs({
      name: newServiceName,
      description: newServiceDescription,
      amount: amount.toString(),
      frequency
    });
    try {
      await sendTransaction('createService', [
        BytesValue.fromUTF8(newServiceName),
        BytesValue.fromUTF8(newServiceDescription),
        new BigUIntValue(amount),
        new U64Value(frequency)
      ]);
      setNewServiceName('');
      setNewServiceDescription('');
      setNewServiceAmount('0');
      await refreshAll();
    } catch (err) {
      setError(`Create service failed: ${formatError(err)}`);
    }
  };

  const handleSubscribe = async (serviceId: number) => {
    const amountInput = subscribeAmounts[serviceId] ?? '0';
    if (!amountInput || amountInput.trim() === '') {
      setError('Subscribe failed: Please enter an amount.');
      return;
    }
    const amount = toWei(amountInput);
    const service = serviceById.get(serviceId);
    if (!service) {
      setError('Subscribe failed: Service not found in loaded data.');
      return;
    }
    if (amount <= 0n) {
      setError('Subscribe failed: Amount must be greater than 0.');
      return;
    }
    const required = BigInt(service.amountPerCycle || '0');
    if (amount < required) {
      setError(
        `Subscribe failed: Amount is below required fee (${fromWei(
          service.amountPerCycle
        )} EGLD).`
      );
      return;
    }
    setLastAction(`subscribe:${serviceId}`);
    setLastArgs({
      serviceId,
      amount: amount.toString(),
      required: required.toString()
    });
    try {
      await sendTransaction('subscribe', [new U64Value(serviceId)], amount);
      await refreshAll();
    } catch (err) {
      setError(`Subscribe failed: ${formatError(err)}`);
    }
  };

  const handleTopUp = async (subId: number) => {
    const amountInput = topUpAmounts[subId] ?? '0';
    const amount = toWei(amountInput);
    setLastAction(`topUp:${subId}`);
    try {
      await sendTransaction('topUp', [new U64Value(subId)], amount);
      await refreshAll();
    } catch (err) {
      setError(`Top up failed: ${formatError(err)}`);
    }
  };

  const handleCancelUser = async (subId: number) => {
    setLastAction(`cancelUser:${subId}`);
    try {
      await sendTransaction('cancelSubscriptionByUser', [new U64Value(subId)]);
      await refreshAll();
    } catch (err) {
      setError(`Cancel failed: ${formatError(err)}`);
    }
  };

  const handleCancelProvider = async (subId: number) => {
    setLastAction(`cancelProvider:${subId}`);
    try {
      await sendTransaction('cancelSubscriptionByProvider', [new U64Value(subId)]);
      await refreshAll();
    } catch (err) {
      setError(`Cancel failed: ${formatError(err)}`);
    }
  };

  const handleFinalizeCancellation = async (subId: number) => {
    setLastAction(`finalize:${subId}`);
    try {
      await sendTransaction('finalizeCancellation', [new U64Value(subId)]);
      await refreshAll();
    } catch (err) {
      setError(`Finalize failed: ${formatError(err)}`);
    }
  };

  const roleLabel = useMemo(() => {
    if (role === ROLE_USER) return 'User';
    if (role === ROLE_PROVIDER) return 'Service Provider';
    return 'Unregistered';
  }, [role]);

  const providerServices = useMemo(() => {
    if (!address) {
      return [];
    }
    return services.filter((service) => service.provider === address);
  }, [address, services]);

  const serviceById = useMemo(() => {
    const map = new Map<number, ServiceView>();
    services.forEach((service) => map.set(service.id, service));
    return map;
  }, [services]);

  return (
    <div className={styles.container}>
      <OutputContainer>
        <div id={ItemsIdentifiersEnum.accountRole} className={styles.headerRow}>
          <div>
            <div className={styles.sectionTitle}>Account role</div>
            <div className={styles.sectionDescription}>
              Current role: {roleLabel}
            </div>
            <div className={styles.sectionDescription}>
              Contract: {contractAddress}
            </div>
            <div className={styles.sectionDescription}>
              Network: {network.apiAddress}
            </div>
          </div>
          <div className={styles.buttonGroup} />
        </div>
        <div className={styles.statusRow}>
          {isLoading && <span>Loading on-chain data...</span>}
          {error && <span className={styles.error}>{error}</span>}
          {lastAction && (
            <span className={styles.cardSubtle}>Last action: {lastAction}</span>
          )}
          {lastArgs && (
            <span className={styles.cardSubtle}>
              Args: {JSON.stringify(lastArgs)}
            </span>
          )}
          {warnings.length > 0 && (
            <span className={styles.cardSubtle}>
              Warnings: {warnings.join(' | ')}
            </span>
          )}
        </div>
      </OutputContainer>

      <OutputContainer>
        <div className={styles.sectionTitle}>Debug info</div>
        <div className={styles.cardSubtle}>
          Address: {address || 'Not connected'}
        </div>
        <div className={styles.cardSubtle}>
          Balance: {fromWei(accountBalance)} EGLD
        </div>
        {currentBlock !== null && (
          <div className={styles.cardSubtle}>Current block: {currentBlock}</div>
        )}
        <div className={styles.cardSubtle}>Role: {roleLabel}</div>
        <div className={styles.cardSubtle}>
          Services loaded: {services.length}
        </div>
        <div className={styles.cardSubtle}>
          Subscriptions loaded: {userSubscriptions.length}
        </div>
        <pre className='text-xs text-secondary overflow-x-auto whitespace-pre-wrap mt-2'>
          {JSON.stringify({ services, userSubscriptions }, null, 2)}
        </pre>
      </OutputContainer>

      {role === ROLE_USER && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Available services</div>
          <OutputContainer>
            <div
              id={ItemsIdentifiersEnum.availableServices}
              className='max-h-96 overflow-y-auto flex flex-col gap-4'
            >
              {services.length === 0 && (
                <div className={styles.empty}>No services registered yet.</div>
              )}
              {services.map((service) => (
                <div key={`service-${service.id}`} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      {service.name || `Service #${service.id}`}
                    </div>
                    <span className={styles.badge}>
                      {service.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {service.description && (
                    <div className={styles.cardSubtle}>
                      {service.description}
                    </div>
                  )}
                  <div>Provider: {service.provider}</div>
                  <div>Fee: {fromWei(service.amountPerCycle)} EGLD</div>
                  <div>Frequency: every {service.frequencyInBlocks} blocks</div>
                  {service.active && (
                    <div className={styles.inputGroup}>
                      <div>
                        <Label>Amount to fund (EGLD)</Label>
                        <input
                          className={styles.input}
                          placeholder='0.5'
                          value={subscribeAmounts[service.id] ?? ''}
                          onChange={(event) =>
                            setSubscribeAmounts((prev) => ({
                              ...prev,
                              [service.id]: event.target.value
                            }))
                          }
                        />
                        <div className={styles.cardSubtle}>
                          Minimum: {fromWei(service.amountPerCycle)} EGLD
                        </div>
                      </div>
                      <Button onClick={() => handleSubscribe(service.id)}>
                        Subscribe
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </OutputContainer>
        </div>
      )}

      {role === ROLE_PROVIDER && (
        <div className={styles.section}>
          <div
            id={ItemsIdentifiersEnum.yourServices}
            className={styles.sectionTitle}
          >
            Your services
          </div>
          {providerServices.length === 0 && (
            <div className={styles.empty}>
              You have not created any services yet.
            </div>
          )}
          {providerServices.map((service) => (
            <OutputContainer key={`provider-service-${service.id}`}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    {service.name || `Service #${service.id}`}
                  </div>
                  <span className={styles.badge}>
                    {service.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {service.description && (
                  <div className={styles.cardSubtle}>{service.description}</div>
                )}
                <div>Fee: {fromWei(service.amountPerCycle)} EGLD</div>
                <div>Frequency: every {service.frequencyInBlocks} blocks</div>
              </div>
            </OutputContainer>
          ))}

          <div
            id={ItemsIdentifiersEnum.providerSubscriptions}
            className={styles.sectionTitle}
          >
            Provider subscriptions
          </div>
          {providerSubscriptions.length === 0 && (
            <div className={styles.empty}>No subscribers yet.</div>
          )}
          {providerSubscriptions.map((sub) => (
            <OutputContainer key={`provider-sub-${sub.id}`}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>Subscription #{sub.id}</div>
                  <span className={styles.badge}>
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </div>
                <div>User: {sub.client}</div>
                <div>Next payment block: {sub.nextPaymentBlock}</div>
                {sub.status === 1 && (
                  <div className={styles.buttonGroup}>
                    <Button onClick={() => handleCancelProvider(sub.id)}>
                      Cancel subscription
                    </Button>
                  </div>
                )}
              </div>
            </OutputContainer>
          ))}

          <div
            id={ItemsIdentifiersEnum.createService}
            className={styles.sectionTitle}
          >
            Create service
          </div>
          <OutputContainer>
            <div className={styles.inputGroup}>
              <div className='flex flex-col gap-2'>
                <Label>Service name</Label>
                <input
                  className={styles.input}
                  placeholder='Analytics Pro'
                  value={newServiceName}
                  onChange={(event) => setNewServiceName(event.target.value)}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label>Fee per cycle (EGLD)</Label>
                <input
                  className={styles.input}
                  placeholder='0.1'
                  value={newServiceAmount}
                  onChange={(event) => setNewServiceAmount(event.target.value)}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <Label>Frequency (blocks)</Label>
                <input
                  className={styles.input}
                  placeholder='60'
                  value={newServiceFrequency}
                  onChange={(event) => setNewServiceFrequency(event.target.value)}
                />
              </div>
            </div>
            <div className='flex flex-col gap-2 mt-4'>
              <Label>Description</Label>
              <input
                className={styles.inputFull}
                placeholder='Short description of your service'
                value={newServiceDescription}
                onChange={(event) => setNewServiceDescription(event.target.value)}
              />
            </div>
            <div className='mt-4'>
              <Button onClick={handleCreateService}>Create service</Button>
            </div>
          </OutputContainer>
        </div>
      )}

      {role === ROLE_USER && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Your subscriptions</div>
          <OutputContainer>
            <div
              id={ItemsIdentifiersEnum.yourSubscriptions}
              className='max-h-96 overflow-y-auto flex flex-col gap-4'
            >
              {userSubscriptions.length === 0 && (
                <div className={styles.empty}>No subscriptions yet.</div>
              )}
              {userSubscriptions.map((sub) => (
                <div key={`sub-${sub.id}`} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>Subscription #{sub.id}</div>
                  <span className={styles.badge}>
                    {STATUS_LABELS[sub.status] ?? sub.status}
                  </span>
                </div>
                <div>Service ID: {sub.serviceId}</div>
                <div>Remaining balance: {fromWei(sub.remainingBalance)} EGLD</div>
                <div>Next payment block: {sub.nextPaymentBlock}</div>
                {(sub.status === 1 || sub.status === 6) && (
                  <div className={styles.inputGroup}>
                    <div>
                      <Label>Top up (EGLD)</Label>
                      <input
                        className={styles.input}
                        placeholder='0.2'
                        value={topUpAmounts[sub.id] ?? ''}
                        onChange={(event) =>
                          setTopUpAmounts((prev) => ({
                            ...prev,
                            [sub.id]: event.target.value
                          }))
                        }
                      />
                    </div>
                    <Button onClick={() => handleTopUp(sub.id)}>Top up</Button>
                    {sub.status === 1 && (
                      <Button onClick={() => handleCancelUser(sub.id)}>
                        Cancel subscription
                      </Button>
                    )}
                  </div>
                )}
                {sub.status === 2 && (
                  <div className={styles.cardSubtle}>
                    Subscription available until block {sub.cancelEffectiveBlock}
                  </div>
                )}
                {sub.status === 2 &&
                  currentBlock !== null &&
                  currentBlock >= sub.cancelEffectiveBlock && (
                    <div className={styles.buttonGroup}>
                      <Button
                        onClick={() => handleFinalizeCancellation(sub.id)}
                      >
                        Finalize cancellation
                      </Button>
                    </div>
                  )}
              </div>
              ))}
            </div>
          </OutputContainer>
        </div>
      )}
    </div>
  );
};
