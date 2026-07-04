/**
 * Settings — a guided wizard (Save happens on each Next):
 *   1 Layout + Bubble   2 Design (theme)   3 Sections (+ live preview)
 *   4 Content (per-zone details, refresh, sorts)   5 Finish
 * A ✕ (top-right) closes the plugin from any step. No JSON editor here —
 * advanced users edit MyStyle/Plugins/Dashboard/config.json directly.
 */
import React, {useEffect, useState} from 'react';
import {NativeModules, ScrollView, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {PluginManager} from 'sn-plugin-lib';

import {
  BubbleMode,
  DashboardConfig,
  DEFAULT_CONFIG,
  KeywordDisplay,
  Layout,
  loadConfig,
  NoteSort,
  saveConfig,
  Theme,
  Zone,
} from './config';
import {setRoute} from './route';
import {showBubbleFromConfig} from './bubble';
import {scanKeywords, basename} from './scanner';
import {APP_BLOCK, CURATED_APPS} from './apps';
import {Btn, ui} from './ui';

const {DashboardNative} = NativeModules;
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

type Modal =
  | null
  | {kind: 'browse'; allow: 'folder' | 'note' | 'pdf'; onPick: (path: string) => void}
  | {kind: 'apps'; onPick: (a: {label: string; component: string}) => void}
  | {kind: 'kw'; folders: string[]; onPick: (kw: string) => void}
  | {kind: 'text'; title: string; initial: string; onSubmit: (t: string) => void};

const STEP_TITLES = ['Look', 'Sections', 'Content', 'Finish'];
const LAST_STEP = STEP_TITLES.length;

export function SettingsScreen(): React.JSX.Element {
  const [cfg, setCfg] = useState<DashboardConfig | null>(null);
  const [step, setStep] = useState(1);
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => {
    loadConfig().then(setCfg);
  }, []);

  const update = (fn: (c: DashboardConfig) => void) => {
    if (!cfg) return;
    const next = clone(cfg);
    fn(next);
    setCfg(next);
    saveConfig(next); // autosave: nothing is lost on Back / ✕ / navigation
  };

  const goNext = () => setStep(s => Math.min(LAST_STEP, s + 1));
  const goBack = () => setStep(s => Math.max(1, s - 1));

  if (!cfg) return <View style={ui.container}><Text style={ui.hint}>loading…</Text></View>;
  if (modal) return <ModalHost modal={modal} close={() => setModal(null)} />;

  return (
    <View style={ui.container}>
      <View style={ui.header}>
        <Text style={ui.wizTitle}>
          {step}/{LAST_STEP} · {STEP_TITLES[step - 1]}
        </Text>
        <TouchableOpacity style={ui.iconBtn} onPress={() => PluginManager.closePluginView()}>
          <Text style={ui.iconText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{flex: 1}}>
        {step === 1 && <StepLook cfg={cfg} update={update} />}
        {step === 2 && <StepSections cfg={cfg} update={update} />}
        {step === 3 && <StepContent cfg={cfg} update={update} openModal={setModal} />}
        {step === 4 && <StepFinish cfg={cfg} update={update} />}
      </ScrollView>

      <View style={ui.navBar}>
        {step > 1 ? (
          <TouchableOpacity style={ui.navBtn} onPress={goBack}>
            <Text style={ui.navBtnText}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        {step < LAST_STEP ? (
          <TouchableOpacity style={[ui.navBtn, ui.navBtnPri]} onPress={goNext}>
            <Text style={[ui.navBtnText, ui.navBtnTextPri]}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>
    </View>
  );
}

type UP = (fn: (c: DashboardConfig) => void) => void;

// ===== Step 1 — Look (Layout + Design + Bubble) ============================
function StepLook({cfg, update}: {cfg: DashboardConfig; update: UP}) {
  const cols = cfg.layout === 'grid' ? 2 : 1;
  return (
    <View>
      <Text style={ui.wizStepTag}>Layout</Text>
      <View style={ui.snapWrap}>
        <Snap width={210} on={cfg.layout === 'stack'} label="1 column" onPress={() => update(c => void (c.layout = 'stack'))}>
          <MiniPage theme={cfg.theme} cols={1} zones={sampleZones} width={210} />
        </Snap>
        <Snap width={210} on={cfg.layout === 'grid'} label="2 columns" onPress={() => update(c => void (c.layout = 'grid'))}>
          <MiniPage theme={cfg.theme} cols={2} zones={sampleZones} width={210} />
        </Snap>
      </View>

      <Text style={ui.wizStepTag}>Design — on your {cols === 2 ? '2-column' : '1-column'} layout</Text>
      <View style={ui.snapWrap}>
        {(['ledger', 'boxed', 'airy'] as Theme[]).map(t => (
          <Snap key={t} width={185} on={cfg.theme === t} label={t} onPress={() => update(c => void (c.theme = t))}>
            <MiniPage theme={t} cols={cols} zones={sampleZones} width={185} />
          </Snap>
        ))}
      </View>

      <Text style={ui.wizStepTag}>Bubble</Text>
      <View style={ui.snapWrap}>
        {(['icon', 'label', 'hint'] as BubbleMode[]).map(m => (
          <Snap key={m} width={130} on={cfg.bubble.mode === m} label={m === 'icon' ? '⊕ only' : m === 'label' ? '⊕ + label' : '⊕ + hint'} onPress={() => update(c => void (c.bubble.mode = m))}>
            <View style={{height: 120, width: 130, alignItems: 'center', justifyContent: 'center'}}>
              <Text style={{fontSize: 34, color: '#000'}}>⊕</Text>
              {m !== 'icon' && <Text style={{fontSize: 13, fontWeight: '700', color: '#000'}}>Dashboard</Text>}
              {m === 'hint' && <Text style={{fontSize: 10, color: '#555'}}>1 tap • long-press</Text>}
            </View>
          </Snap>
        ))}
      </View>
    </View>
  );
}

// ===== Step 3 — Sections ===================================================
function StepSections({cfg, update}: {cfg: DashboardConfig; update: UP}) {
  const cols = cfg.layout === 'grid' ? 2 : 1;
  return (
    <View>
      <Text style={ui.wizStepTag}>Live preview</Text>
      <View style={{alignItems: 'center', marginBottom: 14}}>
        <MiniPage theme={cfg.theme} cols={cols} zones={cfg.zones.map(z => ({type: z.type, title: z.title}))} width={270} />
      </View>

      <Text style={ui.wizStepTag}>Sections (fill the layout in order)</Text>
      {cfg.zones.map((z, i) => (
        <View key={i} style={ui.zoneRow}>
          <Text style={ui.zoneRowText}>
            {i + 1}. {z.type}
            {z.title ? ` — ${z.title}` : ''}
          </Text>
          <View style={ui.zoneRowBtns}>
            <Mini label="▲" onPress={() => update(c => moveZone(c, i, -1))} />
            <Mini label="▼" onPress={() => update(c => moveZone(c, i, 1))} />
            <Mini label="✕" onPress={() => update(c => void c.zones.splice(i, 1))} />
          </View>
        </View>
      ))}
      <Text style={ui.subLabel}>Add a section</Text>
      <View style={ui.row}>
        {(['shortcuts', 'stars', 'keywords', 'apps'] as Zone['type'][]).map(t => (
          <Btn key={t} label={`＋ ${t}`} onPress={() => update(c => c.zones.push(newZone(t)))} small />
        ))}
      </View>
    </View>
  );
}

// ===== Step 4 — Content ====================================================
function StepContent({cfg, update, openModal}: {cfg: DashboardConfig; update: UP; openModal: (m: Modal) => void}) {
  return (
    <View>
      <Text style={ui.wizStepTag}>Refresh (Stars & Keywords)</Text>
      <View style={ui.row}>
        <Seg
          options={[
            {v: 'open', label: 'On open'},
            {v: '6', label: 'Stale > 6h'},
            {v: '24', label: 'Stale > 24h'},
            {v: 'off', label: 'Manual'},
          ]}
          value={cfg.scan.autoOnOpen ? 'open' : cfg.scan.autoRefreshHours === 0 ? 'off' : String(cfg.scan.autoRefreshHours)}
          onChange={v =>
            update(c => {
              if (v === 'open') {c.scan.autoOnOpen = true;}
              else {c.scan.autoOnOpen = false; c.scan.autoRefreshHours = v === 'off' ? 0 : Number(v);}
            })
          }
        />
      </View>

      {cfg.zones.length === 0 && <Text style={ui.hint}>No section yet — add some in step 3.</Text>}
      {cfg.zones.map((z, i) => (
        <View key={i} style={ui.contentCard}>
          <Text style={ui.zoneRowText}>
            Section {z.type} #{typeIndex(cfg.zones, i)}
          </Text>
          <EditableTitle
            value={z.title ?? z.type}
            onSave={t => update(c => void (c.zones[i].title = t || undefined))}
          />
          {z.type === 'shortcuts' && <ShortcutsEditor i={i} zone={z} update={update} openModal={openModal} />}
          {z.type === 'stars' && (
            <View>
              <FoldersEditor i={i} folders={z.folders} update={update} openModal={openModal} what="stars" />
              <NoteSortRow i={i} value={z.noteSort ?? 'recent'} update={update} />
            </View>
          )}
          {z.type === 'keywords' && <KeywordsEditor i={i} zone={z} update={update} openModal={openModal} />}
          {z.type === 'apps' && <AppsEditor i={i} zone={z} update={update} openModal={openModal} />}
        </View>
      ))}
    </View>
  );
}

// ===== Step 5 — Finish =====================================================
function StepFinish({cfg, update}: {cfg: DashboardConfig; update: UP}) {
  return (
    <View>
      <Text style={ui.hint}>Your dashboard is saved. What next?</Text>
      <View style={{gap: 10 as any}}>
        <Btn label="▦ Go to Dashboard" onPress={() => setRoute('dashboard')} />
        <Btn label="⊕ Activate Bubble & close" onPress={() => showBubbleFromConfig()} />
        <Btn
          label="↺ Reset to defaults"
          onPress={() => update(c => Object.assign(c, clone(DEFAULT_CONFIG)))}
        />
      </View>
    </View>
  );
}

// ===== per-zone editors ====================================================
type EditorProps<T extends Zone['type']> = {i: number; zone: Extract<Zone, {type: T}>; update: UP; openModal: (m: Modal) => void};

function ShortcutsEditor({i, zone, update, openModal}: EditorProps<'shortcuts'>) {
  return (
    <View>
      {zone.items.map((it, j) => (
        <View key={j} style={ui.itemRow}>
          <Text style={ui.itemText}>
            {it.kind === 'folder' ? '📁' : /\.pdf$/i.test(it.path) ? '📕' : '📄'} {it.label}
          </Text>
          <View style={ui.zoneRowBtns}>
            <Mini label="▲" onPress={() => update(c => moveItem((c.zones[i] as any).items, j, -1))} />
            <Mini label="▼" onPress={() => update(c => moveItem((c.zones[i] as any).items, j, 1))} />
            <Mini label="✕" onPress={() => update(c => void (c.zones[i] as any).items.splice(j, 1))} />
          </View>
        </View>
      ))}
      <View style={ui.row}>
        <Btn label="＋ Folder" onPress={() => openModal({kind: 'browse', allow: 'folder', onPick: p => update(c => (c.zones[i] as any).items.push({kind: 'folder', label: basename(p), path: p}))})} small />
        <Btn label="＋ Note" onPress={() => openModal({kind: 'browse', allow: 'note', onPick: p => update(c => (c.zones[i] as any).items.push({kind: 'note-last', label: cleanName(p), path: p}))})} small />
        <Btn label="＋ PDF" onPress={() => openModal({kind: 'browse', allow: 'pdf', onPick: p => update(c => (c.zones[i] as any).items.push({kind: 'note-last', label: cleanName(p), path: p}))})} small />
      </View>
    </View>
  );
}

function FoldersEditor({i, folders, update, openModal, what}: {i: number; folders: string[]; update: UP; openModal: (m: Modal) => void; what: string}) {
  const empty = (folders ?? []).length === 0;
  return (
    <View>
      <Text style={ui.subLabel}>Folders to scan for {what}</Text>
      {empty && (
        <Text style={ui.empty}>
          No folder selected — the whole device is scanned at each refresh.
        </Text>
      )}
      {(folders ?? []).map((f, j) => (
        <View key={j} style={ui.itemRow}>
          <Text style={ui.itemText}>📁 {basename(f) || f}</Text>
          <Mini label="✕" onPress={() => update(c => void (c.zones[i] as any).folders.splice(j, 1))} />
        </View>
      ))}
      <Btn label="＋ Folder" onPress={() => openModal({kind: 'browse', allow: 'folder', onPick: p => update(c => {const z = c.zones[i] as any; z.folders = z.folders ?? []; if (!z.folders.includes(p)) z.folders.push(p);})})} small />
    </View>
  );
}

function NoteSortRow({i, value, update}: {i: number; value: NoteSort; update: UP}) {
  return (
    <View style={{marginTop: 6}}>
      <Text style={ui.subLabel}>Note order</Text>
      <Seg
        options={[{v: 'recent', label: 'By date'}, {v: 'name', label: 'By name'}]}
        value={value}
        onChange={v => update(c => void ((c.zones[i] as any).noteSort = v))}
      />
    </View>
  );
}

function KeywordsEditor({i, zone, update, openModal}: EditorProps<'keywords'>) {
  const specific = (zone.keywords?.length ?? 0) > 0;
  return (
    <View>
      <FoldersEditor i={i} folders={zone.folders} update={update} openModal={openModal} what="keywords" />
      <NoteSortRow i={i} value={zone.noteSort ?? 'recent'} update={update} />
      <View style={{marginTop: 6}}>
        <Text style={ui.subLabel}>Group by</Text>
        <Seg options={[{v: 'keyword', label: 'Keyword'}, {v: 'note', label: 'Note'}]} value={zone.sort} onChange={v => update(c => void ((c.zones[i] as any).sort = v))} />
        <Text style={ui.subLabel}>View</Text>
        <Seg
          options={[{v: 'list', label: 'List'}, {v: 'inline', label: 'Inline'}, {v: 'byfolder', label: 'By folder'}]}
          value={zone.display ?? 'list'}
          onChange={v => update(c => void ((c.zones[i] as any).display = v as KeywordDisplay))}
        />
      </View>
      <Text style={ui.subLabel}>Keywords: {specific ? 'selected' : 'all'}</Text>
      {(zone.keywords ?? []).map((kw, j) => (
        <View key={j} style={ui.itemRow}>
          <Text style={ui.itemText}>#{kw}</Text>
          <Mini label="✕" onPress={() => update(c => void (c.zones[i] as any).keywords.splice(j, 1))} />
        </View>
      ))}
      <View style={ui.row}>
        <Btn label="＋ Keyword" onPress={() => openModal({kind: 'kw', folders: zone.folders ?? [], onPick: kw => update(c => {const z = c.zones[i] as any; z.keywords = z.keywords ?? []; if (!z.keywords.includes(kw)) z.keywords.push(kw);})})} small />
        {specific && <Btn label="Show all" onPress={() => update(c => void ((c.zones[i] as any).keywords = []))} small />}
      </View>
    </View>
  );
}

function AppsEditor({i, zone, update, openModal}: EditorProps<'apps'>) {
  return (
    <View>
      {zone.apps.map((a, j) => (
        <View key={j} style={ui.itemRow}>
          <Text style={ui.itemText}>{a.label}</Text>
          <View style={ui.zoneRowBtns}>
            <Mini label="▲" onPress={() => update(c => moveItem((c.zones[i] as any).apps, j, -1))} />
            <Mini label="▼" onPress={() => update(c => moveItem((c.zones[i] as any).apps, j, 1))} />
            <Mini label="✕" onPress={() => update(c => void (c.zones[i] as any).apps.splice(j, 1))} />
          </View>
        </View>
      ))}
      <Btn label="＋ App" onPress={() => openModal({kind: 'apps', onPick: a => update(c => (c.zones[i] as any).apps.push(a))})} small />
    </View>
  );
}

// ===== schematic snapshot / preview ========================================
type MiniZ = {type: Zone['type']; title?: string};
const sampleZones: MiniZ[] = [
  {type: 'shortcuts', title: 'Shortcuts'},
  {type: 'stars', title: 'Stars'},
  {type: 'keywords', title: 'Keywords'},
  {type: 'apps', title: 'Apps'},
];

function Snap({on, label, width, onPress, children}: {on: boolean; label: string; width: number; onPress: () => void; children: React.ReactNode}) {
  return (
    <TouchableOpacity style={[ui.snap, {width: width + 16}, on && ui.snapOn]} onPress={onPress}>
      <View style={{alignItems: 'center'}}>{children}</View>
      <Text style={[ui.snapLabel, on && ui.snapLabelOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A schematic portrait mini-page: real page shape, labelled zone boxes. */
function MiniPage({theme, cols, zones, width}: {theme: Theme; cols: number; zones: MiniZ[]; width: number}) {
  const height = Math.round((width * 4) / 3);
  const columns: MiniZ[][] = Array.from({length: cols}, () => []);
  zones.forEach((z, i) => columns[i % cols].push(z));
  return (
    <View style={[ui.miniPage, {width, height}]}>
      <Text style={ui.miniPageTitle}>Dashboard</Text>
      {zones.length === 0 && <Text style={{fontSize: 9, color: '#999', marginTop: 6}}>empty — add sections</Text>}
      <View style={{flexDirection: 'row', flex: 1}}>
        {columns.map((col, ci) => (
          <View key={ci} style={{flex: 1, marginRight: ci < cols - 1 ? 4 : 0}}>
            {col.map((z, zi) => (
              <MiniZone key={zi} theme={theme} label={z.title || z.type} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function MiniZone({theme, label}: {theme: Theme; label: string}) {
  const lines = (
    <>
      <View style={ui.mzLine} />
      <View style={[ui.mzLine, {width: '65%'}]} />
    </>
  );
  if (theme === 'boxed') {
    return (
      <View style={ui.mzBoxed}>
        <View style={ui.mzCap}>
          <Text style={ui.mzCapText} numberOfLines={1}>{label}</Text>
        </View>
        <View style={ui.mzBody}>{lines}</View>
      </View>
    );
  }
  if (theme === 'ledger') {
    return (
      <View style={ui.mzLedger}>
        <View style={ui.mzRule} />
        <Text style={ui.mzLabelText} numberOfLines={1}>{label.toUpperCase()}</Text>
        {lines}
      </View>
    );
  }
  return (
    <View style={ui.mzAiry}>
      <Text style={[ui.mzLabelText, {color: '#666666'}]} numberOfLines={1}>{label.toUpperCase()}</Text>
      {lines}
    </View>
  );
}

// ===== segmented control ===================================================
function Seg({options, value, onChange}: {options: {v: string; label: string}[]; value: string; onChange: (v: string) => void}) {
  return (
    <View style={ui.row}>
      {options.map(o => (
        <TouchableOpacity key={o.v} style={[ui.choice, {marginRight: 6, marginBottom: 6, paddingVertical: 7, paddingHorizontal: 11}, value === o.v && ui.choiceOn]} onPress={() => onChange(o.v)}>
          <Text style={[ui.choiceText, {fontSize: 13}, value === o.v && ui.choiceTextOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const Mini = ({label, onPress}: {label: string; onPress: () => void}) => (
  <TouchableOpacity style={ui.miniBtn} onPress={onPress}>
    <Text style={ui.miniBtnText}>{label}</Text>
  </TouchableOpacity>
);

/**
 * Inline title editor. ✎ turns the title into a field; committing happens on the
 * keyboard's Done key OR when the field loses focus — NOT via a button (on the
 * Supernote the on-screen keyboard covers an inline button, which looked frozen).
 */
function EditableTitle({value, onSave}: {value: string; onSave: (t: string) => void}) {
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(value);
  useEffect(() => setT(value), [value]);

  const commit = () => {
    onSave(t.trim());
    setEditing(false);
  };

  if (!editing) {
    return (
      <View style={[ui.row, {alignItems: 'center', marginTop: 2, marginBottom: 4}]}>
        <Text style={ui.subLabel}>Title to display: </Text>
        <Text style={[ui.itemText, {fontWeight: '600', marginRight: 6}]}>{value}</Text>
        <Mini label="✎ edit" onPress={() => {setT(value); setEditing(true);}} />
      </View>
    );
  }
  return (
    <View style={{marginTop: 2, marginBottom: 4}}>
      <Text style={ui.subLabel}>Title (press Done or tap away to save)</Text>
      <TextInput
        style={ui.titleInput}
        value={t}
        onChangeText={setT}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={commit}
        onEndEditing={commit}
      />
    </View>
  );
}

/** 1-based index of a zone among zones of the same type. */
function typeIndex(zones: Zone[], i: number): number {
  let n = 0;
  for (let k = 0; k <= i; k++) if (zones[k].type === zones[i].type) n++;
  return n;
}

// ===== modals ==============================================================
function ModalHost({modal, close}: {modal: NonNullable<Modal>; close: () => void}) {
  if (modal.kind === 'browse') return <PickBrowser allow={modal.allow} onPick={p => {modal.onPick(p); close();}} onClose={close} />;
  if (modal.kind === 'apps') return <AppPickerModal onPick={a => {modal.onPick(a); close();}} onClose={close} />;
  if (modal.kind === 'kw') return <KeywordPicker folders={modal.folders} onPick={k => {modal.onPick(k); close();}} onClose={close} />;
  return <TextPrompt title={modal.title} initial={modal.initial} onSubmit={t => {modal.onSubmit(t); close();}} onClose={close} />;
}

function PickBrowser({allow, onPick, onClose}: {allow: 'folder' | 'note' | 'pdf'; onPick: (p: string) => void; onClose: () => void}) {
  const ROOT = '/storage/emulated/0'; // navigate anywhere on the device
  const START = allow === 'pdf' ? ROOT + '/Document' : ROOT + '/Note';
  const [dir, setDir] = useState(START);
  const [entries, setEntries] = useState<any[]>([]);
  const fileRe = allow === 'pdf' ? /\.pdf$/i : /\.note$/i;
  const load = async (d: string) => {
    try {
      const list: any[] = (await DashboardNative.listDir(d)) ?? [];
      list.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      setEntries(list);
      setDir(d);
    } catch {
      setEntries([]);
    }
  };
  useEffect(() => {load(START);}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const parent = dir.substring(0, dir.lastIndexOf('/'));
  return (
    <View style={ui.container}>
      <Text style={ui.wizTitle}>{allow === 'folder' ? 'Pick a folder' : `Pick a ${allow}`}</Text>
      <View style={ui.row}>
        <Btn label="⬆" onPress={() => load(parent || ROOT)} disabled={dir === ROOT} small />
        <Btn label="✕ cancel" onPress={onClose} small />
        {allow === 'folder' && <Btn label="✓ use this folder" onPress={() => onPick(dir)} small />}
      </View>
      <Text style={ui.zoneMeta}>{dir}</Text>
      <ScrollView style={ui.picker}>
        {entries.map((e, i) => {
          const pickable = allow !== 'folder' && fileRe.test(e.name);
          return (
            <TouchableOpacity key={i} onPress={() => (e.isDir ? load(e.path) : pickable ? onPick(e.path) : undefined)}>
              <Text style={[ui.pickerItem, !e.isDir && !pickable && {color: '#aaa'}]}>
                {e.isDir ? '📁 ' : /\.pdf$/i.test(e.name) ? '📕 ' : /\.note$/i.test(e.name) ? '📄 ' : '   '}
                {e.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AppPickerModal({onPick, onClose}: {onPick: (a: {label: string; component: string}) => void; onClose: () => void}) {
  const [all, setAll] = useState<{label: string; component: string}[] | null>(null);
  const showAll = async () => {
    try {
      const list: any[] = await DashboardNative.listLaunchableApps();
      const parsed = list
        .map((s: any) => ({label: s.label ?? String(s), component: s.component as string}))
        .filter(a => a.component && !APP_BLOCK.test(a.component));
      parsed.sort((a, b) => a.label.localeCompare(b.label));
      setAll(parsed);
    } catch {
      setAll([]);
    }
  };
  return (
    <View style={ui.container}>
      <Text style={ui.wizTitle}>Add an app</Text>
      <View style={ui.row}>
        <Btn label="✕ cancel" onPress={onClose} small />
        {!all && <Btn label="Show all apps" onPress={showAll} small />}
      </View>
      <ScrollView style={ui.picker}>
        <Text style={ui.subLabel}>Supernote apps</Text>
        {CURATED_APPS.map((a, i) => (
          <TouchableOpacity key={i} onPress={() => onPick(a)}>
            <Text style={ui.pickerItem}>{a.label}</Text>
          </TouchableOpacity>
        ))}
        {all && <Text style={ui.subLabel}>All apps</Text>}
        {all?.map((a, i) => (
          <TouchableOpacity key={'a' + i} onPress={() => onPick(a)}>
            <Text style={ui.pickerItem}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function KeywordPicker({folders, onPick, onClose}: {folders: string[]; onPick: (k: string) => void; onClose: () => void}) {
  const [kws, setKws] = useState<string[] | null>(null);
  useEffect(() => {
    scanKeywords(folders, undefined)
      .then(r => setKws([...new Set(r.hits.map(h => h.keyword))].sort()))
      .catch(() => setKws([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={ui.container}>
      <Text style={ui.wizTitle}>Pick a keyword</Text>
      <Btn label="✕ cancel" onPress={onClose} small />
      {!kws && <Text style={ui.hint}>scanning…</Text>}
      <ScrollView style={ui.picker}>
        {kws?.length === 0 && <Text style={ui.empty}>No keyword found in these folders.</Text>}
        {kws?.map((k, i) => (
          <TouchableOpacity key={i} onPress={() => onPick(k)}>
            <Text style={ui.pickerItem}>#{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function TextPrompt({title, initial, onSubmit, onClose}: {title: string; initial: string; onSubmit: (t: string) => void; onClose: () => void}) {
  const [t, setT] = useState(initial);
  return (
    <View style={ui.container}>
      <Text style={ui.wizTitle}>{title}</Text>
      <TextInput style={[ui.json, {minHeight: 44, flex: 0}]} value={t} onChangeText={setT} autoCapitalize="none" autoCorrect={false} />
      <View style={ui.row}>
        <Btn label="OK" onPress={() => onSubmit(t.trim())} small />
        <Btn label="Cancel" onPress={onClose} small />
      </View>
    </View>
  );
}

// ===== helpers =============================================================
function moveZone(c: DashboardConfig, i: number, dir: number) {
  moveItem(c.zones, i, dir);
}
function moveItem(arr: any[], i: number, dir: number) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  const [x] = arr.splice(i, 1);
  arr.splice(j, 0, x);
}
function newZone(type: Zone['type']): Zone {
  if (type === 'shortcuts') return {type, title: 'Shortcuts', items: []};
  if (type === 'stars') return {type, title: 'Stars', folders: [], noteSort: 'recent'};
  if (type === 'keywords') return {type, title: 'Keywords', folders: [], sort: 'keyword', display: 'list', noteSort: 'recent'};
  return {type: 'apps', title: 'Apps', apps: []};
}
function cleanName(path: string): string {
  return basename(path).replace(/\.(note|pdf)$/i, '');
}
