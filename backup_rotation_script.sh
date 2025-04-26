#!/bin/bash
set -e # Esce immediatamente se un comando fallisce

# ===----------------------------------------------------------------------===
# Script per Backup Remoto con Rotazione (Oraria, Giornaliera, Settimanale, Mensile, Annuale)
# ===----------------------------------------------------------------------===

# --- Configurazione ---
REMOTE_USER="axp"
REMOTE_HOST="185.250.144.219"
REMOTE_PORT="22222"
# Percorso della chiave SSH privata per l'autenticazione sul server remoto.
# IMPORTANTE: Assicurarsi che questa chiave esista e sia accessibile dall'utente
# che esegue lo script (es. l'utente del cron job). L'espansione di '~' potrebbe
# non funzionare correttamente in tutti gli ambienti cron, considera l'uso di un percorso assoluto.
REMOTE_SSH_KEY="~/.ssh/id_rsa_server_remoto"
# Directory sorgente sul server remoto da backuppare. Deve terminare con '/'.
REMOTE_SOURCE_DIR="/opt/afc-v3/"
# Directory base locale dove verranno archiviati tutti i backup.
LOCAL_BASE_BACKUP_DIR="/opt/afc-v3/backups"
# File di log per lo script
LOG_FILE="/opt/afc-v3/logs/backup_script.log"

# Directory specifiche per i livelli di backup
HOURLY_DIR="$LOCAL_BASE_BACKUP_DIR/hourly"
DAILY_DIR="$LOCAL_BASE_BACKUP_DIR/daily"
WEEKLY_DIR="$LOCAL_BASE_BACKUP_DIR/weekly"
MONTHLY_DIR="$LOCAL_BASE_BACKUP_DIR/monthly"
YEARLY_DIR="$LOCAL_BASE_BACKUP_DIR/yearly"

# Limiti di conservazione (numero massimo di backup da mantenere per ogni livello)
MAX_HOURLY=24
MAX_DAILY=24
MAX_WEEKLY=4
MAX_MONTHLY=12
MAX_YEARLY=10

# --- Variabili di Tempo ---
NOW_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
CURRENT_HOUR=$(date +"%H")
CURRENT_DAY_OF_MONTH=$(date +"%d")
CURRENT_DAY_OF_WEEK=$(date +"%u") # 1 (Lunedì) a 7 (Domenica)
CURRENT_MONTH=$(date +"%m") # 01 (Gennaio) a 12 (Dicembre)

# --- Funzioni ---

# Funzione per loggare messaggi con timestamp
log_message() {
    local message="$1"
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $message" | tee -a "$LOG_FILE"
}

# Funzione per creare directory se non esistono
ensure_dir() {
    local dir_path="$1"
    # Controlla se la directory esiste già
    if [ ! -d "$dir_path" ]; then
        log_message "Creazione directory: $dir_path"
        mkdir -p "$dir_path"
        if [ $? -ne 0 ]; then
            log_message "ERRORE: Impossibile creare la directory $dir_path."
            exit 1 # Esce dallo script se non può creare una directory necessaria
        fi
    else
        log_message "La directory $dir_path esiste già."
    fi
}

# Funzione per la pulizia delle vecchie cartelle di backup in una directory
# Mantiene i $max_files backup più recenti ed elimina gli altri.
cleanup_backups() {
    local dir_to_clean="$1"
    local max_files_to_keep="$2"

    if [ ! -d "$dir_to_clean" ]; then
        log_message "Attenzione: La directory $dir_to_clean non esiste, impossibile eseguire la pulizia."
        return
    fi

    # Conta solo le directory che iniziano con 'backup_' per sicurezza
    local current_backup_count=$(find "$dir_to_clean" -maxdepth 1 -name 'backup_*' -type d | wc -l)

    if [ "$current_backup_count" -gt "$max_files_to_keep" ]; then
        local backups_to_delete_count=$((current_backup_count - max_files_to_keep))
        log_message "Pulizia directory $dir_to_clean: Trovati $current_backup_count backup, mantenuti $max_files_to_keep, eliminazione $backups_to_delete_count più vecchi."

        # Trova i backup più vecchi (ordinati per timestamp di modifica) e li elimina
        # find ... -type d : trova solo directory
        # -printf '%T@ %p\n' : stampa il timestamp di modifica (secondi dall'epoca) seguito dal percorso
        # sort -n : ordina numericamente per timestamp (i più vecchi prima)
        # head -n $backups_to_delete_count : prende il numero di backup da eliminare
        # cut -d' ' -f2- : estrae solo il percorso del file (tutto dopo il primo spazio)
        find "$dir_to_clean" -maxdepth 1 -name 'backup_*' -type d -printf '%T@ %p\n' | sort -n | head -n "$backups_to_delete_count" | cut -d' ' -f2- | while read -r old_backup_path; do
             if [ -d "$old_backup_path" ]; then # Verifica ulteriore prima di eliminare
                 log_message "Eliminazione vecchio backup: $old_backup_path"
                 rm -rf "$old_backup_path"
                 if [ $? -ne 0 ]; then
                     log_message "ERRORE: Impossibile eliminare $old_backup_path."
                     # Non usciamo dallo script per un errore di pulizia, ma lo logghiamo
                 fi
             fi
        done
    else
        log_message "Pulizia directory $dir_to_clean: Trovati $current_backup_count backup, nessun backup da eliminare (limite: $max_files_to_keep)."
    fi
}

