// Function to check user authentication status
async function checkAuthStatus() {
    try {
        // Make a call to the session verification endpoint
        const response = await fetch('/api/session-user');
        
        // Log per debug
        console.log('Auth check response:', {
            status: response.status,
            ok: response.ok
        });
        
        // If response is 401 (unauthorized), user is not authenticated
        if (response.status === 401) {
            console.log('Auth check: Unauthorized');
            return false;
        }
        
        // For other errors (e.g., 404, 500), redirect to login
        if (!response.ok) {
            console.log('Auth check: Server error');
            window.location.href = '/login.html';
            return false;
        }

        const data = await response.json();
        
        // Log per debug
        console.log('Auth check data:', data);
        
        // If response contains user data (id, username, name), user is authenticated
        if (data.id && data.username && data.name) {
            console.log('Auth check: User authenticated');
            // Salva i dati dell'utente nel localStorage
            localStorage.setItem('user', JSON.stringify(data));
            return true;
        }
        
        // If no valid user data, redirect to login
        console.log('Auth check: Invalid user data');
        window.location.href = '/login.html';
        return false;
    } catch (error) {
        console.error('Errore durante la verifica dell\'autenticazione:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Function to check authentication on page load
async function checkAuthOnLoad() {
    // Don't check auth on login page
    if (window.location.pathname === '/login.html') {
        return;
    }
    
    const isAuthenticated = await checkAuthStatus();
    if (!isAuthenticated) {
        window.location.href = '/login.html';
    }
}

// Export functions for use in other files
window.checkAuthStatus = checkAuthStatus;
window.checkAuthOnLoad = checkAuthOnLoad;

// Check authentication when page loads
document.addEventListener('DOMContentLoaded', checkAuthOnLoad);
