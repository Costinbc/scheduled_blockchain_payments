import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { routes } from './routes';
import { PageNotFound } from './pages/PageNotFound';

export const App = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          {routes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<route.component />}
            >
              {route.children?.map((child) => (
                <Route
                  key={`${route.path}-${child.path}`}
                  path={child.path}
                  element={<child.component />}
                />
              ))}
            </Route>
          ))}
          <Route path='*' element={<PageNotFound />} />
        </Routes>
      </Layout>
    </Router>
  );
};
