/**
 * Device scanner for the Stars and Keywords zones.
 * Walks user-chosen folders via the native listDir (gives mtime), then reads
 * five-stars / keywords through the SDK. Notes only (SDK APIs don't cover PDFs).
 */
import {NativeModules} from 'react-native';
import {PluginFileAPI} from 'sn-plugin-lib';

const {DashboardNative} = NativeModules;

const MAX_FILES = 800; // safety cap on notes collected in one scan
const MAX_DIRS = 600; // safety cap on directories visited (bounds full-device scans)
const DEVICE_ROOT = '/storage/emulated/0'; // scanned when no folder is selected

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  mtime: number;
}

function unwrap<T>(res: any): T | undefined {
  if (res == null) return undefined;
  if (Array.isArray(res)) return res as T;
  if (res.result !== undefined) return res.result as T;
  return res as T;
}

// The SDK's per-file APIs aren't re-entrant: running the Stars and Keywords
// scans concurrently (both auto-scan on mount) makes one fail silently. Serialize
// all scans so only one runs at a time.
let scanChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = scanChain.then(fn, fn);
  scanChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Dedupe concurrent scans of the same folder set (several zones scanning the
// same folders share one scan instead of each redoing the work).
const inflight = new Map<string, Promise<any>>();
function foldersKey(folders: string[]): string {
  return (folders ?? []).slice().sort().join('|');
}
function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export interface NoteFile {
  path: string;
  mtime: number;
}

/** Recursively collect .note files under the given roots, newest first. */
async function collectNotes(roots: string[]): Promise<{files: NoteFile[]; truncated: boolean}> {
  const out: NoteFile[] = [];
  // No folder selected → scan the whole device (bounded by the caps below).
  const start = [...(roots ?? [])].filter(Boolean);
  const stack = start.length ? start : [DEVICE_ROOT];
  let truncated = false;
  const seen = new Set<string>();
  while (stack.length) {
    if (out.length >= MAX_FILES || seen.size >= MAX_DIRS) {
      truncated = true;
      break;
    }
    const dir = stack.pop()!;
    if (seen.has(dir)) continue;
    seen.add(dir);
    let entries: DirEntry[] = [];
    try {
      entries = (await DashboardNative.listDir(dir)) ?? [];
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDir) {
        stack.push(e.path);
      } else if (/\.note$/i.test(e.name)) {
        out.push({path: e.path, mtime: e.mtime});
      }
    }
  }
  out.sort((a, b) => b.mtime - a.mtime); // most recent first
  return {files: out, truncated};
}

export interface StarNote {
  file: string;
  mtime: number;
  pages: {page: number; count: number}[]; // 1-based page, star count on that page
}

/** Stars grouped by note (recent notes first). page is 1-based; count = stars on that page. */
export function scanStars(
  roots: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<{notes: StarNote[]; truncated: boolean; total: number}> {
  return dedupe('S#' + foldersKey(roots), () => serialize(() => scanStarsImpl(roots, onProgress)));
}

async function scanStarsImpl(
  roots: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<{notes: StarNote[]; truncated: boolean; total: number}> {
  const {files, truncated} = await collectNotes(roots);
  const notes: StarNote[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const pageIdx = unwrap<number[]>(await PluginFileAPI.searchFiveStars(f.path)) ?? [];
      if (pageIdx.length) {
        const counts = new Map<number, number>();
        for (const p of pageIdx) counts.set(p + 1, (counts.get(p + 1) ?? 0) + 1); // 0→1-based
        const pages = [...counts.entries()]
          .map(([page, count]) => ({page, count}))
          .sort((a, b) => a.page - b.page);
        notes.push({file: f.path, mtime: f.mtime, pages});
      }
    } catch {
      /* skip unreadable */
    }
    onProgress?.(i + 1, files.length);
  }
  return {notes, truncated, total: files.length};
}

export interface KeywordHit {
  keyword: string;
  file: string;
  mtime: number;
  page: number; // 1-based
}

/** Flat keyword occurrences across the chosen roots (notes recent first). */
export function scanKeywords(
  roots: string[],
  filter: string | undefined,
  onProgress?: (done: number, total: number) => void,
): Promise<{hits: KeywordHit[]; truncated: boolean; total: number}> {
  // Dedupe by folders only (all keywords are scanned; per-zone keyword
  // selection is applied at render), so multiple keyword zones over the same
  // folders share one scan.
  return dedupe('K#' + foldersKey(roots), () => serialize(() => scanKeywordsImpl(roots, filter, onProgress)));
}

async function scanKeywordsImpl(
  roots: string[],
  filter: string | undefined,
  onProgress?: (done: number, total: number) => void,
): Promise<{hits: KeywordHit[]; truncated: boolean; total: number}> {
  const {files, truncated} = await collectNotes(roots);
  const hits: KeywordHit[] = [];
  const needle = filter?.trim().toLowerCase();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const total = unwrap<number>(await PluginFileAPI.getNoteTotalPageNum(f.path)) ?? 0;
      const pageList = Array.from({length: total}, (_, k) => k);
      const kws = unwrap<any[]>(await PluginFileAPI.getKeyWords(f.path, pageList)) ?? [];
      for (const k of kws) {
        const keyword = k?.keyword ?? '';
        if (needle && !keyword.toLowerCase().includes(needle)) continue;
        hits.push({keyword, file: f.path, mtime: f.mtime, page: (k?.page ?? 0) + 1});
      }
    } catch {
      /* skip */
    }
    onProgress?.(i + 1, files.length);
  }
  return {hits, truncated, total: files.length};
}

export function basename(path: string): string {
  return path.substring(path.lastIndexOf('/') + 1);
}

export function noteTitle(path: string): string {
  return basename(path).replace(/\.(note|pdf)$/i, '');
}

export function parentFolder(path: string): string {
  const dir = path.substring(0, path.lastIndexOf('/'));
  return dir.substring(dir.lastIndexOf('/') + 1) || dir;
}
