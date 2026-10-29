# NEXUS stats helper (optional)

Gives the System Specifications panel what Chrome can't: **real GPU load** (NVIDIA) and
**real upload / download speed**. Without it NEXUS still works and shows the GPU name plus
Chrome's download estimate.

## Install (Windows)

1. Install Python 3.8+ from python.org (tick **Add python.exe to PATH**).
   If you only have the Microsoft Store "python" shortcut, install the real one.
2. Install the NVIDIA driver if you haven't (it provides `nvidia-smi`, which is how GPU load is read).
3. In Chrome open NEXUS settings → **Behavior → System stats** and click **Copy** next to *Your extension ID*.
4. Double-click `helper/install.bat`, paste the ID, press Enter.
5. Go to `chrome://extensions`, click **Reload** on NEXUS, open a new tab.

Settings → Behavior → System stats shows **● Helper connected** when it works.

Linux/macOS: `./install.sh <extension-id>` (untested; there is no `nvidia-smi` on macOS, so only network speed works there).

## Re-run the installer if…
- you move or rename the NEXUS folder (the helper's path is stored on install), or
- you remove and re-add the extension (Chrome gives unpacked extensions a new ID).

## Uninstall
Run `helper/uninstall.bat`.

## How it works / privacy
Chrome starts `nexus_host.py` only while a NEXUS tab is visible and stops it when you leave. Every
2 seconds it runs `nvidia-smi` and reads the network adapters' byte counters (via `psutil`),
and sends two numbers to the page. Nothing is stored, logged or sent over the internet. It registers
under your user account only (HKCU), and only this extension's ID is allowed to talk to it.

## Troubleshooting
- **Not connected:** re-check the ID, reload the extension, make sure `py -3 --version` works in a terminal.
- **GPU % blank but connected:** run `nvidia-smi` in a terminal; if that fails, reinstall the NVIDIA driver.
- **AMD / Intel GPU:** not supported yet (no cross-vendor load counter); the GPU card shows the name only.
- **Upload/download looks high:** VPN and virtual adapters are partly filtered, but some may still be counted.
