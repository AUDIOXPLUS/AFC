/**
 * Modulo per la gestione dei filtri della tabella della cronologia
 * Contiene funzioni per filtrare le righe della tabella in base a vari criteri
 */

// Variabile globale per mantenere il riferimento alle funzioni di filtering
let filteringApi = null;

/**
 * Abilita il filtraggio live sulla tabella della cronologia
 */
export function enableFiltering() {
    const textFilterInputs = document.querySelectorAll('.filters input[type="text"]');
    const statusDropdownBtn = document.getElementById('status-dropdown-btn');
    const statusDropdown = document.getElementById('status-filter');
    const statusCheckboxes = statusDropdown.querySelectorAll('input[type="checkbox"]');
    const tableRows = document.getElementById('history-table').getElementsByTagName('tbody')[0].rows;

    // Apertura/chiusura dropdown
    statusDropdownBtn.addEventListener('click', function() {
        statusDropdown.classList.toggle('show');
    });

    // Chiudi dropdown quando si clicca fuori
    document.addEventListener('click', function(event) {
        if (!event.target.matches('#status-dropdown-btn') && !event.target.closest('.dropdown-content')) {
            statusDropdown.classList.remove('show');
        }
    });

    function applyFilters() {
        const textFilterValues = Array.from(textFilterInputs).map(input => input.value.toLowerCase().trim());
        const selectedStatuses = Array.from(statusCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.getAttribute('data-status-value') || cb.value);

        // Aggiorna lo stile dei filtri attivi
        textFilterInputs.forEach(input => {
            input.classList.toggle('filter-active', input.value.trim() !== '');
        });

        statusDropdownBtn.classList.toggle('filter-active', selectedStatuses.length > 0);

        Array.from(tableRows).forEach(row => {
            let isMatch = true;

            // Filtra per descrizione
            if (textFilterValues[0] && !row.cells[2].textContent.toLowerCase().includes(textFilterValues[0])) {
                isMatch = false;
            }

            // Filtra per assigned to
            if (textFilterValues[1] && !row.cells[3].textContent.toLowerCase().includes(textFilterValues[1])) {
                isMatch = false;
            }

            // Filtra per status
            if (selectedStatuses.length > 0) {
                const statusCell = row.cells[4];
                // Usa il valore originale in inglese salvato nell'attributo data-status
                // invece del testo tradotto visibile nell'interfaccia
                const statusText = statusCell.getAttribute('data-status') || statusCell.textContent.trim();
                if (!selectedStatuses.includes(statusText)) {
                    isMatch = false;
                }
            }

            row.style.display = isMatch ? '' : 'none';
        });
    }

    // Event listeners per i filtri
    textFilterInputs.forEach(input => {
        input.addEventListener('input', applyFilters);
    });

    statusCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });

    // Salva il riferimento globale
    filteringApi = { 
        applyFilters,
        resetFilters: function() {
            // Resetta i filtri di testo
            textFilterInputs.forEach(input => {
                input.value = '';
                input.classList.remove('filter-active');
            });
            
            // Resetta i filtri di stato
            statusCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            statusDropdownBtn.classList.remove('filter-active');
            
            // Applica i filtri (mostra tutte le righe)
            applyFilters();
        }
    };
    
    // Esponi l'API di filtraggio globalmente
    window.filteringApi = filteringApi;
    
    return filteringApi;
}

// Esporta l'API di filtraggio
export { filteringApi };
