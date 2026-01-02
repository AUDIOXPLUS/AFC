#!/bin/bash

# === CONFIGURAZIONE ===
DEPLOY_SCRIPT="/opt/afc-v3/deploy.sh"
LOG_FILE="/opt/afc-v3/logs/deploy_cron.log"
# Orario: Ogni notte alle 02:00
CRON_SCHEDULE="0 2 * * *"

# Verifica esistenza cartella logs
mkdir -p /opt/afc-v3/logs

echo "⚙️ Configurazione automazione deploy..."

# Verifica permessi script deploy
if [ ! -x "$DEPLOY_SCRIPT" ]; then
    echo "🔧 Rendo eseguibile $DEPLOY_SCRIPT..."
    chmod +x "$DEPLOY_SCRIPT"
fi

# Crea il comando per il crontab
# Nota: Usiamo bash esplicitamente per evitare problemi di shell
FULL_CMD="/bin/bash $DEPLOY_SCRIPT >> $LOG_FILE 2>&1"
CRON_JOB="$CRON_SCHEDULE $FULL_CMD"

# Controllo se esiste già nel crontab corrente
EXISTING_CRON=$(crontab -l 2>/dev/null | grep "$DEPLOY_SCRIPT")

if [ -n "$EXISTING_CRON" ]; then
    echo "⚠️ Schedulazione già presente, aggiorno..."
    # Rimuove la vecchia entry e aggiungie la nuova
    (crontab -l 2>/dev/null | grep -v "$DEPLOY_SCRIPT"; echo "$CRON_JOB") | crontab -
else
    echo "➕ Aggiungo nuova schedulazione..."
    # Aggiunge la nuova entry mantenendo le altre esistenti
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
fi

echo "✅ Deploy automatico schedulato: Ogni giorno alle 02:00"
echo "📄 I log verranno salvati in: $LOG_FILE"
echo "💡 Per verificare, esegui: crontab -l"
