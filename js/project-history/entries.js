/**
 * Modulo per la gestione delle voci della cronologia del progetto
 * Contiene funzioni per aggiungere, modificare, eliminare e visualizzare le voci
 */

// Mappa globale per memorizzare le relazioni tra entry e parent
if (!window.entryParentMap) window.entryParentMap = {};

import { handleNetworkError, handleResponse } from './utils.js';
import { updateFilesCell, fetchEntryFiles } from './files.js';

/**
 * Recupera la cronologia del progetto e la ordina per data in ordine decrescente.
 * @param {number} projectId - L'ID del progetto.
 */
export async function fetchProjectHistory(projectId) {
    console.log(`Tentativo di recupero history per il progetto ${projectId}...`);
    
    try {
        // Aggiunge un timestamp per prevenire problemi di caching
        const timestamp = new Date().getTime();
        const url = `/api/projects/${projectId}/history?includeUserName=true&_=${timestamp}`;
        
        console.log(`Effettuo richiesta a: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Errore HTTP ${response.status} durante il recupero della cronologia`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let history;
        try {
            history = await response.json();
        } catch (jsonError) {
            console.error('Errore nel parsing della risposta JSON:', jsonError);
            history = [];
        }
        
        if (!Array.isArray(history)) {
            console.warn('La risposta non è un array, utilizzo array vuoto', history);
            history = [];
        }
        
        // Ordina la cronologia per data in ordine decrescente
        // Se due entry hanno la stessa data, ordina per ID in ordine decrescente
        history.sort((a, b) => {
            try {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                
                // Verifica se le date sono valide
                if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                    return 0;
                }
                
                // Se le date sono diverse, ordina per data
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateB - dateA; // Ordine decrescente per data
                }
                
                // Se le date sono uguali, ordina per ID
                return b.id - a.id; // Ordine decrescente per ID
            } catch (sortError) {
                console.error('Errore durante l\'ordinamento:', sortError, a, b);
                return 0;
            }
        });
        
        console.log('Cronologia del Progetto (ordinata):', history);
        
        // Evidenzia l'header della colonna Date che è ordinata di default
        const table = document.getElementById('history-table');
        if (table) {
            const headers = table.getElementsByTagName('th');
            if (headers && headers.length > 0) {
                Array.from(headers).forEach(header => header.classList.remove('sorted'));
                headers[0].classList.add('sorted'); // Date è la prima colonna (index 0)
            }
            
            // Visualizza la cronologia
            displayProjectHistory(history, projectId);
        } else {
            console.error('Tabella history-table non trovata nel DOM');
        }
        
        return history;
    } catch (error) {
        console.error('Errore durante il recupero della cronologia:', error);
        
        // Gestione errore completamente interna per evitare crash
        try {
            handleNetworkError(error);
        } catch (handlerError) {
            console.error('Errore nel gestore degli errori di rete:', handlerError);
        }
        
        // Restituisci array vuoto in caso di errore
        return [];
    }
}

/**
 * Visualizza la cronologia del progetto nella tabella HTML.
 * @param {Array} history - Array di oggetti che rappresentano le voci della cronologia.
 * @param {number} projectId - L'ID del progetto.
 */
