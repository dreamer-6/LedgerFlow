import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('ledgerflow-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ledgerflow-theme', theme);
  }, [theme]);

  const toggle = (target: 'light' | 'dark') => {
    setTheme(target);
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('ledgerflow-theme', target);
  };

  return (
    <div className={`lf-auth-theme-toggle ${className}`} role="group" aria-label="Color theme switcher">
      <button
        type="button"
        className={`lf-auth-theme-btn ${theme === 'light' ? 'active' : ''}`}
        onClick={() => toggle('light')}
        aria-label="Switch to Light mode"
        title="Light mode"
      >
        <Sun size={15} />
      </button>
      <button
        type="button"
        className={`lf-auth-theme-btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => toggle('dark')}
        aria-label="Switch to Dark mode"
        title="Dark mode"
      >
        <Moon size={15} />
      </button>
    </div>
  );
};
