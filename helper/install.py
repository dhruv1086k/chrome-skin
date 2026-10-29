#!/usr/bin/env python3
"""Install / uninstall the NEXUS stats helper (Chrome native-messaging host).

  python install.py                 (asks for your extension ID)
  python install.py <extension-id>
  python install.py --uninstall
"""
import json, os, re, shutil, subprocess, sys

NAME = "com.nexus.stats"
HERE = os.path.dirname(os.path.abspath(__file__))
HOST = os.path.join(HERE, "nexus_host.py")
MANIFEST = os.path.join(HERE, NAME + ".json")
WIN = os.name == "nt"

WIN_KEYS = [
    r"Software\Google\Chrome\NativeMessagingHosts",
    r"Software\Microsoft\Edge\NativeMessagingHosts",
    r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts",
]
HOME = os.path.expanduser("~")
if sys.platform == "darwin":
    UNIX_DIRS = [
        os.path.join(HOME, "Library/Application Support/Google/Chrome/NativeMessagingHosts"),
        os.path.join(HOME, "Library/Application Support/Chromium/NativeMessagingHosts"),
        os.path.join(HOME, "Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"),
        os.path.join(HOME, "Library/Application Support/Microsoft Edge/NativeMessagingHosts"),
    ]
else:
    UNIX_DIRS = [
        os.path.join(HOME, ".config/google-chrome/NativeMessagingHosts"),
        os.path.join(HOME, ".config/chromium/NativeMessagingHosts"),
        os.path.join(HOME, ".config/BraveSoftware/Brave-Browser/NativeMessagingHosts"),
        os.path.join(HOME, ".config/microsoft-edge/NativeMessagingHosts"),
    ]


def launcher_path():
    return os.path.join(HERE, "run_host.bat" if WIN else "run_host.sh")


def write_launcher():
    p = launcher_path()
    if WIN:
        with open(p, "w", newline="\r\n") as f:
            f.write('@echo off\r\n"%s" "%s"\r\n' % (sys.executable, HOST))
    else:
        with open(p, "w") as f:
            f.write('#!/bin/sh\nexec "%s" "%s"\n' % (sys.executable, HOST))
        os.chmod(p, 0o755)
    return p


def write_manifest(ext_id, launcher):
    data = {
        "name": NAME,
        "description": "NEXUS new tab stats helper (GPU + network)",
        "path": launcher,
        "type": "stdio",
        "allowed_origins": ["chrome-extension://%s/" % ext_id],
    }
    with open(MANIFEST, "w") as f:
        json.dump(data, f, indent=2)


def register():
    done = []
    if WIN:
        import winreg
        for key in WIN_KEYS:
            try:
                with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key + "\\" + NAME) as k:
                    winreg.SetValueEx(k, "", 0, winreg.REG_SZ, MANIFEST)
                done.append(key.split("\\")[1])
            except OSError:
                pass
    else:
        for d in UNIX_DIRS:
            if os.path.isdir(os.path.dirname(d)):
                os.makedirs(d, exist_ok=True)
                shutil.copyfile(MANIFEST, os.path.join(d, NAME + ".json"))
                done.append(d)
    return done


def unregister():
    if WIN:
        import winreg
        for key in WIN_KEYS:
            try:
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key + "\\" + NAME)
            except OSError:
                pass
    else:
        for d in UNIX_DIRS:
            p = os.path.join(d, NAME + ".json")
            if os.path.exists(p):
                os.remove(p)
    for p in (MANIFEST, launcher_path()):
        if os.path.exists(p):
            os.remove(p)


def ensure_psutil():
    try:
        import psutil  # noqa: F401
        return True
    except ImportError:
        print("Installing psutil (needed for network speed)...")
        r = subprocess.run([sys.executable, "-m", "pip", "install", "--user", "psutil"])
        return r.returncode == 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--uninstall" in sys.argv:
        unregister()
        print("NEXUS stats helper removed.")
        return 0
    if sys.version_info < (3, 7):
        print("Python 3.7 or newer is required.")
        return 1
    ext_id = args[0] if args else input(
        "Paste your NEXUS extension ID (Settings > Behavior > System stats,\n"
        "or chrome://extensions with Developer mode on): "
    ).strip()
    if not re.fullmatch(r"[a-p]{32}", ext_id):
        print("That doesn't look like an extension ID (32 letters a-p).")
        return 1
    psutil_ok = ensure_psutil()
    launcher = write_launcher()
    write_manifest(ext_id, launcher)
    done = register()
    smi = shutil.which("nvidia-smi") or (os.path.exists(r"C:\Windows\System32\nvidia-smi.exe") if WIN else False)
    print()
    print("Registered for:", ", ".join(done) if done else "(no supported browser found)")
    print("Network speed :", "ready" if psutil_ok else "psutil missing - upload/download will fall back to estimates")
    print("NVIDIA GPU    :", "nvidia-smi found" if smi else "nvidia-smi NOT found - install the NVIDIA driver; GPU % will stay blank")
    print("\nDone. Reload the NEXUS extension, then open a new tab.")
    return 0 if done else 1


if __name__ == "__main__":
    sys.exit(main())
