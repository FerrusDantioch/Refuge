/* ============================================================
   REFUGE — logique de l'application
   Écrit pour être relu : chaque bloc est commenté en français.

   RÈGLE DE SILENCE : ce fichier n'appelle JAMAIS navigator.vibrate,
   ne crée JAMAIS d'objet Audio, et ne demande JAMAIS l'autorisation
   d'envoyer des notifications. L'application ne peut donc émettre
   aucun son ni aucune vibration, par construction.
   ============================================================ */

'use strict';

/* ---------- 0. Petits raccourcis ---------- */

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const racine = document.documentElement;

/* Annonce un message aux lecteurs d'écran (invisible à l'œil). */
function annoncer(texte) { $('#annonce').textContent = texte; }


/* ============================================================
   1. RÉGLAGES — conservés dans le téléphone (localStorage)
   ============================================================ */

const MESSAGE_SMS_DEFAUT =
  "Je fais une crise d'autisme, je ne peux pas parler. J'ai besoin d'aide. " +
  "Peux-tu m'appeler ou venir me rejoindre ?";

const MESSAGE_CARTE_DEFAUT =
  "Je fais une crise d'autisme, je ne peux pas parler.\n\n" +
  "Merci de me laisser de l'espace, ou d'appeler [Contact] au [Numéro].";

const REGLAGES_DEFAUT = {
  nom: '',
  tel: '',
  messageSms: MESSAGE_SMS_DEFAUT,
  messageCarte: MESSAGE_CARTE_DEFAUT,
  themeClair: false,
  bouclierAuDemarrage: false,
  ecranAllume: false,
  echelle: 1,
  aideOuvreSms: true,
  aideAfficheCarte: true,
  aideActiveBouclier: false,
  rythme: 'coherence',
  dureeRespi: 3
};

let reglages = { ...REGLAGES_DEFAUT };

function chargerReglages() {
  try {
    const brut = localStorage.getItem('refuge.reglages');
    if (brut) reglages = { ...REGLAGES_DEFAUT, ...JSON.parse(brut) };
  } catch (e) {
    /* Si la lecture échoue, on repart des valeurs par défaut :
       l'application doit toujours démarrer, quoi qu'il arrive. */
    console.warn('Réglages illisibles, valeurs par défaut utilisées.', e);
  }
}

function sauverReglages() {
  try {
    localStorage.setItem('refuge.reglages', JSON.stringify(reglages));
  } catch (e) {
    console.warn('Impossible de sauvegarder les réglages.', e);
  }
}

/* Remplace [Contact] et [Numéro] par les vraies valeurs.
   La variante sans accent est acceptée, par tolérance. */
function remplir(texte) {
  return (texte || '')
    .replaceAll('[Contact]', reglages.nom || 'mon contact')
    .replaceAll('[Numéro]', reglages.tel || '')
    .replaceAll('[Numero]', reglages.tel || '');
}


/* ============================================================
   2. THÈMES ET BOUCLIER SENSORIEL
   ============================================================ */

function appliquerTheme() {
  racine.dataset.theme = reglages.themeClair ? 'clair' : 'sombre';
  racine.style.setProperty('--echelle', reglages.echelle);
  majCouleurBarre();
}

let bouclierActif = false;

function activerBouclier(actif) {
  bouclierActif = actif;

  /* data-bouclier="on" bascule toute la palette CSS vers le noir absolu
     et met les transitions à 0 : plus aucun mouvement de couleur. */
  if (actif) racine.dataset.bouclier = 'on';
  else delete racine.dataset.bouclier;

  const btn = $('#btn-bouclier');
  btn.setAttribute('aria-pressed', String(actif));
  btn.textContent = actif ? 'Quitter le bouclier' : 'Bouclier sensoriel';

  $('#guides-bouclier').classList.toggle('masque', !actif);
  majCouleurBarre();
  annoncer(actif
    ? 'Bouclier sensoriel activé. Écran noir, application silencieuse.'
    : 'Bouclier sensoriel désactivé.');
}

