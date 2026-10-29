# Refuge

Application web (PWA) d'aide aux crises de surcharge sensorielle.
Fonctionne hors-ligne, sans compte, sans traceur. Toutes les données restent
sur le téléphone.

**Version 2.2.**

---

## Ce que fait l'application

| Écran | À quoi il sert |
|---|---|
| **Accueil** | Le gros bouton d'aide (SMS pré-rempli), le bouclier sensoriel, le message à montrer (avec des phrases courtes), « Quand ça monte », les numéros d'urgence |
| **Respirer** | Respiration guidée : cohérence 5-5, apaisant 4-7-8, carré 4-4-4-4 |
| **Protocole** | Ce qui m'aide en crise, à cocher — la carte image pour l'écran verrouillé — et, pour soi, « Quand je sens que ça monte » |
| **Journal** | Historique des crises, note en un appui, note vocale facultative, ce qui revient le plus souvent, export CSV et sauvegarde JSON |
| **Réglages** | Contact, textes, phrases courtes, thème et gammes de couleurs, taille du texte, déclencheurs personnels, position facultative, sauvegarde et restauration de toutes les données |

### Nouveauté : une note vocale dans le journal

Après une crise, parler peut être plus facile qu'écrire. Dans le formulaire
détaillé du journal, « Enregistrer ma voix » garde une note de 5 minutes au
plus, sur le téléphone seulement, sans aucune transcription. Elle se réécoute
ou se supprime depuis l'entrée.

C'est la **seule** exception à « jamais de son » : le micro ne s'ouvre que sur
appui, le son ne sort que sur « Écouter », et tout disparaît en bouclier
sensoriel. Quitter le journal ou l'application coupe la lecture.

⚠️ **Les notes vocales ne sont pas dans la sauvegarde JSON** (elles seraient
trop lourdes). Le texte des entrées y est, mais pas la voix : si les données
de Refuge sont effacées ou si vous changez de téléphone, elles sont perdues.

### Nouveautés de la version 2.2

**1. Des phrases courtes à montrer.** Sous « Montrer un message », une série
de boutons : « Oui », « Non », « Attendez, s'il vous plaît », « J'ai besoin de
sortir »… Une phrase touchée s'affiche en grand, pour répondre sans parler.
Elles se changent dans les Réglages (une par ligne) et ne déclenchent jamais
rien d'autre. Elles n'apparaissent pas sur la carte « J'ai besoin d'aide ».

**2. Noter une crise en un appui.** « Noter une crise maintenant » enregistre
seulement l'heure. L'entrée se complète plus tard, quand l'énergie revient —
ou jamais. Toute entrée du journal peut désormais être modifiée.

**3. Ce qui revient le plus souvent.** En haut du journal, une phrase calculée
sur le téléphone : le nombre de crises des trois derniers mois et les
déclencheurs les plus fréquents.

**4. Des déclencheurs personnels.** « Vêtement qui gratte », « Téléphone qui
sonne »… Ils s'ajoutent en notant une crise, et se gèrent dans les Réglages.

**5. Quand je sens que ça monte.** Dans l'onglet Protocole, une partie pour
soi (elle ne va jamais sur la carte) : ses premiers signes, et ce qui aide
tant qu'il est encore temps. On la relit depuis l'accueil, avec le bouton
« Quand ça monte ». Comme les liens apaisants, il disparaît en bouclier.

**6. Les gammes de couleurs de Cap.** Bleu-gris, sauge, lavande, sable,
pêche, miel, rose poudré, en plus de la gamme d'origine. Le bouclier
sensoriel, lui, reste toujours noir.

### Nouveautés de la version 2

**1. Mon protocole.** Une quarantaine de propositions à cocher, rangées en
cinq thèmes — contact et présence, parole et questions, autour de moi, ce qui
m'apaise, ce qu'il faut savoir. Chaque thème a un champ libre pour vos propres
mots. Tout est écrit à la première personne : ce sont des informations, jamais
des consignes médicales. Un contact à prévenir peut être ajouté, facultatif.

Pour ajouter une proposition plus tard, il n'y a qu'un seul endroit à
modifier : la liste `THEMES_PROTOCOLE`, en haut de la section 9 de `app.js`.
Une ligne suffit. Les règles à respecter sont écrites juste au-dessus.

**2. Ma carte pour l'écran verrouillé.** Un bouton fabrique une image PNG
portrait (1080 × 1920) à partir des lignes cochées : grand texte, fort
contraste, titre « Je suis autiste, je suis en surcharge sensorielle. Voici ce
qui m'aide. » Le haut et le bas de l'image restent vides, là où Android pose
l'horloge et les notifications. L'image se télécharge ou se partage. Un
avertissement s'affiche **avant** la création : un écran verrouillé se lit
sans déverrouiller le téléphone, donc par n'importe qui.

**3. Ce qui m'apaise.** Vos playlists, livres audio, podcasts : nom + adresse,
enregistrés sur le téléphone. Seules les adresses en `https://` sont acceptées,
l'ouverture demande deux appuis et se fait dans un nouvel onglet. Ces liens
**disparaissent complètement quand le bouclier sensoriel est actif** : le
bouclier, c'est le silence, pas un menu de plus.

La mise à jour conserve le journal de crises existant : la base passe de la
version 1 à la version 2 en ajoutant deux tiroirs à côté de l'ancien, sans y
toucher. La version 3 ajoute de même un tiroir pour les notes vocales.

---

## Mettre la carte en fond d'écran verrouillé (Redmi / Xiaomi)

