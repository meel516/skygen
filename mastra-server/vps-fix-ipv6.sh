#!/usr/bin/env bash
set -euo pipefail

ip -6 addr del 2001:41d0:a:4964::9039/128 dev eth0 2>/dev/null || true
ip -6 addr add 2001:41d0:a:4964::9039/128 dev eth0 nodad
ip -6 route replace default via 2001:41d0:a:49ff:ff:ff:ff:ff dev eth0 src 2001:41d0:a:4964::9039
