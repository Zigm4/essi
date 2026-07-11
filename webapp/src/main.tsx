import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system/fonts.css';
import './design-system/tokens.css';
import { installGlobalErrorHandlers } from './core/logging';
import App from './App';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
