#!/bin/bash

# Script per sincronizzare i backup con OneDrive dal sistema host
# Questo script viene chiamato dal container Docker quando rclone non è disponibile

# Parametri:
# $1: Percorso del file di backup nel container
# $2: Tipo di backup (daily, weekly, monthly, yearly)

# Converti il percorso del container in percorso del sistema host
CONTAINER_PATH=$1
BACKUP_TYPE=$2

# Estrai il nome del file dal percorso
FILENAME=$(basename "$CONTAINER_PATH")

# Percorso del file sul sistema host
HOST_PATH="/opt/afc-v3/database/backups/$BACKUP_TYPE/$FILENAME"

echo "Sincronizzazione del backup $FILENAME con OneDrive dal sistema host..."

# Verifica che il file esista
if [ ! -f "$HOST_PATH" ]; then
    echo "ERRORE: Il file di backup $HOST_PATH non esiste!"
    exit 1
fi

# Sincronizza il file con OneDrive
echo "Esecuzione comando: rclone copy \"$HOST_PATH\" \"afc-backup:AFC_Backups/database/$BACKUP_TYPE\" --stats-one-line"
rclone copy "$HOST_PATH" "afc-backup:AFC_Backups/database/$BACKUP_TYPE" --stats-one-line

# Verifica che il backup sia stato sincronizzato
echo "Verifica sincronizzazione..."
VERIFY_OUTPUT=$(rclone ls "afc-backup:AFC_Backups/database/$BACKUP_TYPE")

if echo "$VERIFY_OUTPUT" | grep -q "$FILENAME"; then
    echo "Backup $FILENAME sincronizzato correttamente su OneDrive"
    exit 0
else
    echo "Backup $FILENAME non trovato su OneDrive dopo la sincronizzazione. Riprovo..."
    
    # Ultimo tentativo di sincronizzazione
    echo "Ultimo tentativo di sincronizzazione..."
    rclone copy "$HOST_PATH" "afc-backup:AFC_Backups/database/$BACKUP_TYPE" --stats-one-line
    
    # Verifica finale
    FINAL_VERIFY_OUTPUT=$(rclone ls "afc-backup:AFC_Backups/database/$BACKUP_TYPE")
    
    if echo "$FINAL_VERIFY_OUTPUT" | grep -q "$FILENAME"; then
        echo "Backup $FILENAME sincronizzato correttamente su OneDrive dopo il secondo tentativo"
        exit 0
    else
        echo "ERRORE: Backup $FILENAME non sincronizzato su OneDrive dopo due tentativi"
        exit 1
    fi
fi
