(function () {
  try {
    var r = JSON.parse(localStorage.getItem('refuge.reglages')) || {};
    var racine = document.documentElement;
    racine.dataset.theme = r.themeClair ? 'clair' : 'sombre';
    if (typeof r.palette === 'string') racine.dataset.palette = r.palette;
    var echelle = Number(r.echelle);
    if (echelle >= 0.5 && echelle <= 2) racine.style.setProperty('--echelle', echelle);
    if (r.bouclierAuDemarrage || new URLSearchParams(location.search).get('mode') === 'bouclier') {
      racine.dataset.bouclier = 'on';
    }
  } catch (e) { /* réglages illisibles : on garde le thème par défaut */ }
})();