/* La barre système d'Android prend la couleur du fond de l'application. */
function majCouleurBarre() {
  const c = bouclierActif ? '#000000' : (reglages.themeClair ? '#f1eee8' : '#171b21');
  const balise = document.querySelector('meta[name="theme-color"]');
  if (balise) balise.setAttribute('content', c);
}


/* ============================================================
   3. NAVIGATION ENTRE LES ONGLETS
   ============================================================ */

function allerA(nom) {
  $$('.vue').forEach((v) => {
    const actif = v.id === 'vue-' + nom;
    v.classList.toggle('active', actif);
    v.hidden = !actif;
  });
  $$('.onglet').forEach((o) => {
    o.setAttribute('aria-selected', String(o.dataset.vue === nom));
  });
  $('main').scrollTop = 0;

  /* Par respect du calme : quitter l'onglet respiration arrête la séance. */
  if (nom !== 'respiration' && respiration.enCours) respiration.arreter();
  if (nom === 'journal') afficherCrises();
}

$$('.onglet').forEach((o) => o.addEventListener('click', () => allerA(o.dataset.vue)));


/* ============================================================
   4. APPEL À L'AIDE
   ------------------------------------------------------------
   IMPORTANT — limite du web, expliquée honnêtement :
   aucune application web (PWA) ne peut envoyer un SMS toute seule
   en arrière-plan. Le navigateur l'interdit, pour éviter les abus.
   Ce que l'on peut faire, et que fait Refuge : ouvrir l'application
   SMS du téléphone avec le destinataire ET le texte déjà remplis.
   Il ne reste qu'un seul geste : appuyer sur « Envoyer ».
   ============================================================ */

function numeroPropre(tel) {
  /* On ne garde que les chiffres et un éventuel + en tête. */
  return (tel || '').replace(/[^\d+]/g, '');
}

function ouvrirSms() {
  const tel = numeroPropre(reglages.tel);
  const texte = remplir(reglages.messageSms);
  /* La forme « sms:numéro?body=texte » est celle comprise par Android. */
  const url = 'sms:' + tel + '?body=' + encodeURIComponent(texte);
  window.location.href = url;
}

/* La carte de communication a deux usages opposés, donc deux apparences :

   - « J'ai besoin d'aide » : elle est POUR VOUS. Elle affiche le message et
     les deux actions possibles, envoyer le SMS et appeler.
   - « Montrer un message » : elle est POUR LES AUTRES. Vous tendez votre
     téléphone à quelqu'un : aucune action n'y figure, personne ne peut
     déclencher un appel par mégarde. */
function afficherCarteSos(avecActions) {
  $('#sos-message').textContent = remplir(reglages.messageCarte);

  const tel = numeroPropre(reglages.tel);
  const nom = reglages.nom || 'mon contact';
  const btnEnvoi  = $('#sos-envoyer');
  const btnAppel  = $('#sos-appeler');

  const montrerEnvoi = avecActions && tel && reglages.aideOuvreSms;
  const montrerAppel = avecActions && tel;

  btnEnvoi.textContent = 'Envoyer le SMS à ' + nom;
  btnEnvoi.classList.toggle('masque', !montrerEnvoi);
  btnAppel.textContent = 'Appeler ' + nom;
  btnAppel.classList.toggle('masque', !montrerAppel);

  /* Sans numéro enregistré, on le dit ICI : le rappel de l'écran d'accueil
     serait caché derrière cette carte, donc invisible. */
  const avert = $('#sos-avertissement');
  if (avecActions && !tel) {
    avert.textContent = "Aucun contact d'urgence n'est enregistré. "
      + "Ouvrez l'onglet Réglages pour en ajouter un.";
    avert.classList.remove('masque');
  } else {
    avert.classList.add('masque');
  }

  $('#carte-sos').hidden = false;
  (montrerEnvoi ? btnEnvoi : $('#sos-fermer')).focus();
  annoncer(avecActions ? 'Message affiché, avec les actions.' : 'Message affiché en grand.');
}

/* Pourquoi l'application Messages ne s'ouvre PAS toute seule :
   Android n'autorise une application à en ouvrir une autre que dans
   l'instant qui suit l'appui du doigt. Une version précédente attendait
   400 ms pour laisser la carte s'afficher d'abord — et Android refusait
   l'ouverture, silencieusement. Un bouton explicite est non seulement
   fiable, il est aussi plus juste : vous voyez le message avant qu'il
   parte, et rien ne s'envoie sans que vous l'ayez décidé. */
