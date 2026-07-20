/**
 * Dashboard — root router. Bubble tap → Dashboard surface; toolbar button →
 * Settings surface. See docs/dashboard-spec.md.
 * @format
 */
import React, {useEffect, useRef, useState} from 'react';
import {DeviceEventEmitter, NativeModules, ScrollView, Text, TouchableOpacity, View} from 'react-native';

const {DashboardNative} = NativeModules;

import {getRoute, setRoute, Route} from './src/route';
import {DashboardConfig, loadConfig} from './src/config';
import {showBubbleFromConfig} from './src/bubble';
import {tscale, ZoneView} from './src/zones';
import {ui} from './src/ui';
import {SettingsScreen} from './src/settings';

const SCALE: Record<string, number> = {S: 1, M: 1.18, L: 1.4, XL: 1.7};

function App(): React.JSX.Element {
  const [route, setRouteState] = useState<Route>(getRoute());
  useEffect(() => {
    setRouteState(getRoute());
    const sub = DeviceEventEmitter.addListener('dashboard_route', (r: Route) => setRouteState(r));
    return () => sub.remove();
  }, []);
  return route === 'dashboard' ? <DashboardScreen /> : <SettingsScreen />;
}

function DashboardScreen(): React.JSX.Element {
  const [cfg, setCfg] = useState<DashboardConfig | null>(null);
  const rootRef = useRef<View>(null);
  // Hide the bubble only once the dashboard is measurably on screen — checked
  // on mount AND on every re-entry (the tree is kept mounted across opens and
  // this firmware doesn't emit the plugin life events, so a mount effect only
  // ever fires once). measureInWindow polls: the view attaches some time after
  // the tap; if it never attaches (host reports success without surfacing the
  // view), nothing measures and the bubble stays so the user can tap again.
  useEffect(() => {
    let alive = true;
    let hidden = false;
    const poll = (attempt: number) => {
      if (!alive || hidden) return;
      rootRef.current?.measureInWindow((_x: number, _y: number, w: number, h: number) => {
        if (!alive || hidden) return;
        if (w > 0 && h > 0) {
          hidden = true;
          DashboardNative?.hideBubble?.().catch(() => {});
        }
      });
      if (attempt < 5) {
        setTimeout(() => poll(attempt + 1), 400);
      } else {
        setTimeout(() => {
          if (alive && !hidden)
            DashboardNative?.appendLog?.('[bub] view never measured (bubble kept)').catch(() => {});
        }, 400);
      }
    };
    const kick = () => {
      hidden = false;
      poll(0);
    };
    kick();
    const sub = DeviceEventEmitter.addListener('dashboard_route', (r: Route) => {
      if (r === 'dashboard') kick();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  // `nonce` bumps every time the dashboard is (re)entered → live data (Recent)
  // and config re-read even though the view may be kept mounted across opens.
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const reload = () => {
      loadConfig().then(setCfg);
      setNonce(n => n + 1);
    };
    reload();
    const sub = DeviceEventEmitter.addListener('dashboard_route', (r: Route) => {
      if (r === 'dashboard') reload();
    });
    return () => sub.remove();
  }, []);

  const ts = cfg ? tscale(SCALE[cfg.textScale] ?? 1.4) : tscale(1.4);
  // If the page has both Stars and Keywords, the first scan warms both in one
  // pass (per-file cache) so the second zone's scan is instant.
  const sib = cfg
    ? {
        stars: cfg.zones.some(z => z.type === 'stars'),
        keywords: cfg.zones.some(z => z.type === 'keywords'),
      }
    : undefined;
  const zoneEl = (z: DashboardConfig['zones'][number], i: number) => (
    <ZoneView key={i} zone={z} scan={cfg!.scan} theme={cfg!.theme} ts={ts} nonce={nonce} sib={sib} />
  );

  return (
    <View style={ui.container} ref={rootRef}>
      <View style={ui.header}>
        <View style={ui.headerBtns}>
          <Text style={ui.title}>Dashboard</Text>
          {/* config link on the LEFT, away from the frequently-tapped right side */}
          <TouchableOpacity style={[ui.iconBtnGhost, {marginLeft: 10}]} onPress={() => setRoute('config')}>
            <Text style={ui.iconTextGhost}>⚙</Text>
          </TouchableOpacity>
        </View>
        <View style={ui.headerBtns}>
          <TouchableOpacity style={ui.iconBtn} onPress={() => DeviceEventEmitter.emit('dashboard_refresh_all')}>
            <Text style={ui.iconText}>↻ Refresh all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ui.iconBtn} onPress={() => showBubbleFromConfig()}>
            <Text style={ui.iconText}>⊖</Text>
          </TouchableOpacity>
        </View>
      </View>
      {!cfg && <Text style={ui.hint}>loading…</Text>}
      {cfg && cfg.zones.length === 0 && (
        <Text style={ui.hint}>No zone. Configure the dashboard via ⚙ Settings.</Text>
      )}
      {cfg && cfg.layout === 'grid' ? (
        // Masonry: two independent columns (even/odd) so a tall zone in one
        // column doesn't leave whitespace next to a short one.
        <ScrollView style={{flex: 1}}>
          <View style={ui.zoneGrid}>
            <View style={ui.zoneCol}>{cfg.zones.filter((_, i) => i % 2 === 0).map((z, k) => zoneEl(z, k * 2))}</View>
            <View style={ui.zoneCol}>{cfg.zones.filter((_, i) => i % 2 === 1).map((z, k) => zoneEl(z, k * 2 + 1))}</View>
          </View>
        </ScrollView>
      ) : cfg ? (
        <ScrollView style={{flex: 1}}>{cfg.zones.map((z, i) => zoneEl(z, i))}</ScrollView>
      ) : null}
    </View>
  );
}

export default App;
