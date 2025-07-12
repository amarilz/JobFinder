chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'makeRequest') {
    // Usiamo una funzione asincrona IIFE (Immediately Invoked Function Expression) 
    // per gestire la fetch con async/await
    (async () => {
      try {
        const fetchOptions = {
          method: request.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...request.headers
          },
          body: request.body ? JSON.stringify(request.body) : undefined
        };

        const response = await fetch(`http://localhost:8080${request.endpoint}`, fetchOptions);
        
        // Tentiamo di leggere il corpo della risposta come JSON in ogni caso
        // (sia in caso di successo che di errore HTTP, assumendo che il backend ritorni JSON)
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          // Se la risposta non ha successo (es. status 400, 500), inviamo il JSON del corpo della risposta al content.js.
          sendResponse(responseBody);
          return; 
        }

        // Se la richiesta ha avuto successo (status 200 OK)
        sendResponse({ success: true, data: responseBody });

      } catch (error) {
        // Questo blocco cattura errori di rete (es. server non raggiungibile)
        console.error('Request failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Mantiene la connessione aperta per la risposta asincrona
    return true;
  }
});
