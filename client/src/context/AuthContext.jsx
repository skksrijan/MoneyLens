import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data.error || 'Login failed');
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    if (res.data.success) {
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data.error || 'Registration failed');
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const updateCurrency = async (currency) => {
    const res = await api.post('/user/currency', { currency });
    if (res.data.success) {
      setUser(prev => ({ ...prev, currency: res.data.currency }));
    }
  };

  const updateProfile = async (name, email) => {
    const res = await api.post('/user/profile', { name, email });
    if (res.data.success) {
      setUser(res.data.user);
      return res.data.user;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateCurrency, updateProfile, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
