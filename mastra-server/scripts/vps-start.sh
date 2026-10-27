#!/bin/bash
set -e
cd /opt/videogen-mastra/mastra-server
pkill -f 'node.*index.mjs' 2>/dev/null || true
sleep 1

# Load .env into env (the built bundle uses process.env at runtime)
set -a
. ./.env
set +a

PORT=4111 nohup node .mastra/output/index.mjs > /tmp/mastra.log 2>&1 &
echo "PID=$!"
sleep 6
echo "--- LOG ---"
tail -30 /tmp/mastra.log
echo "--- LISTEN ---"
ss -lntp | grep 4111 || echo "not listening"
