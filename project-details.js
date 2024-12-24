// Aggiunta di un listener per l'evento DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    window.projectId = urlParams.get('id'); // Dichiarato come variabile globale
    window.currentUserId = null; // Memorizza l'ID utente corrente per le operazioni sui file

    // Recupera e visualizza il nome utente
    try {
        const response = await fetch('/api/session-user');
        const userData = await window.handleResponse(response);
        console.log('userData:', userData);
        if (userData && userData.username) {
            window.currentUserId = String(userData.id);
            if (userData.name) {
                document.querySelector('.user-info span').textContent = `Welcome, ${userData.name}`;
            }
        } else {
            console.error('userData.username is missing or null');
            window.location.href = '/login.html';
            return;
        }
    } catch (error) {
        console.error('Error fetching session user:', error);
        window.location.href = '/login.html';
        return;
    }

    if (projectId) {
        await window.fetchTeamMembers(); // Assicura che teamMembers sia popolato prima
        await window.fetchProjectDetails(projectId);
        await window.fetchProjectPhases(projectId);
    } else {
        console.error('No project ID provided');
    }

    document.getElementById('add-history-btn').addEventListener('click', () => window.addHistoryEntry(projectId));

    window.restoreColumnWidths();
    window.enableColumnResizing();
    window.enableColumnSorting();
});
