const DEV_MODE = true;

const API_BASE_URL = localStorage.getItem("zenithApiUrl") || "https://zenithcrm-deploy.onrender.com";

const state = {
    token: localStorage.getItem("zenithToken"),
    user: JSON.parse(localStorage.getItem("zenithUser") || "null"),
    patients: [],
    appointments: [],
    payments: [],
    documents: [],
    financeSummary: null
};

if (DEV_MODE) {

    state.token = "token-dev";

    state.user = {
        name: "Leonardo"
    };

    state.patients = [
        {
            id: 1,
            fullName: "Maria Silva",
            phone: "(14) 99999-1111",
            email: "maria@email.com"
        },
        {
            id: 2,
            fullName: "João Santos",
            phone: "(14) 99999-2222",
            email: "joao@email.com"
        }
    ];

    state.appointments = [
        {
            id: 1,
            patientName: "Maria Silva",
            startsAt: "2026-06-15T09:00:00",
            status: "CONFIRMED",
            googleCalendarUrl: "#"
        }
    ];

    state.payments = [
        {
            id: 1,
            patientName: "Maria Silva",
            amount: 150,
            dueDate: "2026-06-20",
            status: "PAID"
        }
    ];

    state.documents = [
        {
            id: 1,
            patientName: "Maria Silva",
            title: "Relatório Inicial",
            type: "REPORT",
            updatedAt: "2026-06-14T10:00:00"
        }
    ];

    state.financeSummary = {
        received: 150,
        pending: 200,
        overdue: 50,
        paidCount: 1,
        pendingCount: 1,
        overdueCount: 1
    };
}

const views = {
    dashboard: "Painel",
    patients: "Pacientes",
    appointments: "Agenda",
    finance: "Financeiro",
    documents: "Documentos"
};

document.addEventListener("DOMContentLoaded", () => {
    bindAuth();
    bindNavigation();
    bindForms();
    bindResetButtons();
    renderShell();
});



function showDashboardSkeleton() {

    document.getElementById("dashboardSkeleton")
        .classList.remove("hidden");

    document.getElementById("appView")
        .classList.add("hidden");
}

function hideDashboardSkeleton() {

    document.getElementById("dashboardSkeleton")
        .classList.add("hidden");

    document.getElementById("appView")
        .classList.remove("hidden");
}


function showLoading(message = "Carregando...") {

    const overlay = document.getElementById("loadingOverlay");

    if (!overlay) return;

    overlay.querySelector("p").textContent = message;
    overlay.classList.remove("hidden");



}

function hideLoading() {

    const overlay = document.getElementById("loadingOverlay");
    
    if (!overlay) return;

    overlay.classList.add("hidden");

}





function bindAuth() {
    document.getElementById("loginForm").addEventListener("submit", async event => {
        event.preventDefault();
        await authenticate("/api/auth/login", formData(event.target));
    });

    document.getElementById("registerForm").addEventListener("submit", async event => {
        event.preventDefault();
        await authenticate("/api/auth/register", formData(event.target));
    });

    document.getElementById("logoutButton").addEventListener("click", () => {
        localStorage.removeItem("zenithToken");
        localStorage.removeItem("zenithUser");
        state.token = null;
        state.user = null;
        renderShell();
    });
}

function bindNavigation() {
    document.querySelectorAll(".nav-button").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".nav-button").forEach(item => item.classList.remove("active"));
            document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            document.getElementById(button.dataset.view).classList.add("active");
            document.getElementById("viewTitle").textContent = views[button.dataset.view];
        });
    });
}

function bindForms() {
    document.getElementById("patientForm").addEventListener("submit", async event => {
        event.preventDefault();
        const data = formData(event.target);
        await saveRecord("/api/patients", data, event.target);
    });

    document.getElementById("appointmentForm").addEventListener("submit", async event => {
        event.preventDefault();
        const data = formData(event.target);
        data.patientId = Number(data.patientId);
        await saveRecord("/api/appointments", data, event.target);
    });

    document.getElementById("paymentForm").addEventListener("submit", async event => {
        event.preventDefault();
        const data = formData(event.target);
        data.patientId = Number(data.patientId);
        data.amount = Number(data.amount);
        await saveRecord("/api/payments", data, event.target);
    });

    document.getElementById("documentForm").addEventListener("submit", async event => {
        event.preventDefault();
        const data = formData(event.target);
        data.patientId = Number(data.patientId);
        await saveRecord("/api/documents", data, event.target);
    });
}

function bindResetButtons() {
    document.querySelectorAll("[data-reset]").forEach(button => {
        button.addEventListener("click", () => clearForm(document.getElementById(button.dataset.reset)));
    });
}

