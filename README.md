# Un Moment Clément

> **Description proposée — à valider par Fréro avant merge.**
>
> Site vitrine de Clément Boéchat, praticien en massages bien-être à Bordeaux.
> Présente ses sept techniques (californien, Lomi Lomi, ayurvédique, deep tissue,
> réflexologie plantaire, aux bambous, personnalisé), ses tarifs et ses coordonnées
> de contact.

## Stack

- HTML / CSS / JS vanilla — aucun framework, aucune dépendance npm
- Police locale : **Bhavuka** (assets/)
- Police CDN : JetBrains Mono via Google Fonts (chargée de façon asynchrone)
- Serveur : **nginx** (image Docker officielle `nginx:1.29-alpine`)

## Développement local

Ouvrir directement `index.html` dans un navigateur, ou via Docker :

```bash
docker compose up
```

Le site est alors accessible sur le port mappé par Nginx Proxy Manager.

## Déploiement

- **Infra** : Raspberry Pi (auto-hébergé)
- **Reverse proxy** : Nginx Proxy Manager
- **CDN / DNS** : Cloudflare (proxy orange)
- **URL prod** : _à compléter par Fréro_

```bash
# Rebuild + redémarrage conteneur
docker compose build && docker compose up -d
```

## Structure du projet

```
index.html          Page unique (SPA statique)
styles.css          Feuille de styles principale
script.js           JS minimal : scroll nav + animations IntersectionObserver
assets/
  logo-c.png        Favicon et logo nav
  hero-massage.jpeg Photo hero (LCP)
  portrait.jpg      Portrait section "À propos"
  Bhavuka-Regular.ttf Police principale
Dockerfile          Image nginx:1.29-alpine
docker-compose.yml  Service + réseau nginx-proxy-manager_default
```

## Licence

_À choisir par Fréro — MIT proposé par défaut (voir HARDENING_REPORT.md §Points ouverts)._