$('#btn-aide').addEventListener('click', () => {
  if (reglages.aideActiveBouclier && !bouclierActif) activerBouclier(true);
  afficherCarteSos(true);
});

$('#btn-carte').addEventListener('click', () => afficherCarteSos(false));

/* L'ouverture se fait dans l'instant même de l'appui : aucune attente,
   aucun calcul avant. C'est la condition pour qu'Android l'accepte. */
$('#sos-envoyer').addEventListener('click', ouvrirSms);
$('#sos-fermer').addEventListener('click', () => {
  const carte = $('#carte-sos');
  carte.hidden = true;
  carte.classList.remove('contraste-fort');
  $('#sos-contraste').setAttribute('aria-pressed', 'false');
  $('#sos-contraste').textContent = 'Éclaircir pour le montrer';
  $('#sos-avertissement').classList.add('masque');
  $('#btn-aide').focus();
});
$('#sos-appeler').addEventListener('click', () => {
  window.location.href = 'tel:' + numeroPropre(reglages.tel);
});

/* Éclaircir la carte le temps de la montrer à quelqu'un.
   L'état revient à la normale dès que la carte est refermée : on ne
   garde jamais un écran plus lumineux que nécessaire. */
$('#sos-contraste').addEventListener('click', () => {
  const carte = $('#carte-sos');
  const fort = !carte.classList.contains('contraste-fort');
  carte.classList.toggle('contraste-fort', fort);
  const btn = $('#sos-contraste');
  btn.setAttribute('aria-pressed', String(fort));
  btn.textContent = fort ? 'Revenir au sombre' : 'Éclaircir pour le montrer';
});

$('#btn-bouclier').addEventListener('click', () => activerBouclier(!bouclierActif));
$('#btn-respirer-vite').addEventListener('click', () => {
  allerA('respiration');
  if (!respiration.enCours) respiration.demarrer();
});


/* ============================================================
   5. JOURNAL DE CRISES — base de données locale (IndexedDB)
   ------------------------------------------------------------
   IndexedDB est l'« armoire à dossiers » du navigateur : elle vit
   sur le téléphone, hors ligne, et rien n'en sort jamais.
   ============================================================ */

const BDD = {
  base: null,

  ouvrir() {
    return new Promise((resoudre, rejeter) => {
      const demande = indexedDB.open('refuge', 1);
      demande.onupgradeneeded = () => {
        const b = demande.result;
        if (!b.objectStoreNames.contains('crises')) {
          const magasin = b.createObjectStore('crises', { keyPath: 'id', autoIncrement: true });
          magasin.createIndex('parDate', 'ts');
        }
      };
      demande.onsuccess = () => { BDD.base = demande.result; resoudre(BDD.base); };
      demande.onerror = () => rejeter(demande.error);
    });
  },

  operation(mode, action) {
    return new Promise((resoudre, rejeter) => {
      const t = BDD.base.transaction('crises', mode);
      const r = action(t.objectStore('crises'));
      t.oncomplete = () => resoudre(r && r.result);
      t.onerror = () => rejeter(t.error);
    });
  },

  ajouter(entree) { return BDD.operation('readwrite', (m) => m.add(entree)); },
  supprimer(id)   { return BDD.operation('readwrite', (m) => m.delete(id)); },
  tout()          { return BDD.operation('readonly',  (m) => m.getAll()); }
};

/* --- État du formulaire d'ajout --- */
const brouillon = { duree: null, intensite: null, declencheurs: [] };

/* Gère les groupes de boutons à choix unique (durée, intensité). */
function choixUnique(idGroupe, surChoix) {
  $$('#' + idGroupe + ' button').forEach((b) => {
    b.addEventListener('click', () => {
      $$('#' + idGroupe + ' button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      surChoix(b);
    });
  });
}

/* Gère le groupe à choix multiples (déclencheurs). */
function choixMultiple(idGroupe, surChoix) {
  $$('#' + idGroupe + ' button').forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const nouveau = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(nouveau));
      surChoix();
    });
  });
}