export function displayProjectHistory(history, projectId) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';

    history.forEach(async entry => {
        const row = tableBody.insertRow();
        row.setAttribute('data-entry-id', entry.id);

        // Inserisce le celle della tabella con i dati della cronologia
        const dateCell = row.insertCell(0);
        dateCell.textContent = entry.date;
        dateCell.style.position = 'relative';
        
        // Controlla se questo record è una risposta o un forward
        // Usiamo multiple condizioni per garantire il rilevamento anche in caso di anomalie
        
        // Miglioramento del rilevamento di Reply/Forward
        let isReply = false;
        let isForward = false;
        
        // Verifiche in ordine di priorità
        
        // 1. Verifica flag espliciti (massima priorità)
        // Prima verifichiamo is_forward, poi is_reply per dare priorità a forward
        if (entry.is_forward === true) {
            isForward = true;
            isReply = false; // Un record non può essere sia forward che reply
        } else if (entry.is_reply === true) {
            isReply = true;
            isForward = false;
        }
        
        // 2. Verifica parent_id (alta priorità)
        // Se ha un parent_id, è sicuramente una risposta/inoltro
        if (!isReply && !isForward && entry.parent_id) {
            // Controlliamo se è specificatamente un forward nella descrizione
            if (entry.description && entry.description.toLowerCase().includes('forward-')) {
                isForward = true;
            } else {
                isReply = true; // Default a reply se ha parent_id
            }
        }
        
        // 3. Verifica tramite il campo created_by_name (media priorità)
        if (!isReply && !isForward && entry.created_by_name) {
            if (entry.created_by_name.startsWith('REPLY:')) {
                isReply = true;
            } else if (entry.created_by_name.startsWith('FORWARD:')) {
                isForward = true;
            }
        }
        
        // 4. Verifica tramite la descrizione (bassa priorità)
        if (!isReply && !isForward && entry.description) {
            // Rimozione del controllo su reply- mentre manteniamo forward- per compatibilità
            if (entry.description.toLowerCase().includes('forward-')) {
                isForward = true;
            }
        }
        
        // 5. Verifica se il record ha nomi multipli (indica una catena)
        if (!isReply && !isForward && entry.created_by_name) {
            // Verifica sia il formato Unicode → che ASCII ->
            if (entry.created_by_name.includes('→') || entry.created_by_name.includes('->')) {
                // Se contiene una freccia è una catena di utenti
                if (entry.created_by_name.includes('FORWARD:')) {
                    isForward = true;
                } else {
                    isReply = true; // Default a reply se c'è una catena senza specificazione
                }
            }
        }
        
        // Logging dettagliato per tutte le voci
        console.log(`ENTRY ${entry.id}:`, {
            isReply: isReply,
            isForward: isForward,
            parent_id: entry.parent_id,
            created_by: entry.created_by,
            created_by_name: entry.created_by_name,
            description: entry.description
        });
        
        // Aggiungi il nome dell'utente che ha creato il record come tooltip
        // La condizione deve verificare che esista il created_by invece di created_by_name
        if (entry.created_by) {
            // Se è una risposta o un forward, mostra tutti gli utenti coinvolti
            if (isReply || isForward) {
                let prefix = '';
                let iconClass = '';
                let iconColor = '';
                
                if (isReply) {
                    prefix = 'Reply chain: ';
                    iconClass = 'fas fa-reply';
                    iconColor = '#0066cc'; // Blu per le risposte
                    let userInfo = entry.created_by_name || '';
                    
                    // Formattazione migliorata delle informazioni utente
                    if (userInfo.startsWith('REPLY:')) {
                        userInfo = userInfo.replace('REPLY:', '');
                    }
                    
                    // Se la catena utenti non è formattata correttamente, mostra solo il nome
                    if (!userInfo.includes('→')) {
                        const parentName = entry.parent_created_by_name || '';
                        const currentName = entry.created_by_name || window.currentUserName;
                        if (parentName && currentName) {
                            userInfo = `${parentName} → ${currentName}`;
                        }
                    }
                    
                    // Imposta un tooltip semplice per l'icona utente, come per i record normali
                    dateCell.title = `Created by: ${entry.creator_name || 'Unknown'}`;
                    console.log('REPLY TOOLTIP (Simplified):', dateCell.title);
                } else if (isForward) {
                    prefix = 'Forward chain: ';
                    iconClass = 'fas fa-share';
                    iconColor = '#cc6600'; // Arancione per gli inoltri
                    let userInfo = entry.created_by_name || '';
                    
                    // Formattazione migliorata delle informazioni utente
                    if (userInfo.startsWith('FORWARD:')) {
                        userInfo = userInfo.replace('FORWARD:', '');
                    }
                    
                    // Se la catena utenti non è formattata correttamente, mostra solo il nome
                    if (!userInfo.includes('→')) {
                        const parentName = entry.parent_created_by_name || '';
                        const currentName = entry.created_by_name || window.currentUserName;
                        if (parentName && currentName) {
                            userInfo = `${parentName} → ${currentName}`;
                        }
                    }
                    
                    // Imposta un tooltip semplice per l'icona utente, come per i record normali
                    dateCell.title = `Created by: ${entry.creator_name || 'Unknown'}`;
                    console.log('FORWARD TOOLTIP (Simplified):', dateCell.title);
                }
                
                // Aggiungi l'icona appropriata accanto alla data
                const actionIcon = document.createElement('i');
                actionIcon.className = iconClass;
                actionIcon.style.fontSize = '10px';
                actionIcon.style.marginLeft = '5px';
                actionIcon.style.color = iconColor;
                
                // Ottieni il parentId direttamente dal campo parent_id del database
                let parentId = entry.parent_id || null;
                
                // Debug: mostra il parentId trovato
                console.log(`DEBUG - Entry ${entry.id}: parentId = ${parentId || 'null'}, fonte: campo database parent_id`);
                
                // Aggiungi attributi per il funzionamento della navigazione tra record collegati
                actionIcon.setAttribute('data-action-type', isReply ? 'reply' : 'forward');
                actionIcon.setAttribute('data-entry-id', entry.id);
                
                // Impostiamo l'attributo data-parent-id e il tooltip
                actionIcon.setAttribute('data-parent-id', parentId || '');
                actionIcon.title = parentId 
                    ? `Highlight parent record (ID: ${parentId})` 
                    : 'Parent record ID not available';
                
                actionIcon.style.cursor = 'pointer'; // Cambia il cursore per indicare che è cliccabile
                
                // Log dettagliato per visualizzare TUTTI i record con il loro parent_id
                console.log(`ENTRY ${entry.id} (${isReply ? 'REPLY' : isForward ? 'FORWARD' : 'STANDARD'}) -> parent_id: ${parentId || 'NONE'}`);
                
                if (!parentId) {
                    console.log(`Record padre non trovato per l'entry #${entry.id}`);
                }
                
                // Evidenzia il record padre con un click diretto anziché hover
                actionIcon.title = `Highlight parent record (ID: ${parentId})`;
                actionIcon.style.cursor = 'pointer';
                
                // Utilizziamo mouseenter per evidenziare il record padre al passaggio del mouse
                actionIcon.addEventListener('mouseenter', () => {
                    if (!parentId) {
                        console.error(`EVENTO CLICK: parentId è vuoto per entry ${entry.id}`);
                        return;
                    }
                    
                    console.log(`EVENTO CLICK: Simulazione click sul pulsante di highlight per ID ${parentId}`);
                    
                    // Reset diretto dei filtri per assicurarsi che tutte le righe siano visibili
                    try {
                        // 1. Resetta i filtri di testo
                        const textFilterInputs = document.querySelectorAll('.filters input[type="text"]');
                        textFilterInputs.forEach(input => {
                            input.value = '';
                            input.classList.remove('filter-active');
                        });
                        
                        // 2. Resetta i filtri di stato
                        const statusDropdownBtn = document.getElementById('status-dropdown-btn');
                        const statusFilter = document.getElementById('status-filter');
                        if (statusFilter) {
                            const statusCheckboxes = statusFilter.querySelectorAll('input[type="checkbox"]');
                            statusCheckboxes.forEach(checkbox => {
                                checkbox.checked = false;
                            });
                            if (statusDropdownBtn) {
                                statusDropdownBtn.classList.remove('filter-active');
                                statusDropdownBtn.textContent = 'Status';
                            }
                        }
                        
                        // 3. Forza un ripristino della visualizzazione di tutte le righe
                        const allRows = document.querySelectorAll('#history-table tbody tr');
                        allRows.forEach(row => {
                            row.style.display = '';
                        });
                        
                        console.log('Reset diretto dei filtri completato');
                        
                        // 4. Se disponibile, usa anche l'API di filtraggio standard
                        if (window.filteringApi && typeof window.filteringApi.resetFilters === 'function') {
                            window.filteringApi.resetFilters();
                        }
                    } catch (error) {
                        console.error('Errore durante il reset dei filtri:', error);
                    }
                    
                    // Evidenziazione diretta del record padre senza usare elementi UI esterni
                    highlightParentRecord();
                    
                    // Funzione interna per evidenziare il record padre
                    function highlightParentRecord() {
                        
                        // Cerca la riga del record padre
                        let parentRow = document.querySelector(`tr[data-entry-id="${parentId}"]`);
                        
                        // Ricerca alternativa se la prima fallisce
                        if (!parentRow) {
                            console.log("Ricerca standard fallita, provo la ricerca manuale...");
                            const allRows = document.querySelectorAll('tr');
                            for (const row of allRows) {
                                if (row.getAttribute('data-entry-id') === parentId) {
                                    parentRow = row;
                                    break;
                                }
                            }
                        }
                        
                        if (!parentRow) {
                            console.error(`Record padre con ID ${parentId} non trovato nella tabella per entry ${entry.id}`);
                            alert(`Il record padre non è presente nella visualizzazione corrente. Prova a disattivare i filtri.`);
                            return;
                        }
                        
                        // Rimuovi eventuali evidenziazioni precedenti
                        document.querySelectorAll('.record-highlight').forEach(el => {
                            el.classList.remove('record-highlight');
                            el.style.outline = '';
                            el.style.outlineOffset = '';
                        });
                        
                        // Evidenzia la riga padre con solo il bordo rosso
                        parentRow.classList.add('record-highlight');
                        parentRow.style.outline = '3px solid red';
                        parentRow.style.outlineOffset = '-3px';
                        
                        
                        // Salva il riferimento alla riga per il ripristino
                        actionIcon._highlightData = { 
                            parentRow
                        };
                    }
                });
                
                // Rimuovi l'evidenziazione quando il mouse esce
                actionIcon.addEventListener('mouseleave', () => {
                    if (!parentId) return;
                    
                    // Rimuovi l'evidenziazione delle righe con highlight
                    const highlightedRows = document.querySelectorAll('.record-highlight');
                    highlightedRows.forEach(row => {
                        // Rimuovi la classe di evidenziazione
                        row.classList.remove('record-highlight');
                        
                        // Rimuovi SOLO il bordo rosso e mantieni gli altri stili
                        row.style.outline = '';
                        row.style.outlineOffset = '';
                        
                        // Rimuovi solo il badge dell'ID, se presente
                        const badge = row.querySelector('.record-id-badge');
                        if (badge) {
                            badge.remove();
                        }
                    });
                    
                    // Pulisci i dati salvati
                    if (actionIcon._highlightData) {
                        actionIcon._highlightData = null;
                    }
                    
                    console.log('Rimozione highlight completata');
                });
                
                dateCell.appendChild(actionIcon);
                
                // Aggiungi anche l'icona utente dopo l'icona di risposta
                const userIcon = document.createElement('i');
                userIcon.className = 'fas fa-user';
                userIcon.style.fontSize = '10px';
                userIcon.style.marginLeft = '3px';
                userIcon.style.color = '#666';
                dateCell.appendChild(userIcon);
                
                // DEBUG: Log extra per i record che contengono 'test'
                if (entry.description && entry.description.includes('test')) {
                    console.log(`Icona generata per entry #${entry.id}:`, {
                        actionIcon: actionIcon,
                        iconClass: iconClass,
                        iconColor: iconColor
                    });
                }
            } else {
                // Se non è una risposta, mostra solo l'utente creatore
                // Utilizziamo creator_name ricavato dal backend tramite join con la tabella users
                dateCell.title = `Created by: ${entry.creator_name || 'Unknown'}`;
                
                // Aggiungi un'icona utente accanto alla data
                const userIcon = document.createElement('i');
                userIcon.className = 'fas fa-user';
                userIcon.style.fontSize = '10px';
                userIcon.style.marginLeft = '5px';
                userIcon.style.color = '#666';
                dateCell.appendChild(userIcon);
            }
        }
        
        // Trova il nome della fase corrispondente
        const phaseCell = row.insertCell(1);
        if (window.projectPhases) {
            const phase = window.projectPhases.find(p => String(p.id) === String(entry.phase));
            phaseCell.textContent = phase ? phase.name : entry.phase;
        } else {
            // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
            phaseCell.textContent = entry.phase;
            window.addEventListener('phasesLoaded', (event) => {
                const phases = event.detail;
                const phase = phases.find(p => String(p.id) === String(entry.phase));
                if (phase) {
                    phaseCell.textContent = phase.name;
                }
            });
        }
        
        // Crea una cella per la descrizione
        const descCell = row.insertCell(2);
        
        // Imposta l'attributo title con la descrizione completa per il tooltip
        descCell.setAttribute('title', entry.description);
        
        // Pulisci le descrizioni rimuovendo i prefissi e i tag [Parent: ID]
        let cleanDescription = entry.description;
        
        // Rimuovi i prefissi "forward-" e "reply-" ovunque si trovino nella stringa
        cleanDescription = cleanDescription.replace(/(forward-|reply-)/gi, '');
        
        // Rimuovi gli identificatori [Parent: xxxx]
        cleanDescription = cleanDescription.replace(/\s*\[Parent:\s*\d+\]/g, '');
        
        // Funzione per convertire URL in link cliccabili
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        if (urlRegex.test(cleanDescription)) {
            // Se ci sono URL nel testo, li convertiamo in link
            const parts = cleanDescription.split(urlRegex);
            parts.forEach((part, index) => {
                if (urlRegex.test(part)) {
                    // Se è un URL, crea un link
                    const link = document.createElement('a');
                    link.href = part;
                    link.textContent = part;
                    link.target = '_blank'; // Apre in una nuova tab
                    descCell.appendChild(link);
                } else {
                    // Se è testo normale, aggiungilo come nodo di testo
                    descCell.appendChild(document.createTextNode(part));
                }
            });
        } else {
            // Se non ci sono URL, mostra il testo normalmente
            descCell.textContent = cleanDescription;
        }
        // Converti l'ID in nome utente se necessario
        const assignedMember = window.teamMembers.find(member => String(member.id) === String(entry.assigned_to));
        row.insertCell(3).textContent = assignedMember ? assignedMember.name : (entry.assigned_to || '-');
        row.insertCell(4).textContent = entry.status || '-';

        // Gestisce la cella dei file associati alla voce della cronologia
        const filesCell = row.insertCell(5);
        
        // Recupera e visualizza i file associati alla voce della cronologia
        const files = await fetchEntryFiles(entry.id, projectId);
        updateFilesCell(entry.id, projectId);

        // Gestisce le azioni della riga della cronologia
        const actionsCell = row.insertCell(6);

        // Aggiunge il lucchetto per la privacy
        const privacyBtn = document.createElement('button');
        privacyBtn.className = entry.private_by !== null ? 'privacy-btn text-danger' : 'privacy-btn text-dark';
        privacyBtn.setAttribute('data-entry-id', entry.id);
        const privacyIcon = document.createElement('i');
        // Mostra il lucchetto chiuso rosso se il record è privato, altrimenti lucchetto aperto nero
        privacyIcon.className = entry.private_by !== null ? 'fas fa-lock' : 'fas fa-unlock';
        privacyBtn.appendChild(privacyIcon);
        privacyBtn.addEventListener('click', async function() {
            // Se il record è privato
            if (entry.private_by !== null) {
                let isOwner = false;
                let isInList = false;
                
                // Verifica se l'utente corrente è il proprietario o è nella lista
                if (typeof entry.private_by === 'string' && entry.private_by.includes(',')) {
                    // Se contiene virgole, è una lista di ID
                    const userIds = entry.private_by.split(',');
                    isOwner = userIds[0] == window.currentUserId; // Il primo ID è il proprietario
                    isInList = userIds.includes(String(window.currentUserId));
                } else {
                    // Se non contiene virgole, è un singolo ID
                    isOwner = entry.private_by == window.currentUserId;
                    isInList = isOwner; // Se è un singolo ID, l'utente è nella lista solo se è il proprietario
                }
                
                // Se l'utente è il proprietario, mostra il modale di condivisione
                if (isOwner) {
                    await window.showSharingModal(entry.id);
                    return;
                }
                
                // Se l'utente è nella lista ma non è il proprietario, mostra un messaggio
                if (isInList && !isOwner) {
                    alert("This record is private. Please contact the owner to modify privacy settings.");
                    return;
                }
                
                // Se l'utente non è nella lista, non dovrebbe vedere il record
                return;
            }
            
            // Se il record è pubblico, mostra il modale di condivisione
            await window.showSharingModal(entry.id);
        });
        actionsCell.appendChild(privacyBtn);

        // Crea i pulsanti Edit e Delete
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editHistoryEntry(entry.id, projectId));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => confirmDelete(entry.id, projectId));
        
        // Controlla se mostrare i pulsanti Edit e Delete
        // Sono visibili solo al proprietario del record, all'utente GOD, o a tutti se il record non ha un proprietario
        const isGodUser = window.currentUserName === 'GOD'; // Verifica se l'utente corrente è GOD
        const isOwner = entry.created_by && String(entry.created_by) === String(window.currentUserId); // Verifica se l'utente corrente è il proprietario
        const hasNoOwner = !entry.created_by; // Verifica se il record non ha un proprietario
        
        if (isGodUser || isOwner || hasNoOwner) {
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
        }

        // Pulsante Reply
        const replyBtn = document.createElement('button');
        replyBtn.className = 'set-completed-btn';
        replyBtn.textContent = 'Reply';
        replyBtn.addEventListener('click', async () => {
            // Resetta tutti i filtri prima di procedere
            if (window.filteringApi && typeof window.filteringApi.resetFilters === 'function') {
                window.filteringApi.resetFilters();
            }
            
            // Ottieni il proprietario del record padre e il suo nome
            const parentOwner = entry.created_by || window.currentUserId;
            const parentOwnerName = entry.created_by_name || window.currentUserName;
            const parentId = entry.id; // Salva l'ID del record padre
            
            // Crea un nuovo record nella cronologia
            const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
            const newRow = tableBody.insertRow(0);
            
            // Imposta attributi di risposta nel dataset della riga
            newRow.setAttribute('data-reply-to', parentId);
            newRow.setAttribute('data-parent-created-by', parentOwner);
            newRow.setAttribute('data-parent-created-by-name', parentOwnerName);
            // Questa è una Reply, non aggiungiamo l'attributo data-forward

            const fields = ['date', 'phase', 'description', 'assigned_to', 'status'];
            fields.forEach((field, index) => {
                const cell = newRow.insertCell(index);
                if (field === 'assigned_to') {
                    const select = document.createElement('select');
                    window.teamMembers.forEach(member => {
                        const option = document.createElement('option');
                        option.value = member.name;
                        option.textContent = member.name;
                        // Seleziona l'utente proprietario del record padre
                        if (String(member.id) === String(parentOwner)) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                    cell.appendChild(select);
                } else if (field === 'date') {
                    const input = document.createElement('input');
                    input.type = 'date';
                    input.name = field;
                    input.style.backgroundColor = '#ffff99';
                    // Imposta automaticamente la data odierna
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    input.value = `${year}-${month}-${day}`;
                    cell.appendChild(input);
                } else if (field === 'description') {
                    const textarea = document.createElement('textarea');
                    textarea.name = field;
                    textarea.style.backgroundColor = '#ffff99';
                    textarea.style.width = '100%';
                    textarea.style.minHeight = '100px';
                    textarea.style.resize = 'vertical';
                    
                    // Gestione del drag and drop dei file
                    textarea.addEventListener('dragover', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.style.backgroundColor = '#e6ffe6'; // Feedback visivo
                    });
                    
                    textarea.addEventListener('dragleave', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                    });
                    
                    textarea.addEventListener('drop', async function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                        
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                            const fileInput = newRow.cells[5].querySelector('input[type="file"]');
                            if (fileInput && !fileInput.disabled) {
                                // Crea un nuovo FileList con i file trascinati
                                const dataTransfer = new DataTransfer();
                                for (let i = 0; i < files.length; i++) {
                                    dataTransfer.items.add(files[i]);
                                }
                                fileInput.files = dataTransfer.files;
                                
                                // Simula l'evento change per attivare l'upload
                                const event = new Event('change', { bubbles: true });
                                fileInput.dispatchEvent(event);
                            }
                        }
                    });
                    
                    // Attiva il campo description per l'input utente
                    setTimeout(() => {
                        textarea.focus();
                    }, 100);
                    
                    cell.appendChild(textarea);
                } else if (field === 'phase') {
                    const select = document.createElement('select');
                    select.style.backgroundColor = '#ffff99';
                    // Usa la stessa fase del record padre
                    if (window.projectPhases) {
                        window.projectPhases.forEach(phase => {
                            const option = document.createElement('option');
                            option.value = phase.id;
                            option.textContent = phase.name;
                            if (String(phase.id) === String(entry.phase)) {
                                option.selected = true;
                            }
                            select.appendChild(option);
                        });
                    } else {
                        // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
                        window.addEventListener('phasesLoaded', (event) => {
                            const phases = event.detail;
                            phases.forEach(phase => {
                                const option = document.createElement('option');
                                option.value = phase.id;
                                option.textContent = phase.name;
                                if (String(phase.id) === String(entry.phase)) {
                                    option.selected = true;
                                }
                                select.appendChild(option);
                            });
                        });
                    }
                    cell.appendChild(select);
                } else if (field === 'status') {
                    const select = document.createElement('select');
                    select.style.backgroundColor = '#ffff99';
                    ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                        const option = document.createElement('option');
                        option.value = status;
                        option.textContent = status;
                        // Imposta lo stato predefinito a "In Progress"
                        if (status === 'In Progress') {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                    cell.appendChild(select);
                } else {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.name = field;
                    input.style.backgroundColor = '#ffff99';
                    cell.appendChild(input);
                }
            });

            // Cella per i file
            const filesCell = newRow.insertCell(5);
            const uploadContainer = document.createElement('div');
            uploadContainer.className = 'file-upload-container';
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.name = 'files';
            fileInput.multiple = true;
            fileInput.disabled = true;
            
            const uploadNote = document.createElement('span');
            uploadNote.className = 'upload-note';
            uploadNote.textContent = 'Save entry first to upload files';
            
            uploadContainer.appendChild(fileInput);
            uploadContainer.appendChild(uploadNote);
            filesCell.appendChild(uploadContainer);

            const actionsCell = newRow.insertCell(6);
            const privacyBtn = document.createElement('button');
            privacyBtn.className = 'privacy-btn text-dark';
            const privacyIcon = document.createElement('i');
            privacyIcon.className = 'fas fa-unlock';
            privacyBtn.appendChild(privacyIcon);
            privacyBtn.disabled = true; // Disabilitato finché non viene salvata la voce
            actionsCell.appendChild(privacyBtn);

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', async () => {
                // Prima salva il nuovo record
                await saveNewHistoryEntry(projectId, newRow);
                
                // Poi imposta il record padre come completato
                const updatedEntry = {
                    date: entry.date,
                    phase: entry.phase, // Mantiene l'ID della fase originale
                    description: entry.description,
                    assignedTo: entry.assigned_to,
                    status: 'Completed'
                };
                
                try {
                    const response = await fetch(`/api/projects/${projectId}/history/${parentId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(updatedEntry),
                    });
                    
                    if (response.ok) {
                        // Aggiorna la cronologia
                        await fetchProjectHistory(projectId);
                        if (typeof window.updatePhaseSummary === 'function') {
                            window.updatePhaseSummary();
                        }
                    } else {
                        console.error('Errore nell\'aggiornare il record padre');
                    }
                } catch (error) {
                    console.error('Errore durante l\'aggiornamento del record padre:', error);
                }
            });
            actionsCell.appendChild(saveBtn);
            
            // Aggiungi il pulsante Cancel
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => {
                // Rimuovi la riga dalla tabella
                newRow.remove();
            });
            actionsCell.appendChild(cancelBtn);
        });
        actionsCell.appendChild(replyBtn);
        
        // Pulsante Forward
        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'set-completed-btn';
        forwardBtn.textContent = 'Forward';
        forwardBtn.addEventListener('click', async () => {
            // Resetta tutti i filtri prima di procedere
            if (window.filteringApi && typeof window.filteringApi.resetFilters === 'function') {
                window.filteringApi.resetFilters();
            }
            
            // Ottieni il proprietario del record padre e il suo nome
            const parentOwner = entry.created_by || window.currentUserId;
            const parentOwnerName = entry.created_by_name || window.currentUserName;
            const parentId = entry.id; // Salva l'ID del record padre
            
            // Crea un nuovo record nella cronologia
            const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
            const newRow = tableBody.insertRow(0);
            
            // Imposta attributi di risposta nel dataset della riga
            newRow.setAttribute('data-reply-to', parentId);
            newRow.setAttribute('data-parent-created-by', parentOwner);
            newRow.setAttribute('data-parent-created-by-name', parentOwnerName);
            // Contrassegna questo record come un Forward
            newRow.setAttribute('data-forward', 'true');

            const fields = ['date', 'phase', 'description', 'assigned_to', 'status'];
            fields.forEach((field, index) => {
                const cell = newRow.insertCell(index);
                if (field === 'assigned_to') {
                    const select = document.createElement('select');
                    // Lascia il campo vuoto per permettere all'utente di selezionare a chi fare il forward
                    select.style.backgroundColor = '#ffff99';
                    select.style.border = '2px solid #ff9900'; // Evidenzia il campo per attirare l'attenzione
                    
                    // Aggiungi un'opzione vuota all'inizio
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = '-- Select User --';
                    emptyOption.selected = true;
                    select.appendChild(emptyOption);
                    
                    window.teamMembers.forEach(member => {
                        const option = document.createElement('option');
                        option.value = member.name;
                        option.textContent = member.name;
                        select.appendChild(option);
                    });
                    
                    // Aggiungi un messaggio di aiuto
                    const helpText = document.createElement('div');
                    helpText.textContent = 'Please select a user';
                    helpText.style.fontSize = '12px';
                    helpText.style.color = '#ff9900';
                    
                    const container = document.createElement('div');
                    container.appendChild(select);
                    container.appendChild(helpText);
                    cell.appendChild(container);
                    
                    // Focus sul campo dopo un breve ritardo
                    setTimeout(() => {
                        select.focus();
                    }, 200);
                } else if (field === 'date') {
                    const input = document.createElement('input');
                    input.type = 'date';
                    input.name = field;
                    input.style.backgroundColor = '#ffff99';
                    // Imposta automaticamente la data odierna
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    input.value = `${year}-${month}-${day}`;
                    cell.appendChild(input);
                } else if (field === 'description') {
                    const textarea = document.createElement('textarea');
                    textarea.name = field;
                    textarea.style.backgroundColor = '#ffff99';
                    textarea.style.width = '100%';
                    textarea.style.minHeight = '100px';
                    textarea.style.resize = 'vertical';
                    
                    // Copia la descrizione dall'entry originale, ma aggiunge un prefisso per i forward
                    textarea.value = `forward-${entry.description}`;
                    
                    // Gestione del drag and drop dei file
                    textarea.addEventListener('dragover', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.style.backgroundColor = '#e6ffe6'; // Feedback visivo
                    });
                    
                    textarea.addEventListener('dragleave', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                    });
                    
                    textarea.addEventListener('drop', async function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                        
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                            const fileInput = newRow.cells[5].querySelector('input[type="file"]');
                            if (fileInput && !fileInput.disabled) {
                                // Crea un nuovo FileList con i file trascinati
                                const dataTransfer = new DataTransfer();
                                for (let i = 0; i < files.length; i++) {
                                    dataTransfer.items.add(files[i]);
                                }
                                fileInput.files = dataTransfer.files;
                                
                                // Simula l'evento change per attivare l'upload
                                const event = new Event('change', { bubbles: true });
                                fileInput.dispatchEvent(event);
                            }
                        }
                    });
                    
                    cell.appendChild(textarea);
                } else if (field === 'phase') {
                    const select = document.createElement('select');
                    select.style.backgroundColor = '#ffff99';
                    // Usa la stessa fase del record padre
                    if (window.projectPhases) {
                        window.projectPhases.forEach(phase => {
                            const option = document.createElement('option');
                            option.value = phase.id;
                            option.textContent = phase.name;
                            if (String(phase.id) === String(entry.phase)) {
                                option.selected = true;
                            }
                            select.appendChild(option);
                        });
                    } else {
                        // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
                        window.addEventListener('phasesLoaded', (event) => {
                            const phases = event.detail;
                            phases.forEach(phase => {
                                const option = document.createElement('option');
                                option.value = phase.id;
                                option.textContent = phase.name;
                                if (String(phase.id) === String(entry.phase)) {
                                    option.selected = true;
                                }
                                select.appendChild(option);
                            });
                        });
                    }
                    cell.appendChild(select);
                } else if (field === 'status') {
                    const select = document.createElement('select');
                    select.style.backgroundColor = '#ffff99';
                    ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                        const option = document.createElement('option');
                        option.value = status;
                        option.textContent = status;
                        // Imposta lo stato predefinito a "In Progress"
                        if (status === 'In Progress') {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                    cell.appendChild(select);
                } else {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.name = field;
                    input.style.backgroundColor = '#ffff99';
                    cell.appendChild(input);
                }
            });

            // Cella per i file
            const filesCell = newRow.insertCell(5);
            const uploadContainer = document.createElement('div');
            uploadContainer.className = 'file-upload-container';
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.name = 'files';
            fileInput.multiple = true;
            fileInput.disabled = true;
            
            const uploadNote = document.createElement('span');
            uploadNote.className = 'upload-note';
            uploadNote.textContent = 'Save entry first to upload files';
            
            uploadContainer.appendChild(fileInput);
            uploadContainer.appendChild(uploadNote);
            filesCell.appendChild(uploadContainer);

            const actionsCell = newRow.insertCell(6);
            const privacyBtn = document.createElement('button');
            privacyBtn.className = 'privacy-btn text-dark';
            const privacyIcon = document.createElement('i');
            privacyIcon.className = 'fas fa-unlock';
            privacyBtn.appendChild(privacyIcon);
            privacyBtn.disabled = true; // Disabilitato finché non viene salvata la voce
            actionsCell.appendChild(privacyBtn);

            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', async () => {
                // Verifica che sia stato selezionato un utente
                const assignedToSelect = newRow.cells[3].querySelector('select');
                if (assignedToSelect && assignedToSelect.value === '') {
                    alert('Please select a user to forward to');
                    assignedToSelect.focus();
                    return;
                }
                
                // Prima salva il nuovo record
                await saveNewHistoryEntry(projectId, newRow);
                
                // Poi imposta il record padre come completato
                const updatedEntry = {
                    date: entry.date,
                    phase: entry.phase, // Mantiene l'ID della fase originale
                    description: entry.description,
                    assignedTo: entry.assigned_to,
                    status: 'Completed'
                };
                
                try {
                    const response = await fetch(`/api/projects/${projectId}/history/${parentId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(updatedEntry),
                    });
                    
                    if (response.ok) {
                        // Aggiorna la cronologia
                        await fetchProjectHistory(projectId);
                        if (typeof window.updatePhaseSummary === 'function') {
                            window.updatePhaseSummary();
                        }
                    } else {
                        console.error('Errore nell\'aggiornare il record padre');
                    }
                } catch (error) {
                    console.error('Errore durante l\'aggiornamento del record padre:', error);
                }
            });
            actionsCell.appendChild(saveBtn);
            
            // Aggiungi il pulsante Cancel
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => {
                // Rimuovi la riga dalla tabella
                newRow.remove();
            });
            actionsCell.appendChild(cancelBtn);
        });
        actionsCell.appendChild(forwardBtn);

        // Imposta il colore di sfondo e la classe per i task completati
        if (entry.status === 'Completed') {
            row.classList.add('completed');
        } else {
            const assignedMember = window.teamMembers.find(member => member.name === entry.assigned_to);
            if (assignedMember) {
                row.style.backgroundColor = assignedMember.color;
                row.style.color = assignedMember.fontColor || '#000000';
            }
        }

        // Riapplica i filtri dopo aver aggiunto la riga
        if (window.filteringApi && typeof window.filteringApi.applyFilters === 'function') {
            window.filteringApi.applyFilters();
        }
    });
}

