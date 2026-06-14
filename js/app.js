const API_BASE_URL = localStorage.getItem("zenithApiUrl") || "https://zenithcrm-deploy.onrender.com";
const APP_HOME = "/dashboard.html";

const state = {
    token: localStorage.getItem("zenithToken"),
    user: JSON.parse(localStorage.getItem("zenithUser") || "null"),
    patients: [],
    appointments: [],
    payments: [],
    documents: [],
    financeSummary: null
};

const views = {
    dashboard: "Painel",
    patients: "Pacientes",
    appointments: "Agenda",
    finance: "Financeiro",
    documents: "Documentos"
};

document.addEventListener("DOMContentLoaded", async () => {
    bindAuth();
    bindForms();
    bindResetButtons();
    setActiveNavigation();

    if (currentPage() === "dashboard" && state.token) {
        showDashboardSkeleton();
    }

    try {
        await renderShell();
    } catch (error) {
        console.error(error);
        setMessage("appMessage", error.message);
    } finally {
        hideDashboardSkeleton();
    }
});

function currentPage() {
    return document.body.dataset.page || "login";
}

function byId(id) {
    return document.getElementById(id);
}

function onSubmit(id, handler) {
    const form = byId(id);
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();
        await handler(event);
    });
}

function showDashboardSkeleton() {
    byId("dashboardSkeleton")?.classList.remove("hidden");
    byId("appView")?.classList.add("hidden");
}

function hideDashboardSkeleton() {
    byId("dashboardSkeleton")?.classList.add("hidden");
    if (state.token) {
        byId("appView")?.classList.remove("hidden");
    }
}

function showLoading(message = "Carregando...") {
    const overlay = byId("loadingOverlay");
    if (!overlay) return;

    const label = overlay.querySelector("p");
    if (label) {
        label.textContent = message;
    }
    overlay.classList.remove("hidden");
}

function hideLoading() {
    byId("loadingOverlay")?.classList.add("hidden");
}

function bindAuth() {
    onSubmit("loginForm", async event => {
        await authenticate("/api/auth/login", formData(event.target));
    });

    onSubmit("registerForm", async event => {
        await authenticate("/api/auth/register", formData(event.target));
    });

    byId("logoutButton")?.addEventListener("click", () => {
        localStorage.removeItem("zenithToken");
        localStorage.removeItem("zenithUser");
        state.token = null;
        state.user = null;
        window.location.href = "/";
    });
}

function bindForms() {
    onSubmit("patientForm", async event => {
        await saveRecord("/api/patients", formData(event.target), event.target);
    });

    onSubmit("appointmentForm", async event => {
        const data = formData(event.target);
        data.patientId = Number(data.patientId);
        await saveRecord("/api/appointments", data, event.target);
    });

    onSubmit("paymentForm", async event => {
        const data = formData(event.target);
        data.patientId = Number(data.patientId);
        data.amount = Number(data.amount);
        await saveRecord("/api/payments", data, event.target);
    });

    onSubmit("documentForm", async event => {
        const data = formData(event.target);
        data.patientId = Number(data.patientId);
        await saveRecord("/api/documents", data, event.target);
    });
}

function bindResetButtons() {
    document.querySelectorAll("[data-reset]").forEach(button => {
        button.addEventListener("click", () => clearForm(byId(button.dataset.reset)));
    });
}

function setActiveNavigation() {
    const page = currentPage();
    document.querySelectorAll(".nav-button").forEach(link => {
        link.classList.toggle("active", link.dataset.view === page);
    });

    const title = byId("viewTitle");
    if (title && views[page]) {
        title.textContent = views[page];
    }
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

        if (currentPage() === "login") {
            window.location.href = APP_HOME;
            return;
        }

        await renderShell();
    } catch (error) {
        setMessage("authMessage", error.message);
    } finally {
        hideLoading();
    }
}

async function renderShell() {
    const hasToken = Boolean(state.token);
    byId("authView")?.classList.toggle("hidden", hasToken);
    byId("appView")?.classList.toggle("hidden", !hasToken);

    if (!hasToken) {
        return;
    }

    if (currentPage() === "login") {
        window.location.href = APP_HOME;
        return;
    }

    const userLabel = byId("userLabel");
    if (userLabel) {
        userLabel.textContent = state.user?.name || "Psicologia";
    }

    await loadAll();
}

