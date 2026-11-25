import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://127.0.0.1').pathname;
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const full = path.resolve(ROOT, rel);
      if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(full);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function parseRgb(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  assert.ok(m, `Couleur CSS invalide: ${str}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

let server;
let baseUrl;
let browser;

test.before(async () => {
  ({ server, baseUrl } = await startServer());
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
});

function attachGuards(page) {
  const errors = [];
  const cspViolations = [];
  const externalRequests = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('request', (req) => {
    const u = req.url();
    if (u.startsWith('http://') || u.startsWith('https://')) {
      if (!u.startsWith(baseUrl)) externalRequests.push(u);
    }
  });
  page.exposeFunction('__reportCsp', (d) => cspViolations.push(d)).catch(() => {});
  page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      if (window.__reportCsp) window.__reportCsp(`${e.violatedDirective}: ${e.blockedURI}`);
    });
  });
  return { errors, cspViolations, externalRequests };
}

test('E2E 1 — CSP stricte, zéro erreur console, zéro requête externe, silence & zéro vibration (R2)', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = attachGuards(page);

  await page.addInitScript(() => {
    window.__r2Spy = { vibrate: 0, notify: 0, play: 0 };
    navigator.vibrate = () => { window.__r2Spy.vibrate++; return false; };
    window.Notification = function () { window.__r2Spy.notify++; };
    window.Notification.permission = 'default';
    window.Notification.requestPermission = async () => { window.__r2Spy.notify++; return 'denied'; };
    HTMLMediaElement.prototype.play = function () { window.__r2Spy.play++; return Promise.resolve(); };
  });

  await page.goto(`${baseUrl}/index.html`);
  await page.waitForSelector('#vue-accueil.active');

  for (const id of ['#onglet-respiration', '#onglet-protocole', '#onglet-journal', '#onglet-reglages', '#onglet-accueil']) {
    await page.click(id);
  }
  await page.click('#btn-bouclier');
  await page.click('#btn-bouclier');

  await page.click('#onglet-protocole');
  await page.click('label[for="prop-contact-pas-toucher"]');
  await page.click('#btn-creer-carte');
  await page.click('#carte-confirmer');
  await page.waitForSelector('#apercu-carte canvas');
  await page.click('#carte-fermer');

  const spy = await page.evaluate(() => window.__r2Spy);
  assert.deepEqual(spy, { vibrate: 0, notify: 0, play: 0 });
  assert.deepEqual(guards.cspViolations, []);
  assert.deepEqual(guards.externalRequests, []);
  assert.deepEqual(guards.errors, []);
  await context.close();
});

test('E2E 2 — Service Worker refuge-v32, mode hors ligne, repli navigation, 503 et ?vue= inconnu', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = attachGuards(page);

  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
  });
  await page.reload();

  const cacheNames = await page.evaluate(() => caches.keys());
  assert.ok(cacheNames.includes('refuge-v32'), `Caches trouvés: ${cacheNames.join(', ')}`);

  await context.setOffline(true);

  await page.goto(`${baseUrl}/index.html?mode=bouclier`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bouclier), 'on');

  await page.goto(`${baseUrl}/index.html?vue=respiration`);
  assert.equal(await page.evaluate(() => document.querySelector('#vue-respiration').classList.contains('active')), true);

  await page.goto(`${baseUrl}/index.html?vue=inexistante`);
  assert.equal(await page.evaluate(() => document.querySelector('#vue-accueil').classList.contains('active')), true);
  assert.equal(await page.evaluate(() => document.querySelector('#onglet-accueil').getAttribute('aria-selected')), 'true');

  const navRes = await page.goto(`${baseUrl}/page-absente.html`);
  assert.equal(navRes.status(), 200);
  assert.equal(await page.evaluate(() => document.querySelector('#vue-accueil').classList.contains('active')), true);

  assert.deepEqual(guards.errors, []);

  const apiStatus = await page.evaluate(async () => {
    const r = await fetch('./absent.json');
    return r.status;
  });
  assert.equal(apiStatus, 503);
  await context.close();
});

test('E2E 3 — Contrastes WCAG >= 4.5:1 sur les 16 thèmes (8 palettes × clair/sombre)', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`);

  const palettes = ['refuge', 'bleu', 'sauge', 'lavande', 'sable', 'peche', 'miel', 'rose'];
  const themes = ['clair', 'sombre'];

  for (const theme of themes) {
    for (const palette of palettes) {
      const vars = await page.evaluate(({ t, p }) => {
        const el = document.documentElement;
        el.dataset.theme = t;
        el.dataset.palette = p;
        const probe = document.createElement('div');
        document.body.appendChild(probe);
        const readColor = (name) => {
          probe.style.color = `var(${name})`;
          return getComputedStyle(probe).color;
        };
        const out = {
          bg: readColor('--bg'),
          surface: readColor('--surface'),
          surface2: readColor('--surface-2'),
          accentFond: readColor('--accent-fond'),
          texte: readColor('--texte'),
          texteDoux: readColor('--texte-doux'),
          aideFond: readColor('--aide-fond'),
          aideTexte: readColor('--aide-texte')
        };
        probe.remove();
        return out;
      }, { t: theme, p: palette });

      const c = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, parseRgb(v)]));
      const checks = [
        ['--texte / --bg', c.texte, c.bg],
        ['--texte / --surface', c.texte, c.surface],
        ['--texte-doux / --bg', c.texteDoux, c.bg],
        ['--texte-doux / --surface', c.texteDoux, c.surface],
        ['--texte-doux / --surface-2', c.texteDoux, c.surface2],
        ['--texte-doux / --accent-fond', c.texteDoux, c.accentFond],
        ['--aide-texte / --aide-fond', c.aideTexte, c.aideFond]
      ];
      for (const [label, fg, bg] of checks) {
        const ratio = contrastRatio(fg, bg);
        assert.ok(ratio >= 4.5, `${palette}-${theme} ${label}: contraste ${ratio.toFixed(2)} < 4.5`);
      }
    }
  }
  await context.close();
});

