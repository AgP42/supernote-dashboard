/**
 * Dashboard — a configurable, always-available dashboard for Supernote.
 * The bubble (⊕) floats over everything; tap expands the dashboard.
 * @format
 */

import {AppRegistry, AppState, DeviceEventEmitter, Image, NativeModules} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

import {PluginManager} from 'sn-plugin-lib';
import {setRoute} from './src/route';
import {showBubbleFromConfig} from './src/bubble';
import {hasSavedConfig} from './src/config';

const {DashboardNative} = NativeModules;

// On-device tracing for the bubble lifecycle. The firmware doesn't log window
// removals and hideBubble() is silent, so without this the only way to know why
// the bubble vanished is guesswork (we guessed wrong twice). Timestamped;
// appendLog caps the file at 256 KB.
function blog(msg) {
  const t = new Date();
  const p = n => String(n).padStart(2, '0');
  DashboardNative?.appendLog?.(`${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())} ${msg}`).catch(() => {});
}

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

// The bubble is a pure function of whether the plugin view is REALLY on screen,
// and AppState is the OS-level truth for that. (measureInWindow only sees
// layout, which persists on the kept-mounted dashboard view even when it is not
// visible — that stale read hid the bubble whenever showPluginView() silently
// failed to surface, losing the bubble with no dashboard.) View foreground →
// hide the bubble; not foreground → restore it (no-op when mode 'off'). This
// self-heals every exit path (buttons, system gesture, host backgrounding) and
// a failed tap simply keeps the bubble since the view never becomes active.
let lastState = AppState.currentState;
let activeSince = 0;
blog(`[state] initial=${lastState}`);
AppState.addEventListener('change', next => {
  const now = Date.now();
  blog(`[state] ${lastState} -> ${next}`);
  if (next === 'active') {
    activeSince = now;
    blog('[bub] hide (view active)');
    DashboardNative?.hideBubble?.().catch(() => {});
  } else {
    // A view that goes active→background in under 1.5 s is the "won't open"
    // symptom: the view surfaced then was closed by an external actor (the
    // Dashboard never closes its own view outside its buttons). Flag it so the
    // next occurrence is unambiguous in the log.
    const dwell = lastState === 'active' && activeSince ? now - activeSince : -1;
    if (dwell >= 0 && dwell < 1500) blog(`[warn] PARASITE close after ${dwell}ms`);
    showBubbleFromConfig()
      .then(ok => blog(`[bub] restore (view ${next}) = ${ok}`))
      .catch(() => {});
  }
  lastState = next;
});

// Clear any bubble left over in the persistent PluginHost process from a
// previous plugin classloader (reinstall/reload → new classloader → stale
// static ref), THEN restore the bubble from config: the bubble dies with the
// PluginHost process (reboot, auto power off, crash) and nothing else brings
// it back. 'off' mode stays off. Sequenced so the cleanup can't race the
// freshly shown bubble away.
(async () => {
  try {
    await DashboardNative?.clearAllBubbles();
  } catch (e) {}
  const ok = await showBubbleFromConfig().catch(() => false);
  blog(`[bub] load restore = ${ok}`);
})();

// PluginHost keeps every past version's files on reinstall (the plugin's size
// balloons over time). We run in its process, so reclaim old versions on load.
(async () => {
  try {
    const dir = await PluginManager.getPluginDirPath();
    if (dir) await DashboardNative?.cleanupOldVersions(dir);
  } catch (e) {}
})();

// Two entry points → two surfaces:
//  - toolbar button → Config
//  - bubble tap → Dashboard
// Module-level listeners survive plugin-view close (component listeners don't).
DeviceEventEmitter.addListener('onBubbleTap', async () => {
  setRoute('dashboard');
  // Ask for the view; the bubble is NOT touched here. If the view actually
  // surfaces, AppState → 'active' hides it; if showPluginView lies (returns
  // true without surfacing), AppState never flips and the bubble stays for a
  // second tap. showPluginView's own return is logged but never trusted.
  let shown;
  try {
    shown = await PluginManager.showPluginView();
  } catch (e) {
    shown = `err:${e && e.message}`;
  }
  blog(`[bub] tap -> showPluginView=${shown}`);
});
// Observation only — act on nothing. The host dispatches life events for OTHER
// plugins' activity too, so acting here once silently killed the bubble.
PluginManager.addPluginLifeListener({
  onStart: () => blog('[life] start'),
  onStop: () => blog('[life] stop'),
});

PluginManager.registerButton(1, ['NOTE', 'DOC'], {
  id: 100,
  name: 'Dashboard',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});

PluginManager.registerButtonListener({
  // Toolbar button → Dashboard, except on first open (no config ever saved),
  // where Settings is the useful landing page. The dashboard's ⚙ still leads
  // to Settings afterwards.
  onButtonPress() {
    blog('[btn] toolbar pressed');
    (async () => {
      let saved = false;
      try {
        saved = await hasSavedConfig();
      } catch (e) {
        blog(`[btn] hasSavedConfig error: ${e && e.message}`);
      }
      blog(`[btn] hasSavedConfig=${saved} -> route=${saved ? 'dashboard' : 'config'}`);
      setRoute(saved ? 'dashboard' : 'config');
    })();
  },
});
