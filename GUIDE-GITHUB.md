# Refuge

Application web (PWA) d'aide aux crises de surcharge sensorielle.
Fonctionne hors-ligne, sans compte, sans traceur. Toutes les données restent
sur le téléphone.

Ce guide explique comment publier et modifier Refuge **entièrement depuis un
téléphone Android**, via l'interface web de GitHub, sans ordinateur ni ligne
de commande.

## Publier cette application (depuis un téléphone Android)

### 1. Créer le dépôt

1. Ouvrez **github.com** dans Chrome, connectez-vous.
2. Touchez le **+** en haut à droite → **New repository**.
3. **Repository name** : `refuge`
4. Cochez **Public**. *(GitHub Pages n'est gratuit que sur les dépôts publics.)*
5. Ne cochez rien d'autre. Touchez **Create repository**.

### 2. Envoyer les fichiers

1. Décompressez `refuge-github.zip` sur votre téléphone
   (Gestionnaire de fichiers → appui long sur le zip → **Extraire**).
2. Sur la page de votre dépôt, touchez **Add file** → **Upload files**.
   *Si vous ne voyez pas ce bouton : menu ⋮ de Chrome → cochez
   « Version pour ordinateur ».*
3. Touchez **choose your files**, ouvrez le dossier décompressé, puis
   **sélectionnez les 8 fichiers** (appui long sur le premier, puis touchez
   les autres). Vous pouvez ajouter ce `README.md` en 9ᵉ, si vous voulez.
4. Descendez, touchez **Commit changes**.

> ⚠️ Les fichiers doivent être **à la racine** du dépôt, pas dans un
> sous-dossier. C'est pour cela que cette version n'a pas de dossier `icons/`.
> L'envoi depuis un téléphone ne sait pas créer de sous-dossier : prenez
> toujours la variante **à plat**.

### 3. Activer GitHub Pages

1. Onglet **Settings** du dépôt (roue dentée).
2. Menu de gauche → **Pages**.
3. **Source** : `Deploy from a branch`.
4. **Branch** : `main`, dossier `/ (root)`. Touchez **Save**.
5. Patientez 1 à 2 minutes, puis rechargez la page : l'adresse apparaît en haut.

Elle ressemble à : `https://votre-pseudo.github.io/refuge/`

### 4. Installer sur l'écran d'accueil

1. Ouvrez cette adresse dans Chrome.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** → **Installer**.

L'icône apparaît sur votre écran d'accueil. L'application s'ouvre en plein
écran et fonctionne **sans connexion**.

---

## Modifier l'application plus tard

Gros avantage de GitHub : **vous pouvez éditer directement depuis le
téléphone**, sans rien réenvoyer.

1. Sur GitHub, ouvrez le fichier (`index.html` pour les textes,
   `styles.css` pour les couleurs).
2. Touchez le **crayon** ✏️ en haut à droite.
3. Modifiez, puis **Commit changes**.

**À faire à chaque modification** : ouvrez `sw.js` et incrémentez la version,
tout en haut :

```js
const CACHE = 'refuge-v1';   →   const CACHE = 'refuge-v2';
```

Sans cela, votre téléphone continue d'afficher l'ancienne version qu'il garde
en mémoire. Comptez 1 à 2 minutes après chaque commit pour que GitHub Pages
republie.

---

## Mettre à jour une application déjà publiée

Si Refuge est déjà en ligne et que vous voulez installer une nouvelle version
(par exemple passer de la v1 à la v2) :

1. Décompressez la nouvelle archive sur le téléphone.
2. Sur votre dépôt GitHub : **Add file** → **Upload files**.
3. Sélectionnez les **mêmes 8 fichiers** que la première fois. GitHub
   **remplace** les anciens automatiquement : il n'y a rien à supprimer.
4. **Commit changes**, puis attendez 1 à 2 minutes.
5. Sur le téléphone, ouvrez l'application et **fermez-la complètement**
   (bouton carré d'Android → balayer la fenêtre), puis rouvrez-la. La nouvelle
   version s'installe au second lancement.

Vos données ne sont pas touchées : le journal, les réglages, le protocole et
les liens vivent dans le téléphone, pas dans les fichiers du dépôt.

---

## Les fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les 5 écrans et **tous les textes affichés** |
| `styles.css` | Couleurs, tailles, les 3 thèmes (tout est en haut du fichier) |
| `app.js` | Le comportement : boutons, protocole, carte image, liens, journal, respiration |
| `sw.js` | Le mode hors-ligne |
| `manifest.json` | Nom et icône de l'application |
| `icon-192.png` `icon-512.png` `maskable-512.png` | Les icônes |

Tout le code est commenté en français.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche | Fichiers dans un sous-dossier | Les fichiers doivent être à la racine du dépôt |
| Erreur 404 | Pages pas encore publié | Attendre 2 min, recharger |
| Pas de « Ajouter à l'écran d'accueil » | Adresse en `http://` | L'adresse GitHub Pages est en `https://`, vérifiez-la |
| Une modification n'apparaît pas | Cache du service worker | Incrémenter `CACHE` dans `sw.js` |
| Le style a disparu | Un fichier manquant à l'envoi | Vérifier que les 8 fichiers sont bien là |

---

## Limites assumées

Aucune application web ne peut envoyer un SMS toute seule, régler la
luminosité, ni activer « Ne pas déranger » : Android l'interdit. Refuge ouvre
l'application SMS avec le destinataire et le texte déjà remplis (il reste un
appui sur « Envoyer »), et accompagne les deux autres gestes par des guides
visuels.

Refuge n'est pas un dispositif médical. En cas de danger vital : **15** (SAMU)
ou **112**. **114** par SMS pour qui ne peut pas parler.
