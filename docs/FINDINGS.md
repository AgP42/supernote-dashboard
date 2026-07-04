# Supernote plugin development — empirical findings

A field guide of things that are **not in the official docs** but were verified on real devices
(Supernote **A5X** and **Manta / A5X2**, firmware mid‑2026, `sn-plugin-lib` 0.1.43, React Native
0.79.2). The official docs remain the source of truth — https://docs.supernote.com/en — this file
records what we learned by probing, so others don't have to rediscover it.

> Provenance: discovered while building the "Dashboard" plugin via two throwaway probes
> (`intentprobe`, `capprobe`) in this repo. Every claim below was observed on-device.

---

## 1. Opening notes, folders and apps from a plugin (the big one)

The community consensus was "a plugin **cannot** open a note in the editor" — because the SDK's
`FileUtils.openFilePath()` only opens the file manager, `Linking.openURL('file://…')` is blocked,
and there is no `goToPage`/`openNote` API. **This is circumventable.** The Supernote firmware ships
several **exported** Android activities you can launch directly with an `Intent`.

### 1.1 Discovering exported activities

`PackageManager.queryIntentActivities(ACTION_VIEW on a file://…)` returns **nothing** — Android 11+
package‑visibility filtering hides it. Instead enumerate installed packages:

```java
PackageManager pm = ctx.getPackageManager();
for (PackageInfo p : pm.getInstalledPackages(PackageManager.GET_ACTIVITIES)) {
    if (!p.packageName.startsWith("com.ratta")) continue;
    for (ActivityInfo a : p.activities) {
        // a.name, a.exported  → the exported ones are launchable
    }
}
```

On our devices: 237 activities under `com.ratta*`, 58 exported.

### 1.2 Open a note at a specific page — CONFIRMED

```java
Intent i = new Intent();
i.setComponent(new ComponentName(
    "com.ratta.supernote.note",
    "com.ratta.supernote.note.view.NoteInsidePagesActivity"));   // [exported]
i.putExtra("file_path", "/storage/emulated/0/Note/…/whatever.note"); // String — the ONLY key that works
i.putExtra("page", 6);            // int, 1-based (matches the native search UI). Omit → last-used page.
i.setAction(Intent.ACTION_VIEW);  // REQUIRED — see gotcha below
i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
ctx.startActivity(i);
```

- The extra key is **`file_path`** (not `path`/`filePath`/`note_path`/`filepath` — all ignored).
- The page key is **`page`** as an **int**, **1-based** (`pageIndex`/`page_num`/`pageNumber`/
  `current_page` are all ignored). Without it, the note opens on its last-used page.
- **`ACTION_VIEW` is required.** Without it, an already-running note‑editor instance is reused and
  the `file_path` extra is silently ignored (you get the previously open note). This was the single
  nastiest bug we hit.
- Bonus: when a valid `page` is present the note app does a clean navigation and the plugin reopens
  on the **first** tap; without it we sometimes needed two taps to reshow the plugin.

### 1.3 Open a folder in the file manager — CONFIRMED

```java
i.setComponent(new ComponentName(
    "com.ratta.supernote.inbox",
    "com.ratta.supernote.explorer.FileManagerMainActivity"));
i.putExtra("folder_path", "/storage/emulated/0/Note/SomeFolder"); // reliable
i.putExtra("source_type", 2);
i.setAction(Intent.ACTION_VIEW);
i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
```

The SDK's own `openFilePath` builds this same intent but wrongly fills `folder_path` with the
*current file* path and puts the target in `only_open_file` — which navigates to the file's folder
but does **not** open it in the editor. `only_open_file` never opened the editor in any of our tests.

### 1.4 Other exported activities that launch (no target needed)

| Purpose | component |
|---|---|
| Native ToDo app | `com.ratta.supernote.task/com.ratta.supernote.task.TaskActivity` |
| Calendar | `com.ratta.supernote.calendar/com.ratta.supernote.calendar.MainActivity` |
| Global search | `com.ratta.search/com.ratta.search.MainActivity` (opens BLANK — cannot be pre-filled; tried keyword/query/search/text/keyWord/search_key) |
| Inbox / home | `com.ratta.supernote.inbox/com.ratta.supernote.inbox.InBoxMainActivity` |
| Paint, browser, email, knowledge… | present and exported — enumerate with §1.1 |