choixUnique('f-duree',     (b) => { brouillon.duree = Number(b.dataset.val); });
choixUnique('f-intensite', (b) => { brouillon.intensite = Number(b.dataset.val); });
choixMultiple('f-declencheurs', () => {
  brouillon.declencheurs = $$('#f-declencheurs button[aria-pressed="true"]')
    .map((b) => b.dataset.val);
});

/* Renvoie la date du jour au format attendu par le champ datetime-local. */
function maintenantLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function ouvrirFormulaire(ouvert) {
  $('#form-crise').classList.toggle('masque', !ouvert);
  $('#btn-nouvelle').classList.toggle('masque', ouvert);
  if (ouvert) {
    $('#f-date').value = maintenantLocal();
    $('#f-date').focus();
  }
}

$('#btn-nouvelle').addEventListener('click', () => ouvrirFormulaire(true));
$('#btn-annuler').addEventListener('click', () => ouvrirFormulaire(false));

$('#form-crise').addEventListener('submit', async (e) => {
  e.preventDefault();
  const entree = {
    ts: new Date($('#f-date').value || maintenantLocal()).getTime(),
    duree: brouillon.duree,
    intensite: brouillon.intensite,
    declencheurs: brouillon.declencheurs.slice(),
    note: $('#f-note').value.trim()
  };
  try {
    await BDD.ajouter(entree);
    /* Remise à zéro du formulaire pour la prochaine fois. */
    brouillon.duree = null; brouillon.intensite = null; brouillon.declencheurs = [];
    $$('#f-duree button, #f-intensite button, #f-declencheurs button')
      .forEach((b) => b.setAttribute('aria-pressed', 'false'));
    $('#f-note').value = '';
    ouvrirFormulaire(false);
    afficherCrises();
    annoncer('Entrée enregistrée.');
  } catch (err) {
    annoncer("L'enregistrement a échoué.");
    console.error(err);
  }
});

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

function texteDuree(min) {
  if (!min) return null;
  if (min < 60) return min + ' min';
  return (min / 60) + (min === 60 ? ' heure' : ' heures');
}

async function afficherCrises() {
  let liste = [];
  try { liste = await BDD.tout(); } catch (e) { console.error(e); }
  liste.sort((a, b) => b.ts - a.ts);   /* la plus récente en premier */

  const conteneur = $('#liste-crises');
  $('#outils-journal').classList.toggle('masque', liste.length === 0);

  if (liste.length === 0) {
    conteneur.innerHTML =
      '<p class="vide">Aucune entrée pour l\'instant.<br>' +
      'Rien ne presse : notez seulement quand vous en avez l\'énergie.</p>';
    return;
  }

  conteneur.innerHTML = '';
  liste.forEach((c) => {
    const bloc = document.createElement('article');
    bloc.className = 'entree';

    const haut = document.createElement('div');
    haut.className = 'haut';
    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = FORMAT_DATE.format(new Date(c.ts));
    haut.appendChild(date);

    if (c.intensite) {
      const jauge = document.createElement('span');
      jauge.className = 'jauge';
      jauge.setAttribute('role', 'img');
      jauge.setAttribute('aria-label', 'Intensité ' + c.intensite + ' sur 5');
      for (let i = 1; i <= 5; i++) {
        const p = document.createElement('i');
        if (i <= c.intensite) p.className = 'plein';
        jauge.appendChild(p);
      }
      haut.appendChild(jauge);
    }
    bloc.appendChild(haut);

    const infos = [texteDuree(c.duree), (c.declencheurs || []).join(', ')]
      .filter(Boolean).join(' — ');
    if (infos) {
      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = infos;
      bloc.appendChild(meta);
    }
    if (c.note) {
      const note = document.createElement('p');
      note.className = 'meta';
      note.textContent = c.note;
      bloc.appendChild(note);
    }

    const sup = document.createElement('button');
    sup.type = 'button';
    sup.className = 'supprimer';
    sup.textContent = 'Supprimer';
    sup.setAttribute('aria-label', "Supprimer l'entrée du " + FORMAT_DATE.format(new Date(c.ts)));
    /* Deux appuis volontaires : on ne supprime jamais par accident,
       et on n'utilise pas de fenêtre de confirmation (elle bloque tout). */
    let arme = false;
    sup.addEventListener('click', async () => {
      if (!arme) {
        arme = true;
        sup.textContent = 'Confirmer la suppression';
        setTimeout(() => { arme = false; sup.textContent = 'Supprimer'; }, 4000);
        return;
      }
      await BDD.supprimer(c.id);
      afficherCrises();
      annoncer('Entrée supprimée.');
    });
    bloc.appendChild(sup);

    conteneur.appendChild(bloc);
  });
}

