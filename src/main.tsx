import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initAudioUnlock } from './utils/notification';
import './index.css';

// Prime the shared AudioContext on the first user gesture so incoming alert
// sirens are not blocked by the browser autoplay policy on the receiver side.
initAudioUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
