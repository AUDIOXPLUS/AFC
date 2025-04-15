# Sistema di Backup Automatico

## Panoramica
Questo sistema è configurato per sincronizzare automaticamente le cartelle `database` e `uploads` dal server primario (185.250.144.219) a questo server di backup due volte al giorno.

## Componenti

### 1. Script di sincronizzazione (`sync_remote_server.sh`)
Questo script esegue il comando rsync per sincronizzare i dati. Include:
- Controllo di sicurezza per assicurarsi che non venga eseguito sul server primario
- Sincronizzazione selettiva delle sole cartelle database e uploads
- Logging dettagliato con timestamp e risultati

### 2. Configurazione Cron (`sync_cron_job`)
Pianifica l'esecuzione dello script:
- Ogni giorno a mezzanotte (00:00) e mezzogiorno (12:00)
- Viene eseguito come utente root per garantire i permessi necessari

## Installazione
Lo script è stato aggiunto al file `.gitignore` per garantire che non venga replicato sul server primario tramite git.

Per installare manualmente il cron job sul server di backup:
```bash
sudo cp sync_cron_job /etc/cron.d/sync_remote_server
sudo chmod 644 /etc/cron.d/sync_remote_server
```

## File di Log
I log di sincronizzazione vengono salvati in:
- `/opt/afc-v3/logs/backup_sync_AAAAMMGG.log` (per le operazioni regolari)
- `/opt/afc-v3/logs/sync_error.log` (per errori critici di configurazione)

## Requisiti
- Connessione SSH tra i server
- Chiave SSH configurata correttamente in `~/.ssh/id_rsa_server_remoto`
- Porta SSH 22222 aperta sul server primario

## IMPORTANTE
**QUESTO SISTEMA DEVE ESSERE INSTALLATO SOLO SUL SERVER DI BACKUP**

L'installazione su entrambi i server potrebbe causare comportamenti indesiderati come loop di sincronizzazione e potenziale perdita di dati.
