#!/bin/bash
# Launch the Next.js production server detached from the current session.
cd /home/wysh/Documents/coding/cybersaathi/apps/web
exec setsid npx next start --port 3000 --hostname 127.0.0.1 < /dev/null > /tmp/cs-web.log 2>&1