/* --- Export des données --- */

function telecharger(nomFichier, contenu, type) {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nomFichier;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
}

$('#btn-export-csv').addEventListener('click', async () => {
  const liste = (await BDD.tout()).sort((a, b) => a.ts - b.ts);
  const lignes = [['Date', 'Durée (min)', 'Intensité (1-5)', 'Déclencheurs', 'Note']];
  liste.forEach((c) => lignes.push([
    new Date(c.ts).toLocaleString('fr-FR'),
    c.duree || '', c.intensite || '',
    (c.declencheurs || []).join(' / '),
    (c.note || '').replace(/\n/g, ' ')
  ]));
  /* Le caractère invisible en tête (BOM) indique à Excel que le fichier
     est en UTF-8 : sans lui, les accents s'affichent de travers. */
  const csv = '﻿' + lignes
    .map((l) => l.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(';'))
    .join('\n');
  telecharger('journal-refuge.csv', csv, 'text/csv;charset=utf-8');
});

$('#btn-export-json').addEventListener('click', async () => {
  const donnees = { version: 1, exporte: new Date().toISOString(), crises: await BDD.tout() };
  telecharger('sauvegarde-refuge.json', JSON.stringify(donnees, null, 2), 'application/json');
});


/* ============================================================
   6. RESPIRATION GUIDÉE
   ============================================================ */

const RYTHMES = {
  coherence: {
    nom: 'Cohérence 5-5',
    description: "Inspirer 5 secondes, expirer 5 secondes. Le rythme de la cohérence " +
                 "cardiaque : c'est celui qui apaise le plus vite le système nerveux.",
    phases: [
      { texte: 'Inspirez',   duree: 5, vers: 1    },
      { texte: 'Expirez',    duree: 5, vers: 0.45 }
    ]
  },
  apaisant: {
    nom: 'Apaisant 4-7-8',
    description: "Inspirer 4 secondes, retenir 7, expirer 8. L'expiration longue " +
                 "envoie au corps un signal de sécurité. Idéal pour redescendre.",
    phases: [
      { texte: 'Inspirez',   duree: 4, vers: 1    },
      { texte: 'Retenez',    duree: 7, vers: 1    },
      { texte: 'Expirez',    duree: 8, vers: 0.45 }
    ]
  },
  carre: {
    nom: 'Carré 4-4-4-4',
    description: "Quatre temps égaux de 4 secondes. Très prévisible : rien ne " +
                 "surprend, ce qui aide quand l'imprévu est justement le problème.",
    phases: [
      { texte: 'Inspirez',   duree: 4, vers: 1    },
      { texte: 'Retenez',    duree: 4, vers: 1    },
      { texte: 'Expirez',    duree: 4, vers: 0.45 },
      { texte: 'Pause',      duree: 4, vers: 0.45 }
    ]
  }
};

