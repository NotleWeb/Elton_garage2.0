import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Fallback para localStorage em modo privado do Safari e navegadores restritivos
const createSafeStorage = () => {
  try {
    const test = '__localstorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return localStorage;
  } catch {
    // Modo privado: usar memory storage
    const memoryStorage: Record<string, string> = {};
    return {
      getItem: (key: string) => memoryStorage[key] || null,
      setItem: (key: string, value: string) => { memoryStorage[key] = value; },
      removeItem: (key: string) => { delete memoryStorage[key]; },
      clear: () => { for (const key in memoryStorage) delete memoryStorage[key]; },
      key: (index: number) => Object.keys(memoryStorage)[index] || null,
      length: Object.keys(memoryStorage).length,
    } as Storage;
  }
};

// Substituir localStorage global se necessário
if (!window.localStorage) {
  (window as any).localStorage = createSafeStorage();
}

createRoot(document.getElementById('root')!).render(<App />);
