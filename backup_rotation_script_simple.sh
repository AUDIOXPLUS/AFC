#!/bin/bash
set -e # Esce immediatamente se un comando fallisce

# ===----------------------------------------------------------------------===
# Script di Backup Semplificato con Rotazione (Giornaliera, Settimanale, Mensile)
# ===----------------------------------------------------------------------===
# Questo script deve essere eseguito UNA VOLTA AL GIORNO (preferibilmente di notte)
# tramite cron, ad esempio: 0 2 * * * /opt/afc-v3/backup_rotation_script_simple.sh

# --- Configurazione ---
REMOTE_USER="axp"
REMOTE_HOST="185.250.144.219"
REMOTE_PORT="22222"
REMOTE_SSH_KEY="~/.ssh/id_rsa_server_remoto"
REMOTE_SOURCE_DIR="/opt/afc-v3/"
LOCAL_BASE_BACKUP_DIR="/opt/afc-v3/backups"
LOG_FILE="/opt/afc-v3/logs/backup_script.log"

# Directory specifiche per i livelli di backup
DAILY_DIR="$LOCAL_BASE_BACKUP_DIR/daily"
WEEKLY_DIR="$LOCAL_BASE_BACKUP_DIR/weekly"
MONTHLY_DIR="$LOCAL_BASE_BACKUP_DIR/monthly"

# Limiti di conservazione
MAX_DAILY=7    # Mantieni gli ultimi 7 backup giornalieri
MAX_WEEKLY=4   # Mantieni gli ultimi 4 backup settimanali
MAX_MONTHLY=6  # Mantieni gli ultimi 6 backup mensili

# --- Variabili di Tempo ---
NOW_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
CURRENT_DAY_OF_WEEK=$(date +"%u") # 1 (Lunedì) a 7 (Domenica)
CURRENT_DAY_OF_MONTH=$(date +"%d")

# --- Funzioni ---

# Funzione per loggare messaggi con timestamp
log_message() {
    local message="$1"
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $message" | tee -a "$LOG_FILE"
}

# Funzione per creare directory se non esistono
ensure_dir() {
    local dir_path="$1"
    if [ ! -d "$dir_path" ]; then
        log_message "Creazione directory: $dir_path"
        mkdir -p "$dir_path"
        if [ $? -ne 0 ]; then
            log_message "ERRORE: Impossibile creare la directory $dir_path."
            exit 1
        fi
    fi
}

# Funzione per la pulizia delle vecchie cartelle di backup
cleanup_backups() {
    local dir_to_clean="$1"
    local max_files_to_keep="$2"

    if [ ! -d "$dir_to_clean" ]; then
        log_message "Attenzione: La directory $dir_to_clean non esiste."
        return
    fi

    # Conta solo le directory che iniziano con 'backup_'
    local current_backup_count=$(find "$dir_to_clean" -maxdepth 1 -name 'backup_*' -type d | wc -l)

    if [ "$current_backup_count" -gt "$max_files_to_keep" ]; then
        local backups_to_delete_count=$((current_backup_count - max_files_to_keep))
        log_message "Pulizia $dir_to_clean: Trovati $current_backup_count backup, mantengo $max_files_to_keep, elimino $backups_to_delete_count."

        # Elimina i backup più vecchi
        find "$dir_to_clean" -maxdepth 1 -name 'backup_*' -type d -printf '%T@ %p\n' | \
            sort -n | head -n "$backups_to_delete_count" | cut -d' ' -f2- | \
            while read -r old_backup_path; do
                if [ -d "$old_backup_path" ]; then
                    log_message "Eliminazione vecchio backup: $old_backup_path"
                    rm -rf "$old_backup_path"
                fi
            done
    else
        log_message "Pulizia $dir_to_clean: $current_backup_count backup trovati, nessuno da eliminare (limite: $max_files_to_keep)."
    fi
}

# --- Logica Principale dello Script ---

log_message "========== Inizio Backup Giornaliero =========="

# Espandi il percorso della chiave SSH
if [[ "$REMOTE_SSH_KEY" == "~/"* ]]; then
    REMOTE_SSH_KEY_PATH="$HOME/${REMOTE_SSH_KEY:2}"
else
    REMOTE_SSH_KEY_PATH="$REMOTE_SSH_KEY"
fi

# Verifica che la chiave SSH esista
if [ ! -f "$REMOTE_SSH_KEY_PATH" ]; then
    log_message "ERRORE CRITICO: Chiave SSH non trovata in $REMOTE_SSH_KEY_PATH."
    exit 1
fi

