package com.dashboard;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.util.List;

/**
 * Native bridge for the Dashboard plugin:
 *  - openNote / openFolder / launchActivity: open device targets by intent
 *  - listLaunchableApps: enumerate launchable apps for the Apps zone / config
 *  - overlay: the draggable floating bubble (tap→expand, long-press→close)
 *  - writeFile / appendLog: persistence & on-device logging (SDK has no writeFile)
 */
public class DashboardNativeModule extends ReactContextBaseJavaModule {
    private final Handler main = new Handler(Looper.getMainLooper());

    // Overlay state is static → one bubble per process; last position survives hide/show.
    private static WindowManager wm;
    private static View overlayView;
    private static WindowManager.LayoutParams overlayParams;
    private static int lastX = -1, lastY = -1;
    private static boolean bubbleShown = false;
    private int startX, startY;
    private float startRawX, startRawY;
    private boolean dragging;
    private boolean longFired;
    private Runnable longPressRunnable;
    private static final long LONG_PRESS_MS = 600;
    private static final String BUBBLE_TAG = "DASHBOARD_BUBBLE";

    public DashboardNativeModule(ReactApplicationContext ctx) {
        super(ctx);
    }

    @Override
    public String getName() {
        return "DashboardNative";
    }

    private void emit(String event, WritableMap payload) {
        getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(event, payload);
    }

    // ---- Intents ----------------------------------------------------------

