/**
 * On-device pickers for the Config surface: a folder/note file browser and an
 * app list. They call back with a selection; App.tsx applies it to the config.
 */
import React, {useEffect, useState} from 'react';
import {NativeModules, ScrollView, Text, TouchableOpacity, View} from 'react-native';

import {Btn, ui} from './ui';

const {DashboardNative} = NativeModules;

const NOTE_ROOT = '/storage/emulated/0/Note';

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  mtime: number;
}

function parentDir(p: string): string {
  const i = p.lastIndexOf('/');
  return i > 0 ? p.substring(0, i) : p;
}

export type FilePick =
  | {action: 'shortcut-folder'; path: string}
  | {action: 'shortcut-note'; path: string}
  | {action: 'scan-folder'; path: string};

/** Browse Note/, pick a folder (as shortcut or scan scope) or a note (shortcut). */
export function FileBrowser({
  onPick,
  onClose,
}: {
  onPick: (p: FilePick) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [dir, setDir] = useState(NOTE_ROOT);
  const [entries, setEntries] = useState<DirEntry[]>([]);

  const load = async (d: string) => {
    try {
      const list: DirEntry[] = (await DashboardNative.listDir(d)) ?? [];
      list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      setEntries(list);
      setDir(d);
    } catch {
      setEntries([]);
    }
  };
  useEffect(() => {
    load(NOTE_ROOT);
  }, []);

  return (
    <View style={{flex: 1}}>
      <View style={ui.row}>
        <Btn label="⬆" onPress={() => load(parentDir(dir))} disabled={dir === NOTE_ROOT} small />
        <Btn label="✕ close" onPress={onClose} small />
      </View>
      <Text style={ui.zoneMeta}>{dir}</Text>
      <View style={ui.row}>
        <Btn label="＋ this folder: shortcut" onPress={() => onPick({action: 'shortcut-folder', path: dir})} small />
        <Btn label="＋ this folder: scan" onPress={() => onPick({action: 'scan-folder', path: dir})} small />
      </View>
      <ScrollView style={ui.picker}>
        {entries.map((e, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => {
              if (e.isDir) load(e.path);
              else if (/\.note$/i.test(e.name)) onPick({action: 'shortcut-note', path: e.path});
            }}>
            <Text style={[ui.pickerItem, !e.isDir && !/\.note$/i.test(e.name) && {color: '#999'}]}>
              {e.isDir ? '📁 ' : /\.note$/i.test(e.name) ? '📄 ' : '   '}
              {e.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

interface AppEntry {
  label: string;
  packageName: string;
  component: string;
}

/** List launchable apps; tap one to add it to the Apps zone. */
export function AppPicker({
  onPick,
  onClose,
}: {
  onPick: (a: {label: string; component: string}) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [apps, setApps] = useState<AppEntry[]>([]);

  useEffect(() => {
    DashboardNative.listLaunchableApps()
      .then((list: AppEntry[]) => {
        list.sort((a, b) => a.label.localeCompare(b.label));
        setApps(list);
      })
      .catch(() => setApps([]));
  }, []);

  return (
    <View style={{flex: 1}}>
      <View style={ui.row}>
        <Btn label="✕ close" onPress={onClose} small />
        <Text style={ui.zoneMeta}>{apps.length} apps</Text>
      </View>
      <ScrollView style={ui.picker}>
        {apps.map((a, i) => (
          <TouchableOpacity key={i} onPress={() => onPick({label: a.label, component: a.component})}>
            <Text style={ui.pickerItem}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
