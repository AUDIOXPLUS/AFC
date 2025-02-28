/**
 * Script per gestire il menu mobile richiudibile
 */
document.addEventListener('DOMContentLoaded', function() {
    // Aggiungi il pulsante di toggle e il contenitore del menu
    setupMobileMenu();
    
    // Inizializza il comportamento del menu
    initMobileMenu();
});

/**
 * Aggiunge gli elementi necessari per il menu mobile richiudibile
 */
function setupMobileMenu() {
    // Verifica se siamo su mobile
    if (window.innerWidth <= 768) {
        const header = document.querySelector('header');
        const nav = document.querySelector('nav');
        const logo = document.querySelector('.logo');
        
        // Crea il pulsante di toggle
        if (!document.querySelector('.menu-toggle')) {
            const toggleButton = document.createElement('button');
            toggleButton.className = 'menu-toggle';
            toggleButton.innerHTML = '<i class="fas fa-bars"></i>';
            toggleButton.setAttribute('aria-label', 'Toggle menu');
            
            // Crea il contenitore per il logo
            const logoContainer = document.createElement('div');
            logoContainer.className = 'logo-container';
            
            // Sposta il logo nel suo contenitore
            if (logo && logo.parentNode) {
                logo.parentNode.insertBefore(logoContainer, logo);
                logoContainer.appendChild(logo);
            }
            
            // Crea il contenitore per il menu
            const menuContainer = document.createElement('div');
            menuContainer.className = 'menu-container';
            
            // Sposta gli elementi del nav nel contenitore del menu
            if (nav) {
                const navUl = nav.querySelector('ul');
                const userInfo = document.querySelector('.user-info');
                
                // Avvolgi gli elementi del menu nel contenitore
                if (navUl && navUl.parentNode === nav) {
                    nav.removeChild(navUl);
                    menuContainer.appendChild(navUl);
                }
                
                // Sposta le informazioni utente nel contenitore del menu
                if (userInfo && userInfo.parentNode === header) {
                    header.removeChild(userInfo);
                    menuContainer.appendChild(userInfo);
                }
                
                // Aggiungi il contenitore del menu all'header
                header.appendChild(menuContainer);
            }
            
            // Aggiungi il pulsante di toggle all'header
            header.insertBefore(toggleButton, header.firstChild);
        }
    }
}

/**
 * Inizializza il comportamento del menu mobile
 */
function initMobileMenu() {
    const toggleButton = document.querySelector('.menu-toggle');
    const menuContainer = document.querySelector('.menu-container');
    
    if (toggleButton && menuContainer) {
        // Gestisci il click sul pulsante di toggle
        toggleButton.addEventListener('click', function() {
            // Cambia l'icona del pulsante
            const icon = toggleButton.querySelector('i');
            if (icon) {
                if (icon.classList.contains('fa-bars')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
            
            // Mostra/nascondi il menu
            menuContainer.classList.toggle('show');
        });
        
        // Nascondi il menu quando si clicca su un link
        const menuLinks = menuContainer.querySelectorAll('a');
        menuLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                menuContainer.classList.remove('show');
                
                // Ripristina l'icona del pulsante
                const icon = toggleButton.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            });
        });
        
        // Gestisci il ridimensionamento della finestra
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                // Su desktop, nascondi il pulsante di toggle e mostra sempre il menu
                toggleButton.style.display = 'none';
                menuContainer.classList.add('show');
            } else {
                // Su mobile, mostra il pulsante di toggle e nascondi il menu
                toggleButton.style.display = 'block';
                menuContainer.classList.remove('show');
            }
        });
        
        // Inizializza lo stato del menu in base alla dimensione della finestra
        if (window.innerWidth > 768) {
            toggleButton.style.display = 'none';
            menuContainer.classList.add('show');
        } else {
            toggleButton.style.display = 'block';
            // Inizialmente nascondi il menu su mobile
            menuContainer.classList.remove('show');
        }
    }
}
