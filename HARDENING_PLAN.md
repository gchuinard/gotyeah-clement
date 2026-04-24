# Plan de durcissement — gotyeah-clement

> Destinataire : Claude Code. Plan spécifique à **gotyeah-clement** (repo d'échauffement du flow hardening).
> Exécuter item par item, produire `HARDENING_REPORT.md` à la racine, ouvrir une PR, attendre validation humaine.

---

## Contexte spécifique au repo

- **Stack réelle** : site statique pur
  - `index.html` (53.8%)
  - `styles.css` (44.5%)
  - `script.js` (1.2% — très peu de JS)
  - `assets/` (images probablement)
- **Déploiement** : Dockerfile + `docker-compose.yml` (probablement nginx qui sert les fichiers statiques, à confirmer)
- **Historique** : 6 commits, minuscule
- **Pas de** : `package.json`, backend, `.env`, `README.md`, auth, BDD, API externe connue
- **Exposition** : derrière Nginx Proxy Manager + Cloudflare (proxy orange)

## Conséquences sur le plan

**Beaucoup d'items N/A** (normal pour un site statique). On se concentre sur :
- Scan secrets (par principe, même si rien attendu)
- Headers HTTP (doc pour NPM)
- SRI sur scripts/styles externes si CDN utilisé
- Hygiène Docker
- Lint léger (HTML/CSS/JS minimal)
- Doc (README manquant = vrai gap)
- CI minimale

## Hors scope

- Config NPM / Cloudflare → Fréro applique à la main, Claude Code **liste**
- Durcissement Pi / système hôte

---

## Principes d'exécution

1. **Branche dédiée** : `chore/hardening` — jamais de commit direct sur main.
2. **Un commit par item** : `chore(security): 1.1 add gitleaks scan`, etc. Pas de fourre-tout.
3. **Pas de force-push**, pas de rewrite d'historique public.
4. **Si doute** : tu t'arrêtes, tu écris dans "Points ouverts", tu passes à l'item suivant.
5. **Pas de refacto gratuit** : si le code marche, on n'y touche pas.
6. **Pas de dépendance ajoutée** sans justification explicite.

---

## Phase 0 — Pré-flight

### 0.1 Vérifications de base

- Branche `chore/hardening` créée depuis `main` à jour
- Outils dispos : `gitleaks`, `docker`
- Lire tous les fichiers avant de toucher quoi que ce soit : `index.html`, `script.js`, `styles.css`, `Dockerfile`, `docker-compose.yml`, `.gitignore`, contenu de `assets/`

### 0.2 Confirmations à établir

Reporter dans le rapport (oui/non + fichier/ligne) :
- Que fait `script.js` exactement ? (1.2% du code → probablement trivial, à résumer en 2 lignes)
- Y a-t-il des scripts/styles chargés depuis un CDN externe dans `index.html` ? (impacte 1.3 SRI)
- Y a-t-il des liens `<a href="">` vers des domaines externes avec `target="_blank"` ?
- Dockerfile : image de base ? port ? user ?
- docker-compose : volumes, ports, flags ?
- Le site fait-il des appels réseau (fetch, XHR) vers une API ? Si oui laquelle ?

---

## Phase 1 — Sécurité

### 1.1 Audit historique Git — secrets

**Pourquoi** : principe, même si on n'attend rien sur un site statique. 6 commits, c'est 10 secondes.

```bash
gitleaks detect --source . --log-opts="--all" --redact -v
```

**Si match** :
- Lister dans le rapport (SHA, fichier, type)
- Ne PAS réécrire l'historique (repo public)
- **Ne pas rotate seul** : écrire dans "Points ouverts", attendre Fréro

**Critère pass** : `gitleaks detect` retourne 0 non justifié.

---

### 1.2 Headers HTTP — snippet NPM à documenter (PAS appliqué ici)

**Claude Code ne touche PAS à NPM.** Il produit le snippet adapté dans le rapport.

**Snippet de base** (Fréro collera dans NPM > proxy host gotyeah-clement > Advanced > Custom Nginx Configuration) :

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;

# CSP — À ADAPTER selon contenu réel de index.html
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

**Claude Code doit lire `index.html` et `styles.css` et ajuster la CSP** :
- `<script src="https://...cdn...">` → ajouter le domaine dans `script-src`
- `<link href="https://fonts.googleapis.com/...">` → `style-src https://fonts.googleapis.com` + `font-src https://fonts.gstatic.com`
- `url(...)` dans CSS vers CDN → `img-src` ou `font-src` selon le cas
- `<style>` inline ou `style="..."` → garder `'unsafe-inline'` sur `style-src`
- `<script>...</script>` inline → deux options : extraire dans `.js` (préféré) OU garder `'unsafe-inline'` sur `script-src`

**Livrable dans le rapport** : snippet CSP définitif adapté au contenu réel, avec commentaire justifiant chaque domaine whitelisté.

**Test post-déploiement (par Fréro)** :
```bash
curl -sI https://clement.gotyeah.xxx | grep -iE "strict-transport|x-content|x-frame|referrer|content-security|permissions"
```
Puis [securityheaders.com](https://securityheaders.com) → viser **A**.

**Critère pass Claude Code** : snippet CSP finalisé dans le rapport, chaque domaine whitelisté justifié.

---

### 1.3 Subresource Integrity (SRI) sur scripts/styles externes

**Pourquoi** : si `index.html` charge un script/style depuis un CDN, un compromise du CDN = injection arbitraire.

**Règle** : tout `<script src="https://...">` ou `<link rel="stylesheet" href="https://...">` doit avoir `integrity="sha384-..."` et `crossorigin="anonymous"`.

**Actions** :
```bash
grep -nE '<(script|link)[^>]*(src|href)="https://' index.html
```

Pour chaque match sans `integrity=` :
1. Noter l'URL et la version
2. Calculer le hash :
   ```bash
   curl -sL <URL> | openssl dgst -sha384 -binary | openssl base64 -A
   ```
3. Ajouter `integrity="sha384-<hash>" crossorigin="anonymous"`
4. Tester localement que la ressource charge (devtools Network)

**Si aucune ressource externe** : item N/A, noter dans le rapport.

**Critère pass** : chaque `<script src="https://">` ou `<link href="https://">` a un `integrity`, OU le rapport justifie leur absence.

---

### 1.4 Liens externes — `rel="noopener noreferrer"`

**Pourquoi** : un lien `target="_blank"` sans `rel="noopener"` permet à la page cible d'accéder à `window.opener` et potentiellement de rediriger l'onglet source (tabnabbing).

```bash
grep -nE 'target="_blank"' index.html
```

Pour chaque match sans `rel="noopener noreferrer"` : l'ajouter.

**Critère pass** : tous les `target="_blank"` ont `rel="noopener noreferrer"`.

---

### 1.5 Docker — hygiène image

**Lire et durcir `Dockerfile`** :

- Image de base pinnée : pas `nginx:latest`, plutôt `nginx:1.27-alpine`
- User non-root : l'image officielle nginx tourne en root par défaut. Deux options :
  - Utiliser `nginxinc/nginx-unprivileged:1.27-alpine` (user nginx, port 8080) → à reporter dans `docker-compose.yml`
  - OU laisser nginx officiel (site statique, surface d'attaque = 0), mais **le documenter** dans le rapport comme choix délibéré
- Pas de `ADD` avec URL distante (préférer `COPY` + build local)
- `.dockerignore` présent : `.git`, `.github`, `Dockerfile`, `docker-compose.yml`, `README.md`, `.gitignore`, `*.md`

**Lire et vérifier `docker-compose.yml`** :
- Pas de `privileged: true`
- Pas de `network_mode: host` sans raison
- Restart policy : `unless-stopped`
- Ports cohérents avec l'image choisie
- Pas de volume en écriture sur fichiers critiques de l'hôte

**Critère pass** : image pinnée, décision user root/non-root documentée, `.dockerignore` présent, compose sans flag dangereux.

---

### 1.6 `.gitignore`

**Vérifier** :
- `.env` présent (prévention future)
- `node_modules/` présent (au cas où on ajoute un lint plus tard)
- `.DS_Store`, `Thumbs.db` (hygiène)
- Aucune entrée qui essaierait de cacher un fichier sensible déjà committé (à signaler si trouvé)

**Critère pass** : `.gitignore` propre, pas de surprise.

---

## Phase 2 — Refacto (très léger, pas de sur-engineering)

### 2.1 Validation HTML

```bash
npx html-validate index.html
```

**Action** : lister les erreurs dans le rapport. Fixer les erreurs **triviales** (balises mal fermées, attributs dépréciés). Les warnings d'accessibilité : noter mais ne pas forcer le fix (hors scope).

**Critère pass** : rapport avec liste des erreurs + ce qui a été corrigé.

### 2.2 Validation CSS

```bash
npx stylelint "**/*.css" --config '{"extends": "stylelint-config-standard"}'
```

**Action** : fixer les erreurs de syntaxe uniquement, ignorer les préférences stylistiques.

**Critère pass** : 0 erreur de syntaxe CSS, warnings stylistiques documentés.

### 2.3 Nettoyage

- Pas de `console.log` oubliés dans `script.js`
- Pas de code commenté massif (si trouvé : proposer suppression dans le rapport, **ne pas supprimer sans accord**)
- Pas de fichier mort dans `assets/` (à évaluer à la main, **ne pas supprimer sans accord**)

**Critère pass** : `grep -n "console\." script.js` → 0 ligne non justifiée.

---

## Phase 3 — Documentation

### 3.1 `README.md` — À CRÉER (manquant actuellement)

Créer à la racine avec : titre, description (proposée par Claude Code à valider par Fréro), stack, dev local (ouverture directe OU `docker compose up`), déploiement (URL prod à remplir par Fréro, mention Pi + NPM + Cloudflare), structure du projet, licence.

**Critère pass** : `README.md` créé, description du projet proposée et marquée comme à valider.

### 3.2 `SECURITY.md`

```markdown
# Security Policy

## Reporting a Vulnerability

Merci de ne pas ouvrir d'issue publique pour les failles de sécurité.

Contact : <adresse à compléter par Fréro>

Inclure :
- Description
- Steps to reproduce
- Impact estimé

Réponse sous 72h.
```

### 3.3 `LICENSE`

MIT proposé par défaut. Noter dans "Points ouverts" pour validation Fréro.

### 3.4 `.github/dependabot.yml`

Même sans deps applicatives, Dependabot surveille les GitHub Actions et l'image Docker de base :

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "monthly"
```

**Critère pass** : les 4 fichiers existent et sont cohérents.

---

## CI — GitHub Actions (minimale)

Créer `.github/workflows/ci.yml` :

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "lts/*"
      - name: HTML validation
        run: npx --yes html-validate index.html
      - name: CSS validation
        run: npx --yes stylelint "**/*.css" --config '{"extends":"stylelint-config-standard"}' || true

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t gotyeah-clement:ci .

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Critère pass** : workflow en place, jobs verts, blocage PR testé (commit volontairement cassé → rouge).

---

## Template de rapport — `HARDENING_REPORT.md`

À commit à la racine en dernier.

Sections obligatoires :
- **Date, branche, SHA départ/fin**
- **Résumé 3 lignes max**
- **Confirmations Phase 0** : contenu script.js, CDN, target=_blank, Docker, compose, appels réseau
- **Tableau Phase 1** : 1 ligne par item, statut ✅/⚠️/❌/N/A
- **Détails Phase 1** : notamment snippet CSP finalisé (à appliquer dans NPM par Fréro) avec justification par domaine whitelisté
- **Tableau Phase 2**
- **Phase 3** : checklist docs
- **CI** : checklist
- **Actions requises côté Fréro (infra / humain)** : NPM, Cloudflare, post-déploiement, validation description README, choix LICENSE
- **Points ouverts** : description README, LICENSE, user root Docker si conservé, autres
- **Commits produits** : liste
- **Métriques** : erreurs HTML/CSS avant/après, ressources SRI, taille image Docker, temps d'exécution

---

## Checklist finale Fréro (avant merge)

- J'ai lu le rapport complet
- Description README validée ou corrigée
- LICENSE choisie
- Config NPM appliquée (snippet CSP + options proxy host)
- Config Cloudflare OK (si pas déjà fait globalement)
- `curl -sI` en prod OK
- securityheaders.com : A minimum
- CI verte sur la PR
- Je merge

---

## En cas de blocage Claude Code

Si Claude Code est bloqué → il s'arrête, écrit dans le rapport, push l'état actuel, ouvre la PR avec `[WIP — blocage]` dans le titre. **Il ne tente pas de débloquer seul** sur un point sensible.

---

## Note finale — repo d'échauffement

Ce repo est volontairement le **plus simple** de la passe de 6. L'objectif est de **valider le flow** (branche, commits atomiques, rapport, PR, validation humaine) avant d'attaquer les repos plus complexes. Si quelque chose cloche dans le process ici, mieux vaut le régler maintenant qu'au 5e repo.