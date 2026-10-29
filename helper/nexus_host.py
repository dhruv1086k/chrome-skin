#!/usr/bin/env python3
"""NEXUS stats helper: Chrome native-messaging host.

Chrome starts this process when the NEXUS new tab opens and closes it when the
tab goes away. Every 2 seconds it sends one JSON message with:
  - GPU name / utilisation / memory (NVIDIA, via nvidia-smi)
  - network download / upload speed in Mbps (via psutil)
Nothing is written to disk and nothing leaves your computer.
"""
import json, os, shutil, struct, subprocess, sys, threading, time

try:
    import psutil
except ImportError:
    psutil = None

INTERVAL = 2.0
WIN = os.name == "nt"

if WIN:
    import msvcrt
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

_out_lock = threading.Lock()


def send(obj):
    data = json.dumps(obj, separators=(",", ":")).encode("utf-8")
    with _out_lock:
        try:
            sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
            sys.stdout.buffer.flush()
        except (BrokenPipeError, OSError):
            os._exit(0)  # Chrome went away


def reader():
    """Exit as soon as Chrome closes the pipe (tab closed / extension reloaded)."""
    stdin = sys.stdin.buffer
    while True:
        head = stdin.read(4)
        if len(head) < 4:
            os._exit(0)
        (n,) = struct.unpack("<I", head)
        if n:
            stdin.read(n)  # messages from the page are ignored


def find_nvidia_smi():
    p = shutil.which("nvidia-smi")
    if p:
        return p
    if WIN:
        for c in (
            r"C:\Windows\System32\nvidia-smi.exe",
            r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe",
        ):
            if os.path.exists(c):
                return c
    return None


SMI = find_nvidia_smi()
SMI_ARGS = [
    "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
    "--format=csv,noheader,nounits",
]


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def read_gpu():
    if not SMI:
        return None
    try:
        r = subprocess.run(
            [SMI] + SMI_ARGS,
            capture_output=True, text=True, timeout=4,
            creationflags=0x08000000 if WIN else 0,  # CREATE_NO_WINDOW
        )
        if r.returncode != 0:
            return None
        best = None
        for line in r.stdout.strip().splitlines():
            f = [x.strip() for x in line.split(",")]
            if len(f) < 4:
                continue
            g = {
                "name": f[0],
                "util": num(f[1]),
                "memUsed": num(f[2]),
                "memTotal": num(f[3]),
                "temp": num(f[4]) if len(f) > 4 else None,
            }
            if g["util"] is None:
                continue
            if best is None or g["util"] > best["util"]:
                best = g  # hybrid/multi-GPU: report the busiest one
        return best
    except Exception:
        return None


SKIP_NICS = ("lo", "loopback", "vethernet", "vmnet", "vboxnet", "docker", "br-", "veth")


def nic_totals():
    sent = recv = 0
    for name, c in psutil.net_io_counters(pernic=True).items():
        if name.lower().startswith(SKIP_NICS):
            continue
        sent += c.bytes_sent
        recv += c.bytes_recv
    return sent, recv


def main():
    threading.Thread(target=reader, daemon=True).start()
    send({"type": "hello", "version": 1, "gpu": bool(SMI), "net": bool(psutil)})
    prev = None
    if psutil:
        try:
            prev = (time.monotonic(),) + nic_totals()
        except Exception:
            prev = None
    while True:
        time.sleep(INTERVAL)
        net = None
        if psutil and prev:
            try:
                now = (time.monotonic(),) + nic_totals()
                dt = max(now[0] - prev[0], 0.001)
                up = max(0, now[1] - prev[1]) * 8 / 1e6 / dt
                down = max(0, now[2] - prev[2]) * 8 / 1e6 / dt
                prev = now
                net = {"up": round(up, 2), "down": round(down, 2)}
            except Exception:
                net = None
        send({"type": "stats", "gpu": read_gpu(), "net": net})


if __name__ == "__main__":
    main()
