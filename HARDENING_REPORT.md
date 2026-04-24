# Hardening Report — gotyeah-clement

**Date** : 2026-04-24
**Branche** : `chore/hardening`
**SHA départ** : `94b885e` (main)
**SHA fin** : `626cb1f` (dernier commit de la branche)

---

## Résumé

Site statique HTML/CSS/JS servi par nginx Docker, derrière Nginx Proxy Manager et Cloudflare. Aucun secret, aucun backend, aucun appel réseau depuis le JS. La passe hardening couvre : correction de vraies erreurs HTML, sécurisation des liens externes, déplacement d'inline JS, pin de l'image Docker, ajout du .dockerignore, .gitignore étoffé, documentation complète (README, SECURITY, LICENSE, dependabot), CI GitHub Actions. Snippet CSP adapté au contenu réel fourni pour application manuelle dans NPM.

---

## Confirmations Phase 0

| Question | Réponse |
|---|---|
| Que fait `script.js` ? | 2 comportements : (1) toggle classe `scrolled` sur nav au scroll (`scrollY > 10`) ; (2) `IntersectionObserver` pour les animations `.reveal` → classe `in` au passage dans le viewport. Aucun fetch, aucun XHR. |
| Scripts/styles depuis CDN ? | Google Fonts uniquement : CSS depuis `fonts.googleapis.com`, polices depuis `fonts.gstatic.com`. Aucun `<script src="https://...">`. |
| Liens `target="_blank"` | 2 liens (l.48 barre Instagram, l.618 section contact Instagram). Les deux avaient `rel="noopener"` sans `noreferrer`. **Corrigé.** |
| Dockerfile | `nginx:alpine` (tag flottant), EXPOSE 80, user root, sans `.dockerignore`. |
| docker-compose | Ports exposé seulement (`"80"`), `restart: unless-stopped`, réseau externe `nginx-proxy-manager_default`. Pas de `privileged`, pas de volume, pas de `network_mode: host`. |
| Appels réseau JS | Aucun. |

---

## Phase 1 — Sécurité

| Item | Statut | Note |
|---|---|---|
| 1.1 Scan secrets (gitleaks) | ✅ | gitleaks absent → scan manuel `git log -p` sur patterns clé/token/password. 0 match réel sur 6 commits + historique complet. |
| 1.2 Headers HTTP (snippet NPM) | ✅ | Snippet CSP adapté produit ci-dessous. Inline JS extrait dans script.js. |
| 1.3 SRI sur ressources externes | N/A | Google Fonts sert du CSS dynamique (UA-dependent). Aucun hash stable calculable. Seules ressources externes = `preconnect` (pas de contenu). |
| 1.4 `rel="noopener noreferrer"` | ✅ | 2 liens corrigés (l.50 et l.619). |
| 1.5 Docker hygiène | ✅ | Image pinnée `nginx:1.27-alpine`. `.dockerignore` créé. User root conservé (voir Point ouvert). |
| 1.6 `.gitignore` | ✅ | Ajout `.env`, `.env.*`, `node_modules/`, `.DS_Store`, `Thumbs.db`. |

### 1.2 — Snippet CSP finalisé (à coller dans NPM)

**Nginx Proxy Manager → proxy host gotyeah-clement → Advanced → Custom Nginx Configuration :**

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;

# CSP adaptée au contenu réel de index.html
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self';
  style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self' https://fonts.googleapis.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
" always;
```

**Justification de chaque domaine :**

| Directive | Domaine ajouté | Raison |
|---|---|---|
| `style-src` | `https://fonts.googleapis.com` | Le `<link rel="preload" as="style">` + noscript `<link rel="stylesheet">` chargent la CSS JetBrains Mono depuis ce domaine. |
| `style-src` | `'unsafe-inline'` | Plusieurs attributs `style="..."` inline dans index.html (tarifs, about, contact). Pas supprimables sans refacto. |
| `font-src` | `https://fonts.gstatic.com` | Les fichiers de police (.woff2) référencés par la CSS Google Fonts sont servis depuis ce domaine. |
| `connect-src` | `https://fonts.googleapis.com` | Les deux `<link rel="preconnect">` établissent des connexions vers ce domaine. |
| `script-src` | `'self'` seulement | L'inline handler `onload` a été déplacé dans script.js (commit `686eb76`). Aucun script externe. `'unsafe-inline'` non nécessaire. |
| `img-src` | `data:` | Aucune image externe, mais les dégradés CSS `radial-gradient` peuvent générer des URIs data dans certains contextes. Conservé par précaution. |

