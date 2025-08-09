#!/usr/bin/env sh
set -e

# Assicura che la dir esista e sia scrivibile dall'utente dell'app
mkdir -p /app/logs

if [ "$(id -u)" = "0" ]; then
  # Se siamo root (caso tipico), sistemiamo ownership anche quando /app/logs è un volume
  chown -R 1001:1001 /app /app/logs || true
  # Esegui Java come utente 'spring' (uid 1001)
  exec su -s /bin/sh -c 'exec java $JAVA_OPTS -Dspring.config.location=file:/app/application.properties -jar /app/app.jar' spring
else
  # Se già non-root, avvia direttamente
  exec java $JAVA_OPTS -Dspring.config.location=file:/app/application.properties -jar /app/app.jar
fi
