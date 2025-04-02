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
 * @returns {Promise<Object>} - Una promise che risolve con un oggetto { history, latestEntries }.
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

        // L'ordinamento ora viene gestito dal server
        console.log('Cronologia del Progetto (dal server):', history);

        // Evidenzia l'header della colonna Date che è ordinata di default (presumendo che il server ordini per data)
        const table = document.getElementById('history-table');
        if (table) {
            const headers = table.getElementsByTagName('th');
            if (headers && headers.length > 0) {
                Array.from(headers).forEach(header => header.classList.remove('sorted'));
                headers[0].classList.add('sorted'); // Date è la prima colonna (index 0)
            }

            // Calcola l'ultima entry per ogni fase dai dati PRIMA di renderizzare
            const latestEntries = calculateLatestEntries(history);

            // Visualizza la cronologia
            displayProjectHistory(history, projectId);

            // Restituisci sia la cronologia che le ultime entries
            return { history, latestEntries };
        } else {
            console.error('Tabella history-table non trovata nel DOM');
            // Restituisci valori di default in caso di errore DOM
            return { history: [], latestEntries: {} };
        }

    } catch (error) {
        console.error('Errore durante il recupero della cronologia:', error);

        // Gestione errore completamente interna per evitare crash
        try {
            handleNetworkError(error);
        } catch (handlerError) {
            console.error('Errore nel gestore degli errori di rete:', handlerError);
        }

        // Restituisci valori di default in caso di errore
        return { history: [], latestEntries: {} };
    }
}

/**
 * Calcola l'ultima entry per ogni fase dai dati della cronologia.
 * @param {Array} history - Array di oggetti della cronologia (già ordinato per data decrescente).
 * @returns {Object} - Un oggetto dove le chiavi sono i nomi delle fasi e i valori sono { date, description }.
 */
function calculateLatestEntries(history) {
    const latestEntries = {};
    // Assicurati che window.projectPhases sia disponibile e sia un array
    const phaseMap = (Array.isArray(window.projectPhases) ? window.projectPhases : []).reduce((map, phase) => {
        if (phase && phase.id !== undefined && phase.name !== undefined) {
            map[phase.id] = phase.name;
        }
        return map;
    }, {});
    
    // Salva la mappa delle fasi globalmente per riutilizzarla
    window.projectPhasesMap = phaseMap;

    history.forEach(entry => {
        // Considera solo le entry pubbliche o accessibili all'utente
        let isVisible = true;
        if (entry.private_by !== null && entry.private_by !== undefined) {
            const privateBy = String(entry.private_by);
            const currentUserId = String(window.currentUserId);
            // Verifica se l'utente corrente è il proprietario o nella lista di condivisione
            if (privateBy !== currentUserId && !privateBy.split(',').includes(currentUserId)) {
                isVisible = false;
            }
        }

        if (isVisible) {
            const phaseId = entry.phase;
            // Usa l'ID come fallback se il nome non è trovato nella mappa
            const phaseName = phaseMap[phaseId] || String(phaseId);

            // Poiché l'array è già ordinato per data decrescente,
            // la prima entry che troviamo per una fase è l'ultima (la più recente)
            if (!latestEntries[phaseName]) {
                latestEntries[phaseName] = {
                    // Non serve creare un oggetto Date qui, possiamo usare la stringa
                    date: entry.date,
                    description: entry.description || '' // Assicura che description sia una stringa
                };
            }
        }
    });
    console.log("Latest entries calcolate:", latestEntries);
    return latestEntries;
}


/**
 * Visualizza la cronologia del progetto nella tabella HTML.
 * @param {Array} history - Array di oggetti che rappresentano le voci della cronologia.
 * @param {number} projectId - L'ID del progetto.
 */
