import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { getOrCreateClientId } from './lib/clientId';
import './index.css';

getOrCreateClientId();

createRoot(document.getElementById('root')!).render(<App />);
