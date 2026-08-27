const CONFIG = {
    logPrefix: '[FE-JOBFINDER]',
    debounceDelay: 300,
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
const originalConsoleError = console.error;
console.log = function (...args) { // ridefinisci console log
    originalConsoleLog.apply(console, [CONFIG.logPrefix, ...args]);
};

class JobFinder {
    constructor() {
        this.lastJobKey = null;
        this.isAnalyzing = false;
        this.debounceTimer = null;
        this.logPrefix = CONFIG.logPrefix;
        this.lastObservedJobId = null;

        this.htmlSelectors = {};
        this.positiveKeywords = [];
        this.negativeKeywords = [];
    }

    setLogContext(company, title) {
        const context = [company, title]
            .map(value => value?.trim())
            .filter(Boolean)
            .join(' - ');

        this.logPrefix = context
            ? `${CONFIG.logPrefix}[${context}]`
            : CONFIG.logPrefix;
    }

    log(...args) {
        originalConsoleLog.apply(console, [this.logPrefix, ...args]);
    }

    error(...args) {
        originalConsoleError.apply(console, [this.logPrefix, ...args]);
    }

    async init() {
        if (!window.location.pathname.includes('/jobs/')) {
            this.log('Non è una pagina di job, estensione non attiva.');
            return;
        }

        this.log('Inizializzazione JobFinder...');
        try {
            await this.loadConfiguration();
            await this.analyzeJob();
            this.lastObservedJobId = this.getCurrentJobId();
            this.initObserver(); // start observer
            this.log('JobAnalyzer inizializzato con successo');
        } catch (error) {
            this.error('Errore nell\'inizializzazione:', error);
        }
    }

    async loadConfiguration() {
        const configData = await this.makeGetRequest(CONFIG.apiEndpointGetConfig);
        if (!configData?.htmlSelector) {
            this.error('Configurazione non valida:', configData);
            return;
        }

        this.htmlSelectors = configData.htmlSelector;
        this.positiveKeywords = configData.positiveKeyword || [];
        this.negativeKeywords = configData.negativeKeyword || [];

        this.log("Configurazione caricata:", configData);
    }

    async expandJobDescription() {
        const jobRoot = this.getJobRoot();
        const moreButton = jobRoot?.querySelector(
            '[id^="JobDetails_AboutTheJob_"] [data-testid="expandable-text-button"]'
        );

        if (!moreButton || !/\bmore\b/i.test(moreButton.textContent || '')) {
            return;
        }

        const title = jobRoot.querySelector(this.htmlSelectors.title) ||
            jobRoot.querySelector('a[href*="/jobs/view/"]');
        const company = jobRoot.querySelector(this.htmlSelectors.company) ||
            jobRoot.querySelector('a[href*="/company/"][href*="/life/"]') ||
            jobRoot.querySelector('a[href*="/company/"]');

        this.setLogContext(company?.textContent, title?.textContent);
        this.log('Click automatico su More per espandere la job description');
        moreButton.click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    extractJobData() {
        const jobRoot = this.getJobRoot();
        if (!jobRoot) {
            throw new Error('Dettaglio della job posting non ancora disponibile');
        }

        const queryFirst = (...selectors) => {
            for (const selector of selectors.filter(Boolean)) {
                try {
                    const element = jobRoot.querySelector(selector);

                    if (element) {
                        return element;
                    }
                } catch (error) {
                    console.warn(`Selector non valido: ${selector}`);
                }
            }

            return null;
        };

        const titleEl = queryFirst(
            this.htmlSelectors.title,
            'a[href*="/jobs/view/"]'
        );

        const companyEl = queryFirst(
            this.htmlSelectors.company,
            'a[href*="/company/"][href*="/life/"]',
            'a[href*="/company/"]'
        );

        const bodyEl = queryFirst(
            this.htmlSelectors.body,
            '[data-sdui-component*="aboutTheJob"]',
            '[id^="JobDetails_AboutTheJob_"]'
        );

        const metadataParagraph = this.findJobMetadata(titleEl);

        const {
            location,
            postedDate,
            candidates
        } = this.extractMetadata(metadataParagraph);

        const jobData = {
            originWebsite: window.location.hostname,
            company: companyEl?.textContent?.trim() || '',
            location: location,
            title: titleEl?.textContent?.trim() || '',
            candidates: candidates,
            body: bodyEl?.textContent
                ?.replace(/^About the job\s*/i, '')
                ?.trim() || '',
            postedDate: postedDate
        };

        const missingFields = Object.entries(jobData)
            .filter(([, value]) => !value)
            .map(([field]) => field);

        if (missingFields.length > 0) {
            throw new Error(
                `Dati job incompleti: ${missingFields.join(', ')}`
            );
        }

        return jobData;
    }

    findJobMetadata(titleEl) {
        if (!titleEl) {
            return null;
        }

        let container = titleEl.parentElement;

        for (let i = 0; i < 10 && container; i++) {
            const paragraphs = Array.from(
                container.querySelectorAll('p')
            );

            const metadataParagraph = paragraphs.find(p => {
                const text = p.textContent?.trim() || '';

                return (
                    /\bago\b/i.test(text) ||
                    /\btoday\b/i.test(text) ||
                    /\byesterday\b/i.test(text) ||
                    /\bclicked apply\b/i.test(text) ||
                    /\bapplicant/i.test(text)
                );
            });

            if (metadataParagraph) {
                return metadataParagraph;
            }

            container = container.parentElement;
        }

        return null;
    }

    extractMetadata(metadataParagraph) {
        if (!metadataParagraph) {
            return {
                location: '',
                postedDate: '',
                candidates: ''
            };
        }

        const values = Array.from(
            metadataParagraph.querySelectorAll(':scope > span')
        )
            .map(span => span.textContent?.trim())
            .filter(value =>
                value &&
                value !== '·'
            );

        const postedDate = values.find(value =>
            /\b(ago|today|yesterday)\b/i.test(value)
        ) || '';

        const candidates = values.find(value =>
            /\b(applicant|applicants|clicked apply|people clicked apply)\b/i.test(value)
        ) || '';

        const location = values.find(value =>
            value !== postedDate &&
            value !== candidates
        ) || '';

        return {
            location,
            postedDate,
            candidates
        };
    }

    generateJobKey({ company, title, location }) {
        return `[${company}|${title}|${location}]`.toLowerCase();
    }

    async analyzeJob() {
        if (this.isAnalyzing) {
            this.log('Analisi già in corso, skip...');
            return;
        }

        this.isAnalyzing = true;
        let jobData;

        try {
            if (!this.getJobRoot()) {
                return;
            }

            await this.expandJobDescription();
            jobData = this.extractJobData();
            this.setLogContext(jobData.company, jobData.title);
            const analyzedJobId = this.getCurrentJobId();
            const jobKey = this.generateJobKey(jobData);

            if (jobKey === this.lastJobKey) {
                this.log('Stessa offerta giá analizzata');
                return;
            }

            this.lastJobKey = jobKey;
            this.log("Analizzo offerta:", jobData);

            const response = await this.makePostRequest(CONFIG.apiEndpointNewJob, jobData);
            if (analyzedJobId && analyzedJobId !== this.getCurrentJobId()) {
                this.log('Risposta ignorata: il job visualizzato è cambiato durante l\'analisi');
                return;
            }
            this.log("Risposta:", response)
            this.applyResponseToJobCard(response, analyzedJobId);
        } catch (error) {
            if (error.message?.startsWith('Dati job incompleti:')) {
                this.log('Job ancora in caricamento, nuova analisi al completamento del pannello');
            } else {
                this.error('Errore nella richiesta POST:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            }
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

    getCurrentJobId() {
        const jobLink = this.getJobRoot()?.querySelector('a[href*="/jobs/view/"]');
        const jobId = jobLink?.href.match(/\/jobs\/view\/(\d+)/)?.[1];

        return jobId || new URLSearchParams(window.location.search).get('currentJobId');
    }

    getJobRoot() {
        return document.querySelector(
            '[data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails"]'
        );
    }

    applyResponseToJobCard({ esito, message }, analyzedJobId) {
        const config = STYLE_CONFIG[esito] || STYLE_CONFIG.NEW;

        const jobId = analyzedJobId || this.getCurrentJobId();
        const resultCard = jobId
            ? document.querySelector(`[componentkey="job-card-component-ref-${jobId}"]`)
            : null;
        const card = resultCard?.closest('[style*="background-color"]') ||
            document.querySelector(this.htmlSelectors.containerCard);

        if (!card) {
            this.error("Contenitore principale non trovato");
            return;
        }

        card.style.transition = "background-color 0.5s ease-in-out";
        card.style.backgroundColor = config.bgColor;

        if (resultCard) {
            resultCard.style.transition = "background-color 0.5s ease-in-out";
            resultCard.style.backgroundColor = config.bgColor;
        }

        const jobRoot = this.getJobRoot();
        if (!jobRoot) {
            this.error('Dettaglio della job posting non trovato');
            return;
        }
        const titleEl = jobRoot.querySelector(this.htmlSelectors.title) ||
            jobRoot.querySelector('a[href*="/jobs/view/"]');
        const infoJob1El = jobRoot.querySelector(this.htmlSelectors.infoJob1);
        const infoJob2El = jobRoot.querySelector(this.htmlSelectors.infoJob2);
        const bodyEl = jobRoot.querySelector(this.htmlSelectors.body) ||
            jobRoot.querySelector('[id^="JobDetails_AboutTheJob_"]');

        if (titleEl) this.updateResultField(titleEl, `[${esito}: ${message}]`, config.bgColor)
        if (infoJob1El) infoJob1El.style.opacity = config.opacity;
        if (infoJob2El) infoJob2El.style.opacity = config.opacity;
        if (bodyEl) bodyEl.style.opacity = config.opacity;
        if (bodyEl) {
            this.highlightWords(bodyEl, this.positiveKeywords, '#99EB99');
            this.highlightWords(bodyEl, this.negativeKeywords, '#DE5959');
        }
    }

    updateResultField(titleEl, text, backgroundColor) {
        const id = 'job-extra-field';
        let field = document.getElementById(id);

        if (!field) {
            field = document.createElement('span');
            field.id = id;
            field.style.marginLeft = '5px'; // aggiunge un piccolo margine
            titleEl.parentElement?.appendChild(field);
        }
        field.textContent = text;
        field.style.backgroundColor = backgroundColor;
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
            if (!this.getJobRoot()) {
                return;
            }

            const jobId = this.getCurrentJobId();
            const hasAddedElements = mutations.some(mutation =>
                mutation.type === 'childList' &&
                Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === Node.ELEMENT_NODE
                )
            );

            if (!hasAddedElements || !jobId) {
                return;
            }

            if (jobId !== this.lastObservedJobId || !this.lastJobKey) {
                this.lastObservedJobId = jobId;
                debouncedAnalyze();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.log('Observer inizializzato');
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
