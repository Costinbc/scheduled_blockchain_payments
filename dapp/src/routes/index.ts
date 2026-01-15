import { RouteNamesEnum } from 'localConstants/routes';
import { Home } from 'pages/Home';
import { Unlock } from 'pages/Unlock';
import { Dashboard } from 'pages/Dashboard';
import { Subscriptions } from 'pages/Subscriptions';
import { CreateSubscription } from 'pages/CreateSubscription';

interface RouteType {
  path: string;
  component: React.ComponentType;
  authenticatedRoute?: boolean;
  children?: RouteType[];
}

export const routes: RouteType[] = [
  {
    path: RouteNamesEnum.home,
    component: Home,
    children: [
      {
        path: RouteNamesEnum.unlock,
        component: Unlock
      }
    ]
  },
  {
    path: RouteNamesEnum.dashboard,
    component: Dashboard,
    authenticatedRoute: true
  },
  {
    path: RouteNamesEnum.subscriptions,
    component: Subscriptions,
    authenticatedRoute: true
  },
  {
    path: RouteNamesEnum.createSubscription,
    component: CreateSubscription,
    authenticatedRoute: true
  }
];