/**
 * Apre il modulo per aggiungere una nuova voce alla cronologia del progetto.
 * @param {number} projectId - L'ID del progetto.
 */
export function addHistoryEntry(projectId) {
    const tableBody = document.getElementById('history-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['date', 'phase', 'description', 'assigned_to', 'status'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        if (field === 'assigned_to') {
            const select = document.createElement('select');
            window.teamMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.name;
                option.textContent = member.name;
                // Seleziona l'utente corrente di default
                if (String(member.id) === window.currentUserId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            cell.appendChild(select);
        } else if (field === 'date') {
            const input = document.createElement('input');
            input.type = 'date';
            input.name = field;
            input.style.backgroundColor = '#ffff99';
            // Imposta automaticamente la data odierna
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            input.value = `${year}-${month}-${day}`;
            cell.appendChild(input);
        } else if (field === 'description') {
            const textarea = document.createElement('textarea');
            textarea.name = field;
            textarea.style.backgroundColor = '#ffff99';
            textarea.style.width = '100%';
            textarea.style.minHeight = '100px';
            textarea.style.resize = 'vertical';
            
            // Gestione del drag and drop dei file
            textarea.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.backgroundColor = '#e6ffe6'; // Feedback visivo
            });
            
            textarea.addEventListener('dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
            });
            
            textarea.addEventListener('drop', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const fileInput = newRow.cells[5].querySelector('input[type="file"]');
                    if (fileInput && !fileInput.disabled) {
                        // Crea un nuovo FileList con i file trascinati
                        const dataTransfer = new DataTransfer();
                        for (let i = 0; i < files.length; i++) {
                            dataTransfer.items.add(files[i]);
                        }
                        fileInput.files = dataTransfer.files;
                        
                        // Simula l'evento change per attivare l'upload
                        const event = new Event('change', { bubbles: true });
                        fileInput.dispatchEvent(event);
                    }
                }
            });
            
            cell.appendChild(textarea);
        } else if (field === 'phase') {
            const select = document.createElement('select');
            select.style.backgroundColor = '#ffff99';
            // Verifica se le fasi sono già state caricate
            if (window.projectPhases) {
                window.projectPhases.forEach(phase => {
                    const option = document.createElement('option');
                    option.value = phase.id;
                    option.textContent = phase.name;
                    select.appendChild(option);
                });
            } else {
                // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
                window.addEventListener('phasesLoaded', (event) => {
                    const phases = event.detail;
                    phases.forEach(phase => {
                        const option = document.createElement('option');
                        option.value = phase.id;
                        option.textContent = phase.name;
                        select.appendChild(option);
                    });
                });
            }
            cell.appendChild(select);
        } else if (field === 'status') {
            const select = document.createElement('select');
            select.style.backgroundColor = '#ffff99';
            ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                select.appendChild(option);
            });
            cell.appendChild(select);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            input.style.backgroundColor = '#ffff99';
            cell.appendChild(input);
        }
    });

    // Cella per i file
    const filesCell = newRow.insertCell(5);
    const uploadContainer = document.createElement('div');
    uploadContainer.className = 'file-upload-container';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.name = 'files';
    fileInput.multiple = true;
    fileInput.disabled = true;
    
    const uploadNote = document.createElement('span');
    uploadNote.className = 'upload-note';
    uploadNote.textContent = 'Save entry first to upload files';
    
    uploadContainer.appendChild(fileInput);
    uploadContainer.appendChild(uploadNote);
    filesCell.appendChild(uploadContainer);

    const actionsCell = newRow.insertCell(6);
    const privacyBtn = document.createElement('button');
    privacyBtn.className = 'privacy-btn text-dark';
    const privacyIcon = document.createElement('i');
    privacyIcon.className = 'fas fa-unlock';
    privacyBtn.appendChild(privacyIcon);
    privacyBtn.disabled = true; // Disabilitato finché non viene salvata la voce
    actionsCell.appendChild(privacyBtn);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => saveNewHistoryEntry(projectId, newRow));
    actionsCell.appendChild(saveBtn);
    
    // Aggiungi il pulsante Cancel
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        // Rimuovi la riga dalla tabella
        newRow.remove();
    });
    actionsCell.appendChild(cancelBtn);
}