The native ToDo *app* opens, but **creating** a todo programmatically is unproven: its
`CreateTaskActivity` is `[internal]` (not launchable), and there is no SDK path to its data store.

### 1.5 Critical: close the plugin view after launching

A launched note/folder appears **behind** the still‑fullscreen plugin view — it looks like "nothing
happened". After `startActivity`, call `PluginManager.closePluginView()` (≈150 ms later) so the
target comes to the foreground.

### 1.6 PDFs / documents — CONFIRMED

`NoteInsidePagesActivity` is the **note** editor and does nothing with a `.pdf`. The document viewer
is a separate, launchable app:

```java
i.setComponent(new ComponentName(
    "com.supernote.document", "com.supernote.document.MainActivity"));  // launchable
i.putExtra("file_path", "/storage/emulated/0/Document/…/book.pdf");     // same key as notes
// i.putExtra("page", n);  // passed but appears IGNORED by the viewer (opens last-used page)
i.setAction(Intent.ACTION_VIEW);
i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
```

Opens the PDF (at its last-used page). The page key that jumps to a specific page is **not yet
found** (`page` int is ignored, unlike the note editor). Note: an **implicit** `ACTION_VIEW` with a
`file://` data URI throws `FileUriExposedException` (Android StrictMode) — you must use the explicit
component + `file_path` extra, not a data URI.

---

## 2. Floating overlay (the persistent "bubble")

A native `WindowManager` overlay is the only way to show UI **over** the note (the plugin's
`showType:1` view is a fullscreen opaque container — there is no partial/windowed native mode). This
is how a persistent, draggable "bubble" is built, and it is the strongest UX primitive we found.

