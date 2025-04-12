const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios'); // Assicurati che axios sia installato: npm install axios
const checkAuthentication = require('../middleware/auth'); // Riutilizza il middleware di autenticazione esistente

// Recupera le credenziali Baidu e l'URL dell'API dalle variabili d'ambiente
const BAIDU_APP_ID = process.env.BAIDU_TRANSLATE_APP_ID;
const BAIDU_API_KEY = process.env.BAIDU_TRANSLATE_API_KEY;
const BAIDU_API_URL = 'https://api.fanyi.baidu.com/api/trans/vip/translate';

// Log per debug: Verifica se le variabili d'ambiente sono state caricate
console.log('[DEBUG] Baidu Translate Env Vars:', {
  appId: BAIDU_APP_ID ? 'Loaded' : 'MISSING!',
  apiKey: BAIDU_API_KEY ? 'Loaded' : 'MISSING!'
});
// Fine Log per debug

// Funzione helper per generare l'hash MD5
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Endpoint POST per la traduzione
router.post('/', checkAuthentication, async (req, res) => {
  const { text, fromLang, targetLang } = req.body;

  // Validazione input base
  if (!text || !targetLang) {
    return res.status(400).json({ error: 'Parametri "text" e "targetLang" sono obbligatori.' });
  }

  if (!BAIDU_APP_ID || !BAIDU_API_KEY) {
     console.error('Credenziali Baidu Translate non configurate nelle variabili d\'ambiente.'); // Log in italiano
     return res.status(500).json({ error: 'Servizio di traduzione non configurato correttamente.' });
  }

  const salt = Math.random().toString(); // Genera un salt casuale
  const signStr = BAIDU_APP_ID + text + salt + BAIDU_API_KEY;
  const sign = md5(signStr);

  // Determina la lingua di origine ('auto' se non specificata)
  const from = fromLang || 'auto';

  try {
    console.log(`Tentativo di traduzione da ${from} a ${targetLang} per il testo: "${text.substring(0, 50)}..."`); // Log in italiano

    const response = await axios.get(BAIDU_API_URL, {
      params: {
        q: text,
        from: from,
        to: targetLang,
        appid: BAIDU_APP_ID,
        salt: salt,
        sign: sign,
      },
      // Imposta un timeout per evitare attese infinite
      timeout: 10000 // 10 secondi
    });

    // Controlla la risposta di Baidu per errori specifici
    if (response.data.error_code) {
      console.error(`Errore dall'API Baidu Translate: ${response.data.error_code} - ${response.data.error_msg}`); // Log in italiano
      // Mappa alcuni codici di errore comuni a messaggi più user-friendly se necessario
      let userMessage = `Errore durante la traduzione (Baidu: ${response.data.error_code}).`;
      if (response.data.error_code === '54003') { // Access frequency limited
          userMessage = 'Limite di richieste di traduzione raggiunto. Riprova più tardi.';
      } else if (response.data.error_code === '52003') { // Unauthorized user
          userMessage = 'Configurazione del servizio di traduzione non valida.';
      }
      return res.status(500).json({ error: userMessage });
    }

    // Estrai la traduzione dalla risposta
    if (response.data.trans_result && response.data.trans_result.length > 0) {
      const translatedText = response.data.trans_result[0].dst;
      console.log(`Traduzione riuscita: "${translatedText.substring(0, 50)}..."`); // Log in italiano
      res.json({ translatedText });
    } else {
      console.error('Risposta Baidu non conteneva risultati di traduzione validi:', response.data); // Log in italiano
      res.status(500).json({ error: 'La traduzione non ha prodotto risultati.' });
    }

  } catch (error) {
    console.error('Errore durante la chiamata all\'API Baidu Translate:', error.message); // Log in italiano
    // Controlla se è un errore di timeout
    if (error.code === 'ECONNABORTED') {
         return res.status(504).json({ error: 'Il servizio di traduzione ha impiegato troppo tempo a rispondere.' });
    }
    res.status(500).json({ error: 'Errore di comunicazione con il servizio di traduzione.' });
  }
});

module.exports = router;