/**
 * Salva una nuova voce nella cronologia del progetto.
 * @param {number} projectId - L'ID del progetto.
 * @param {HTMLTableRowElement} row - La riga della tabella che contiene i dati della nuova voce.
 */
export async function saveNewHistoryEntry(projectId, row) {
    // Verifica subito se ci sono attributi di risposta nel dataset della riga
    const isReply = row.hasAttribute('data-reply-to');
    const isForward = row.hasAttribute('data-forward');
    
    // Prepara tutti i possibili formati di campo accettati dall'API
    const newEntry = {
        date: row.cells[0].firstChild.value,
        phase: row.cells[1].firstChild.value,
        description: row.cells[2].firstChild.value,
        assignedTo: row.cells[3].querySelector('select').value,
        assigned_to: row.cells[3].querySelector('select').value, // Formato alternativo
        status: row.cells[4].querySelector('select').value
    };
    
    // Aggiungiamo campi specifici per identificare reply e forward
    if (isReply) {
        // Ottieni i riferimenti all'entry padre
        const parentId = row.getAttribute('data-reply-to');
        const parentCreatedBy = row.hasAttribute('data-parent-created-by') ? row.getAttribute('data-parent-created-by') : '';
        const parentCreatedByName = row.hasAttribute('data-parent-created-by-name') ? row.getAttribute('data-parent-created-by-name') : '';
        
        console.log(`Reply to parentId: ${parentId}`);
        console.log('currentUserId:', window.currentUserId);
        console.log('parentCreatedBy:', parentCreatedBy);
        console.log('parentCreatedByName:', parentCreatedByName);
        
        // SOLUZIONE CORRETTA per garantire che i campi vengano salvati correttamente
        
        // *** Elemento critico: Inserimento corretto dei created_by IDs ***
        // created_by è un campo INTEGER, quindi possiamo memorizzare solo il primo ID utente
        // Memorizziamo l'ID dell'utente padre per mantenere la catena di relazioni
        const parentCreatedById = parseInt(parentCreatedBy, 10);
        
        // IMPORTANTE: Memorizziamo l'ID dell'utente padre nel campo created_by
        // Questo è ciò che appare nella colonna nelle relazioni parent-child correttamente
        newEntry.created_by = parentCreatedById;
        newEntry.createdBy = parentCreatedById;
        
        console.log('CRITICO - IDs utenti in campo created_by:', newEntry.created_by);
        
        // Campo parent_id - stabilisce la relazione gerarchica
        const parentIdValue = parseInt(parentId, 10);
        newEntry.parent_id = parentIdValue;
        newEntry.parentId = parentIdValue;
        
        // Flag per il tipo di relazione
        if (isForward) {
            newEntry.is_reply = false;
            newEntry.isReply = false;
            newEntry.is_forward = true;
            newEntry.isForward = true;
        } else {
            newEntry.is_reply = true;
            newEntry.isReply = true;
            newEntry.is_forward = false;
            newEntry.isForward = false;
        }
        
        // 3. METODI ALTERNATIVI: Metodi alternativi per il tracking della relazione
        
        // Metodo A: Prefisso e concatenazione catena utenti nel campo created_by_name
        const actionPrefix = isForward ? "FORWARD:" : "REPLY:";
        const parentName = String(parentCreatedByName || '');
        const currentName = String(window.currentUserName || '');
        
        // Formato: "REPLY:nome_padre->nome_corrente" o "FORWARD:nome_padre->nome_corrente"
        // Utilizziamo -> invece di → per garantire compatibilità con le intestazioni HTTP
        const chainedUserNames = `${actionPrefix}${parentName}->${currentName}`;
        newEntry.created_by_name = chainedUserNames;
        newEntry.createdByName = chainedUserNames;
        
        // Metodo B: Aggiunta di campi dedicati specifici per il tracciamento della catena
        newEntry.chain_info = {
            type: isForward ? 'forward' : 'reply',
            parent_id: parentIdValue,
            parent_user: {
                id: parseInt(parentCreatedBy, 10),
                name: parentCreatedByName
            },
            current_user: {
                id: parseInt(window.currentUserId, 10),
                name: window.currentUserName
            }
        };
        
        console.log('Salvataggio record con parent ID:', parentId);
        console.log('Formati ID parent inclusi:', {
            parent_id: newEntry.parent_id,
            parentId: newEntry.parentId,
            reply_to_id: newEntry.reply_to_id,
            replyToId: newEntry.replyToId
        });
        
        // 4. GESTIONE UTENTE CORRENTE
        // Campo current_user - memorizza l'utente corrente esplicitamente per prevenire sovrascritture
        newEntry.current_user_id = window.currentUserId;
        newEntry.current_user_name = window.currentUserName;
        
        // 5. TRACCIA RELAZIONE ESPLICITA
        // Memorizza la relazione in campi espliciti 
        newEntry.relationship = {
            type: isForward ? 'forward' : 'reply',
            parentId: parentIdValue,
            parentOwnerId: parseInt(parentCreatedBy, 10),
            parentOwnerName: parentCreatedByName,
            timestamp: new Date().toISOString()
        };
        
        // Log dettagliato per debugging
        console.log('Dati completi per il record di risposta/inoltro:', {
            parent_id: parentIdValue,
            is_reply: newEntry.is_reply,
            is_forward: newEntry.is_forward,
            created_by_name: newEntry.created_by_name,
            chain_info: newEntry.chain_info,
            relationship: newEntry.relationship
        });
    }
    
    console.log('Dati completi della nuova voce:', newEntry);

    try {
        // Aggiungiamo un campo di timestamp unico per evitare caching
        newEntry._timestamp = new Date().getTime();
        
        console.log('Invio dati al server:', newEntry);
        
        const response = await fetch(`/api/projects/${projectId}/history`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Is-Reply': isReply && !isForward ? 'true' : 'false',
                'X-Is-Forward': isForward ? 'true' : 'false',
                'X-Parent-Id': (isReply || isForward) ? row.getAttribute('data-reply-to') : '',
                'X-Reply-Chain': isReply && !isForward ? newEntry.created_by_name : '',
                'X-Forward-Chain': isForward ? newEntry.created_by_name : ''
            },
            body: JSON.stringify(newEntry),
        });

        if (!response.ok) {
            throw new Error(`Errore durante il salvataggio: ${response.statusText}`);
        }

        // Aggiorna subito la cronologia
        await fetchProjectHistory(projectId);
        if (typeof window.updatePhaseSummary === 'function') {
            window.updatePhaseSummary();
        }
        
        // Gestisce la risposta e salva il parentId nella mappa globale
        try {
            const savedEntry = await response.json();
            if (savedEntry && savedEntry.id && isReply && parentId) {
                console.log(`Memorizzazione relazione: entry ${savedEntry.id} -> parent ${parentId}`);
                window.entryParentMap[savedEntry.id] = parentId;
            }
            if (!savedEntry || !savedEntry.id) {
                console.error('Errore: la risposta del server non contiene un ID valido.');
                alert('Errore durante il salvataggio della voce');
            }
        } catch (error) {
            console.error('Errore nel processare la risposta:', error);
        }

    } catch (error) {
        handleNetworkError(error);
    }
}

