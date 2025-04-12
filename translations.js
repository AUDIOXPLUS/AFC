// Funzione per gestire gli errori di rete o API
function handleApiError(error, context) {
    console.error(`Errore API in ${context}:`, error);
    alert(`Si è verificato un errore durante ${context}. Si prega di riprovare.`);
}

// Funzione per caricare le traduzioni e popolare la tabella
async function loadTranslations() {
    const tableBody = document.getElementById('translations-table')?.getElementsByTagName('tbody')[0];
    if (!tableBody) {
        console.error('Elemento tbody della tabella traduzioni non trovato.');
        return;
    }
    tableBody.innerHTML = '<tr><td colspan="3">Loading translations...</td></tr>'; // Messaggio di caricamento

    try {
        // Usa il nuovo endpoint /api/translations/table per ottenere i dati in formato array
        const response = await fetch('/api/translations/table');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const translations = await response.json();

        tableBody.innerHTML = ''; // Pulisci il corpo della tabella

        if (translations.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3">No translations found.</td></tr>';
            return;
        }

        translations.forEach(translation => {
            const row = tableBody.insertRow();
            row.dataset.id = translation.id; // Salva l'ID nella riga

            const cellEnglish = row.insertCell(0);
            cellEnglish.textContent = translation.english_text;

            const cellChinese = row.insertCell(1);
            cellChinese.textContent = translation.chinese_text || ''; // Mostra stringa vuota se null

            const cellActions = row.insertCell(2);
            cellActions.classList.add('actions-cell');

            // Pulsante Modifica
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.classList.add('edit-btn');
            editBtn.onclick = () => editTranslation(row, translation.id, translation.english_text, translation.chinese_text);
            cellActions.appendChild(editBtn);

            // Pulsante Elimina
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = () => deleteTranslation(translation.id, translation.english_text);
            cellActions.appendChild(deleteBtn);
        });

    } catch (error) {
        handleApiError(error, 'il caricamento delle traduzioni');
        tableBody.innerHTML = '<tr><td colspan="3">Error loading translations.</td></tr>';
    }
}

// Funzione per aggiungere una nuova riga per l'inserimento di una traduzione
function addTranslationRow() {
    const tableBody = document.getElementById('translations-table')?.getElementsByTagName('tbody')[0];
    if (!tableBody) return;

    // Controlla se esiste già una riga di inserimento
    if (tableBody.querySelector('.new-entry-row')) {
        alert('Completa prima l\'inserimento corrente.');
        return;
    }

    const newRow = tableBody.insertRow(0); // Inserisci all'inizio
    newRow.classList.add('new-entry-row');

    const cellEnglish = newRow.insertCell(0);
    const inputEnglish = document.createElement('input');
    inputEnglish.type = 'text';
    inputEnglish.placeholder = 'English Text';
    inputEnglish.classList.add('new-entry-input');
    cellEnglish.appendChild(inputEnglish);

    const cellChinese = newRow.insertCell(1);
    const inputChinese = document.createElement('input');
    inputChinese.type = 'text';
    inputChinese.placeholder = 'Chinese Text';
    inputChinese.classList.add('new-entry-input');
    cellChinese.appendChild(inputChinese);

    const cellActions = newRow.insertCell(2);
    cellActions.classList.add('actions-cell');

    // Pulsante Salva
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');
    saveBtn.onclick = async () => {
        const englishText = inputEnglish.value.trim();
        const chineseText = inputChinese.value.trim();

        if (!englishText) {
            alert('Il testo in inglese è obbligatorio.');
            return;
        }

        try {
            const response = await fetch('/api/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ english_text: englishText, chinese_text: chineseText }),
            });

            if (response.ok) {
                await loadTranslations(); // Ricarica la tabella
            } else {
                 const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
                 alert(`Errore nell'aggiungere la traduzione: ${errorData.error}`);
                 // Non rimuovere la riga in caso di errore, permetti all'utente di correggere
            }
        } catch (error) {
            handleApiError(error, 'l\'aggiunta della traduzione');
        }
    };
    cellActions.appendChild(saveBtn);

    // Pulsante Annulla
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn');
    cancelBtn.onclick = () => {
        newRow.remove(); // Rimuovi la riga di inserimento
    };
    cellActions.appendChild(cancelBtn);

    inputEnglish.focus(); // Metti il focus sul primo campo
}

