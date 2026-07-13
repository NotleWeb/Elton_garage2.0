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

// Debug: log para verificar o que está acontecendo
console.log('[MAIN] Document ready');
console.log('[MAIN] Root element:', document.getElementById('root'));
console.log('[MAIN] User Agent:', navigator.userAgent);

// Fallback visual se React não montar
const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.innerHTML = '<div style="padding: 20px; font-family: system-ui; color: #666;">Iniciando aplicação...</div>';
}

try {
  const root = createRoot(rootElement!);
  console.log('[MAIN] React root criado');
  root.render(<App />);
  console.log('[MAIN] App renderizado');
} catch (error) {
  console.error('[MAIN] Erro ao renderizar:', error);
  if (rootElement) {
    rootElement.innerHTML = `<div style="padding: 20px; font-family: system-ui; color: red; white-space: pre-wrap;">
Erro ao iniciar: ${error instanceof Error ? error.message : String(error)}
${error instanceof Error ? error.stack : ''}
    </div>`;
  }
}
