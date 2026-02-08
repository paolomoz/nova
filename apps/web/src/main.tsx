import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles/globals.css';

if (import.meta.env.VITE_MOCK === 'true') {
  import('./lib/mock').then(({ enableMockMode }) => {
    enableMockMode();
    mount();
  });
} else {
  mount();
}

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
