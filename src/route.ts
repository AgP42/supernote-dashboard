/**
 * Tiny router shared between index.js (entry points) and App.tsx (rendering).
 *   - 'config'    → opened by the plugin toolbar button
 *   - 'dashboard' → opened by tapping the floating bubble
 */
import {DeviceEventEmitter} from 'react-native';

export type Route = 'config' | 'dashboard';

let current: Route = 'config';

export function setRoute(r: Route) {
  current = r;
  DeviceEventEmitter.emit('dashboard_route', r);
}

export function getRoute(): Route {
  return current;
}
