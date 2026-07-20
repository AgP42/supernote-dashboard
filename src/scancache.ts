/**
 * Per-session scan cache (v1). Keyed by scan kind + folder set so a zone shows
 * its last results with a timestamp without rescanning on every open.
 * Persisted-across-sessions caching is a v2 item.
 */
import {StarNote, KeywordHit, foldersKey} from './scanner';

interface StarsCacheEntry {
  at: number; // Date.now() of the scan
  notes: StarNote[];
  truncated: boolean;
  total: number;
}
interface KeywordsCacheEntry {
  at: number;
  hits: KeywordHit[];
  truncated: boolean;
  total: number;
}

const starsCache = new Map<string, StarsCacheEntry>();
const keywordsCache = new Map<string, KeywordsCacheEntry>();

const key = (roots: string[], extra = '') => foldersKey(roots) + '#' + extra;

export const getStars = (roots: string[], lineMode = 'off') => starsCache.get(key(roots, lineMode[0]));
export const setStars = (roots: string[], e: StarsCacheEntry, lineMode = 'off') =>
  starsCache.set(key(roots, lineMode[0]), e);

export const getKeywords = (roots: string[]) => keywordsCache.get(key(roots));
export const setKeywords = (roots: string[], e: KeywordsCacheEntry) => keywordsCache.set(key(roots), e);

/** Date-time label for a scan timestamp. */
export function formatScanTime(at: number | undefined): string {
  if (!at) return 'never';
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Decide whether a zone should auto-scan given its cache age and settings. */
export function shouldAutoScan(
  at: number | undefined,
  autoRefreshHours: number,
  autoOnOpen: boolean,
): boolean {
  if (!at) return true; // never scanned → scan on first view
  if (autoOnOpen) return true;
  if (autoRefreshHours > 0 && Date.now() - at >= autoRefreshHours * 3600_000) return true;
  return false;
}
