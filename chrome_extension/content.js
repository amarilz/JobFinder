const CONFIG = {
    logPrefix: '[FE-JOBFINDER]',
    debounceDelay: 500,
    blacklistFile: 'blacklist_words.json',
    apiEndpoint: '/be-jobfinder/api/v1/job'
};

const SELECTORS = {
    company: "#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.display-flex.align-items-center > div.display-flex.align-items-center.flex-1 > div",
    title: "#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.display-flex.justify-space-between.flex-wrap.mt2 > div > h1",
    location: "#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container > div > span > span:nth-child(1)",
    postedDate: "#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container > div > span > span:nth-child(3)",
    candidates: "#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container > div > span > span:nth-child(5)",
    body: "#job-details > div",
    containerCard: '.job-details-jobs-unified-top-card__container--two-pane.relative',
    infoJob1: "#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container",
    infoJob2: "#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.mt2.mb2"
};

const styleConfig = {
    NEW: {
        bgColor: '',
        opacity: '1.0'
    },
    TOO_MANY_CANDIDATES: {
        bgColor: 'red',
        opacity: '0.1'
    },
    UNSUITABLE_LANGUAGE: {
        bgColor: 'red',
        opacity: '0.1'
    },
    ALREADY_SEEN: {
        bgColor: 'orange',
        opacity: '0.5'
    }
};

const originalConsoleLog = console.log;
console.log = function(...args) { // ridefinisci console log
    originalConsoleLog.apply(console, [CONFIG.logPrefix, ...args]);
};

class JobFinder {
    constructor() {
        this.keywords = [];
        this.lastAnalyzedJobKey = null;
        this.isAnalyzing = false;
        this.debounceTimer = null;
    }

    async loadKeywords() {
        const url = chrome.runtime.getURL(CONFIG.blacklistFile);
        try {
            const response = await fetch(url);
            if (!response.ok)
                throw new Error('Errore nel caricamento blacklist_words.json');

            this.keywords = await response.json();
            console.log(`Caricate ${this.keywords.length} keywords`);
            return this.keywords;
        } catch (error) {
            console.error('Errore caricamento keywords:', error);
            this.keywords = [];
            return [];
        }
    }

    extractJobData() {
        const getElementText = (selector, label = '') => {
            const el = document.querySelector(selector);
            if (!el && label) {
                console.warn(`Elemento non trovato: ${label}`);
            }
            return el?.textContent?.trim() || '';
        };

        const jobData = {
            originWebsite: window.location.hostname, // current domain
            company: getElementText(SELECTORS.company, 'company'),
            location: getElementText(SELECTORS.location, 'location'),
            title: getElementText(SELECTORS.title, 'title'),
            candidates: getElementText(SELECTORS.candidates, 'candidates'),
            body: getElementText(SELECTORS.body, 'body'),
            postedDate: getElementText(SELECTORS.postedDate, 'postedDate')
        };

        if (!jobData.title || !jobData.company) {
            throw new Error('Dati job incompleti: titolo o azienda mancanti');
        }

        return jobData;
    }

    generateJobKey(jobData) {
        return `[${jobData.company}|${jobData.title}|${jobData.location}]`.toLowerCase();
    }

    makePostRequest(endpoint, correlationId, data) {
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

    // Debounce per evitare analisi multiple
    debounce(func, delay) {
        return (...args) => {
            // cancella il timer precedente (se esiste)
            clearTimeout(this.debounceTimer);
            // imposta un nuovo timer
            this.debounceTimer = setTimeout(() => {
                func.apply(this, args) // esegui la funzione dopo il delay
            }, delay);
        };
    }

    async analyzeJob() {
        if (this.isAnalyzing) {
            console.log('Analisi già in corso, skip...');
            return;
        }

        let jobData;
        try {
            this.isAnalyzing = true;
            jobData = this.extractJobData();
            const jobKey = this.generateJobKey(jobData);

            if (jobKey === this.lastAnalyzedJobKey) {
                console.log('Stesso job già analizzato recentemente, skip...');
                return;
            }
            this.lastAnalyzedJobKey = jobKey;
            console.log("Analizzo nuovo Job:", jobData);

            const correlationId = crypto.randomUUID();
            const response = await this.makePostRequest(CONFIG.apiEndpoint, correlationId, jobData);
            this.applyResponseToJobCard(response);

        } catch (error) {
            console.error('Errore nella richiesta POST:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

            // rimuovi dalla cache se l'analisi è fallita
            if (jobData?.title && jobData?.company) {
                const jobKey = this.generateJobKey(jobData);
                this.lastAnalyzedJobKey = null;
            }
        } finally {
            this.isAnalyzing = false;
        }
    }

    applyResponseToJobCard(result) {
        const {
            esito,
            message
        } = result;
        console.log("Risposta:", result)

        const config = styleConfig[esito];
        if (!config) {
            console.warn(`Esito sconosciuto: ${esito}, applico stile di default`);
        }
        const finalConfig = config || styleConfig.NEW;

        const containerRightCard = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane.relative');
        if (!containerRightCard) {
            console.error("Contenitore principale non trovato.");
            return;
        }

        const titleEl = document.querySelector(SELECTORS.title);
        const infoJob1El = document.querySelector(SELECTORS.infoJob1);
        const infoJob2El = document.querySelector(SELECTORS.infoJob2);
        const bodyEl = document.querySelector(SELECTORS.body)

        containerRightCard.style.backgroundColor = finalConfig.bgColor;
        if (infoJob1El) infoJob1El.style.opacity = finalConfig.opacity;
        if (infoJob2El) infoJob2El.style.opacity = finalConfig.opacity;
        if (bodyEl) bodyEl.style.opacity = finalConfig.opacity;

        // tooltip per mostrare il messaggio
        if (titleEl && message) titleEl.setAttribute("title", message);
    }

    // Inizializza l'observer
    // Esempio di timeline reale:
    /*
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
    │ 500ms:  ...silenzio...                                      │
    │ 750ms:  ✅ analyzeJob() ESEGUITA!                           │
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

            if (hasRelevantChanges) {
                // invece di: this.analyzeJob() (immediata)
                debouncedAnalyze(); // aspetta 500ms di "silenzio"
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('Observer inizializzato');
        return observer;
    }

    // Inizializza l'intera applicazione
    async init() {
        try {
            if (!window.location.pathname.includes('/jobs/')) {
                console.log('Non è una pagina di job, estensione non attiva.');
                return;
            }

            console.log('Inizializzazione JobFinder...');

            // Carica keywords
            await this.loadKeywords();

            // Esegui prima analisi
            await this.analyzeJob();

            // Inizializza observer
            this.initObserver();

            console.log('JobAnalyzer inizializzato con successo');
        } catch (error) {
            console.error('Errore nell\'inizializzazione:', error);
        }
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