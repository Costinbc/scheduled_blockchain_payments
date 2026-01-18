import {
  faChevronUp,
  faLayerGroup,
  faListCheck,
  faListUl,
  faUserShield,
  faWrench
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ItemsIdentifiersEnum } from 'pages/Dashboard/dashboard.types';
import scheduledPaymentsAbi from 'contracts/scheduled-payments.abi.json';
import { contractAddress } from 'config';
import {
  AbiRegistry,
  Address,
  ProxyNetworkProvider,
  SmartContractController,
  useGetAccount,
  useGetNetworkConfig
} from 'lib';
import { ItemIcon } from './components';
import styles from './sideMenu.styles';
import { MenuItemsType, SideMenuPropsType } from './sideMenu.types';

const ROLE_USER = 1;
const ROLE_PROVIDER = 2;

export const SideMenu = ({ setIsOpen }: SideMenuPropsType) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState(
    ItemsIdentifiersEnum.accountRole
  );
  const [role, setRole] = useState<number>(0);
  const { address } = useGetAccount();
  const { network } = useGetNetworkConfig();
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

  useEffect(() => {
    if (!address) {
      return;
    }
    const loadRole = async () => {
      const controller = getController();
      const [result] = await controller.query({
        contract: Address.newFromBech32(contractAddress),
        function: 'getUserRole',
        arguments: [Address.newFromBech32(address)]
      });
      const value = result?.valueOf?.() ?? 0;
      setRole(Number(value));
    };
    loadRole().catch(() => setRole(0));
  }, [address, getController]);

  const menuItems: MenuItemsType[] = useMemo(() => {
    if (role === ROLE_PROVIDER) {
      return [
        {
          title: 'Account role',
          icon: faUserShield,
          id: ItemsIdentifiersEnum.accountRole
        },
        {
          title: 'Your services',
          icon: faLayerGroup,
          id: ItemsIdentifiersEnum.yourServices
        },
        {
          title: 'Provider subscriptions',
          icon: faListUl,
          id: ItemsIdentifiersEnum.providerSubscriptions
        },
        {
          title: 'Create service',
          icon: faWrench,
          id: ItemsIdentifiersEnum.createService
        }
      ];
    }

    return [
      {
        title: 'Account role',
        icon: faUserShield,
        id: ItemsIdentifiersEnum.accountRole
      },
      {
        title: 'Available services',
        icon: faLayerGroup,
        id: ItemsIdentifiersEnum.availableServices
      },
      {
        title: 'Your subscriptions',
        icon: faListCheck,
        id: ItemsIdentifiersEnum.yourSubscriptions
      }
    ];
  }, [role]);

  const toggleCollapse = () => {
    setIsCollapsed((isCollapsed) => !isCollapsed);
  };

  const handleMenuItemClick = (id: ItemsIdentifiersEnum) => {
    setIsOpen(false);
    const target = document.getElementById(id);
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 250;
      window.scrollTo({ top: y, behavior: 'smooth' });

      setActiveItem(id);
    }
  };

  return (
    <div className={styles.sideMenuContainer}>
      <div className={styles.sideMenuHeader}>
        <h2 className={styles.sideMenuHeaderTitle}>Library</h2>

        <FontAwesomeIcon
          icon={faChevronUp}
          className={classNames(styles.sideMenuHeaderIcon, {
            [styles.sideMenuHeaderIconRotated]: isCollapsed
          })}
          onClick={toggleCollapse}
        />
      </div>

      <div
        className={classNames(styles.sideMenuItems, {
          [styles.sideMenuItemsHidden]: isCollapsed
        })}
      >
        {menuItems.map((item) => (
          <div
            key={item.id}
            onClick={() => handleMenuItemClick(item.id)}
            className={classNames(styles.sideMenuItem, {
              [styles.sideMenuItemActive]: item.id === activeItem
            })}
          >
            {item.icon && <ItemIcon icon={item.icon} />}

            <div className={styles.sideMenuItemTitle}>{item.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