- Window type: `TYPE_APPLICATION_OVERLAY` (API 26+), fallback `TYPE_PHONE`. Permission
  `SYSTEM_ALERT_WINDOW` in the manifest — **granted by default** on our firmware
  (`Settings.canDrawOverlays` returns true without prompting; the "request permission" intent just
  opens a folder — a firmware quirk, irrelevant since it's already granted).
- **The overlay survives `closePluginView()` and persists across the entire OS** — folders, other
  notes, calendar, todos, settings. This is what makes a "always-available dashboard bubble" possible.
- The plugin's **JS keeps running** after the view closes (headless), so a module‑level JS listener
  can react to overlay taps. **Component‑level listeners die when the view closes** — register the
  overlay‑tap handler at **module scope** (in `index.js`), not inside a React component.
- Expand on tap: emit an event from native → JS listener calls `PluginManager.showPluginView()`.
  Note `showPluginView(Promise)` takes **one argument** — native reflection looking for a 0‑arg
  method silently no‑ops (a bug we hit). Prefer calling the JS API.
- Make overlay state **static** (one bubble per process) and **save the last dragged position**, or
  it reappears top‑left. Clamp drag to screen bounds so it can't go off‑screen.
- **A5X ghost overlay:** after a plugin reload the native overlay view can survive while its JS
  listener dies (tap does nothing, long‑press still dismisses it). Fix: call `hideOverlay()` at
  plugin load to remove the still‑static view. Not reproduced on Manta.

---

## 3. Gestures

`PluginManager.registerMotionListener(registerType, {onMsg})` (SDK 0.1.43) delivers raw pen+finger
events headlessly:

```ts
interface MotionEvent {
  action: number;   // 0=DOWN 1=UP 2=MOVE 3=CANCEL (some fw also 5/6 = pointer down/up)
  toolType: number; // 0=unknown 1=finger 2=EMR pen
  pointerCount: number;
  x: number; y: number;
  downTime: number; eventTime: number; // measure durations from these, NOT setTimeout
}
```

- **Works** — we recognized taps/swipes on device. On the **A5X a single finger reports
  `pointerCount = 1`** (not the `2` reported on some other firmware). Classify on the UP event.
- JS timers are suspended while the plugin view is closed → compute long‑press from `eventTime -
  downTime`, never `setTimeout`.
- **Danger:** always‑on global motion capture combined with writing on the page (as a visible
  effect) **froze the device** during heavy navigation. Don't run global capture + page mutations
  together.

---

## 4. Data APIs (stars, keywords, pages)

- **Stars = "five‑stars".** The Supernote "Star" feature (draw a star, it's recognized and cleaned
  up) stores a *five‑star element*. `PluginFileAPI.searchFiveStars(path)` → array of **0‑based** page
  indices (add 1 to match the native search UI and the editor's `page` extra). **Notes only** — it
  does not return stars inside PDFs, even though the native global search does.
- **Keywords.** `PluginFileAPI.getKeyWords(path, pageList)` — the `pageList` is **required**; pass
  `[0 … totalPages-1]` (get the count from `getNoteTotalPageNum(path)`). Returns `{keyword, page}`
  with **0‑based** pages. **Notes only** — PDF keywords aren't returned (this is why our count came
  out one short of the native search, which also indexes PDFs). Insert with
  `insertKeyWord(path, pageNum, label)`.
- **File tree.** `FileUtils.listFiles(dir)` returns entries (name or full path depending on
  firmware); recurse yourself, bound the count. Roots: `/storage/emulated/0/Note` and
  `/storage/emulated/0/Document`.
- **No `writeFile` in the SDK.** Persist config via `react-native-fs` or a native module. Reads work
  with `fetch('file://…')` (returns HTTP status 0 on Android — ignore `response.ok`, parse the body).
- `FileUtils.getFileList(suffixList)` does a device‑wide scan and **crashed the plugin view** on
  device — prefer folder‑by‑folder `listFiles`.

---

## 5. Native dialogs

`NativeUIUtils` renders Supernote's own dialog style:

```ts
NativeUIUtils.showErrorTipDialog('message');                         // fire-and-forget tip
const ok = await NativeUIUtils.showRattaDialog('question', 'Cancel', 'OK', /*isSuccess*/ true);
```

---

## 6. Build & tooling

- Template scaffold: `npx @react-native-community/cli init <name> --template
  @supernote-plugin/sn-plugin-template --version 0.79.2`. **RN 0.79.2 is locked** to the PluginHost
  runtime.
- The npm template does **not** preserve executable bits — `chmod +x buildPlugin.sh android/gradlew`
  after scaffolding or the build fails with "permission denied".
- **Native code is only compiled if a `ReactPackage` is registered** via `add(YourPackage())` in
  `MainApplication.kt` (the build script parses this to fill `reactPackages` in the generated
  `PluginConfig.json`). If you write a native module but forget the `add(...)`,
  `NativeModules.YourModule` is `null` at runtime — JS runs, native calls silently fail.
- First native build ≈ 5–6 min; incremental ≈ seconds. Verify recompilation by checking
  `build/generated/app.npk` mtime > your `.java` mtime, or grep the dex for new symbols.
- `PluginConfig.json`: `pluginKey` must equal the `AppRegistry.registerComponent` app name; never
  change `pluginID` after distribution; set `iconPath` for the plugin manager icon.
- Package is `build/outputs/<name>.snplg`.

## 7. Deployment over USB (Linux)

MTP works with `gio`:

```bash
# push
gio copy build/outputs/foo.snplg 'mtp://<device-id>/Supernote/MyStyle/foo.snplg'
# pull a log the plugin wrote
gio copy 'mtp://<device-id>/Supernote/MyStyle/foo-log.txt' ./foo-log.txt
```

Then install on device: Settings → Apps → Plugins → Add Plugin. ADB is locked down on these devices
(`adb shell/push/pull` fail), so MTP or the Supernote Partner app is the deployment path. Reddit is
IP‑blocked from some CI/dev environments — mirror content or fetch via GitHub.

## 8. Debugging without ADB

A native `appendLog(String)` writing to `/storage/emulated/0/MyStyle/<plugin>-log.txt` is a reliable
on‑device log you can pull over MTP — invaluable since `adb logcat` isn't available.

---

## 9. Page numbering cheat‑sheet

| Source | Base |
|---|---|
| `searchFiveStars` result | 0‑based |
| `getKeyWords` `.page` | 0‑based |
| `NoteInsidePagesActivity` `page` extra | 1‑based |
| Native search UI display | 1‑based |

So: `open_page = api_index + 1`.

---

## 10. Device differences

- **Screen sizes** (only these two are supported by the coordinate utils): A5X **1404×1872**
  (Nomad shares this), Manta **1920×2560**. Always derive layout from `getPageSize()`/`Dimensions`,
  never hard‑code pixels.
- The A5X ghost‑overlay quirk (§2) was not seen on Manta. Treat Manta as the reference device and
  the A5X as the slower/older validation target.
