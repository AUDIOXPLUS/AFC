// i18n.js - Gestione internazionalizzazione

// Oggetto per memorizzare le traduzioni caricate
let translations = {};
// Lingua corrente (default: inglese)
let currentLanguage = localStorage.getItem('preferredLanguage') || 'en';

// Funzione per caricare le traduzioni dal backend
async function loadTranslationsFromServer() {
    try {
        const response = await fetch('/api/translations'); // Usa l'endpoint che restituisce la mappa
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        translations = await response.json();
        console.log('Traduzioni caricate dal server:', translations); // Log in italiano
        // Salva le traduzioni in localStorage per uso offline o cache
        localStorage.setItem('translations', JSON.stringify(translations));
        return translations;
    } catch (error) {
        console.error('Errore nel caricamento delle traduzioni dal server:', error); // Log in italiano
        // Prova a caricare dalla cache locale se il fetch fallisce
        const cachedTranslations = localStorage.getItem('translations');
        if (cachedTranslations) {
            console.warn('Caricamento traduzioni dal server fallito, uso la cache locale.'); // Log in italiano
            translations = JSON.parse(cachedTranslations);
            return translations;
        }
        return {}; // Restituisce un oggetto vuoto se non ci sono traduzioni né cache
    }
}

// Funzione per normalizzare il testo prima della traduzione
function normalizeText(text) {
    return text.trim()
        .replace(/:/g, '') // Rimuove i due punti
        .replace(/\s+/g, ' ') // Normalizza spazi multipli
        .toLowerCase(); // Ignora maiuscole/minuscole
}

// Funzione per ottenere la traduzione di una chiave (testo inglese)
function translate(key) {
    if (currentLanguage === 'zh') {
        // Cerca prima la corrispondenza esatta
        if (translations[key]) {
            return translations[key];
        }
        
        // Se non trova, prova con la versione normalizzata
        const normalizedKey = normalizeText(key);
        for (const [en, zh] of Object.entries(translations)) {
            if (normalizeText(en) === normalizedKey) {
                return zh;
            }
        }
    }
    // Se la lingua è inglese o la traduzione non esiste, restituisci la chiave originale
    return key;
}

// Funzione per applicare le traduzioni agli elementi marcati nella pagina
function applyTranslations() {
    console.log(`Applicazione traduzioni per la lingua: ${currentLanguage}`); // Log in italiano
    
    // Traduci elementi con attributo data-translate
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.dataset.translate; // Chiave di traduzione (testo inglese)
        const translatedText = translate(key);

        // Gestisce diversi tipi di elementi
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.placeholder && element.placeholder === key) {
                element.placeholder = translatedText;
            }
            // Potremmo voler tradurre anche 'value' per alcuni input, ma va gestito con cautela
        } else if (element.tagName === 'BUTTON' || element.tagName === 'A' || element.tagName === 'SPAN' || element.tagName === 'LABEL' || element.tagName === 'TH' || element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3' || element.tagName === 'P' || element.tagName === 'LI' || element.tagName === 'DIV' || element.tagName === 'OPTION' || element.tagName === 'TITLE') {
             // Traduce il contenuto testuale, preservando eventuali nodi figli (es. icone <i>)
             // Itera sui nodi figli di tipo testo e aggiornali
             Array.from(element.childNodes).forEach(node => {
                 if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === key) {
                     node.textContent = translatedText;
                 }
             });
             // Fallback: se non trova nodi testo corrispondenti, prova a tradurre textContent (meno preciso)
             if (element.textContent.trim() === key) {
                 element.textContent = translatedText;
             }
        } else {
            // Per altri elementi, traduci il textContent se corrisponde alla chiave
            if (element.textContent.trim() === key) {
                element.textContent = translatedText;
            }
        }

        // Traduce anche l'attributo 'title' se presente e corrisponde alla chiave
        if (element.title && element.title === key) {
            element.title = translatedText;
        }
    });
    
    // Traduci elementi con attributo data-translate-placeholder (per i filtri)
    const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
    placeholderElements.forEach(element => {
        const key = element.dataset.translatePlaceholder; // Chiave di traduzione per il placeholder
        const translatedPlaceholder = translate(key);
        
        // Applica la traduzione al placeholder
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = translatedPlaceholder;
        }
    });

    // Traduci i testi delle checkbox dei filtri e label attivi
    const filterCheckboxes = document.querySelectorAll('.toggle-filters label');
    filterCheckboxes.forEach(label => {
        const key = label.textContent.trim().replace(/\(\d+\)$/, '').trim();
        const translatedText = translate(key);
        if (translatedText !== key) {
            label.innerHTML = label.innerHTML.replace(key, translatedText);
        }
    });

    // Traduci i filtri della project history (dropdown e pulsanti)
    const phaseDropdownBtn = document.getElementById('phase-dropdown-btn');
    const statusDropdownBtn = document.getElementById('status-dropdown-btn');
    
    if (phaseDropdownBtn) {
        const phaseKey = phaseDropdownBtn.textContent.trim();
        const translatedPhase = translate(phaseKey);
        if (translatedPhase !== phaseKey) {
            phaseDropdownBtn.textContent = translatedPhase;
        }
    }
    
    if (statusDropdownBtn) {
        const statusKey = statusDropdownBtn.textContent.trim();
        const translatedStatus = translate(statusKey);
        if (translatedStatus !== statusKey) {
            statusDropdownBtn.textContent = translatedStatus;
        }
    }

    // Traduci le opzioni delle dropdown
    const dropdownOptions = document.querySelectorAll('.dropdown-content label');
    dropdownOptions.forEach(option => {
        const key = option.textContent.trim();
        const translatedText = translate(key);
        if (translatedText !== key) {
            option.textContent = option.textContent.replace(key, translatedText);
        }
    });

    // Traduci il label "Active Projects"
    const activeProjectsLabel = document.querySelector('.active-count-label');
    if (activeProjectsLabel) {
        const key = activeProjectsLabel.textContent.trim().replace(/\(\d+\)$/, '').trim();
        const translatedText = translate(key);
        if (translatedText !== key) {
            activeProjectsLabel.innerHTML = activeProjectsLabel.innerHTML.replace(key, translatedText);
        }
    }

    // Aggiorna l'attributo lang dell'elemento <html>
    document.documentElement.lang = currentLanguage;
    console.log('Traduzioni applicate.'); // Log in italiano

    // Forza il riapplicare le traduzioni dopo un breve delay per elementi dinamici
    setTimeout(() => {
        const dynamicElements = document.querySelectorAll('[data-translate]:not(.translated)');
        dynamicElements.forEach(el => {
            const key = el.dataset.translate;
            const translatedText = translate(key);
            if (translatedText !== key) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.placeholder === key) el.placeholder = translatedText;
                } else {
                    el.textContent = translatedText;
                }
                el.classList.add('translated');
            }
        });

        // Riprocessa le dropdown
        const dropdownButtons = document.querySelectorAll('.dropdown-content button');
        dropdownButtons.forEach(btn => {
            const key = btn.textContent.trim();
            const translatedText = translate(key);
            if (translatedText !== key) {
                btn.textContent = translatedText;
            }
        });
    }, 1000);
}

