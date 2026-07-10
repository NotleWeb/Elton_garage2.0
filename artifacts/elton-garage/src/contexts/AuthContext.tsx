import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { User, getMe } from '@workspace/api-client-react';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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
  const [token, setToken] = useState<string | null>(localStorage.getItem('elton_garage_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        localStorage.removeItem('elton_garage_token');
        setToken(null);
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    getMe().then(userData => {
      setUser(userData);
    }).catch(() => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('elton_garage_token');
    }).finally(() => {
      setIsLoading(false);
    });
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    // Write to localStorage immediately so custom-fetch picks it up on the
    // very first render after login (before the useEffect can run).
    localStorage.setItem('elton_garage_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    firebaseSignOut(auth).catch(() => {
      // ignore if Firebase logout fails; still clear local session
    });
    localStorage.removeItem('elton_garage_token');
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