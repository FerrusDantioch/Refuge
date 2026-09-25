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
  "Peux-tu m'appeler ou venir me rejoindre ?\n\n[Position]";

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
  aideJointPosition: false,   /* éteint par défaut : voir section POSITION */
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
   La variante sans accent est acceptée, par tolérance.
   [Position] est traité en amont par corpsSms() ; ici on le retire, pour
   qu'un jeton écrit par erreur dans le message affiché aux gens autour
   n'apparaisse jamais tel quel à l'écran. */
function remplir(texte) {
  return (texte || '')
    .replaceAll('[Contact]', reglages.nom || 'mon contact')
    .replaceAll('[Numéro]', reglages.tel || '')
    .replaceAll('[Numero]', reglages.tel || '')
    .replaceAll('[Position]', '');
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

  /* Les liens apaisants disparaissent en bouclier — bouton compris.
     Le bouclier, c'est le silence total : aucune playlist, aucune vidéo,
     rien à choisir. L'écran se referme s'il était ouvert. */
  $$('.entree-liens').forEach((b) => b.classList.toggle('masque', actif));
  if (actif && !$('#ecran-liens').hidden) ouvrirEcranLiens(false);

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

/* ------------------------------------------------------------
   POSITION — joindre un point de repère au SMS
   ------------------------------------------------------------
   Deux règles non négociables, pour les mêmes raisons que le reste
   de cette application :

   1. L'autorisation de localisation n'est JAMAIS demandée pendant une
      crise. Une boîte de dialogue système qui surgit, du texte à lire,
      un appui de travers sur « Bloquer » — et la fonction est morte pour
      de bon, avec un réglage de navigateur introuvable pour la rallumer.
      Elle se demande donc à froid, depuis l'onglet Réglages. Si elle
      n'est pas déjà accordée au moment de la crise, on renonce en
      silence : un SMS sans position vaut mieux qu'une fenêtre de plus.

   2. Le SMS n'attend JAMAIS la position. La recherche démarre à
      l'ouverture de la carte ; si le point n'est pas arrivé quand le
      doigt touche « Envoyer », le message part sans lui. C'est aussi ce
      qui garde ouvrirSms() strictement synchrone — condition pour
      qu'Android accepte d'ouvrir Messages (voir le commentaire plus bas).

   Rien ne quitte l'appareil ici : les coordonnées vont dans le champ
   texte de l'application Messages, et c'est un humain qui appuie sur
   Envoyer. Android, lui, peut interroger le réseau pour se situer par le
   Wi-Fi : c'est le système qui le fait, comme pour n'importe quelle
   application qui demande une position — jamais Refuge.
   ------------------------------------------------------------ */

const HEURE_COURTE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

const position = {
  etat: 'inactif',   /* inactif | recherche | trouvee | echec | nonAutorisee */
  point: null,       /* { lat, lon, precision, ts } */
  veille: null,      /* identifiant rendu par watchPosition */
  retiree: false,    /* la personne a retiré sa position pour cette fois-ci */

  disponible() { return 'geolocation' in navigator; },

  /* 'granted' | 'denied' | 'prompt' | 'inconnu' — sans jamais rien demander. */
  async etatAutorisation() {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        return (await navigator.permissions.query({ name: 'geolocation' })).state;
      }
    } catch (e) { /* Interrogation impossible : on le dira 'inconnu'. */ }
    return 'inconnu';
  },

  demarrer() {
    if (!reglages.aideJointPosition || !this.disponible()) return;
    this.retiree = false;
    this.etat = 'recherche';
    majLignePosition();

    this.etatAutorisation().then((autorisation) => {
      if (autorisation === 'prompt') {
        /* Jamais accordée : on ne la demande pas maintenant. Règle 1. */
        this.etat = 'nonAutorisee';
        majLignePosition();
        return;
      }

      /* Premier appel : on accepte volontiers un point que le téléphone a
         déjà en mémoire (maximumAge), donc souvent immédiat. */
      navigator.geolocation.getCurrentPosition(
        (p) => this.retenir(p),
        (err) => {
          if (this.etat === 'trouvee') return;   /* la veille a déjà réussi */
          this.etat = (err && err.code === err.PERMISSION_DENIED)
            ? 'nonAutorisee' : 'echec';
          majLignePosition();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 }
      );

      /* Puis on affine tant que la carte reste ouverte : en intérieur, le
         premier point est souvent grossier de plusieurs centaines de mètres. */
      try {
        this.veille = navigator.geolocation.watchPosition(
          (p) => this.retenir(p),
          () => { /* un échec de la veille ne change rien : on garde le point */ },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      } catch (e) {
        console.warn('Suivi de position indisponible.', e);
      }
    });
  },

  retenir(p) {
    const nouveau = {
      lat: p.coords.latitude,
      lon: p.coords.longitude,
      precision: p.coords.accuracy,
      ts: p.timestamp || Date.now()
    };
    /* On ne remplace un point que par un point au moins aussi précis :
       l'imprécision annoncée ne doit jamais augmenter en cours de route. */
    if (!this.point || nouveau.precision <= this.point.precision) this.point = nouveau;
    this.etat = 'trouvee';
    majLignePosition();
  },

  /* Coupe le GPS sans oublier le point déjà trouvé : appelé quand
     l'application passe en arrière-plan (batterie). */
  arreterVeille() {
    if (this.veille !== null) {
      navigator.geolocation.clearWatch(this.veille);
      this.veille = null;
    }
  },

  /* Remise à zéro complète, à la fermeture de la carte. Un point gardé
     d'une crise à l'autre enverrait un jour le contact au mauvais endroit. */
  oublier() {
    this.arreterVeille();
    this.point = null;
    this.etat = 'inactif';
    this.retiree = false;
  }
};

/* Le texte joint au SMS. Lien OpenStreetMap : pas de compte, pas de
   traceur, et il s'ouvre dans n'importe quel navigateur. Le niveau de
   zoom suit la précision réelle — inutile de faire croire au mètre près
   quand le point vaut 500 m. La précision et l'heure du relevé sont
   écrites en clair : un contact qui cherche doit savoir à quel point il
   peut se fier à ce qu'il lit. */
function blocPosition() {
  if (!reglages.aideJointPosition || position.retiree || !position.point) return '';
  const p = position.point;
  const lat = p.lat.toFixed(5);
  const lon = p.lon.toFixed(5);
  const m = Math.round(p.precision);
  const zoom = m <= 50 ? 18 : m <= 200 ? 17 : m <= 1000 ? 15 : 13;
  return 'Ma position (à ~' + m + ' m près, relevée à '
    + HEURE_COURTE.format(new Date(p.ts)) + ') :\n'
    + 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon
    + '#map=' + zoom + '/' + lat + '/' + lon;
}

/* Assemble le texte du SMS. Purement synchrone : aucun calcul lent,
   aucune attente — voir la règle 2 ci-dessus. */
function corpsSms() {
  const bloc = blocPosition();
  let texte = reglages.messageSms || '';
  /* Le jeton [Position] dit OÙ placer le point de repère. S'il manque —
     message personnalisé écrit avant l'arrivée de cette fonction — on
     ajoute le bloc à la fin, plutôt que de ne rien joindre du tout. */
  if (texte.includes('[Position]')) texte = texte.replaceAll('[Position]', bloc);
  else if (bloc) texte = texte.trimEnd() + '\n\n' + bloc;
  return remplir(texte).replace(/\n{3,}/g, '\n\n').trim();
}

function ouvrirSms() {
  const tel = numeroPropre(reglages.tel);
  /* La forme « sms:numéro?body=texte » est celle comprise par Android. */
  const url = 'sms:' + tel + '?body=' + encodeURIComponent(corpsSms());
  window.location.href = url;
}

/* La ligne de transparence, sur la carte : la personne voit ce qui va
   partir avec son message, et peut retirer sa position d'un seul appui.
   Elle n'est pas là par formalisme — pendant un shutdown, on veut
   parfois précisément ne PAS être trouvé. Le geste est réversible dans
   les deux sens : rien n'est définitif. */