test('E2E 4 — Mode bouclier (#000 !important, focus #5a5a5a, masquage liens/monte)', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`);

  await page.evaluate(() => {
    localStorage.setItem('refuge.reglages', JSON.stringify({ themeClair: true, palette: 'lavande' }));
  });
  await page.reload();

  await page.click('#btn-bouclier');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, 'rgb(0, 0, 0)');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bouclier), 'on');
  assert.equal(await page.isVisible('#guides-bouclier'), true);
  assert.equal(await page.isVisible('#btn-liens'), false);
  assert.equal(await page.isVisible('#btn-monte'), false);

  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor);
  assert.equal(outline, 'rgb(90, 90, 90)');

  await page.click('#btn-emotions');
  assert.equal(await page.isVisible('#ecran-emotions'), true);
  const emColorStr = await page.evaluate(() => {
    const p = document.querySelector('#ecran-emotions .intro');
    return getComputedStyle(p).color;
  });
  assert.ok(contrastRatio(parseRgb(emColorStr), [0, 0, 0]) >= 3.0);

  await context.close();
});

test('E2E 5 — 7 modales : Échap, piège Tab/Shift+Tab, inert, restauration focus et retour Android (popstate)', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = attachGuards(page);

  await page.addInitScript(() => {
    const r = {
      nom: 'Sam',
      tel: '0612345678',
      contacts: [{ id: 'c1', nom: 'Sam', tel: '0612345678', messages: [{ id: 'm1', texte: 'Coucou' }] }]
    };
    localStorage.setItem('refuge.reglages', JSON.stringify(r));
  });

  await page.goto(`${baseUrl}/index.html`);
  await page.click('#onglet-protocole');
  await page.click('label[for="prop-contact-pas-toucher"]');
  await page.click('label[for="monte-action-respirer"]');
  await page.click('#onglet-accueil');

  const scenarios = [
    { open: '#btn-aide', modal: '#carte-sos', closeBtn: '#sos-fermer', viewTab: null },
    { open: '#btn-carte', modal: '#carte-sos', closeBtn: '#sos-fermer', viewTab: null },
    { open: '#btn-urgences', modal: '#carte-urgences', closeBtn: '#urgences-fermer', viewTab: null },
    { open: '#btn-liens', modal: '#ecran-liens', closeBtn: '#liens-fermer', viewTab: null },
    { open: '#btn-monte', modal: '#ecran-monte', closeBtn: '#monte-fermer', viewTab: null },
    { open: '#btn-emotions', modal: '#ecran-emotions', closeBtn: '#emotions-fermer', viewTab: null },
    { open: '#btn-proches', modal: '#ecran-proches', closeBtn: '#proches-fermer', viewTab: null },
    { open: '#btn-creer-carte', modal: '#ecran-carte', closeBtn: '#carte-annuler', viewTab: '#onglet-protocole' }
  ];

  for (const s of scenarios) {
    if (s.viewTab) await page.click(s.viewTab);
    await page.click(s.open);
    await page.waitForFunction((sel) => !document.querySelector(sel).hidden, s.modal);

    const inertState = await page.evaluate(() => ({
      mainInert: document.querySelector('main').inert,
      navInert: document.querySelector('nav.onglets').inert,
      histId: history.state && history.state.refugeModale
    }));
    assert.equal(inertState.mainInert, true);
    assert.equal(inertState.navInert, true);
    assert.equal(inertState.histId, s.modal.slice(1));

    const focusablesCount = await page.evaluate((sel) => {
      const m = document.querySelector(sel);
      return Array.from(m.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled])'))
        .filter((el) => !el.closest('[hidden], .masque') && getComputedStyle(el).display !== 'none').length;
    }, s.modal);
    assert.ok(focusablesCount >= 1);

    for (let i = 0; i < focusablesCount + 2; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate((sel) => document.querySelector(sel).contains(document.activeElement), s.modal);
      assert.equal(inside, true, `Fuite de Tab hors de ${s.modal}`);
    }
    for (let i = 0; i < focusablesCount + 1; i++) {
      await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate((sel) => document.querySelector(sel).contains(document.activeElement), s.modal);
      assert.equal(inside, true, `Fuite de Shift+Tab hors de ${s.modal}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction((sel) => document.querySelector(sel).hidden, s.modal);
    const afterEsc = await page.evaluate(() => ({
      mainInert: document.querySelector('main').inert,
      navInert: document.querySelector('nav.onglets').inert,
      activeId: '#' + (document.activeElement && document.activeElement.id)
    }));
    assert.equal(afterEsc.mainInert, false);
    assert.equal(afterEsc.navInert, false);
    assert.equal(afterEsc.activeId, s.open);

    // Ouvrir puis fermer par popstate (Retour Android)
    await page.click(s.open);
    await page.waitForFunction((sel) => !document.querySelector(sel).hidden, s.modal);
    await page.goBack();
    await page.waitForFunction((sel) => document.querySelector(sel).hidden, s.modal);
    assert.equal(await page.evaluate(() => '#' + document.activeElement.id), s.open);
  }

  // Enchaînement : fermer modale A par bouton, ouvrir modale B, goBack() ferme B sans double back
  await page.click('#onglet-accueil');
  await page.click('#btn-aide');
  await page.click('#sos-fermer');
  await page.click('#btn-urgences');
  await page.waitForFunction(() => !document.querySelector('#carte-urgences').hidden);
  // Armer le 15 (vérifier que l'état reste intact) puis retour Android
  await page.click('#carte-urgences button[data-appel="15"]');
  assert.equal(await page.evaluate(() => document.querySelector('#carte-urgences button[data-appel="15"]').classList.contains('arme')), true);
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#carte-urgences').hidden);
  assert.ok(page.url().startsWith(baseUrl));

  // SMS / Appel sur carte SOS + goBack()
  await page.click('#btn-aide');
  await page.waitForFunction(() => !document.querySelector('#carte-sos').hidden);
  assert.equal(await page.evaluate(() => history.state && history.state.refugeModale), 'carte-sos');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#carte-sos').hidden);

  // Bouclier + modale + goBack() laisse bouclier actif
  await page.click('#btn-bouclier');
  await page.click('#btn-carte');
  await page.waitForFunction(() => !document.querySelector('#carte-sos').hidden);
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#carte-sos').hidden);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.bouclier), 'on');

  // Régression : ouverture A -> fermeture UI -> ouverture B dans le même tick (avant popstate)
  await page.click('#btn-bouclier');
  await page.goto(`${baseUrl}/index.html?base=1`);
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(() => {
    document.querySelector('#btn-aide').click();
    document.querySelector('#sos-fermer').click();
    document.querySelector('#btn-urgences').click();
  });
  await page.waitForFunction(() => !document.querySelector('#carte-urgences').hidden
    && history.state && history.state.refugeModale === 'carte-urgences');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#carte-urgences').hidden);
  const apresMemeTick = await page.evaluate(() => ({
    url: location.href,
    mainInert: document.querySelector('main').inert,
    navInert: document.querySelector('nav.onglets').inert,
    state: history.state
  }));
  assert.equal(apresMemeTick.url, `${baseUrl}/index.html`);
  assert.equal(apresMemeTick.mainInert, false);
  assert.equal(apresMemeTick.navInert, false);
  assert.equal(apresMemeTick.state, null);

  // Régression : ouverture A -> fermeture -> ouverture B -> fermeture B dans le même tick (pas de double back)
  await page.evaluate(() => {
    document.querySelector('#btn-aide').click();
    document.querySelector('#sos-fermer').click();
    document.querySelector('#btn-urgences').click();
    document.querySelector('#urgences-fermer').click();
  });
  await page.waitForTimeout(150);
  const apresDoubleFermeture = await page.evaluate(() => ({
    url: location.href,
    urgencesHidden: document.querySelector('#carte-urgences').hidden,
    mainInert: document.querySelector('main').inert,
    state: history.state
  }));
  assert.equal(apresDoubleFermeture.url, `${baseUrl}/index.html`);
  assert.equal(apresDoubleFermeture.urgencesHidden, true);
  assert.equal(apresDoubleFermeture.mainInert, false);
  assert.equal(apresDoubleFermeture.state, null);
  await page.goBack();
  assert.equal(page.url(), `${baseUrl}/index.html?base=1`);

  assert.deepEqual(guards.errors, []);
  await context.close();
});

