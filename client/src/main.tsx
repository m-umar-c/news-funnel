import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/schibsted-grotesk/wght-italic.css';
import '@fontsource/spline-sans-mono/400.css';
import '@fontsource/spline-sans-mono/500.css';
import App from './App';
import { AuthProvider } from './lib/auth';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