# --- Logica Principale dello Script ---

log_message "--- Inizio Script Backup ---"

# 0. Espandi il percorso della chiave SSH (gestisce '~')
# Usare eval è un modo, ma $HOME è più sicuro se l'utente che esegue lo script ha $HOME impostato
if [[ "$REMOTE_SSH_KEY" == "~/"* ]]; then
    REMOTE_SSH_KEY_PATH="$HOME/${REMOTE_SSH_KEY:2}"
else
    REMOTE_SSH_KEY_PATH="$REMOTE_SSH_KEY"
fi
log_message "Percorso chiave SSH utilizzato: $REMOTE_SSH_KEY_PATH"
if [ ! -f "$REMOTE_SSH_KEY_PATH" ]; then
    log_message "ERRORE CRITICO: Chiave SSH non trovata in $REMOTE_SSH_KEY_PATH. Verifica il percorso e i permessi."
    exit 1
fi


# 1. Assicurarsi che le directory di base e di log esistano
ensure_dir "$LOCAL_BASE_BACKUP_DIR"
ensure_dir "$(dirname "$LOG_FILE")" # Crea la directory logs/ se non esiste
ensure_dir "$HOURLY_DIR"
ensure_dir "$DAILY_DIR"
ensure_dir "$WEEKLY_DIR"
ensure_dir "$MONTHLY_DIR"
ensure_dir "$YEARLY_DIR"

# 2. Eseguire il backup orario con rsync
HOURLY_BACKUP_TARGET_DIR="$HOURLY_DIR/backup_$NOW_TIMESTAMP"
log_message "Esecuzione backup orario da ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SOURCE_DIR} a $HOURLY_BACKUP_TARGET_DIR"

# Creare la directory di destinazione specifica per questo backup orario
ensure_dir "$HOURLY_BACKUP_TARGET_DIR"

# Comando rsync
# Opzioni:
# -a : modalità archivio (ricorsivo, preserva permessi, timestamp, link simbolici, ecc.)
# -v : verboso (utile per il log, ma --stats fornisce un riassunto)
# -z : comprime i dati durante il trasferimento
# -P : equivalente a --partial --progress (mostra progresso e permette di riprendere trasferimenti interrotti)
# --delete : cancella i file nella destinazione che non esistono più nella sorgente (all'interno delle directory incluse)
# --stats : fornisce statistiche dettagliate alla fine del trasferimento
# --include='...' : include specifici pattern. L'ordine è importante.
# --exclude='*' : esclude tutto il resto
# -e 'ssh ...' : specifica il comando ssh da usare, inclusa porta e chiave
rsync_command=(
    rsync -avzP --delete --stats
    --include='database/AFC.db' # Includi specificamente il file AFC.db
    --include='database/'       # Assicurati che la directory database sia creata/attraversata
    --exclude='database/*'      # Escludi tutto il resto dentro database/
    --include='uploads/***'     # Includi tutto dentro uploads/
    --exclude='*'               # Escludi tutto il resto alla radice
    -e "ssh -p $REMOTE_PORT -i $REMOTE_SSH_KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" # Aggiunto StrictHostKeyChecking per evitare problemi con host sconosciuti in cron
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SOURCE_DIR}"
    "${HOURLY_BACKUP_TARGET_DIR}/"
)

log_message "Comando rsync preparato: ${rsync_command[*]}"
log_message "Tentativo di esecuzione rsync..."

# Esegui il comando e cattura l'output e il codice di uscita
# Aggiunto '|| true' per evitare che set -e interrompa lo script qui se rsync fallisce,
# così possiamo loggare l'errore e il codice di uscita.
rsync_output=$( "${rsync_command[@]}" 2>&1 ) || true
rsync_exit_code=$?

log_message "Esecuzione Rsync completata (o fallita). Codice di uscita: $rsync_exit_code"
log_message "Output Rsync:"
# Logga ogni riga dell'output rsync
while IFS= read -r line; do log_message "  $line"; done <<< "$rsync_output"