async function authenticate(url, body) {
    try {

        showLoading("Entrando...");
 

        const result = await request(url, { method: "POST", body });
        state.token = result.token;
        state.user = { name: result.name, email: result.email };
        localStorage.setItem("zenithToken", state.token);
        localStorage.setItem("zenithUser", JSON.stringify(state.user));
        setMessage("authMessage", "");
        renderShell();
    } catch (error) {
        setMessage("authMessage", error.message);
    }

    finally {
        hideLoading();
    }
}

async function renderShell() {

    if (DEV_MODE) {

        document.getElementById("authView")?.classList.add("hidden");
        document.getElementById("appView")?.classList.remove("hidden");

        document.getElementById("userLabel").textContent =
            state.user?.name || "Leonardo";

        renderPatients();
        renderPatientOptions();
        renderAppointments();
        renderPayments();
        renderDocuments();
        renderDashboard();

        return;
    }

    document.getElementById("authView")
        .classList.toggle("hidden", Boolean(state.token));

    document.getElementById("appView")
        .classList.toggle("hidden", !state.token);

    if (!state.token) {
        return;
    }

    document.getElementById("userLabel").textContent =
        state.user?.name || "Psicologia";

    await loadAll();
}

async function loadAll() {

    if (DEV_MODE) {

        renderPatients();
        renderPatientOptions();
        renderAppointments();
        renderPayments();
        renderDocuments();
        renderDashboard();

        return;
    }

    try {

        const [patients, appointments, payments, summary, documents] =
            await Promise.all([
                request("/api/patients"),
                request("/api/appointments"),
                request("/api/payments"),
                request("/api/payments/summary"),
                request("/api/documents")
            ]);

        state.patients = patients || [];
        state.appointments = appointments || [];
        state.payments = payments || [];
        state.financeSummary = summary || {};
        state.documents = documents || [];

        renderPatients();
        renderPatientOptions();
        renderAppointments();
        renderPayments();
        renderDocuments();
        renderDashboard();

    } catch(error) {

        console.error(error);

    }
}

async function saveRecord(baseUrl, data, form) {
    try {

        showLoading("Salvando...");

        removeEmptyStrings(data);
        const id = data.id;
        delete data.id;
        await request(id ? `${baseUrl}/${id}` : baseUrl, {
            method: id ? "PUT" : "POST",
            body: data
        });
        clearForm(form);
        setMessage("appMessage", "Registro salvo com sucesso.");
        await loadAll();
    } catch (error) {
        setMessage("appMessage", error.message);
    }

    finally {
        hideLoading();
    }
}

async function deleteRecord(baseUrl, id) {
    try {
        showLoading("Removendo...");
        await request(`${baseUrl}/${id}`, { method: "DELETE" });
        setMessage("appMessage", "Registro removido.");
        await loadAll();
    } catch (error) {
        setMessage("appMessage", error.message);
    }
}

function renderPatients() {
    const rows = state.patients.map(patient => `
        <tr>
            <td>${escapeHtml(patient.fullName)}</td>
            <td>${escapeHtml(patient.phone || "")}</td>
            <td>${escapeHtml(patient.email || "")}</td>
            <td class="actions">
                <button type="button" onclick="editPatient(${patient.id})">Editar</button>
                <button type="button" class="danger" onclick="deleteRecord('/api/patients', ${patient.id})">Excluir</button>
            </td>
        </tr>
    `).join("");
    document.getElementById("patientsTable").innerHTML = rows || emptyRow(4);
}

function renderPatientOptions() {
    const options = state.patients.map(patient => `<option value="${patient.id}">${escapeHtml(patient.fullName)}</option>`).join("");
    document.querySelectorAll("select[name='patientId']").forEach(select => {
        const current = select.value;
        select.innerHTML = `<option value="">Selecione</option>${options}`;
        select.value = current;
    });
}

function renderAppointments() {
    const rows = state.appointments.map(item => `
        <tr>
            <td>${escapeHtml(item.patientName)}</td>
            <td>${formatDateTime(item.startsAt)}</td>
            <td class="status-${item.status}">${translateStatus(item.status)}</td>
            <td><a href="${item.googleCalendarUrl}" target="_blank" rel="noreferrer">Abrir</a></td>
            <td class="actions">
                <button type="button" onclick="editAppointment(${item.id})">Editar</button>
                <button type="button" class="danger" onclick="deleteRecord('/api/appointments', ${item.id})">Excluir</button>
            </td>
        </tr>
    `).join("");
    document.getElementById("appointmentsTable").innerHTML = rows || emptyRow(5);
}

