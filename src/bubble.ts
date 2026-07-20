/**
 * Bubble control and the single exit path out of the plugin view.
 * leavePlugin() is the ONLY caller of closePluginView in the plugin: every
 * exit (open a target, fold ⊖, Settings ✕) restores the bubble per config
 * before closing, so no path can strand a hidden bubble.
 */
import {NativeModules} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

import {BubbleMode, loadConfig} from './config';

const {DashboardNative} = NativeModules;

/** label/hint strings for a given bubble display mode. */
function bubbleTexts(mode: BubbleMode): {label: string; hint: string} {
  if (mode === 'icon') return {label: '', hint: ''};
  if (mode === 'hint') return {label: 'Dashboard', hint: 'Tap to open · drag to move'};
  return {label: 'Dashboard', hint: ''}; // 'label'
}

/** Apply the saved bubble mode (show it, or remove it when 'off'). */
export async function showBubbleFromConfig(): Promise<boolean> {
  try {
    const cfg = await loadConfig();
    if (cfg.bubble.mode === 'off') {
      await DashboardNative.hideBubble(); // no bubble — make sure none lingers
    } else {
      const {label, hint} = bubbleTexts(cfg.bubble.mode);
      await DashboardNative.showBubble(label, hint);
    }
    return true;
  } catch {
    return false;
  }
}

/** Restore the bubble, then close the plugin view. */
export async function leavePlugin(): Promise<void> {
  await showBubbleFromConfig();
  setTimeout(() => PluginManager.closePluginView(), 150);
}
