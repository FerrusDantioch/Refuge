# Refuge — notes pour Claude

PWA d'aide aux personnes autistes pendant une crise de surcharge sensorielle, en
**HTML/CSS/JS pur, sans dépendance ni compilation**. L'utilisateur cible s'en
sert au moment où la parole et la motricité fine deviennent difficiles.

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
- **Ce n'est pas un dispositif médical.** Garder visible la mention des numéros
  d'urgence français (15 / 112).

## ⚠️ Avant de pousser : incrémenter la version du service worker

Après toute modification d'un fichier **mis en cache** (`index.html`, `app.js`,
`styles.css`, `manifest.json`, icônes), incrémenter la constante en haut de
`sw.js` :

```js
const CACHE = 'refuge-v5';   // → v6
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
