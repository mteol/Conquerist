import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Element #root fehlt in index.html');
}

// StrictMode bleibt an: er laesst Effects in der Entwicklung doppelt laufen und
// deckt damit genau die Aufraeumfehler auf, die im Transport teuer waeren
// (haengende Sockets, weiterlaufende Timer).
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
