import type { Locale } from './locale';

interface MessageDictionary {
  appName: string;
  homeTitle: string;
  homeDescription: string;
  homeNavigation: string;
  settingsTitle: string;
  settingsNavigation: string;
  languageLabel: string;
  frenchLanguage: string;
  englishLanguage: string;
  searchButton: string;
  originLabel: string;
  originPlaceholder: string;
  destinationLabel: string;
  destinationPlaceholder: string;
  useMyLocation: string;
  choosePlaceTitle: string;
  noRouteTitle: string;
  noRouteMessage: string;
  locationPermissionTitle: string;
  locationPermissionMessage: string;
  locationPermissionDenied: string;
  locationUnavailable: string;
  networkRequiredTitle: string;
  networkRequiredMessage: string;
  routeSearchFailed: string;
  loadingRoutes: string;
  tryAgain: string;
}

export const messages: Record<Locale, MessageDictionary> = {
  fr: {
    appName: 'Tata Dakar',
    homeTitle: 'Votre trajet Tata, en clair.',
    homeDescription:
      'Trouvez les lignes et les arrêts Tata vérifiés pour vous déplacer à Dakar.',
    homeNavigation: 'Accueil',
    settingsTitle: 'Paramètres',
    settingsNavigation: 'Paramètres',
    languageLabel: 'Langue de l’application',
    frenchLanguage: 'Français',
    englishLanguage: 'Anglais',
    searchButton: 'Rechercher un trajet',
    originLabel: 'Départ',
    originPlaceholder: 'Adresse ou lieu de départ',
    destinationLabel: 'Destination',
    destinationPlaceholder: 'Où voulez-vous aller ?',
    useMyLocation: 'Utiliser ma position',
    choosePlaceTitle: 'Choisissez le bon lieu',
    noRouteTitle: 'Aucun trajet Tata vérifié trouvé',
    noRouteMessage:
      'Aucun itinéraire Tata vérifié ne dessert cette destination pour le moment.',
    locationPermissionTitle: 'Autoriser l’accès à votre position',
    locationPermissionMessage:
      'Votre position aide à trouver les arrêts Tata adaptés les plus proches.',
    locationPermissionDenied:
      'L’accès à la position est désactivé. Vous pouvez saisir votre départ.',
    locationUnavailable:
      'Votre position est indisponible. Saisissez votre départ pour continuer.',
    networkRequiredTitle: 'Connexion Internet nécessaire',
    networkRequiredMessage:
      'Connectez-vous à Internet pour rechercher un nouvel itinéraire.',
    routeSearchFailed:
      'La recherche du trajet a échoué. Vérifiez votre connexion et réessayez.',
    loadingRoutes: 'Recherche des trajets Tata…',
    tryAgain: 'Réessayer',
  },
  en: {
    appName: 'Tata Dakar',
    homeTitle: 'Your Tata journey, made clear.',
    homeDescription:
      'Find verified Tata routes and stops for getting around Dakar.',
    homeNavigation: 'Home',
    settingsTitle: 'Settings',
    settingsNavigation: 'Settings',
    languageLabel: 'App language',
    frenchLanguage: 'French',
    englishLanguage: 'English',
    searchButton: 'Find a route',
    originLabel: 'From',
    originPlaceholder: 'Starting address or place',
    destinationLabel: 'To',
    destinationPlaceholder: 'Where do you want to go?',
    useMyLocation: 'Use my location',
    choosePlaceTitle: 'Choose the right place',
    noRouteTitle: 'No verified Tata route found',
    noRouteMessage:
      'No verified Tata route serves this destination yet.',
    locationPermissionTitle: 'Allow access to your location',
    locationPermissionMessage:
      'Your location helps find the nearest suitable Tata stops.',
    locationPermissionDenied:
      'Location access is off. You can enter your starting point instead.',
    locationUnavailable:
      'Your location is unavailable. Enter your starting point to continue.',
    networkRequiredTitle: 'Internet connection required',
    networkRequiredMessage:
      'Connect to the internet to search for a new route.',
    routeSearchFailed: 'Route search failed. Check your connection and try again.',
    loadingRoutes: 'Searching Tata routes…',
    tryAgain: 'Try again',
  },
};
