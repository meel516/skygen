#!/bin/bash
# PM2 entrypoint — sources .env then execs node so process.env is populated
cd /opt/videogen-mastra/mastra-server
set -a
. ./.env
set +a
exec node .mastra/output/index.mjs
