document.addEventListener('DOMContentLoaded', function() {
    initializeUsersPage();
    displayLoggedInUser();
    initializeNotifications(); // Inizializza le notifiche
});

// Funzione per ottenere il conteggio dei task nuovi
async function fetchNewTasksCount() {
    try {
        const response = await fetch('/api/tasks/new-count');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.count;
    } catch (error) {
        console.error('Error fetching new tasks count:', error);
        return 0;
    }
}

// Funzione per aggiornare il contatore delle notifiche
async function updateNotificationCount() {
    const bell = document.getElementById('notification-bell');
    if (!bell) return;

    const notificationCount = bell.querySelector('.notification-count');
    if (!notificationCount) return;

    const count = await fetchNewTasksCount();
    if (count > 0) {
        notificationCount.textContent = count;
        notificationCount.style.display = 'block';
        bell.classList.add('has-notifications');
    } else {
        notificationCount.style.display = 'none';
        bell.classList.remove('has-notifications');
    }
}

// Funzione per inizializzare le notifiche
function initializeNotifications() {
    const bell = document.getElementById('notification-bell');
    if (bell) {
        bell.addEventListener('click', () => {
            // Reindirizza alla pagina tasks.html con un parametro che indica di aprire le notifiche
            window.location.href = 'tasks.html?openNotifications=true';
        });
    }
    // Aggiorna il contatore delle notifiche ogni minuto
    updateNotificationCount();
    setInterval(updateNotificationCount, 60000);
}

function initializeUsersPage() {
    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            localStorage.removeItem('loggedInUser'); // Rimuove il nome dell'utente
            window.location.href = 'login.html';
        });
    }

    const addMemberBtn = document.getElementById('add-member-btn');
    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', addTeamMember);
    }

    const teamMembersTable = document.getElementById('team-members-table');
    if (teamMembersTable) {
        fetchTeamMembers();
    }
}

async function fetchTeamMembers() {
    try {
        const response = await fetch('/api/team-members');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const teamMembers = await response.json();
        displayTeamMembers(teamMembers);
    } catch (error) {
        console.error('Error fetching team members:', error);
    }
}

function displayTeamMembers(teamMembers) {
    const tableBody = document.getElementById('team-members-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Cancella le righe esistenti

    teamMembers.forEach(member => {
        const row = tableBody.insertRow();
        row.dataset.memberId = member.id; // Memorizza memberId come data attribute
        row.dataset.color = member.color; // Memorizza il colore come data attribute
        row.dataset.fontColor = member.fontColor; // Memorizza il colore del font come data attribute

        row.insertCell(0).textContent = member.name;

        // Cella per il ruolo
        const roleCell = row.insertCell(1);
        roleCell.textContent = member.role;

        row.insertCell(2).textContent = member.email;
        row.insertCell(3).textContent = member.factory;
        row.insertCell(4).textContent = member.client_company_name;

        // Cella per il background color
        const bgColorCell = row.insertCell(5);
        const bgColorDiv = document.createElement('div');
        bgColorDiv.style.backgroundColor = member.color;
        bgColorDiv.style.width = '20px';
        bgColorDiv.style.height = '20px';
        bgColorDiv.style.display = 'inline-block';
        bgColorCell.appendChild(bgColorDiv);

        // Cella per il font color
        const fontColorCell = row.insertCell(6);
        const fontColorDiv = document.createElement('div');
        fontColorDiv.style.backgroundColor = member.fontColor;
        fontColorDiv.style.width = '20px';
        fontColorDiv.style.height = '20px';
        fontColorDiv.style.display = 'inline-block';
        fontColorCell.appendChild(fontColorDiv);

        const actionsCell = row.insertCell(7);
        
        // Pulsante Edit
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.addEventListener('click', () => editTeamMember(row, member.id));
        actionsCell.appendChild(editBtn);

        // Pulsante CRUD con verifica diretta del permesso 17
        const crudBtn = document.createElement('button');
        crudBtn.textContent = 'CRUD';
        crudBtn.className = 'crud-btn';
        crudBtn.addEventListener('click', async () => {
            try {
                // Verifica i permessi dell'utente corrente
                const response = await fetch('/api/session-user');
                const currentUser = await response.json();
                
                // Verifica se l'utente corrente ha il permesso 17
                const permResponse = await fetch(`/api/team-members/${currentUser.id}/crud-permissions`);
                const permissions = await permResponse.json();
                
                // Cerca il permesso CRUD (ID 17)
                if (permissions.CRUD && permissions.CRUD.read && permissions.CRUD.read.enabled) {
                    window.location.href = `crud.html?memberId=${member.id}`;
                } else {
                    alert('You do not have permission to access the CRUD page');
                }
            } catch (error) {
                console.error('Error checking permissions:', error);
                alert('Error checking permissions');
            }
        });
        actionsCell.appendChild(crudBtn);

        // Pulsante Delete
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => deleteTeamMember(member.id));
        actionsCell.appendChild(deleteBtn);

        // Aggiungi spazio tra i pulsanti
        actionsCell.style.whiteSpace = 'nowrap';
        actionsCell.style.minWidth = '200px';
    });
}