**Test post-déploiement (Fréro) :**
```bash
curl -sI https://clement.gotyeah.xxx | grep -iE "strict-transport|x-content|x-frame|referrer|content-security|permissions"
```
Puis [securityheaders.com](https://securityheaders.com) → viser **A**.

---

## Phase 2 — Qualité

| Item | Statut | Note |
|---|---|---|
| 2.1 Validation HTML | ✅ | 47 erreurs initiales → 45 après correction des violations spec réelles. |
| 2.2 Validation CSS | ✅ | 218 warnings, 0 erreur de syntaxe. |
| 2.3 console.log | ✅ | 0 `console.*` dans script.js. |

### Détail 2.1 HTML

**Corrigé :**
- `<!doctype html>` → `<!DOCTYPE html>` (`doctype-style`)
- `&` brut → `&amp;` dans 2 URLs Google Fonts et 1 texte ("Technicien Spa & Bien-Être") (`no-raw-characters`)

**Documenté, non corrigé (préférences stylistiques du validateur, non violations spec) :**
- 24× `void-style` : balises `<meta />`, `<link />`, `<img />`, `<br />` avec slash XHTML (valide HTML5)
- 8× `no-inline-style` : attributs `style="..."` inline — nécessaires pour des valeurs dynamiques uniques
- 14× `tel-non-breaking` : espaces dans numéros de téléphone → `&nbsp;` (préférence typographique)

### Détail 2.2 CSS

0 erreur de syntaxe. 218 warnings stylistiques non corrigés (pas de refacto) :
- `rgba()` → `rgb()` notation moderne (210 potentiellement auto-fixables)
- `rule-empty-line-before` (espacements)
- `property-no-vendor-prefix` : `-webkit-backdrop-filter` conservé (nécessaire pour Safari)
- `media-feature-range-notation`, `font-family-name-quotes`, etc.

---

## Phase 3 — Documentation

| Fichier | Statut | Note |
|---|---|---|
| `README.md` | ✅ | Créé. Description proposée, **à valider par Fréro**. |
| `SECURITY.md` | ✅ | Créé. Contact **à compléter par Fréro**. |
| `LICENSE` | ✅ | MIT créé. **À confirmer par Fréro**. |
| `.github/dependabot.yml` | ✅ | github-actions + docker, mensuel. |

---

## CI — GitHub Actions

| Job | Statut | Détail |
|---|---|---|
| `validate` (HTML + CSS) | ✅ | `html-validate index.html` bloquant ; stylelint `|| true` (warnings) |
| `docker` (build) | ✅ | `docker build -t gotyeah-clement:ci .` |
| `secrets` (gitleaks) | ✅ | `gitleaks/gitleaks-action@v2` sur tout l'historique |

---

## Actions requises côté Fréro (infra / humain)

1. **NPM** : coller le snippet CSP + headers dans Advanced du proxy host gotyeah-clement
2. **Cloudflare** : vérifier config globale (HSTS, SSL/TLS Full Strict)
3. **Post-déploiement** : `curl -sI https://clement.gotyeah.xxx | grep -iE "strict-transport|content-security|x-frame"` + securityheaders.com → A minimum
4. **README** : valider ou corriger la description proposée
5. **LICENSE** : confirmer MIT ou choisir autre
6. **SECURITY.md** : renseigner l'adresse email de contact
7. **CI** : vérifier que les 3 jobs sont verts sur la PR avant de merger

---

## Points ouverts

### User root Docker (Point ouvert — choix délibéré)

L'image `nginx:1.27-alpine` officielle tourne en root. Pour un site statique (surface d'attaque quasi nulle), ce choix est acceptable. Si on veut du non-root, remplacer par `nginxinc/nginx-unprivileged:1.27-alpine` (port interne 8080 au lieu de 80, adapter docker-compose.yml en conséquence). À décider par Fréro.

### gitleaks non installé localement

Le scan a été fait manuellement via `git log -p | grep`. La CI gitleaks-action prend le relais pour les commits futurs.

### Description README

La description du site dans README.md est une proposition. Fréro doit valider qu'elle est juste (prestations listées, positionnement, etc.) avant le merge.

### Choix de licence

MIT proposé par défaut. Si le code ou le contenu (photos, textes) ne doit pas être libre, choisir une autre licence ou retirer le fichier.

---

## Commits produits

| SHA | Message |
|---|---|
| `f22d949` | chore: add HARDENING_PLAN.md |
| `45e2399` | chore(security): 1.4 add noreferrer to all target=_blank links |
| `686eb76` | chore(security): 1.2 move font onload handler to script.js |
| `e81bbfd` | chore(security): 1.5 pin nginx image to 1.27-alpine and add .dockerignore |
| `b8f586f` | chore(security): 1.6 extend .gitignore with .env, node_modules, OS cruft |
| `74bc486` | chore(quality): 2.1 fix genuine HTML spec violations |
| `362b72f` | chore(docs): 3.1 add README.md |
| `ec2c8cb` | chore(docs): 3.2 add SECURITY.md |
| `b086514` | chore(docs): 3.3 add MIT LICENSE |
| `d92c239` | chore(ci): 3.4 add dependabot.yml |
| `626cb1f` | chore(ci): add GitHub Actions CI workflow |

---

## Métriques

| Métrique | Valeur |
|---|---|
| Erreurs HTML avant | 47 |
| Erreurs HTML après | 45 (2 vraies violations spec corrigées) |
| Erreurs CSS syntaxe | 0 |
| Warnings CSS stylistiques | 218 (non corrigés) |
| Ressources externes avec SRI | 0 (N/A — Google Fonts dynamique) |
| console.log dans script.js | 0 |
| Liens target=_blank sans noreferrer | 2 → 0 |
| Inline JS handlers dans HTML | 1 → 0 (extrait dans script.js) |
| Image Docker | `nginx:alpine` (flottant) → `nginx:1.27-alpine` (pinnée) |
| .dockerignore | absent → présent |
| Temps d'exécution estimé | ~45 min |
