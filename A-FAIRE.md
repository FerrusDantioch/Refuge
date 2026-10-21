# Refuge — à régler après la présentation

Points relevés par l'audit d'octobre 2026 et pas encore traités. Rien ici
n'empêche d'utiliser l'application : ce sont des améliorations, de la plus
utile à la moins urgente. Coche une case quand c'est réglé.

Durée estimée : **rapide** (moins d'une heure), **moyen** (une demi-journée),
**long** (plusieurs jours ou un changement d'organisation).

---

## À vérifier sur le téléphone

- [x] **Respiration et mise en veille** *(corrigé en octobre 2026)*. Dans
      Réglages, décocher « Garder l'écran allumé ». Lancer une séance de
      3 minutes sans toucher le téléphone : l'écran doit rester allumé
      jusqu'à « C'est fini », puis s'éteindre normalement.
      ✅ Vérifié sur le téléphone de Johan le 21 octobre 2026 : ça fonctionne.
- [ ] **Bouton « retour » d'Android**. Avec Refuge installée, ouvrir
      « Montrer un message », puis faire le geste retour. Si toute
      l'application se ferme au lieu du seul message, c'est le point 1
      ci-dessous.

---

## Important

### 1. Le bouton « retour » d'Android ferme toute l'application — *moyen*

- **Problème** : Refuge n'inscrit rien dans l'historique de navigation. Le
  geste retour ferme donc l'application entière, au lieu de fermer l'écran
  plein écran ouvert (message, numéros d'urgence, liens, carte, « Quand ça
  monte »).
- **Piste** : inscrire chaque ouverture d'écran plein écran dans
  l'historique (`history.pushState`) et le refermer sur l'événement
  `popstate`, comme le fait l'application Prompteur Créateurs.
- **Attention** : cela touche toute la navigation. Tester longuement :
  envoi du SMS, appel, rechargement après une restauration, bouclier.

### 2. Une adresse à part pour Refuge — *long*

- **Problème** : toutes les applications publiées sur
  `ferrusdantioch.github.io` partagent le même espace de stockage.
  - « Effacer les données » d'une seule d'entre elles dans Chrome efface
    aussi le journal, le protocole et les réglages de Refuge.
  - Chacune de ces applications pourrait techniquement lire les données
    des autres. Rien n'est envoyé sur internet aujourd'hui, mais c'est
    une fragilité pour une application qui garde des données sensibles.
- **Piste** : publier Refuge à sa propre adresse (Cloudflare Pages,
  Netlify, sous-domaine d'un nom de domaine…). Cela règle aussi la limite
  de Chrome Android, qui n'installe qu'une seule application par adresse.
- **Attention** : à la nouvelle adresse, Refuge repart vide et doit être
  réinstallée. Prévenir les personnes qui l'utilisent de faire d'abord une
  sauvegarde (Réglages › « Enregistrer une sauvegarde »), puis de la
  restaurer à la nouvelle adresse.

---

## Mineur

### 3. Clavier — *rapide à moyen*
- La touche Échap ne ferme pas les écrans plein écran.
- La touche Tab sort de ces écrans vers des boutons cachés derrière.
- En bouclier, le cadre qui montre l'élément sélectionné est presque
  invisible : la couleur `--accent` du bouclier n'a qu'un contraste de 2,3
  sur le noir.

### 4. Lecteurs d'écran — *rapide*
- L'accueil n'a pas de titre (`<h1>`).
- Dans le formulaire du journal, les étiquettes « Durée » et
  « Déclencheurs » ne sont pas reliées à leurs groupes de boutons. La
  première pointe vers un `<div>`, la seconde n'a pas d'attribut `for`.

### 5. Thème clair : petits textes gris un peu pâles — *rapide*
- Les textes gris (`--texte-doux`) sont légèrement sous la norme
  d'accessibilité, qui demande un contraste de 4,5 : 4,3 sur les cartes,
  3,8 à 4,0 sur les boutons.
- Les thèmes sombres sont bons (5,2 à 12,9).

### 6. Très petit téléphone — *rapide*
- À 320 px de large, avec le texte « Très grand », l'onglet « Réglages »
  est coupé (27 px de trop). Tout va bien à partir de 360 px.

### 7. Messages d'erreur manquants — *rapide*
- Si la base locale échoue, « Supprimer » une entrée du journal et
  « Exporter (CSV) » n'affichent aucun message (`afficherCrises` et
  `#btn-export-csv` dans `app.js`). C'est très rare.
- Une adresse avec un `?vue=` inconnu (par exemple
  `index.html?vue=abc`) affiche un écran vide.

### 8. Petits textes — *rapide* — ✅ *réglé en octobre 2026*
- ✅ *Réglé en octobre 2026.* Les apostrophes étaient mélangées (’ et ') :
  on le voyait par exemple sur la carte de l'écran verrouillé. Tous les
  textes affichés utilisent maintenant l'apostrophe droite (').
- ✅ *Réglé en octobre 2026.* Dans le journal, le choix « 2 h + »
  s'affichait « 2 heures ». Il s'affiche maintenant « 2 h ou plus ».
- ✅ *Réglé en octobre 2026.* `manifest.json` rangeait l'application dans
  la catégorie « medical », alors que Refuge n'est pas un dispositif
  médical. Cette catégorie est retirée ; restent « health » et
  « lifestyle ».

### 9. Garantir « rien ne sort du téléphone » par construction — *moyen*
- **Piste** : ajouter dans `index.html` une règle de sécurité (CSP,
  *Content-Security-Policy*) qui interdit au navigateur d'envoyer quoi que
  ce soit vers un autre site.
- **Attention** : il faut d'abord retirer les styles écrits directement
  dans le HTML (`style="…"`) et autoriser le petit script du `<head>`.
  Sinon, la règle bloquerait l'application elle-même.

---

## Documentation (sans effet sur l'application)

- [x] `CLAUDE.md` cite encore `refuge-v14` comme exemple de version du
      cache. La version actuelle est dans `sw.js`.
      *(corrigé en octobre 2026 : l'exemple renvoie au numéro de `sw.js`)*
- [x] `README.md` parle d'un fichier `refuge-github.zip` qui n'existe plus,
      et d'un dépôt nommé `refuge` alors que le vrai s'appelle `Refuge`.
      *(corrigé en octobre 2026, dans `GUIDE-GITHUB.md` aussi)*

---

## À savoir avant de toucher au manifest

`manifest.json` n'a pas de champ `id`. Pour Chrome, l'identité de
l'application est donc l'adresse complète de son `start_url` :
`https://ferrusdantioch.github.io/Refuge/index.html`. **Ne jamais changer
`start_url`.** Si un jour on ajoute un `id`, il doit donner exactement cette
même adresse (`"id": "/Refuge/index.html"`). Sinon, pour les téléphones où
Refuge est déjà installée, ce serait une autre application, qui ne recevrait
plus les mises à jour.
