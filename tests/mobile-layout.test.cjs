const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Substitute only the DOM/media-query boundary. The shipped selection and
// resize logic runs unchanged, including keyboard events and focus recovery.
function layout(mobile) {
  let focused = null;
  const elements = new Map();
  function element(id) {
    const attributes = {}, listeners = {};
    const node = { id, hidden: false, tabIndex: 0,
      setAttribute(key, value) { attributes[key] = value; },
      getAttribute(key) { return attributes[key]; },
      removeAttribute(key) { delete attributes[key]; },
      addEventListener(type, listener) { listeners[type] = listener; },
      focus() { focused = node; },
      contains(other) { return other?.panel === node; },
      event(type, detail = {}) { listeners[type]?.({ preventDefault() {}, ...detail }); }
    };
    elements.set(id, node); return node;
  }
  const tabs = element('mobileTabs');
  const buttons = ['outfits', 'responses', 'atmosphere'].map(key => element('mobile-tab-' + key));
  const panels = ['outfits', 'responses', 'atmosphere'].map(key => element('mobile-panel-' + key));
  const media = { matches: mobile, addEventListener(type, listener) { this.change = listener; } };
  const document = { getElementById: id => elements.get(id), get activeElement() { return focused; } };
  const source = path.resolve(__dirname, '../js/mobile-layout.js');
  if (fs.existsSync(source)) vm.runInNewContext(fs.readFileSync(source, 'utf8'), { document, window: { matchMedia: () => media } });
  return { tabs, buttons, panels, focus: () => focused, setFocus(node) { focused = node; },
    resize(value) { media.matches = value; media.change?.(); }
  };
}

test('phone starts with reachable outfit controls and hides the two inactive groups', () => {
  const { tabs, buttons, panels } = layout(true);
  assert.equal(tabs.hidden, false);
  assert.deepEqual(panels.map(panel => panel.hidden), [false, true, true]);
  assert.deepEqual(buttons.map(button => button.tabIndex), [0, -1, -1]);
  buttons[2].event('click');
  assert.deepEqual(panels.map(panel => panel.hidden), [true, true, false]);
  assert.equal(buttons[2].getAttribute('aria-selected'), 'true');
});

test('desktop exposes every control, including after resizing back from a phone', () => {
  const { tabs, buttons, panels, resize } = layout(false);
  assert.equal(tabs.hidden, true);
  assert.ok(panels.every(panel => !panel.hidden));
  resize(true); buttons[1].event('click'); resize(false);
  assert.equal(tabs.hidden, true);
  assert.ok(panels.every(panel => !panel.hidden), 'mobile grouping hid desktop controls');
  assert.ok(panels.every(panel => !panel.getAttribute('role')));
  resize(true);
  assert.deepEqual(panels.map(panel => panel.hidden), [true, false, true]);
});

test('arrow, Home and End keys select one reachable phone group and move focus', () => {
  const { buttons, panels, focus } = layout(true);
  buttons[0].event('keydown', { key: 'ArrowLeft' });
  assert.equal(focus(), buttons[2]);
  assert.deepEqual(panels.map(panel => panel.hidden), [true, true, false]);
  buttons[2].event('keydown', { key: 'Home' });
  assert.equal(focus(), buttons[0]);
  buttons[0].event('keydown', { key: 'End' });
  assert.equal(focus(), buttons[2]);
});

test('shrinking the screen moves focus out of a control that becomes hidden', () => {
  const { buttons, panels, resize, focus, setFocus } = layout(false);
  const lightControl = { panel: panels[2] };
  // A desktop light input is focused before the viewport becomes narrow.
  // Recover focus to the outfit tab instead of leaving it in a hidden panel.
  panels[2].contains = other => other === lightControl;
  setFocus(lightControl);
  resize(true);
  assert.equal(focus(), buttons[0]);
});
