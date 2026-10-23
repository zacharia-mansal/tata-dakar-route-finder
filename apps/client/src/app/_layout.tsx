import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LocaleProvider } from '../i18n/locale-provider';

export default function RootLayout() {
  return (
    <LocaleProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f4f7f8' },
        }}
      />
    </LocaleProvider>
  );
}
