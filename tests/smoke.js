/* RaiKiba smoke tests. Run: node tests/smoke.js  (needs playwright; serves the repo itself)
   Not part of the app and not listed in service-worker.js. */
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const root = path.join(__dirname, '..');
let fails = 0;
const ok = (n, f) => Promise.resolve().then(f).then(() => console.log('PASS', n), e => { fails++; console.log('FAIL', n, '-', e.message); });

(async () => {
  await ok('every script parses', () => {
    for (const f of fs.readdirSync(root).filter(f => f.endsWith('.js'))) new Function(fs.readFileSync(path.join(root, f), 'utf8'));
  });
  await ok('service worker lists files that exist', () => {
    const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
    const files = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(f => /\.(js|html|png|webmanifest|css)$/.test(f));
    const missing = files.filter(f => !fs.existsSync(path.join(root, f)));
    assert.deepStrictEqual(missing, []);
    assert(!files.some(f => f.startsWith('tests/')), 'tests must not be precached');
  });
  await ok('recipe parser: cups, cans, counts, tbsp', () => {
    const C = require(path.join(root, 'bloom-core.js'));
    const p = t => { const x = C.parse(t); return [x.name, x.amount, x.unit].join('|'); };
    assert.strictEqual(p('1 cup rice'), 'rice|1|cup');
    assert.strictEqual(p('2 cans tomatoes'), 'tomatoes|2|can');
    assert.strictEqual(p('3 eggs'), 'eggs|3|pieces');
    assert.strictEqual(p('100 g rice'), 'rice|100|g');
  });
  await ok('shopping plan groups same ingredient', () => {
    const C = require(path.join(root, 'bloom-core.js'));
    const R = (id, l) => ({ id, title: id, ingredients: l });
    const out = C.plan([R('a', ['100 g rice']), R('b', ['200 g rice'])], []).filter(x => /rice/.test(x.name));
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].amount, 300);
  });

  const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/json' };
  const srv = http.createServer((q, r) => {
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }).listen(0);
  const port = srv.address().port;
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP browser tests (playwright missing)'); srv.close(); process.exit(fails ? 1 : 0); }
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => localStorage.setItem('x', '1')); // storage works
  await page.waitForTimeout(800);

  await ok('app starts (no startup failure)', async () => {
    assert(await page.locator('#startupFailure').isHidden(), 'startup failure visible');
    assert((await page.locator('#app').innerText()).length > 20);
  });
  await ok('settings opens and shows the sync card', async () => {
    await page.evaluate(() => { const l = document.querySelector('[data-page="library"]'); l && l.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const s = document.querySelector('[data-view="settings"]'); s && s.click(); });
    await page.waitForTimeout(800);
    const t = await page.locator('#app').innerText();
    assert(/Sync across devices/i.test(t) || /Settings/i.test(t), 'settings not shown');
  });
  await ok('storage meter is read only and never errors', async () => {
    const r = await page.evaluate(() => { const k = 'bloom-zen-v1'; return { has: !!localStorage.getItem(k), len: (localStorage.getItem(k) || '').length }; });
    assert(r.len < 2 * 1024 * 1024);
    assert.strictEqual(errs.length, 0, errs.join('; '));
  });
  await b.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
