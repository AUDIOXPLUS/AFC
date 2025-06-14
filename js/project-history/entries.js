/**
 * Modulo per la gestione delle voci della cronologia del progetto
 * Contiene funzioni per aggiungere, modificare, eliminare e visualizzare le voci
 */

// Mappa globale per memorizzare le relazioni tra entry e parent
if (!window.entryParentMap) window.entryParentMap = {};

import { handleNetworkError, handleResponse } from './utils.js';
// Importa anche handleFileUpload per l'event delegation
import { updateFilesCell, fetchEntryFiles, handleFileUpload } from './files.js';


// --- Logica Tooltip Personalizzato per Descrizione ---

// Ottieni riferimenti agli elementi del tooltip una sola volta
const tooltipElement = document.getElementById('history-custom-tooltip');
const tooltipContent = document.getElementById('tooltip-content');
const tooltipTranslateBtn = document.getElementById('tooltip-translate-btn');
const tooltipLoading = document.getElementById('tooltip-loading');
const tooltipError = document.getElementById('tooltip-error');
let showTooltipTimer = null; // Timer per mostrare il tooltip con ritardo
let hideTooltipTimer = null; // Timer per nascondere il tooltip
let currentTargetCell = null; // Memorizza la cella target corrente
let isMouseOverTooltip = false; // Flag per tracciare se il mouse è sopra il tooltip
let currentTooltipWidth = 0; // Larghezza corrente del tooltip
let currentTooltipHeight = 0; // Altezza corrente del tooltip
let userResizedTooltip = false; // Flag per rilevare se l'utente ha ridimensionato manualmente il tooltip
let savedTooltipDimensions = { width: 400, height: 'auto' }; // Dimensioni salvate tra le sessioni

// Carica le dimensioni del tooltip salvate, se esistono
try {
    const savedDimensions = localStorage.getItem('tooltipDimensions');
    if (savedDimensions) {
        savedTooltipDimensions = JSON.parse(savedDimensions);
        console.log(`Dimensioni tooltip caricate: W=${savedTooltipDimensions.width}, H=${savedTooltipDimensions.height}`);
    }
} catch (error) {
    console.error("Errore nel caricamento delle dimensioni del tooltip:", error);
}

// Funzione per mostrare il tooltip (ora chiamata dopo il ritardo)
function showTooltip(cell) {
    // Rimosso event come parametro, ora passiamo direttamente la cella
    // Aggiunto check per tooltipElement per evitare errori se non trovato
    if (!cell || !tooltipElement) return;

    // Verifica se il mouse è ancora sulla cella target quando il timer scade
    // Questo previene la comparsa se l'utente si è spostato velocemente
    if (cell !== currentTargetCell) {
        console.log("Tooltip show cancelled: mouse left target cell before timer expired.");
        return;
    }
    // Cancella timer di chiusura se presente (spostato da mouseover)
    if (hideTooltipTimer) {
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;
    }

    const fullDescription = cell.dataset.fullDescription;
    // Aggiunto check per tooltipContent
    if (!fullDescription || !tooltipContent) return;

    // Mantiene la formattazione originale sostituendo \n con <br>
    const formattedDescription = fullDescription.replace(/\n/g, '<br>');
    tooltipContent.innerHTML = formattedDescription; // Usa innerHTML per mantenere i break line
    // Aggiunti check null per elementi opzionali
    if(tooltipError) tooltipError.textContent = ''; // Pulisci errori precedenti
    if(tooltipLoading) tooltipLoading.style.display = 'none'; // Nascondi loading
    if(tooltipTranslateBtn) tooltipTranslateBtn.disabled = false; // Abilita pulsante

    // Posiziona il tooltip vicino alla cella
    const rect = cell.getBoundingClientRect();
    tooltipElement.style.left = `${rect.left + window.scrollX}px`;
    tooltipElement.style.top = `${rect.bottom + window.scrollY}px`;
    
    // Imposta dimensioni predefinite o salvate dall'utente
    tooltipElement.style.width = `${savedTooltipDimensions.width}px`;
    tooltipElement.style.height = savedTooltipDimensions.height === 'auto' ? 'auto' : `${savedTooltipDimensions.height}px`;
    
    // Mostra il tooltip
    tooltipElement.style.display = 'block';
    
    // Resetta il flag di ridimensionamento
    userResizedTooltip = false;
}

