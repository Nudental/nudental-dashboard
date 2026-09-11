import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export const THEMES = {
  'Clean Clinical': {
    '--color-primary': '#0D7377',
    '--color-accent': '#F4A261',
    '--color-background': '#F8F9FA',
    '--color-card': '#FFFFFF',
    '--color-nav': '#0D7377',
    '--color-nav-text': '#FFFFFF',
  },
  'Executive Dark': {
    '--color-primary': '#14B8A6',
    '--color-accent': '#F59E0B',
    '--color-background': '#0F172A',
    '--color-card': '#1E293B',
    '--color-nav': '#0F172A',
    '--color-nav-text': '#E2E8F0',
  },
  'Nu Dental Brand': {
    '--color-primary': '#0891B2',
    '--color-accent': '#22C55E',
    '--color-background': '#F1F5F9',
    '--color-card': '#FFFFFF',
    '--color-nav': '#0891B2',
    '--color-nav-text': '#FFFFFF',
  },
  'Warm Professional': {
    '--color-primary': '#4338CA',
    '--color-accent': '#F97316',
    '--color-background': '#FAFAF8',
    '--color-card': '#FFFFFF',
    '--color-nav': '#4338CA',
    '--color-nav-text': '#FFFFFF',
  },
};

export const THEME_NAMES = Object.keys(THEMES);
export const DEFAULT_THEME = 'Nu Dental Brand';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const applyThemeVars = (themeName) => {
  const vars = THEMES?.[themeName] || THEMES?.[DEFAULT_THEME];
  const root = document.documentElement;
  Object.entries(vars)?.forEach(([key, value]) => {
    root.style?.setProperty(key, value);
  });
  // Toggle .dark class so Tailwind dark-mode tokens activate
  if (themeName === 'Executive Dark') {
    root.classList?.add('dark');
    root.style?.setProperty('--color-foreground', '#E2E8F0');
    root.style?.setProperty('--color-card-foreground', '#CBD5E1');
    root.style?.setProperty('--color-muted', '#334155');
    root.style?.setProperty('--color-muted-foreground', '#94A3B8');
    root.style?.setProperty('--color-border', '#334155');
    root.style?.setProperty('--color-popover', '#1E293B');
    root.style?.setProperty('--color-popover-foreground', '#CBD5E1');
    // Additional high-contrast tokens for Executive Dark
    root.style?.setProperty('--color-surface-raised', '#253347');
    root.style?.setProperty('--color-table-header', '#1A2744');
    root.style?.setProperty('--color-table-row-hover', '#2D3F55');
    root.style?.setProperty('--color-table-border', '#3D5068');
    root.style?.setProperty('--color-text-primary', '#F1F5F9');
    root.style?.setProperty('--color-text-secondary', '#CBD5E1');
    root.style?.setProperty('--color-text-muted', '#94A3B8');
    root.style?.setProperty('--color-input-bg', '#1E293B');
    root.style?.setProperty('--color-input-border', '#475569');
  } else {
    root.classList?.remove('dark');
    root.style?.setProperty('--color-foreground', '#1F2937');
    root.style?.setProperty('--color-card-foreground', '#374151');
    root.style?.setProperty('--color-muted', '#F1F5F9');
    root.style?.setProperty('--color-muted-foreground', '#6B7280');
    root.style?.setProperty('--color-border', '#E2E8F0');
    root.style?.setProperty('--color-popover', '#FFFFFF');
    root.style?.setProperty('--color-popover-foreground', '#374151');
    // Reset additional tokens
    root.style?.setProperty('--color-surface-raised', '#FFFFFF');
    root.style?.setProperty('--color-table-header', '#F8FAFC');
    root.style?.setProperty('--color-table-row-hover', '#F8FAFC');
    root.style?.setProperty('--color-table-border', '#E2E8F0');
    root.style?.setProperty('--color-text-primary', '#1F2937');
    root.style?.setProperty('--color-text-secondary', '#374151');
    root.style?.setProperty('--color-text-muted', '#6B7280');
    root.style?.setProperty('--color-input-bg', '#FFFFFF');
    root.style?.setProperty('--color-input-border', '#E2E8F0');
  }
};

export const ThemeProvider = ({ children }) => {
  const { user, userProfile } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [themeLoaded, setThemeLoaded] = useState(false);

  // Apply theme from userProfile on load
  useEffect(() => {
    if (userProfile) {
      const savedTheme = userProfile?.theme || DEFAULT_THEME;
      const validTheme = THEMES?.[savedTheme] ? savedTheme : DEFAULT_THEME;
      setCurrentTheme(validTheme);
      applyThemeVars(validTheme);
      setThemeLoaded(true);
    } else if (!user) {
      // Not logged in — apply default
      applyThemeVars(DEFAULT_THEME);
      setThemeLoaded(true);
    }
  }, [userProfile, user]);

  const selectTheme = async (themeName) => {
    if (!THEMES?.[themeName]) return;
    setCurrentTheme(themeName);
    applyThemeVars(themeName);

    if (user?.id) {
      try {
        await supabase
          ?.from('user_profiles')
          ?.update({ theme: themeName })
          ?.eq('id', user?.id);
      } catch (err) {
        console.error('Failed to save theme:', err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, selectTheme, themes: THEMES, themeNames: THEME_NAMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