function addTeamMember() {
    const tableBody = document.getElementById('team-members-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['name', 'role', 'email', 'factory', 'client_company_name', 'color', 'fontColor'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        if (field === 'color' || field === 'fontColor') {
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.name = field;
            cell.appendChild(colorInput);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            input.style.backgroundColor = '#ffff99'; // Light yellow background
            cell.appendChild(input);
        }
    });

    const actionsCell = newRow.insertCell(7);
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => saveNewTeamMember(newRow));
    actionsCell.appendChild(saveBtn);
}

async function saveNewTeamMember(row) {
    const newMember = {
        name: row.cells[0].firstChild.value,
        role: row.cells[1].firstChild.value,
        email: row.cells[2].firstChild.value,
        factory: row.cells[3].firstChild.value,
        client_company_name: row.cells[4].firstChild.value,
        color: row.cells[5].firstChild.value,
        fontColor: row.cells[6].firstChild.value
    };

    try {
        const response = await fetch('/api/team-members', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newMember),
        });

        if (response.ok) {
            console.log('Team member added successfully');
            fetchTeamMembers(); // Aggiorna la lista dei membri del team
        } else {
            console.error('Failed to add team member');
        }
    } catch (error) {
        console.error('Error adding team member:', error);
    }
}

function editTeamMember(row, memberId) {
    const cells = row.getElementsByTagName('td');
    const memberData = {
        name: cells[0].textContent,
        role: cells[1].textContent,
        email: cells[2].textContent,
        color: row.dataset.color, // Usa il valore hex del colore memorizzato
        fontColor: row.dataset.fontColor // Usa il valore hex del colore del font memorizzato
    };

    // Converte le celle in campi input
    for (let i = 0; i < 7; i++) {
        const input = document.createElement('input');
        if (i === 5 || i === 6) {
            input.type = 'color'; // Input di tipo color per i colori
            input.value = i === 5 ? memberData.color : memberData.fontColor;
        } else {
            input.type = 'text';
            input.value = cells[i].textContent;
            input.style.backgroundColor = '#ffff99'; // Light yellow background
        }
        cells[i].innerHTML = '';
        cells[i].appendChild(input);
    }

    // Cambia il pulsante Edit in Save
    const actionsCell = cells[7];
    actionsCell.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        const updatedMember = {
            id: memberId, // Includi l'ID nel corpo della richiesta
            name: cells[0].firstChild.value,
            role: cells[1].firstChild.value,
            email: cells[2].firstChild.value,
            factory: cells[3].firstChild.value,
            client_company_name: cells[4].firstChild.value,
            color: cells[5].firstChild.value,
            fontColor: cells[6].firstChild.value
        };

        console.log('Updated Member Data:', updatedMember); // Per debugging

        try {
            const response = await fetch(`/api/team-members/${memberId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedMember),
            });

            if (response.ok) {
                console.log('Team member updated successfully');
                fetchTeamMembers(); // Aggiorna la lista dei membri del team
            } else {
                const errorText = await response.text();
                console.error('Failed to update team member:', response.status, errorText);
            }
        } catch (error) {
            console.error('Error updating team member:', error);
        }
    });
    actionsCell.appendChild(saveBtn);
}

function displayLoggedInUser() {
    // Recupera i dati dell'utente dal localStorage
    const userDataStr = localStorage.getItem('user');
    if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        // Aggiorna il nome nel menu
        const userSpan = document.querySelector('.user-info span');
        if (userSpan) {
            // Rimosso "Welcome, " dal testo
            userSpan.textContent = `${userData.name}`;
        }
    }
}

async function deleteTeamMember(memberId) {
    try {
        // Prima controlla se l'utente ha tasks assegnati
        const tasksResponse = await fetch(`/api/team-members/${memberId}/tasks`);
        if (!tasksResponse.ok) {
            throw new Error(`HTTP error! status: ${tasksResponse.status}`);
        }
        const tasks = await tasksResponse.json();
        
        if (tasks.length > 0) {
            alert('Cannot delete this user because they have assigned tasks.');
            return;
        }

        // Se non ci sono tasks, procedi con l'eliminazione
        const deleteResponse = await fetch(`/api/team-members/${memberId}`, {
            method: 'DELETE'
        });

        if (deleteResponse.ok) {
            console.log('Team member deleted successfully');
            fetchTeamMembers(); // Aggiorna la lista dei membri del team
        } else {
            const errorText = await deleteResponse.text();
            console.error('Failed to delete team member:', deleteResponse.status, errorText);
            alert('Error deleting user.');
        }
    } catch (error) {
        console.error('Error deleting team member:', error);
        alert('Error deleting user.');
    }
}

async function handleLogin(username, password) {
    const response = await fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
        const data = await response.json();
        localStorage.setItem('loggedInUser', data.name); // Memorizza il nome dell'utente
        window.location.href = 'projects.html'; // Reindirizza alla pagina dei progetti
    } else {
        console.error('Login failed');
    }
}
