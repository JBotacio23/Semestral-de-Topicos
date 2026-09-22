#!/bin/sh
set -e

# freshclam + clamd de la imagen oficial, en segundo plano. La primera carga
# de firmas tarda 1-2 minutos; mientras tanto /health y /scan responden 503.
/init &

exec node /app/server.js