test('E2E 6 — Restauration JSON revient sur Réglages avec bilan affiché', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = attachGuards(page);

  await page.goto(`${baseUrl}/index.html`);
  await page.click('#onglet-reglages');

  const backup = JSON.stringify({
    app: 'refuge',
    version: 3,
    exporte: new Date().toISOString(),
    reglages: { nom: 'Alex', tel: '0600000000', echelle: 1.15 },
    crises: [{ ts: Date.now() - 60000, duree: 15, intensite: 3, declencheurs: ['Bruit'], note: 'Test' }],
    protocole: { coches: ['contact-pas-toucher'], libres: {}, contactNom: '', contactTel: '', fond: 'sombre' },
    liens: []
  });

  await page.setInputFiles('#fichier-restaurer', {
    name: 'sauvegarde-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup, 'utf8')
  });
  await page.waitForSelector('#restaurer-confirmation:not(.masque)');
  await Promise.all([
    page.waitForNavigation(),
    page.click('#btn-restaurer-confirmer')
  ]);
  await page.waitForSelector('#vue-reglages.active');
  const bilan = await page.textContent('#restaurer-message');
  assert.match(bilan, /Restauration terminée/);
  assert.deepEqual(guards.errors, []);
  await context.close();
});

test('E2E 7 — Cibles tactiles >= 60 px et barre d onglets 320 px en Très grand sans rognage', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('refuge.reglages', JSON.stringify({ echelle: 1.35, themeClair: false }));
  });
  await page.goto(`${baseUrl}/index.html`);

  const overflow = await page.evaluate(() => {
    const docOverflow = document.documentElement.scrollWidth > window.innerWidth;
    const reg = document.querySelector('#onglet-reglages');
    const regRect = reg.getBoundingClientRect();
    const onglets = Array.from(document.querySelectorAll('.onglet')).map((o) => {
      const r = o.getBoundingClientRect();
      return { id: o.id, w: r.width, h: r.height, sw: o.scrollWidth, cw: o.clientWidth, right: r.right };
    });
    return { docOverflow, regRight: regRect.right, onglets };
  });

  assert.equal(overflow.docOverflow, false, 'Débordement horizontal à 320 px Très grand');
  assert.ok(overflow.regRight <= 320.5, `Onglet Réglages rogné à droite: ${overflow.regRight}`);
  for (const o of overflow.onglets) {
    assert.ok(o.h >= 60, `${o.id} hauteur ${o.h} < 60`);
    assert.ok(o.w >= 60, `${o.id} largeur ${o.w} < 60`);
    assert.ok(o.sw <= o.cw + 1, `${o.id} texte rogné (${o.sw} > ${o.cw})`);
  }

  // Vérifier cibles >= 60 px sur toutes les vues à 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ['#onglet-accueil', '#onglet-respiration', '#onglet-protocole', '#onglet-journal', '#onglet-reglages']) {
    await page.click(tab);
    const bad = await page.evaluate(() => {
      const sels = 'button, a.bouton, .lien-licence, label.interrupteur, label.proposition, .onglet, summary';
      return Array.from(document.querySelectorAll(sels))
        .filter((el) => {
          const st = getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.height < 59.5;
        })
        .map((el) => ({ tag: el.tagName, id: el.id, cls: el.className, h: el.getBoundingClientRect().height }));
    });
    assert.deepEqual(bad, [], `Cibles < 60 px dans ${tab}: ${JSON.stringify(bad)}`);
  }

  await context.close();
});

