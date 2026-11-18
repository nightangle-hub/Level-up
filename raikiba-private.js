/* RaiKiba private content: Looks photos and personal notes load from your private storage after sign in.
   Nothing personal ships in the public code. */
(function (root) {
  'use strict';
  const d = root.document;
  let pending = false, loaded = false;
  async function loadNotes() {
    const S = root.RaiKibaSync;
    if (loaded || !S || !S.signedIn()) return;
    try {
      const c = await S.privateJson('content.json');
      if (!c) return;
      loaded = true;
      root.RK_PRIVATE = c;
      if (root.RK_VAULT && c.vault) Object.assign(root.RK_VAULT, c.vault);
    } catch (e) { /* stays hidden until next try */ }
  }
  async function fillImages() {
    pending = false;
    const S = root.RaiKibaSync;
    const imgs = Array.from(d.querySelectorAll('img[data-pfile]:not([src])'));
    if (!imgs.length) return;
    if (!S || !S.signedIn()) { imgs.forEach(i => { i.alt = 'Sign in (menu, Sync) to see your photos'; i.classList.add('rk-locked'); }); return; }
    try {
      const urls = await S.privateUrls([...new Set(imgs.map(i => i.getAttribute('data-pfile')))]);
      imgs.forEach(i => { const u = urls[i.getAttribute('data-pfile')]; if (u) { i.classList.remove('rk-locked'); i.src = u; } });
    } catch (e) { /* retry on next render */ }
  }
  function schedule() { if (!pending) { pending = true; root.setTimeout(fillImages, 30); } }
  function start() {
    const st = d.createElement('style');
    st.textContent = 'img.rk-locked{min-height:80px;background:var(--soft,#ddd);color:var(--muted,#666);font-size:12px}';
    d.head.appendChild(st);
    new root.MutationObserver(schedule).observe(d.body, { childList: true, subtree: true });
    d.addEventListener('raikiba-signed-in', () => { loaded = false; loadNotes(); schedule(); });
    loadNotes(); schedule();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window);
