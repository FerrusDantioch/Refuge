import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const lireBuf = (rel) => fs.readFileSync(path.join(ROOT, rel));

function lirePngInfo(rel) {
  const buf = lireBuf(rel);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buf.subarray(0, 8).equals(sig), `${rel} doit être un PNG valide`);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let hasTrnsAlpha = false;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === 'tRNS') {
      if (colorType === 3) {
        for (let i = 0; i < data.length; i++) {
          if (data[i] < 255) { hasTrnsAlpha = true; break; }
        }
      } else {
        hasTrnsAlpha = true;
      }
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const hasAlphaChannel = colorType === 4 || colorType === 6 || hasTrnsAlpha;
  return { width, height, colorType, hasAlphaChannel, bytes: buf.length };
}

test('R2 — LICENSE intact et inchangé', () => {
  const buf = lireBuf('LICENSE');
  assert.equal(buf.length, 43184);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  assert.equal(sha, '0483fae80ead6506beafd3258fea07f5ff23bb81e2fbd41daf137d58798a14fb');
});

test('R2 — Prénom Johan préservé dans À propos et aucun lien portfolio', () => {
  const html = lire('index.html');
  assert.match(html, /Application développée par Johan,\s*avec l'aide de\s*l'intelligence artificielle\./);
  assert.doesNotMatch(html, /href="https?:\/\/[^"]*omni/i);
});

test('R2 — Silence absolu, zéro vibration, zéro notification, zéro CDN externe', () => {
  const fichiers = ['index.html', 'app.js', 'theme-init.js', 'sw.js'];
  for (const f of fichiers) {
    const contenu = lire(f);
    const sansCommentaires = contenu
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(sansCommentaires, /\bnavigator\s*\.\s*vibrate\b/, `${f} ne doit jamais appeler navigator.vibrate`);
    assert.doesNotMatch(sansCommentaires, /\bnew\s+Notification\b|\bNotification\s*\.\s*requestPermission\b/, `${f} ne doit jamais appeler Notification`);
    assert.doesNotMatch(sansCommentaires, /\bautoplay\b/i, `${f} ne doit pas contenir autoplay`);
  }
  const html = lire('index.html');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  for (const r of refs) {
    assert.ok(r.startsWith('./'), `Ressource non locale détectée: ${r}`);
  }
});

test('R2 & R3 — manifest.json conforme (id, start_url, catégories, icônes)', () => {
  const manifest = JSON.parse(lire('manifest.json'));
  assert.equal(manifest.id, '/Refuge/index.html');
  assert.equal(manifest.start_url, './index.html');
  assert.ok(!manifest.categories.includes('medical'));
  const iconMap = new Map(manifest.icons.map((i) => [`${i.src}|${i.sizes}|${i.purpose}`, i]));
  assert.ok(iconMap.has('./icon-192.png|192x192|any'));
  assert.ok(iconMap.has('./icon-512.png|512x512|any'));
  assert.ok(iconMap.has('./maskable-192.png|192x192|maskable'));
  assert.ok(iconMap.has('./maskable-512.png|512x512|maskable'));
  assert.ok(iconMap.has('./apple-touch-icon.png|180x180|any'));
});

test('R2 & R3 — Service Worker refuge-v32 complet et sûr', () => {
  const sw = lire('sw.js');
  assert.match(sw, /const CACHE = 'refuge-v32';/);
  for (const f of [
    './', './index.html', './theme-init.js', './styles.css', './app.js',
    './manifest.json', './icon-192.png', './icon-512.png',
    './maskable-192.png', './maskable-512.png', './apple-touch-icon.png'
  ]) {
    assert.ok(sw.includes(`'${f}'`), `FICHIERS doit inclure ${f}`);
    if (f !== './') {
      assert.ok(fs.existsSync(path.join(ROOT, f.slice(2))), `Fichier manquant sur disque: ${f}`);
    }
  }
  assert.match(sw, /type === 'etat'/);
  assert.match(sw, /type === 'activer'/);
  assert.match(sw, /type:\s*'recharger'/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /e\.request\.mode === 'navigate'/);
  assert.match(sw, /status:\s*503/);
  assert.match(sw, /copie\.put\(e\.request,\s*rep\.clone\(\)\)\.catch\(\(\)\s*=>\s*\{\}\)/);
  const installBlock = sw.match(/addEventListener\('install'[\s\S]*?\}\);/)?.[0] || '';
  assert.doesNotMatch(installBlock, /skipWaiting/);
});

