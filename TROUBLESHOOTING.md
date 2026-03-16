# AFC System - Documentazione Tecnica e Troubleshooting

**Ultima modifica:** 16 Marzo 2026
**Versione:** 1.0

---

## 📋 INDICE

1. [Informazioni Sistema](#informazioni-sistema)
2. [Configurazione Docker](#configurazione-docker)
3. [Database e Permessi](#database-e-permessi)
4. [Problemi Risolti](#problemi-risolti)
5. [Checklist Manutenzione](#checklist-manutenzione)

---

## 🖥️ INFORMAZIONI SISTEMA

### Path Produzione
- **Server path:** `/opt/afc-v3/`
- **Development path:** `/home/user/AFC/`
- **Database directory:** `/opt/afc-v3/database/`
- **URL pubblico:** `http://185.250.144.115:3000`

### Tecnologie
- **Backend:** Node.js + Express
- **Database:** SQLite3 (better-sqlite3)
- **Session store:** SQLiteStore (connect-sqlite3)
- **Container:** Docker + Docker Compose
- **OS:** Linux 6.18.5

### File Chiave
```
/opt/afc-v3/
├── server.js              # Server Express principale
├── Dockerfile             # Container backend (USER node = UID 1000)
├── docker-compose.prod.yml # Configurazione produzione
├── database/
│   ├── AFC.db            # Database principale
│   └── sessions.sqlite   # Database sessioni utente
└── public/               # Files statici
```

---

## 🐳 CONFIGURAZIONE DOCKER

### Container: afcv3-backend

**Configurazione in `docker-compose.prod.yml`:**
```yaml
services:
  backend:
    user: "1000:1000"  # ⚠️ IMPORTANTE: container gira come UID/GID 1000
    volumes:
      - /opt/afc-v3:/app
      - /opt/afc-v3/database:/app/database
    ports:
      - "3000:3000"
```

**Dockerfile:**
```dockerfile
USER node  # UID 1000, GID 1000
```

### Comandi Docker Utili

**Avviare i container:**
```bash
cd /opt/afc-v3
sudo docker compose -f docker-compose.prod.yml up -d
```

**Rebuild completo:**
```bash
sudo docker compose -f docker-compose.prod.yml up --build --force-recreate -d
```

**Verificare status:**
```bash
sudo docker ps
# Deve mostrare: afcv3-backend ... Up ... (NON "Restarting")
```

**Controllare log:**
```bash
sudo docker logs afcv3-backend --tail=50
sudo docker logs afcv3-backend -f  # Follow mode
```

**Riavviare container:**
```bash
sudo docker compose -f docker-compose.prod.yml restart
```

**Fermare tutto:**
```bash
sudo docker compose -f docker-compose.prod.yml down
```

---

## 💾 DATABASE E PERMESSI

### Struttura Database

**Database principale:** `/opt/afc-v3/database/AFC.db`
- Tabelle: users, qi, companies, sessions, ecc.
- Owned by: `1000:1000` (user del container)
- Permessi: `644` o `777`

**Database sessioni:** `/opt/afc-v3/database/sessions.sqlite`
- Creato automaticamente da SQLiteStore
- Owned by: `1000:1000`
- Permessi: `644` o `777`

### ⚠️ PERMESSI CRITICI

**REGOLA FONDAMENTALE:**
```
La directory /opt/afc-v3/database/ DEVE essere scrivibile dall'utente 1000
perché il container Docker gira come user: "1000:1000"
```

**Permessi corretti:**
```bash
# Opzione 1: Ownership esplicito (PIÙ SICURO)
sudo chown -R 1000:1000 /opt/afc-v3/database/
sudo chmod -R 755 /opt/afc-v3/database/

# Opzione 2: Permessi aperti (PIÙ SEMPLICE)
sudo chmod -R 777 /opt/afc-v3/database/
```

**Verifica permessi:**
```bash
ls -la /opt/afc-v3/database/
# Dovrebbe mostrare:
# drwxrwxrwx ... o drwxr-xr-x 1000 1000 ...
```

### Perché Servono Permessi di Scrittura

SQLite richiede write access a:
1. **File `.db`** - Per scrivere dati
2. **Directory database** - Per creare file temporanei:
   - `sessions.sqlite-wal` (Write-Ahead Log)
   - `sessions.sqlite-shm` (Shared Memory)
3. **Creazione `sessions.sqlite`** - Al primo avvio

Se mancano i permessi → **SQLITE_READONLY error** → Container crash loop

---

## 🔧 PROBLEMI RISOLTI

### Problema 1: SQLITE_READONLY Error (16 Marzo 2026)

**Sintomi:**
- Sito non raggiungibile: `ERR_CONNECTION_REFUSED`
- Container in loop di restart
- Log: `Error: SQLITE_READONLY: attempt to write a readonly database`

**Causa:**
- Rebuild Docker con `--force-recreate` ha applicato configurazione `user: "1000:1000"`
- File database erano owned by `root:root`
- User 1000 non poteva scrivere → Errore

**Perché Prima Funzionava:**
- Prima del rebuild: container probabilmente girava come `root`
- Root può scrivere qualsiasi file (anche se owned by root)
- Dopo rebuild: configurazione corretta applicata → permessi insufficienti

**Soluzione Applicata:**
```bash
sudo chmod -R 777 /opt/afc-v3/database/
sudo docker compose -f docker-compose.prod.yml restart
```

**Risultato:**
✅ Container ripartito correttamente
✅ Sito accessibile su http://185.250.144.115:3000
✅ Login funzionante
✅ Sessioni salvate correttamente

**Lezione Appresa:**
⚠️ Quando si usa `--force-recreate`, verificare sempre i permessi dei file montati come volumi!

---

### Problema 2: Warning rclone e crontab

**Sintomi nei log:**
```
Error: Command failed: rclone listremotes
/bin/sh: rclone: not found
Error: Command failed: crontab -l
```

**Spiegazione:**
- Errori NON bloccanti
- Riguardano funzionalità opzionali (backup OneDrive)
- Il server funziona normalmente anche senza rclone/crontab

**Soluzione:**
- Ignorare gli errori se backup OneDrive non necessario
- Oppure installare rclone: `apt-get install rclone`

---

## ✅ CHECKLIST MANUTENZIONE

### Prima di un Rebuild Docker

- [ ] Verificare permessi directory database
- [ ] Backup del database: `cp /opt/afc-v3/database/AFC.db ~/backup/`
- [ ] Annotare configurazione attuale: `docker ps -a`

### Dopo un Rebuild Docker

- [ ] Verificare container status: `docker ps`
- [ ] Controllare log per errori: `docker logs afcv3-backend --tail=50`
- [ ] Testare sito: aprire `http://185.250.144.115:3000`
- [ ] Verificare login funzionante
- [ ] Controllare permessi database: `ls -la /opt/afc-v3/database/`

### Troubleshooting Container che non Parte

1. **Controllare log:**
   ```bash
   sudo docker logs afcv3-backend --tail=100
   ```

2. **Verificare permessi database:**
   ```bash
   ls -la /opt/afc-v3/database/
   # Se owned by root → Fix con chmod 777 o chown 1000:1000
   ```

3. **Verificare configurazione Docker:**
   ```bash
   sudo docker compose -f docker-compose.prod.yml config
   ```

4. **Rebuild completo se necessario:**
   ```bash
   sudo docker compose -f docker-compose.prod.yml down
   sudo docker compose -f docker-compose.prod.yml up --build --force-recreate -d
   ```

### Comandi Diagnostici Rapidi

**Verifica rapida sistema:**
```bash
# Container attivi?
sudo docker ps | grep afcv3

# Database accessibile?
sqlite3 /opt/afc-v3/database/AFC.db "SELECT COUNT(*) FROM users;"

# Permessi corretti?
ls -la /opt/afc-v3/database/ | grep -E "(AFC.db|sessions.sqlite)"

# Log ultimi errori?
sudo docker logs afcv3-backend --tail=20 2>&1 | grep -i error
```

---

## 📞 CONTATTI E RISORSE

### Repository
- **Path locale:** `/home/user/AFC/` (development)
- **Path produzione:** `/opt/afc-v3/` (Docker volume)

### Branch Git Attuale
- **Branch:** `claude/explain-qi-functionality-011CV5JkBzAch9U2EJ6ZHUQ3`
- **Session ID:** `011CV5JkBzAch9U2EJ6ZHUQ3`

### File Utili
- Questo documento: `/opt/afc-v3/TROUBLESHOOTING.md`
- Piano dettagliato: `/root/.claude/plans/staged-forging-peacock.md`
- Database script: `/opt/afc-v3/database/*.js`

---

## 🔐 NOTE SICUREZZA

### Password Database
⚠️ Il sistema attualmente **NON usa bcrypt** - le password sono in chiaro nel database!

**TODO Futuro:** Migrare a password hashate con bcrypt per maggiore sicurezza.

### Permessi 777
⚠️ I permessi `777` funzionano ma sono meno sicuri.

**Alternativa più sicura:**
```bash
sudo chown -R 1000:1000 /opt/afc-v3/database/
sudo chmod -R 755 /opt/afc-v3/database/
```

Questo permette scrittura solo a user 1000 (container) invece che a tutti.

---

## 📝 CHANGELOG

### 2026-03-16
- ✅ Risolto problema SQLITE_READONLY con fix permessi
- ✅ Documentato comportamento rebuild Docker
- ✅ Creato questo documento di troubleshooting

---

**Fine documento** - Aggiornare questa documentazione quando si risolvono nuovi problemi o si fanno modifiche importanti al sistema.
