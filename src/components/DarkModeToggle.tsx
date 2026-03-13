import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center justify-center h-10 w-10 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
      aria-label="Basculer le mode sombre"
      title={isDarkMode ? 'Mode clair' : 'Mode sombre'}
    >
      {isDarkMode ? (
        <Sun className="h-5 w-5 text-accent animate-spin" style={{ animationDuration: '3s' }} />
      ) : (
        <Moon className="h-5 w-5 text-accent animate-pulse" />
      )}
    </button>
  );
}
