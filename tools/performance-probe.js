// Only injected by performance_probe.py. Never loaded by the production page.
(() => {
  const report = { userAgent: navigator.userAgent, readyMs: null, visibleMs: null, actionsMs: null, switchesMs: [] };
  let commonDone = false, lookDone = false, currentLook, switchStart, panel;
  const elapsed = () => Math.round(performance.now());
  function show() {
    if (!document.body) return;
    if (!panel) {
      panel = document.createElement('pre'); panel.id = 'performanceReport';
      panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:390px;max-height:160px;overflow:auto;font:11px monospace;background:#fffef3e8;color:#30281f;padding:10px;border-radius:8px;pointer-events:none';
      document.body.append(panel);
    }
    const resources = performance.getEntriesByType('resource').filter(r => !r.name.startsWith('blob:'));
    report.viewport = {width: window.innerWidth, height: window.innerHeight, contentWidth: document.documentElement.clientWidth};
    report.transferBytes = resources.reduce((sum, r) => sum + r.transferSize, 0);
    report.decodedBodyBytes = resources.reduce((sum, r) => sum + r.decodedBodySize, 0);
    report.cachedResources = resources.filter(r => r.transferSize === 0 && r.decodedBodySize > 0).length;
    report.resources = resources.map(r => ({ path: new URL(r.name).pathname, transferBytes: r.transferSize, durationMs: Math.round(r.duration) }));
    panel.textContent = JSON.stringify(report, null, 2);
  }
  function actionDone() {
    if (commonDone && lookDone && report.actionsMs === null) report.actionsMs = elapsed();
    show();
  }
  document.addEventListener('load', event => {
    if (!event.target.src?.includes('studio-effects.js')) return;
    const effects = window.StudioEffects;
    for (const [method, mark] of [['loadCharacter', () => commonDone = true], ['loadLook', () => lookDone = true]]) {
      const original = effects[method];
      effects[method] = function(...args) {
        if (method === 'loadLook' && currentLook === undefined) currentLook = args[0];
        const result = original.apply(this, args);
        if (method === 'loadCharacter' || args[0] === currentLook) result.then(() => { mark(); actionDone(); }, () => {});
        return result;
      };
    }
  }, true);
  new MutationObserver(() => {
    const loading = document.getElementById('loading'), wardrobe = document.getElementById('wardrobe');
    if (loading?.hidden && report.readyMs === null) report.readyMs = elapsed();
    if (document.getElementById('previewCanvas')?.dataset.frame && report.visibleMs === null) {
      report.visibleMs = elapsed(); show();
    }
    if (!wardrobe || report.readyMs === null) return;
    const busy = wardrobe.getAttribute('aria-busy') === 'true';
    if (busy && switchStart === undefined) switchStart = performance.now();
    if (!busy && switchStart !== undefined) { report.switchesMs.push(Math.round(performance.now() - switchStart)); switchStart = undefined; show(); }
  }).observe(document.documentElement, {subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-busy', 'data-frame']});
  new PerformanceObserver(show).observe({type: 'resource', buffered: true});
})();
