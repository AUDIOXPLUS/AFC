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

// Funzione per aggiornare gli ordini nel database
async function updateOrderNumbers(startingOrder) {
    try {
        // Ottiene tutti i product kinds
        let productKinds = await window.handleFetchWithCursor(fetch('/api/product-kinds'));
        
        // Ordina i product kinds per order_num
        productKinds.sort((a, b) => a.order_num - b.order_num);
        
        // Filtra solo quelli che devono essere aggiornati (con ordine >= startingOrder)
        const toUpdate = productKinds.filter(pk => pk.order_num >= startingOrder);
        
        // Aggiorna gli ordini in sequenza
        for (let i = 0; i < toUpdate.length; i++) {
            const pk = toUpdate[i];
            const newOrder = startingOrder + i + 1; // +1 perché startingOrder sarà occupato dal nuovo elemento
            
            await window.handleFetchWithCursor(
                fetch(`/api/product-kinds/${pk.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...pk,
                        order_num: newOrder
                    }),
                })
            );
        }
    } catch (error) {
        console.error('Errore nell\'aggiornamento degli ordini:', error);
        throw error;
    }
}

// Funzione per salvare un nuovo product kind
async function saveNewProductKind(row) {
    const requestedOrder = parseInt(row.cells[2].firstChild.value);
    
    // Prepara i dati del nuovo product kind
    const newProductKind = {
        name: row.cells[0].firstChild.value,
        description: row.cells[1].firstChild.value,
        order_num: requestedOrder
    };

    try {
        // Se è stato specificato un ordine, aggiorna gli ordini esistenti
        if (requestedOrder) {
            await updateOrderNumbers(requestedOrder);
        } else {
            // Se non è stato specificato un ordine, mettilo alla fine
            const productKinds = await window.handleFetchWithCursor(fetch('/api/product-kinds'));
            const maxOrder = Math.max(...productKinds.map(pk => pk.order_num), 0);
            newProductKind.order_num = maxOrder + 1;
        }

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

        // Mostra un feedback visivo di successo
        const feedback = document.createElement('div');
        feedback.textContent = 'Record salvato con successo';
        feedback.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px; border-radius: 4px; z-index: 1000;';
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 3000);

        // Ricarica la tabella per mostrare l'ordinamento aggiornato
        fetchProductKinds();
    } catch (error) {
        handleNetworkError(error);
        // Mostra un feedback visivo di errore
        const feedback = document.createElement('div');
        feedback.textContent = 'Errore nel salvataggio del record';
        feedback.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 10px; border-radius: 4px; z-index: 1000;';
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 3000);
    }
}

function editProductKind(productKindId) {
    console.log('Editing product kind with ID:', productKindId);
    const row = document.querySelector(`tr[data-product-kind-id="${productKindId}"]`);
    if (!row) {
        console.error('Row not found for product kind ID:', productKindId);
        return;
    }
    
    row.classList.add('editing');
    const cells = row.cells;

    // Salva i valori originali come attributi della riga per il ripristino
    row.setAttribute('data-original-name', cells[0].textContent);
    row.setAttribute('data-original-description', cells[1].textContent);
    row.setAttribute('data-original-order', cells[2].textContent);

    ['name', 'description', 'order'].forEach((field, index) => {
        const currentValue = cells[index].textContent.trim();
        console.log(`Setting ${field} input with value:`, currentValue);
        const input = document.createElement('input');
        input.type = field === 'order' ? 'number' : 'text';
        input.value = currentValue;
        input.name = field; // Aggiungi il nome del campo
        cells[index].textContent = '';
        cells[index].appendChild(input);
    });

    const actionsCell = cells[3];
    actionsCell.innerHTML = '';
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.classList.add('save-btn');
    saveBtn.onclick = () => {
        console.log('Save button clicked for product kind ID:', productKindId);
        saveEditedProductKind(productKindId, row);
    };
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.add('cancel-btn');
    cancelBtn.onclick = () => {
        console.log('Cancel button clicked, restoring original values');
        // Ripristina i valori originali
        cells[0].textContent = row.getAttribute('data-original-name');
        cells[1].textContent = row.getAttribute('data-original-description');
        cells[2].textContent = row.getAttribute('data-original-order');
        row.classList.remove('editing');
        
        // Ripristina i pulsanti originali
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
    };
    
    actionsCell.appendChild(saveBtn);
    actionsCell.appendChild(cancelBtn);
}

// Funzione per salvare un product kind modificato con gestione dell'ordinamento
async function saveEditedProductKind(productKindId, row) {
    try {
        console.log('Inizio saveEditedProductKind per ID:', productKindId);
        
        // Prepara i dati aggiornati
        const updatedProductKind = {
            id: productKindId,
            name: row.cells[0].firstChild.value,
            description: row.cells[1].firstChild.value,
            order_num: parseInt(row.cells[2].firstChild.value)
        };

        console.log('Dati da inviare al server:', updatedProductKind);

        // Salva le modifiche
        const response = await window.handleFetchWithCursor(
            fetch(`/api/product-kinds/${productKindId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedProductKind),
            })
        );

        console.log('Dati salvati ricevuti dal server:', response);
        
        if (!response || !response.id) {
            throw new Error('Errore nel salvataggio dei dati: dati mancanti nella risposta');
        }

        const savedProductKind = response;

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

// Funzione per aggiornare gli ordini dopo l'eliminazione
async function updateOrdersAfterDelete(deletedOrder) {
    try {
        // Ottiene tutti i product kinds
        let productKinds = await window.handleFetchWithCursor(fetch('/api/product-kinds'));
        
        // Ordina i product kinds per order_num
        productKinds.sort((a, b) => a.order_num - b.order_num);
        
        // Filtra solo quelli che devono essere aggiornati (con ordine > deletedOrder)
        const toUpdate = productKinds.filter(pk => pk.order_num > deletedOrder);
        
        // Aggiorna gli ordini in sequenza
        for (let i = 0; i < toUpdate.length; i++) {
            const pk = toUpdate[i];
            const newOrder = deletedOrder + i; // Sposta indietro di una posizione
            
            await window.handleFetchWithCursor(
                fetch(`/api/product-kinds/${pk.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...pk,
                        order_num: newOrder
                    }),
                })
            );
        }
    } catch (error) {
        console.error('Errore nell\'aggiornamento degli ordini dopo eliminazione:', error);
        throw error;
    }
}

// Funzione per eliminare un product kind
async function deleteProductKind(productKindId) {
    try {
        // Elimina l'elemento
        const responseText = await window.handleFetchWithCursor(
            fetch(`/api/product-kinds/${productKindId}`, {
                method: 'DELETE',
            })
        );
        
        if (responseText === 'Product kind eliminato con successo') {
            // Forza il refresh della tabella
            const tableBody = document.getElementById('product-kinds-table').getElementsByTagName('tbody')[0];
            tableBody.innerHTML = '';
            
            // Ricarica i dati
            await fetchProductKinds();
            
            // Mostra un feedback visivo temporaneo
            const feedback = document.createElement('div');
            feedback.textContent = 'Record eliminato con successo';
            feedback.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px; border-radius: 4px; z-index: 1000;';
            document.body.appendChild(feedback);
            setTimeout(() => feedback.remove(), 3000); // Rimuove il feedback dopo 3 secondi
        } else {
            throw new Error('Errore durante l\'eliminazione del record');
        }
    } catch (error) {
        handleNetworkError(error);
        console.error('Errore durante l\'eliminazione:', error);
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