export function displayProjectHistory(history, projectId) {
    const tableBody = document.getElementById('history-table')?.getElementsByTagName('tbody')[0];
    if (!tableBody) {
        console.error("Elemento tbody della tabella history non trovato.");
        return;
    }
    tableBody.innerHTML = ''; // Pulisce il corpo della tabella

    // Usa DocumentFragment per migliorare le prestazioni di inserimento nel DOM
    const fragment = document.createDocumentFragment();

    history.forEach(entry => { // Non serve async qui se non ci sono await nel loop diretto
        const row = document.createElement('tr'); // Crea la riga
        row.setAttribute('data-entry-id', entry.id);

        // --- Cella Data ---
        const dateCell = row.insertCell(0);
        dateCell.textContent = entry.date || '-'; // Usa '-' come fallback
        dateCell.style.position = 'relative';

        // --- Logica Reply/Forward e Icone ---
        let isReply = false;
        let isForward = false;
        // ... (logica per determinare isReply/isForward come prima) ...
        if (entry.is_forward === true) { isForward = true; isReply = false; }
        else if (entry.is_reply === true) { isReply = true; isForward = false; }
        else if (entry.parent_id) {
             if (entry.description && (entry.description.toLowerCase().includes('forward-') || entry.description.toLowerCase().startsWith('fwd:'))) { isForward = true; }
             else { isReply = true; }
        }
        // ... (altri controlli come prima) ...

        if (entry.created_by) {
        if (isReply || isForward) {
            let iconClass = isReply ? 'fas fa-reply' : 'fas fa-reply fa-flip-horizontal';
            let iconColor = isReply ? '#0066cc' : '#e74c3c';
            let parentId = entry.parent_id || null;

                const actionIcon = document.createElement('i');
                actionIcon.className = iconClass;
                actionIcon.style.cssText = 'font-size: 10px; margin-left: 5px; color: ' + iconColor + '; cursor: pointer;'; // Stili compatti
                actionIcon.setAttribute('data-action-type', isReply ? 'reply' : 'forward');
                actionIcon.setAttribute('data-entry-id', String(entry.id)); // Assicura sia stringa
                actionIcon.setAttribute('data-parent-id', parentId ? String(parentId) : ''); // Assicura sia stringa
                actionIcon.title = parentId ? `Highlight parent record (ID: ${parentId})` : 'Parent record ID not available';

                // Event listener per highlight (come prima)
                actionIcon.addEventListener('mouseenter', () => {
                    // ... (codice highlight come prima, assicurati che funzioni) ...
                     if (!parentId) return;
                     // Reset filtri (se necessario)
                     // ...
                     highlightParentRecord(parentId, entry.id); // Passa ID per debugging
                });
                actionIcon.addEventListener('mouseleave', () => {
                     if (!parentId) return;
                     // Rimuovi highlight
                     // ...
                     removeParentHighlight();
                });

                dateCell.appendChild(actionIcon);

                // Icona utente generica
                const userIcon = document.createElement('i');
                userIcon.className = 'fas fa-user';
                userIcon.style.cssText = 'font-size: 10px; margin-left: 3px; color: #666;';
                dateCell.appendChild(userIcon);
                dateCell.title = `Created by: ${entry.creator_name || 'Unknown'}`; // Tooltip utente

            } else {
                // Record standard: solo icona utente e tooltip
                dateCell.title = `Created by: ${entry.creator_name || 'Unknown'}`;
                const userIcon = document.createElement('i');
                userIcon.className = 'fas fa-user';
                userIcon.style.cssText = 'font-size: 10px; margin-left: 5px; color: #666;';
                dateCell.appendChild(userIcon);
            }
        }

        // --- Cella Fase ---
        const phaseCell = row.insertCell(1);
        const phaseId = entry.phase;
        // Usa la mappa delle fasi se disponibile
        const phaseName = (window.projectPhasesMap && window.projectPhasesMap[phaseId]) ? window.projectPhasesMap[phaseId] : String(phaseId);
        phaseCell.textContent = phaseName;

        // --- Cella Descrizione ---
        const descCell = row.insertCell(2);
        let cleanDescription = entry.description || '';
        cleanDescription = cleanDescription.replace(/(forward-|reply-)/gi, '').replace(/\s*\[Parent:\s*\d+\]/g, '');
        descCell.textContent = cleanDescription; // Mostra testo pulito
        descCell.title = entry.description || ''; // Tooltip con descrizione originale

        // --- Cella Assegnato A ---
        const assignedToCell = row.insertCell(3);
        // Usa la mappa dei membri se disponibile
        const assignedToName = entry.assigned_to;
        const memberName = (window.teamMembersMap && window.teamMembersMap[assignedToName]) ? window.teamMembersMap[assignedToName].name : (assignedToName || '-');
        assignedToCell.textContent = memberName;

        // --- Cella Stato ---
        row.insertCell(4).textContent = entry.status || '-';

        // --- Cella File ---
        const filesCell = row.insertCell(5);
        // Chiama updateFilesCell DOPO che la riga è nel DOM (o passa la cella)
        // Deferring this call slightly or passing the cell might be needed
        // For now, keep the original logic but be aware it might need adjustment
        fetchEntryFiles(entry.id, projectId).then(files => {
             updateFilesCell(entry.id, projectId, filesCell); // Passa la cella per aggiornamento diretto
        });


        // --- Cella Azioni ---
        const actionsCell = row.insertCell(6);
        // ... (Logica per pulsanti Privacy, Edit, Delete, Reply, Forward come prima) ...
        // Assicurati che i listener usino le variabili corrette (entry, projectId)

        // Pulsante Privacy
        const privacyBtn = document.createElement('button');
        // ... (configurazione privacyBtn come prima) ...
        privacyBtn.className = entry.private_by !== null ? 'privacy-btn text-danger' : 'privacy-btn text-dark';
        privacyBtn.setAttribute('data-entry-id', String(entry.id));
        const privacyIcon = document.createElement('i');
        privacyIcon.className = entry.private_by !== null ? 'fas fa-lock' : 'fas fa-unlock';
        privacyBtn.appendChild(privacyIcon);
        privacyBtn.addEventListener('click', async () => { /* ... logica privacy ... */ await window.showSharingModal(entry.id); });
        actionsCell.appendChild(privacyBtn);

        // Pulsanti Edit/Delete (condizionali)
        const isGodUser = window.currentUserName === 'GOD';
        const isOwner = entry.created_by && String(entry.created_by) === String(window.currentUserId);
        const hasNoOwner = !entry.created_by;
        if (isGodUser || isOwner || hasNoOwner) {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => editHistoryEntry(entry.id, projectId));
            actionsCell.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => confirmDelete(entry.id, projectId));
            actionsCell.appendChild(deleteBtn);
        }

        // Pulsante Reply
        const replyBtn = document.createElement('button');
        replyBtn.className = 'set-completed-btn'; // Usa classe appropriata
        replyBtn.textContent = 'Reply';
        replyBtn.addEventListener('click', () => { /* ... logica reply ... */ handleReplyClick(entry, projectId); });
        actionsCell.appendChild(replyBtn);

        // Pulsante Forward
        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'set-completed-btn'; // Usa classe appropriata
        forwardBtn.textContent = 'Forward';
        forwardBtn.addEventListener('click', () => { /* ... logica forward ... */ handleForwardClick(entry, projectId); });
        actionsCell.appendChild(forwardBtn);


        // --- Applica classe colore/completato ---
        row.classList.remove('completed'); // Rimuovi classi precedenti
        row.className = row.className.replace(/team-member-\d+/g, '').trim(); // Rimuovi classi membro precedenti

        if (entry.status === 'Completed') {
            row.classList.add('completed');
        } else {
            // Usa la mappa per accesso diretto invece di .find()
            if (assignedToName && window.teamMembersMap && window.teamMembersMap[assignedToName]) {
                // Applica la classe CSS invece di manipolare direttamente lo stile
                row.classList.add('team-member-' + window.teamMembersMap[assignedToName].id);
            }
        }

        // Aggiungi la riga completa al fragment
        fragment.appendChild(row);
    });

    // Aggiungi tutte le righe al DOM in una sola operazione
    tableBody.appendChild(fragment);

    // Riapplica i filtri dopo aver aggiunto tutte le righe
    if (window.filteringApi && typeof window.filteringApi.applyFilters === 'function') {
        window.filteringApi.applyFilters();
    }
}

