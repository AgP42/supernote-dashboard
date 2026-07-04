/**
 * Dashboard — root router. Bubble tap → Dashboard surface; toolbar button →
 * Settings surface. See docs/dashboard-spec.md.
 * @format
 */
import React, {useEffect, useState} from 'react';
import {DeviceEventEmitter, ScrollView, Text, TouchableOpacity, View} from 'react-native';

import {getRoute, setRoute, Route} from './src/route';
import {DashboardConfig, loadConfig} from './src/config';
import {showBubbleFromConfig} from './src/bubble';
import {ZoneView} from './src/zones';
import {ui} from './src/ui';
import {SettingsScreen} from './src/settings';

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
  useEffect(() => {
    loadConfig().then(setCfg);
  }, []);

  return (
    <View style={ui.container}>
      <View style={ui.header}>
        <Text style={ui.title}>Dashboard</Text>
        <View style={ui.headerBtns}>
          <TouchableOpacity style={ui.iconBtnGhost} onPress={() => setRoute('config')}>
            <Text style={ui.iconTextGhost}>⚙</Text>
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
      {cfg && (
        <ScrollView style={{flex: 1}}>
          <View style={cfg.layout === 'grid' ? ui.zoneGrid : undefined}>
            {cfg.zones.map((z, i) => (
              <View key={i} style={cfg.layout === 'grid' ? ui.zoneCell : undefined}>
                <ZoneView zone={z} scan={cfg.scan} theme={cfg.theme} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export default App;
