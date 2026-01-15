import { Link } from 'react-router-dom';
import { RouteNamesEnum } from 'localConstants/routes';

export const PageNotFound = () => {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <h1 className="text-6xl font-bold mb-4 text-white">404</h1>
      <p className="text-xl text-slate-400 mb-8">Page not found</p>
      <Link
        to={RouteNamesEnum.home}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-block"
      >
        Go Home
      </Link>
    </div>
  );
};
