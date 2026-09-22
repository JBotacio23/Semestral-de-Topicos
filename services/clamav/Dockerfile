# Imagen oficial de ClamAV (Alpine): su /init actualiza firmas (freshclam) y
# levanta clamd en el puerto 3310. Encima corre la API REST de server.js.
FROM clamav/clamav:stable

RUN apk add --no-cache nodejs

WORKDIR /app
COPY server.js entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