// Funzione per mettere una riga in modalità modifica
function editTranslation(row, id, currentEnglish, currentChinese) {
    // Se la riga è già in modifica, esci
    if (row.classList.contains('editing-row')) {
        return;
    }
    // Rimuovi eventuali altre righe in modifica
    const currentlyEditing = document.querySelector('#translations-table .editing-row');
    if (currentlyEditing) {
        cancelEditTranslation(currentlyEditing); // Annulla la modifica precedente
    }


    row.classList.add('editing-row'); // Marca la riga come in modifica

    const cellEnglish = row.cells[0];
    const cellChinese = row.cells[1];
    const cellActions = row.cells[2];

    // Salva i valori originali per il ripristino
    row.dataset.originalEnglish = cellEnglish.textContent;
    row.dataset.originalChinese = cellChinese.textContent;

    cellEnglish.innerHTML = '';
    const inputEnglish = document.createElement('input');
    inputEnglish.type = 'text';
    inputEnglish.value = currentEnglish;
    inputEnglish.classList.add('edit-entry-input'); // Classe diversa per stile?
    cellEnglish.appendChild(inputEnglish);

    cellChinese.innerHTML = '';
    const inputChinese = document.createElement('input');
    inputChinese.type = 'text';
    inputChinese.value = currentChinese || '';
    inputChinese.classList.add('edit-entry-input');
    cellChinese.appendChild(inputChinese);

    // Salva i bottoni originali per ripristinarli
    row.dataset.originalActionsHTML = cellActions.innerHTML;

    cellActions.innerHTML = ''; // Pulisci i bottoni esistenti

    // Pulsante Salva Modifiche
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');
    saveBtn.onclick = async () => {
        const newEnglishText = inputEnglish.value.trim();
        const newChineseText = inputChinese.value.trim();

        if (!newEnglishText) {
            alert('Il testo in inglese è obbligatorio.');
            return;
        }

        try {
            const response = await fetch(`/api/translations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ english_text: newEnglishText, chinese_text: newChineseText }),
            });

            if (response.ok) {
                // Aggiorna direttamente la riga senza ricaricare tutto
                cellEnglish.textContent = newEnglishText;
                cellChinese.textContent = newChineseText;
                cellActions.innerHTML = row.dataset.originalActionsHTML; // Ripristina bottoni originali
                row.classList.remove('editing-row'); // Rimuovi classe modifica
                // Riassegna gli eventi ai bottoni ripristinati
                setupActionButtonsForRow(row, id, newEnglishText, newChineseText);
            } else {
                 const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
                 alert(`Errore nell'aggiornare la traduzione: ${errorData.error}`);
                 // Non uscire dalla modalità modifica in caso di errore
            }
        } catch (error) {
            handleApiError(error, 'l\'aggiornamento della traduzione');
        }
    };
    cellActions.appendChild(saveBtn);

    // Pulsante Annulla Modifiche
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn');
    cancelBtn.onclick = () => cancelEditTranslation(row);
    cellActions.appendChild(cancelBtn);

    inputEnglish.focus();
}

// Funzione per annullare la modifica di una traduzione
function cancelEditTranslation(row) {
    if (!row || !row.classList.contains('editing-row')) return;

    const cellEnglish = row.cells[0];
    const cellChinese = row.cells[1];
    const cellActions = row.cells[2];

    // Ripristina i valori originali
    cellEnglish.textContent = row.dataset.originalEnglish;
    cellChinese.textContent = row.dataset.originalChinese;
    cellActions.innerHTML = row.dataset.originalActionsHTML; // Ripristina bottoni

    row.classList.remove('editing-row'); // Rimuovi classe modifica

    // Riassegna gli eventi ai bottoni ripristinati
    const id = row.dataset.id;
    setupActionButtonsForRow(row, id, row.dataset.originalEnglish, row.dataset.originalChinese);

    // Pulisci i dati salvati
    delete row.dataset.originalEnglish;
    delete row.dataset.originalChinese;
    delete row.dataset.originalActionsHTML;
}

// Funzione helper per riassegnare gli eventi ai bottoni Edit/Delete dopo il ripristino
function setupActionButtonsForRow(row, id, englishText, chineseText) {
    const editBtn = row.querySelector('.edit-btn');
    const deleteBtn = row.querySelector('.delete-btn');

    if (editBtn) {
        editBtn.onclick = () => editTranslation(row, id, englishText, chineseText);
    }
    if (deleteBtn) {
        deleteBtn.onclick = () => deleteTranslation(id, englishText);
    }
}


// Funzione per eliminare una traduzione
async function deleteTranslation(id, englishText) {
    if (!confirm(`Sei sicuro di voler eliminare la traduzione per "${englishText}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/translations/${id}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            await loadTranslations(); // Ricarica la tabella
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
            alert(`Errore nell'eliminare la traduzione: ${errorData.error}`);
        }
    } catch (error) {
        handleApiError(error, 'l\'eliminazione della traduzione');
    }
}


// Inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    // Carica le traduzioni esistenti
    loadTranslations();

    // Aggiungi event listener al pulsante "Add Translation"
    const addBtn = document.getElementById('add-translation-btn');
    if (addBtn) {
        addBtn.addEventListener('click', addTranslationRow);
    } else {
        console.error('Pulsante "Add Translation" non trovato.');
    }
});
