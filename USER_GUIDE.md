# Dashboard for Supernote — User Guide

Dashboard turns a floating **⊕ bubble** into a launcher for your Supernote: one tap opens a
dashboard you compose yourself from **shortcuts**, **stars**, **keywords** and **app** sections.
It runs fully on‑device and offline.

> Requires the Supernote developer/beta firmware with the plugin system. Works on A5X, A5X2 (Manta)
> and Nomad.

---

## 1. Install

1. Copy `dashboard.snplg` into the **`MyStyle`** folder on your Supernote (USB, or the Partner app).
2. On the device: **Settings → Apps → Plugins → Add Plugin → dashboard**.
3. Open any note or document — a **Dashboard** button appears in the side toolbar.

*(Screenshot 1 — the plugin in Settings → Apps → Plugins)*
*(Screenshot 2 — the Dashboard button in the NOTE toolbar)*

---

## 2. The bubble

Tap the toolbar **Dashboard** button once, go to the **Finish** step and choose **Activate Bubble &
close** — a small **⊕ bubble** now floats over everything (notes, folders, apps, settings…).

- **Tap** the bubble → your dashboard opens full‑screen.
- **Drag** it anywhere; it stays where you leave it.
- **Long‑press** it → it closes (re‑activate it later from Settings).

The bubble has three looks (chosen in Settings → *Look*): **⊕ only**, **⊕ + “Dashboard”**, or
**⊕ + hint**.

> The bubble lives while the plugin is running (after you've opened a note this session). A device
> reboot clears it — just re‑activate it once.

*(Screenshot 3 — the bubble floating over a note, in each of the 3 modes)*

---

## 3. The dashboard

The dashboard is a stack (or 2‑column grid) of **sections**. Tap anything to act:

- **Shortcuts** — a folder (opens the file manager there), a note, or a PDF (opens the document).
- **Stars** — every starred (★) page from the last scan, grouped by note; a page with several stars
  shows `p.4 ×6`. Tap a page → the note opens there.
- **Keywords** — your notes' keywords, shown as tappable **chips**; each chip opens that exact
  note + page.
- **Apps** — buttons that launch ToDo, Calendar, Document, Search…

Top‑right of the dashboard: **⚙** (open Settings) and **⊖** (fold back to the bubble).

*(Screenshot 4 — a full dashboard with all four section types, Boxed theme)*

---

## 4. Building your dashboard (Settings)

Open Settings from the toolbar **Dashboard** button, or the **⚙** on the dashboard. It's a **4‑step
wizard** — each **Next** saves automatically (so **Back** and **✕** never lose anything). **✕**
(top‑right) closes the plugin.

**Step 1 · Look** — pick the **layout** (1 or 2 columns), the **design** (Ledger / Boxed / Airy,
previewed on your layout), and the **bubble** style.

*(Screenshot 5 — Step 1, showing the layout & design snapshots)*

**Step 2 · Sections** — a **live preview** of your page, and the list of sections. **＋** add a
section (Shortcuts / Stars / Keywords / Apps — you can have several of the same kind), **▲▼**
reorder, **✕** remove.

*(Screenshot 6 — Step 2, live preview + section list)*

**Step 3 · Content** — configure each section:
- set the **refresh** policy (on open / when older than 6–24 h / manual);
- rename any section (**✎ edit** the title, press **Done** to save);
- **Shortcuts**: **＋ Folder / ＋ Note / ＋ PDF** (browse anywhere on the device), reorder with ▲▼;
- **Stars / Keywords**: choose **folders to scan** (none = the whole device), and the **note order**
  (by date / by name);
- **Keywords**: **Group by** keyword or note, **View** as list / inline / by‑folder, and optionally
  pick **specific keywords** (none = all).

*(Screenshot 7 — Step 3, a Keywords section expanded)*

**Step 4 · Finish** — **Go to Dashboard**, **Activate Bubble & close**, or **Reset to defaults**.

---

## 5. Scanning

Stars and Keywords come from scanning your notes. Scanning is **on demand**: each section shows its
**last scan** time and a **↻ Refresh** button with progress. It auto‑refreshes on first view, when
stale, or on every open — your choice per the *Refresh* setting. Sections that scan the **same
folders** share a single scan. With **no folder selected**, the whole device is scanned.

---

## 6. Advanced

The whole configuration is a JSON file at **`MyStyle/Plugins/Dashboard/config.json`** — power users
can edit it directly (folders, titles, keyword selections, etc.). The in‑app wizard writes the same
file.

---

## 7. Good to know / limits

- **PDF pages**: a PDF opens on its last‑used page (jumping to a specific page isn't available yet).
- **Stars/keywords in PDFs** aren't listed (the system only exposes them for notes).
- **Search** launches the native search but can't be pre‑filled.
- If a **stray bubble** ever appears (e.g. after reinstalling), open the plugin once — it clears
  leftover bubbles — or long‑press to dismiss it.
