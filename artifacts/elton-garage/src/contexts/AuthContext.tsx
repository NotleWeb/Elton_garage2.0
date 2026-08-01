import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { User, getMe } from '@workspace/api-client-react';
import { safeStorage } from '@/lib/safe-storage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(safeStorage.getItem('elton_garage_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    getMe().then(userData => {
      setUser(userData);
    }).catch((error) => {
      console.error('[AuthProvider] getMe error:', error);
      setToken(null);
      setUser(null);
      safeStorage.removeItem('elton_garage_token');
    }).finally(() => {
      setIsLoading(false);
    });
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    // Write to safeStorage immediately so custom-fetch picks it up on the
    // very first render after login (before the useEffect can run).
    safeStorage.setItem('elton_garage_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    safeStorage.removeItem('elton_garage_token');
    setToken(null);
    setUser(null);
    setLocation('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}