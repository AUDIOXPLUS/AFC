#!/bin/bash

# === CONFIG ===
REMOTE_USER="francesco"
REMOTE_HOST="185.250.144.115"
REMOTE_PATH="/opt/afc-v3"
LOCAL_PATH="/opt/afc-v3"
CONTAINER_NAME="afcv3-backend"

# === SICUREZZA ===
# IMPORTANTE: Prima di usare questo script, configurare sul server remoto:
# 1. Chiavi SSH: ssh-copy-id francesco@185.250.144.115
# 2. Sudo senza password: sudo visudo e aggiungere:
#    francesco ALL=(ALL) NOPASSWD: /bin/chown, /bin/chmod, /usr/bin/docker

echo "🔐 Test connessione SSH senza password..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 ${REMOTE_USER}@${REMOTE_HOST} 'echo "✅ SSH OK"' 2>/dev/null; then
  echo "❌ ERRORE: SSH richiede password o chiavi non configurate"
  echo "📖 Configura prima le chiavi SSH: ssh-copy-id ${REMOTE_USER}@${REMOTE_HOST}"
  exit 1
fi

echo "🔧 Test sudo senza password..."
if ! ssh ${REMOTE_USER}@${REMOTE_HOST} 'sudo -n chown --help' >/dev/null 2>&1; then
  echo "❌ ERRORE: sudo richiede password"
  echo "📖 Configura sudo senza password sul server remoto:"
  echo "   sudo visudo"
  echo "   Aggiungi: ${REMOTE_USER} ALL=(ALL) NOPASSWD: /bin/chown, /bin/chmod, /usr/bin/docker"
  exit 1
fi

echo "✅ Configurazione sicurezza OK!"

# 0. Ferma il container remoto (evita lock sul DB durante la copia)
echo "⛔ Stop container Docker remoto..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && sudo docker stop ${CONTAINER_NAME} || true"

# 1. Correggi i permessi PRIMA del deploy (nel dubbio)
echo "🔧 Correzione permessi PRIMA del deploy..."
ssh ${REMOTE_USER}@${REMOTE_HOST} << 'ENDSSH'
  sudo chown -R 1000:1000 /opt/afc-v3/database /opt/afc-v3/uploads 2>/dev/null || true
  sudo chmod -R 775 /opt/afc-v3/database /opt/afc-v3/uploads 2>/dev/null || true
ENDSSH

# 2. Rsync: copia TUTTO (DB + uploads), escludendo solo logs e node_modules
echo "📤 Sincronizzazione file via rsync (TUTTO, incluso database e uploads)..."
rsync -avz --delete \
  --exclude='logs/*' \
  --exclude='node_modules/' \
  -e ssh \
  --rsync-path="sudo rsync" \
  "${LOCAL_PATH}/" ${REMOTE_USER}@${REMOTE_HOST}:"${REMOTE_PATH}/"

# 3. Correggi i permessi DOPO il deploy 
echo "🔐 Correzione permessi DOPO il deploy..."
ssh ${REMOTE_USER}@${REMOTE_HOST} << 'ENDSSH'
  sudo chown -R 1000:1000 /opt/afc-v3/database /opt/afc-v3/uploads 2>/dev/null || true
  sudo chmod -R 775 /opt/afc-v3/database /opt/afc-v3/uploads 2>/dev/null || true
ENDSSH

# 4. Riavvia container
echo "🚀 Riavvio container Docker..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && sudo docker start ${CONTAINER_NAME}"

# 5. Healthcheck
echo "⏳ Attendere avvio (10 sec)..."
sleep 10

echo "🩺 Healthcheck applicazione..."
if ssh ${REMOTE_USER}@${REMOTE_HOST} 'curl -s http://localhost:8080 >/dev/null'; then
  echo "✅ Applicazione OK!"
else
  echo "⚠️ Healthcheck fallito - verificare manualmente"
fi

echo "✅ Deploy completato in sicurezza (cloud = copia di Belsito)!"