// --- Funzioni Helper per Highlight ---
function highlightParentRecord(parentId, childId) {
    removeParentHighlight(); // Rimuovi highlight precedenti
    const parentRow = document.querySelector(`tr[data-entry-id="${parentId}"]`);
    if (parentRow) {
        parentRow.classList.add('record-highlight');
        parentRow.style.outline = '3px solid red';
        parentRow.style.outlineOffset = '-3px';
        // Salva riferimento se necessario per rimuovere dopo
        document.body._highlightedParentRow = parentRow;
    } else {
         console.warn(`Highlight: Parent row ${parentId} not found for child ${childId}`);
         // Considera alert solo se strettamente necessario
         // alert(`Parent record (ID: ${parentId}) not currently visible. Try clearing filters.`);
    }
}

function removeParentHighlight() {
    const highlightedRow = document.body._highlightedParentRow;
    if (highlightedRow) {
        highlightedRow.classList.remove('record-highlight');
        highlightedRow.style.outline = '';
        highlightedRow.style.outlineOffset = '';
        document.body._highlightedParentRow = null;
    }
    // Rimuovi anche da altri eventuali elementi per sicurezza
    document.querySelectorAll('.record-highlight').forEach(el => {
        el.classList.remove('record-highlight');
        el.style.outline = '';
        el.style.outlineOffset = '';
    });
}

// --- Funzioni Helper per Reply/Forward ---
// Estrarre la logica di creazione riga per Reply/Forward in funzioni helper
// per mantenere displayProjectHistory più pulita.

function handleReplyClick(parentEntry, projectId) {
     // ... (logica per creare la riga di reply come nella versione precedente) ...
     // Assicurati di chiamare saveNewHistoryEntry alla fine
     console.log("Reply clicked for entry:", parentEntry.id);
     // Implementa la creazione della riga di input per la risposta
     createInputRow(parentEntry, projectId, false); // false indica che non è forward
}

function handleForwardClick(parentEntry, projectId) {
    // ... (logica per creare la riga di forward come nella versione precedente) ...
    // Assicurati di chiamare saveNewHistoryEntry alla fine
    console.log("Forward clicked for entry:", parentEntry.id);
    // Implementa la creazione della riga di input per l'inoltro
    createInputRow(parentEntry, projectId, true); // true indica che è forward
}