// Funzione per cambiare la lingua
async function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'zh') {
        console.warn(`Lingua non supportata: ${lang}`); // Log in italiano
        return;
    }
    currentLanguage = lang;
    localStorage.setItem('preferredLanguage', lang); // Salva la preferenza
    // Ricarica le traduzioni se necessario (potrebbero essere cambiate)
    await loadTranslationsFromServer();
    applyTranslations();

    // Aggiorna lo stato del selettore di lingua (se esiste)
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.value = lang;
    }
}

// Funzione per inizializzare il sistema di traduzione
async function initializeI18n() {
    await loadTranslationsFromServer();
    applyTranslations(); // Applica la lingua corrente all'avvio

    // Crea e aggiungi il selettore di lingua all'header (se non esiste già)
    const userInfoDiv = document.querySelector('header .user-info');
    if (userInfoDiv && !document.getElementById('language-selector')) {
        const selector = document.createElement('div');
        selector.className = 'language-selector-container';
        
        const select = document.createElement('select');
        select.id = 'language-selector';
        select.className = 'language-selector';

        // Funzione per verificare il supporto delle emoji (non è perfetta, ma aiuta)
        function isBrowserSupportingEmoji() {
            // Alcuni browser più vecchi hanno problemi con le emoji delle bandiere
            const userAgent = navigator.userAgent.toLowerCase();
            if (userAgent.indexOf('msie') !== -1 || userAgent.indexOf('trident') !== -1) {
                // Internet Explorer ha problemi con molte emoji
                return false;
            }
            // Potrebbe essere esteso con altri controlli se necessario
            return true;
        }

        const useEmoji = isBrowserSupportingEmoji();
        console.log("Browser supporta emoji: " + useEmoji); // Log in italiano

        const optionEn = document.createElement('option');
        optionEn.value = 'en';
        // Usa emoji solo se supportate, altrimenti testo semplice
        optionEn.textContent = useEmoji ? '🇬🇧 EN' : 'EN';
        select.appendChild(optionEn);

        const optionZh = document.createElement('option');
        optionZh.value = 'zh';
        // Usa emoji solo se supportate, altrimenti testo semplice
        optionZh.textContent = useEmoji ? '🇨🇳 CN' : 'CN'; // Cinese semplificato
        select.appendChild(optionZh);

        select.value = currentLanguage; // Imposta la lingua corrente
        selector.appendChild(select);

        selector.addEventListener('change', (event) => {
            setLanguage(event.target.value);
        });

        // Inserisci il selettore prima del link di logout
        const logoutLink = document.getElementById('logout');
        if (logoutLink) {
            userInfoDiv.insertBefore(selector, logoutLink);
        } else {
            userInfoDiv.appendChild(selector); // Fallback se il logout non c'è
        }
    }
}

// Esporta le funzioni necessarie (opzionale, dipende da come viene usato)
// export { initializeI18n, setLanguage, translate };

// Esegui l'inizializzazione quando lo script viene caricato
// Assicurati che il DOM sia pronto se questo script viene caricato nell'head
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeI18n);
} else {
    initializeI18n();
}