/**
 * Apre il modulo per modificare una voce esistente nella cronologia del progetto.
 * @param {number} entryId - L'ID della voce della cronologia da modificare.
 * @param {number} projectId - L'ID del progetto.
 */
export function editHistoryEntry(entryId, projectId) {
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    if (row) {
        const cells = row.getElementsByTagName('td');
        const historyData = {
            date: cells[0].textContent,
            phase: cells[1].textContent,
            description: cells[2].textContent,
            assigned_to: cells[3].textContent,
            status: cells[4].textContent
        };

        for (let i = 0; i < 5; i++) {
            let input;
            if (i === 3) { // Campo 'assigned_to'
                input = document.createElement('select');
                window.teamMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.name;
                    option.textContent = member.name;
                    if (member.name === historyData.assigned_to) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (i === 4) { // Campo 'status'
                input = document.createElement('select');
                ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    if (status === historyData.status) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            } else if (i === 1) { // Campo 'phase'
                input = document.createElement('select');
                // Verifica se le fasi sono già state caricate
                if (window.projectPhases) {
                    window.projectPhases.forEach(phase => {
                        const option = document.createElement('option');
                        option.value = phase.id;
                        option.textContent = phase.name;
                        if (phase.name === historyData.phase) {
                            option.selected = true;
                        }
                        input.appendChild(option);
                    });
                } else {
                    // Se le fasi non sono ancora state caricate, aggiungi un listener per l'evento phasesLoaded
                    window.addEventListener('phasesLoaded', (event) => {
                        const phases = event.detail;
                        phases.forEach(phase => {
                            const option = document.createElement('option');
                            option.value = phase.id;
                            option.textContent = phase.name;
                            if (phase.name === historyData.phase) {
                                option.selected = true;
                            }
                            input.appendChild(option);
                        });
                    });
                }
            } else if (i === 2) { // Campo 'description'
                // Per il campo description, manteniamo il testo originale inclusi i link
                input = document.createElement('textarea');
                // Otteniamo il testo originale dalla cella, che potrebbe contenere link HTML
                const descriptionText = cells[2].textContent || cells[2].innerText;
                input.value = descriptionText;
                input.style.width = '100%';
                input.style.minHeight = '100px';
                input.style.resize = 'vertical';
                
                // Gestione del drag and drop dei file in modalità edit
                input.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.style.backgroundColor = '#e6ffe6'; // Feedback visivo
                });
                
                input.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                });
                
                input.addEventListener('drop', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.style.backgroundColor = '#ffff99'; // Ripristina colore originale
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        const fileInput = cells[5].querySelector('input[type="file"]');
                        if (fileInput) {
                            // Crea un nuovo FileList con i file trascinati
                            const dataTransfer = new DataTransfer();
                            for (let i = 0; i < files.length; i++) {
                                dataTransfer.items.add(files[i]);
                            }
                            fileInput.files = dataTransfer.files;
                            
                            // Simula l'evento change per attivare l'upload
                            const event = new Event('change', { bubbles: true });
                            fileInput.dispatchEvent(event);
                        }
                    }
                });
            } else if (i === 0) { // Campo 'date'
                input = document.createElement('input');
                input.type = 'date';
                input.value = historyData.date;
            }
            input.style.backgroundColor = '#ffff99';
            cells[i].innerHTML = '';
            cells[i].appendChild(input);
        }

        const actionsCell = cells[6];
        actionsCell.innerHTML = '';
        
        // Salva i dati originali per poterli ripristinare in caso di annullamento
        const originalData = {
            date: historyData.date,
            phase: historyData.phase,
            description: historyData.description,
            assigned_to: historyData.assigned_to,
            status: historyData.status
        };
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async function() {
            const updatedEntry = {
                date: cells[0].firstChild.value,
                phase: cells[1].firstChild.value,
                description: cells[2].firstChild.value,
                assignedTo: cells[3].querySelector('select').value,
                status: cells[4].firstChild.value
            };

            try {
                const response = await fetch(`/api/projects/${projectId}/history/${entryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatedEntry),
                });

                if (response.ok) {
                    // Aggiorna subito la cronologia
                    await fetchProjectHistory(projectId);
                    if (typeof window.updatePhaseSummary === 'function') {
                        window.updatePhaseSummary();
                    }
                    try {
                        // Usa await con handleResponse dato che ora è una funzione asincrona
                        await handleResponse(response);
                    } catch (error) {
                        console.error('Errore nel processare la risposta:', error);
                    }
                } else {
                    console.error('Errore nell\'aggiornare la voce della cronologia');
                }
            } catch (error) {
                console.error('Errore durante l\'aggiornamento della voce della cronologia:', error);
            }
        });
        
        // Aggiungi il pulsante Cancel
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', function() {
            // Resetta tutti i filtri prima di procedere
            if (window.filteringApi && typeof window.filteringApi.resetFilters === 'function') {
                window.filteringApi.resetFilters();
            }
            
            // Aggiorna la cronologia per ripristinare lo stato originale
            fetchProjectHistory(projectId);
        });
        
        actionsCell.appendChild(saveBtn);
        actionsCell.appendChild(cancelBtn);
    } else {
        console.error('Row non trovata per entryId:', entryId);
    }
}

/**
 * Conferma l'eliminazione di una voce della cronologia.
 * @param {number} entryId - L'ID della voce della cronologia da eliminare.
 * @param {number} projectId - L'ID del progetto.
 */
export function confirmDelete(entryId, projectId) {
    if (confirm("Are you sure you want to delete this history entry?")) {
        deleteHistoryEntry(entryId, projectId);
    }
}

/**
 * Elimina una voce della cronologia del progetto.
 * @param {number} entryId - L'ID della voce della cronologia da eliminare.
 * @param {number} projectId - L'ID del progetto.
 */
export async function deleteHistoryEntry(entryId, projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/history/${entryId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            // Rimuove subito la riga dalla UI
            const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
            if (row) {
                row.remove();
            }
            // Aggiorna il riepilogo delle fasi
            if (typeof window.updatePhaseSummary === 'function') {
                window.updatePhaseSummary();
            }
            // Gestisce la risposta in background
            try {
                await handleResponse(response);
            } catch (error) {
                console.error('Errore nel processare la risposta:', error);
            }
        } else {
            console.error('Errore nell\'eliminare la voce della cronologia');
        }
    } catch (error) {
        handleNetworkError(error);
    }
}
