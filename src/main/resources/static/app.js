const API_ENDPOINT = '/be-jobfinder/api/v1/job';
const STATUS_LABELS = {
    DROP_CV: 'CV inviato',
    REJECTED: 'Rifiutata',
    INTERVIEWING: 'Colloqui',
    OFFER: 'Offerta ricevuta',
    ACCEPTED: 'Accettata'
};

const state = { applications: [] };
const list = document.getElementById('application-list');
const template = document.getElementById('application-template');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const count = document.getElementById('application-count');
const search = document.getElementById('search');
const statusFilter = document.getElementById('status-filter');

function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
}

function filteredApplications() {
    const query = search.value.trim().toLocaleLowerCase('it');
    return state.applications.filter(application => {
        const matchesStatus = !statusFilter.value || application.status === statusFilter.value;
        const searchable = `${application.title} ${application.company} ${application.location}`
            .toLocaleLowerCase('it');
        return matchesStatus && (!query || searchable.includes(query));
    });
}

function render() {
    const applications = filteredApplications();
    list.replaceChildren();
    emptyState.hidden = applications.length > 0;
    count.textContent = state.applications.length;

    applications.forEach((application, index) => {
        const card = template.content.firstElementChild.cloneNode(true);
        card.style.animationDelay = `${Math.min(index * 35, 210)}ms`;
        card.querySelector('.company').textContent = application.company;
        card.querySelector('.title').textContent = application.title;
        card.querySelector('.location').textContent = application.location;
        card.querySelector('.application-date').textContent = `Candidatura: ${formatDate(application.applicationDate)}`;
        card.querySelector('.posted-date').textContent = `Pubblicata: ${formatDate(application.postedDate)}`;

        const link = card.querySelector('.job-link');
        link.href = application.originWebsite;
        link.setAttribute('aria-label', `Apri l'offerta ${application.title} su LinkedIn`);

        const select = card.querySelector('.application-status');
        select.value = application.status;
        select.dataset.status = application.status;
        select.setAttribute('aria-label', `Stato candidatura per ${application.title}`);
        select.addEventListener('change', () => updateStatus(application, select));
        list.appendChild(card);
    });
}

async function updateStatus(application, select) {
    const previousStatus = application.status;
    const requestedStatus = select.value;
    select.disabled = true;
    try {
        const response = await fetch(`${API_ENDPOINT}/application/${application.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: requestedStatus })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const updated = await response.json();
        Object.assign(application, updated);
        select.dataset.status = updated.status;
    } catch (error) {
        select.value = previousStatus;
        select.dataset.status = previousStatus;
        window.alert(`Impossibile impostare lo stato “${STATUS_LABELS[requestedStatus]}”. Riprova.`);
        console.error(error);
    } finally {
        select.disabled = false;
    }
}

async function loadApplications() {
    errorState.hidden = true;
    emptyState.hidden = true;
    try {
        const response = await fetch(`${API_ENDPOINT}/applications`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.applications = await response.json();
        render();
    } catch (error) {
        list.replaceChildren();
        count.textContent = '—';
        errorState.hidden = false;
        console.error(error);
    }
}

search.addEventListener('input', render);
statusFilter.addEventListener('change', render);
document.getElementById('retry').addEventListener('click', loadApplications);
loadApplications();
