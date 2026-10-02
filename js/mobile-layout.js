// Keep the approved phone groups while exposing every control on desktop.
(() => {
  const tabs = document.getElementById('mobileTabs');
  if (!tabs) return; // A cached older entry page remains usable.
  const keys = ['outfits', 'responses', 'atmosphere'];
  const buttons = keys.map(key => document.getElementById('mobile-tab-' + key));
  const panels = keys.map(key => document.getElementById('mobile-panel-' + key));
  const media = window.matchMedia('(max-width: 899px)');
  let selected = 0;

  function sync() {
    const focused = document.activeElement;
    tabs.hidden = !media.matches;
    panels.forEach((panel, i) => {
      panel.hidden = media.matches && i !== selected;
      buttons[i].setAttribute('aria-selected', String(i === selected));
      buttons[i].tabIndex = media.matches && i === selected ? 0 : -1;
      if (media.matches) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', buttons[i].id);
      } else {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-labelledby');
      }
    });
    if (media.matches && panels.some(panel => panel.hidden && panel.contains(focused))) buttons[selected].focus();
    if (!media.matches && buttons.includes(focused)) panels[selected].querySelector?.('button, summary, input, [tabindex]')?.focus();
  }
  buttons.forEach((button, i) => {
    button.addEventListener('click', () => { selected = i; sync(); });
    button.addEventListener('keydown', event => {
      if (!media.matches || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      selected = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      sync(); buttons[selected].focus();
    });
  });
  if (media.addEventListener) media.addEventListener('change', sync);
  else media.addListener(sync);
  sync();
})();
