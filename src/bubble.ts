/**
 * Bubble control: show the floating bubble according to the current config's
 * display mode, then leave to the OS. Shared by the Config "activate bubble"
 * button and the Dashboard "fold to bubble" button.
 */
import {NativeModules} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

import {BubbleMode, loadConfig} from './config';

const {DashboardNative} = NativeModules;

/** label/hint strings for a given bubble display mode. */
export function bubbleTexts(mode: BubbleMode): {label: string; hint: string} {
  if (mode === 'icon') return {label: '', hint: ''};
  if (mode === 'hint') return {label: 'Dashboard', hint: '1 tap • long-press to close'};
  return {label: 'Dashboard', hint: ''}; // 'label'
}

/** Show the bubble using the saved config mode, then close the plugin view. */
export async function showBubbleFromConfig(closeAfter = true): Promise<boolean> {
  try {
    const cfg = await loadConfig();
    const {label, hint} = bubbleTexts(cfg.bubble.mode);
    await DashboardNative.showBubble(label, hint);
    if (closeAfter) {
      setTimeout(() => PluginManager.closePluginView(), 150);
    }
    return true;
  } catch {
    return false;
  }
}

/** Show the bubble with an explicit mode (used by the config preview). */
export async function showBubbleWithMode(mode: BubbleMode): Promise<boolean> {
  try {
    const {label, hint} = bubbleTexts(mode);
    await DashboardNative.showBubble(label, hint);
    return true;
  } catch {
    return false;
  }
}
