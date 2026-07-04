/**
 * Open a target from the dashboard, then leave to the OS so it comes to the
 * foreground (a target launched behind the fullscreen plugin view looks dead).
 * The bubble is restored on the way out so the user can return.
 */
import {NativeModules} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

import {showBubbleFromConfig} from './bubble';

const {DashboardNative} = NativeModules;

function parentDir(p: string): string {
  const i = p.lastIndexOf('/');
  return i > 0 ? p.substring(0, i) : p;
}

async function leave() {
  await showBubbleFromConfig(false); // restore bubble at its saved position
  setTimeout(() => PluginManager.closePluginView(), 150);
}

/** Open a note at a 1-based page (0/undefined → last-used page). */
export async function openNote(path: string, page = 0) {
  try {
    await DashboardNative.openNote(path, page);
  } finally {
    leave();
  }
}

/** Open a folder in the file manager. */
export async function openFolder(path: string) {
  try {
    await DashboardNative.openFolder(path);
  } finally {
    leave();
  }
}

/** Open a PDF/document in the Supernote Document viewer. */
export async function openDocument(path: string, page = 0) {
  try {
    await DashboardNative.openDocument(path, page);
  } finally {
    leave();
  }
}

/** Open a scan/shortcut file target (note editor for .note, Document viewer for .pdf). */
export async function openFile(path: string, page = 0) {
  if (/\.pdf$/i.test(path)) {
    return openDocument(path, page);
  }
  return openNote(path, page);
}

/** Launch an app by "package/activity"; leaves to the OS. */
export async function launchApp(component: string) {
  try {
    await DashboardNative.launchActivity(component);
  } finally {
    leave();
  }
}
