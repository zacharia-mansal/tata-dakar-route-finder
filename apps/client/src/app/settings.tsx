import { Pressable, StyleSheet, Text, View } from 'react-native';
import { messages } from '../i18n/messages';
import type { Locale } from '../i18n/locale';
import { useLocale } from '../i18n/locale-provider';

export default function SettingsScreen() {
  const { locale, setLocale } = useLocale();
  const copy = messages[locale];
  const languages: Array<{ locale: Locale; label: string }> = [
    { locale: 'fr', label: copy.frenchLanguage },
    { locale: 'en', label: copy.englishLanguage },
  ];

  return (
    <View style={styles.page}>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.settingsTitle}
      </Text>
      <Text style={styles.label}>{copy.languageLabel}</Text>
      <View style={styles.options}>
        {languages.map(({ locale: optionLocale, label }) => {
          const selected = locale === optionLocale;

          return (
            <Pressable
              key={optionLocale}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setLocale(optionLocale)}
              style={[styles.option, selected && styles.selectedOption]}
            >
              <Text style={[styles.optionText, selected && styles.selectedText]}>
                {label}
              </Text>
              {selected ? <Text style={styles.checkmark}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 38,
  },
  title: {
    color: '#153d35',
    fontSize: 30,
    fontWeight: '800',
  },
  label: {
    marginTop: 32,
    marginBottom: 12,
    color: '#536a63',
    fontSize: 14,
    fontWeight: '700',
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2ebe7',
    backgroundColor: '#ffffff',
  },
  selectedOption: {
    borderColor: '#168066',
    backgroundColor: '#edf7f2',
  },
  optionText: {
    color: '#36534a',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedText: {
    color: '#096b52',
  },
  checkmark: {
    color: '#096b52',
    fontSize: 18,
    fontWeight: '800',
  },
});