function majLignePosition() {
  const ligne = $('#sos-position');
  const btn   = $('#sos-position-retirer');

  /* Cette ligne n'a de sens que sur une carte ouverte qui propose
     vraiment d'envoyer un SMS. Ailleurs, elle parlerait de rien. */
  const pertinent = reglages.aideJointPosition
    && !$('#carte-sos').hidden
    && !$('#sos-envoyer').classList.contains('masque');

  ligne.classList.toggle('masque', !pertinent);
  if (!pertinent) return;

  let texte;
  if (position.retiree) {
    texte = 'Position retirée. Le SMS partira sans elle.';
  } else if (position.etat === 'trouvee') {
    texte = 'Ta position sera jointe au SMS, à ~'
      + Math.round(position.point.precision) + ' m près.';
  } else if (position.etat === 'recherche') {
    texte = 'Recherche de ta position… elle sera jointe si elle arrive à temps.';
  } else if (position.etat === 'nonAutorisee') {
    texte = "La localisation n'est pas autorisée pour Refuge. "
      + 'Le SMS partira sans position.';
  } else {
    texte = 'Position introuvable. Le SMS partira sans elle.';
  }
  $('#sos-position-texte').textContent = texte;

  /* Le bouton n'apparaît que s'il y a quelque chose à retirer — ou à remettre. */
  const utile = position.retiree
    || position.etat === 'trouvee' || position.etat === 'recherche';
  btn.classList.toggle('masque', !utile);
  btn.textContent = position.retiree
    ? 'Joindre ma position' : 'Ne pas joindre ma position';
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

  /* La recherche de position démarre ICI, au premier geste — pas au moment
     d'envoyer. C'est tout l'intérêt de la carte en deux temps : le point a
     le temps d'arriver pendant que la personne lit son message, et l'envoi
     du SMS n'attend rien. Après l'affichage de la carte, car la ligne de
     transparence ne s'affiche que sur une carte ouverte. */
  if (montrerEnvoi) position.demarrer(); else position.oublier();
  majLignePosition();

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
  /* On coupe le GPS et on oublie le point : il ne doit pas resservir
     lors d'une prochaine crise, ailleurs. */
  position.oublier();
  majLignePosition();
  $('#btn-aide').focus();
});

/* Retirer ou remettre sa position, tant que la carte est ouverte. */
$('#sos-position-retirer').addEventListener('click', () => {
  position.retiree = !position.retiree;
  majLignePosition();
  annoncer(position.retiree
    ? 'Position retirée du message.'
    : 'Position jointe au message.');
});

/* Quand l'application passe en arrière-plan — typiquement parce que
   Messages vient de s'ouvrir — on coupe le GPS. Le texte du SMS est déjà
   composé : garder le GPS allumé ne chaufferait le téléphone pour rien.
   Le dernier point trouvé est conservé, au cas où la personne revienne. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) position.arreterVeille();
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
   4 bis. NUMÉROS D'URGENCE
   ------------------------------------------------------------
   Ce n'est pas un clavier d'urgence, c'est de quoi savoir à
   l'avance. Le besoin d'anticipation est fort : connaître déjà qui
   répond, ce qu'on vous demandera et si c'est gratuit enlève une
   inconnue le jour où ça compte. D'où le texte qui accompagne
   chaque numéro plutôt qu'une simple liste de chiffres.

   Appeler demande DEUX appuis, comme la suppression dans le
   journal : on ne joint jamais les secours par mégarde, surtout
   quand la motricité fine s'est dégradée.
   ============================================================ */

let ouvreurUrgences = null;   /* le bouton par lequel on est entré */
let minuteurUrgences = null;

/* Remet tous les boutons d'appel au repos. */
function desarmerUrgences() {
  clearTimeout(minuteurUrgences);
  $$('#carte-urgences button[data-appel]').forEach((b) => {
    b.classList.remove('arme');
    b.textContent = 'Appeler le ' + b.dataset.appel;
  });
}

function ouvrirUrgences(ouvert, depuis) {
  const carte = $('#carte-urgences');
  carte.hidden = !ouvert;
  if (ouvert) {
    ouvreurUrgences = depuis;
    /* On donne le focus à la carte elle-même, pas au bouton « Fermer » :
       celui-ci est tout en bas, et le focus l'aurait fait défiler jusqu'à
       lui — on ouvrait la liste par la fin. preventScroll pour la même
       raison. Le 114 doit être la première chose que l'on voit. */
    carte.focus({ preventScroll: true });
    carte.scrollTop = 0;
    annoncer("Numéros d'urgence.");
  } else {
    desarmerUrgences();
    if (ouvreurUrgences) ouvreurUrgences.focus();
  }
}

$('#btn-urgences').addEventListener('click', (e) => ouvrirUrgences(true, e.currentTarget));
$('#btn-urgences-reglages').addEventListener('click', (e) => ouvrirUrgences(true, e.currentTarget));
$('#urgences-fermer').addEventListener('click', () => ouvrirUrgences(false));

/* Le 114 s'écrit, il ne s'appelle pas : c'est précisément son intérêt
   pour quelqu'un qui ne peut pas parler. Un seul appui suffit donc —
   ouvrir Messages n'engage rien, le texte reste à écrire et à envoyer. */
$$('#carte-urgences button[data-sms]').forEach((b) => {
  b.addEventListener('click', () => {
    window.location.href = 'sms:' + b.dataset.sms;
  });
});

$$('#carte-urgences button[data-appel]').forEach((b) => {
  b.addEventListener('click', () => {
    if (!b.classList.contains('arme')) {
      desarmerUrgences();                  /* un seul bouton armé à la fois */
      b.classList.add('arme');
      b.textContent = "Confirmer l'appel au " + b.dataset.appel;
      minuteurUrgences = setTimeout(desarmerUrgences, 5000);
      return;
    }
    window.location.href = 'tel:' + b.dataset.appel;
  });
});


/* ============================================================
   5. JOURNAL DE CRISES — base de données locale (IndexedDB)
   ------------------------------------------------------------
   IndexedDB est l'« armoire à dossiers » du navigateur : elle vit
   sur le téléphone, hors ligne, et rien n'en sort jamais.
   ============================================================ */

