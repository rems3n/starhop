import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/saira-condensed/300.css';
import '@fontsource/saira-condensed/500.css';
import '@fontsource/saira-condensed/700.css';
import './styles/tokens.css';
import './styles/ui.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
