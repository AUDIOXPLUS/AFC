/**
 * File principale per il modulo project-history
 * Importa tutti i moduli e li espone come API globale
 */

// Importa tutti i moduli
import * as Utils from './utils.js';
import * as Filters from './filters.js';
import * as Files from './files.js';
import * as Entries from './entries.js';
import * as Privacy from './privacy.js';

// Definizione dell'API globale
const ProjectHistory = {
    // Funzioni di utilità
    handleNetworkError: Utils.handleNetworkError,
    handleResponse: Utils.handleResponse,
    isOnlyOfficeCompatible: Utils.isOnlyOfficeCompatible,
    normalizeFilePath: Utils.normalizeFilePath,
    
    // Funzioni per i filtri
    enableFiltering: Filters.enableFiltering,
    
    // Funzioni per i file
    fetchEntryFiles: Files.fetchEntryFiles,
    downloadFile: Files.downloadFile,
    deleteFile: Files.deleteFile,
    updateFilesCell: Files.updateFilesCell,
    
    // Funzioni per le voci della cronologia
    fetchProjectHistory: Entries.fetchProjectHistory,
    displayProjectHistory: Entries.displayProjectHistory,
    addHistoryEntry: Entries.addHistoryEntry,
    saveNewHistoryEntry: Entries.saveNewHistoryEntry,
    editHistoryEntry: Entries.editHistoryEntry,
    confirmDelete: Entries.confirmDelete,
    deleteHistoryEntry: Entries.deleteHistoryEntry,
    
    // Funzioni per la privacy
    showSharingModal: Privacy.showSharingModal,
    updatePrivacy: Privacy.updatePrivacy,
    getSharedUsers: Privacy.getSharedUsers
};

// Esponi l'API globale
window.ProjectHistory = ProjectHistory;

// Funzione di inizializzazione
export function initialize(projectId) {
    // Verifica lo stato della connessione
    if (!navigator.onLine) {
        window.location.replace('login.html');
        return;
    }
    
    // Carica i dati necessari con gestione di errori più robusta
    Promise.all([
        // Carica le fasi con gestione degli errori
        fetch('/api/phases')
            .then(response => Utils.handleResponse(response))
            .catch(error => {
                console.error('Errore nel caricamento delle fasi:', error);
                return []; // Restituisce un array vuoto in caso di errore
            }),
            
        // Carica i membri del team con gestione degli errori
        fetch('/api/team-members')
            .then(response => Utils.handleResponse(response))
            .catch(error => {
                console.error('Errore nel caricamento dei membri del team:', error);
                return []; // Restituisce un array vuoto in caso di errore
            }),
            
        // Usa direttamente i dati utente dalla finestra (già caricati da project-details.js)
        new Promise((resolve) => {
            // Verifica se i dati utente sono già disponibili nella finestra
            if (window.currentUserId && window.currentUserName) {
                console.log('Usando dati utente dalla finestra:', {
                    id: window.currentUserId,
                    name: window.currentUserName
                });
                resolve({
                    id: window.currentUserId,
                    name: window.currentUserName
                });
                return;
            }
            
            // Se non ci sono dati nella finestra, prova a recuperarli
            console.log('Tentativo di recupero dati utente...');
            
            // Tenta prima con la session-user (endpoint più probabile)
            fetch('/api/session-user')
                .then(response => {
                    if (!response.ok) throw new Error('Endpoint session-user non disponibile');
                    return response.json();
                })
                .then(data => {
                    console.log('Dati utente recuperati da session-user:', data);
                    resolve(data);
                })
                .catch(error => {
                    console.warn('Primo tentativo fallito:', error);
                    
                    // Se fallisce, prova con users/current
                    fetch('/api/users/current')
                        .then(response => {
                            if (!response.ok) throw new Error('Endpoint users/current non disponibile');
                            return response.json();
                        })
                        .then(data => {
                            console.log('Dati utente recuperati da users/current:', data);
                            resolve(data);
                        })
                        .catch(innerError => {
                            console.error('Recupero dati utente fallito:', innerError);
                            // Usa valori predefiniti come ultima risorsa
                            const defaultUser = {id: '1', name: 'Utente Ospite'};
                            console.log('Usando dati utente predefiniti:', defaultUser);
                            resolve(defaultUser);
                        });
                });
        })
    ])
    .then(([phases, teamMembers, currentUser]) => {
        window.projectPhases = phases;
        window.dispatchEvent(new CustomEvent('phasesLoaded', { detail: phases }));
        window.teamMembers = teamMembers;
        window.currentUserId = currentUser.id;
        window.currentUserName = currentUser.name; // Salva il nome dell'utente corrente
        
        // Crea una mappa dei membri del team per accesso veloce
        window.teamMembersMap = {};
        teamMembers.forEach(member => {
            window.teamMembersMap[member.name] = member;
        });
        
        // Genera classi CSS dinamiche per i membri del team
        generateTeamMemberStyles(teamMembers);
        
        // Inizializza il filtraggio
        Filters.enableFiltering();

        // Carica la cronologia del progetto
        Entries.fetchProjectHistory(projectId);
    })
    .catch(error => Utils.handleNetworkError(error));
}

// Esponi la funzione di inizializzazione
// Funzione per generare classi CSS dinamiche per i membri del team
function generateTeamMemberStyles(teamMembers) {
    console.log('Generazione stili dinamici per i membri del team');
    
    // Crea un elemento style
    const styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.id = 'team-member-styles';
    
    // Rimuovi eventuali stili precedenti
    const existingStyle = document.getElementById('team-member-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // Genera le regole CSS per ogni membro del team
    let styleRules = '';
    teamMembers.forEach(member => {
        if (member.id && member.color) {
            styleRules += `
                .team-member-${member.id} {
                    background-color: ${member.color};
                    color: ${member.fontColor || '#000000'};
                }
            `;
        }
    });
    
    // Aggiungi le regole all'elemento style
    styleElement.textContent = styleRules;
    
    // Aggiungi l'elemento style alla pagina
    document.head.appendChild(styleElement);
    console.log('Stili CSS generati e applicati con successo');
}

export default initialize;
