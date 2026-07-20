/**
 * Dashboard — a configurable, always-available dashboard for Supernote.
 * The bubble (⊕) floats over everything; tap expands the dashboard.
 * @format
 */

import {AppRegistry, DeviceEventEmitter, Image, NativeModules} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

import {PluginManager} from 'sn-plugin-lib';
import {setRoute} from './src/route';
import {showBubbleFromConfig} from './src/bubble';

const {DashboardNative} = NativeModules;

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

// Clear any bubble left over in the persistent PluginHost process from a
// previous plugin classloader (reinstall/reload → new classloader → stale
// static ref). clearAllBubbles reflects into WindowManagerGlobal to remove
// every tagged bubble, orphans included.
DashboardNative?.clearAllBubbles().catch(() => {});

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
  // Do NOT hide the bubble here: showPluginView() can resolve true without the
  // view actually surfacing (device log shows many taps with no mount), which
  // stranded the user with no bubble and no dashboard. The bubble is hidden by
  // DashboardScreen once it is really on screen; a no-show just leaves the
  // bubble in place for a second tap.
  try {
    const shown = await PluginManager.showPluginView();
    if (!shown) DashboardNative?.appendLog?.('[bub] showPluginView=false (bubble kept)').catch(() => {});
  } catch (e) {}
});
PluginManager.addPluginLifeListener({
  // Belt-and-suspenders: on firmwares that emit the plugin life 'start' event,
  // also remove the bubble when the view actually shows (no-op where it doesn't).
  onStart: () => {
    DashboardNative?.hideBubble().catch(() => {});
  },
  // If the host closes the view without going through our buttons, restore the
  // bubble so the user can get back in ('off' mode is respected by the config).
  onStop: () => {
    showBubbleFromConfig(false).catch(() => {});
  },
});

PluginManager.registerButton(1, ['NOTE', 'DOC'], {
  id: 100,
  name: 'Dashboard',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});

PluginManager.registerButtonListener({
  onButtonPress() {
    setRoute('config');
  },
});
