document.addEventListener('DOMContentLoaded', function() {
    initializeUsersPage();
    displayLoggedInUser(); // Aggiungi questa funzione per visualizzare l'utente loggato
});

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

        row.insertCell(0).textContent = member.name;

        // Create a clickable link for the role
        const roleCell = row.insertCell(1);
        const roleLink = document.createElement('a');
        roleLink.href = `role-selection.html?memberId=${member.id}`;
        roleLink.textContent = member.role;
        roleCell.appendChild(roleLink);

        row.insertCell(2).textContent = member.email;

        const colorCell = row.insertCell(3);
        const colorDiv = document.createElement('div');
        colorDiv.style.backgroundColor = member.color;
        colorDiv.style.width = '20px';
        colorDiv.style.height = '20px';
        colorDiv.style.display = 'inline-block';
        colorCell.appendChild(colorDiv);

        const actionsCell = row.insertCell(4);
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editTeamMember(row, member.id));
        actionsCell.appendChild(editBtn);
    });
}

function addTeamMember() {
    const tableBody = document.getElementById('team-members-table').getElementsByTagName('tbody')[0];
    const newRow = tableBody.insertRow(0);

    const fields = ['name', 'role', 'email', 'color'];
    fields.forEach((field, index) => {
        const cell = newRow.insertCell(index);
        if (field === 'color') {
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

    const actionsCell = newRow.insertCell(4);
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
        color: row.cells[3].firstChild.value
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
        color: row.dataset.color // Usa il valore hex del colore memorizzato
    };

    // Converte le celle in campi input
    for (let i = 0; i < 4; i++) {
        const input = document.createElement('input');
        if (i === 3) {
            input.type = 'color'; // Input di tipo color per il colore
            input.value = memberData.color;
        } else {
            input.type = 'text';
            input.value = cells[i].textContent;
            input.style.backgroundColor = '#ffff99'; // Light yellow background
        }
        cells[i].innerHTML = '';
        cells[i].appendChild(input);
    }

    // Cambia il pulsante Edit in Save
    const actionsCell = cells[4];
    actionsCell.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async function() {
        const updatedMember = {
            id: memberId, // Includi l'ID nel corpo della richiesta
            name: cells[0].firstChild.value,
            role: cells[1].firstChild.value,
            email: cells[2].firstChild.value,
            color: cells[3].firstChild.value
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
