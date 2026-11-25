#!/bin/sh
# Sauvegarde quotidienne chiffrée-compatible de la base (à lancer par cron en tant que postgres) :
#   0 3 * * * /var/www/promacidor/deploy/backup-db.sh
set -eu
DIR=/var/backups/promasidor
mkdir -p "$DIR" && chmod 700 "$DIR"
pg_dump -Fc promasidor > "$DIR/promasidor-$(date +%F).dump"
find "$DIR" -name '*.dump' -mtime +30 -delete   # conservation 30 jours