function createInputRow(parentEntry, projectId, isForwardAction) {
    const tableBody = document.getElementById('history-table')?.getElementsByTagName('tbody')[0];
    if (!tableBody) return;

    // Rimuovi eventuali altre righe di input aperte
    const existingInputRow = tableBody.querySelector('tr.input-row');
    if (existingInputRow) {
        existingInputRow.remove();
    }

    const newRow = tableBody.insertRow(0); // Inserisci all'inizio
    newRow.classList.add('input-row'); // Identifica la riga di input

    // Imposta attributi per identificare l'azione e il parent
    newRow.setAttribute('data-reply-to', String(parentEntry.id));
    newRow.setAttribute('data-parent-created-by', String(parentEntry.created_by || window.currentUserId));
    newRow.setAttribute('data-parent-created-by-name', parentEntry.creator_name || window.currentUserName);
    if (isForwardAction) {
        newRow.setAttribute('data-forward', 'true');
    }

    const fields = ['date', 'phase', 'description', 'assigned_to', 'status'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        cell.style.backgroundColor = '#ffffcc'; // Sfondo leggermente giallo per input

        if (field === 'date') {
            const input = document.createElement('input');
            input.type = 'date';
            input.name = field;
            const today = new Date();
            input.value = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
            cell.appendChild(input);
        } else if (field === 'phase') {
            const select = document.createElement('select');
            if (Array.isArray(window.projectPhases)) {
                window.projectPhases.forEach(phase => {
                    const option = document.createElement('option');
                    option.value = phase.id;
                    option.textContent = phase.name;
                    // Seleziona la fase del parent di default
                    if (String(phase.id) === String(parentEntry.phase)) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
            cell.appendChild(select);
        } else if (field === 'description') {
            const textarea = document.createElement('textarea');
            textarea.name = field;
            textarea.style.width = '100%';
            textarea.style.minHeight = '60px'; // Altezza ridotta
            textarea.style.resize = 'vertical';
            if (isForwardAction) {
                 // Pulisci descrizione parent prima di aggiungerla
                 let cleanParentDesc = parentEntry.description || '';
                 cleanParentDesc = cleanParentDesc.replace(/(forward-|reply-)/gi, '').replace(/\s*\[Parent:\s*\d+\]/g, '');
                 textarea.value = `Fwd: ${cleanParentDesc}`; // Prefisso standard
            }
            // Aggiungi gestione drag/drop se necessario
            // ...
            cell.appendChild(textarea);
            setTimeout(() => textarea.focus(), 50); // Focus sulla descrizione
        } else if (field === 'assigned_to') {
            const select = document.createElement('select');
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '-- Select --';
            select.appendChild(emptyOption);

            if (Array.isArray(window.teamMembers)) {
                window.teamMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.name; // Usa il nome come valore per coerenza
                    option.textContent = member.name;
                    // Se è reply, preseleziona il creatore del parent
                    if (!isForwardAction && String(member.id) === String(parentEntry.created_by)) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
            cell.appendChild(select);
            if (isForwardAction) {
                 select.style.border = '2px solid #ff9900'; // Evidenzia per forward
                 setTimeout(() => select.focus(), 50); // Focus sull'assegnatario per forward
            }
        } else if (field === 'status') {
            const select = document.createElement('select');
            ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                if (status === 'In Progress') { // Default a In Progress
                    option.selected = true;
                }
                select.appendChild(option);
            });
            cell.appendChild(select);
        }
    });

    // Cella File (inizialmente vuota o con nota)
    const filesCell = newRow.insertCell(5);
    filesCell.innerHTML = `<span class="upload-note" style="font-size:10px; color:grey;">Save entry to upload files</span>`;
    filesCell.style.backgroundColor = '#ffffcc';

    // Cella Azioni per la nuova riga
    const actionsCell = newRow.insertCell(6);
    actionsCell.style.backgroundColor = '#ffffcc';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'edit-btn'; // Stile simile a Edit
    saveBtn.style.marginRight = '5px';
    saveBtn.addEventListener('click', async () => {
        // Validazione (es. per forward, assicurati che assigned_to sia selezionato)
        if (isForwardAction) {
            const assignedToSelect = newRow.cells[3].querySelector('select');
            if (!assignedToSelect || assignedToSelect.value === '') {
                 alert('Please select a user to forward to.');
                 assignedToSelect?.focus();
                 return;
            }
        }
        // Salva la nuova entry
        const saved = await saveNewHistoryEntry(projectId, newRow); // saveNewHistoryEntry dovrebbe restituire l'ID o null/undefined
        if (saved) { // Se è stata salvata con successo (sia reply che forward)
             // Imposta il record padre come completato
             console.log(`Entry salvata con successo, imposto stato "Completed" per il record padre ${parentEntry.id}`);
             await markParentEntryComplete(parentEntry.id, projectId);
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'delete-btn'; // Stile simile a Delete
    cancelBtn.addEventListener('click', () => {
        newRow.remove(); // Rimuovi la riga di input
    });

    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
}

// Funzione per marcare il padre come completato
async function markParentEntryComplete(parentId, projectId) {
     // Assicurati che parentId e projectId siano valori numerici
     parentId = parseInt(parentId, 10);
     projectId = parseInt(projectId, 10);
     
     console.log(`Tentativo di impostare record padre ${parentId} del progetto ${projectId} come completato...`);
     
     try {
         // 1. Prima ottieni tutti i record per verificare che l'ID esista davvero
         console.log(`Verifico esistenza record nella cronologia del progetto...`);
         const allHistoryUrl = `/api/projects/${projectId}/history`;
         console.log(`URL per cronologia completa: ${allHistoryUrl}`);
         
         const historyResponse = await fetch(allHistoryUrl);
         if (!historyResponse.ok) {
             console.error(`Errore nel recuperare la cronologia del progetto: ${historyResponse.status}`);
             alert(`Impossibile verificare la cronologia del progetto. Errore: ${historyResponse.status} ${historyResponse.statusText}`);
             return;
         }
         
         const historyData = await historyResponse.json();
         console.log(`Cronologia recuperata: ${historyData.length} record`);
         
         // Trova il record specifico nella cronologia
         const parentRecord = historyData.find(entry => entry.id === parentId);
         if (!parentRecord) {
             console.error(`Record padre con ID ${parentId} non trovato nella cronologia`);
             alert(`Impossibile trovare il record padre con ID ${parentId}. L'aggiornamento dello stato non è possibile.`);
             return;
         }
         
         console.log(`Record padre trovato:`, parentRecord);
         
         // 2. Prepara i dati per l'aggiornamento - assicuriamoci di preservare tutti i campi
         const updateData = {
             date: parentRecord.date,
             phase: parentRecord.phase,
             description: parentRecord.description,
             assigned_to: parentRecord.assigned_to, // Preserviamo assigned_to
             assignedTo: parentRecord.assigned_to, // Aggiungiamo anche la versione camelCase
             status: 'Completed' // Imposta lo stato a Completed
         };
         
         // Assicuriamo che non ci siano valori null o undefined
         Object.keys(updateData).forEach(key => {
             if (updateData[key] === undefined || updateData[key] === null) {
                 console.warn(`Campo ${key} è ${updateData[key]}, utilizzo stringa vuota come fallback`);
                 updateData[key] = ''; // Fallback
             }
         });
         
         console.log(`Dati preparati per l'aggiornamento:`, updateData);
         
         // 3. Invia l'aggiornamento con tutti i campi originali
         const updateUrl = `/api/projects/${projectId}/history/${parentId}`;
         console.log(`URL per aggiornamento: ${updateUrl}`);
         
         const updateResponse = await fetch(updateUrl, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(updateData)
         });
         
         console.log(`Risposta aggiornamento - status: ${updateResponse.status}`);
         
         if (!updateResponse.ok) {
             // In caso di errore, mostra un messaggio all'utente
             const errorText = await updateResponse.text();
             console.error(`Errore nell'aggiornare lo stato del record: ${errorText}`);
             alert(`Impossibile aggiornare lo stato. Errore: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`);
         } else {
             console.log(`Stato del record padre ${parentId} aggiornato a "Completed" con successo.`);
             
             // 4. Aggiorna immediatamente la UI per mostrare lo stato aggiornato
             // Trova la riga del record padre nella tabella
             const parentRow = document.querySelector(`tr[data-entry-id="${parentId}"]`);
             if (parentRow) {
                 // Aggiungi la classe 'completed' alla riga
                 parentRow.classList.add('completed');
                 // Aggiorna anche la cella dello stato
                 const statusCell = parentRow.cells[4]; // La cella Status è la quinta (indice 4)
                 if (statusCell) {
                     statusCell.textContent = 'Completed';
                 }
                 console.log(`UI aggiornata: record padre ${parentId} ora visualizzato come "Completed"`);
             } else {
                 console.warn(`Non è stato possibile trovare la riga del record padre nella tabella per aggiornare la UI`);
             }
         }
     } catch (error) {
         console.error(`Errore di rete durante l'operazione:`, error);
         alert(`Errore di rete: ${error.message}`);
     }
}


/**
 * Apre il modulo per aggiungere una nuova voce alla cronologia del progetto.
 */
export function addHistoryEntry(projectId) {
    const tableBody = document.getElementById('history-table')?.getElementsByTagName('tbody')[0];
    if (!tableBody) return;

    // Rimuovi eventuali altre righe di input aperte
    const existingInputRow = tableBody.querySelector('tr.input-row');
    if (existingInputRow) {
        existingInputRow.remove();
    }

    const newRow = tableBody.insertRow(0); // Inserisci all'inizio
    newRow.classList.add('input-row');

    const fields = ['date', 'phase', 'description', 'assigned_to', 'status'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        cell.style.backgroundColor = '#ffffcc'; // Sfondo per input

        if (field === 'date') {
            const input = document.createElement('input');
            input.type = 'date';
            input.name = field;
            const today = new Date();
            input.value = today.toISOString().split('T')[0];
            cell.appendChild(input);
        } else if (field === 'phase') {
            const select = document.createElement('select');
             if (Array.isArray(window.projectPhases)) {
                 window.projectPhases.forEach(phase => {
                     const option = document.createElement('option');
                     option.value = phase.id;
                     option.textContent = phase.name;
                     select.appendChild(option);
                 });
             }
            cell.appendChild(select);
        } else if (field === 'description') {
            const textarea = document.createElement('textarea');
            textarea.name = field;
            textarea.style.width = '100%';
            textarea.style.minHeight = '60px';
            textarea.style.resize = 'vertical';
            // Aggiungere gestione drag/drop se necessario
            cell.appendChild(textarea);
        } else if (field === 'assigned_to') {
            const select = document.createElement('select');
             if (Array.isArray(window.teamMembers)) {
                 window.teamMembers.forEach(member => {
                     const option = document.createElement('option');
                     option.value = member.name; // Usa nome come valore
                     option.textContent = member.name;
                     // Seleziona utente corrente di default
                     if (String(member.id) === String(window.currentUserId)) {
                         option.selected = true;
                     }
                     select.appendChild(option);
                 });
             }
            cell.appendChild(select);
        } else if (field === 'status') {
            const select = document.createElement('select');
            ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                select.appendChild(option);
            });
            cell.appendChild(select);
        }
    });

    // Cella File
    const filesCell = newRow.insertCell(5);
    filesCell.innerHTML = `<span class="upload-note" style="font-size:10px; color:grey;">Save entry to upload files</span>`;
    filesCell.style.backgroundColor = '#ffffcc';


    // Cella Azioni
    const actionsCell = newRow.insertCell(6);
    actionsCell.style.backgroundColor = '#ffffcc';

    // Pulsante Privacy (disabilitato inizialmente)
    const privacyBtn = document.createElement('button');
    privacyBtn.className = 'privacy-btn text-dark';
    const privacyIcon = document.createElement('i');
    privacyIcon.className = 'fas fa-unlock';
    privacyBtn.appendChild(privacyIcon);
    privacyBtn.disabled = true;
    privacyBtn.title = "Save entry to set privacy";
    actionsCell.appendChild(privacyBtn);


    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'edit-btn';
    saveBtn.style.margin = '0 5px'; // Aggiungi margini
    saveBtn.addEventListener('click', () => saveNewHistoryEntry(projectId, newRow));
    actionsCell.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'delete-btn';
    cancelBtn.addEventListener('click', () => {
        newRow.remove();
    });
    actionsCell.appendChild(cancelBtn);
}