// Funzione per avviare il timer per nascondere il tooltip
function startHideTooltipTimer() {
    // Cancella qualsiasi timer precedente
    if (hideTooltipTimer) {
        clearTimeout(hideTooltipTimer);
    }
    hideTooltipTimer = setTimeout(() => {
        // Nascondi solo se il mouse non è finito nel frattempo sul tooltip
        // Nascondi solo se il mouse non è finito nel frattempo sul tooltip
        if (!isMouseOverTooltip && tooltipElement) {
            tooltipElement.style.display = 'none';
            currentTargetCell = null;
            // Resetta le dimensioni registrate e lo stile
            currentTooltipWidth = 0;
            currentTooltipHeight = 0;
            tooltipElement.style.width = 'auto';
            tooltipElement.style.height = 'auto';
            console.log("Tooltip hidden and dimensions reset.");
        }
        hideTooltipTimer = null;
    }, 300); // Ritardo prima di nascondere
}

// Funzione per gestire il click sul pulsante Translate
async function handleTranslateClick() {
    // Aggiunti check null per tutti gli elementi richiesti
    if (!currentTargetCell || !tooltipContent || !tooltipLoading || !tooltipError || !tooltipTranslateBtn) {
         console.error("Elementi del tooltip o cella target mancanti per la traduzione.");
         return;
    }

    const originalText = currentTargetCell.dataset.fullDescription;
    const currentTextInTooltip = tooltipContent.innerHTML; // Usa innerHTML per verificare lo stato attuale
    let targetLang;
    // Usa il testo originale pulito (senza a capo) per la traduzione
    let textToTranslate = originalText.replace(/\n/g, ' '); // Sostituisce a capo con spazi

    // --- NUOVA LOGICA: Determina targetLang basandosi sul contenuto di originalText ---
    // Regex semplice per rilevare caratteri CJK (Cinese, Giapponese, Coreano)
    // Questo è un approccio semplificato, potrebbe non essere perfetto per tutti i casi.
    const containsChineseChars = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(originalText || ''); // Aggiunto fallback per originalText nullo

    if (containsChineseChars) {
        // Se il testo originale sembra Cinese, traduci in Inglese
        targetLang = 'en';
        console.log(`Rilevato testo originale come Cinese (o CJK). Target: ${targetLang}`);
    } else {
        // Altrimenti, assumi sia Inglese (o altra lingua non CJK) e traduci in Cinese
        targetLang = 'zh';
        console.log(`Testo originale non sembra Cinese (o CJK). Target: ${targetLang}`);
    }
    // --- FINE NUOVA LOGICA ---

    console.log(`Traduzione richiesta. Testo: "${textToTranslate?.substring(0,30)}...", Target: ${targetLang}`);

    if (!textToTranslate) {
        tooltipError.textContent = 'No text to translate.';
        return;
    }

    // Se il testo mostrato è già quello tradotto, rimetti l'originale invece di ritradurre
    // Questo previene chiamate API multiple se l'utente clicca più volte
    // Confrontiamo il testo attuale con l'originale per decidere se mostrare l'originale o chiamare l'API
    if (currentTextInTooltip !== originalText.replace(/\n/g, '<br>')) {
        console.log("Mostro testo originale.");
        tooltipContent.innerHTML = originalText.replace(/\n/g, '<br>');
        // Potremmo voler cambiare l'icona/testo del pulsante qui per indicare "Mostra originale"
        return; // Esce senza chiamare l'API
    }
    
    // Registra dimensioni attuali PRIMA di mostrare "Translating..."
    // e solo se non sono già state registrate per questa apertura
    if (currentTooltipWidth === 0 || currentTooltipHeight === 0) {
        const initialRect = tooltipElement.getBoundingClientRect();
        currentTooltipWidth = initialRect.width;
        currentTooltipHeight = initialRect.height;
        console.log(`Tooltip dimensions recorded: W=${currentTooltipWidth}, H=${currentTooltipHeight}`);
    }

    // Salva le dimensioni attuali prima della traduzione
    const currentWidth = tooltipElement.style.width;
    const currentHeight = tooltipElement.style.height;

    // Mostra messaggio di caricamento MANTENENDO le dimensioni esatte
    tooltipContent.innerHTML = 'Translating...<br>Please wait';
    // Non modificare le dimensioni qui

    // Procedi con la chiamata API per tradurre
    tooltipLoading.style.display = 'inline';
    tooltipError.textContent = '';
    tooltipTranslateBtn.disabled = true;

    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: textToTranslate,
                targetLang: targetLang
            }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `HTTP error ${response.status}`);
        if (result.translatedText) {
            // Mantieni la formattazione originale sostituendo a capo con <br>
            const formattedTranslation = result.translatedText.replace(/\n/g, '<br>');
            
            // Aggiorna il contenuto mantenendo esattamente le dimensioni correnti
            tooltipContent.innerHTML = formattedTranslation;
            
            // Assicurati che le dimensioni non cambino
            tooltipElement.style.width = currentWidth;
            tooltipElement.style.height = currentHeight;
        } else {
            throw new Error('Traduzione non ricevuta.');
        }
    } catch (error) {
        console.error('Errore durante la traduzione:', error);
        tooltipError.textContent = `Error: ${error.message}`;
        tooltipContent.textContent = originalText; // Ripristina originale
    } finally {
        tooltipLoading.style.display = 'none';
        tooltipTranslateBtn.disabled = false;
    }
}

