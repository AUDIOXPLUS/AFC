// Function to check user authentication status
async function checkAuthStatus() {
    try {
        // Make a call to the session verification endpoint
        const response = await fetch('/api/session-user');
        
        // If response is 401 (unauthorized), user is not authenticated
        if (response.status === 401) {
            return false;
        }
        
        // For other errors (e.g., 404, 500), redirect to login
        if (!response.ok) {
            window.location.href = '/login.html';
            return false;
        }

        const data = await response.json();
        
        // If response contains user data (id, username, name), user is authenticated
        if (data.id && data.username && data.name) {
            return true;
        }
        
        // If no valid user data, redirect to login
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