    /** Open a .note in the editor at a 1-based page (page<=0 → last-used page). */
    @ReactMethod
    public void openNote(String path, int page, Promise promise) {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.ratta.supernote.note",
                    "com.ratta.supernote.note.view.NoteInsidePagesActivity"));
            intent.putExtra("file_path", path);
            if (page > 0) intent.putExtra("page", page);
            intent.setAction(Intent.ACTION_VIEW); // required or the file_path extra is ignored
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_NOTE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * Open a PDF/document in the Supernote Document viewer. Uses the `file_path`
     * extra (a raw file:// data URI throws FileUriExposedException). The `page`
     * extra is passed but currently appears ignored by the viewer (opens last page).
     */
    @ReactMethod
    public void openDocument(String path, int page, Promise promise) {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.supernote.document",
                    "com.supernote.document.MainActivity"));
            intent.putExtra("file_path", path);
            if (page > 0) intent.putExtra("page", page);
            intent.setAction(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_DOC_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Open the file manager navigated into a folder. */
    @ReactMethod
    public void openFolder(String folderPath, Promise promise) {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.ratta.supernote.inbox",
                    "com.ratta.supernote.explorer.FileManagerMainActivity"));
            intent.putExtra("folder_path", folderPath);
            intent.putExtra("source_type", 2);
            intent.setAction(Intent.ACTION_VIEW);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_FOLDER_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** Launch any activity by "package/activity" component string (Apps zone). */
    @ReactMethod
    public void launchActivity(String component, Promise promise) {
        try {
            String[] parts = component.split("/", 2);
            Intent intent = new Intent();
            intent.setComponent(new ComponentName(parts[0], parts[1]));
            intent.setAction(Intent.ACTION_MAIN);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("LAUNCH_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /** List launchable apps as [{label, packageName, component}] for the Apps zone / config. */
    @ReactMethod
    public void listLaunchableApps(Promise promise) {
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            Intent launcher = new Intent(Intent.ACTION_MAIN);
            launcher.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> apps = pm.queryIntentActivities(launcher, 0);
            WritableArray out = Arguments.createArray();
            for (ResolveInfo ri : apps) {
                ActivityInfo ai = ri.activityInfo;
                WritableMap m = Arguments.createMap();
                CharSequence label = ai.loadLabel(pm);
                m.putString("label", label != null ? label.toString() : ai.name);
                m.putString("packageName", ai.packageName);
                m.putString("component", ai.packageName + "/" + ai.name);
                out.pushMap(m);
            }
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("LIST_APPS_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    /**
     * List a directory as [{name, path, isDir, mtime}] using java.io.File.
     * More reliable than the SDK's device-wide getFileList (which crashed the
     * plugin view) and gives mtime for "most recent" sorting.
     */
    @ReactMethod
    public void listDir(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            File[] children = dir.listFiles();
            WritableArray out = Arguments.createArray();
            if (children != null) {
                for (File c : children) {
                    WritableMap m = Arguments.createMap();
                    m.putString("name", c.getName());
                    m.putString("path", c.getAbsolutePath());
                    m.putBoolean("isDir", c.isDirectory());
                    m.putDouble("mtime", (double) c.lastModified());
                    out.pushMap(m);
                }
            }
            promise.resolve(out);
        } catch (Exception e) {
            promise.reject("LISTDIR_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    // ---- Persistence / logging -------------------------------------------

    /** Write text to an absolute path (SDK has no writeFile). Creates parent dirs. */
    @ReactMethod
    public void writeFile(String path, String content, Promise promise) {
        try {
            File f = new File(path);
            File parent = f.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();
            try (java.io.FileWriter w = new java.io.FileWriter(f, false)) {
                w.write(content);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("WRITE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void appendLog(String text, Promise promise) {
        try {
            File f = new File("/storage/emulated/0/MyStyle/dashboard-log.txt");
            try (java.io.FileWriter w = new java.io.FileWriter(f, true)) {
                w.write(text + "\n");
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("LOG_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
        }
    }

    // ---- Overlay bubble ---------------------------------------------------

    @ReactMethod
    public void checkOverlayPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= 23) {
            promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
        } else {
            promise.resolve(true);
        }
    }

    @ReactMethod
    public void requestOverlayPermission(Promise promise) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getReactApplicationContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(i);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("PERM_REQ_FAILED", e.getMessage(), e);
        }
    }

    /**
     * Show the floating bubble. `label` under the glyph (empty=none), `hint` line
     * below that (empty=none) → drives the three display modes from config.
     */
    @ReactMethod
    public void showBubble(String label, String hint, Promise promise) {
        main.post(() -> {
            try {
                Context ctx = getReactApplicationContext();
                if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(ctx)) {
                    promise.reject("NO_PERMISSION", "overlay permission not granted");
                    return;
                }
                // Remove our tracked view AND any orphaned bubbles left in the
                // (persistent PluginHost) process by a previous classloader.
                removeOverlayInternal();
                clearTaggedBubbles();
                wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);

                LinearLayout panel = new LinearLayout(ctx);
                panel.setTag(BUBBLE_TAG);
                panel.setOrientation(LinearLayout.VERTICAL);
                panel.setGravity(Gravity.CENTER_HORIZONTAL);
                panel.setBackgroundColor(Color.WHITE);
                panel.setPadding(dp(10), dp(8), dp(10), dp(8));

                TextView glyph = new TextView(ctx);
                glyph.setText("⊕"); // ⊕ circled plus
                glyph.setTextColor(Color.BLACK);
                glyph.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
                glyph.setGravity(Gravity.CENTER);
                panel.addView(glyph);

                if (label != null && !label.isEmpty()) {
                    TextView lbl = new TextView(ctx);
                    lbl.setText(label);
                    lbl.setTextColor(Color.BLACK);
                    lbl.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                    lbl.setGravity(Gravity.CENTER);
                    panel.addView(lbl);
                }
                if (hint != null && !hint.isEmpty()) {
                    TextView h = new TextView(ctx);
                    h.setText(hint);
                    h.setTextColor(Color.DKGRAY);
                    h.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
                    h.setGravity(Gravity.CENTER);
                    panel.addView(h);
                }

                int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        : WindowManager.LayoutParams.TYPE_PHONE;
                overlayParams = new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.WRAP_CONTENT,
                        WindowManager.LayoutParams.WRAP_CONTENT,
                        type,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                        PixelFormat.OPAQUE);
                overlayParams.gravity = Gravity.TOP | Gravity.START;
                overlayParams.x = lastX >= 0 ? lastX : dp(40);
                overlayParams.y = lastY >= 0 ? lastY : dp(120);

                panel.setOnTouchListener((v, ev) -> {
                    switch (ev.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            startX = overlayParams.x; startY = overlayParams.y;
                            startRawX = ev.getRawX(); startRawY = ev.getRawY();
                            dragging = false; longFired = false;
                            longPressRunnable = () -> {
                                if (!dragging) {
                                    longFired = true;
                                    removeOverlayInternal();
                                    bubbleShown = false;
                                    emit("onBubbleClosed", Arguments.createMap());
                                }
                            };
                            main.postDelayed(longPressRunnable, LONG_PRESS_MS);
                            return true;
                        case MotionEvent.ACTION_MOVE: {
                            float dx = ev.getRawX() - startRawX, dy = ev.getRawY() - startRawY;
                            if (!dragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
                                dragging = true;
                                if (longPressRunnable != null) main.removeCallbacks(longPressRunnable);
                            }
                            if (dragging) {
                                int vw = v.getWidth(), vh = v.getHeight();
                                int maxX = Math.max(0, screenW() - vw);
                                int maxY = Math.max(0, screenH() - vh);
                                overlayParams.x = clamp(startX + (int) dx, 0, maxX);
                                overlayParams.y = clamp(startY + (int) dy, 0, maxY);
                                lastX = overlayParams.x; lastY = overlayParams.y;
                                try { wm.updateViewLayout(overlayView, overlayParams); } catch (Exception ignored) {}
                            }
                            return true;
                        }
                        case MotionEvent.ACTION_CANCEL:
                            if (longPressRunnable != null) main.removeCallbacks(longPressRunnable);
                            return true;
                        case MotionEvent.ACTION_UP:
                            if (longPressRunnable != null) main.removeCallbacks(longPressRunnable);
                            if (!dragging && !longFired) emit("onBubbleTap", Arguments.createMap());
                            return true;
                        default:
                            return false;
                    }
                });

                overlayView = panel;
                wm.addView(overlayView, overlayParams);
                bubbleShown = true;
                promise.resolve(true);
            } catch (Exception e) {
                promise.reject("SHOW_BUBBLE_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage(), e);
            }
        });
    }

    @ReactMethod
    public void isBubbleShown(Promise promise) {
        promise.resolve(bubbleShown && overlayView != null);
    }

    @ReactMethod
    public void hideBubble(Promise promise) {
        main.post(() -> {
            removeOverlayInternal();
            bubbleShown = false;
            promise.resolve(true);
        });
    }

    private void removeOverlayInternal() {
        if (overlayView != null && wm != null) {
            try { wm.removeView(overlayView); } catch (Exception ignored) {}
        }
        overlayView = null;
        overlayParams = null;
    }

    /**
     * Remove every bubble view in this process, even orphans from a previous
     * plugin classloader (PluginHost persists across reload/reinstall, so a
     * stale bubble can't be reached via our static reference). We reflect into
     * WindowManagerGlobal — process-wide — and drop any view tagged BUBBLE_TAG.
     */
    @ReactMethod
    public void clearAllBubbles(Promise promise) {
        main.post(() -> {
            int n = clearTaggedBubbles();
            if (promise != null) promise.resolve(n);
        });
    }

    @SuppressWarnings("unchecked")
    private int clearTaggedBubbles() {
        int removed = 0;
        try {
            Class<?> wmg = Class.forName("android.view.WindowManagerGlobal");
            Object inst = wmg.getMethod("getInstance").invoke(null);
            java.lang.reflect.Field f = wmg.getDeclaredField("mViews");
            f.setAccessible(true);
            java.util.List<View> views = (java.util.List<View>) f.get(inst);
            WindowManager w = (WindowManager) getReactApplicationContext()
                    .getSystemService(Context.WINDOW_SERVICE);
            for (View v : new java.util.ArrayList<>(views)) {
                if (v != null && BUBBLE_TAG.equals(v.getTag())) {
                    try { w.removeViewImmediate(v); removed++; } catch (Exception ignored) {}
                }
            }
        } catch (Throwable ignored) {
            // Reflection unavailable → fall back to the tracked reference only.
        }
        if (removed > 0) {
            overlayView = null;
            overlayParams = null;
            bubbleShown = false;
        }
        return removed;
    }

    private int screenW() {
        return getReactApplicationContext().getResources().getDisplayMetrics().widthPixels;
    }

    private int screenH() {
        return getReactApplicationContext().getResources().getDisplayMetrics().heightPixels;
    }

    private int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private int dp(int v) {
        float d = getReactApplicationContext().getResources().getDisplayMetrics().density;
        return (int) (v * d);
    }
}