# Crea le directory necessarie
ensure_dir "$LOCAL_BASE_BACKUP_DIR"
ensure_dir "$(dirname "$LOG_FILE")"
ensure_dir "$DAILY_DIR"
ensure_dir "$WEEKLY_DIR"
ensure_dir "$MONTHLY_DIR"

# Esegui il backup giornaliero
DAILY_BACKUP_TARGET_DIR="$DAILY_DIR/backup_$NOW_TIMESTAMP"
log_message "Esecuzione backup giornaliero: $REMOTE_USER@$REMOTE_HOST:$REMOTE_SOURCE_DIR -> $DAILY_BACKUP_TARGET_DIR"

# Crea la directory di destinazione
ensure_dir "$DAILY_BACKUP_TARGET_DIR"

# Comando rsync ottimizzato
rsync_command=(
    rsync -avz --delete --stats
    --include='database/AFC.db'
    --include='database/'
    --exclude='database/*'
    --include='uploads/***'
    --exclude='backups/***'  # IMPORTANTE: Esclude la directory backups per evitare ricorsione
    --exclude='logs/***'      # Esclude i log per risparmiare spazio
    --exclude='node_modules/***'  # Esclude node_modules
    --exclude='*.tmp'
    --exclude='*.log'
    --exclude='*'
    -e "ssh -p $REMOTE_PORT -i $REMOTE_SSH_KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SOURCE_DIR}"
    "${DAILY_BACKUP_TARGET_DIR}/"
)

log_message "Esecuzione rsync..."
rsync_output=$( "${rsync_command[@]}" 2>&1 ) || rsync_exit_code=$?
rsync_exit_code=${rsync_exit_code:-0}

if [ $rsync_exit_code -ne 0 ]; then
    log_message "ERRORE: Rsync fallito con codice $rsync_exit_code"
    log_message "Output: $rsync_output"
    rm -rf "$DAILY_BACKUP_TARGET_DIR"
    log_message "Directory backup incompleta rimossa."
    exit 1
fi

log_message "Backup giornaliero completato con successo."

# Rotazione Settimanale (ogni domenica)
if [ "$CURRENT_DAY_OF_WEEK" == "7" ]; then
    log_message "È domenica, creo backup settimanale."
    WEEKLY_BACKUP_TARGET_PATH="$WEEKLY_DIR/backup_$NOW_TIMESTAMP"
    cp -al "$DAILY_BACKUP_TARGET_DIR" "$WEEKLY_BACKUP_TARGET_PATH"
    if [ $? -eq 0 ]; then
        log_message "Backup settimanale creato: $WEEKLY_BACKUP_TARGET_PATH"
        cleanup_backups "$WEEKLY_DIR" "$MAX_WEEKLY"
    else
        log_message "ERRORE: Impossibile creare backup settimanale."
    fi
fi

# Rotazione Mensile (primo giorno del mese)
if [ "$CURRENT_DAY_OF_MONTH" == "01" ]; then
    log_message "È il primo del mese, creo backup mensile."
    MONTHLY_BACKUP_TARGET_PATH="$MONTHLY_DIR/backup_$NOW_TIMESTAMP"
    cp -al "$DAILY_BACKUP_TARGET_DIR" "$MONTHLY_BACKUP_TARGET_PATH"
    if [ $? -eq 0 ]; then
        log_message "Backup mensile creato: $MONTHLY_BACKUP_TARGET_PATH"
        cleanup_backups "$MONTHLY_DIR" "$MAX_MONTHLY"
    else
        log_message "ERRORE: Impossibile creare backup mensile."
    fi
fi

# Pulizia dei backup giornalieri
cleanup_backups "$DAILY_DIR" "$MAX_DAILY"

# Rimuovi la vecchia directory hourly se esiste ancora
if [ -d "$LOCAL_BASE_BACKUP_DIR/hourly" ]; then
    log_message "ATTENZIONE: Trovata vecchia directory 'hourly' con backup orari."
    HOURLY_SIZE=$(du -sh "$LOCAL_BASE_BACKUP_DIR/hourly" | cut -f1)
    log_message "La directory hourly occupa $HOURLY_SIZE di spazio."
    log_message "Per liberare spazio, esegui: rm -rf $LOCAL_BASE_BACKUP_DIR/hourly"
    log_message "NOTA: Questo eliminerà tutti i vecchi backup orari!"
fi

# Report finale
log_message "========== Backup Completato =========="
log_message "Spazio utilizzato dai backup:"
du -sh "$LOCAL_BASE_BACKUP_DIR"/* 2>/dev/null | while read size path; do
    log_message "  $size - $path"
done

exit 0
