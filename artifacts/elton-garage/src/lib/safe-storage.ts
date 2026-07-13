/**
 * Hook que fornece storage seguro para Safari iOS em modo privado
 * e outros navegadores restritivos
 */

let memoryStorage: Record<string, string> = {};

function testLocalStorageAccess(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

class SafeStorage implements Storage {
  private useMemory: boolean;

  constructor() {
    this.useMemory = !testLocalStorageAccess();
  }

  getItem(key: string): string | null {
    if (this.useMemory) {
      return memoryStorage[key] ?? null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  }

  setItem(key: string, value: string): void {
    if (this.useMemory) {
      memoryStorage[key] = value;
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      memoryStorage[key] = value;
    }
  }

  removeItem(key: string): void {
    if (this.useMemory) {
      delete memoryStorage[key];
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      delete memoryStorage[key];
    }
  }

  clear(): void {
    if (this.useMemory) {
      memoryStorage = {};
      return;
    }
    try {
      localStorage.clear();
    } catch {
      memoryStorage = {};
    }
  }

  key(index: number): string | null {
    const keys = this.useMemory ? Object.keys(memoryStorage) : Object.keys(localStorage);
    return keys[index] ?? null;
  }

  get length(): number {
    return this.useMemory ? Object.keys(memoryStorage).length : localStorage.length;
  }
}

export const safeStorage = new SafeStorage();