/**
 * Salva una nuova voce o una voce modificata nella cronologia del progetto.
 * @param {number} projectId - L'ID del progetto.
 * @param {HTMLTableRowElement} row - La riga della tabella che contiene i dati della nuova voce.
 * @param {number} [entryId] - L'ID della voce da aggiornare (se si sta modificando).
 * @returns {Promise<object|null>} - La entry salvata o null in caso di errore.
 */
export async function saveNewHistoryEntry(projectId, row, entryId = null) {
    const isEditing = entryId !== null;
    const isReply = row.hasAttribute('data-reply-to') && !isEditing; // Solo per nuove entry
    const isForward = row.hasAttribute('data-forward') && !isEditing; // Solo per nuove entry

    // Trova gli elementi di input/select nella riga
    const dateInput = row.cells[0].querySelector('input, select');
    const phaseSelect = row.cells[1].querySelector('input, select');
    const descriptionTextarea = row.cells[2].querySelector('textarea, input'); // Potrebbe essere input in edit
    const assignedToSelect = row.cells[3].querySelector('input, select');
    const statusSelect = row.cells[4].querySelector('input, select');

    // Verifica che tutti gli elementi siano stati trovati
    if (!dateInput || !phaseSelect || !descriptionTextarea || !assignedToSelect || !statusSelect) {
        console.error("Impossibile trovare tutti gli elementi di input nella riga:", row);
        alert("Errore: Impossibile salvare i dati. Elementi del form mancanti.");
        return null;
    }

    // Prepara l'oggetto dati
    const entryData = {
        date: dateInput.value,
        phase: phaseSelect.value, // Assumendo che il valore sia l'ID della fase
        description: descriptionTextarea.value,
        // Usa il NOME dell'utente come valore per assigned_to, come gestito dal backend
        assignedTo: assignedToSelect.value,
        assigned_to: assignedToSelect.value, // Campo duplicato per compatibilità? Meglio chiarire API
        status: statusSelect.value,
        // Aggiungi created_by solo se è una nuova entry (non in modifica)
        created_by: isEditing ? undefined : window.currentUserId,
        createdBy: isEditing ? undefined : window.currentUserId, // Alternativa camelCase
    };

    // Aggiungi campi specifici per reply/forward solo se è una NUOVA entry
    if (!isEditing && (isReply || isForward)) {
        const parentId = row.getAttribute('data-reply-to');
        const parentCreatedBy = row.getAttribute('data-parent-created-by');
        // const parentCreatedByName = row.getAttribute('data-parent-created-by-name'); // Non serve inviarlo

        if (parentId) entryData.parent_id = parseInt(parentId, 10);
        if (isForward) entryData.is_forward = true;
        if (isReply) entryData.is_reply = true;

        // Logica per created_by_name (catena utenti) - SOLO per nuove entry reply/forward
        const actionPrefix = isForward ? "FORWARD:" : "REPLY:";
        const parentName = row.getAttribute('data-parent-created-by-name') || '';
        const currentName = window.currentUserName || '';
        entryData.created_by_name = `${actionPrefix}${parentName}->${currentName}`;
    }

    console.log('Dati da salvare:', entryData);

    const url = isEditing ? `/api/projects/${projectId}/history/${entryId}` : `/api/projects/${projectId}/history`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                // Aggiungere header custom solo se strettamente necessario e gestito dal backend
                // 'X-Is-Reply': String(isReply),
                // 'X-Is-Forward': String(isForward),
                // 'X-Parent-Id': isReply || isForward ? row.getAttribute('data-reply-to') : '',
            },
            body: JSON.stringify(entryData),
        });

        if (!response.ok) {
            const errorData = await response.text(); // Leggi come testo per vedere l'errore esatto
            console.error(`Errore durante il salvataggio (${response.status}):`, errorData);
            throw new Error(`Errore durante il salvataggio: ${response.statusText} - ${errorData}`);
        }

        let savedEntry;
        try {
            // Verifica se c'è contenuto prima di provare a fare il parse JSON
            const responseText = await response.text();
            console.log('Risposta server:', responseText);
            
            if (responseText && responseText.trim().length > 0) {
                savedEntry = JSON.parse(responseText);
            } else {
                // Se la risposta è vuota ma la richiesta è OK, 
                // per operazioni di modifica può essere normale
                console.log('Risposta vuota dal server, ma operazione completata con successo');
                savedEntry = isEditing ? { id: entryId } : {}; // oggetto con almeno l'id se stiamo modificando
            }
        } catch (jsonError) {
            console.warn('Errore nel parsing della risposta JSON:', jsonError);
            // Creiamo un oggetto base per continuare l'operazione
            savedEntry = isEditing ? { id: entryId } : {};
        }
        console.log('Entry salvata:', savedEntry);

        // Ricarica la cronologia per mostrare la nuova entry/modifiche
        // fetchProjectHistory ora restituisce { history, latestEntries }
        const historyData = await fetchProjectHistory(projectId);
        if (window.updatePhaseSummary && historyData && historyData.latestEntries) {
             // Passa i dati aggiornati per il riepilogo fasi
             window.updatePhaseSummary(historyData.latestEntries);
        }

        // Gestione upload file DOPO aver salvato e ottenuto l'ID (solo per nuove entry)
        if (!isEditing && savedEntry && savedEntry.id) {
            const fileInput = row.cells[5].querySelector('input[type="file"]');
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                console.log(`Tentativo di upload di ${fileInput.files.length} file per la nuova entry ${savedEntry.id}`);
                const formData = new FormData();
                for (const file of fileInput.files) {
                    formData.append('files', file);
                }
                // Aggiungi altri dati se necessario dal backend
                // formData.append('userId', window.currentUserId);

                try {
                    const uploadResponse = await fetch(`/api/projects/${projectId}/history/${savedEntry.id}/files`, {
                        method: 'POST',
                        body: formData,
                        // Non impostare Content-Type, il browser lo fa per FormData
                    });
                    if (!uploadResponse.ok) {
                        const uploadError = await uploadResponse.text();
                        throw new Error(`Errore upload file: ${uploadResponse.statusText} - ${uploadError}`);
                    }
                    console.log(`File caricati con successo per l'entry ${savedEntry.id}`);
                    // Aggiorna la cella dei file specifica per la nuova riga (ora che è stata sostituita)
                    const newRowInTable = document.querySelector(`tr[data-entry-id='${savedEntry.id}']`);
                    if (newRowInTable) {
                         updateFilesCell(savedEntry.id, projectId, newRowInTable.cells[5]);
                    }
                } catch (uploadError) {
                    console.error("Errore durante l'upload dei file:", uploadError);
                    alert(`Entry saved, but failed to upload files: ${uploadError.message}`);
                }
            }
        } else if (isEditing) {
             // Se stiamo modificando, aggiorniamo la cella dei file della riga esistente
             updateFilesCell(entryId, projectId, row.cells[5]);
        }


        return savedEntry; // Restituisce la entry salvata

    } catch (error) {
        console.error('Errore in saveNewHistoryEntry:', error);
        alert(`Failed to save history entry: ${error.message}`);
        // Non rimuovere la riga di input in caso di errore, l'utente potrebbe voler riprovare
        return null; // Indica fallimento
    }
}


