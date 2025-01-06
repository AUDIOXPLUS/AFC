// Funzione di utilità per gestire gli errori di rete
function handleNetworkError(error) {
    console.error('Network error:', error);
    // Se l'errore è di tipo network (offline) o 401 (non autorizzato)
    if (!navigator.onLine || (error.response && error.response.status === 401)) {
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Verifica lo stato della connessione
    if (!navigator.onLine) {
        window.location.href = 'login.html';
        return;
    }
    // Carica i product kinds dal server
    try {
        const productKinds = await window.handleFetchWithCursor(fetch('/api/product-kinds'));
        window.productKinds = productKinds;
        window.dispatchEvent(new CustomEvent('productKindsLoaded', { detail: productKinds }));
        // Inizializza la pagina solo se siamo nella pagina dei product kinds
        if (document.getElementById('product-kinds-table')) {
            initializeProductKindsPage();
        }
    } catch (error) {
        handleNetworkError(error);
    }
});

function initializeProductKindsPage() {
    document.getElementById('logout').addEventListener('click', function() {
        window.location.href = 'login.html';
    });

    document.getElementById('add-product-kind-btn').addEventListener('click', addProductKind);

    // Carica i product kinds una sola volta
    fetchProductKinds();
}

// Funzione per aggiungere un nuovo product kind
function addProductKind() {
    const tableBody = document.getElementById('product-kinds-table').getElementsByTagName('tbody')[0];
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
        await saveNewProductKind(newRow);
        fetchProductKinds(); // Ricarica la tabella dopo il salvataggio
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

// Funzione per salvare un nuovo product kind
async function saveNewProductKind(row) {
    // Calcola l'ordine massimo attuale per gestire l'inserimento automatico
    // Se non viene specificato un ordine, il nuovo elemento verrà aggiunto alla fine
    const tableBody = document.getElementById('product-kinds-table').getElementsByTagName('tbody')[0];
    const rows = Array.from(tableBody.rows);
    const maxOrder = rows.reduce((max, r) => {
        if (r !== row) {
            const orderNum = parseInt(r.cells[2].textContent || '0');
            return Math.max(max, orderNum);
        }
        return max;
    }, 0);

    // Prepara i dati del nuovo product kind con gestione automatica dell'ordine
    // Se l'utente non specifica un ordine, viene posizionato alla fine della lista
    const newProductKind = {
        name: row.cells[0].firstChild.value,
        description: row.cells[1].firstChild.value,
        // Se non viene specificato un ordine, metti il nuovo elemento alla fine
        order_num: parseInt(row.cells[2].firstChild.value) || maxOrder + 1
    };

    try {
        const savedProductKind = await window.handleFetchWithCursor(
            fetch('/api/product-kinds', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newProductKind),
            })
        );
            
        // Aggiorna la riga con i dati salvati
        row.cells[0].textContent = savedProductKind.name;
        row.cells[1].textContent = savedProductKind.description;
        row.cells[2].textContent = savedProductKind.order_num;
        row.setAttribute('data-product-kind-id', savedProductKind.id);
        
        // Trasforma il pulsante Save in Edit
        const actionsCell = row.cells[3];
        actionsCell.innerHTML = '';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.addEventListener('click', () => editProductKind(savedProductKind.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', () => confirmDeleteProductKind(savedProductKind.id));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
        
        // Rimuovi lo stile di editing
        row.classList.remove('editing');

        // Ricarica la tabella per mostrare l'ordinamento aggiornato
        fetchProductKinds();
    } catch (error) {
        handleNetworkError(error);
    }
}

function editProductKind(productKindId) {
    const row = document.querySelector(`tr[data-product-kind-id="${productKindId}"]`);
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
    saveBtn.addEventListener('click', () => saveEditedProductKind(productKindId, row));
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn');
    cancelBtn.addEventListener('click', () => {
        fetchProductKinds(); // Ricarica i dati originali
    });
    
    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
}

// Funzione per salvare un product kind modificato con gestione dell'ordinamento
async function saveEditedProductKind(productKindId, row) {
    // Calcola l'ordine massimo attuale per gestire il riordinamento automatico
    // Se l'ordine viene modificato, tutti gli elementi verranno riallineati automaticamente
    const tableBody = document.getElementById('product-kinds-table').getElementsByTagName('tbody')[0];
    const rows = Array.from(tableBody.rows);
    const maxOrder = rows.reduce((max, r) => {
        if (r !== row) {
            const orderNum = parseInt(r.cells[2].textContent || '0');
            return Math.max(max, orderNum);
        }
        return max;
    }, 0);

    // Prepara i dati aggiornati con gestione automatica dell'ordine
    // Se l'utente rimuove l'ordine, l'elemento viene spostato alla fine della lista
    const updatedProductKind = {
        name: row.cells[0].firstChild.value,
        description: row.cells[1].firstChild.value,
        // Se non viene specificato un ordine, metti l'elemento alla fine
        order_num: parseInt(row.cells[2].firstChild.value) || maxOrder + 1
    };

    try {
        const savedProductKind = await window.handleFetchWithCursor(
            fetch(`/api/product-kinds/${productKindId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedProductKind),
            })
        );
            
        // Aggiorna la riga con i dati salvati
        row.cells[0].textContent = savedProductKind.name;
        row.cells[1].textContent = savedProductKind.description;
        row.cells[2].textContent = savedProductKind.order_num;
        
        // Ripristina i pulsanti Edit e Delete
        const actionsCell = row.cells[3];
        actionsCell.innerHTML = '';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.addEventListener('click', () => editProductKind(productKindId));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', () => confirmDeleteProductKind(productKindId));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
        
        // Rimuovi lo stile di editing
        row.classList.remove('editing');

        // Ricarica la tabella per mostrare l'ordinamento aggiornato
        fetchProductKinds();
    } catch (error) {
        handleNetworkError(error);
    }
}

// Funzione per confermare l'eliminazione di un product kind
function confirmDeleteProductKind(productKindId) {
    if (confirm("Sei sicuro di voler eliminare questo product kind?")) {
        deleteProductKind(productKindId);
    }
}

// Funzione per eliminare un product kind
async function deleteProductKind(productKindId) {
    try {
        await window.handleFetchWithCursor(
            fetch(`/api/product-kinds/${productKindId}`, {
                method: 'DELETE',
            })
        );
        console.log('Product kind deleted successfully');
        fetchProductKinds(); // Ricarica la lista dei product kinds
    } catch (error) {
        handleNetworkError(error);
    }
}

// Funzione per recuperare i product kinds
async function fetchProductKinds() {
    try {
        let productKinds = await window.handleFetchWithCursor(fetch('/api/product-kinds'));
        // Ordina i product kinds per 'order_num'
        productKinds.sort((a, b) => a.order_num - b.order_num);
        displayProductKinds(productKinds);
        // Espone i product kinds globalmente
        window.productKinds = productKinds;
        // Emette un evento per notificare che i product kinds sono stati caricati
        window.dispatchEvent(new CustomEvent('productKindsLoaded', { detail: productKinds }));
    } catch (error) {
        handleNetworkError(error);
    }
}

function displayProductKinds(productKinds) {
    const tableBody = document.getElementById('product-kinds-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Pulisce le righe esistenti

    productKinds.forEach(productKind => {
        const row = tableBody.insertRow();
        row.setAttribute('data-product-kind-id', productKind.id);
        row.insertCell(0).textContent = productKind.name;
        row.insertCell(1).textContent = productKind.description;
        row.insertCell(2).textContent = productKind.order_num;

        const actionsCell = row.insertCell(3);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        editBtn.addEventListener('click', () => editProductKind(productKind.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.addEventListener('click', () => confirmDeleteProductKind(productKind.id));
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
    });
}
