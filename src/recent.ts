/**
 * Recently-opened files, read live from the Supernote's own tracker
 * `/Recent/Recent.txt` (one absolute path per line, most-recent first — notes
 * and PDFs). Read via the native reader (not fetch, which caches file:// URLs),
 * so the list is always fresh.
 */
import {NativeModules} from 'react-native';

const {DashboardNative} = NativeModules;
const RECENT_PATH = '/storage/emulated/0/Recent/Recent.txt';

export async function readRecent(): Promise<string[]> {
  try {
    const text: string = await DashboardNative.readTextFile(RECENT_PATH);
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  } catch {
    return [];
  }
}
