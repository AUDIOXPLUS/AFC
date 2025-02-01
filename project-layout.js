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

window.fetchProjectDetails = async function(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        const project = await window.handleResponse(response);
        window.displayProjectDetails(project);
        await window.fetchProjectHistory(projectId);
    } catch (error) {
        console.error('Error fetching project details:', error);
    }
};

window.displayProjectDetails = function(project) {
    document.getElementById('project-model-number').textContent = project.modelNumber;

    const detailsDiv = document.getElementById('project-details');
    detailsDiv.innerHTML = `
        <p><strong>Factory:</strong> ${project.factory}</p>
        <p><strong>Factory Model Number:</strong> ${project.factoryModelNumber}</p>
        <p><strong>Product Kind:</strong> ${project.productKind}</p>
        <p><strong>Client:</strong> ${project.client}</p>
        <p><strong>Start Date:</strong> ${project.startDate}</p>
        <p><strong>End Date:</strong> ${project.endDate}</p>
        <p><strong>Status:</strong> ${project.status}</p>
    `;
};

window.fetchProjectPhases = async function(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/phases`);
        const phases = await window.handleResponse(response);
        window.displayPhaseSummary(phases);
    } catch (error) {
        console.error('Error fetching project phases:', error);
    }
};

window.displayPhaseSummary = function(phases) {
    const summaryDiv = document.getElementById('phase-summary');
    summaryDiv.innerHTML = '';

    phases.forEach(phase => {
        const phaseElement = document.createElement('div');
        phaseElement.className = 'phase-item';
        phaseElement.innerHTML = `
            <h3>${phase.name}</h3>
            <p>Status: ${phase.status}</p>
            <p>Progress: ${phase.progress}%</p>
        `;
        summaryDiv.appendChild(phaseElement);
    });
};

window.teamMembers = [];
window.fetchTeamMembers = async function() {
    try {
        const response = await fetch('/api/team-members');
        window.teamMembers = await window.handleResponse(response);
    } catch (error) {
        console.error('Error fetching team members:', error);
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
                return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
            });
            sortDirection[columnIndex] = !isAscending;
            rows.forEach(row => table.getElementsByTagName('tbody')[0].appendChild(row));
        });
    }
};
