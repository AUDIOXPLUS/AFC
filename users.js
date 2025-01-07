document.addEventListener('DOMContentLoaded', function() {
    initializeUsersPage();
    displayLoggedInUser();
    updateConnectedUsers(); // Aggiorna la lista degli utenti connessi
    // Aggiorna la lista ogni 30 secondi
    setInterval(updateConnectedUsers, 30000);
});

// Funzione per aggiornare la lista degli utenti connessi
async function updateConnectedUsers() {
    try {
        const response = await fetch('/api/connected-users');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users = await response.json();
        
        // Aggiorna la lista degli utenti connessi
        const usersList = document.getElementById('connected-users-list');
        if (usersList) {
            usersList.innerHTML = users.map(user => user.name).join(', ');
        }
    } catch (error) {
        console.error('Errore nel recupero degli utenti connessi:', error);
    }
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

        // Create a clickable link for the role
        const roleCell = row.insertCell(1);
        const roleLink = document.createElement('a');
        roleLink.href = `role-selection.html?memberId=${member.id}`;
        roleLink.textContent = member.role;
        roleCell.appendChild(roleLink);

        row.insertCell(2).textContent = member.email;

        // Cella per il background color
        const bgColorCell = row.insertCell(3);
        const bgColorDiv = document.createElement('div');
        bgColorDiv.style.backgroundColor = member.color;
        bgColorDiv.style.width = '20px';
        bgColorDiv.style.height = '20px';
        bgColorDiv.style.display = 'inline-block';
        bgColorCell.appendChild(bgColorDiv);

        // Cella per il font color
        const fontColorCell = row.insertCell(4);
        const fontColorDiv = document.createElement('div');
        fontColorDiv.style.backgroundColor = member.fontColor;
        fontColorDiv.style.width = '20px';
        fontColorDiv.style.height = '20px';
        fontColorDiv.style.display = 'inline-block';
        fontColorCell.appendChild(fontColorDiv);

        const actionsCell = row.insertCell(5);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editTeamMember(row, member.id));
        actionsCell.appendChild(editBtn);
    });
}

function addTeamMember() {
    const tableBody = document.getElementById('team-members-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['name', 'role', 'email', 'color', 'fontColor'];
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

    const actionsCell = newRow.insertCell(5);
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
        color: row.cells[3].firstChild.value,
        fontColor: row.cells[4].firstChild.value
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
    for (let i = 0; i < 5; i++) {
        const input = document.createElement('input');
        if (i === 3 || i === 4) {
            input.type = 'color'; // Input di tipo color per i colori
            input.value = i === 3 ? memberData.color : memberData.fontColor;
        } else {
            input.type = 'text';
            input.value = cells[i].textContent;
            input.style.backgroundColor = '#ffff99'; // Light yellow background
        }
        cells[i].innerHTML = '';
        cells[i].appendChild(input);
    }

    // Cambia il pulsante Edit in Save
    const actionsCell = cells[5];
    actionsCell.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        const updatedMember = {
            id: memberId, // Includi l'ID nel corpo della richiesta
            name: cells[0].firstChild.value,
            role: cells[1].firstChild.value,
            email: cells[2].firstChild.value,
            color: cells[3].firstChild.value,
            fontColor: cells[4].firstChild.value
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
    const userName = localStorage.getItem('loggedInUser'); // Recupera il nome dell'utente loggato
    if (userName) {
        document.querySelector('.user-info span').textContent = `Welcome, ${userName}`; // Aggiorna il nome nel menu
    } else {
        // Se non c'è un utente loggato, reindirizza al login
        window.location.href = 'login.html';
    }
}

// Aggiungi questa funzione per gestire il login e memorizzare il nome dell'utente
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
