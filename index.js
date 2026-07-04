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

const {DashboardNative} = NativeModules;

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

// Clear any bubble left over in the persistent PluginHost process from a
// previous plugin classloader (reinstall/reload → new classloader → stale
// static ref). clearAllBubbles reflects into WindowManagerGlobal to remove
// every tagged bubble, orphans included.
DashboardNative?.clearAllBubbles().catch(() => {});

// Two entry points → two surfaces:
//  - toolbar button → Config
//  - bubble tap → Dashboard
// Module-level listeners survive plugin-view close (component listeners don't).
DeviceEventEmitter.addListener('onBubbleTap', () => {
  setRoute('dashboard');
  DashboardNative?.hideBubble().catch(() => {});
  PluginManager.showPluginView();
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
