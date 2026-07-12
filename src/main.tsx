import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* R21 (hallazgo C4a): la regla CSS de prefers-reduced-motion anula
        animaciones CSS, pero Framer Motion anima por JS y la ignora —
        el RNF-5 afirmaba "las animaciones se anulan" y era falso para
        las transiciones de pestaña. reducedMotion="user" lo cumple. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>,
);
