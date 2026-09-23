# Refuge — notes pour Claude

PWA d'aide aux personnes autistes pendant une crise de surcharge sensorielle, en
**HTML/CSS/JS pur, sans dépendance ni compilation**. L'utilisateur cible s'en
sert au moment où la parole et la motricité fine deviennent difficiles.

Cinq écrans : Accueil, Respirer, Protocole, Journal, Réglages — plus trois
écrans plein écran (message à montrer, numéros d'urgence, liens apaisants) et
l'écran de fabrication de la carte.

## ⚠️ Contraintes de conception : à préserver, pas à rediscuter

Ces règles ont été construites délibérément et sont critiques pour la sécurité
et la confiance. Toute demande qui semble entrer en conflit avec l'une d'elles
doit être **signalée à l'utilisateur** plutôt qu'appliquée telle quelle.

- **Jamais de son, jamais de vibration, jamais de notification.** Garanti par
  construction : `app.js` n'appelle jamais `navigator.vibrate`, ne crée jamais
  d'objet `Audio` et ne demande jamais l'autorisation d'envoyer des
  notifications. Ne pas introduire ces appels, même « discrets ».
- **Aucun blanc pur ni noir pur** dans les deux thèmes normaux. Seul le mode
  « bouclier sensoriel » passe au `#000`, et uniquement parce que les pixels
  OLED éteints réduisent la lumière émise.
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

## ⚠️ Avant de pousser : incrémenter la version du service worker

Après toute modification d'un fichier **mis en cache** (`index.html`, `app.js`,
`styles.css`, `manifest.json`, icônes), incrémenter la constante en haut de
`sw.js` :

```js
const CACHE = 'refuge-v10';   // → v11
```

Sans ce changement, le navigateur ne retélécharge rien et **toute personne ayant
déjà ouvert l'application continue de voir l'ancienne version**. En cas
d'**ajout de fichier**, l'inscrire aussi dans la liste `FICHIERS` du même
fichier. **Ne pas** incrémenter pour un changement hors cache (README, LICENSE).

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
