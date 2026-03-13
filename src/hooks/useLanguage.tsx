import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';

type Language = "fr" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

// This component is no longer needed as i18next handles the provider
// But we keep it for backward compatibility
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export const useLanguage = (): LanguageContextType => {
  const { t: i18nT, i18n } = useTranslation();

  const language = (i18n.language || 'fr') as Language;

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    return i18nT(key, variables);
  };

  return { language, setLanguage, t };
};
