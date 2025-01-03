/**
 * config.js
 * Gestisce gli URL di base per dev e produzione in un singolo punto.
 */

(function() {
    // Esempio di heuristica: se l'host è "localhost", supponiamo dev; altrimenti, supponiamo prod
    const isProd = window.location.hostname !== 'localhost';
  
    // Puoi anche fare un check più sofisticato, oppure usare variabili passate dal server
    // (es. <script> window.NODE_ENV = "<%= process.env.NODE_ENV %>" </script> )
  
    const APP_CONFIG = {
      // URL del backend (dove gira la tua app Node.js)
      BASE_URL: isProd 
        ? 'http://185.250.144.219:3000' 
        : 'http://localhost:3000',
  
      // URL del Document Server OnlyOffice
      DOCS_URL: isProd 
        ? 'http://185.250.144.219:8081' 
        : 'http://localhost:8081'
    };
  
    // Espone l'oggetto a livello globale
    window.APP_CONFIG = APP_CONFIG;
  })();
  