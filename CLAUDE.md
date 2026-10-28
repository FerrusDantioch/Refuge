# Refuge — notes pour Claude

PWA d'aide aux personnes autistes pendant une crise de surcharge sensorielle, en
**HTML/CSS/JS pur, sans dépendance ni compilation**. L'utilisateur cible s'en
sert au moment où la parole et la motricité fine deviennent difficiles.

Cinq écrans : Accueil, Respirer, Protocole, Journal, Réglages — plus quatre
écrans plein écran (message à montrer, numéros d'urgence, liens apaisants,
« Quand ça monte ») et l'écran de fabrication de la carte.

## ⚠️ Contraintes de conception : à préserver, pas à rediscuter

Ces règles ont été construites délibérément et sont critiques pour la sécurité
et la confiance. Toute demande qui semble entrer en conflit avec l'une d'elles
doit être **signalée à l'utilisateur** plutôt qu'appliquée telle quelle.

- **Jamais de son, jamais de vibration, jamais de notification.** Garanti par
  construction : `app.js` n'appelle jamais `navigator.vibrate`, ne crée jamais
  d'objet `Audio` et ne demande jamais l'autorisation d'envoyer des
  notifications. Ne pas introduire ces appels, même « discrets ».
- **Aucun blanc pur ni noir pur** dans les thèmes normaux. Seul le mode
  « bouclier sensoriel » passe au `#000`, et uniquement parce que les pixels
  OLED éteints réduisent la lumière émise.
- **Gammes de couleurs : le bouclier passe toujours avant.** Les huit gammes
  (`refuge`, celle d'origine, et les sept de Cap) sont posées par
  `data-palette` sur `<html>`. Les variables du bouclier sont en
  `!important` pour qu'aucune gamme, même ajoutée plus tard, ne l'éclaire :
  ne jamais retirer ces `!important`. Le bouton d'aide garde sa teinte
  terracotta dans toutes les gammes. Le script du `<head>` d'`index.html`
  pose thème, gamme, taille et bouclier avant le premier affichage (pas
  d'éclair de lumière au démarrage en bouclier) ; `app.js` refait la même
  chose ensuite.
- **Aucun compte, aucun appel réseau, aucun traceur, aucune publicité.** Tout
  reste en `localStorage` / `IndexedDB` : rien ne quitte l'appareil.
- **Animations lentes et régulières**, jamais brusques ; `prefers-reduced-motion`
  pleinement respecté ; transitions à 0 ms en mode bouclier.
- **Zones tactiles ≥ 60 px** : la motricité fine se dégrade pendant une crise.
- **Ne jamais envoyer quoi que ce soit automatiquement** (SMS, appel).
  L'application pré-remplit et ouvre l'application native ; le dernier geste
  appartient toujours à un humain.
- **Position : jamais de demande d'autorisation pendant une crise.** Une boîte
  de dialogue système qui surgit au mauvais moment, un appui de travers sur
  « Bloquer », et la fonction est perdue définitivement. L'autorisation se
  demande uniquement depuis Réglages (bouton « Tester ma position »), la
  fonction est **éteinte par défaut**, et si l'autorisation n'est pas déjà
  accordée au moment de la crise, `position.demarrer()` renonce en silence.
  Corollaire : **le SMS n'attend jamais la position**. La recherche démarre à
  l'ouverture de la carte, `ouvrirSms()` reste strictement synchrone, et le
  point est oublié à la fermeture (il ne doit jamais resservir ailleurs).
- **Ce n'est pas un dispositif médical.** Garder visible la mention des numéros
  d'urgence français (15 / 112).
- **Protocole : de l'information, jamais une consigne médicale.** Les
  propositions sont écrites à la première personne (« Ne pas me toucher »,
  « Je vous entends même sans répondre »). Elles décrivent ce qui aide *cette
  personne* ; elles ne prescrivent rien à qui que ce soit. Toute proposition
  ajoutée doit garder cette forme. Les `id` de `THEMES_PROTOCOLE` sont la clé
  de stockage : **ne jamais en modifier un déjà publié**, sinon la case se
  décoche chez les gens.
- **« Quand je sens que ça monte » : pour soi, jamais sur la carte.** Cette
  partie du Protocole (`THEMES_MONTEE`, rangée dans `protocole.monte`) ne
  doit jamais entrer dans `lignesProtocole()` ni sur l'image. Mêmes règles
  que le protocole : première personne, de l'information et pas une
  consigne, et des `id` qui ne changent jamais. Son bouton d'accueil et son
  écran disparaissent en bouclier, comme les liens apaisants. Une
  sauvegarde plus ancienne (sans `monte`) ne l'efface pas à la restauration.
- **Phrases courtes à montrer : seulement pour « Montrer un message ».**
  Elles s'affichent en grand et ne déclenchent jamais rien (ni SMS, ni
  appel). Absentes de la carte « J'ai besoin d'aide ». Elles parlent aux
  autres : elles gardent le « vous ».
- **Journal : modifier une entrée = `put()` dans le tiroir `crises`.**
  Aucun nouveau tiroir, donc aucune montée de version d'IndexedDB. Une
  entrée « rapide » n'a que son heure ; elle se complète plus tard.
- **Tutoiement : l'application tutoie la personne.** Tout texte qui s'adresse
  à elle (boutons, explications, consignes de respiration, annonces pour
  lecteur d'écran, messages d'erreur) dit « tu ». Exception voulue : ce
  qu'elle montre aux autres (propositions du protocole, carte pour l'écran
  verrouillé, message affiché en grand) parle à des inconnus et garde le
  « vous » — « Je vous entends même sans répondre ».
