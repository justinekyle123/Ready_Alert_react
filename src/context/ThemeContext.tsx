// src/context/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('readyalert_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('readyalert_theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light', 'theme-light');
      root.classList.remove('dark', 'theme-dark');
    } else {
      root.classList.add('dark', 'theme-dark');
      root.classList.remove('light', 'theme-light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <div className={theme === 'light' ? 'theme-light min-h-screen bg-slate-100 text-slate-900 transition-colors duration-200' : 'theme-dark min-h-screen bg-slate-950 text-slate-100 transition-colors duration-200'}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