function renderPayments() {
    const rows = state.payments.map(payment => `
        <tr>
            <td>${escapeHtml(payment.patientName)}</td>
            <td>${currency(payment.amount)}</td>
            <td>${formatDate(payment.dueDate)}</td>
            <td class="status-${payment.status}">${translateStatus(payment.status)}</td>
            <td class="actions">
                <button type="button" onclick="editPayment(${payment.id})">Editar</button>
                <button type="button" class="danger" onclick="deleteRecord('/api/payments', ${payment.id})">Excluir</button>
            </td>
        </tr>
    `).join("");
    document.getElementById("paymentsTable").innerHTML = rows || emptyRow(5);
}

function renderDocuments() {
    const rows = state.documents.map(document => `
        <tr>
            <td>${escapeHtml(document.patientName)}</td>
            <td>${escapeHtml(document.title)}</td>
            <td>${translateDocumentType(document.type)}</td>
            <td>${formatDateTime(document.updatedAt)}</td>
            <td class="actions">
                <button type="button" onclick="editDocument(${document.id})">Editar</button>
                <button type="button" class="danger" onclick="deleteRecord('/api/documents', ${document.id})">Excluir</button>
            </td>
        </tr>
    `).join("");
    document.getElementById("documentsTable").innerHTML = rows || emptyRow(5);
}

function renderDashboard() {
    document.getElementById("metricPatients").textContent = state.patients.length;
    document.getElementById("metricAppointments").textContent = state.appointments.length;
    document.getElementById("metricReceived").textContent = currency(state.financeSummary?.received || 0);
    document.getElementById("metricPending").textContent = currency(state.financeSummary?.pending || 0);

    document.getElementById("dashboardAppointments").innerHTML = state.appointments.slice(0, 6).map(item => `
        <tr><td>${escapeHtml(item.patientName)}</td><td>${formatDateTime(item.startsAt)}</td><td>${translateStatus(item.status)}</td></tr>
    `).join("") || emptyRow(3);

    document.getElementById("dashboardFinance").innerHTML = `
        <tr><td>Pago</td><td>${state.financeSummary?.paidCount || 0}</td><td>${currency(state.financeSummary?.received || 0)}</td></tr>
        <tr><td>Pendente</td><td>${state.financeSummary?.pendingCount || 0}</td><td>${currency(state.financeSummary?.pending || 0)}</td></tr>
        <tr><td>Atrasado</td><td>${state.financeSummary?.overdueCount || 0}</td><td>${currency(state.financeSummary?.overdue || 0)}</td></tr>
    `;
}

function editPatient(id) {
    fillForm("patientForm", state.patients.find(item => item.id === id));
}

function editAppointment(id) {
    const item = state.appointments.find(record => record.id === id);
    fillForm("appointmentForm", {
        ...item,
        startsAt: toInputDateTime(item.startsAt),
        endsAt: toInputDateTime(item.endsAt)
    });
}

function editPayment(id) {
    fillForm("paymentForm", state.payments.find(item => item.id === id));
}

function editDocument(id) {
    fillForm("documentForm", state.documents.find(item => item.id === id));
}

function fillForm(formId, data) {
    const form = document.getElementById(formId);
    Object.entries(data || {}).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) {
            field.value = value ?? "";
        }
    });
}

function clearForm(form) {
    form.reset();
    if (form.elements.id) {
        form.elements.id.value = "";
    }
}

async function request(url, options = {}) {

    if (DEV_MODE) {

        console.log("[DEV] API IGNORADA:", url);

        return [];
    }

    const headers = {
        "Content-Type": "application/json"
    };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Nao foi possivel concluir a operacao.");
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();

    return text ? JSON.parse(text) : null;
}

function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function removeEmptyStrings(data) {
    Object.keys(data).forEach(key => {
        if (data[key] === "") {
            data[key] = null;
        }
    });
}

function setMessage(id, message) {
    document.getElementById(id).textContent = message;
}

function emptyRow(columns) {
    return `<tr><td colspan="${columns}">Nenhum registro encontrado.</td></tr>`;
}

function currency(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "";
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString("pt-BR") : "";
}

function toInputDateTime(value) {
    return value ? value.slice(0, 16) : "";
}

function translateStatus(status) {
    return {
        SCHEDULED: "Agendado",
        CONFIRMED: "Confirmado",
        COMPLETED: "Concluido",
        CANCELED: "Cancelado",
        PENDING: "Pendente",
        PAID: "Pago",
        OVERDUE: "Atrasado"
    }[status] || status;
}

function translateDocumentType(type) {
    return {
        REPORT: "Relatorio",
        ANAMNESIS: "Anamnese",
        CERTIFICATE: "Atestado",
        EVOLUTION: "Evolucao",
        OTHER: "Outro"
    }[type] || type;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


document.addEventListener("DOMContentLoaded", async () => {

    showDashboardSkeleton();

    try {

        await renderShell();

    } catch(error) {

        console.error(error);

    } finally {

        hideDashboardSkeleton();

    }

});