- **Carte pour l'écran verrouillé : avertissement obligatoire avant
  fabrication.** Un écran verrouillé se lit sans déverrouiller le téléphone,
  donc par n'importe qui, y compris quelqu'un de mal intentionné. L'image
  n'est jamais fabriquée avant confirmation explicite, et le numéro du contact
  y est facultatif. Les zones haute (360 px) et basse (210 px) de l'image
  restent vides : l'horloge et les notifications d'Android s'y posent.
- **Liens apaisants : `https://` uniquement, deux appuis, et rien en
  bouclier.** L'adresse est validée par `new URL()` + `protocol === 'https:'`.
  L'ouverture se fait dans un nouvel onglet, après une confirmation. Dès que
  le bouclier sensoriel s'allume, les boutons d'entrée disparaissent et
  l'écran se referme : le bouclier, c'est le silence, pas un menu de plus.
- **IndexedDB : migration additive uniquement.** `onupgradeneeded` ne crée que
  les tiroirs manquants (`objectStoreNames.contains`). Un tiroir existant
  n'est jamais recréé ni vidé : le journal d'une ancienne version doit
  toujours survivre. Nouveau tiroir = version +1 et un bloc `if (!contains)`
  de plus, sans toucher aux précédents.
- **Carte « Numéros d'urgence » : deux appuis pour appeler.** Elle sert d'abord
  à *anticiper* — savoir qui répond et ce qu'on demandera — pas à composer vite.
  D'où le texte qui accompagne chaque numéro, et le 114 (urgences par SMS, pour
  qui ne peut pas parler) placé en premier. Un appel des secours déclenché par
  mégarde pendant une crise est un vrai risque : ne jamais ramener ces boutons
  à un seul appui. La carte s'ouvre en donnant le focus à elle-même
  (`preventScroll`) et non au bouton « Fermer », sinon la liste s'ouvre par la
  fin.

- **Nouvelle version : jamais de changement par surprise.** Elle attend que
  la personne touche « Mettre à jour », bouton placé **dans les Réglages
  seulement** (`#carte-mise-a-jour`) : l'accueil sert en crise, il ne porte
  qu'une note sans bouton (`#avis-mise-a-jour`), et les deux disparaissent
  en bouclier. Cela tient **même si Refuge est fermée puis rouverte** :
  `sw.js` note la copie EN SERVICE dans le cache `refuge-choix`, et le
  `fetch` ne sert qu'elle ; un service worker plus récent, activé par le
  navigateur à la réouverture, continue donc de servir l'ancienne. Messages
  page ↔ service worker, **noms à ne jamais changer** (une ancienne page doit
  pouvoir parler à un service worker plus récent) : `etat` (réponse
  `{ nouvelleVersion }`), `activer`, `recharger`. Pas de `self.skipWaiting()`
  dans l'installation, et ne jamais remplacer en arrière-plan un fichier
  rangé dans le cache.

## ⚠️ Avant de pousser : incrémenter la version du service worker

Après toute modification d'un fichier **mis en cache** (`index.html`, `app.js`,
`styles.css`, `manifest.json`, icônes), incrémenter d'un cran la constante en
haut de `sw.js`. Partir du numéro qui y figure aujourd'hui, jamais d'un
exemple écrit ailleurs :

```js
const CACHE = 'refuge-vN';   // N = numéro actuel dans sw.js → 'refuge-vN+1'
```

Sans ce changement, le navigateur ne retélécharge rien et **toute personne ayant
déjà ouvert l'application continue de voir l'ancienne version**. En cas
d'**ajout de fichier**, l'inscrire aussi dans la liste `FICHIERS` du même
fichier. **Ne pas** incrémenter pour un changement hors cache (README, LICENSE).

## Points en attente

Les points relevés par l'audit d'octobre 2026 et pas encore traités sont
listés dans `A-FAIRE.md`, à la racine. Cocher ou retirer une ligne quand elle
est réglée.

## Tester en local

Ce dépôt ne contient pas de serveur de test. Un service worker ne fonctionne
**que** sur `https://` ou `http://localhost`, jamais en `file://` : il faut donc
servir le dossier par un petit serveur HTTP local pour vérifier l'installation
et le mode hors ligne.

Déploiement : GitHub Pages, branche `main`, racine →
https://ferrusdantioch.github.io/Refuge/

`GUIDE-GITHUB.md` explique comment publier et modifier l'application
**entièrement depuis un téléphone Android**, via l'interface web de GitHub, sans
ordinateur ni ligne de commande.
