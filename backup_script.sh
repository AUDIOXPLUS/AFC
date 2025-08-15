#!/bin/bash

# --- CONFIGURAZIONE ---
# Cartella di cui fare il backup
SOURCE_DIR="/opt/afc-v3"
# Destinazione del backup (disco esterno)
DEST_DIR="/media/axp/Volume"
# Nome del file di log
LOG_FILE="${DEST_DIR}/backup_log.txt"
# Formato della data per il nome del file di backup
DATE_FORMAT=$(date +"%Y-%m-%d_%H-%M-%S")
# Nome del file di backup
BACKUP_FILENAME="backup_${DATE_FORMAT}.tar.gz"

# --- FUNZIONE DI LOGGING ---
log_message() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" >> "$LOG_FILE"
}

# --- INIZIO SCRIPT ---

# Controlla se la directory di destinazione esiste, altrimenti creala
if [ ! -d "$DEST_DIR" ]; then
    log_message "La directory di destinazione $DEST_DIR non esiste. Tento di crearla."
    sudo mkdir -p "$DEST_DIR"
    if [ $? -ne 0 ]; then
        log_message "ERRORE: Impossibile creare la directory di destinazione $DEST_DIR. Uscita."
        exit 1
    fi
fi

log_message "Inizio del backup di $SOURCE_DIR"

# Controllo se il disco esterno è montato
if ! mountpoint -q "$DEST_DIR"; then
    log_message "ERRORE: Il disco esterno non è montato in $DEST_DIR. Backup annullato."
    exit 1
fi

# Comando per creare l'archivio compresso
# -c: crea un nuovo archivio
# -z: comprime con gzip
# -p: preserva i permessi
# -f: specifica il nome del file dell'archivio
# --one-file-system: non attraversa i confini del filesystem
# --ignore-failed-read: non si blocca se un file non è leggibile
tar -czpf "${DEST_DIR}/${BACKUP_FILENAME}" --one-file-system --ignore-failed-read -C "$(dirname "$SOURCE_DIR")" "$(basename "$SOURCE_DIR")"

# Controlla se il comando tar è andato a buon fine
if [ $? -eq 0 ]; then
    log_message "Backup completato con successo: ${DEST_DIR}/${BACKUP_FILENAME}"
else
    log_message "ERRORE: Il backup di $SOURCE_DIR è fallito."
    exit 1
fi

log_message "--- Backup terminato ---"

exit 0
