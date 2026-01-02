// Espone le funzioni globalmente attraverso l'oggetto window
window.handleResponse = async function(response) {
    console.log('Response status:', response.status);
    if (response.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    try {
        return await response.json();
    } catch (error) {
        console.error('Error parsing JSON:', error);
        throw new Error('Invalid JSON response');
    }
};

window.saveColumnWidths = function() {
    const table = document.getElementById('history-table');
    const headerCells = table.getElementsByTagName('th');
    const columnWidths = Array.from(headerCells).map(cell => cell.style.width);
    localStorage.setItem('historyColumnWidths', JSON.stringify(columnWidths));
};

window.restoreColumnWidths = function() {
    const columnWidths = JSON.parse(localStorage.getItem('historyColumnWidths'));
    if (columnWidths) {
        const table = document.getElementById('history-table');
        const headerCells = table.getElementsByTagName('th');
        columnWidths.forEach((width, index) => {
            if (headerCells[index]) {
                headerCells[index].style.width = width;
            }
        });
    }
};

window.enableColumnResizing = function() {
    const table = document.getElementById('history-table');
    const headerCells = table.getElementsByTagName('th');

    for (let i = 0; i < headerCells.length; i++) {
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        resizer.style.width = '5px';
        resizer.style.height = '100%';
        resizer.style.position = 'absolute';
        resizer.style.right = '0';
        resizer.style.top = '0';
        resizer.style.cursor = 'col-resize';
        resizer.style.userSelect = 'none';

        headerCells[i].style.position = 'relative';
        headerCells[i].appendChild(resizer);

        let startX, startWidth;

        resizer.addEventListener('mousedown', function(e) {
            startX = e.pageX;
            startWidth = headerCells[i].offsetWidth;
            document.addEventListener('mousemove', resizeColumn);
            document.addEventListener('mouseup', stopResize);
        });

        function resizeColumn(e) {
            const newWidth = startWidth + (e.pageX - startX);
            headerCells[i].style.width = newWidth + 'px';
            window.saveColumnWidths();
        }

        function stopResize() {
            document.removeEventListener('mousemove', resizeColumn);
            document.removeEventListener('mouseup', stopResize);
        }
    }
};

window.enableColumnSorting = function() {
    const table = document.getElementById('history-table');
    const headers = table.getElementsByTagName('th');
    let sortDirection = Array(headers.length).fill(true); // true per ascendente, false per discendente

    for (let i = 0; i < headers.length - 1; i++) { // Esclude l'ultima colonna (Actions)
        headers[i].addEventListener('click', function() {
            const columnIndex = i;
            const rows = Array.from(table.getElementsByTagName('tbody')[0].rows);
            const isAscending = sortDirection[columnIndex];

            // Rimuovi la classe sorted da tutti gli header
            Array.from(headers).forEach(header => header.classList.remove('sorted'));
            // Aggiungi la classe sorted all'header corrente
            headers[columnIndex].classList.add('sorted');

            rows.sort((a, b) => {
                const aText = a.cells[columnIndex].textContent.trim();
                const bText = b.cells[columnIndex].textContent.trim();
                
                // Per la colonna Date (index 0), utilizziamo un ordinamento speciale
                if (columnIndex === 0) {
                    // Prima confronta le date
                    const dateA = new Date(aText);
                    const dateB = new Date(bText);
                    
                    // Se le date sono diverse, ordina per data
                    if (dateA.getTime() !== dateB.getTime()) {
                        return isAscending ? dateA - dateB : dateB - dateA;
                    }
                    
                    // Se le date sono uguali, ordina per ID (mantenendo l'ordine originale)
                    const idA = parseInt(a.getAttribute('data-entry-id'));
                    const idB = parseInt(b.getAttribute('data-entry-id'));
                    
                    // Ordine decrescente per ID (i più recenti prima) se le date sono uguali
                    return isAscending ? idA - idB : idB - idA;
                }
                
                // Per le altre colonne, utilizziamo il confronto lessicografico standard
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });
            
            sortDirection[columnIndex] = !isAscending;
            rows.forEach(row => table.getElementsByTagName('tbody')[0].appendChild(row));
        });
    }
};
