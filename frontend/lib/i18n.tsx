import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Locale = 'pt' | 'en' | 'es';

const dict = {
  pt: {
    wallet: 'Carteira',
    copilot: 'Copiloto',
    burn: 'Burn',
    walletTitle: 'Carteira Fortaleza',
    copilotTitle: 'Copiloto de Voz',
    burnTitle: 'Burn Tracker',
    landing: 'Landing',
    listen: 'Ouvir',
    stop: 'Parar',
    demoVad: 'Demo VAD',
    refresh: 'Atualizar saldos',
  },
  en: {
    wallet: 'Wallet',
    copilot: 'Copilot',
    burn: 'Burn',
    walletTitle: 'Fortaleza Wallet',
    copilotTitle: 'Voice Copilot',
    burnTitle: 'Burn Tracker',
    landing: 'Landing',
    listen: 'Listen',
    stop: 'Stop',
    demoVad: 'Demo VAD',
    refresh: 'Refresh balances',
  },
  es: {
    wallet: 'Cartera',
    copilot: 'Copiloto',
    burn: 'Burn',
    walletTitle: 'Cartera Fortaleza',
    copilotTitle: 'Copiloto de Voz',
    burnTitle: 'Burn Tracker',
    landing: 'Landing',
    listen: 'Escuchar',
    stop: 'Parar',
    demoVad: 'Demo VAD',
    refresh: 'Actualizar saldos',
  },
} as const;

type Dict = (typeof dict)[Locale];

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dict;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('pt');
  const value = useMemo(
    () => ({ locale, setLocale, t: dict[locale] }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
