/**
 * App launching targets for the Apps zone / picker.
 * CURATED = known user-facing Supernote apps (confirmed to launch), always
 * offered first. Some (ToDo/Calendar) aren't in the launcher list, so we can't
 * rely on discovery alone. The device list is offered too, minus obvious internals.
 */
export interface AppItem {
  label: string;
  component: string;
}

export const CURATED_APPS: AppItem[] = [
  {label: 'ToDo', component: 'com.ratta.supernote.task/com.ratta.supernote.task.TaskActivity'},
  {label: 'Calendar', component: 'com.ratta.supernote.calendar/com.ratta.supernote.calendar.MainActivity'},
  {label: 'Document', component: 'com.supernote.document/com.supernote.document.MainActivity'},
  {label: 'Search', component: 'com.ratta.search/com.ratta.search.MainActivity'},
  {label: 'Files', component: 'com.ratta.supernote.inbox/com.ratta.supernote.inbox.InBoxMainActivity'},
];

/** Hide obviously non-user launcher entries from the "all apps" list. */
export const APP_BLOCK =
  /setupwizard|factorytest|screencast|pluginhost|\.unlock\b|\.background\b|supernotefactory|\.test\.|TestActivity/i;