1. Dans Refuge : onglet **Protocole** → **Créer ma carte** → **Créer la
   carte** → **Télécharger l'image**.
2. L'image arrive dans **Galerie**, album « Téléchargements ».
3. Ouvrez-la, touchez **⋮** (ou « Plus ») en bas à droite → **Définir comme
   fond d'écran**.
4. Choisissez **Écran de verrouillage** — surtout pas « Écran d'accueil ».
5. **Ne recadrez pas** : reculez l'image jusqu'à voir tout le texte, puis
   **Appliquer**.

Si le fond d'écran change tout seul au bout de quelques heures, c'est le
carrousel de Xiaomi : **Réglages → Fond d'écran → Carrousel de fonds d'écran →
éteindre**.

---

## Publier cette application (depuis un téléphone Android)

### 1. Créer le dépôt

1. Ouvrez **github.com** dans Chrome, connectez-vous.
2. Touchez le **+** en haut à droite → **New repository**.
3. **Repository name** : `Refuge`
4. Cochez **Public**. *(GitHub Pages n'est gratuit que sur les dépôts publics.)*
5. Ne cochez rien d'autre. Touchez **Create repository**.

### 2. Envoyer les fichiers

1. Rangez dans un même dossier de votre téléphone les fichiers de ce dépôt.
   Il en faut **8** pour que l'application fonctionne : ceux du tableau
   « Les fichiers », plus bas.
2. Sur la page de votre dépôt, touchez **Add file** → **Upload files**.
   *Si vous ne voyez pas ce bouton : menu ⋮ de Chrome → cochez
   « Version pour ordinateur ».*
3. Touchez **choose your files**, ouvrez ce dossier, puis
   **sélectionnez les 8 fichiers** (appui long sur le premier, puis touchez
   les autres). Les fichiers de documentation (`README.md`, `LICENSE`…) sont
   facultatifs : ajoutez-les si vous voulez.
4. Descendez, touchez **Commit changes**.

> ⚠️ Les fichiers doivent être **à la racine** du dépôt, pas dans un
> sous-dossier. C'est pour cela que cette version n'a pas de dossier `icons/`.

### 3. Activer GitHub Pages

1. Onglet **Settings** du dépôt (roue dentée).
2. Menu de gauche → **Pages**.
3. **Source** : `Deploy from a branch`.
4. **Branch** : `main`, dossier `/ (root)`. Touchez **Save**.
5. Patientez 1 à 2 minutes, puis rechargez la page : l'adresse apparaît en haut.

Elle ressemble à : `https://votre-pseudo.github.io/Refuge/`

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

## Les fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les 5 écrans et **tous les textes affichés** |
| `styles.css` | Couleurs, tailles, les thèmes et les gammes de couleurs (tout est en haut du fichier) |
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
| La carte image ne se télécharge pas | Téléchargements bloqués pour le site | Chrome → ⋮ → Paramètres → Paramètres des sites → autoriser |
| Le bouton « Partager » n'apparaît pas | Le navigateur ne sait pas partager un fichier | Utiliser « Télécharger l'image », puis partager depuis la Galerie |
| Un lien refusé | L'adresse ne commence pas par `https://` | La recopier en entier depuis la barre d'adresse du navigateur |

---

## Limites assumées

Aucune application web ne peut envoyer un SMS toute seule, régler la
luminosité, ni activer « Ne pas déranger » : Android l'interdit. Refuge ouvre
l'application SMS avec le destinataire et le texte déjà remplis (il reste un
appui sur « Envoyer »), et accompagne les deux autres gestes par des guides
visuels.

La position (facultative, éteinte par défaut) suit la même règle : Refuge
n'envoie rien, il ajoute un lien **OpenStreetMap** au texte du SMS, avec la
précision réelle du point et l'heure du relevé. Avant l'envoi, la carte affiche
ce qui sera joint et propose de le retirer d'un appui. L'autorisation Android
se demande **une seule fois, depuis les Réglages, à tête reposée** : jamais
pendant une crise. Si le point n'est pas trouvé à temps — en intérieur, c'est
fréquent — le SMS part sans lui, sans rien bloquer.

La carte pour l'écran verrouillé est fabriquée par le téléphone lui-même et
n'est envoyée nulle part. En revanche, une fois posée en fond d'écran, elle
est **publique** : tout le monde peut la lire sans déverrouiller l'appareil.
C'est le but — et c'est pourquoi un avertissement s'affiche avant chaque
création. Le numéro du contact y est facultatif.

Les liens apaisants ne sont jamais ouverts automatiquement : Refuge n'en garde
que le nom et l'adresse, et c'est un appui humain qui décide, à chaque fois.

Refuge n'est pas un dispositif médical. En cas de danger vital : **15** (SAMU)
ou **112**. **114** par SMS pour qui ne peut pas parler.

---

## Donner ton avis

Une idée, une gêne, quelque chose qui manque ? Écris à
**omni-systeme.choking513@passmail.net** (aussi dans Réglages → À propos,
bouton « Envoyer un retour par e-mail »).

## Licence

**© 2026 Ferrus Dantioch — Creative Commons BY-NC-ND 4.0**
([résumé de la licence en français](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr))

En clair : le partage est autorisé, à l'identique et en citant l'auteur ;
l'usage commercial est interdit ; la modification et les œuvres dérivées
sont interdites. Le logiciel est fourni « en l'état », sans aucune garantie.

Texte complet dans le fichier [LICENSE](LICENSE) : le texte officiel en
anglais, suivi de la traduction française officielle publiée par Creative
Commons.
