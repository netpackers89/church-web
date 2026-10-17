import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Providers from './app/providers.jsx';
import App from './app/App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);

