import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem('zai_user');
        const storedToken = localStorage.getItem('zai_token');
        
        if (storedUser && storedToken) {
          // Verify profile check
          const profile = await authService.getProfile();
          setUser(profile);
        }
      } catch (err) {
        // Clear broken session
        localStorage.removeItem('zai_user');
        localStorage.removeItem('zai_token');
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await authService.login({ email, password });
      localStorage.setItem('zai_user', JSON.stringify(response.user));
      localStorage.setItem('zai_token', response.token);
      setUser(response.user);
      return response.user;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const response = await authService.register({ name, email, password });
      localStorage.setItem('zai_user', JSON.stringify(response.user));
      localStorage.setItem('zai_token', response.token);
      setUser(response.user);
      return response.user;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      // Still log out on UI side
    } finally {
      localStorage.removeItem('zai_user');
      localStorage.removeItem('zai_token');
      setUser(null);
      setLoading(false);
    }
  };

  const updateProfile = async (name) => {
    setLoading(true);
    try {
      const updatedUser = await authService.updateProfile({ name });
      localStorage.setItem('zai_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
    updateProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
