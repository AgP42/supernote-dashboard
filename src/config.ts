/**
 * Dashboard configuration: schema, defaults, load/save.
 * v1 = hand-edited JSON stored at MyStyle/Dashboard/config.json.
 * Read via fetch('file://…') (Android returns HTTP status 0 — ignore .ok),
 * written via the native writeFile (the SDK has no writeFile).
 */
import {NativeModules} from 'react-native';

const {DashboardNative} = NativeModules;

export const CONFIG_PATH = '/storage/emulated/0/MyStyle/Plugins/Dashboard/config.json';
const LEGACY_CONFIG_PATH = '/storage/emulated/0/MyStyle/Dashboard/config.json';

export type BubbleMode = 'icon' | 'label' | 'hint';

export type ShortcutItem =
  | {kind: 'folder'; label: string; path: string}
  | {kind: 'note-last'; label: string; path: string}
  | {kind: 'note-page'; label: string; path: string; page: number};

export interface AppItem {
  label: string;
  component: string; // "package/activity"
}

/** Keyword zone rendering styles. */
export type KeywordDisplay = 'list' | 'inline' | 'byfolder';

/** Order of notes within a Stars/Keywords zone. */
export type NoteSort = 'recent' | 'name';

export type Zone =
  | {type: 'shortcuts'; title?: string; items: ShortcutItem[]}
  | {type: 'stars'; title?: string; folders: string[]; noteSort?: NoteSort}
  | {
      type: 'keywords';
      title?: string;
      folders: string[];
      sort: 'keyword' | 'note';
      filter?: string;
      /** Which specific keywords to show (empty/absent = all). */
      keywords?: string[];
      display?: KeywordDisplay;
      noteSort?: NoteSort;
    }
  | {type: 'apps'; title?: string; apps: AppItem[]};

export interface ScanSettings {
  /** Auto-rescan a zone when its cache is older than this many hours (0 = off).
   *  A zone that has never been scanned always auto-scans on first view. */
  autoRefreshHours: number;
  /** Rescan every time the dashboard opens. */
  autoOnOpen: boolean;
}

/** Visual style of the zones (see docs/dashboard-designs.html). */
export type Theme = 'ledger' | 'boxed' | 'airy';
/** Zone arrangement: stacked (full width) or a two-column grid. */
export type Layout = 'stack' | 'grid';

export interface DashboardConfig {
  bubble: {mode: BubbleMode};
  scan: ScanSettings;
  theme: Theme;
  layout: Layout;
  zones: Zone[];
}

export const DEFAULT_CONFIG: DashboardConfig = {
  bubble: {mode: 'label'},
  scan: {autoRefreshHours: 24, autoOnOpen: false},
  theme: 'boxed',
  layout: 'stack',
  zones: [
    {
      type: 'shortcuts',
      title: 'Shortcuts',
      items: [{kind: 'folder', label: 'Notes', path: '/storage/emulated/0/Note'}],
    },
    {type: 'stars', title: 'Stars', folders: []},
    {
      type: 'keywords',
      title: 'Keywords',
      folders: [],
      sort: 'keyword',
    },
    {
      type: 'apps',
      title: 'Apps',
      apps: [
        {label: 'ToDo', component: 'com.ratta.supernote.task/com.ratta.supernote.task.TaskActivity'},
        {label: 'Calendar', component: 'com.ratta.supernote.calendar/com.ratta.supernote.calendar.MainActivity'},
      ],
    },
  ],
};

/** Load config from disk, falling back to DEFAULT_CONFIG if missing/invalid. */
async function readJson(path: string): Promise<string | null> {
  try {
    const res = await fetch('file://' + path);
    const text = await res.text();
    return text && text.trim() ? text : null;
  } catch {
    return null;
  }
}

export async function loadConfig(): Promise<DashboardConfig> {
  const text = (await readJson(CONFIG_PATH)) ?? (await readJson(LEGACY_CONFIG_PATH));
  if (!text) return DEFAULT_CONFIG;
  try {
    return normalize(JSON.parse(text));
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Persist config to disk. Returns true on success. */
export async function saveConfig(cfg: DashboardConfig): Promise<boolean> {
  try {
    await DashboardNative.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    return true;
  } catch {
    return false;
  }
}

/** Shallow validation so a malformed field can't crash the dashboard. */
function normalize(raw: any): DashboardConfig {
  const mode: BubbleMode =
    raw?.bubble?.mode === 'icon' || raw?.bubble?.mode === 'hint' ? raw.bubble.mode : 'label';
  const zones: Zone[] = Array.isArray(raw?.zones) ? raw.zones.filter(isZone) : DEFAULT_CONFIG.zones;
  const scan: ScanSettings = {
    autoRefreshHours:
      typeof raw?.scan?.autoRefreshHours === 'number' ? raw.scan.autoRefreshHours : 24,
    autoOnOpen: raw?.scan?.autoOnOpen === true,
  };
  const theme: Theme = ['ledger', 'boxed', 'airy'].includes(raw?.theme) ? raw.theme : 'boxed';
  const layout: Layout = raw?.layout === 'grid' ? 'grid' : 'stack';
  return {bubble: {mode}, scan, theme, layout, zones};
}

function isZone(z: any): z is Zone {
  return z && ['shortcuts', 'stars', 'keywords', 'apps'].includes(z.type);
}
