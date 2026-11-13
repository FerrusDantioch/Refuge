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
  construction : `app.js` n'appelle jamais `navigator.vibrate` et ne demande
  jamais l'autorisation d'envoyer des notifications. Ne pas introduire ces
  appels, même « discrets ».
  **Une seule exception, voulue (octobre 2026, retours d'utilisateurs) :
  la note vocale du journal** (section 5 bis d'`app.js`). Le seul élément
  `<audio>` de l'application est créé par `ecouter()`, **uniquement sur
  appui** d'un bouton « Écouter » ; jamais de lecture automatique, jamais
  en bouclier (classe `voix` masquée, `couperVoix()` dans
  `activerBouclier`), et la lecture se tait en quittant le journal ou
  l'application. Le micro n'est demandé que sur « Enregistrer ma voix »,
  dans le formulaire détaillé, jamais dans « Noter une crise maintenant ».
  5 minutes au plus, aucune transcription. Aucun autre son nulle part.
- **Notes vocales : tiroir `notesVocales` (IndexedDB v3), clé = `id` de
  l'entrée.** L'entrée dans `crises` n'est pas modifiée ; supprimer une
  entrée supprime sa note dans la même transaction. **L'audio n'entre
  jamais dans la sauvegarde JSON** (trop lourd), et c'est écrit en
  avertissement dans les Réglages, le journal et le message après
  sauvegarde.
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
- **Procédures par émotion (« Ce que je ressens ») : pour soi, jamais sur
  la carte.** Rangées dans `protocole.emotions` (même enregistrement, même
  sauvegarde que le protocole), elles n'entrent jamais dans
  `lignesProtocole()`. Exemples de départ dans `EMOTIONS_DEFAUT`, définis
  **avant** `let protocole` (sinon erreur au démarrage). Contrairement au
  protocole, tout y est modifiable par la personne (nom, smiley, étapes) ;
  les `id` d'émotions et d'étapes retiennent les cases cochées et ne
  changent pas. Les cases cochées pendant la crise sont à part
  (`refuge.emotionsCoches`, localStorage, gardées pour la journée en
  cours sauf décochage, remises à zéro le lendemain) et hors
  sauvegarde. Une sauvegarde sans `emotions` ne les efface pas à la
  restauration. **Reste visible et lisible en bouclier** (contrairement à
  « Quand ça monte ») ; les smileys y passent en gris. Noms sans accord
  (« Colère », « Épuisement ») ; étapes à l'infinitif ou à la première
  personne, jamais une consigne médicale.
- **« Écrire à un proche » : un contact, un message, un lien `sms:`.**
  Contacts saisis à la main (pas de Contact Picker : il ne marche pas sur
  tous les téléphones), rangés dans `reglages.contacts` (section 11 bis
  d'`app.js`), donc dans la sauvegarde JSON. Un appui sur un message ouvre
  Messages, numéro et texte remplis ; **jamais d'envoi automatique, jamais
  d'envoi groupé** (un seul destinataire par lien), et jamais de position
  jointe : seul le SMS d'urgence du bouton d'aide la propose, et il reste
  tel quel. Une sauvegarde sans `contacts` ne les efface pas à la
  restauration. `REGLAGES_DEFAUT.contacts` ne doit jamais être modifié :
  `chargerReglages()` en fabrique une copie neuve. Reste visible en
  bouclier : écrire sans parler y est justement utile.
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

---

## Règles communes à l'écosystème

> Section ajoutée le 13 novembre 2026 à partir du socle commun des PWA de
> Ferrus. Elle est **adaptée à ce dépôt** : les règles du socle qui ne
> concernent que d'autres applications ont été retirées. Si une règle
> ci-dessous semble contredire les notes propres à ce dépôt (plus haut),
> ne tranche pas : signale-le à Ferrus et attends sa décision.
>
> Version de référence : dépôt privé `omni-socle`, fichier `SOCLE.md`. Toute
> modification d'une règle commune se fait d'abord là-bas, puis est recopiée
> ici.

*Chaque règle porte une étiquette :*

* [DÉCIDÉ] : choix confirmé par Ferrus. À respecter sans discuter.
* [CONSTATÉ] : relevé dans le code des dépôts omni-texte, Refuge, omni-budget et omni-grimoire (novembre 2026). Les autres dépôts n'ont pas été lus.
* [RECOMMANDÉ] : proposition non validée. À proposer, jamais à appliquer d'office.

### 1. Qui, pourquoi, comment travailler

* Ferrus veut comprendre ce qui se passe : explique en français simple, signale chaque terme technique, ne délègue pas dans le dos. [DÉCIDÉ]
* Sois clair, direct, sans édulcorant. Dis ce qui est fragile ou incohérent. [DÉCIDÉ]
* Les outils servent à aider les autres, en priorité les personnes autistes et les personnes en situation de handicap. Refuge et Cap sont des assistances pour personnes autistes ; Soutien-IMC est une fiche de contact très lisible, conçue pour des personnes infirmes moteurs cérébrales. [DÉCIDÉ]
* Objectif de fond : remplacer les outils des grandes entreprises par des outils faits maison, et être indépendant des comptes et d'internet. [DÉCIDÉ]
* Avant tout changement important : explique ce que tu vas faire, attends l'accord. Ne modifie jamais plusieurs applications d'un coup sans demande. [DÉCIDÉ]

### 2. Règles non négociables

1. Pas de compte, pas de backend, pas d'IA intégrée. [DÉCIDÉ]
2. Fonctionnement hors ligne systématique. Tout ce dont l'application a besoin est embarqué dans l'installation, moteur de reconnaissance de texte (OCR) d'omni-budget compris (environ 6 Mo). [DÉCIDÉ]
3. Aucun appel réseau sans en avoir parlé à Ferrus d'abord. Si une fonctionnalité demande internet, arrête-toi, explique pourquoi, propose une alternative locale, attends la décision. [DÉCIDÉ] Cette règle vise l'application. Les outils de développement (`npm install`, GitHub Actions) sont acceptés ; toute nouvelle bibliothèque, tout nouvel outil ou tout nouveau serveur contacté doit être signalé à Ferrus avant. [DÉCIDÉ]
4. Les données restent sur l'appareil. Rien n'est envoyé. Les liens externes ne s'ouvrent que sur action de la personne. [DÉCIDÉ]
5. Pas de police, de bibliothèque ou de script chargés depuis un CDN : tout est embarqué avec sa licence. [CONSTATÉ dans omni-texte ; à étendre]

### 3. Identité, ton, mentions

* Signature : « Ferrus Dantioch », sauf dans Refuge, qui signe d'un prénom seul (celui qui figure dans son « À propos »). C'est voulu : dans le contexte de Refuge, le prénom crée la confiance. Ne pas « corriger ». [DÉCIDÉ]
* Ton : tutoiement partout, y compris dans omni-budget et omni-grimoire. Exception conservée dans Refuge : « vous » pour ce qui est montré à d'autres personnes (message d'urgence, etc.). [DÉCIDÉ pour le tutoiement ; exception CONSTATÉE]
* Chaque application contient un « À propos » avec au minimum : nom, version, « Application réalisée par Ferrus Dantioch, avec l'aide de l'intelligence artificielle », mention de licence, phrase de confidentialité, contact, lien « Découvrir l'Omni-système ». Chaque application garde son texte propre. [DÉCIDÉ pour le fond ; modèle CONSTATÉ dans omni-texte]
* Exception Refuge : aucun lien vers l'Omni-système ni le portfolio. Refuge est destinée à des situations d'urgence : rien ne doit détourner la personne de l'essentiel. Ne pas « corriger » cette absence. Les autres applications d'assistance (Cap, Soutien-IMC) : à décider au cas par cas avec Ferrus. [DÉCIDÉ]
* Licence du code : © 2026 Ferrus Dantioch, Creative Commons BY-NC-ND 4.0, avec le fichier LICENSE identique dans tous les dépôts. Règles, fiches, logos et textes de l'Omni-système : tous droits réservés. [DÉCIDÉ]
* Contact dans les applications : l'alias e-mail de l'Omni-système. Le serveur Discord figure sur le portfolio seulement : il n'a pas besoin d'apparaître dans les applications. [DÉCIDÉ]
* Identité visuelle : violet nuit pour l'écosystème Omni. Logo de l'Omni-système (dé à vingt faces violet entouré d'un anneau lumineux) dans l'« À propos ». Exception Refuge : pas de logo Omni ; le violet nuit y est une gamme facultative parmi les autres, pas celle par défaut. [DÉCIDÉ]

### 4. Sécurité et vie privée

* Une CSP (règle de sécurité qui interdit au navigateur de contacter d'autres sites) stricte dans chaque application. [RECOMMANDÉ ; CONSTATÉ : présente dans omni-texte et omni-budget, absente de Refuge et omni-grimoire]
* Données sensibles (journal, notes vocales, finances) : chiffrées au repos quand c'est possible. [RECOMMANDÉ ; CONSTATÉ : seul omni-budget chiffre]
* Refuge : l'accès rapide en urgence passe avant tout. Ferrus accepte le chiffrement des données seulement s'il n'empêche pas l'usage en urgence. [DÉCIDÉ] Conception proposée : les fonctions d'urgence (respiration guidée, bouclier sensoriel, message d'urgence, numéros utiles) restent accessibles instantanément, sans code et sans chiffrement, car elles ne contiennent pas de données personnelles sensibles. Seules les données personnelles (journal de crises, notes vocales) sont chiffrées, avec un code facultatif que la personne active elle-même, et qui ne bloque jamais l'accès aux fonctions d'urgence. Sans code, un chiffrement dont la clé reste sur l'appareil ne protège pas contre une autre application du même site : il faut l'expliquer honnêtement à la personne dans les réglages. [RECOMMANDÉ, à valider avec Ferrus avant de coder] Périmètre confirmé : seuls le journal de crises et les notes vocales sont chiffrés ; contacts, messages et procédures restent en clair pour rester accessibles instantanément. [DÉCIDÉ]
* Origine partagée : toutes les applications vivent sous la même adresse de base, donc chacune pourrait techniquement lire les données des autres. Ne jamais stocker deux applications sous le même nom de base de données ou de préfixe. Préfixe propre à chaque application pour caches, IndexedDB et localStorage. Un préfixe générique (ex. `budget-`) est à éviter. [CONSTATÉ ; hébergement à origines séparées : décision reportée] Cette règle vaut pour les nouveaux noms : les noms déjà publiés (`budget-perso` et `budget-theme` d'omni-budget) restent, car les renommer ferait perdre les données des personnes. [DÉCIDÉ]
* Sur Chrome Android, une seule PWA du même site s'installe. Contournement : utiliser Brave, qui les installe indépendamment. C'est un palliatif d'installation : il ne règle ni l'isolation des données ni le risque de sécurité. À mentionner dans l'aide à l'installation de chaque application. [DÉCIDÉ comme palliatif]
* Ne pas stocker en clair ce qui pourrait nuire à la personne si quelqu'un d'autre ouvre l'appareil. [RECOMMANDÉ]

### 5. Hors ligne et versions

* Service worker (petit programme qui garde une copie de l'application sur l'appareil) : tout est copié à l'installation, puis « cache d'abord ». [CONSTATÉ]
* La mise à jour doit se vérifier au retour au premier plan, avec un message clair. [CONSTATÉ dans 3 apps sur 4 ; manque dans omni-budget] Exception Refuge : le message clair est la note discrète de l'accueil (sans bouton) et le bouton « Mettre à jour » des Réglages ; rien en bouclier, jamais de changement par surprise. [DÉCIDÉ]
* Le service worker gère l'échec réseau (plan B quand un fichier manque). [RECOMMANDÉ ; absent de Refuge]
* Numéro de version : une seule source de vérité, automatique, jamais écrite à la main à deux endroits. [RECOMMANDÉ ; CONSTATÉ : 4 méthodes différentes, dont 2 reposent sur la mémoire]
* Si le numéro de version affiché ne correspond pas au code, le signaler. [RECOMMANDÉ]

### 6. Accessibilité (minimum pour toute application)

* Cibles tactiles : 44 px minimum. Refuge en vise 60 px. [DÉCIDÉ ; CONSTATÉ : plusieurs boutons du grimoire font 34 à 40 px]
* Contraste du texte : 4,5 minimum (WCAG). [RECOMMANDÉ ; CONSTATÉ : Refuge, thème clair, à 3,8–4,3]
* Contour de focus clavier toujours visible, y compris en thème « bouclier noir » de Refuge. [RECOMMANDÉ] Dans le bouclier : contour gris foncé, juste au minimum de la norme (contraste 3:1 sur le noir, environ `#5a5a5a`), seulement autour de l'élément sélectionné, pour éclairer le moins possible. [DÉCIDÉ]
* Respect du réglage « réduire les animations » du téléphone. [CONSTATÉ dans les quatre]
* Un seul `<h1>` par page. Échap ferme les écrans plein écran. Tab ne s'en échappe pas. [RECOMMANDÉ ; CONSTATÉ : manque dans Refuge]
* Vibration : interdite dans Refuge. Ailleurs, toute vibration a un réglage pour la couper. [DÉCIDÉ ; CONSTATÉ : le grimoire vibre sans réglage]
* Thème appliqué avant l'affichage pour éviter l'éclair du mauvais thème : petit script en tête de page. [CONSTATÉ dans omni-texte et Refuge ; manque dans omni-budget et omni-grimoire]
* Thèmes de référence : Omni (violet nuit), Sombre, Clair. [CONSTATÉ] « Auto » (suit le réglage du téléphone) est accepté en plus de ces trois thèmes. [DÉCIDÉ]

### 7. Tests et livraison

* Test automatique de chaque nouvelle fonction. omni-texte a Playwright (hors ligne, contrastes, téléphone) ; omni-budget a Vitest ; Refuge n'en a pas. [CONSTATÉ ; tests pour Refuge : RECOMMANDÉ]
* Avant de dire que c'est terminé : vérifie hors ligne, vérifie sur téléphone et sur tablette, relis le bloc « À propos », vérifie qu'aucune requête réseau ne part.
* Mettre à jour le README et les commentaires quand le code change (omni-texte annonce 1.3.0 alors que le code est en 1.3.1). [CONSTATÉ]

### 8. Technologies

* Pour une petite application : HTML, CSS et JavaScript purs, sans étape de compilation (build). [RECOMMANDÉ par défaut]
* React + Vite (build obligatoire, publication par GitHub Actions) n'est utilisé que si la complexité le justifie. [CONSTATÉ dans omni-budget et omni-grimoire]
* Publication : GitHub Pages. [CONSTATÉ]

### 10. Périmètre actuel

Seuls omni-texte, Refuge, omni-budget et omni-grimoire ont été examinés. Cap, Soutien-IMC et les autres dépôts ne le seront pas pour le moment, par décision de Ferrus. Ne pas étendre les règles de ce document à un dépôt non lu sans l'avoir lu. [DÉCIDÉ]

### 11. Dettes connues, par priorité

- **Priorité 1** — Refuge : CSP, `<h1>`, Échap, contrastes, cibles tactiles, tests, chiffrement facultatif des données personnelles sans jamais ralentir l'accès d'urgence. (voir aussi `A-FAIRE.md` du dépôt)
- **Priorité 2** — Origine partagée : décision d'hébergement à étudier, reportée.
- **Priorité 4** — Méthode de version unique pour toutes les applications.
- **À classer** — Refuge : plan B du service worker quand un fichier manque dans le cache et que le réseau échoue.
- **À classer** — Refuge : passer à une version unique et automatique, et retirer « Version 2.2 » écrite à la main dans `index.html` (décidé le 13 novembre 2026). D'ici là, la règle « incrémenter la version du service worker » plus haut reste obligatoire : sans elle, les mises à jour n'arrivent plus chez les personnes.
- **À classer** — Refuge : contour de focus gris foncé en bouclier (contraste 3:1 sur le noir).
- **À classer** — Refuge : neuvième gamme facultative « violet nuit » (pas celle par défaut), sans logo Omni, en respectant les règles des gammes (bouclier toujours prioritaire, ni blanc pur ni noir pur).
