# AFC-V3 - Istruzioni di Deployment

## Prerequisiti

1. Ubuntu Server (20.04 LTS o superiore)
2. Docker Engine
3. Docker Compose
4. Git

## Installazione Prerequisiti

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Installa Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Aggiungi l'utente corrente al gruppo docker
sudo usermod -aG docker $USER
```

## Preparazione del Server

1. Crea la directory per l'applicazione:
```bash
mkdir -p /opt/afc-v3
cd /opt/afc-v3
```

2. Clona il repository:
```bash
git clone <repository-url> .
```

3. Crea le directory necessarie:
```bash
mkdir -p uploads logs/onlyoffice database
```

4. Imposta i permessi:
```bash
sudo chown -R 1001:1001 uploads
sudo chown -R 1001:1001 database
sudo chown -R 1001:1001 logs
```

## Configurazione

1. Modifica il file `docker-compose.prod.yml`:
   - Sostituisci `DOMAIN_OR_IP` con il dominio o l'IP del tuo server
   - Modifica il `JWT_SECRET` se necessario

2. Se necessario, configura un reverse proxy (nginx) per gestire SSL/TLS

## Deployment

1. Avvia i container in modalità produzione:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

2. Verifica che i container siano in esecuzione:
```bash
docker-compose -f docker-compose.prod.yml ps
```

3. Controlla i log per eventuali errori:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## Verifica dell'Installazione

1. L'applicazione sarà disponibile su:
   - Frontend: http://DOMAIN_OR_IP:3000
   - OnlyOffice: http://DOMAIN_OR_IP:8081

2. Verifica che:
   - La pagina di login sia accessibile
   - L'editor OnlyOffice si apra correttamente
   - Il caricamento e il salvataggio dei file funzioni

## Backup

1. Per il backup del database:
```bash
cp /opt/afc-v3/database/AFC.db /backup/AFC.db-$(date +%Y%m%d)
```

2. Per il backup dei file caricati:
```bash
tar -czf /backup/uploads-$(date +%Y%m%d).tar.gz /opt/afc-v3/uploads
```

## Note di Sicurezza

1. Assicurati che il firewall sia configurato correttamente:
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8081/tcp
```

2. Considera l'utilizzo di un reverse proxy (nginx) con SSL/TLS per la produzione

3. Modifica regolarmente il JWT_SECRET

## Troubleshooting

1. Se i container non si avviano:
```bash
docker-compose -f docker-compose.prod.yml logs
```

2. Se OnlyOffice non salva i file:
- Verifica i permessi della directory uploads
- Controlla i log di OnlyOffice
- Verifica la connettività tra i container

3. Per problemi di permessi:
```bash
sudo chown -R 1001:1001 uploads database logs