async function loadAll() {
    try {
        const [patients, appointments, payments, summary, documents] = await Promise.all([
            request("/api/patients"),
            request("/api/appointments"),
            request("/api/payments"),
            request("/api/payments/summary"),
            request("/api/documents")
        ]);
        state.patients = patients || [];
        state.appointments = appointments || [];
        state.payments = payments || [];
        state.financeSummary = summary || null;
        state.documents = documents || [];

        renderPatients();
        renderPatientOptions();
        renderAppointments();
        renderPayments();
        renderDocuments();
        renderDashboard();
    } catch (error) {
        setMessage("appMessage", error.message);
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
    } finally {
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
    } finally {
        hideLoading();
    }
}

function renderPatients() {
    const table = byId("patientsTable");
    if (!table) return;

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
    table.innerHTML = rows || emptyRow(4);
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
    const table = byId("appointmentsTable");
    if (!table) return;

    const rows = state.appointments.map(item => `
        <tr>
            <td>${escapeHtml(item.patientName)}</td>
            <td>${formatDateTime(item.startsAt)}</td>
            <td class="status-${item.status}">${translateStatus(item.status)}</td>
            <td>${item.googleCalendarUrl ? `<a href="${item.googleCalendarUrl}" target="_blank" rel="noreferrer">Abrir</a>` : ""}</td>
            <td class="actions">
                <button type="button" onclick="editAppointment(${item.id})">Editar</button>
                <button type="button" class="danger" onclick="deleteRecord('/api/appointments', ${item.id})">Excluir</button>
            </td>
        </tr>
    `).join("");
    table.innerHTML = rows || emptyRow(5);
}

function renderPayments() {
    const table = byId("paymentsTable");
    if (!table) return;

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
    table.innerHTML = rows || emptyRow(5);
}

function renderDocuments() {
    const table = byId("documentsTable");
    if (!table) return;

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
    table.innerHTML = rows || emptyRow(5);
}

function renderDashboard() {
    const metricPatients = byId("metricPatients");
    if (!metricPatients) return;

    metricPatients.textContent = state.patients.length;
    byId("metricAppointments").textContent = state.appointments.length;
    byId("metricReceived").textContent = currency(state.financeSummary?.received || 0);
    byId("metricPending").textContent = currency(state.financeSummary?.pending || 0);

    byId("dashboardAppointments").innerHTML = state.appointments.slice(0, 6).map(item => `
        <tr><td>${escapeHtml(item.patientName)}</td><td>${formatDateTime(item.startsAt)}</td><td>${translateStatus(item.status)}</td></tr>
    `).join("") || emptyRow(3);

    byId("dashboardFinance").innerHTML = `
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
    if (!item) return;

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
    const form = byId(formId);
    if (!form || !data) return;

    Object.entries(data).forEach(([key, value]) => {
        const field = form.elements[key];
        if (field) {
            field.value = value ?? "";
        }
    });
}

function clearForm(form) {
    if (!form) return;

    form.reset();
    if (form.elements.id) {
        form.elements.id.value = "";
    }
}

async function request(url, options = {}) {
    const headers = { "Content-Type": "application/json" };
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
        throw new Error(error.message || "Não foi possível concluir a operação.");
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
    const element = byId(id);
    if (element) {
        element.textContent = message;
    }
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
        COMPLETED: "Concluído",
        CANCELED: "Cancelado",
        PENDING: "Pendente",
        PAID: "Pago",
        OVERDUE: "Atrasado",
        AGENDADO: "Agendado",
        CONFIRMADO: "Confirmado",
        FINALIZADO: "Finalizado",
        CANCELADO: "Cancelado",
        PENDENTE: "Pendente",
        PAGO: "Pago",
        ATRASADO: "Atrasado"
    }[status] || status;
}

function translateDocumentType(type) {
    return {
        REPORT: "Relatório",
        ANAMNESIS: "Anamnese",
        CERTIFICATE: "Atestado",
        EVOLUTION: "Evolução",
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