const BDD = {
  base: null,

  /* ------------------------------------------------------------
     MIGRATION v1 → v2, sans perte de données
     ------------------------------------------------------------
     IndexedDB fonctionne par numéro de version. La v1 de Refuge ne
     connaissait qu'un seul tiroir : « crises ». La v2 en ajoute deux,
     « protocole » et « liens ».

     La règle d'or est ici : on n'ouvre JAMAIS un tiroir existant pour
     le recréer. onupgradeneeded ne crée que ce qui manque
     (objectStoreNames.contains). Un journal écrit avec la v1 est donc
     retrouvé intact après la mise à jour — le navigateur se contente
     d'ajouter les deux tiroirs vides à côté.

     Conséquence pratique : si vous ajoutez un jour un troisième tiroir,
     montez VERSION_BDD d'un cran et ajoutez un bloc « if (!contains) »
     ci-dessous. Ne touchez pas aux blocs déjà écrits.
     ------------------------------------------------------------ */

  ouvrir() {
    return new Promise((resoudre, rejeter) => {
      const demande = indexedDB.open('refuge', 2);

      demande.onupgradeneeded = () => {
        const b = demande.result;

        /* v1 — le journal de crises. Recréé seulement s'il n'existe pas
           (première installation) : sinon, on n'y touche pas. */
        if (!b.objectStoreNames.contains('crises')) {
          const magasin = b.createObjectStore('crises', { keyPath: 'id', autoIncrement: true });
          magasin.createIndex('parDate', 'ts');
        }

        /* v2 — le protocole. Un seul enregistrement, rangé sous la clé
           'moi' : pas de keyPath, la clé est donnée à l'écriture. */
        if (!b.objectStoreNames.contains('protocole')) {
          b.createObjectStore('protocole');
        }

        /* v2 — les liens apaisants, numérotés automatiquement. */
        if (!b.objectStoreNames.contains('liens')) {
          b.createObjectStore('liens', { keyPath: 'id', autoIncrement: true });
        }
      };

      /* Un autre onglet de Refuge, resté ouvert sur l'ancienne version,
         peut bloquer la mise à jour. On le dit clairement plutôt que
         d'attendre sans fin. */
      demande.onblocked = () => {
        console.warn('Mise à jour de la base bloquée : fermez les autres onglets de Refuge.');
      };

      demande.onsuccess = () => { BDD.base = demande.result; resoudre(BDD.base); };
      demande.onerror = () => rejeter(demande.error);
    });
  },

  /* Une seule petite mécanique pour tous les tiroirs. Si la base n'a pas
     pu s'ouvrir, on rejette proprement : l'appelant affiche un message
     plutôt que de planter. */
  operation(tiroir, mode, action) {
    return new Promise((resoudre, rejeter) => {
      if (!BDD.base) { rejeter(new Error('Base locale indisponible')); return; }
      try {
        const t = BDD.base.transaction(tiroir, mode);
        const r = action(t.objectStore(tiroir));
        t.oncomplete = () => resoudre(r && r.result);
        t.onerror = () => rejeter(t.error);
      } catch (e) { rejeter(e); }
    });
  },

  /* --- Journal de crises (inchangé depuis la v1) --- */
  ajouter(entree) { return BDD.operation('crises', 'readwrite', (m) => m.add(entree)); },
  supprimer(id)   { return BDD.operation('crises', 'readwrite', (m) => m.delete(id)); },
  tout()          { return BDD.operation('crises', 'readonly',  (m) => m.getAll()); },

  /* --- Protocole : un unique enregistrement --- */
  lireProtocole()      { return BDD.operation('protocole', 'readonly',  (m) => m.get('moi')); },
  ecrireProtocole(val) { return BDD.operation('protocole', 'readwrite', (m) => m.put(val, 'moi')); },

  /* --- Liens apaisants --- */
  liensTout()        { return BDD.operation('liens', 'readonly',  (m) => m.getAll()); },
  liensAjouter(l)    { return BDD.operation('liens', 'readwrite', (m) => m.add(l)); },
  liensSupprimer(id) { return BDD.operation('liens', 'readwrite', (m) => m.delete(id)); }
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

/* La sauvegarde complète (journal, protocole, liens, réglages) est
   fabriquée par enregistrerSauvegarde(), section 12 : le même fichier
   que le bouton des Réglages. */
$('#btn-export-json').addEventListener('click', enregistrerSauvegarde);


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

/* --- Position : réglage, et test à tête reposée ---
   C'est ce bouton « Tester » qui fait apparaître la demande
   d'autorisation Android. C'est voulu : elle doit surgir maintenant,
   dans le calme, et jamais pendant une crise. */

function majEtatPosition(texte) {
  $('#r-position-etat').innerHTML = '<small>' + texte + '</small>';
}

function afficherEtatPosition() {
  if (!position.disponible()) {
    majEtatPosition('Ce téléphone ne permet pas à Refuge de connaître sa '
      + 'position : la fonction est indisponible.');
    return;
  }
  if (!reglages.aideJointPosition) {
    majEtatPosition('Éteint : aucune position ne sera jointe à vos SMS.');
    return;
  }
  position.etatAutorisation().then((autorisation) => {
    if (autorisation === 'granted') {
      majEtatPosition('Autorisation accordée. Tout est prêt.');
    } else if (autorisation === 'denied') {
      majEtatPosition("La localisation est refusée à Refuge : rien ne sera "
        + "joint. Autorisez-la dans les réglages du téléphone (application "
        + "Refuge, ou Chrome / votre navigateur), puis touchez « Tester ma "
        + "position ».");
    } else {
      majEtatPosition("Autorisation pas encore accordée. Touchez « Tester ma "
        + "position » : c'est le bon moment pour le faire, au calme.");
    }
  });
}

function testerPosition() {
  if (!position.disponible()) { afficherEtatPosition(); return; }

  majEtatPosition('Recherche en cours…');
  annoncer('Recherche de la position.');

  navigator.geolocation.getCurrentPosition(
    (p) => {
      majEtatPosition('Autorisation accordée. Point trouvé à ~'
        + Math.round(p.coords.accuracy) + ' m près, à '
        + HEURE_COURTE.format(new Date(p.timestamp || Date.now())) + '.');
      annoncer('Position trouvée.');
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        /* Refus franc : on éteint l'interrupteur. Un réglage qui a l'air
           actif sans l'être serait un mensonge, et se découvrirait au
           pire moment possible. */
        reglages.aideJointPosition = false;
        $('#r-position').checked = false;
        sauverReglages();
        majEtatPosition("Autorisation refusée : la fonction vient d'être "
          + "éteinte. Pour la rallumer, autorisez la localisation pour "
          + "Refuge dans les réglages du téléphone (application Refuge, ou "
          + "Chrome / votre navigateur), puis retouchez l'interrupteur.");
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        majEtatPosition("Position indisponible. Vérifiez que la localisation "
          + "du téléphone est allumée, puis réessayez.");
      } else {
        majEtatPosition("Trop long pour trouver un point. À l'intérieur d'un "
          + "bâtiment c'est fréquent : réessayez près d'une fenêtre, ou dehors.");
      }
      annoncer('Position introuvable.');
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
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

  /* Allumer l'interrupteur déclenche aussitôt le test : c'est ainsi que
     l'autorisation est demandée ici, et nulle part ailleurs. */
  lierCase('#r-position', 'aideJointPosition', () => {
    if (reglages.aideJointPosition) testerPosition();
    else afficherEtatPosition();
  });
  $('#btn-tester-position').addEventListener('click', testerPosition);
  afficherEtatPosition();

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
   9. MON PROTOCOLE — « voici ce qui m'aide »
   ------------------------------------------------------------
   Une liste de cases à cocher, rangée par thèmes. Rien ici n'est une
   consigne médicale : ce sont VOS phrases, à la première personne,
   destinées aux gens qui seront autour de vous quand parler devient
   impossible. Elles informent, elles ne prescrivent pas.

   POUR AJOUTER UNE PROPOSITION PLUS TARD
   --------------------------------------
   Ajoutez une ligne { id: '…', texte: '…' } dans le thème voulu,
   ci-dessous. C'est tout : l'écran et la carte se mettent à jour
   tout seuls.

   L'« id » est l'étiquette qui sert à retenir votre choix dans la
   base. Trois règles :
     • il doit être unique dans toute la liste ;
     • écrivez-le en minuscules, sans accent ni espace ;
     • ne modifiez JAMAIS l'id d'une proposition déjà en place —
       sinon la case correspondante se décocherait toute seule.
   Le texte, lui, peut être réécrit quand vous voulez.

   Pour créer un thème entier, copiez un bloc { id, titre, aide,
   propositions: [...] } complet : un nouvel encadré apparaîtra, avec
   son propre champ libre.
   ============================================================ */

const THEMES_PROTOCOLE = [
  {
    id: 'contact',
    titre: 'Contact et présence',
    aide: "Ce que je voudrais que les gens fassent — ou ne fassent pas — avec leur corps.",
    propositions: [
      { id: 'contact-pas-toucher',      texte: 'Ne pas me toucher' },
      { id: 'contact-prevenir-avant',   texte: "Me prévenir avant de me toucher, si c'est vraiment nécessaire" },
      { id: 'contact-pas-tirer',        texte: 'Ne pas me prendre par le bras pour me déplacer' },
      { id: 'contact-distance',         texte: 'Rester à quelques pas de moi' },
      { id: 'contact-rester-silence',   texte: 'Rester près de moi sans rien dire' },
      { id: 'contact-pas-penche',       texte: 'Ne pas se pencher au-dessus de moi' },
      { id: 'contact-pas-regard',       texte: "Ne pas chercher mon regard : regarder ailleurs m'aide à écouter" },
      { id: 'contact-pas-attroupement', texte: "Ne pas faire venir d'autres personnes autour de moi" }
    ]
  },
  {
    id: 'parole',
    titre: 'Parole et questions',
    aide: "Comment me parler, et à quoi je peux répondre.",
    propositions: [
      { id: 'parole-doucement',      texte: 'Me parler doucement et peu' },
      { id: 'parole-phrases-courtes', texte: 'Des phrases courtes, une seule question à la fois' },
      { id: 'parole-jentends',       texte: 'Je vous entends même sans répondre' },
      { id: 'parole-temps',          texte: 'Me laisser du temps : ma réponse peut mettre une minute à venir' },
      { id: 'parole-pas-repeter',    texte: 'Ne pas répéter la question : cela me fait tout recommencer' },
      { id: 'parole-oui-non',        texte: 'Je peux répondre oui ou non de la tête' },
      { id: 'parole-ecrire',         texte: "Écrire ou montrer du doigt m'est plus facile que parler" },
      { id: 'parole-pas-crier',      texte: "Ne pas hausser la voix : je ne fais pas exprès" },
      { id: 'parole-pas-choisir',    texte: 'Ne pas me demander de choisir : décider est ce qui me coûte le plus' }
    ]
  },
  {
    id: 'environnement',
    titre: 'Autour de moi',
    aide: "Ce qui, dans le lieu, peut être changé tout de suite.",
    propositions: [
      { id: 'env-eloigner-bruit',  texte: "M'éloigner du bruit et de la foule" },
      { id: 'env-lumiere',         texte: 'Baisser la lumière, éteindre les néons' },
      { id: 'env-coin-calme',      texte: 'Me laisser dans un coin, dos au mur' },
      { id: 'env-couper-sons',     texte: 'Couper la musique, la télévision, la radio' },
      { id: 'env-odeurs',          texte: 'Éviter les odeurs fortes : parfum, nourriture, tabac' },
      { id: 'env-air',             texte: "M'aider à sortir prendre l'air, ou ouvrir une fenêtre" },
      { id: 'env-sol',             texte: "Me laisser m'asseoir ou m'allonger par terre" }
    ]
  },
  {
    id: 'sensoriel',
    titre: "Ce qui m'apaise",
    aide: "Mes outils. Ils ont l'air étranges vus de l'extérieur : ils servent.",
    propositions: [
      { id: 'sens-casque',     texte: 'Me laisser mettre mon casque ou mes bouchons d’oreilles' },
      { id: 'sens-lunettes',   texte: "Me laisser mes lunettes de soleil, même à l'intérieur" },
      { id: 'sens-balancer',   texte: "Me laisser me balancer ou bouger les mains : c'est ce qui me calme" },
      { id: 'sens-couverture', texte: 'Une couverture ou un vêtement lourd posé sur moi m’aide' },
      { id: 'sens-eau',        texte: "Un verre d'eau fraîche m'aide" },
      { id: 'sens-objet',      texte: 'Un objet à manipuler dans les mains m’aide' },
      { id: 'sens-yeux',       texte: 'Me laisser garder les yeux fermés' },
      { id: 'sens-telephone',  texte: "Me laisser mon téléphone : c'est avec lui que je communique" }
    ]
  },
  {
    id: 'autres',
    titre: 'Ce qu’il faut savoir',
    aide: "De quoi éviter les malentendus, et les gestes de secours inutiles.",
    propositions: [
      { id: 'autre-pas-danger',    texte: 'Je ne suis pas en danger : cela passe avec du calme' },
      { id: 'autre-pas-epilepsie', texte: "Ce n'est pas une crise d'épilepsie" },
      { id: 'autre-pas-substance', texte: "Je n'ai ni bu ni pris de drogue" },
      { id: 'autre-pas-secours',   texte: "Je n'ai pas besoin des secours, sauf si je me blesse" },
      { id: 'autre-duree',         texte: "J'ai besoin de trente minutes à quelques heures pour revenir" },
      { id: 'autre-apres',         texte: "Après, j'aurai besoin de repos : ne pas me demander d'expliquer" },
      { id: 'autre-prevenir',      texte: 'Prévenir la personne dont le nom est en bas de cette carte' },
      { id: 'autre-signe',         texte: 'Rester à distance jusqu’à ce que je fasse signe' }
    ]
  }
];

/* Ce que Refuge retient de vos choix. « coches » est une liste d'id,
   « libres » vos propres lignes, thème par thème, et « fond » le fond
   choisi pour la carte image (voir section 10) : 'sombre' ou 'clair'. */
let protocole = { coches: [], libres: {}, contactNom: '', contactTel: '', fond: 'sombre' };

/* L'écriture dans la base est différée de quelques centièmes de seconde :
   taper dans un champ libre déclencherait sinon une écriture par lettre. */
let minuteurProtocole = null;

function enregistrerProtocole(tout_de_suite) {
  clearTimeout(minuteurProtocole);
  const ecrire = () => {
    BDD.ecrireProtocole({ ...protocole, maj: Date.now() })
      .catch((e) => console.warn('Protocole non enregistré.', e));
  };
  if (tout_de_suite) ecrire();
  else minuteurProtocole = setTimeout(ecrire, 400);
}

/* Construit l'écran à partir de THEMES_PROTOCOLE. Tout est généré ici :
   ajouter une proposition dans la liste suffit à la faire apparaître. */
function construireProtocole() {
  const conteneur = $('#protocole-themes');
  conteneur.innerHTML = '';

  THEMES_PROTOCOLE.forEach((theme) => {
    const carte = document.createElement('section');
    carte.className = 'carte';

    const titre = document.createElement('h2');
    titre.textContent = theme.titre;
    carte.appendChild(titre);

    if (theme.aide) {
      const aide = document.createElement('p');
      aide.innerHTML = '<small></small>';
      aide.firstChild.textContent = theme.aide;
      carte.appendChild(aide);
    }

    theme.propositions.forEach((prop) => {
      const ligne = document.createElement('label');
      ligne.className = 'proposition';
      ligne.setAttribute('for', 'prop-' + prop.id);

      const coche = document.createElement('input');
      coche.type = 'checkbox';
      coche.id = 'prop-' + prop.id;
      coche.dataset.prop = prop.id;

      const texte = document.createElement('span');
      texte.textContent = prop.texte;

      coche.addEventListener('change', () => {
        const dedans = protocole.coches.indexOf(prop.id);
        if (coche.checked && dedans === -1) protocole.coches.push(prop.id);
        if (!coche.checked && dedans !== -1) protocole.coches.splice(dedans, 1);
        enregistrerProtocole();
        majResumeProtocole();
      });

      ligne.appendChild(coche);
      ligne.appendChild(texte);
      carte.appendChild(ligne);
    });

    /* Le champ libre du thème : une ligne de texte = une ligne sur la carte. */
    const etiquette = document.createElement('label');
    etiquette.setAttribute('for', 'libre-' + theme.id);
    etiquette.textContent = 'Mes propres mots (une ligne par idée)';
    etiquette.style.marginTop = '14px';

    const champ = document.createElement('textarea');
    champ.id = 'libre-' + theme.id;
    champ.className = 'champ-libre';
    champ.placeholder = 'Facultatif';
    champ.addEventListener('input', () => {
      protocole.libres[theme.id] = champ.value;
      enregistrerProtocole();
      majResumeProtocole();
    });

    carte.appendChild(etiquette);
    carte.appendChild(champ);
    conteneur.appendChild(carte);
  });
}

/* Recopie dans l'écran ce qui a été lu dans la base. */
function afficherProtocole() {
  $$('#protocole-themes input[type="checkbox"]').forEach((c) => {
    c.checked = protocole.coches.includes(c.dataset.prop);
  });
  THEMES_PROTOCOLE.forEach((theme) => {
    const champ = $('#libre-' + theme.id);
    if (champ) champ.value = protocole.libres[theme.id] || '';
  });
  $('#p-contact-nom').value = protocole.contactNom || '';
  $('#p-contact-tel').value = protocole.contactTel || '';
  $$('#choix-fond-carte button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.fond === protocole.fond));
  });
  majResumeProtocole();
}

/* Les lignes libres d'un thème, nettoyées : une par ligne, sans vide. */
function lignesLibres(idTheme) {
  return (protocole.libres[idTheme] || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/* Toutes les lignes qui iront sur la carte, dans l'ordre des thèmes :
   d'abord les propositions cochées, puis vos propres mots. */
function lignesProtocole() {
  const lignes = [];
  THEMES_PROTOCOLE.forEach((theme) => {
    theme.propositions.forEach((p) => {
      if (protocole.coches.includes(p.id)) lignes.push(p.texte);
    });
    lignesLibres(theme.id).forEach((l) => lignes.push(l));
  });
  return lignes;
}

/* La ligne « qui prévenir », en bas de la carte. */
function ligneContact() {
  const nom = (protocole.contactNom || '').trim();
  const tel = (protocole.contactTel || '').trim();
  if (nom && tel) return 'Prévenir ' + nom + ' : ' + tel;
  if (nom) return 'Prévenir ' + nom;
  if (tel) return 'Prévenir ce numéro : ' + tel;
  return '';
}

function majResumeProtocole() {
  const total = lignesProtocole().length;
  const bouton = $('#btn-creer-carte');
  const resume = $('#p-resume').firstChild;

  bouton.disabled = total === 0;
  bouton.style.opacity = total === 0 ? '0.5' : '';

  if (total === 0) {
    resume.textContent = "Cochez au moins une ligne pour pouvoir créer votre carte.";
  } else {
    resume.textContent = total + (total > 1 ? ' lignes iront' : ' ligne ira')
      + ' sur la carte. Huit à douze lignes se lisent d’un coup d’œil ; '
      + 'au-delà, le texte rapetisse.';
  }
}

function initProtocole() {
  construireProtocole();

  const lierContact = (idChamp, cle) => {
    const champ = $(idChamp);
    champ.addEventListener('input', () => {
      protocole[cle] = champ.value;
      enregistrerProtocole();
    });
  };
  lierContact('#p-contact-nom', 'contactNom');
  lierContact('#p-contact-tel', 'contactTel');

  /* Raccourci : reprendre le contact déjà saisi dans les Réglages,
     plutôt que de le retaper. Les deux restent indépendants ensuite. */
  $('#btn-reprendre-contact').addEventListener('click', () => {
    protocole.contactNom = reglages.nom || '';
    protocole.contactTel = reglages.tel || '';
    $('#p-contact-nom').value = protocole.contactNom;
    $('#p-contact-tel').value = protocole.contactTel;
    enregistrerProtocole(true);
    annoncer(protocole.contactNom || protocole.contactTel
      ? 'Contact repris des réglages.'
      : "Aucun contact n'est enregistré dans les réglages.");
  });

  /* Le fond choisi est retenu avec le reste du protocole : il revient
     à la prochaine ouverture, et il part dans la sauvegarde. */
  choixUnique('choix-fond-carte', (b) => {
    protocole.fond = b.dataset.fond;
    enregistrerProtocole(true);
  });

  /* Lecture de ce qui était déjà enregistré. En cas d'échec (base
     indisponible), l'écran reste utilisable : il est simplement vide. */
  BDD.lireProtocole()
    .then((enregistre) => {
      if (enregistre) {
        protocole = {
          coches: Array.isArray(enregistre.coches) ? enregistre.coches : [],
          libres: enregistre.libres || {},
          contactNom: enregistre.contactNom || '',
          contactTel: enregistre.contactTel || '',
          fond: enregistre.fond === 'clair' ? 'clair' : 'sombre'
        };
      }
      afficherProtocole();
    })
    .catch((e) => { console.warn('Protocole illisible.', e); afficherProtocole(); });
}


/* ============================================================
   10. LA CARTE POUR L'ÉCRAN VERROUILLÉ
   ------------------------------------------------------------
   On fabrique une image PNG portrait à partir des lignes cochées.
   Posée en fond d'écran verrouillé, elle parle à votre place sans
   qu'on ait à déverrouiller quoi que ce soit.

   Deux précautions inscrites dans le code :

   1. Un avertissement AVANT de fabriquer quoi que ce soit. Un écran
      verrouillé est public : tout le monde peut le lire, y compris
      quelqu'un qui n'a rien à y faire. L'image n'existe qu'après
      confirmation.

   2. Le haut et le bas de l'image restent vides. L'horloge, la date
      et les notifications d'Android se posent par-dessus : du texte
      placé là serait illisible au moment où il compte.

   Rien ne sort du téléphone : le dessin est fait par le navigateur,
   et l'image reste dans l'appareil tant que vous ne la partagez pas.
   ============================================================ */

const CARTE_IMAGE = {
  largeur: 1080,
  hauteur: 1920,
  marge: 76,
  hautReserve: 360,   /* zone de l'horloge : on n'y écrit rien */
  basReserve: 210     /* zone « glisser pour déverrouiller » */
};

/* Fort contraste, mais jamais du blanc pur sur du noir pur : même ici,
   on reste dans les gris profonds et les crèmes. */
const PALETTES_CARTE = {
  sombre: { fond: '#0d1116', texte: '#eef1f4', doux: '#b3bcc5', trait: '#3a434e' },
  clair:  { fond: '#faf7f1', texte: '#1a1e23', doux: '#4d545c', trait: '#c7c1b5' }
};

const FAMILLE_CARTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const TITRE_CARTE = "Je suis autiste, je suis en surcharge sensorielle. "
  + "Voici ce qui m'aide.";

const PIED_CARTE = "En cas de danger ou de doute : 15 ou 112. "
  + "114 par SMS si je ne peux pas parler.";

/* Découpe un texte en lignes qui tiennent dans « largeurMax ».
   Un mot plus large que la ligne (une adresse, par exemple) est coupé
   lettre par lettre plutôt que de déborder. */
function envelopper(ctx, texte, largeurMax) {
  const lignes = [];
  let courante = '';

  const poser = () => { if (courante) { lignes.push(courante); courante = ''; } };

  String(texte).split(/\s+/).filter(Boolean).forEach((mot) => {
    if (ctx.measureText(mot).width > largeurMax) {
      poser();
      let morceau = '';
      Array.from(mot).forEach((lettre) => {
        if (ctx.measureText(morceau + lettre).width > largeurMax && morceau) {
          lignes.push(morceau);
          morceau = '';
        }
        morceau += lettre;
      });
      courante = morceau;
      return;
    }
    const essai = courante ? courante + ' ' + mot : mot;
    if (ctx.measureText(essai).width <= largeurMax || !courante) courante = essai;
    else { lignes.push(courante); courante = mot; }
  });

  poser();
  return lignes;
}

/* Prépare la mise en page pour une échelle de texte donnée.
   Renvoie les blocs à dessiner et le nombre de lignes qui tiennent. */
function composerCarte(ctx, echelle, lignes, contact) {
  const largeur = CARTE_IMAGE.largeur - 2 * CARTE_IMAGE.marge;
  const zone = CARTE_IMAGE.hauteur - CARTE_IMAGE.hautReserve - CARTE_IMAGE.basReserve;
  const t = (n) => Math.round(n * echelle);

  const polTitre   = '700 ' + t(56) + 'px ' + FAMILLE_CARTE;
  const polItem    = '500 ' + t(41) + 'px ' + FAMILLE_CARTE;
  const polContact = '700 ' + t(41) + 'px ' + FAMILLE_CARTE;
  const polPied    = '400 ' + t(29) + 'px ' + FAMILLE_CARTE;

  /* Le titre, en haut. */
  ctx.font = polTitre;
  const titre = {
    lignes: envelopper(ctx, TITRE_CARTE, largeur),
    police: polTitre, interligne: t(68), retrait: 0, couleur: 'texte'
  };
  const hTitre = titre.lignes.length * titre.interligne + t(46);

  /* Le pied de page, toujours réservé : il est dessiné en bas de la zone. */
  ctx.font = polPied;
  const pied = {
    lignes: envelopper(ctx, PIED_CARTE, largeur),
    police: polPied, interligne: t(38), retrait: 0, couleur: 'doux'
  };
  const hPied = pied.lignes.length * pied.interligne + t(34);

  /* Le contact, juste au-dessus du pied. */
  let blocContact = null;
  let hContact = 0;
  if (contact) {
    ctx.font = polContact;
    blocContact = {
      lignes: envelopper(ctx, contact, largeur),
      police: polContact, interligne: t(52), retrait: 0, couleur: 'texte'
    };
    hContact = blocContact.lignes.length * blocContact.interligne + t(40);
  }

  /* Ce qui reste appartient aux lignes du protocole. On en pose autant
     que la place le permet, jamais une ligne coupée en deux. */
  const budget = zone - hTitre - hPied - hContact;
  const retrait = t(38);
  ctx.font = polItem;

  const items = [];
  let hauteurItems = 0;
  for (const texte of lignes) {
    const bloc = {
      lignes: envelopper(ctx, texte, largeur - retrait),
      police: polItem, interligne: t(54), retrait: retrait,
      couleur: 'texte', puce: true
    };
    const h = bloc.lignes.length * bloc.interligne + t(16);
    if (hauteurItems + h > budget) break;
    items.push(bloc);
    hauteurItems += h;
  }

  return { titre, items, contact: blocContact, pied, posees: items.length, t: t };
}

/* Dessine la carte et renvoie le canvas, plus le nombre de lignes
   qui n'ont pas pu tenir. */
function dessinerCarte(nomPalette) {
  const p = PALETTES_CARTE[nomPalette] || PALETTES_CARTE.sombre;
  const canvas = document.createElement('canvas');
  canvas.width = CARTE_IMAGE.largeur;
  canvas.height = CARTE_IMAGE.hauteur;
  const ctx = canvas.getContext('2d');

  const lignes = lignesProtocole();
  const contact = ligneContact();

  /* On essaie d'abord en grand, puis on rapetisse par petits pas
     jusqu'à ce que tout tienne. En dessous de 0,62 on s'arrête : plus
     petit ne serait plus lisible à bout de bras. */
  let mise = null;
  for (let e = 1; e >= 0.61; e -= 0.05) {
    mise = composerCarte(ctx, e, lignes, contact);
    if (mise.posees >= lignes.length) break;
  }

  ctx.fillStyle = p.fond;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';

  const x = CARTE_IMAGE.marge;
  const t = mise.t;

  const poserBloc = (bloc, y) => {
    ctx.font = bloc.police;
    ctx.fillStyle = bloc.couleur === 'doux' ? p.doux : p.texte;
    bloc.lignes.forEach((ligne, i) => {
      if (bloc.puce && i === 0) ctx.fillText('•', x, y);
      ctx.fillText(ligne, x + bloc.retrait, y);
      y += bloc.interligne;
    });
    return y;
  };

  let y = CARTE_IMAGE.hautReserve;
  y = poserBloc(mise.titre, y) + t(46);
  mise.items.forEach((bloc) => { y = poserBloc(bloc, y) + t(16); });

  /* Le bas de la carte est ancré, pas posé à la suite : le contact et
     le rappel des secours sont toujours au même endroit. */
  let basZone = CARTE_IMAGE.hauteur - CARTE_IMAGE.basReserve;
  const hPied = mise.pied.lignes.length * mise.pied.interligne;
  const yPied = basZone - hPied;

  ctx.strokeStyle = p.trait;
  ctx.lineWidth = 2;

  if (mise.contact) {
    const hContact = mise.contact.lignes.length * mise.contact.interligne;
    const yContact = yPied - t(34) - hContact;
    ctx.beginPath();
    ctx.moveTo(x, yContact - t(28));
    ctx.lineTo(CARTE_IMAGE.largeur - x, yContact - t(28));
    ctx.stroke();
    poserBloc(mise.contact, yContact);
  }

  ctx.beginPath();
  ctx.moveTo(x, yPied - t(22));
  ctx.lineTo(CARTE_IMAGE.largeur - x, yPied - t(22));
  ctx.stroke();
  poserBloc(mise.pied, yPied);

  return { canvas: canvas, oubliees: lignes.length - mise.posees };
}

/* L'image fabriquée, gardée telle quelle pour le téléchargement et le
   partage : les deux boutons doivent répondre dans l'instant de l'appui,
   sans refaire le dessin. */
let imageCarte = null;   /* { blob, url } */

function ouvrirEcranCarte(ouvert) {
  const ecran = $('#ecran-carte');
  ecran.hidden = !ouvert;

  if (ouvert) {
    /* On revient toujours sur l'avertissement : jamais directement
       sur l'image de la fois précédente. */
    $('#carte-etape-avis').classList.remove('masque');
    $('#carte-etape-apercu').classList.add('masque');

    const lignes = lignesProtocole();
    const contact = ligneContact();
    let detail = lignes.length + (lignes.length > 1 ? ' lignes' : ' ligne');
    detail += contact ? ', puis « ' + contact + ' ».' : '.';
    $('#carte-detail').textContent = detail;

    /* Prévenir précisément quand un numéro figure sur la carte. */
    $('#carte-avis-numero').classList
      .toggle('masque', !(protocole.contactTel || '').trim());

    ecran.focus({ preventScroll: true });
    ecran.scrollTop = 0;
    annoncer('Avant de créer la carte : ce texte sera visible par tout le monde.');
  } else {
    /* On libère l'image de la mémoire du navigateur. */
    if (imageCarte && imageCarte.url) URL.revokeObjectURL(imageCarte.url);
    imageCarte = null;
    $('#apercu-carte').innerHTML = '';
    $('#btn-creer-carte').focus();
  }
}

function fabriquerCarte() {
  const resultat = dessinerCarte(protocole.fond);

  const apercu = $('#apercu-carte');
  apercu.innerHTML = '';
  resultat.canvas.setAttribute('role', 'img');
  resultat.canvas.setAttribute('aria-label',
    'Aperçu de la carte : ' + TITRE_CARTE + ' ' + lignesProtocole().join('. '));
  apercu.appendChild(resultat.canvas);

  const alerte = $('#carte-alerte');
  if (resultat.oubliees > 0) {
    alerte.textContent = resultat.oubliees
      + (resultat.oubliees > 1 ? ' lignes n’ont pas pu tenir' : ' ligne n’a pas pu tenir')
      + ' sur la carte : elles ne sont pas sur l’image. Décochez-en '
      + 'quelques-unes pour que tout rentre en grand.';
    alerte.classList.remove('masque');
  } else {
    alerte.classList.add('masque');
  }

  $('#carte-etape-avis').classList.add('masque');
  $('#carte-etape-apercu').classList.remove('masque');
  $('#ecran-carte').scrollTop = 0;

  /* On prépare tout de suite le fichier : le bouton « Partager » ne
     fonctionne, sur Android, que s'il n'attend rien. */
  resultat.canvas.toBlob((blob) => {
    if (!blob) return;
    if (imageCarte && imageCarte.url) URL.revokeObjectURL(imageCarte.url);
    imageCarte = { blob: blob, url: URL.createObjectURL(blob) };

    /* Le partage n'est proposé que si le téléphone sait partager un
       fichier image. Sinon, le téléchargement suffit. */
    let partageable = false;
    try {
      const fichier = new File([blob], 'ma-carte-refuge.png', { type: 'image/png' });
      partageable = !!(navigator.canShare && navigator.canShare({ files: [fichier] }));
    } catch (e) { partageable = false; }
    $('#carte-partager').classList.toggle('masque', !partageable);
  }, 'image/png');

  annoncer('Carte créée. Vous pouvez la télécharger.');
}

$('#btn-creer-carte').addEventListener('click', () => ouvrirEcranCarte(true));
$('#carte-annuler').addEventListener('click', () => ouvrirEcranCarte(false));
$('#carte-fermer').addEventListener('click', () => ouvrirEcranCarte(false));
$('#carte-confirmer').addEventListener('click', fabriquerCarte);

$('#carte-telecharger').addEventListener('click', () => {
  if (!imageCarte) { annoncer("L'image n'est pas encore prête."); return; }
  const lien = document.createElement('a');
  lien.href = imageCarte.url;
  lien.download = 'ma-carte-refuge.png';
  lien.click();
  annoncer('Image téléchargée.');
});

$('#carte-partager').addEventListener('click', () => {
  if (!imageCarte) return;
  try {
    const fichier = new File([imageCarte.blob], 'ma-carte-refuge.png', { type: 'image/png' });
    navigator.share({ files: [fichier] }).catch(() => { /* partage annulé */ });
  } catch (e) {
    console.warn('Partage impossible.', e);
  }
});


/* ============================================================
   11. LIENS APAISANTS
   ------------------------------------------------------------
   Vos playlists, livres audio, podcasts. Refuge n'en garde que le
   nom et l'adresse, dans la base locale — il ne les ouvre jamais
   tout seul et ne lit rien à votre place.

   Trois garde-fous :
   • seules les adresses en https:// sont acceptées ;
   • l'ouverture demande deux appuis, comme les numéros d'urgence ;
   • en bouclier sensoriel, tout disparaît. Le bouclier, c'est le
     silence : proposer une playlist à ce moment-là serait exactement
     le contraire de ce qu'on cherche.
   ============================================================ */

/* Renvoie l'adresse nettoyée si elle est valide et en https, sinon null. */
function urlHttps(brut) {
  const texte = String(brut || '').trim();
  if (!texte) return null;
  try {
    const url = new URL(texte);
    return url.protocol === 'https:' ? url.href : null;
  } catch (e) {
    return null;
  }
}

let ouvreurLiens = null;   /* le bouton par lequel on est entré */

function ouvrirEcranLiens(ouvert, depuis) {
  const ecran = $('#ecran-liens');
  ecran.hidden = !ouvert;
  if (ouvert) {
    ouvreurLiens = depuis || null;
    afficherLiens();
    ecran.focus({ preventScroll: true });
    ecran.scrollTop = 0;
    annoncer('Ce qui m’apaise.');
  } else {
    $('#l-erreur').classList.add('masque');
    /* On revient sur le bouton d'où l'on vient — pas toujours celui de
       l'accueil : la respiration en propose un aussi. */
    if (ouvreurLiens && ouvreurLiens.offsetParent) ouvreurLiens.focus();
  }
}

async function afficherLiens() {
  let liste = [];
  try { liste = await BDD.liensTout(); } catch (e) { console.warn('Liens illisibles.', e); }

  const conteneur = $('#liste-liens');
  conteneur.innerHTML = '';

  if (liste.length === 0) {
    conteneur.innerHTML = '<p class="vide">Aucun lien pour l’instant.<br>'
      + 'Ajoutez-les au calme : ils seront là le jour où chercher sera trop dur.</p>';
    return;
  }

  liste.forEach((lien) => {
    const bloc = document.createElement('article');
    bloc.className = 'lien';

    const nom = document.createElement('p');
    nom.className = 'nom';
    nom.textContent = lien.nom;
    bloc.appendChild(nom);

    const adresse = document.createElement('p');
    adresse.className = 'adresse';
    /* On affiche le site plutôt que l'adresse entière : plus court à
       lire, et cela montre clairement où l'on va atterrir. */
    try { adresse.textContent = new URL(lien.url).hostname; }
    catch (e) { adresse.textContent = lien.url; }
    bloc.appendChild(adresse);

    const rangee = document.createElement('div');
    rangee.className = 'bouton-rangee';

    /* Ouvrir : deux appuis. Le premier arme, le second ouvre vraiment. */
    const ouvrir = document.createElement('button');
    ouvrir.type = 'button';
    ouvrir.textContent = 'Ouvrir';
    ouvrir.setAttribute('aria-label', 'Ouvrir ' + lien.nom);
    let armeOuvrir = null;
    ouvrir.addEventListener('click', () => {
      if (!ouvrir.classList.contains('arme')) {
        ouvrir.classList.add('arme');
        ouvrir.textContent = 'Confirmer';
        armeOuvrir = setTimeout(() => {
          ouvrir.classList.remove('arme');
          ouvrir.textContent = 'Ouvrir';
        }, 5000);
        return;
      }
      clearTimeout(armeOuvrir);
      ouvrir.classList.remove('arme');
      ouvrir.textContent = 'Ouvrir';
      /* Nouvel onglet : Refuge reste ouvert derrière, tel quel.
         rel="noopener" empêche le site ouvert de toucher à Refuge. */
      const a = document.createElement('a');
      a.href = lien.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    });

    /* Supprimer : deux appuis également, comme dans le journal. */
    const supprimer = document.createElement('button');
    supprimer.type = 'button';
    supprimer.textContent = 'Supprimer';
    supprimer.setAttribute('aria-label', 'Supprimer ' + lien.nom);
    let armeSup = false;
    supprimer.addEventListener('click', async () => {
      if (!armeSup) {
        armeSup = true;
        supprimer.textContent = 'Confirmer';
        setTimeout(() => { armeSup = false; supprimer.textContent = 'Supprimer'; }, 4000);
        return;
      }
      try {
        await BDD.liensSupprimer(lien.id);
        afficherLiens();
        annoncer('Lien supprimé.');
      } catch (e) { console.warn('Suppression impossible.', e); }
    });

    rangee.appendChild(ouvrir);
    rangee.appendChild(supprimer);
    bloc.appendChild(rangee);
    conteneur.appendChild(bloc);
  });
}

$('#form-lien').addEventListener('submit', async (e) => {
  e.preventDefault();

  const erreur = $('#l-erreur');
  const nom = $('#l-nom').value.trim();
  const url = urlHttps($('#l-url').value);

  const refuser = (texte) => {
    erreur.textContent = texte;
    erreur.classList.remove('masque');
  };

  if (!nom) { refuser('Donnez un nom à ce lien, pour le reconnaître plus tard.'); return; }
  if (!url) {
    refuser("L'adresse doit commencer par https:// — c'est la version "
      + 'sécurisée du web. Copiez-la depuis votre navigateur, avec le '
      + 'https:// du début.');
    return;
  }

  try {
    await BDD.liensAjouter({ nom: nom, url: url, ajoute: Date.now() });
    $('#l-nom').value = '';
    $('#l-url').value = '';
    erreur.classList.add('masque');
    afficherLiens();
    annoncer('Lien ajouté.');
  } catch (err) {
    refuser("Le lien n'a pas pu être enregistré.");
    console.error(err);
  }
});

$$('.entree-liens').forEach((b) => {
  b.addEventListener('click', (e) => ouvrirEcranLiens(true, e.currentTarget));
});
$('#liens-fermer').addEventListener('click', () => ouvrirEcranLiens(false));

/* ============================================================
   12. SAUVEGARDE ET RESTAURATION
   ------------------------------------------------------------
   Tout ce que vous saisissez vit dans le navigateur (localStorage
   pour les réglages, IndexedDB pour le reste). Si les « données du
   site » sont effacées — nettoyage du cache, réinstallation,
   nouveau téléphone —, tout part avec. Le seul rempart est un
   fichier rangé dans le téléphone lui-même : on le fabrique ici,
   et on sait le relire.

   Le fichier ne quitte jamais l'appareil : il est copié de la
   mémoire de Refuge vers le dossier Téléchargements, sans aucun
   appel réseau.

   Restaurer n'efface rien de ce qui est déjà là :
     • les entrées du journal et les liens sont AJOUTÉS, sauf ceux
       qui existent déjà (restaurer deux fois ne crée pas de doublon) ;
     • le protocole et les réglages sont remplacés par ceux du
       fichier, seulement s'il les contient. Les sauvegardes faites
       avec les versions 1 et 2 n'avaient pas les réglages : on garde
       alors ceux du téléphone.

   Tout ce qui vient du fichier est vérifié champ par champ avant
   d'être rangé : un fichier abîmé ou étranger ne doit jamais
   empêcher Refuge de démarrer ensuite.
   ============================================================ */

const CLE_DERNIERE_SAUVEGARDE = 'refuge.derniereSauvegarde';
const CLE_APRES_RESTAURATION = 'refuge.apresRestauration';

const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric'
});

/* Message visible sous les boutons de la carte « Sauvegarde ». */
function messageSauvegarde(texte) {
  const zone = $('#restaurer-message');
  zone.textContent = texte;
  zone.classList.toggle('masque', !texte);
}

function afficherDerniereSauvegarde() {
  let ts = null;
  try { ts = Number(localStorage.getItem(CLE_DERNIERE_SAUVEGARDE)) || null; } catch (e) { /* rien */ }
  $('#derniere-sauvegarde small').textContent = ts
    ? 'Dernière sauvegarde : le ' + FORMAT_JOUR.format(new Date(ts)) + '.'
    : "Aucune sauvegarde faite depuis ce téléphone pour l'instant.";
}

async function enregistrerSauvegarde() {
  let crises, liens;
  try {
    crises = await BDD.tout();
    liens = await BDD.liensTout();
  } catch (e) {
    /* Mieux vaut ne rien fabriquer qu'un fichier incomplet qu'on
       croirait complet. */
    console.error(e);
    messageSauvegarde("La sauvegarde n'a pas pu être faite : la base locale est illisible.");
    annoncer('Sauvegarde impossible.');
    return;
  }

  const donnees = {
    app: 'refuge',
    version: 3,
    exporte: new Date().toISOString(),
    reglages: reglages,
    crises: crises,
    protocole: protocole,
    liens: liens
  };

  /* La date dans le nom permet de garder plusieurs sauvegardes côte à
     côte sans qu'elles s'écrasent. */
  const nom = 'sauvegarde-refuge-' + maintenantLocal().slice(0, 10) + '.json';
  telecharger(nom, JSON.stringify(donnees, null, 2), 'application/json');

  try { localStorage.setItem(CLE_DERNIERE_SAUVEGARDE, String(Date.now())); } catch (e) { /* rien */ }
  afficherDerniereSauvegarde();
  messageSauvegarde('Fichier « ' + nom + ' » créé dans vos Téléchargements. '
    + 'Vous pouvez aussi le copier ailleurs (clé USB, ordinateur) pour plus de sûreté.');
  annoncer('Sauvegarde enregistrée.');
}

$('#btn-sauvegarder').addEventListener('click', enregistrerSauvegarde);

/* --- Vérification de ce qui vient du fichier --- */

const nombreOuNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const texteOuVide  = (v) => (typeof v === 'string' ? v : '');

function nettoyerCrise(c) {
  if (!c || typeof c !== 'object') return null;
  const ts = nombreOuNull(c.ts);
  if (ts === null) return null;
  return {
    ts: ts,
    duree: nombreOuNull(c.duree),
    intensite: nombreOuNull(c.intensite),
    declencheurs: Array.isArray(c.declencheurs)
      ? c.declencheurs.filter((x) => typeof x === 'string')
      : [],
    note: texteOuVide(c.note)
  };
}

function nettoyerLien(l) {
  if (!l || typeof l !== 'object') return null;
  const nom = texteOuVide(l.nom).trim();
  const url = urlHttps(l.url);   /* toujours https:// uniquement */
  if (!nom || !url) return null;
  return { nom: nom, url: url, ajoute: nombreOuNull(l.ajoute) || Date.now() };
}

function nettoyerProtocole(p) {
  const libres = {};
  if (p.libres && typeof p.libres === 'object') {
    Object.keys(p.libres).forEach((cle) => {
      if (typeof p.libres[cle] === 'string') libres[cle] = p.libres[cle];
    });
  }
  return {
    coches: Array.isArray(p.coches) ? p.coches.filter((x) => typeof x === 'string') : [],
    libres: libres,
    contactNom: texteOuVide(p.contactNom),
    contactTel: texteOuVide(p.contactTel),
    fond: p.fond === 'clair' ? 'clair' : 'sombre'
  };
}

/* Seules les clés connues, avec le bon type, sont reprises. */
function nettoyerReglages(r) {
  const propre = {};
  Object.keys(REGLAGES_DEFAUT).forEach((cle) => {
    if (typeof r[cle] === typeof REGLAGES_DEFAUT[cle]) propre[cle] = r[cle];
  });
  if ('rythme' in propre && !RYTHMES[propre.rythme]) delete propre.rythme;
  if ('echelle' in propre && !(propre.echelle >= 0.5 && propre.echelle <= 2)) delete propre.echelle;
  if ('dureeRespi' in propre && !(propre.dureeRespi > 0 && propre.dureeRespi <= 60)) delete propre.dureeRespi;
  return propre;
}

/* Renvoie ce qu'il y a à restaurer, ou un texte d'erreur. */
function lireSauvegarde(d) {
  const etranger = "Ce fichier ne ressemble pas à une sauvegarde de Refuge.";
  if (!d || typeof d !== 'object' || Array.isArray(d)) return etranger;
  if (d.app && d.app !== 'refuge') {
    return 'Ce fichier est une sauvegarde d’une autre application (« '
      + String(d.app) + ' ») : il ne peut pas être restauré dans Refuge.';
  }
  if (!['crises', 'protocole', 'liens', 'reglages'].some((cle) => cle in d)) return etranger;

  const objet = (v) => v && typeof v === 'object' && !Array.isArray(v);
  return {
    exporte: Date.parse(d.exporte) || null,
    crises: Array.isArray(d.crises) ? d.crises.map(nettoyerCrise).filter(Boolean) : null,
    liens: Array.isArray(d.liens) ? d.liens.map(nettoyerLien).filter(Boolean) : null,
    protocole: objet(d.protocole) ? nettoyerProtocole(d.protocole) : null,
    reglages: objet(d.reglages) ? nettoyerReglages(d.reglages) : null
  };
}

/* Deux entrées identiques sur tous ces points sont la même entrée. */
const signatureCrise = (c) => JSON.stringify([c.ts, c.duree, c.intensite, c.declencheurs, c.note]);
const signatureLien  = (l) => JSON.stringify([l.nom, l.url]);

function resumeRestauration(r) {
  const pluriel = (n, un, plusieurs) => n + ' ' + (n > 1 ? plusieurs : un);
  const contenu = [];
  if (r.crises && r.crises.length) contenu.push(pluriel(r.crises.length, 'entrée de journal', 'entrées de journal'));
  if (r.liens && r.liens.length) contenu.push(pluriel(r.liens.length, 'lien apaisant', 'liens apaisants'));
  if (r.protocole) contenu.push('votre protocole');
  if (r.reglages && Object.keys(r.reglages).length) contenu.push('vos réglages');
  if (!contenu.length) return null;

  const liste = contenu.length > 1
    ? contenu.slice(0, -1).join(', ') + ' et ' + contenu[contenu.length - 1]
    : contenu[0];
  const date = r.exporte ? 'Sauvegarde du ' + FORMAT_JOUR.format(new Date(r.exporte)) : 'Cette sauvegarde';

  let texte = date + ' : ' + liste + '. ';
  if (r.crises || r.liens) texte += 'Ce qui est déjà sur ce téléphone est gardé, sans doublon. ';
  if (r.protocole || r.reglages) {
    texte += (r.protocole && r.reglages ? 'Le protocole et les réglages actuels seront remplacés'
      : r.protocole ? 'Le protocole actuel sera remplacé' : 'Les réglages actuels seront remplacés')
      + ' par ceux du fichier.';
  }
  return texte.trim();
}

let restaurationEnAttente = null;

function fermerConfirmationRestauration() {
  restaurationEnAttente = null;
  $('#restaurer-confirmation').classList.add('masque');
}

$('#btn-restaurer').addEventListener('click', () => {
  const champ = $('#fichier-restaurer');
  champ.value = '';   /* pour pouvoir rechoisir le même fichier */
  champ.click();
});

$('#fichier-restaurer').addEventListener('change', async (e) => {
  const fichier = e.target.files && e.target.files[0];
  fermerConfirmationRestauration();
  messageSauvegarde('');
  if (!fichier) return;

  let donnees;
  try {
    if (fichier.size > 20 * 1024 * 1024) throw new Error('Fichier trop gros');
    donnees = JSON.parse(await fichier.text());
  } catch (err) {
    messageSauvegarde("Ce fichier n'a pas pu être lu. Choisissez un fichier "
      + '« sauvegarde-refuge… .json » créé par Refuge.');
    return;
  }

  const lu = lireSauvegarde(donnees);
  if (typeof lu === 'string') { messageSauvegarde(lu); return; }

  const resume = resumeRestauration(lu);
  if (!resume) { messageSauvegarde('Ce fichier ne contient rien à restaurer.'); return; }

  /* Rien n'est écrit avant l'appui sur « Restaurer » : on montre
     d'abord ce que contient le fichier. */
  restaurationEnAttente = lu;
  $('#restaurer-resume').textContent = resume;
  $('#restaurer-confirmation').classList.remove('masque');
  annoncer(resume);
});

$('#btn-restaurer-annuler').addEventListener('click', () => {
  fermerConfirmationRestauration();
  annoncer('Restauration annulée.');
});

$('#btn-restaurer-confirmer').addEventListener('click', async () => {
  const r = restaurationEnAttente;
  fermerConfirmationRestauration();
  if (!r) return;

  let ajoutsCrises = 0;
  let ajoutsLiens = 0;
  try {
    if (r.crises) {
      const deja = new Set((await BDD.tout()).map(signatureCrise));
      for (const c of r.crises) {
        const s = signatureCrise(c);
        if (deja.has(s)) continue;
        await BDD.ajouter(c);   /* nouveau numéro : on ne reprend jamais l'ancien */
        deja.add(s);
        ajoutsCrises++;
      }
    }
    if (r.liens) {
      const deja = new Set((await BDD.liensTout()).map(signatureLien));
      for (const l of r.liens) {
        const s = signatureLien(l);
        if (deja.has(s)) continue;
        await BDD.liensAjouter(l);
        deja.add(s);
        ajoutsLiens++;
      }
    }
    if (r.protocole) {
      /* Une écriture différée du protocole en cours ne doit pas venir
         écraser ce qu'on restaure. */
      clearTimeout(minuteurProtocole);
      await BDD.ecrireProtocole({ ...r.protocole, maj: Date.now() });
    }
  } catch (err) {
    console.error(err);
    messageSauvegarde("La restauration n'a pas pu aller jusqu'au bout. "
      + 'Vous pouvez réessayer sans crainte : rien ne sera ajouté deux fois.');
    annoncer('Restauration interrompue.');
    return;
  }

  if (r.reglages && Object.keys(r.reglages).length) {
    reglages = { ...REGLAGES_DEFAUT, ...r.reglages };
    sauverReglages();
  }

  let bilan = 'Restauration terminée : '
    + ajoutsCrises + (ajoutsCrises > 1 ? ' entrées ajoutées' : ' entrée ajoutée') + ' au journal, '
    + ajoutsLiens + (ajoutsLiens > 1 ? ' liens ajoutés' : ' lien ajouté')
    + (r.protocole ? ', protocole rétabli' : '')
    + (r.reglages ? ', réglages rétablis' : '') + '.';
  if (reglages.aideJointPosition) {
    bilan += ' Pour joindre votre position au SMS, refaites « Tester ma position » '
      + 'au calme : l’autorisation d’Android a pu être effacée elle aussi.';
  }

  /* Le plus sûr pour que chaque écran reflète les données restaurées :
     recharger Refuge. Le bilan est gardé le temps du rechargement, puis
     réaffiché dans les Réglages. */
  try { sessionStorage.setItem(CLE_APRES_RESTAURATION, bilan); } catch (e) { /* rien */ }
  location.reload();
});

/* Au démarrage, juste après une restauration : on revient sur les
   Réglages et on affiche le bilan. */
function afficherBilanRestauration() {
  let bilan = null;
  try {
    bilan = sessionStorage.getItem(CLE_APRES_RESTAURATION);
    sessionStorage.removeItem(CLE_APRES_RESTAURATION);
  } catch (e) { /* rien */ }
  if (!bilan) return;
  allerA('reglages');
  messageSauvegarde(bilan);
  $('#restaurer-message').scrollIntoView({ block: 'center' });
  annoncer(bilan);
}


/* ============================================================
   13. DÉMARRAGE
   ============================================================ */

async function demarrer() {
  chargerReglages();
  appliquerTheme();
  initReglages();
  majBoutonAide();

  try { await BDD.ouvrir(); } catch (e) { console.error('Base locale indisponible.', e); }

  /* Le protocole se construit après l'ouverture de la base : l'écran est
     dessiné à partir de THEMES_PROTOCOLE, puis coché d'après ce qui était
     enregistré. Si la base est indisponible, l'écran reste utilisable. */
  initProtocole();

  /* Raccourcis de l'écran d'accueil : ?mode=bouclier, ?vue=respiration */
  const params = new URLSearchParams(location.search);
  if (reglages.bouclierAuDemarrage || params.get('mode') === 'bouclier') activerBouclier(true);
  if (params.get('vue')) allerA(params.get('vue'));

  afficherDerniereSauvegarde();
  afficherBilanRestauration();

  majVerrouEcran();

  /* Installation du service worker : c'est lui qui rend l'application
     utilisable sans connexion. */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .catch((e) => console.warn('Mode hors-ligne indisponible.', e));
  }
}

demarrer();
