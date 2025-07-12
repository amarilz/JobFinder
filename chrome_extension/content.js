const CONFIG = {
    logPrefix: '[FE-JOBFINDER]',
    debounceDelay: 200,
    apiEndpointNewJob: '/be-jobfinder/api/v1/job',
    apiEndpointGetConfig: '/be-jobfinder/api/v1/config'
};

const STYLE_CONFIG = {
    NEW: {
        bgColor: '#99EB99',
        opacity: '1.0'
    },
    TOO_MANY_CANDIDATES: {
        bgColor: '#DE5959',
        opacity: '0.1'
    },
    UNSUITABLE_LANGUAGE: {
        bgColor: '#DE5959',
        opacity: '0.5' // to check
    },
    ALREADY_SEEN: {
        bgColor: '#FFD966',
        opacity: '0.5'
    }
};

// override log
const originalConsoleLog = console.log;
console.log = function(...args) { // ridefinisci console log
    originalConsoleLog.apply(console, [CONFIG.logPrefix, ...args]);
};

class JobFinder {
    constructor() {
        this.lastJobKey = null;
        this.isAnalyzing = false;
        this.debounceTimer = null;

        this.htmlSelectors = {};
        this.positiveKeywords = [];
        this.negativeKeywords = [];
    }

    async init() {
        if (!window.location.pathname.includes('/jobs/')) {
            console.log('Non è una pagina di job, estensione non attiva.');
            return;
        }

        console.log('Inizializzazione JobFinder...');
        try {
            await this.loadConfiguration();
            await this.analyzeJob();
            this.initObserver(); // start observer
            console.log('JobAnalyzer inizializzato con successo');
        } catch (error) {
            console.error('Errore nell\'inizializzazione:', error);
        }
    }

    async loadConfiguration() {
        const configData = await this.makeGetRequest(CONFIG.apiEndpointGetConfig);
        if (!configData?.htmlSelector) {
            console.error('Configurazione non valida:', configData);
            return;
        }

        this.htmlSelectors = configData.htmlSelector;
        this.positiveKeywords = configData.positiveKeyword || [];
        this.negativeKeywords = configData.negativeKeyword || [];

        console.log("Configurazione caricata:", configData);
    }

    extractJobData() {
        const getText = (selector, label = '') => {
            const el = document.querySelector(selector);
            if (!el && label) console.warn(`Elemento non trovato: ${label}`);
            return el?.textContent?.trim() || '';
        };

        const jobData = {
            originWebsite: window.location.hostname, // current domain
            company: getText(this.htmlSelectors.company, 'company'),
            location: getText(this.htmlSelectors.location, 'location'),
            title: getText(this.htmlSelectors.title, 'title'),
            candidates: getText(this.htmlSelectors.candidates, 'candidates'),
            body: getText(this.htmlSelectors.body, 'body'),
            postedDate: getText(this.htmlSelectors.postedDate, 'postedDate')
        };

        if (!jobData.title || !jobData.company) {
            throw new Error('Non sono riuscito a recuperare i dati di questa job post');
        }

        return jobData;
    }

    generateJobKey({ company, title, location }) {
        return `[${company}|${title}|${location}]`.toLowerCase();
    }

