#!/usr/bin/env python3
"""
Fetch Xray JSON subscription, TCP-test each proxy config's server,
pick the fastest reachable one, patch in an HTTP inbound on 0.0.0.0:10809,
and print the final Xray config JSON to stdout.

Usage:
    python3 find-fastest.py <subscription_url> > /tmp/config.json
"""

import json
import socket
import sys
import time
import urllib.request

TIMEOUT_SEC = 5
HTTP_INBOUND_PORT = 10809


def proxy_server(config: dict) -> tuple[str | None, int | None]:
    """Return (host, port) of the first real outbound, or (None, None)."""
    for ob in config.get("outbounds", []):
        proto = ob.get("protocol", "")
        if proto in ("freedom", "blackhole", "dns"):
            continue
        settings = ob.get("settings", {})
        # VLESS / VMess
        for entry in settings.get("vnext", []):
            return entry.get("address"), entry.get("port")
        # Trojan / Shadowsocks
        for entry in settings.get("servers", []):
            return entry.get("address"), entry.get("port")
    return None, None


def tcp_latency(host: str, port: int) -> float:
    """TCP connection latency in seconds, or inf on failure."""
    try:
        start = time.monotonic()
        with socket.create_connection((host, port), timeout=TIMEOUT_SEC):
            pass
        return time.monotonic() - start
    except Exception:
        return float("inf")


def main():
    if len(sys.argv) < 2:
        print("Usage: find-fastest.py <subscription_url>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    print(f"Fetching subscription from {url} …", file=sys.stderr)

    with urllib.request.urlopen(url, timeout=15) as resp:
        configs: list[dict] = json.load(resp)

    print(f"Found {len(configs)} configs — testing TCP latency …\n", file=sys.stderr)

    best_config = None
    best_latency = float("inf")

    for i, config in enumerate(configs):
        host, port = proxy_server(config)
        if not host:
            continue

        latency = tcp_latency(host, port)
        label = config.get("remarks", f"config-{i}")[:50]

        if latency == float("inf"):
            print(f"  [{i:02d}] {label:<50}  timeout", file=sys.stderr)
        else:
            print(f"  [{i:02d}] {label:<50}  {latency * 1000:.0f} ms", file=sys.stderr)

        if latency < best_latency:
            best_latency = latency
            best_config = config

    if best_config is None:
        print("\nERROR: no reachable proxy found.", file=sys.stderr)
        sys.exit(1)

    print(
        f"\n✓ Selected: {best_config.get('remarks', 'unknown')} "
        f"({best_latency * 1000:.0f} ms)",
        file=sys.stderr,
    )

    # Replace inbounds with a single HTTP proxy on 0.0.0.0:10809
    best_config["inbounds"] = [
        {
            "listen": "0.0.0.0",
            "port": HTTP_INBOUND_PORT,
            "protocol": "http",
            "settings": {},
            "tag": "http-in",
        }
    ]

    # Strip routing rules — they reference geosite.dat/geoip.dat which are
    # not present in the image. We don't need geo-based routing: all traffic
    # that reaches this proxy should go through the outbound tunnel.
    best_config["routing"] = {"rules": []}

    print(json.dumps(best_config, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
