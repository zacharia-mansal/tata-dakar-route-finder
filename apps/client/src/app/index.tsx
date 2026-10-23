import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { messages } from '../i18n/messages';
import { useLocale } from '../i18n/locale-provider';

export default function HomeScreen() {
  const { locale } = useLocale();
  const copy = messages[locale];

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>T</Text>
        </View>
        <Text style={styles.brandName}>{copy.appName}</Text>
      </View>

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>DAKAR · BUS TATA</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.homeTitle}
        </Text>
        <Text style={styles.description}>{copy.homeDescription}</Text>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchIcon}>
          <Text style={styles.searchIconText}>↗</Text>
        </View>
        <View style={styles.searchCopy}>
          <Text style={styles.searchTitle}>{copy.searchButton}</Text>
          <Text style={styles.searchDescription}>{copy.networkRequiredMessage}</Text>
        </View>
      </View>

      <Link href="/settings" asChild>
        <Pressable accessibilityRole="link" style={styles.settingsLink}>
          <Text style={styles.settingsLinkText}>{copy.settingsNavigation}</Text>
          <Text style={styles.settingsArrow}>›</Text>
        </Pressable>
      </Link>
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
    paddingTop: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#096b52',
  },
  brandMarkText: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '800',
  },
  brandName: {
    color: '#173d35',
    fontSize: 16,
    fontWeight: '700',
  },
  intro: {
    marginTop: 54,
    gap: 14,
  },
  eyebrow: {
    color: '#087159',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    maxWidth: 560,
    color: '#153d35',
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 45,
  },
  description: {
    maxWidth: 500,
    color: '#647670',
    fontSize: 16,
    lineHeight: 25,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 34,
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3ece8',
  },
  searchIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#e8f5ef',
  },
  searchIconText: {
    color: '#087159',
    fontSize: 23,
    fontWeight: '700',
  },
  searchCopy: {
    flex: 1,
    gap: 5,
  },
  searchTitle: {
    color: '#183c34',
    fontSize: 16,
    fontWeight: '700',
  },
  searchDescription: {
    color: '#71817c',
    fontSize: 13,
    lineHeight: 19,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  settingsLinkText: {
    color: '#176953',
    fontSize: 15,
    fontWeight: '700',
  },
  settingsArrow: {
    color: '#176953',
    fontSize: 23,
  },
});