/**
 * Apre il modulo per modificare una voce esistente nella cronologia del progetto.
 */
export function editHistoryEntry(entryId, projectId) {
    const row = document.querySelector(`tr[data-entry-id='${entryId}']`);
    if (!row) {
        console.error('Riga non trovata per entryId:', entryId);
        return;
    }

    // Controlla se la riga è già in modalità modifica
    if (row.classList.contains('editing-row')) {
        console.log("Riga già in modalità modifica.");
        return;
    }
    row.classList.add('editing-row'); // Marca la riga come in modifica

    const cells = row.cells; // Usa row.cells invece di getElementsByTagName
    const originalData = {}; // Oggetto per salvare i valori originali

    // Mappa indici colonne a nomi campi (più robusto)
    const fieldMap = {
        0: 'date',
        1: 'phase',
        2: 'description',
        3: 'assigned_to',
        4: 'status'
    };

    // Salva i dati originali e crea gli input
    for (let i = 0; i < 5; i++) {
        const fieldName = fieldMap[i];
        const cell = cells[i];
        originalData[fieldName] = cell.textContent; // Salva il testo originale

        cell.innerHTML = ''; // Pulisci la cella
        cell.style.backgroundColor = '#ffffcc'; // Sfondo input

        let input;
        if (fieldName === 'date') {
            input = document.createElement('input');
            input.type = 'date';
            // Converte il formato DD/MM/YYYY o YYYY-MM-DD in YYYY-MM-DD per l'input date
            const dateParts = originalData.date.split(/[-/]/);
            let formattedDate = originalData.date; // Default
            if (dateParts.length === 3) {
                 if (dateParts[0].length === 4) { // YYYY-MM-DD
                     formattedDate = originalData.date;
                 } else if (dateParts[2].length === 4) { // DD/MM/YYYY
                     formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                 }
            }
            input.value = formattedDate;

        } else if (fieldName === 'phase') {
            input = document.createElement('select');
            if (Array.isArray(window.projectPhases)) {
                window.projectPhases.forEach(phase => {
                    const option = document.createElement('option');
                    option.value = phase.id; // Usa ID come valore
                    option.textContent = phase.name;
                    // Confronta con l'ID della fase se possibile, altrimenti con il nome
                    const originalPhaseId = Object.keys(window.projectPhasesMap || {}).find(id => window.projectPhasesMap[id] === originalData.phase);
                    if (String(phase.id) === String(originalPhaseId || originalData.phase)) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            }
        } else if (fieldName === 'description') {
            input = document.createElement('textarea');
            input.value = originalData.description;
            input.style.width = '100%';
            input.style.minHeight = '60px';
            input.style.resize = 'vertical';
            // Aggiungere gestione drag/drop se necessario
        } else if (fieldName === 'assigned_to') {
            input = document.createElement('select');
            if (Array.isArray(window.teamMembers)) {
                window.teamMembers.forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.name; // Usa nome come valore
                    option.textContent = member.name;
                    if (member.name === originalData.assigned_to) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            }
        } else if (fieldName === 'status') {
            input = document.createElement('select');
            ['In Progress', 'Completed', 'On Hold', 'Archived'].forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                if (status === originalData.status) {
                    option.selected = true;
                }
                input.appendChild(option);
            });
        }
        input.name = fieldName; // Assegna il nome per riferimento
        cell.appendChild(input);
    }

    // Gestione cella File (abilita input)
    const filesCell = cells[5];
    const fileInputContainer = filesCell.querySelector('.file-upload-container') || document.createElement('div');
    fileInputContainer.className = 'file-upload-container'; // Assicura la classe
    // Svuota il contenitore prima di aggiungere nuovi elementi
    // fileInputContainer.innerHTML = ''; // Rimuove anche i file esistenti, forse non desiderato?
    // Manteniamo i file esistenti e aggiungiamo l'input
    let fileInput = filesCell.querySelector('input[type="file"]');
    if (!fileInput) {
         fileInput = document.createElement('input');
         fileInput.type = 'file';
         fileInput.name = 'files';
         fileInput.multiple = true;
         fileInputContainer.appendChild(fileInput); // Aggiungi input se non esiste
    }
    fileInput.disabled = false; // Abilita l'input
    fileInput.style.display = 'block'; // Assicura sia visibile
    fileInput.addEventListener('change', async (e) => {
         // Logica di upload immediato (o al salvataggio)
         const filesToUpload = e.target.files;
         if (filesToUpload.length > 0) {
              console.log(`Uploading ${filesToUpload.length} file(s) for entry ${entryId}...`);
              const formData = new FormData();
              for (const file of filesToUpload) {
                   formData.append('files', file);
              }
              try {
                   const uploadResponse = await fetch(`/api/projects/${projectId}/history/${entryId}/files`, {
                        method: 'POST',
                        body: formData,
                   });
                   if (!uploadResponse.ok) throw new Error(await uploadResponse.text());
                   console.log("Files uploaded successfully during edit.");
                   // Aggiorna la lista file nella cella
                   updateFilesCell(entryId, projectId, filesCell);
              } catch (err) {
                   console.error("Error uploading files during edit:", err);
                   alert(`Error uploading files: ${err.message}`);
              }
         }
    });
    // Assicura che il contenitore sia nella cella
    if (!filesCell.contains(fileInputContainer)) {
         filesCell.appendChild(fileInputContainer);
    }


    // Gestione cella Azioni (pulsanti Save/Cancel)
    const actionsCell = cells[6];
    actionsCell.innerHTML = ''; // Pulisci azioni precedenti
    actionsCell.style.backgroundColor = '#ffffcc';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'edit-btn';
    saveBtn.style.marginRight = '5px';
    saveBtn.addEventListener('click', async () => {
        // Chiama saveNewHistoryEntry passando l'ID per la modalità PUT
        const saved = await saveNewHistoryEntry(projectId, row, entryId);
        if (saved) {
            // Esci dalla modalità modifica (verrà gestito da fetchProjectHistory che ricarica tutto)
            // row.classList.remove('editing-row');
            // restoreOriginalRow(row, originalData); // Ripristina temporaneamente o lascia fare a fetch
        } else {
             // Gestisci errore di salvataggio se necessario (es. non uscire da edit mode)
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'delete-btn';
    cancelBtn.addEventListener('click', () => {
        // Ripristina la riga allo stato originale senza ricaricare tutta la tabella
        restoreOriginalRow(row, originalData);
        row.classList.remove('editing-row');
        // Aggiorna la cella file per mostrare di nuovo la lista e nascondere l'input
        updateFilesCell(entryId, projectId, filesCell);
        const fileInputInCell = filesCell.querySelector('input[type="file"]');
        if(fileInputInCell) fileInputInCell.style.display = 'none'; // Nascondi input
    });

    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
}

// Funzione helper per ripristinare una riga dopo Cancel Edit
function restoreOriginalRow(row, originalData) {
    const cells = row.cells;
    const fieldMap = { 0: 'date', 1: 'phase', 2: 'description', 3: 'assigned_to', 4: 'status' };
    for (let i = 0; i < 5; i++) {
        cells[i].innerHTML = ''; // Pulisci input/select
        cells[i].textContent = originalData[fieldMap[i]]; // Ripristina testo
        cells[i].style.backgroundColor = ''; // Rimuovi sfondo giallo
    }
    // Ripristina azioni originali (Edit/Delete/Reply/Forward) - Questo richiede di rigenerare i pulsanti originali
    // Per semplicità, potremmo solo ricaricare la storia, ma questo è più veloce UI-wise
    // Rigenera i pulsanti standard qui... (complesso, richiede stato originale)
    // Alternativa: ricarica solo questa riga o tutta la storia con fetchProjectHistory
    // Per ora, lasciamo che fetchProjectHistory gestisca il ripristino completo dopo il salvataggio.
    // Il cancel ripristina solo il contenuto testuale e rimuove i pulsanti Save/Cancel.
    cells[6].innerHTML = ''; // Rimuovi Save/Cancel
    // Dovresti rigenerare i pulsanti originali qui se non vuoi ricaricare tutta la tabella
}


/**
 * Conferma l'eliminazione di una voce della cronologia.
 */
export function confirmDelete(entryId, projectId) {
    if (confirm("Are you sure you want to delete this history entry?")) {
        deleteHistoryEntry(entryId, projectId);
    }
}

/**
 * Elimina una voce della cronologia del progetto.
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
            // Aggiorna il riepilogo delle fasi (potrebbe essere necessario ricalcolarlo)
            // Ricarichiamo la storia per aggiornare tutto correttamente
            const historyData = await fetchProjectHistory(projectId);
             if (window.updatePhaseSummary && historyData && historyData.latestEntries) {
                 window.updatePhaseSummary(historyData.latestEntries);
             }

        } else {
            const errorText = await response.text();
            console.error('Errore nell\'eliminare la voce della cronologia:', errorText);
            alert(`Failed to delete entry: ${errorText}`);
        }
    } catch (error) {
        handleNetworkError(error);
        alert(`Network error deleting entry: ${error.message}`);
    }
}
