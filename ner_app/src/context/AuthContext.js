import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);
const LOGIN_KEY = 'ner-lens-logged-in';

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(LOGIN_KEY).then((value) => {
      setIsLoggedIn(value === 'true');
      setLoading(false);
    });
  }, []);

  const login = async () => {
    await AsyncStorage.setItem(LOGIN_KEY, 'true');
    setIsLoggedIn(true);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(LOGIN_KEY);
    setIsLoggedIn(false);
  };

  return <AuthContext.Provider value={{ isLoggedIn, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
