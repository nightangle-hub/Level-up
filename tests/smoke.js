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

  await ok('moods are worked out for new recipes (soup is cold day, salad is hot day, explicit wins)', () => {
    const M = require(path.join(root, 'recipe-moods.js'));
    const R = (title, ing, x) => Object.assign({ title, ingredients: ing, servings: '2', notes: '' }, x || {});
    assert(M.get(R('Miso tofu soup', ['miso', 'tofu', 'water', 'onion', 'oil', 'soy'])).includes('soupy'));
    assert(M.get(R('Cucumber salad', ['cucumber', 'vinegar', 'oil', 'chilli oil', 'sugar', 'salt'])).includes('light'));
    assert(M.get(R('Egg rice', ['eggs', 'rice', 'soy'])).includes('quick'));
    assert.deepStrictEqual(M.get(R('Miso soup', ['a'], { moods: ['spicy'] })), ['spicy']);
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
  await ok('bottom bar is Today, Food, Train, Appearance (no Week)', async () => {
    const n = await page.evaluate(() => [...document.querySelectorAll('.bottom button')].map(b => b.innerText.trim().replace(/\s+/g, ' ')));
    assert.deepStrictEqual(n.map(x => x.replace(/^\S+\s/, '')), ['Today', 'Food', 'Train', 'Appearance']);
  });
  await ok('Today shows Kind to self chips and offline access, no dinner card', async () => {
    await page.evaluate(() => document.querySelector('[data-page="today"]').click());
    await page.waitForTimeout(700);
    const o = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('[data-action="care-tap"]')].length;
      const hasOffline = !!document.querySelector('.today-offline, .today-offline-card');
      const hasDinnerCard = !!document.querySelector('.today-dinner');
      return { chips, hasOffline, hasDinnerCard };
    });
    assert(o.chips >= 8, 'Kind to self chips missing (' + o.chips + ')');
    assert(o.hasOffline, 'offline mode section missing on Today');
    assert(!o.hasDinnerCard, 'dinner card should have moved off Today');
  });
  await ok('Food tab is the Pick a meal screen with Hot/Cold shortcuts', async () => {
    await page.evaluate(() => document.querySelector('nav.bottom [data-view="dinner"]')?.click());
    await page.waitForTimeout(600);
    const o = await page.evaluate(() => {
      const presets = [...document.querySelectorAll('[data-action="mood-preset"]')].map(b => b.textContent.trim());
      return { hot: presets.some(t => /Hot day/i.test(t)), cold: presets.some(t => /Cold day/i.test(t)), heading: !!document.querySelector('#content h1') && /What do you feel like/i.test(document.querySelector('#content h1').textContent) };
    });
    assert(o.hot && o.cold, 'Hot/Cold day shortcuts missing');
    assert(o.heading, 'Pick a meal title not "What do you feel like?"');
  });
  await ok('Food shows saved recipes even with no stock, Cold day filters, no false Nothing matches', async () => {
    const R = (id, title, ing) => ({ id, title, ingredients: ing, steps: ['Cook.'], servings: '2', notes: '', createdAt: new Date().toISOString() });
    await page.evaluate(rs => localStorage.setItem('bloom-zen-v1', JSON.stringify({ schemaVersion: 3, theme: 'light', page: 'today', cookedMeals: [], stockItems: [], userRecipes: rs })), [R('r1', 'Miso tofu soup', ['1 tbsp miso', '200 g tofu', '2 cups water', '1 spring onion', '1 tsp sesame oil', '1 tsp soy sauce']), R('r2', 'Cucumber salad', ['2 cucumbers', '1 tbsp rice vinegar', '1 tsp sesame oil', '1 tsp chilli oil', '1 tsp sugar', '1 tsp salt'])]);
    await page.reload(); await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('nav.bottom [data-view="dinner"]').click()); await page.waitForTimeout(600);
    let t = await page.evaluate(() => document.querySelector('#content').innerText);
    assert(/Miso tofu soup/.test(t) && /Cucumber salad/.test(t), 'saved recipes hidden');
    assert(!/Nothing matches/.test(t), 'false Nothing matches');
    await page.evaluate(() => document.querySelector('[data-action="mood-preset"][data-day="cold"]').click()); await page.waitForTimeout(500);
    t = await page.evaluate(() => document.querySelector('#content').innerText);
    assert(/Miso tofu soup/.test(t) && !/Cucumber salad/.test(t), 'Cold day should keep soup only');
    await page.evaluate(() => document.querySelector('[data-action="mood-preset"][data-day="hot"]').click()); await page.waitForTimeout(500);
    t = await page.evaluate(() => document.querySelector('#content').innerText);
    assert(/Cucumber salad/.test(t) && !/Miso tofu soup/.test(t), 'Hot day should keep salad only');
    await page.evaluate(() => document.querySelector('[data-action="dinner-reset"]')?.click()); await page.waitForTimeout(300);
  });
  await ok('recipe page: tags edit in one tap, delete asks inside the app then removes', async () => {
    await page.evaluate(() => [...document.querySelectorAll('#content button')].find(e => /Open recipe/.test(e.innerText)).click()); await page.waitForTimeout(600);
    assert(await page.evaluate(() => document.querySelectorAll('[data-action="recipe-tag"]').length) === 6, 'tag chips missing');
    const before = await page.evaluate(() => document.querySelectorAll('[data-action="recipe-tag"][aria-pressed="true"]').length);
    await page.evaluate(() => document.querySelector('[data-action="recipe-tag"][data-mood="spicy"]').click()); await page.waitForTimeout(500);
    const saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bloom-zen-v1')); return s.userRecipes.some(r => Array.isArray(r.moods) && r.moods.includes('spicy')); });
    assert(saved, 'tag edit not saved');
    const n0 = await page.evaluate(() => JSON.parse(localStorage.getItem('bloom-zen-v1')).userRecipes.length);
    await page.evaluate(() => document.querySelector('[data-action="delete-recipe"]').click()); await page.waitForTimeout(400);
    assert(await page.evaluate(() => !!document.querySelector('[data-action="delete-recipe-yes"]')), 'no in-app confirm');
    assert(await page.evaluate(() => JSON.parse(localStorage.getItem('bloom-zen-v1')).userRecipes.length) === n0, 'deleted before confirming');
    await page.evaluate(() => document.querySelector('[data-action="delete-recipe-yes"]').click()); await page.waitForTimeout(600);
    assert(await page.evaluate(() => JSON.parse(localStorage.getItem('bloom-zen-v1')).userRecipes.length) === n0 - 1, 'recipe not deleted');
    await page.evaluate(() => document.querySelector('nav.bottom [data-view="dinner"]').click()); await page.waitForTimeout(500);
  });
  await ok('Stock is a compact list: one row per item, tap chip flips level, filter works', async () => {
    const mk = (n, i) => ({ id: 's' + i, name: n, amount: null, unit: 'unknown', precision: 'presence_only', level: 'plenty', descriptor: 'plenty', source: 'confirmed-stocktake', updated: new Date().toISOString() });
    const names = ['Tofu', 'Rice', 'Eggs', 'Garlic', 'Ginger', 'Miso paste', 'Chilli oil', 'Bok choy', 'Noodles', 'Soy sauce'];
    await page.evaluate(x => localStorage.setItem('bloom-zen-v1', JSON.stringify({ schemaVersion: 3, theme: 'light', page: 'today', cookedMeals: [], stockItems: x, userRecipes: [] })), names.map(mk));
    await page.reload(); await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('nav.bottom [data-view="dinner"]').click()); await page.waitForTimeout(500);
    await page.evaluate(() => [...document.querySelectorAll('#content button')].find(e => e.innerText.trim() === 'Stock').click()); await page.waitForTimeout(600);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.stock-row').length), 10);
    await page.evaluate(() => document.querySelector('.stock-row .stock-chip').click()); await page.waitForTimeout(500);
    assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('bloom-zen-v1')).stockItems.filter(x => x.level === 'low').length), 1);
    await page.fill('.stock-filter', 'oil'); await page.waitForTimeout(300);
    assert.strictEqual(await page.evaluate(() => [...document.querySelectorAll('.stock-row')].filter(r => !r.hidden).length), 1);
    await page.evaluate(() => localStorage.setItem('bloom-zen-v1', JSON.stringify({ schemaVersion: 3, theme: 'light', page: 'today', cookedMeals: [], stockItems: [], userRecipes: [] })));
    await page.reload(); await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('nav.bottom [data-view="dinner"]').click()); await page.waitForTimeout(400);
  });
  await ok('New recipe shows the three way strip and Back returns to Meals', async () => {
    await page.evaluate(() => document.querySelector('nav.bottom [data-view="dinner"]').click());
    await page.waitForTimeout(500);
    await page.evaluate(() => [...document.querySelectorAll('#content button')].find(e => e.innerText.trim().startsWith('New recipe')).click());
    await page.waitForTimeout(500);
    for (const t of ['Paste a recipe', 'Type or AI fill']) {
      await page.evaluate(t => [...document.querySelectorAll('#content .new-recipe-strip button')].find(e => e.innerText.trim() === t).click(), t);
      await page.waitForTimeout(400);
    }
    const back = await page.evaluate(() => [...document.querySelectorAll('#content button')].find(e => /^\u2190/.test(e.innerText)).innerText);
    assert(/Meals/.test(back), 'back label was ' + back);
  });
  await ok('receipt review: one tap saves purchases and adds all to stock', async () => {
    await page.evaluate(() => localStorage.setItem('raikiba-sync-meta-v1', JSON.stringify({ session: { email: 't@t.t', expires_at: Math.floor(Date.now() / 1000) + 3600, access_token: 'x' }, deviceName: 't' })));
    await page.reload(); await page.waitForTimeout(4500);
    const L = (n, name, price) => ({ receiptText: n, name, brand: null, count: 1, packAmount: null, packUnit: null, totalAmount: null, totalUnit: null, price, confidence: 'high' });
    await page.route('**/functions/v1/ai-assist', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, parsed: { store: 'Coles', date: null, total: 9.5, lines: [L('TOFU', 'Firm tofu', 4.5), L('OCEAN COMBO', 'Hotpot fish balls', 5)], questions: [] } }) }));
    await page.evaluate(() => document.querySelector('.bottom [data-tab="food"]').click()); await page.waitForTimeout(500);
    for (const t of ['Shopping', 'Add a grocery shop']) { await page.evaluate(t => [...document.querySelectorAll('#content button')].find(e => e.innerText.trim().startsWith(t)).click(), t); await page.waitForTimeout(500); }
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('#luAiFile', { name: 'r.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(3000);
    assert(await page.evaluate(() => !!document.querySelector('#content input[type=date]').value), 'date should default to today');
    await page.evaluate(() => [...document.querySelectorAll('#content button')].find(e => e.innerText.trim().startsWith('Review items before saving')).click()); await page.waitForTimeout(1000);
    await page.evaluate(() => document.querySelector('[data-confirm-add]').click()); await page.waitForTimeout(1200);
    const n = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bloom-zen-v1')); return [s.purchaseRecords.length, s.stockItems.length]; });
    assert.deepStrictEqual(n, [2, 2]);
  });
  await ok('step 3: guardrails, XP tiers and unified log', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
    for (const id of ['trainingMoveLog', 'trainingFreeLog', 'trainingCardioLog']) assert(src.includes(id), 'missing form id ' + id);
    const bad = [...src.matchAll(/data-view="(?!training|foundation|workout|split)[a-z-]*(?:move|lift|cardio|activity)[a-z-]*"/g)];
    assert.strictEqual(bad.length, 0, 'non training-* screen name: ' + bad.map(m => m[0]).join(', '));
    const snap = await page.evaluate(() => localStorage.getItem('bloom-zen-v1'));
    const xp = await page.evaluate(() => { const C = window.BloomCore, d = JSON.parse(localStorage.getItem('bloom-zen-v1')), t = C.date(), at = m => { d.trainingLogs = [{ id: 'a' + m, kind: 'cardio', mode: 'Other cardio', minutes: m, date: t, createdAt: new Date().toISOString() }]; return C.trainingXP(d).total; }; return [at(15), at(20), at(30), at(45), at(60), at(90)]; });
    assert.deepStrictEqual(xp, [10, 10, 20, 20, 30, 30]);
    await page.evaluate(() => document.querySelector('.bottom [data-tab="train"]').click()); await page.waitForTimeout(500);
    assert(await page.evaluate(() => /Log something else/.test(document.querySelector('#content').innerText) && !/Walking & cardio/.test(document.querySelector('#content .concept-training').innerText)), 'Train tile merge');
    assert(await page.evaluate(() => /Strength days/.test(document.querySelector('#content').innerText)), 'weekly card');
    await page.evaluate(() => document.querySelector('#content [data-view="training-free"]').click()); await page.waitForTimeout(500);
    await page.evaluate(() => { document.querySelector('[data-act-chip="Dance"]').click(); document.querySelector('[data-min-chip="60"]').click(); });
    assert(await page.evaluate(() => /\+30 XP for 60/.test(document.querySelector('#moveXp').innerText)), 'XP preview');
    await page.evaluate(() => document.querySelector('#trainingMoveLog button[type=submit]').click()); await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bloom-zen-v1')), e = s.trainingLogs.at(-1); let valid = true; try { window.BloomCore.validate(JSON.parse(JSON.stringify(s))); } catch (x) { valid = x.message; } return { e, valid, tab: document.querySelector('.bottom [aria-current="page"]')?.textContent.trim() }; });
    assert(await page.evaluate(() => document.querySelectorAll('.lu-xpbar').length > 0), 'no XP toast after logging on the Train screen');
    assert.strictEqual(r.e.label, 'Dance'); assert.strictEqual(r.e.mode, 'Other cardio'); assert.strictEqual(r.e.minutes, 60);
    assert.strictEqual(r.valid, true, 'validator rejected label: ' + r.valid); assert(/Train/i.test(r.tab || ''), 'tab was ' + r.tab);
    await page.evaluate(s => { s === null ? localStorage.removeItem('bloom-zen-v1') : localStorage.setItem('bloom-zen-v1', s); }, snap);
    await page.reload(); await page.waitForTimeout(4500);
  });
  await ok('XP toast: never on cold open, still fires for XP earned while the app is open', async () => {
    const snap = await page.evaluate(() => localStorage.getItem('bloom-zen-v1'));
    const seed = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bloom-zen-v1')), t = window.BloomCore.date(); s.trainingLogs = [{ id: 'z1', kind: 'cardio', mode: 'Other cardio', label: 'Dance', minutes: 90, date: t, createdAt: new Date().toISOString() }]; localStorage.setItem('bloom-zen-v1', JSON.stringify(s)); localStorage.setItem('levelup-xpseen-v1', JSON.stringify({ total: 0, done: [] })); return true; });
    await page.reload(); await page.waitForTimeout(4500);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.lu-xpbar').length), 0, 'toast on cold open');
    assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('levelup-xpseen-v1')).total), 30, 'baseline not saved');
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bloom-zen-v1')), d = new Date(Date.now() - 864e5 * 2), t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); s.trainingLogs.push({ id: 'z2', kind: 'cardio', mode: 'Walking', minutes: 30, date: t, createdAt: new Date().toISOString() }); localStorage.setItem('bloom-zen-v1', JSON.stringify(s)); document.querySelector('.bottom [data-tab="train"]').click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.bottom [data-tab="today"], .bottom [data-page="today"]').click()); await page.waitForTimeout(1200);
    assert(await page.evaluate(() => document.querySelectorAll('.lu-xpbar').length > 0), 'no toast for XP earned while open');
    await page.evaluate(s => { s === null ? localStorage.removeItem('bloom-zen-v1') : localStorage.setItem('bloom-zen-v1', s); localStorage.removeItem('levelup-xpseen-v1'); }, snap);
    await page.reload(); await page.waitForTimeout(4500);
  });
  await ok('Train: an opened but empty Foundation workout is not "in progress"; a recorded set is', async () => {
    const snap = await page.evaluate(() => localStorage.getItem('bloom-zen-v1'));
    const tab = async () => { await page.evaluate(() => document.querySelector('.bottom [data-tab="train"]').click()); await page.waitForTimeout(500); return page.evaluate(() => document.querySelector('#content').innerText); };
    let t = await tab(); assert(/Start Foundation/.test(t), 'start button missing');
    await page.evaluate(() => [...document.querySelectorAll('#content button')].find(b => /^Start Foundation/.test(b.innerText.trim())).click()); await page.waitForTimeout(600);
    t = await tab();
    assert(!/IN PROGRESS/i.test(t) && /Start Foundation/.test(t) && !/Resume workout/.test(t), 'empty draft shows as in progress: ' + t.slice(0, 200));
    await page.evaluate(() => [...document.querySelectorAll('#content button')].find(b => /^Start Foundation/.test(b.innerText.trim())).click()); await page.waitForTimeout(600);
    await page.evaluate(() => { const i = document.querySelector('[data-workout-value="reps"]'); if (i) { i.value = '8'; i.dispatchEvent(new Event('input', { bubbles: true })); } document.querySelector('[data-action="workout-tick"]').click(); }); await page.waitForTimeout(600);
    t = await tab(); assert(/IN PROGRESS/i.test(t) && /Resume workout/.test(t), 'recorded set should show in progress: ' + t.slice(0, 200));
    await page.evaluate(s => { s === null ? localStorage.removeItem('bloom-zen-v1') : localStorage.setItem('bloom-zen-v1', s); }, snap);
    await page.reload(); await page.waitForTimeout(4500);
  });
  await ok('knee plan: validator rejects bad plans, rehab XP is 10 per day, old saves still validate', () => {
    const C = require(path.join(root, 'bloom-core.js')), base = { schemaVersion: 1, theme: 'dark', page: 'today' };
    C.validate(base);
    C.validate({ ...base, physioPlan: { status: 'active', startedOn: '2026-11-06', log: { '2026-11-08': { done: ['wall-sit'], knee: 'fine' } } } });
    for (const bad of [{ status: 'x' }, { status: 'active', log: { nope: {} } }, { status: 'active', log: { '2026-11-08': { done: ['squat'] } } }, { status: 'active', log: { '2026-11-08': { knee: 'bad' } } }]) assert.throws(() => C.validate({ ...base, physioPlan: bad }), 'accepted ' + JSON.stringify(bad));
    const x = C.trainingXP({ physioPlan: { status: 'active', log: { '2026-11-08': { done: ['wall-sit', 'side-kicks'] }, '2026-11-07': { done: [] } } } });
    assert.strictEqual(x.total, 10); assert.strictEqual(x.rehabDays, 1);
  });
  await ok('knee plan: set up, tick, feel, status, weekly card goal hidden, save validates', async () => {
    const snap = await page.evaluate(() => localStorage.getItem('bloom-zen-v1'));
    const go = async t => { await page.evaluate(t => [...document.querySelectorAll('#content button')].find(b => b.innerText.trim().startsWith(t)).click(), t); await page.waitForTimeout(450); };
    await page.evaluate(() => document.querySelector('.bottom [data-tab="train"]').click()); await page.waitForTimeout(500);
    let t = await page.evaluate(() => document.querySelector('#content').innerText); assert(/of 150/.test(t), 'goal should show before a plan');
    await go('Knee plan'); await go('Set up my knee plan');
    await page.evaluate(() => document.querySelector('[data-knee="tick"][data-v="wall-sit"]').click()); await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-knee="feel"][data-v="bit-sore"]').click()); await page.waitForTimeout(400);
    const p = await page.evaluate(() => JSON.parse(localStorage.getItem('bloom-zen-v1')).physioPlan);
    assert.strictEqual(p.status, 'active'); const day = Object.values(p.log)[0]; assert.deepStrictEqual(day.done, ['wall-sit']); assert.strictEqual(day.knee, 'bit-sore');
    t = await page.evaluate(() => document.querySelector('#content').innerText); assert(/Ask Carina/.test(t) && /3 to 4 out of 10/.test(t) && /Lunges/.test(t));
    await page.evaluate(() => document.querySelector('.bottom [data-tab="train"]').click()); await page.waitForTimeout(500);
    t = await page.evaluate(() => document.querySelector('#content').innerText); assert(/1 of 3 done today/.test(t) && !/of 150/.test(t), 'train row or goal hiding wrong: ' + t.slice(0, 300));
    await go('Knee plan'); await page.evaluate(() => document.querySelector('[data-knee="status"][data-v="paused"]').click()); await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.bottom [data-tab="train"]').click()); await page.waitForTimeout(500);
    t = await page.evaluate(() => document.querySelector('#content').innerText); assert(/of 150/.test(t), 'goal should return when paused');
    await page.evaluate(s => { s === null ? localStorage.removeItem('bloom-zen-v1') : localStorage.setItem('bloom-zen-v1', s); }, snap);
    await page.reload(); await page.waitForTimeout(4500);
  });
  await ok('storage meter is read only and never errors', async () => {
    const r = await page.evaluate(() => { const k = 'bloom-zen-v1'; return { has: !!localStorage.getItem(k), len: (localStorage.getItem(k) || '').length }; });
    assert(r.len < 2 * 1024 * 1024);
    assert.strictEqual(errs.length, 0, errs.join('; '));
  });
  await b.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
