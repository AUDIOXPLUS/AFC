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
# Numero massimo di backup da mantenere (gli altri verranno cancellati)
MAX_BACKUPS=7

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

# --- ROTAZIONE BACKUP (cancellazione dei vecchi) ---
# Conta i backup esistenti ordinati per data (dal più recente al più vecchio)
BACKUP_COUNT=$(ls -t "${DEST_DIR}"/backup_*.tar.gz 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -ge "$MAX_BACKUPS" ]; then
    # Calcola quanti backup cancellare
    TO_DELETE=$((BACKUP_COUNT - MAX_BACKUPS + 1))
    log_message "Trovati $BACKUP_COUNT backup, ne manterremo solo $MAX_BACKUPS. Cancello i $TO_DELETE più vecchi."
    
    # Cancella i backup più vecchi (gli ultimi nella lista ordinata)
    ls -t "${DEST_DIR}"/backup_*.tar.gz 2>/dev/null | tail -n "$TO_DELETE" | while read -r old_backup; do
        if [ -f "$old_backup" ]; then
            log_message "Cancello backup vecchio: $(basename "$old_backup")"
            rm -f "$old_backup"
            if [ $? -eq 0 ]; then
                log_message "Backup $(basename "$old_backup") cancellato con successo"
            else
                log_message "ERRORE: Impossibile cancellare $(basename "$old_backup")"
            fi
        fi
    done
else
    log_message "Backup esistenti: $BACKUP_COUNT (limite: $MAX_BACKUPS). Nessuna cancellazione necessaria."
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
