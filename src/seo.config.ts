// Search and AI-answer-engine settings for this app, written by MonstarX's SEO/GEO settings.
//
// Change them in Preview → SEO/GEO or through the authorized builder SEO tools, not here: every save replaces this file. The managed helper
// src/lib/monstarx/seo.ts turns them into the <head> of every page, /robots.txt, /sitemap.xml and /llms.txt.

import type { SeoConfig } from '@/lib/monstarx/seo'

export const seo: SeoConfig = {
  "siteUrl": "",
  "siteName": "yoonu bus",
  "defaultTitle": "Yoonu Bus — Montez sans vous perdre",
  "titleTemplate": "%s · yoonu bus",
  "defaultDescription": "Yoonu Bus — Montez sans vous perdre. Trouvez votre bus à Dakar, suivez votre arrêt et voyagez sereinement.",
  "keywords": [],
  "locale": "fr",
  "themeColor": "",
  "image": null,
  "imageAlt": "",
  "twitterSite": "",
  "twitterCard": "summary_large_image",
  "indexable": false,
  "robots": {
    "mode": "allow",
    "disallow": [],
    "aiCrawlers": "allow",
    "custom": ""
  },
  "sitemap": {
    "enabled": true,
    "exclude": [],
    "extra": []
  },
  "llms": {
    "enabled": true,
    "summary": "",
    "notes": ""
  },
  "organization": {
    "name": "yoonu bus",
    "type": "Organization",
    "logo": null,
    "sameAs": [],
    "email": "",
    "phone": "",
    "address": ""
  },
  "verification": {
    "google": "",
    "bing": "",
    "yandex": "",
    "pinterest": ""
  },
  "faq": [],
  "pages": [
    {
      "path": "/",
      "title": "Bienvenue",
      "description": "Onboarding Yoonu Bus : départ, bus et suivi GPS."
    },
    {
      "path": "/accueil",
      "title": "Accueil",
      "description": "Où vas-tu aujourd'hui ? Cherche ton départ et ta destination."
    },
    {
      "path": "/arret",
      "title": "Arrêt Université",
      "description": "Arrêt Université, infos et lieux autour."
    },
    {
      "path": "/connexion",
      "title": "Connexion",
      "description": "Connecte-toi avec ton email pour contribuer."
    },
    {
      "path": "/contribuer",
      "title": "Contribuer",
      "description": "Propose un parcours et aide Dakar à mieux voyager."
    },
    {
      "path": "/enregistres",
      "title": "Enregistrés",
      "description": "Tes trajets, lignes et arrêts disponibles hors-ligne."
    },
    {
      "path": "/fin-trajet"
    },
    {
      "path": "/hors-ligne"
    },
    {
      "path": "/info",
      "title": "Nos sources",
      "description": "D'où viennent nos infos trajets."
    },
    {
      "path": "/itineraire",
      "title": "Ton bus",
      "description": "Ton itinéraire Tata 24 direct vers Université."
    },
    {
      "path": "/ligne",
      "title": "Ligne Tata 24",
      "description": "Tata 24 aller et retour, arrêts et horaires."
    },
    {
      "path": "/llms.txt"
    },
    {
      "path": "/notifications"
    },
    {
      "path": "/parcours",
      "title": "Parcours et arrêts",
      "description": "Parcours détaillé, arrêts et carte du trajet."
    },
    {
      "path": "/partage",
      "title": "Partager",
      "description": "Partage ton trajet à un proche."
    },
    {
      "path": "/profil",
      "title": "Profil",
      "description": "Tes contributions, points et statut."
    },
    {
      "path": "/proposer",
      "title": "Proposer un parcours",
      "description": "Propose les arrêts que tu connais."
    },
    {
      "path": "/reglages"
    },
    {
      "path": "/retour"
    },
    {
      "path": "/robots.txt"
    },
    {
      "path": "/sitemap.xml"
    },
    {
      "path": "/suivi",
      "title": "Suivi en cours",
      "description": "Suivi GPS en cours, prochain arrêt et alerte descente."
    }
  ],
  "paths": [
    "/",
    "/accueil",
    "/arret",
    "/connexion",
    "/contribuer",
    "/enregistres",
    "/fin-trajet",
    "/hors-ligne",
    "/info",
    "/itineraire",
    "/ligne",
    "/llms.txt",
    "/notifications",
    "/parcours",
    "/partage",
    "/profil",
    "/proposer",
    "/reglages",
    "/retour",
    "/robots.txt",
    "/sitemap.xml",
    "/suivi"
  ]
}

export default seo