test('R3 — .nojekyll et .gitattributes LF présents', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.nojekyll')));
  const ga = lire('.gitattributes');
  assert.match(ga, /\* text=auto eol=lf/);
});

test('R3 — Sécurité & CSP stricte (zéro style inline, zéro script inline, zéro innerHTML)', () => {
  const html = lire('index.html');
  const cspMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/i);
  assert.ok(cspMatch, 'Balise meta CSP manquante');
  const csp = cspMatch[1];
  for (const directive of [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "manifest-src 'self'",
    "worker-src 'self'"
  ]) {
    assert.ok(csp.includes(directive), `Directive CSP manquante: ${directive}`);
  }
  assert.doesNotMatch(html, /\bstyle=/i);
  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.match(html, /<script src="\.\/theme-init\.js"><\/script>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/apple-touch-icon\.png">/);

  const js = lire('app.js');
  assert.doesNotMatch(js, /\.innerHTML\b/);
  assert.doesNotMatch(js, /setAttribute\s*\(\s*['"]style['"]/);
  assert.doesNotMatch(js, /\.style\.cssText\b/);
  const styleRefs = js.match(/\.style\b[^\n]*/g) || [];
  assert.deepEqual(styleRefs, [".style.setProperty('--echelle', reglages.echelle);"]);
  assert.match(js, /register\('\.\/sw\.js',\s*\{\s*updateViaCache:\s*'none'\s*\}\)/);
  assert.match(js, /const VUES = \['accueil', 'respiration', 'protocole', 'journal', 'reglages'\];/);
});

test('R3 — Icônes PNG dimensions et opacité correctes', () => {
  const i192 = lirePngInfo('icon-192.png');
  assert.equal(i192.width, 192);
  assert.equal(i192.height, 192);

  const i512 = lirePngInfo('icon-512.png');
  assert.equal(i512.width, 512);
  assert.equal(i512.height, 512);

  const m192 = lirePngInfo('maskable-192.png');
  assert.equal(m192.width, 192);
  assert.equal(m192.height, 192);
  assert.equal(m192.hasAlphaChannel, false);

  const m512 = lirePngInfo('maskable-512.png');
  assert.equal(m512.width, 512);
  assert.equal(m512.height, 512);
  assert.equal(m512.hasAlphaChannel, false);

  const ati = lirePngInfo('apple-touch-icon.png');
  assert.equal(ati.width, 180);
  assert.equal(ati.height, 180);
  assert.equal(ati.hasAlphaChannel, false);
});

test('R2 & R3 — Accessibilité HTML & CSS statique (h1, labels, 7 modales, bouclier, cibles 60 px)', () => {
  const html = lire('index.html');
  assert.match(html, /<section id="vue-accueil"[^>]*>\s*<h1 class="annonce">Refuge<\/h1>/);
  const h1Count = (html.match(/<h1\b/g) || []).length;
  assert.equal(h1Count, 5);

  assert.doesNotMatch(html, /<label[^>]*for="f-(?:duree|intensite)"/i);
  assert.doesNotMatch(html, /<label>Déclencheurs<\/label>/i);
  assert.match(html, /id="f-duree"[^>]*aria-labelledby="f-duree-titre"/);
  assert.match(html, /id="f-intensite"[^>]*aria-labelledby="f-intensite-titre"/);
  assert.match(html, /id="f-declencheurs"[^>]*aria-labelledby="f-declencheurs-titre"/);

  for (const id of ['carte-sos', 'carte-urgences', 'ecran-carte', 'ecran-liens', 'ecran-monte', 'ecran-emotions', 'ecran-proches']) {
    const tag = html.match(new RegExp(`<div id="${id}"[^>]*>`, 'i'))?.[0] || '';
    assert.ok(tag, `Modale #${id} introuvable`);
    assert.match(tag, /\bhidden\b/);
    assert.match(tag, /\btabindex="-1"/);
    assert.match(tag, /\brole="dialog"/);
    assert.match(tag, /\baria-modal="true"/);
  }

  const css = lire('styles.css');
  assert.match(css, /html\[data-bouclier="on"\]\s*\{[\s\S]*?--bg:\s*#000000\s*!important;/);
  assert.match(css, /html\[data-bouclier="on"\]\s*:focus-visible\s*\{\s*outline-color:\s*#5a5a5a;/);
  assert.match(css, /\.interrupteur\s*\{[\s\S]*?min-height:\s*60px;/);
});
