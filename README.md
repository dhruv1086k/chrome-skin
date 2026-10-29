# NEXUS — Chrome New Tab

A lightweight Manifest V3 extension built with vanilla HTML, CSS, and JavaScript modules. Its wallpaper, clock, saved shortcuts, cached weather, cached GitHub data, and layout render locally; network-backed widgets update after startup.

## Install

1. Download or clone this project folder.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Choose **Load unpacked** and select this folder (the one containing `manifest.json`).
4. Open a new tab. No build step is required.

## Configure

Open the gear button in the top-right.

- **Appearance:** import a wallpaper, tune brightness/overlays/glass, choose accent and font.
- **Behavior:** select search engine, link behavior, clock format, weather city/coordinates, GitHub username, repository refresh interval, and optional token. Search aliases can be edited as a JSON object of command names and URL templates; use `{query}` for the search text.
- **Shortcuts:** add/edit/remove/duplicate, import/export JSON, and drag tiles on the page to reorder. Use the Add Shortcut tile. Upload an icon or use an icon URL; otherwise the Chrome favicon service is used.
- **Tab groups:** the card under the weather lists every tab group. Chrome only exposes *open* groups to extensions, so NEXUS remembers each group it has seen (name, colour, tab URLs) in `chrome.storage.local` and shows closed ones as dashed "saved" chips. Click an open group to jump to it, click a saved group to reopen all its tabs as a group in this window. Hover a saved chip and press × to forget it. A group is remembered after you open it once while NEXUS is installed, so open each existing saved group once from Chrome's Tab groups menu. `›` pages through more than 15.
- **System stats:** the bottom panel shows CPU %, RAM %, GPU name and network info, refreshed every 2 s while the tab is visible. See *Stats notes* below.
- **Data:** export/import settings and restore defaults. The settings export includes local preference values; keep it private if you configure a GitHub token.

Weather uses the no-key Open-Meteo geocoding and forecast APIs. GitHub loads up to five most recently updated public repositories. An optional GitHub token can improve API rate limits; it is stored in `chrome.storage.local` and sent only to `api.github.com`.

## Permissions

- `storage`: persist preferences and response caches.
- `history`: local history suggestions in the search box. History is read from Chrome and never uploaded.
- `favicon`: display Chrome-provided favicons for shortcut tiles and group tabs.
- `tabs`, `tabGroups`: read your open tab groups and their tab titles/URLs to show the Groups card and switch to a tab when you click it. Nothing is stored or uploaded.
- `nativeMessaging`: talk to the optional stats helper (see `helper/README.md`). Does nothing unless you install it.
- `system.cpu`, `system.memory`: read CPU load and RAM usage for the System Specifications panel.
- Host access to `api.open-meteo.com` and `geocoding-api.open-meteo.com`: request the selected location's forecast and resolve city names.
- Host access to `api.github.com`: retrieve public repositories for the configured account.

## Notes

- Browsing records and personal photos stay on-device. The extension makes only the weather and GitHub requests described above. Inter is bundled locally in `assets/fonts`, so no network font is needed.
- The optional token is stored locally without encryption by Chrome's extension storage; use a fine-grained, read-only token and do not export/share a settings backup containing it.
- This workspace does not include automated Chrome UI testing. Load the unpacked folder to grant Chrome its extension APIs and verify the final appearance on your display.

- **Wallpaper:** replace `assets/wallpaper.webp` with your own image (16:9, ~1672×941 or larger) or import one in Settings → Appearance.

## Stats notes

- **CPU** and **RAM** are live values from `chrome.system.cpu` / `chrome.system.memory`.
- **GPU load** and **upload/download speed** need the optional helper in `helper/` (NVIDIA + Windows is the tested path). Setup: `helper/README.md`.
- **Without the helper:** the GPU card shows the adapter name Chrome reports and "—" for load; the Network card shows Chrome's download estimate and latency. On hybrid laptops Chrome may report the integrated GPU; set the label in Settings → Behavior → System stats.
