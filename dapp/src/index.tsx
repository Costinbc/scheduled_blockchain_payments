import React from 'react';
import ReactDOM from 'react-dom/client';
import { initApp } from './lib';
import { App } from './App';
import { initConfig } from './initConfig';
import './styles/globals.css';

// Initialize the SDK before rendering
initApp(initConfig).then(() => {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
