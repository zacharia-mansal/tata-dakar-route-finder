import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { getLocale, type Locale } from './locale';

const LOCALE_STORAGE_KEY = 'tata.locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: PropsWithChildren) {
  const deviceLocale = getLocales()[0]?.languageTag;
  const [locale, updateLocale] = useState<Locale>(() =>
    getLocale(undefined, deviceLocale),
  );
  const userSelectedLocale = useRef(false);

  useEffect(() => {
    let active = true;

    async function restoreLocale() {
      try {
        const savedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (active && !userSelectedLocale.current) {
          updateLocale(getLocale(savedLocale, deviceLocale));
        }
      } catch {
        // Keep the device-language default when storage is unavailable.
      }
    }

    void restoreLocale();
    return () => {
      active = false;
    };
  }, [deviceLocale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    userSelectedLocale.current = true;
    updateLocale(nextLocale);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, nextLocale).catch(() => {
      // The selection remains active for this session if persistence fails.
    });
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside a LocaleProvider');
  }
  return context;
}
