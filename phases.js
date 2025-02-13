// Funzione di utilità per gestire gli errori di rete
function handleNetworkError(error) {
    console.error('Network error:', error);
    // Se l'errore è di tipo network (offline) o 401 (non autorizzato)
    if (!navigator.onLine || (error.response && error.response.status === 401)) {
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Verifica lo stato della connessione
    if (!navigator.onLine) {
        window.location.href = 'login.html';
        return;
    }
    initializePhasesPage();
});

function initializePhasesPage() {
    document.getElementById('logout').addEventListener('click', function() {
        window.location.href = 'login.html';
    });

    document.getElementById('add-phase-btn').addEventListener('click', addPhase);

    // Carica le fasi una sola volta
    fetchPhases();
}

// Funzione per aggiungere una nuova fase
function addPhase() {
    const tableBody = document.getElementById('phases-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);
    newRow.classList.add('editing'); // Aggiunge classe per stile giallo

    const fields = ['name', 'description', 'order'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        const input = document.createElement('input');
        input.type = field === 'order' ? 'number' : 'text';
        input.name = field;
        cell.appendChild(input);
    });

    const actionsCell = newRow.insertCell(3);
    
    // Pulsante Save
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');
    saveBtn.addEventListener('click', async () => {
        await saveNewPhase(newRow);
        fetchPhases(); // Ricarica la tabella dopo il salvataggio
    });
    
    // Pulsante Cancel
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn');
    cancelBtn.addEventListener('click', () => {
        tableBody.removeChild(newRow);
    });

    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
}

// Funzione per salvare una nuova fase
async function saveNewPhase(row) {
    const newPhase = {
        name: row.cells[0].firstChild.value,
        description: row.cells[1].firstChild.value,
        order_num: parseInt(row.cells[2].firstChild.value),
        status: 'active', // Stato predefinito
        progress: 0 // Progresso iniziale
    };

    try {
        const response = await fetch('/api/phases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newPhase),
        });

        if (response.ok) {
            const savedPhase = await response.json();
            
            // Aggiorna la riga con i dati salvati
            row.cells[0].textContent = savedPhase.name;
            row.cells[1].textContent = savedPhase.description;
            row.cells[2].textContent = savedPhase.order_num;
            row.setAttribute('data-phase-id', savedPhase.id);
            
            // Trasforma il pulsante Save in Edit
            const actionsCell = row.cells[3];
            actionsCell.innerHTML = '';
            
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.classList.add('edit-btn');
            editBtn.addEventListener('click', () => editPhase(savedPhase.id));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.addEventListener('click', () => confirmDeletePhase(savedPhase.id));
            
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
            
            // Rimuovi lo stile di editing
            row.classList.remove('editing');
        } else {
            console.error('Failed to add phase');
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

function editPhase(phaseId) {
    const row = document.querySelector(`tr[data-phase-id="${phaseId}"]`);
    row.classList.add('editing');
    const cells = row.cells;

    ['name', 'description', 'order'].forEach((field, index) => {
        const currentValue = cells[index].textContent;
        const input = document.createElement('input');
        input.type = field === 'order' ? 'number' : 'text';
        input.value = currentValue;
        cells[index].textContent = '';
        cells[index].appendChild(input);
    });

    const actionsCell = cells[3];
    actionsCell.innerHTML = '';
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');
    saveBtn.addEventListener('click', () => saveEditedPhase(phaseId, row));
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn');
    cancelBtn.addEventListener('click', () => {
        fetchPhases(); // Ricarica i dati originali
    });
    
    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
}

async function saveEditedPhase(phaseId, row) {
    const updatedPhase = {
        name: row.cells[0].firstChild.value,
        description: row.cells[1].firstChild.value,
        order_num: parseInt(row.cells[2].firstChild.value)
    };

    try {
        const response = await fetch(`/api/phases/${phaseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedPhase),
        });

        if (response.ok) {
            const savedPhase = await response.json();
            
            // Aggiorna la riga con i dati salvati
            row.cells[0].textContent = savedPhase.name;
            row.cells[1].textContent = savedPhase.description;
            row.cells[2].textContent = savedPhase.order_num;
            
            // Ripristina i pulsanti Edit e Delete
            const actionsCell = row.cells[3];
            actionsCell.innerHTML = '';
            
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.classList.add('edit-btn');
            editBtn.addEventListener('click', () => editPhase(phaseId));
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.addEventListener('click', () => confirmDeletePhase(phaseId));
            
            actionsCell.appendChild(editBtn);
            actionsCell.appendChild(deleteBtn);
            
            // Rimuovi lo stile di editing
            row.classList.remove('editing');
        } else {
            console.error('Failed to update phase');
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

// Funzione per confermare l'eliminazione di una fase
function confirmDeletePhase(phaseId) {
    if (confirm("Sei sicuro di voler eliminare questa fase?")) {
        deletePhase(phaseId);
    }
}

// Funzione per eliminare una fase
async function deletePhase(phaseId) {
    try {
        const response = await fetch(`/api/phases/${phaseId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            console.log('Phase deleted successfully');
            fetchPhases(); // Ricarica la lista delle fasi
        } else {
            console.error('Failed to delete phase');
        }
    } catch (error) {
        handleNetworkError(error);
    }
}

// Funzione per recuperare le fasi del progetto
async function fetchPhases() {
    try {
        const response = await fetch('/api/phases');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        let phases = await response.json();
        // Ordina le fasi per 'order_num'
        phases.sort((a, b) => a.order_num - b.order_num);
        displayPhases(phases);
        // Espone le fasi globalmente per essere utilizzate in project-history
        window.projectPhases = phases;
        // Emette un evento per notificare che le fasi sono state caricate
        window.dispatchEvent(new CustomEvent('phasesLoaded', { detail: phases }));
    } catch (error) {
        handleNetworkError(error);
    }
}

function displayPhases(phases) {
    const tableBody = document.getElementById('phases-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Pulisce le righe esistenti

    phases.forEach(phase => {
        const row = tableBody.insertRow();
        row.setAttribute('data-phase-id', phase.id);
        row.insertCell(0).textContent = phase.name;
        row.insertCell(1).textContent = phase.description;
        row.insertCell(2).textContent = phase.order_num;

        const actionsCell = row.insertCell(3);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.addEventListener('click', () => editPhase(phase.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', () => confirmDeletePhase(phase.id));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    });
}