test('E2E 8 — Messages erreur IndexedDB (suppression Journal, export CSV et export JSON)', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = attachGuards(page);

  await page.goto(`${baseUrl}/index.html`);
  await page.click('#onglet-journal');
  await page.click('#btn-noter-vite');
  await page.waitForSelector('#liste-crises article.entree');

  // Simuler un échec IndexedDB sur delete() et getAll()
  await page.evaluate(() => {
    IDBObjectStore.prototype.delete = function () {
      throw new DOMException('Échec simulé delete', 'UnknownError');
    };
    IDBObjectStore.prototype.getAll = function () {
      throw new DOMException('Échec simulé getAll', 'UnknownError');
    };
  });

  const supBtn = page.locator('#liste-crises article.entree button[aria-label^="Supprimer"]').first();
  await supBtn.click();
  await supBtn.click();
  await page.waitForFunction(() => {
    const msg = document.querySelector('#journal-message');
    return msg && /n'a pas pu être supprimée/.test(msg.textContent);
  });
  assert.match(await page.textContent('#journal-message'), /n'a pas pu être supprimée/);

  await page.click('#btn-export-csv');
  assert.match(await page.textContent('#journal-message'), /export CSV a échoué/);

  // Régression : #btn-export-json depuis Journal affiche l'erreur dans #journal-message (et non #restaurer-message masqué)
  await page.click('#btn-export-json');
  await page.waitForFunction(() => {
    const msg = document.querySelector('#journal-message');
    return msg && /La sauvegarde n'a pas pu être faite/.test(msg.textContent);
  });
  assert.equal(await page.isVisible('#journal-message'), true);
  assert.match(await page.textContent('#journal-message'), /La sauvegarde n'a pas pu être faite/);
  assert.equal(await page.isVisible('#restaurer-message'), false);
  assert.equal(await page.textContent('#restaurer-message'), '');

  // Depuis Réglages, #btn-sauvegarder continue d'afficher dans #restaurer-message
  await page.click('#onglet-reglages');
  await page.click('#btn-sauvegarder');
  await page.waitForFunction(() => {
    const msg = document.querySelector('#restaurer-message');
    return msg && /La sauvegarde n'a pas pu être faite/.test(msg.textContent);
  });
  assert.equal(await page.isVisible('#restaurer-message'), true);

  assert.deepEqual(guards.cspViolations, []);
  await context.close();
});
