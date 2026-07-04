/**
 * Dashboard zone rendering: shortcuts / stars / keywords / apps.
 * A `theme` (ledger / boxed / airy) controls the visual shell via ZoneFrame;
 * the list bodies are shared. Stars & keywords use a per-session cache.
 */
import React, {useEffect, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

import {KeywordDisplay, ScanSettings, Theme, Zone} from './config';
import {openFile, openFolder, launchApp} from './open';
import {scanStars, scanKeywords, noteTitle, parentFolder, KeywordHit} from './scanner';
import {getStars, setStars, getKeywords, setKeywords, formatScanTime, shouldAutoScan} from './scancache';
import {Btn, ui} from './ui';

export function ZoneView({zone, scan, theme}: {zone: Zone; scan: ScanSettings; theme: Theme}) {
  switch (zone.type) {
    case 'shortcuts':
      return <ShortcutsZone zone={zone} theme={theme} />;
    case 'stars':
      return <StarsZone zone={zone} scan={scan} theme={theme} />;
    case 'keywords':
      return <KeywordsZone zone={zone} scan={scan} theme={theme} />;
    case 'apps':
      return <AppsZone zone={zone} theme={theme} />;
  }
}

/** Themed shell around a zone's body. */
function ZoneFrame({
  theme,
  title,
  meta,
  children,
}: {
  theme: Theme;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (theme === 'boxed') {
    return (
      <View style={ui.boxFrame}>
        <View style={ui.boxCap}>
          <Text style={ui.boxCapText}>{title}</Text>
          {meta ? <Text style={ui.boxCapMeta}>{meta}</Text> : null}
        </View>
        <View style={ui.boxBody}>{children}</View>
      </View>
    );
  }
  if (theme === 'ledger') {
    return (
      <View style={ui.ledgerZone}>
        <View style={ui.ledgerHead}>
          <Text style={ui.ledgerLabel}>{title}</Text>
          {meta ? <Text style={ui.metaMono}>{meta}</Text> : null}
        </View>
        <View>{children}</View>
      </View>
    );
  }
  // airy
  return (
    <View style={ui.airyZone}>
      <Text style={ui.airyLabel}>
        {title}
        {meta ? '  ' : ''}
        {meta ? <Text style={ui.metaMono}>{meta}</Text> : null}
      </Text>
      <View>{children}</View>
    </View>
  );
}

// ---- Shortcuts ------------------------------------------------------------
function ShortcutsZone({zone, theme}: {zone: Extract<Zone, {type: 'shortcuts'}>; theme: Theme}) {
  return (
    <ZoneFrame theme={theme} title={zone.title || 'Shortcuts'}>
      {zone.items.length === 0 && <Text style={ui.empty}>(no shortcut configured)</Text>}
      {zone.items.map((it, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => {
            if (it.kind === 'folder') openFolder(it.path);
            else if (it.kind === 'note-page') openFile(it.path, it.page);
            else openFile(it.path, 0);
          }}>
          <Text style={ui.listItem}>
            {it.kind === 'folder' ? '📁' : /\.pdf$/i.test(it.path) ? '📕' : '📄'} {it.label}
            {it.kind === 'note-page' ? ` (p.${it.page})` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </ZoneFrame>
  );
}

// ---- Stars ----------------------------------------------------------------
function StarsZone({zone, scan, theme}: {zone: Extract<Zone, {type: 'stars'}>; scan: ScanSettings; theme: Theme}) {
  const folders = zone.folders ?? [];
  const cached = getStars(folders);
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const refresh = async () => {
    setBusy(true);
    setProgress('scan…');
    const res = await scanStars(folders, (d, t) => setProgress(`scan ${d}/${t}`));
    setStars(folders, {at: Date.now(), notes: res.notes, truncated: res.truncated, total: res.total});
    setBusy(false);
    setProgress('');
    force(x => x + 1);
  };
  useEffect(() => {
    if (!busy && shouldAutoScan(cached?.at, scan.autoRefreshHours, scan.autoOnOpen)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = `last scan: ${formatScanTime(cached?.at)}${cached?.truncated ? ' (trunc.)' : ''}`;
  return (
    <ZoneFrame theme={theme} title={zone.title || 'Stars'} meta={meta}>
      <View style={ui.refreshRow}>
        <Btn label={busy ? progress || 'scan…' : '↻ Refresh'} onPress={refresh} disabled={busy} small />
      </View>
      {!cached && !busy && <Text style={ui.empty}>(refresh to list stars)</Text>}
      {cached && cached.notes.length === 0 && <Text style={ui.empty}>No stars found.</Text>}
      {cached?.notes
        .slice()
        .sort((a, b) =>
          (zone.noteSort ?? 'recent') === 'name'
            ? noteTitle(a.file).localeCompare(noteTitle(b.file))
            : b.mtime - a.mtime,
        )
        .map((n, i) => (
        <View key={i}>
          <Text style={ui.noteHead}>★ {noteTitle(n.file)}</Text>
          {n.pages.map((p, j) => (
            <TouchableOpacity key={j} onPress={() => openFile(n.file, p.page)}>
              <Text style={ui.pageLine}>
                <Text style={ui.pageNum}>p.{p.page}</Text>
                {p.count > 1 ? ` ×${p.count}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ZoneFrame>
  );
}

// ---- Keywords -------------------------------------------------------------
function KeywordsZone({zone, scan, theme}: {zone: Extract<Zone, {type: 'keywords'}>; scan: ScanSettings; theme: Theme}) {
  const folders = zone.folders ?? [];
  const cached = getKeywords(folders, zone.filter ?? '');
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const refresh = async () => {
    setBusy(true);
    setProgress('scan…');
    const res = await scanKeywords(folders, zone.filter, (d, t) => setProgress(`scan ${d}/${t}`));
    setKeywords(folders, zone.filter ?? '', {at: Date.now(), hits: res.hits, truncated: res.truncated, total: res.total});
    setBusy(false);
    setProgress('');
    force(x => x + 1);
  };
  useEffect(() => {
    if (!busy && shouldAutoScan(cached?.at, scan.autoRefreshHours, scan.autoOnOpen)) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = `${zone.sort === 'note' ? 'by note' : 'by keyword'} · ${formatScanTime(cached?.at)}`;
  return (
    <ZoneFrame theme={theme} title={zone.title || 'Keywords'} meta={meta}>
      <View style={ui.refreshRow}>
        <Btn label={busy ? progress || 'scan…' : '↻ Refresh'} onPress={refresh} disabled={busy} small />
      </View>
      {!cached && !busy && <Text style={ui.empty}>(refresh to list keywords)</Text>}
      {cached && cached.hits.length === 0 && <Text style={ui.empty}>No keywords found.</Text>}
      {cached &&
        renderKeywords(
          filterHits(cached.hits, zone.keywords),
          zone.sort,
          zone.display ?? 'list',
          zone.noteSort ?? 'recent',
        )}
    </ZoneFrame>
  );
}

/** Keep only hits whose keyword is in the allowed set (empty/absent = all). */
function filterHits(hits: KeywordHit[], allowed?: string[]): KeywordHit[] {
  if (!allowed || allowed.length === 0) return hits;
  const set = new Set(allowed.map(k => k.toLowerCase()));
  return hits.filter(h => set.has(h.keyword.toLowerCase()));
}

function mostRecent(list: KeywordHit[]): KeywordHit {
  return list.reduce((a, b) => (b.mtime > a.mtime ? b : a));
}

function groupByKeyword(hits: KeywordHit[]): [string, KeywordHit[]][] {
  const g = new Map<string, KeywordHit[]>();
  for (const h of hits) (g.get(h.keyword) ?? g.set(h.keyword, []).get(h.keyword)!).push(h);
  return [...g.entries()];
}

function noteCmp(sort: 'recent' | 'name') {
  return (a: {file: string; mtime: number}, b: {file: string; mtime: number}) =>
    sort === 'name' ? noteTitle(a.file).localeCompare(noteTitle(b.file)) : b.mtime - a.mtime;
}

function renderKeywords(
  hits: KeywordHit[],
  sort: 'keyword' | 'note',
  display: KeywordDisplay,
  noteSort: 'recent' | 'name',
) {
  if (display === 'inline') return renderInline(hits, noteSort);
  if (display === 'byfolder') return renderByFolder(hits, noteSort);
  return sort === 'note' ? renderListByNote(hits, noteSort) : renderListByKeyword(hits);
}

/** A tappable bordered keyword chip. Opens the exact note+page it refers to. */
function KwChip({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={ui.chip}>{label}</Text>
    </TouchableOpacity>
  );
}

function groupByNote(hits: KeywordHit[]) {
  const g = new Map<string, {file: string; mtime: number; list: KeywordHit[]}>();
  for (const h of hits) {
    if (!g.has(h.file)) g.set(h.file, {file: h.file, mtime: h.mtime, list: []});
    g.get(h.file)!.list.push(h);
  }
  return [...g.values()];
}

// list · by keyword: bordered #keyword, then each occurrence as a tappable chip
function renderListByKeyword(hits: KeywordHit[]) {
  return groupByKeyword(hits).map(([kw, list], i) => (
    <View key={i} style={{marginTop: 6}}>
      <Text style={ui.noteHead}>#{kw}</Text>
      <View style={ui.row}>
        {list
          .slice()
          .sort((a, b) => b.mtime - a.mtime)
          .map((h, j) => (
            <KwChip key={j} label={`${noteTitle(h.file)} p.${h.page}`} onPress={() => openFile(h.file, h.page)} />
          ))}
      </View>
    </View>
  ));
}

// list · by note: note title, then a tappable #keyword chip per occurrence
function renderListByNote(hits: KeywordHit[], noteSort: 'recent' | 'name') {
  return groupByNote(hits)
    .sort(noteCmp(noteSort))
    .map(({file, list}, i) => (
      <View key={i} style={{marginTop: 6}}>
        <Text style={ui.noteHead}>{noteTitle(file)}</Text>
        <View style={ui.row}>
          {list
            .slice()
            .sort((a, b) => a.page - b.page)
            .map((h, j) => (
              <KwChip key={j} label={`#${h.keyword} p.${h.page}`} onPress={() => openFile(h.file, h.page)} />
            ))}
        </View>
      </View>
    ));
}

// inline: compact — note title + wrapped keyword chips on the same block
function renderInline(hits: KeywordHit[], noteSort: 'recent' | 'name') {
  return groupByNote(hits)
    .sort(noteCmp(noteSort))
    .map(({file, list}, i) => (
      <View key={i} style={[ui.row, {marginTop: 5, alignItems: 'center'}]}>
        <Text style={[ui.inlineKw, {marginRight: 6}]}>{noteTitle(file)}</Text>
        {list
          .slice()
          .sort((a, b) => a.page - b.page)
          .map((h, j) => (
            <KwChip key={j} label={`#${h.keyword} p.${h.page}`} onPress={() => openFile(h.file, h.page)} />
          ))}
      </View>
    ));
}

// byfolder: parent folder → note → keyword chips
function renderByFolder(hits: KeywordHit[], noteSort: 'recent' | 'name') {
  const g = new Map<string, KeywordHit[]>();
  for (const h of hits) {
    const f = parentFolder(h.file);
    (g.get(f) ?? g.set(f, []).get(f)!).push(h);
  }
  return [...g.entries()].map(([folder, list], i) => (
    <View key={i} style={{marginTop: 6}}>
      <Text style={ui.noteHead}>📁 {folder}</Text>
      {groupByNote(list)
        .sort(noteCmp(noteSort))
        .map(({file, list: nl}, j) => (
          <View key={j} style={{marginLeft: 8}}>
            <Text style={ui.pageLine}>{noteTitle(file)}</Text>
            <View style={ui.row}>
              {nl
                .slice()
                .sort((a, b) => a.page - b.page)
                .map((h, k) => (
                  <KwChip key={k} label={`#${h.keyword} p.${h.page}`} onPress={() => openFile(h.file, h.page)} />
                ))}
            </View>
          </View>
        ))}
    </View>
  ));
}

// ---- Apps -----------------------------------------------------------------
function AppsZone({zone, theme}: {zone: Extract<Zone, {type: 'apps'}>; theme: Theme}) {
  const appStyle = theme === 'boxed' ? ui.appTile : theme === 'ledger' ? ui.appUnderline : ui.appPlain;
  return (
    <ZoneFrame theme={theme} title={zone.title || 'Apps'}>
      {zone.apps.length === 0 && <Text style={ui.empty}>(no app configured)</Text>}
      <View style={ui.row}>
        {zone.apps.map((a, i) => (
          <TouchableOpacity key={i} onPress={() => launchApp(a.component)}>
            <Text style={appStyle}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ZoneFrame>
  );
}