// Funzione per salvare le dimensioni personalizzate del tooltip
function saveTooltipDimensions() {
    if (!tooltipElement || !userResizedTooltip) return;
    
    const rect = tooltipElement.getBoundingClientRect();
    // Salviamo solo se le dimensioni sono effettivamente cambiate
    if (rect.width <= 0 || rect.height <= 0) return;
    
    // Aggiorna le dimensioni correnti
    savedTooltipDimensions = {
        width: rect.width,
        height: rect.height
    };
    
    // Salva nel localStorage
    try {
        localStorage.setItem('tooltipDimensions', JSON.stringify(savedTooltipDimensions));
        console.log(`Dimensioni tooltip salvate: W=${savedTooltipDimensions.width}, H=${savedTooltipDimensions.height}`);
    } catch (error) {
        console.error("Errore nel salvataggio delle dimensioni del tooltip:", error);
    }
}

// Funzione per aggiungere i listener del tooltip
function setupTooltipListeners() {
    const tableBody = document.getElementById('history-table')?.getElementsByTagName('tbody')[0];
    if (!tableBody) {
        console.warn("Tooltip listeners: Impossibile trovare tbody.");
        return;
    }

    // Rimuovi listener precedenti
    if (tableBody._tooltipMouseoverListener) tableBody.removeEventListener('mouseover', tableBody._tooltipMouseoverListener);
    if (tableBody._tooltipMouseoutListener) tableBody.removeEventListener('mouseout', tableBody._tooltipMouseoutListener);

    // Definisci i nuovi listener per il tbody
    tableBody._tooltipMouseoverListener = (event) => {
        const cell = event.target.closest('.history-description-cell');
        if (cell) {
            currentTargetCell = cell; // Memorizza la cella target
            // Cancella qualsiasi timer di visualizzazione precedente
            if (showTooltipTimer) {
                clearTimeout(showTooltipTimer);
            }
            // Avvia il timer per mostrare il tooltip dopo 1 secondo
            showTooltipTimer = setTimeout(() => {
                // Passa la cella target alla funzione showTooltip
                showTooltip(cell);
                showTooltipTimer = null; // Resetta il timer dopo l'esecuzione
            }, 1000); // Ritardo impostato a 1 secondo
        }
    };
    tableBody._tooltipMouseoutListener = (event) => {
        const cell = event.target.closest('.history-description-cell');
        if (cell) {
            // Se il mouse esce dalla cella, cancella il timer per mostrare il tooltip
            if (showTooltipTimer) {
                clearTimeout(showTooltipTimer);
                showTooltipTimer = null;
            }
            
            // Imposta un piccolo ritardo prima di nascondere il tooltip
            // per permettere al mouse di passare dalla cella al tooltip
            setTimeout(() => {
                // Verifica se il mouse è ora sopra il tooltip
                if (!isMouseOverTooltip && tooltipElement && tooltipElement.style.display === 'block') {
                    // Salva le dimensioni prima di nascondere il tooltip (se l'utente l'ha ridimensionato)
                    if (userResizedTooltip) {
                        saveTooltipDimensions();
                    }
                    
                    // Nascondi il tooltip
                    tooltipElement.style.display = 'none';
                    currentTargetCell = null;
                    // Resetta le dimensioni registrate e lo stile
                    currentTooltipWidth = 0;
                    currentTooltipHeight = 0;
                    userResizedTooltip = false;
                    console.log("Tooltip hidden as mouse left the cell without entering tooltip.");
                }
            }, 100); // Piccolo ritardo di 100ms
        }
    };

    // Aggiungi i nuovi listener al tbody
    tableBody.addEventListener('mouseover', tableBody._tooltipMouseoverListener);
    tableBody.addEventListener('mouseout', tableBody._tooltipMouseoutListener); // Riattivato per cancellare showTooltipTimer

    // Aggiungi listener al tooltip stesso
    if (tooltipElement) {
        // Rimuovi listener precedenti
        if (tooltipElement._tooltipMouseoverListener) tooltipElement.removeEventListener('mouseover', tooltipElement._tooltipMouseoverListener);
        if (tooltipElement._tooltipMouseoutListener) tooltipElement.removeEventListener('mouseout', tooltipElement._tooltipMouseoutListener);
        if (tooltipElement._translateClickListener && tooltipTranslateBtn) tooltipTranslateBtn.removeEventListener('click', tooltipElement._translateClickListener);
        if (tooltipElement._resizeListener) tooltipElement.removeEventListener('mouseup', tooltipElement._resizeListener);

        // Definisci i nuovi listener per il tooltip
        tooltipElement._tooltipMouseoverListener = () => {
            isMouseOverTooltip = true;
            if (hideTooltipTimer) {
                clearTimeout(hideTooltipTimer);
                hideTooltipTimer = null;
            }
        };
        tooltipElement._tooltipMouseoutListener = () => {
            isMouseOverTooltip = false;
            // Salva le dimensioni se l'utente ha ridimensionato il tooltip
            if (userResizedTooltip) {
                saveTooltipDimensions();
            }
            // Avvia il timer solo quando si esce dal tooltip
            startHideTooltipTimer();
        };
        tooltipElement._translateClickListener = handleTranslateClick;
        
        // Listener per rilevare il ridimensionamento manuale del tooltip
        tooltipElement._resizeListener = () => {
            if (tooltipElement.style.display === 'block') {
                // Ottieni le dimensioni attuali
                const rect = tooltipElement.getBoundingClientRect();
                
                // Verifica se le dimensioni sono cambiate rispetto alle dimensioni iniziali
                if (rect.width !== savedTooltipDimensions.width || 
                    (savedTooltipDimensions.height !== 'auto' && rect.height !== savedTooltipDimensions.height)) {
                    userResizedTooltip = true;
                    console.log(`Tooltip ridimensionato dall'utente: W=${rect.width}, H=${rect.height}`);
                }
            }
        };

        // Aggiungi i nuovi listener al tooltip
        tooltipElement.addEventListener('mouseover', tooltipElement._tooltipMouseoverListener);
        tooltipElement.addEventListener('mouseout', tooltipElement._tooltipMouseoutListener);
        tooltipElement.addEventListener('mouseup', tooltipElement._resizeListener);
        
        if(tooltipTranslateBtn) {
            tooltipTranslateBtn.addEventListener('click', tooltipElement._translateClickListener);
        }
    } else {
         console.warn("Elemento tooltip non trovato per aggiungere listener.");
    }
}
// --- Fine Logica Tooltip ---


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

    // Controlla se ci sono parametri nell'URL per evidenziare o filtrare per fase
    const urlParams = new URLSearchParams(window.location.search);
    const highlightPhaseId = urlParams.get('highlightPhase');
    const filterPhaseId = urlParams.get('filterPhase');
    
    console.log(`Verifica parametri URL - highlightPhase: ${highlightPhaseId}, filterPhase: ${filterPhaseId}`);
    
    // Se è richiesto di filtrare per fase, imposta il filtro nel campo Phase
    if (filterPhaseId) {
        // Trova il nome della fase corrispondente all'ID
        const phaseName = window.projectPhasesMap && window.projectPhasesMap[filterPhaseId] 
            ? window.projectPhasesMap[filterPhaseId] 
            : String(filterPhaseId);
            
        console.log(`Impostazione filtro automatico sulla fase "${phaseName}" (ID: ${filterPhaseId})`);
        
        // Imposta il valore nel campo di filtro "Phase" (indice 0)
        const phaseFilterInput = document.querySelector('.filters input[type="text"][placeholder="Phase"]');
        if (phaseFilterInput) {
            phaseFilterInput.value = phaseName;
            // Trigger dell'evento input per attivare il filtro
            phaseFilterInput.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`Filtro Phase impostato su "${phaseName}"`);
        } else {
            console.error("Campo di filtro Phase non trovato nel DOM");
        }
    }
    
    // Usa DocumentFragment per migliorare le prestazioni di inserimento nel DOM
    const fragment = document.createDocumentFragment();

    history.forEach(entry => { // Non serve async qui se non ci sono await nel loop diretto
        const row = document.createElement('tr'); // Crea la riga
        row.setAttribute('data-entry-id', entry.id);
        
        // Verifica se questa entry deve essere evidenziata
        const shouldHighlight = highlightPhaseId && 
                                String(entry.phase) === String(highlightPhaseId) && 
                                (entry.is_new === true || entry.is_new === 1);
        
        if (shouldHighlight) {
            // Usa la nuova classe per creare un bordo lampeggiante che mantenga il colore di sfondo originale
            row.classList.add('highlight-from-progressbar');
            console.log(`[Evidenziazione] Riga evidenziata con bordo per l'entry ${entry.id} della fase ${entry.phase} (è nuova)`);
        }

        // --- Cella Data ---
        const dateCell = row.insertCell(0);
        dateCell.textContent = entry.date || '-'; // Usa '-' come fallback
        dateCell.style.position = 'relative';

        // --- Logica Reply/Forward e Icone ---
        // --- Logica Reply/Forward e Icone ---
        let isReply = false;
        let isForward = false;
        
        // Determina se è reply o forward basandosi SOLO sul parent_id e sulla descrizione,
        // poiché i flag is_reply/is_forward non sono salvati nel DB.
        if (entry.parent_id) { 
             // Controlla se la descrizione indica un forward
             if (entry.description && (entry.description.toLowerCase().includes('forward-') || entry.description.toLowerCase().startsWith('fwd:'))) { 
                 isForward = true; 
             }
             // Altrimenti, se ha un parent_id ma non è un forward, è un reply
             else { 
                 isReply = true; 
             }
        }
        // Se non ha parent_id, non è né reply né forward.
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
        // Rimosso: descCell.title = entry.description || ''; // Tooltip con descrizione originale
        descCell.setAttribute('data-full-description', entry.description || ''); // Memorizza descrizione completa
        descCell.classList.add('history-description-cell'); // Aggiunge classe per event delegation

        // --- Cella Assegnato A ---
        const assignedToCell = row.insertCell(3);
        // Usa la mappa dei membri se disponibile
        const assignedToName = entry.assigned_to;
        const memberName = (window.teamMembersMap && window.teamMembersMap[assignedToName]) ? window.teamMembersMap[assignedToName].name : (assignedToName || '-');
        assignedToCell.textContent = memberName;

        // Aggiungi "CC" se ci sono membri in copia conoscenza
        if (entry.cc_members && entry.cc_members.length > 0) {
            const ccSpan = document.createElement('span');
            ccSpan.textContent = ' CC';
            ccSpan.style.cursor = 'pointer';
            ccSpan.style.color = '#007bff';
            ccSpan.addEventListener('click', () => {
                showCCModal(row);
            });
            assignedToCell.appendChild(ccSpan);
        }

        // --- Cella Stato ---
        const statusCell = row.insertCell(4);
        statusCell.textContent = entry.status || '-';
        statusCell.setAttribute('data-status', entry.status || '-'); // Salva il valore originale in inglese

    // --- Cella File ---
    const filesCell = row.insertCell(5);
    
    // Determina se l'utente può eliminare questa entry (per passare ai file)
    let isGodUser = window.currentUserName === 'GOD';
    let isOwner = entry.created_by && String(entry.created_by) === String(window.currentUserId);
    let hasNoOwner = !entry.created_by;
    const canDelete = isGodUser || isOwner || hasNoOwner;
    
    // Salva il valore created_by come attributo sulla riga per riferimento futuro
    row.setAttribute('data-created-by', entry.created_by || '');
    
    // Chiamata per setup iniziale UI (drag hints) passando il permesso di eliminazione
    updateFilesCell(entry.id, projectId, filesCell, canDelete);

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
        // Usiamo le variabili già dichiarate sopra
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

        // Pulsante Set Completed per record con descrizione che inizia con "CC"
        if (entry.description && entry.description.startsWith('CC')) {
            const setCompletedBtn = document.createElement('button');
            setCompletedBtn.className = 'set-completed-btn';
            setCompletedBtn.textContent = 'Set Completed';
            setCompletedBtn.addEventListener('click', async () => {
                // Imposta il record come completato
                await markParentEntryComplete(entry.id, projectId);
            });
            actionsCell.appendChild(setCompletedBtn);
        }


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

    // --- Event Delegation per Drag & Drop sul tbody ---
    // Rimuovi listener precedenti se esistono per evitare duplicati
    if (tableBody._tableDropHandler) tableBody.removeEventListener('drop', tableBody._tableDropHandler);
    if (tableBody._tableDragOverHandler) tableBody.removeEventListener('dragover', tableBody._tableDragOverHandler);
    if (tableBody._tableDragEnterHandler) tableBody.removeEventListener('dragenter', tableBody._tableDragEnterHandler);

    // Handler per dragover/dragenter - necessario per permettere il drop
    const tableDragHandler = (e) => {
        const targetCell = e.target.closest('td');
        if (targetCell && targetCell.cellIndex === 5) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    // Handler per il drop
    const tableDropHandler = (e) => {
        const targetCell = e.target.closest('td');

        // Verifica se il drop è avvenuto sulla cella dei file (indice 5)
        if (targetCell && targetCell.cellIndex === 5) {
            e.preventDefault();
            e.stopPropagation();

            const row = targetCell.closest('tr');
            const entryId = row?.getAttribute('data-entry-id');
            const uploadContainer = targetCell.querySelector('.file-upload-container');

            if (entryId && uploadContainer) {
                const dt = e.dataTransfer;
                const droppedFiles = dt.files;

                if (droppedFiles.length > 0) {
                    console.log(`[Delegation] Drop su entry ${entryId}, chiamo handleFileUpload`);
                    // Chiama handleFileUpload passando i parametri corretti
                    handleFileUpload(droppedFiles, uploadContainer, targetCell, entryId, projectId);
                }
            } else {
                 console.log("[Delegation] Drop non valido (manca entryId o uploadContainer)");
            }
            // Resetta stile drag (anche se dovrebbe farlo l'handler su files.js, sicurezza in più)
            const browseIcon = targetCell.querySelector('.fa-folder-open');
            if(browseIcon) browseIcon.style.color = 'black';
            targetCell.style.backgroundColor = '';
            targetCell.style.boxShadow = '';
        } else {
             console.log("[Delegation] Drop ignorato (non su cella file)");
        }
    };

    // Aggiungi tutti i listener necessari
    tableBody.addEventListener('dragover', tableDragHandler, false);
    tableBody.addEventListener('dragenter', tableDragHandler, false);
    tableBody.addEventListener('drop', tableDropHandler, false);

    // Memorizza i riferimenti agli handler per poterli rimuovere dopo
    tableBody._tableDropHandler = tableDropHandler;
    tableBody._tableDragOverHandler = tableDragHandler;
    tableBody._tableDragEnterHandler = tableDragHandler;
    // --- Fine Event Delegation ---


    // Riapplica i filtri dopo aver aggiunto tutte le righe
    if (window.filteringApi && typeof window.filteringApi.applyFilters === 'function') {
        window.filteringApi.applyFilters();
    }

    // Aggiungi listener per tooltip DOPO che la tabella è stata popolata
    setupTooltipListeners();
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
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'flex-start';

            const ccButton = document.createElement('button');
            ccButton.textContent = 'CC';
            ccButton.style.marginBottom = '5px';
            ccButton.addEventListener('click', () => {
                showCCModal(newRow);
            });
            container.appendChild(ccButton);

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
            container.appendChild(select);

            cell.appendChild(container);
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

// Funzione per mostrare la finestra modale per la selezione dei membri in CC
function showCCModal(row) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    modal.id = 'cc-modal';

    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '300px';
    modalContent.style.maxHeight = '400px';
    modalContent.style.overflowY = 'auto';

    const title = document.createElement('h3');
    title.textContent = 'Select Team Members for CC';
    modalContent.appendChild(title);

    const memberList = document.createElement('div');
    if (Array.isArray(window.teamMembers)) {
        window.teamMembers.forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.style.marginBottom = '10px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = member.name;
            checkbox.id = `cc-${member.id}`;

            const label = document.createElement('label');
            label.htmlFor = `cc-${member.id}`;
            label.textContent = member.name;
            label.style.marginLeft = '5px';

            memberItem.appendChild(checkbox);
            memberItem.appendChild(label);
            memberList.appendChild(memberItem);
        });
    }
    modalContent.appendChild(memberList);

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.marginTop = '10px';
    saveButton.style.marginRight = '5px';
    saveButton.addEventListener('click', () => {
        const selectedMembers = Array.from(memberList.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        row.setAttribute('data-cc-members', JSON.stringify(selectedMembers));
        
        // Aggiorna l'interfaccia utente per mostrare gli utenti selezionati accanto al pulsante CC
        const assignedToCell = row.cells[3];
        if (assignedToCell) {
            let ccIndicator = assignedToCell.querySelector('.cc-indicator');
            if (!ccIndicator) {
                ccIndicator = document.createElement('span');
                ccIndicator.className = 'cc-indicator';
                ccIndicator.style.marginLeft = '5px';
                ccIndicator.style.color = '#007bff';
                assignedToCell.appendChild(ccIndicator);
            }
            ccIndicator.textContent = selectedMembers.length > 0 ? `CC: ${selectedMembers.join(', ')}` : '';
        }
        
        modal.remove();
    });
    modalContent.appendChild(saveButton);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.marginTop = '10px';
    cancelButton.addEventListener('click', () => {
        modal.remove();
    });
    modalContent.appendChild(cancelButton);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
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

    // Ottieni il valore della descrizione
    let description = descriptionTextarea.value;
    
    // Verifica se è un forward, sia in caso di creazione che di modifica
    let isActuallyForward = isForward; // Già determinato per nuove entry
    
    // Se stiamo modificando un record esistente, verifica se era un forward attraverso l'attributo o la descrizione
    if (isEditing) {
        // Verifica se la riga ha l'attributo data-is-forward (impostato nella funzione editHistoryEntry)
        if (row.hasAttribute('data-is-forward')) {
            isActuallyForward = true;
            console.log('Record esistente identificato come forward tramite attributo durante la modifica');
        }
        // In alternativa, controlla la descrizione originale
        else {
            // Ottieni la descrizione originale
            const originalDescription = descriptionTextarea.value || '';
            
            // Se la descrizione originale inizia con "Fwd:", è un forward
            if (originalDescription.toLowerCase().startsWith('fwd:')) {
                isActuallyForward = true;
                console.log('Record esistente identificato come forward tramite descrizione durante la modifica');
            }
        }
    }
    
    // Se è un forward (sia nuovo che esistente), assicurati che la descrizione inizi con "Fwd:"
    if (isActuallyForward && !description.toLowerCase().startsWith('fwd:')) {
        description = `Fwd: ${description}`;
        console.log('Prefisso "Fwd:" aggiunto automaticamente alla descrizione del forward');
    }
    
    // Prepara l'oggetto dati
    const entryData = {
        date: dateInput.value,
        phase: phaseSelect.value, // Assumendo che il valore sia l'ID della fase
        description: description, // Usa la descrizione modificata
        // Usa il NOME dell'utente come valore per assigned_to, come gestito dal backend
        assignedTo: assignedToSelect.value,
        assigned_to: assignedToSelect.value, // Campo duplicato per compatibilità? Meglio chiarire API
        status: statusSelect.value,
        // Aggiungi created_by solo se è una nuova entry (non in modifica)
        created_by: isEditing ? undefined : window.currentUserId,
        createdBy: isEditing ? undefined : window.currentUserId, // Alternativa camelCase
    };

    // Aggiungi membri in CC se selezionati
    if (row.hasAttribute('data-cc-members')) {
        const ccMembers = JSON.parse(row.getAttribute('data-cc-members') || '[]');
        // Non assegnare cc_members a entryData, salveremo record separati per ogni utente in CC
        // entryData.cc_members = ccMembers;
    }


    // Aggiungi campi specifici per reply/forward solo se è una NUOVA entry
    if (!isEditing && (isReply || isForward)) {
        const parentId = row.getAttribute('data-reply-to');
        const parentCreatedBy = row.getAttribute('data-parent-created-by');
        // const parentCreatedByName = row.getAttribute('data-parent-created-by-name'); // Non serve inviarlo

        if (parentId) entryData.parent_id = parseInt(parentId, 10);
        // Rimosso: if (isForward) entryData.is_forward = true; // Non viene salvato dal server
        // Rimosso: if (isReply) entryData.is_reply = true; // Non viene salvato dal server

        // Logica per created_by_name (catena utenti) - SOLO per nuove entry reply/forward
        const actionPrefix = isForward ? "FORWARD:" : "REPLY:";
        const parentName = row.getAttribute('data-parent-created-by-name') || '';
        const currentName = window.currentUserName || '';
        entryData.created_by_name = `${actionPrefix}${parentName}->${currentName}`;
    }

    console.log('Dati da salvare:', entryData);

    // Verifica che projectId ed entryId siano validi prima di costruire l'URL
    if (isEditing && (!entryId || isNaN(parseInt(entryId, 10)))) {
        console.error(`ID entry non valido per la modifica: ${entryId}`);
        alert(`Errore: ID entry non valido (${entryId}). Impossibile salvare la modifica.`);
        return null;
    }
    
    if (!projectId || isNaN(parseInt(projectId, 10))) {
        console.error(`ID progetto non valido: ${projectId}`);
        alert(`Errore: ID progetto non valido (${projectId}). Impossibile salvare il record.`);
        return null;
    }
    
    // Costruisci l'URL e il metodo
    const url = isEditing ? `/api/projects/${projectId}/history/${entryId}` : `/api/projects/${projectId}/history`;
    const method = isEditing ? 'PUT' : 'POST';
    
    console.log(`Invio richiesta ${method} a ${url}`);

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

        // Salva record separati per ogni utente in CC (solo per nuove entry)
        if (row.hasAttribute('data-cc-members')) {
            const ccMembers = JSON.parse(row.getAttribute('data-cc-members') || '[]');
            if (ccMembers.length > 0) {
                console.log(`Salvataggio di record separati per ${ccMembers.length} utenti in CC`);
                for (const ccMember of ccMembers) {
                    const ccEntryData = { ...entryData, assigned_to: ccMember, assignedTo: ccMember, description: `CC: ${entryData.description}` };
                    console.log(`Salvataggio record per utente in CC: ${ccMember}`);
                    try {
                        const ccResponse = await fetch(`/api/projects/${projectId}/history`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(ccEntryData),
                        });
                        if (!ccResponse.ok) {
                            const errorData = await ccResponse.text();
                            console.error(`Errore durante il salvataggio per ${ccMember}:`, errorData);
                            alert(`Errore durante il salvataggio per ${ccMember}: ${errorData}`);
                        } else {
                            console.log(`Record salvato con successo per ${ccMember}`);
                        }
                    } catch (error) {
                        console.error(`Errore di rete durante il salvataggio per ${ccMember}:`, error);
                        alert(`Errore di rete durante il salvataggio per ${ccMember}: ${error.message}`);
                    }
                }
                // Ricarica la cronologia per mostrare i nuovi record per gli utenti in CC
                const historyDataAfterCC = await fetchProjectHistory(projectId);
                if (window.updatePhaseSummary && historyDataAfterCC && historyDataAfterCC.latestEntries) {
                    window.updatePhaseSummary(historyDataAfterCC.latestEntries);
                }
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
    
    // Verifica se il record è un forward (ha parent_id e descrizione inizia con "Fwd:")
    // Prima otteniamo l'icona che potrebbe indicare che è un forward
    const actionIcon = cells[0].querySelector('i[data-action-type="forward"]');
    const isForward = !!actionIcon || 
                     (cells[2].textContent && cells[2].textContent.toLowerCase().startsWith('fwd:'));
    
    if (isForward) {
        // Aggiungiamo un attributo alla riga per ricordare che è un forward
        row.setAttribute('data-is-forward', 'true');
        console.log('Identificato record di tipo forward durante la modifica:', entryId);
    }

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
    // Non mostriamo l'input di file poiché c'è già l'icona della cartella per questo
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