const respiration = {
  enCours: false,
  indexPhase: 0,
  minuteur: null,
  tictac: null,
  animation: null,
  finPrevue: 0,
  finPhase: 0,
  echelleActuelle: 0.45,

  demarrer() {
    this.enCours = true;
    this.indexPhase = 0;
    $('#btn-respi').textContent = 'Arrêter';

    const minutes = reglages.dureeRespi;
    this.finPrevue = minutes > 0 ? Date.now() + minutes * 60000 : 0;

    this.jouerPhase();
    /* Un seul minuteur pour tout l'affichage : moins de travail
       pour le téléphone, donc moins de chauffe et moins de batterie. */
    this.tictac = setInterval(() => this.rafraichir(), 250);
    annoncer('Séance de respiration commencée.');
  },

  jouerPhase() {
    const phases = RYTHMES[reglages.rythme].phases;
    const phase = phases[this.indexPhase % phases.length];

    $('#consigne').textContent = phase.texte;
    this.finPhase = Date.now() + phase.duree * 1000;

    /* L'animation du cercle : un mouvement unique, lent et régulier.
       Aucun rebond, aucune accélération brusque. */
    const cercle = $('#cercle');
    if (this.animation) this.animation.cancel();
    this.animation = cercle.animate(
      [{ transform: 'scale(' + this.echelleActuelle + ')' },
       { transform: 'scale(' + phase.vers + ')' }],
      { duration: phase.duree * 1000, easing: 'ease-in-out', fill: 'forwards' }
    );
    this.echelleActuelle = phase.vers;

    this.minuteur = setTimeout(() => {
      if (!this.enCours) return;
      this.indexPhase++;
      if (this.finPrevue && Date.now() >= this.finPrevue) return this.terminer();
      this.jouerPhase();
    }, phase.duree * 1000);
  },

  rafraichir() {
    const restePhase = Math.max(0, Math.ceil((this.finPhase - Date.now()) / 1000));
    let texte = String(restePhase);
    if (this.finPrevue) {
      const total = Math.max(0, Math.ceil((this.finPrevue - Date.now()) / 1000));
      const m = Math.floor(total / 60), s = total % 60;
      texte += '   ·   ' + m + ':' + String(s).padStart(2, '0') + ' restantes';
    }
    $('#compteur').textContent = texte;
  },

  terminer() {
    this.arreter();
    $('#consigne').textContent = "C'est fini. Bravo.";
    $('#compteur').innerHTML = '&nbsp;';
    annoncer('Séance terminée.');
  },

  arreter() {
    this.enCours = false;
    clearTimeout(this.minuteur);
    clearInterval(this.tictac);
    if (this.animation) {
      /* Retour doux à la taille de repos, jamais un saut brutal. */
      this.animation.cancel();
      $('#cercle').animate(
        [{ transform: 'scale(' + this.echelleActuelle + ')' }, { transform: 'scale(0.45)' }],
        { duration: 1200, easing: 'ease-in-out', fill: 'forwards' }
      );
      this.echelleActuelle = 0.45;
    }
    $('#btn-respi').textContent = 'Commencer';
    $('#consigne').textContent = 'Quand vous voulez';
    $('#compteur').innerHTML = '&nbsp;';
  }
};

$('#btn-respi').addEventListener('click', () => {
  respiration.enCours ? respiration.arreter() : respiration.demarrer();
});

choixUnique('choix-rythme', (b) => {
  reglages.rythme = b.dataset.preset;
  $('#desc-rythme').innerHTML = '<small>' + RYTHMES[reglages.rythme].description + '</small>';
  sauverReglages();
  if (respiration.enCours) { respiration.arreter(); respiration.demarrer(); }
});

choixUnique('choix-duree', (b) => {
  reglages.dureeRespi = Number(b.dataset.min);
  sauverReglages();
  if (respiration.enCours) { respiration.arreter(); respiration.demarrer(); }
});

/* Si l'application passe en arrière-plan, on met la séance en pause :
   inutile de faire tourner une animation que personne ne regarde. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && respiration.enCours) respiration.arreter();
});


/* ============================================================
   7. GARDER L'ÉCRAN ALLUMÉ (Wake Lock)
   ============================================================ */

let verrouEcran = null;

async function majVerrouEcran() {
  try {
    if (reglages.ecranAllume && !verrouEcran && 'wakeLock' in navigator) {
      verrouEcran = await navigator.wakeLock.request('screen');
      verrouEcran.addEventListener('release', () => { verrouEcran = null; });
    } else if (!reglages.ecranAllume && verrouEcran) {
      await verrouEcran.release();
      verrouEcran = null;
    }
  } catch (e) {
    /* Non pris en charge ou refusé : ce n'est pas grave, on continue. */
    console.warn("Verrou d'écran indisponible.", e);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) majVerrouEcran();
});