if [ $rsync_exit_code -ne 0 ]; then
    log_message "ERRORE: Rsync fallito con codice di uscita $rsync_exit_code. Backup orario annullato."
    # Rimuovi la directory oraria potenzialmente incompleta
    rm -rf "$HOURLY_BACKUP_TARGET_DIR"
    log_message "Directory oraria incompleta $HOURLY_BACKUP_TARGET_DIR rimossa."
    log_message "--- Fine Script Backup (ERRORE Rsync) ---"
    exit 1 # Esce con errore
else
     log_message "Backup orario completato con successo in $HOURLY_BACKUP_TARGET_DIR."
fi

# 3. Logica di Rotazione dei Backup (usando Hard Links con cp -al)
# Gli hard link sono efficienti perché non duplicano i dati su disco.
# Un file viene effettivamente eliminato solo quando l'ultimo hard link che punta ad esso viene rimosso.

log_message "Controllo codice uscita rsync per procedere con la rotazione..."

if [ $rsync_exit_code -eq 0 ]; then
    log_message "Rsync completato con successo. Procedo con la logica di rotazione."
    LATEST_HOURLY_BACKUP_PATH="$HOURLY_BACKUP_TARGET_DIR" # Il backup appena creato

    # Rotazione Giornaliera (eseguita ogni giorno a mezzanotte)
    log_message "Controllo se è ora della rotazione giornaliera (Ora corrente: $CURRENT_HOUR)..."
    # Forza la rotazione giornaliera se l'ora corrente è "00"
    log_message "È mezzanotte, avvio rotazione giornaliera."
    DAILY_BACKUP_TARGET_PATH="$DAILY_DIR/$(basename "$LATEST_HOURLY_BACKUP_PATH")"
    log_message "Rotazione Giornaliera: Creazione hard link da $LATEST_HOURLY_BACKUP_PATH a $DAILY_BACKUP_TARGET_PATH"
    cp -al "$LATEST_HOURLY_BACKUP_PATH" "$DAILY_BACKUP_TARGET_PATH"
    if [ $? -ne 0 ]; then
        log_message "ERRORE: Impossibile creare hard link per il backup giornaliero."
    else
        log_message "Backup giornaliero creato con successo: $DAILY_BACKUP_TARGET_PATH"
        cleanup_backups "$DAILY_DIR" "$MAX_DAILY" # Pulisci i vecchi giornalieri *dopo* aver aggiunto il nuovo

        # Rotazione Settimanale (eseguita ogni Domenica a mezzanotte, dopo la rotazione giornaliera)
        log_message "Controllo se è ora della rotazione settimanale (Giorno settimana: $CURRENT_DAY_OF_WEEK)..."
        if [ "$CURRENT_DAY_OF_WEEK" == "7" ]; then
            log_message "È domenica, avvio rotazione settimanale."
            # L'ultimo backup giornaliero è quello appena creato ($DAILY_BACKUP_TARGET_PATH)
            WEEKLY_BACKUP_TARGET_PATH="$WEEKLY_DIR/$(basename "$DAILY_BACKUP_TARGET_PATH")"
            log_message "Rotazione Settimanale: Creazione hard link da $DAILY_BACKUP_TARGET_PATH a $WEEKLY_BACKUP_TARGET_PATH"
            cp -al "$DAILY_BACKUP_TARGET_PATH" "$WEEKLY_BACKUP_TARGET_PATH"
            if [ $? -ne 0 ]; then
                log_message "ERRORE: Impossibile creare hard link per il backup settimanale."
            else
                 log_message "Backup settimanale creato con successo: $WEEKLY_BACKUP_TARGET_PATH"
                 cleanup_backups "$WEEKLY_DIR" "$MAX_WEEKLY" # Pulisci i vecchi settimanali
            fi
        else
            log_message "Non è domenica, nessuna rotazione settimanale."
        fi

        # Rotazione Mensile (eseguita il primo giorno del mese a mezzanotte, dopo la giornaliera)
        log_message "Controllo se è ora della rotazione mensile (Giorno mese: $CURRENT_DAY_OF_MONTH)..."
        if [ "$CURRENT_DAY_OF_MONTH" == "01" ]; then
            log_message "È il primo del mese, avvio rotazione mensile."
            # Trova l'ultimo backup settimanale creato (il più recente in base al timestamp)
            LATEST_WEEKLY_BACKUP_PATH=$(find "$WEEKLY_DIR" -maxdepth 1 -name 'backup_*' -type d -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)
            if [ -n "$LATEST_WEEKLY_BACKUP_PATH" ] && [ -d "$LATEST_WEEKLY_BACKUP_PATH" ]; then
                MONTHLY_BACKUP_TARGET_PATH="$MONTHLY_DIR/$(basename "$LATEST_WEEKLY_BACKUP_PATH")"
                log_message "Rotazione Mensile: Creazione hard link da $LATEST_WEEKLY_BACKUP_PATH a $MONTHLY_BACKUP_TARGET_PATH"
                cp -al "$LATEST_WEEKLY_BACKUP_PATH" "$MONTHLY_BACKUP_TARGET_PATH"
                if [ $? -ne 0 ]; then
                    log_message "ERRORE: Impossibile creare hard link per il backup mensile."
                else
                    log_message "Backup mensile creato con successo: $MONTHLY_BACKUP_TARGET_PATH"
                    cleanup_backups "$MONTHLY_DIR" "$MAX_MONTHLY" # Pulisci i vecchi mensili
                fi
            else
                log_message "Attenzione: Nessun backup settimanale trovato in $WEEKLY_DIR per la rotazione mensile."
            fi

            # Rotazione Annuale (eseguita il primo giorno dell'anno a mezzanotte, dopo la mensile)
            # Questo significa che CURRENT_MONTH deve essere 01
            log_message "Controllo se è ora della rotazione annuale (Mese: $CURRENT_MONTH)..."
            if [ "$CURRENT_MONTH" == "01" ]; then
                log_message "È gennaio, avvio rotazione annuale."
                 # Trova l'ultimo backup mensile creato (il più recente)
                 LATEST_MONTHLY_BACKUP_PATH=$(find "$MONTHLY_DIR" -maxdepth 1 -name 'backup_*' -type d -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)
                 if [ -n "$LATEST_MONTHLY_BACKUP_PATH" ] && [ -d "$LATEST_MONTHLY_BACKUP_PATH" ]; then
                    YEARLY_BACKUP_TARGET_PATH="$YEARLY_DIR/$(basename "$LATEST_MONTHLY_BACKUP_PATH")"
                    log_message "Rotazione Annuale: Creazione hard link da $LATEST_MONTHLY_BACKUP_PATH a $YEARLY_BACKUP_TARGET_PATH"
                    cp -al "$LATEST_MONTHLY_BACKUP_PATH" "$YEARLY_BACKUP_TARGET_PATH"
                    if [ $? -ne 0 ]; then
                        log_message "ERRORE: Impossibile creare hard link per il backup annuale."
                    else
                        log_message "Backup annuale creato con successo: $YEARLY_BACKUP_TARGET_PATH"
                        cleanup_backups "$YEARLY_DIR" "$MAX_YEARLY" # Pulisci i vecchi annuali
                    fi
                 else
                    log_message "Attenzione: Nessun backup mensile trovato in $MONTHLY_DIR per la rotazione annuale."
                 fi
            else
                 log_message "Non è gennaio, nessuna rotazione annuale."
            fi # Fine rotazione annuale
        else
             log_message "Non è il primo del mese, nessuna rotazione mensile/annuale."
        fi # Fine rotazione mensile
    else
         log_message "Errore nella creazione dell'hard link giornaliero, saltate rotazioni superiori."
    fi # Fine gestione errore cp -al giornaliero
    else
        log_message "Non è mezzanotte, nessuna rotazione giornaliera/settimanale/mensile/annuale."
    fi # Fine rotazione giornaliera (e nidificate)

    # 4. Pulizia dei Backup Orari (eseguita solo se rsync ha avuto successo)
    log_message "Avvio pulizia backup orari..."
    cleanup_backups "$HOURLY_DIR" "$MAX_HOURLY"

else
    log_message "Rsync fallito (codice $rsync_exit_code). Nessuna rotazione o pulizia oraria eseguita per questo ciclo."
    # Potremmo voler rimuovere la cartella oraria vuota/incompleta qui, come faceva prima
    if [ -d "$HOURLY_BACKUP_TARGET_DIR" ]; then
        log_message "Tentativo di rimozione directory oraria potenzialmente incompleta: $HOURLY_BACKUP_TARGET_DIR"
        rm -rf "$HOURLY_BACKUP_TARGET_DIR"
        if [ $? -eq 0 ]; then
             log_message "Directory oraria rimossa con successo."
        else
             log_message "ERRORE: Impossibile rimuovere la directory oraria $HOURLY_BACKUP_TARGET_DIR."
        fi
    fi
fi # Fine blocco if rsync_exit_code -eq 0

log_message "--- Fine Script Backup ---"

exit $rsync_exit_code # Esce con il codice di rsync (0 se successo, !=0 se fallito)