    async analyzeJob() {
        if (this.isAnalyzing) {
            console.log('Analisi già in corso, skip...');
            return;
        }

        this.isAnalyzing = true;
        let jobData;

        try {
            jobData = this.extractJobData();
            const jobKey = this.generateJobKey(jobData);

            if (jobKey === this.lastJobKey) {
                console.log('Stessa offerta giá analizzata');
                return;
            }

            this.lastJobKey = jobKey;
            console.log("Analizzo offerta:", jobData);

            const response = await this.makePostRequest(CONFIG.apiEndpointNewJob, jobData);
            console.log("Risposta:", response)
            this.applyResponseToJobCard(response);
        } catch (error) {
            console.error('Errore nella richiesta POST:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            this.lastJobKey = null;
        } finally {
            this.isAnalyzing = false;
        }
    }

    makeGetRequest(endpoint) {
        const correlationId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'makeRequest',
                endpoint: endpoint,
                method: 'GET',
                headers: {
                    'correlationId': correlationId
                }
            }, (response) => {
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(response);
                }
            });
        });
    }

    makePostRequest(endpoint, data) {
        const correlationId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'makeRequest',
                endpoint: endpoint,
                method: 'POST',
                headers: {
                    'correlationId': correlationId
                },
                body: data
            }, (response) => {
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(response);
                }
            });
        });
    }

    applyResponseToJobCard({esito, message}) {
        const config = STYLE_CONFIG[esito] || STYLE_CONFIG.NEW;

        const card = document.querySelector(this.htmlSelectors.containerCard);
        if (!card) {
            console.error("Contenitore principale non trovato");
            return;
        }
        card.style.transition = "background-color 0.5s ease-in-out"; // imposta transizione per il background-color
        card.style.backgroundColor = config.bgColor;

        const titleEl = document.querySelector(this.htmlSelectors.title);
        const infoJob1El = document.querySelector(this.htmlSelectors.infoJob1);
        const infoJob2El = document.querySelector(this.htmlSelectors.infoJob2);
        const bodyEl = document.querySelector(this.htmlSelectors.body)

        if (titleEl) this.updateResultField(titleEl, `[${esito}: ${message}]`)
        if (infoJob1El) infoJob1El.style.opacity = config.opacity;
        if (infoJob2El) infoJob2El.style.opacity = config.opacity;
        if (bodyEl) bodyEl.style.opacity = config.opacity;
        if (bodyEl) {
            this.highlightWords(bodyEl, this.positiveKeywords, '#99EB99');
            this.highlightWords(bodyEl, this.negativeKeywords, '#DE5959');
        }
    }

    updateResultField(titleEl, text) {
        const id = 'job-extra-field';
        let field = document.getElementById(id);

        if (!field) {
            field = document.createElement('span');
            field.id = id;
            field.style.marginLeft = '5px'; // aggiunge un piccolo margine
            titleEl.parentElement?.appendChild(field);
        }
        field.textContent = text;
    }

    debounce(func, delay) {
        return (...args) => {
            clearTimeout(this.debounceTimer); // cancella il timer precedente (se esiste)
            this.debounceTimer = setTimeout(() => { // imposta un nuovo timer
                func.apply(this, args) // esegui la funzione dopo il delay
            }, delay);
        };
    }

    // Inizializza l'observer
    /* Esempio di timeline reale:
    ┌─────────────────────────────────────────────────────────────┐
    │ Timeline di eventi su LinkedIn:                              │
    ├─────────────────────────────────────────────────────────────┤
    │ 0ms:    Caricamento pagina → DOM change → Timer START       │
    │ 50ms:   Immagine caricata → DOM change → Timer RESET        │
    │ 100ms:  Popup appare → DOM change → Timer RESET             │
    │ 150ms:  Scroll → DOM change → Timer RESET                   │
    │ 200ms:  Animazione → DOM change → Timer RESET               │
    │ 250ms:  ...silenzio...                                      │
    │ 300ms:  ...silenzio...                                      │
    │ 400ms:  ...silenzio...                                      │
    │ 500ms:  ✅ analyzeJob() ESEGUITA!                           │
    └─────────────────────────────────────────────────────────────┘
    */
    initObserver() {
        const debouncedAnalyze = this.debounce(() => this.analyzeJob(), CONFIG.debounceDelay);

        const observer = new MutationObserver((mutations) => {
            // controlla se ci sono state modifiche rilevanti
            const hasRelevantChanges = mutations.some(mutation =>
                mutation.type === 'childList' &&
                mutation.addedNodes.length > 0 &&
                Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === Node.ELEMENT_NODE
                )
            );

            if (hasRelevantChanges)
                debouncedAnalyze(); // aspetta 500ms di "silenzio"
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('Observer inizializzato');
        return observer;
    }

    escapeRegex(word) {
        return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    highlightWords(element, words, color) {
        if (!element || !words || !Array.isArray(words) || words.length === 0) return;

        // regex per trovare le parole nel testo (case-insensitive)
        const escapedWords = words.map(this.escapeRegex);
        const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');

        // funzione ricorsiva che attraversa tutti i nodi di testo
        function walk(node) {
            if (node.nodeType === Node.TEXT_NODE && regex.test(node.textContent)) { // se il nodo è di tipo testo
                // sostituisce il nodo testuale con nodi HTML
                const span = document.createElement('span');
                span.innerHTML = node.textContent.replace(regex, (match) => {
                    return `<span style="background-color: ${color};">${match}</span>`;
                });

                while (span.firstChild) {
                    node.parentNode.insertBefore(span.firstChild, node);
                }
                node.parentNode.removeChild(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) { // se il nodo ha figli, chiama ricorsivamente
                Array.from(node.childNodes).forEach(walk);
            }
        }

        walk(element);
    }
}

// Funzione che evidenzia i job in base alle keyword passate
// function highlightJobsByKeywords(keywords) {
//   const jobItems = document.querySelectorAll('li.ember-view.occludable-update');

//   jobItems.forEach(li => {
//     const titleLink = li.querySelector('a.job-card-container__link');
//     if (!titleLink) return;

//     const titleText = titleLink.textContent.trim();
//     const found = keywords.some(kw => titleText.toLowerCase().includes(kw.toLowerCase()));
//     if (found) {
//       li.style.backgroundColor = 'red';
//       console.log(`Evidenziato job: ${titleText} perché contiene keyword.`);
//     } else {
//       li.style.backgroundColor = '';
//     }
//   });
// }

const jobFinder = new JobFinder();
jobFinder.init();
