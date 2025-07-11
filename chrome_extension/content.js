// Passo 1: Definisci il tuo prefisso
const logPrefix = '[FE-JOBFINDER]';

// Passo 2: Salva la funzione originale di console.log
const originalConsoleLog = console.log;

// Passo 3: Ridefinisci console.log
console.log = function(...args) {
    // Inserisci il prefisso come primo argomento,
    // seguito da tutti gli argomenti originali passati alla funzione.
    // Usiamo 'apply' per assicurarci che 'this' sia corretto, anche se per console.log non è strettamente necessario.
    originalConsoleLog.apply(console, [logPrefix, ...args]);
};

// Funzione per caricare keyword da file JSON locale
async function loadKeywords() {
  const url = chrome.runtime.getURL('blacklist_words.json');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Errore nel caricamento blacklist_words.json');
    const keywords = await response.json();
    return keywords;
  } catch (error) {
    console.error('Errore caricamento keywords:', error);
    return [];
  }
}

// Funzione che evidenzia i job in base alle keyword passate
function highlightJobsByKeywords(keywords) {
  const jobItems = document.querySelectorAll('li.ember-view.occludable-update');

  jobItems.forEach(li => {
    const titleLink = li.querySelector('a.job-card-container__link');
    if (!titleLink) return;

    const titleText = titleLink.textContent.trim();
    const found = keywords.some(kw => titleText.toLowerCase().includes(kw.toLowerCase()));

    if (found) {
      li.style.backgroundColor = 'red';
      console.log(`Evidenziato job: ${titleText} perché contiene keyword.`);
    } else {
      li.style.backgroundColor = '';
    }
  });
}

// Funzione già esistente per colorare contenitore in base al numero persone
function checkAndToggleContainer() {
  const container = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane.relative');
  if (!container) {
    console.log("Contenitore principale non trovato.");
    return;
  }

  const text = container.textContent.trim();
  const match = text.match(/(\d+)\s+(people|applicants)/);

  if (match) {
    const number = parseInt(match[1], 10);

    const maxConcurrent = 40;
    if (number > maxConcurrent) {
      container.style.backgroundColor = 'red';  // Sfondo rosso
      console.log(`Sfondo colorato di rosso perché il numero ${number} è maggiore di ${maxConcurrent}.`);
    } else {
      container.style.backgroundColor = ''; // Ripristina colore originale
      console.log(`Numero ${number} non supera la soglia.`);
    }
  } else {
    container.style.backgroundColor = ''; // Ripristina colore se non trova numero
    console.log(`Numero persone non trovato nel testo: ${text}`);
  }
}

function extractJobData() {
  const titleEl = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.display-flex.justify-space-between.flex-wrap.mt2 > div > h1");
  const companyEl = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.display-flex.align-items-center > div.display-flex.align-items-center.flex-1 > div");
  const locationEl = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container > div > span > span:nth-child(1)");
  const bodyEl = document.querySelector("#job-details > div")
  const dateEl = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container > div > span > span:nth-child(3)");
  const giaCandidatiEl = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container > div > span > span:nth-child(5)");
  const dominioCorrente = window.location.hostname;

  return {
    originWebsite: dominioCorrente,
    company: companyEl?.textContent.trim() || '',
    location: locationEl?.textContent.trim() || '',
    title: titleEl?.textContent.trim() || '',
    candidates: giaCandidatiEl?.textContent.trim() || '',
    body: bodyEl?.textContent.trim() || '',
    postedDate: dateEl?.textContent.trim() || ''
  };
}

function makePostRequest(endpoint, correlationId, data) {
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

const analyzedJobs = new Set();

function generateJobKey(jobData) {
  return `[${jobData.company} | ${jobData.title} | ${jobData.location}]`.toLowerCase();
}

async function analyzeJob() {
  const jobData = extractJobData();
  const jobKey = generateJobKey(jobData);

  if (analyzedJobs.has(jobKey)) {
    // console.log('Job già analizzato:', jobKey);
    return;
  }

  analyzedJobs.add(jobKey); // Segnalo che lo sto per analizzare
  console.log("Analizzo nuovo Job:", jobData);

  try {
    const correlationId = crypto.randomUUID();
    const response = await makePostRequest('/be-jobfinder/api/v1/job', correlationId, jobData);

    applyResponseToJobCard(response);
  } catch (error) {
    console.error('Errore nella richiesta POST:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
}

function applyResponseToJobCard(result) {
  const { esito, message } = result;
  console.log("Risposta:", result)

  const containerRightCard = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane.relative');
  if (!containerRightCard) {
    console.error("Contenitore principale non trovato.");
    return;
  }

  const titleEl = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.display-flex.justify-space-between.flex-wrap.mt2 > div > h1");
  const infoJob1El = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.job-details-jobs-unified-top-card__primary-description-container");
  const infoJob2El = document.querySelector("#main > div > div.scaffold-layout__list-detail-inner.scaffold-layout__list-detail-inner--grow > div.scaffold-layout__detail.overflow-x-hidden.jobs-search__job-details > div > div.jobs-search__job-details--container > div > div.job-view-layout.jobs-details > div:nth-child(1) > div > div:nth-child(1) > div > div.relative.job-details-jobs-unified-top-card__container--two-pane > div > div.mt2.mb2");
  const bodyEl = document.querySelector("#job-details > div")

  switch (esito) {
    case 'NEW':
      containerRightCard.style.backgroundColor = ''; // Ripristina colore originale
      infoJob1El.style.opacity = '1.0';
      infoJob2El.style.opacity = '1.0';
      bodyEl.style.opacity = '1.0';
      break;
    case 'TOO_MANY_CANDIDATES':
      containerRightCard.style.backgroundColor = 'red';
      infoJob1El.style.opacity = '0.1';
      infoJob2El.style.opacity = '0.1';
      bodyEl.style.opacity = '0.1';
      break;
    case 'ALREADY_SEEN':
      containerRightCard.style.backgroundColor = 'orange';
      infoJob1El.style.opacity = '0.5';
      infoJob2El.style.opacity = '0.5';
      bodyEl.style.opacity = '0.5';
      break;
    default:
      containerRightCard.style.backgroundColor = ''; // Ripristina colore originale
      break;
  }

  // // Tooltip per mostrare il messaggio
  titleEl.setAttribute("title", message);
}

// Avvio principale: carico keyword e poi eseguo funzioni e osservatore
loadKeywords().then(keywords => {
  checkAndToggleContainer();
  highlightJobsByKeywords(keywords);
  analyzeJob();

  const observer = new MutationObserver(() => {
    checkAndToggleContainer();
    highlightJobsByKeywords(keywords);
    analyzeJob();
  });

  observer.observe(document.body, { childList: true, subtree: true });
});
