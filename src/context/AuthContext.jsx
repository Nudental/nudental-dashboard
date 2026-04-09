import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

// Fallback local auth for when Supabase is not configured
const LOCAL_PASS = import.meta.env.VITE_DASHBOARD_PASSWORD || 'nudental2024';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    } else {
      // Check localStorage for local auth
      const savedUser = localStorage.getItem('nu_auth_user');
      if (savedUser) setUser(JSON.parse(savedUser));
      setLoading(false);
    }
  }, []);

  const signIn = async (email, password) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } else {
      // Local password auth fallback
      if (password === LOCAL_PASS) {
        const u = { email, id: 'local', role: 'admin' };
        localStorage.setItem('nu_auth_user', JSON.stringify(u));
        setUser(u);
        return u;
      }
      throw new Error('Invalid password');
    }
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('nu_auth_user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