/* ============================================================
   8. ÉCRAN DES RÉGLAGES
   ============================================================ */

function lierTexte(idChamp, cle) {
  const champ = $(idChamp);
  champ.value = reglages[cle];
  champ.addEventListener('input', () => {
    reglages[cle] = champ.value;
    sauverReglages();
    majBoutonAide();
  });
}

function lierCase(idChamp, cle, apres) {
  const champ = $(idChamp);
  champ.checked = !!reglages[cle];
  champ.addEventListener('change', () => {
    reglages[cle] = champ.checked;
    sauverReglages();
    if (apres) apres();
  });
}

function majBoutonAide() {
  $('#btn-aide-sous').textContent = reglages.nom
    ? 'Prévenir ' + reglages.nom
    : 'Prévenir mon contact';
  $('#rappel-reglages').classList.toggle('masque', !!numeroPropre(reglages.tel));
}

function initReglages() {
  lierTexte('#r-nom', 'nom');
  lierTexte('#r-tel', 'tel');
  lierTexte('#r-message', 'messageSms');
  lierTexte('#r-carte', 'messageCarte');

  lierCase('#r-theme-clair', 'themeClair', appliquerTheme);
  lierCase('#r-bouclier-demarrage', 'bouclierAuDemarrage');
  lierCase('#r-ecran-allume', 'ecranAllume', majVerrouEcran);
  lierCase('#r-ouvrir-sms', 'aideOuvreSms');
  lierCase('#r-afficher-carte', 'aideAfficheCarte');
  lierCase('#r-bouclier-auto', 'aideActiveBouclier');

  choixUnique('choix-taille', (b) => {
    reglages.echelle = Number(b.dataset.echelle);
    sauverReglages();
    appliquerTheme();
  });

  $('#btn-defaut-message').addEventListener('click', () => {
    reglages.messageSms = MESSAGE_SMS_DEFAUT;
    reglages.messageCarte = MESSAGE_CARTE_DEFAUT;
    $('#r-message').value = MESSAGE_SMS_DEFAUT;
    $('#r-carte').value = MESSAGE_CARTE_DEFAUT;
    sauverReglages();
    annoncer("Textes d'origine rétablis.");
  });

  /* --- Pourquoi il n'y a pas de bouton « choisir dans mes contacts » ---
     Le web sait demander à Android d'ouvrir la liste des contacts
     (Contact Picker API). Testé sur Redmi / HyperOS : le système rejette la
     demande sans explication, quoi que fasse le code. Un raccourci qui
     échoue une fois sur deux n'a pas sa place dans un outil de crise, et la
     saisie à la main ne prend que trente secondes, une seule fois.
     Le bouton reste dans index.html, masqué : si un jour vous changez de
     téléphone, il suffira de rétablir ce bloc pour le réactiver. */

  /* On coche les boutons correspondant aux valeurs enregistrées. */
  const marquer = (groupe, attribut, valeur) => {
    $$('#' + groupe + ' button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset[attribut] == valeur));
    });
  };
  marquer('choix-taille', 'echelle', reglages.echelle);
  marquer('choix-rythme', 'preset', reglages.rythme);
  marquer('choix-duree', 'min', reglages.dureeRespi);
  $('#desc-rythme').innerHTML = '<small>' + RYTHMES[reglages.rythme].description + '</small>';
}


/* ============================================================
   9. DÉMARRAGE
   ============================================================ */

async function demarrer() {
  chargerReglages();
  appliquerTheme();
  initReglages();
  majBoutonAide();

  try { await BDD.ouvrir(); } catch (e) { console.error('Base locale indisponible.', e); }

  /* Raccourcis de l'écran d'accueil : ?mode=bouclier, ?vue=respiration */
  const params = new URLSearchParams(location.search);
  if (reglages.bouclierAuDemarrage || params.get('mode') === 'bouclier') activerBouclier(true);
  if (params.get('vue')) allerA(params.get('vue'));

  majVerrouEcran();

  /* Installation du service worker : c'est lui qui rend l'application
     utilisable sans connexion. */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .catch((e) => console.warn('Mode hors-ligne indisponible.', e));
  }
}

demarrer();
