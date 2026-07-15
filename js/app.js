const API_BASE_URL = "https://zenithcrm-deploy.onrender.com";
const APP_HOME = "/dashboard.html";
const SESSION_VALUES_KEY = "zenithPatientSessionValues";
const ATTENDANCE_KEY = "zenithAttendanceStatus";

const state = {
    token: localStorage.getItem("zenithToken"),
    user: JSON.parse(localStorage.getItem("zenithUser") || "null"),
    patients: [],
    appointments: [],
    payments: [],
    documents: [],
    financeSummary: null,
    patientSessionValues: readLocalJson(SESSION_VALUES_KEY, {}),
    attendanceStatus: readLocalJson(ATTENDANCE_KEY, {})
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

    if (isAppPage() && state.token) {
        showPageSkeleton();
    }

    try {
        await renderShell();
    } catch (error) {
        console.error(error);
        setMessage("appMessage", error.message);
    } finally {
        hidePageSkeleton();
    }
});

function currentPage() {
    return document.body.dataset.page || "login";
}

function isAppPage() {
    return currentPage() !== "login";
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

function showPageSkeleton() {
    const appView = byId("appView");
    if (!appView) return;

    byId("authView")?.classList.add("hidden");
    appView.classList.remove("hidden");
    appView.classList.add("is-loading");
    ensurePageSkeleton();
}

function hidePageSkeleton() {
    byId("appView")?.classList.remove("is-loading");
}

function ensurePageSkeleton() {
    if (byId("pageSkeleton")) return;

    const workspace = document.querySelector(".workspace");
    if (!workspace) return;

    const skeleton = document.createElement("section");
    skeleton.id = "pageSkeleton";
    skeleton.className = `page-skeleton page-skeleton-${currentPage()}`;
    skeleton.innerHTML = pageSkeletonMarkup(currentPage());
    workspace.appendChild(skeleton);
}

function pageSkeletonMarkup(page) {
    if (page === "dashboard") {
        return `
            <div class="skeleton-grid">${skeletonCards(4)}</div>
            <div class="skeleton-split">
                <div class="skeleton-block skeleton-block-large"></div>
                <div class="skeleton-block skeleton-block-large"></div>
            </div>
            <div class="skeleton-split">
                <div class="skeleton-block"></div>
                <div class="skeleton-block"></div>
            </div>
        `;
    }

    return `
        <div class="skeleton-form">${skeletonLines(page === "documents" ? 4 : 8)}</div>
        <div class="skeleton-block skeleton-block-table"></div>
    `;
}

function skeletonCards(total) {
    return Array.from({ length: total }, () => '<div class="skeleton skeleton-card-inline"></div>').join("");
}

function skeletonLines(total) {
    return Array.from({ length: total }, () => '<div class="skeleton skeleton-line"></div>').join("");
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
        await savePatient(formData(event.target), event.target);
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
        window.location.href = APP_HOME;
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
        state.financeSummary = summary || {};
        state.documents = documents || [];

        renderAll();
    } catch (error) {
        setMessage("appMessage", error.message);
    }
}

function renderAll() {
    renderPatients();
    renderPatientOptions();
    renderAppointments();
    renderPayments();
    renderDocuments();
    renderDashboard();
    renderDayAgenda();
    renderCharts();
}

async function savePatient(data, form) {
    const sessionValue = data.sessionValue;
    const patientIdentity = {
        id: data.id,
        fullName: data.fullName,
        email: data.email,
        cpf: data.cpf
    };


    try {
        showLoading("Salvando...");
        removeEmptyStrings(data);
        const id = data.id;
        const saved = await request(id ? `/api/patients/${id}` : "/api/patients", {
            method: id ? "PUT" : "POST",
            body: data
        });

        clearForm(form);
        await loadAll();

        const patientId = id || saved?.id || findPatientId(patientIdentity);
        if (patientId) {
            setPatientSessionValue(patientId, sessionValue);
            renderAll();
        }

        setMessage("appMessage", "Paciente salvo com valor de sessão vinculado.");
    } catch (error) {
        setMessage("appMessage", error.message);
    } finally {
        hideLoading();
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
            <td>${formatOptionalCurrency(getPatientSessionValue(patient.id))}</td>
            <td class="actions">
                <button type="button" onclick="editPatient(${patient.id})">Editar</button>
                <button type="button" class="danger" onclick="deleteRecord('/api/patients', ${patient.id})">Excluir</button>
            </td>
        </tr>
    `).join("");
    table.innerHTML = rows || emptyRow(5);
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

    const rows = sortedAppointments().map(item => `
        <tr>
            <td>${escapeHtml(getAppointmentPatientName(item))}</td>
            <td>${formatDateTime(item.startsAt)}</td>
            <td>${formatOptionalCurrency(getAppointmentSessionValue(item))}</td>
            <td class="status-${item.status}">${translateStatus(item.status)}</td>
            <td>${attendanceBadge(item.id)}</td>
            <td>${item.googleCalendarUrl ? `<a href="${item.googleCalendarUrl}" target="_blank" rel="noreferrer">Abrir</a>` : ""}</td>
            <td class="actions">
                <button type="button" onclick="editAppointment(${item.id})">Editar</button>
                <button type="button" class="danger" onclick="deleteRecord('/api/appointments', ${item.id})">Excluir</button>
            </td>
        </tr>
    `).join("");
    table.innerHTML = rows || emptyRow(7);
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

    byId("dashboardAppointments").innerHTML = sortedAppointments().slice(0, 6).map(item => `
        <tr><td>${escapeHtml(getAppointmentPatientName(item))}</td><td>${formatDateTime(item.startsAt)}</td><td>${translateStatus(item.status)}</td></tr>
    `).join("") || emptyRow(3);

    byId("dashboardFinance").innerHTML = `
        <tr><td>Pago</td><td>${state.financeSummary?.paidCount || 0}</td><td>${currency(state.financeSummary?.received || 0)}</td></tr>
        <tr><td>Pendente</td><td>${state.financeSummary?.pendingCount || 0}</td><td>${currency(state.financeSummary?.pending || 0)}</td></tr>
        <tr><td>Atrasado</td><td>${state.financeSummary?.overdueCount || 0}</td><td>${currency(state.financeSummary?.overdue || 0)}</td></tr>
    `;
}

function renderDayAgenda() {
    const todayItems = appointmentsForToday();
    const todayLabel = new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long"
    });

    setMessage("dayAgendaDate", todayLabel);
    setMessage("dashboardDayAgendaDate", todayLabel);

    renderAgendaList("dayAgendaList", todayItems);
    renderAgendaList("dashboardDayAgendaList", todayItems);
}

function renderAgendaList(targetId, items) {
    const list = byId(targetId);
    if (!list) return;

    list.innerHTML = items.map(item => {
        const canAct = canStartAppointment(item);
        return `
            <article class="day-agenda-item">
                <time>${formatTime(item.startsAt)}</time>
                <div>
                    <strong>${escapeHtml(getAppointmentPatientName(item))}</strong>
                    <span>${formatOptionalCurrency(getAppointmentSessionValue(item))} · ${translateStatus(item.status)}</span>
                </div>
                <div class="attendance-actions">
                    <button type="button" ${canAct ? "" : "disabled"} onclick="setAttendanceStatus(${item.id}, 'STARTED')">Iniciar</button>
                    <button type="button" class="secondary" onclick="setAttendanceStatus(${item.id}, 'FINISHED')">Finalizar</button>
                    <button type="button" class="danger" onclick="setAttendanceStatus(${item.id}, 'ABSENT')">Ausência</button>
                </div>
                ${attendanceBadge(item.id)}
            </article>
        `;
    }).join("") || '<p class="muted">Nenhum atendimento para hoje.</p>';
}

function renderCharts() {
    renderWeeklyAppointmentsChart();
    renderFinanceChart();
}

function renderWeeklyAppointmentsChart() {
    const chart = byId("weeklyAppointmentsChart");
    if (!chart) return;

    const days = nextDays(7);
    const counts = days.map(day => state.appointments.filter(item => isSameDate(item.startsAt, day)).length);
    const max = Math.max(...counts, 1);

    chart.innerHTML = days.map((day, index) => {
        const percent = Math.max(8, (counts[index] / max) * 100);
        return `
            <div class="bar-chart-item">
                <div class="bar-track"><span style="height: ${percent}%"></span></div>
                <strong>${counts[index]}</strong>
                <small>${day.toLocaleDateString("pt-BR", { weekday: "short" })}</small>
            </div>
        `;
    }).join("");
}

function renderFinanceChart() {
    const chart = byId("financeChart");
    const legend = byId("financeLegend");
    if (!chart || !legend) return;

    const received = Number(state.financeSummary?.received || 0);
    const pending = Number(state.financeSummary?.pending || 0);
    const overdue = Number(state.financeSummary?.overdue || 0);
    const total = received + pending + overdue || 1;
    const receivedEnd = (received / total) * 360;
    const pendingEnd = receivedEnd + (pending / total) * 360;

    chart.style.background = `conic-gradient(#1f6845 0deg ${receivedEnd}deg, #134ad9 ${receivedEnd}deg ${pendingEnd}deg, #8b1e1e ${pendingEnd}deg 360deg)`;
    chart.innerHTML = `<strong>${currency(received + pending + overdue)}</strong><span>Total</span>`;
    legend.innerHTML = `
        <span><i class="legend-ok"></i>Recebido ${currency(received)}</span>
        <span><i class="legend-primary"></i>Pendente ${currency(pending)}</span>
        <span><i class="legend-danger"></i>Atrasado ${currency(overdue)}</span>
    `;
}

function editPatient(id) {
    const patient = state.patients.find(item => item.id === id);
    fillForm("patientForm", {
        ...patient,
        sessionValue: getPatientSessionValue(id) || ""
    });
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

function setAttendanceStatus(id, status) {
    state.attendanceStatus[id] = status;
    writeLocalJson(ATTENDANCE_KEY, state.attendanceStatus);
    renderAppointments();
    renderDayAgenda();
}

function attendanceBadge(id) {
    const status = state.attendanceStatus[id];
    const label = {
        STARTED: "Em atendimento",
        FINISHED: "Finalizado",
        ABSENT: "Ausência"
    }[status] || "Aguardando";

    return `<span class="attendance-badge attendance-${status || "WAITING"}">${label}</span>`;
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

function findPatientId(identity) {
    const found = state.patients.find(patient => {
        if (identity.cpf && patient.cpf === identity.cpf) return true;
        if (identity.email && patient.email === identity.email) return true;
        return identity.fullName && patient.fullName === identity.fullName;
    });

    return found?.id;
}

function setPatientSessionValue(patientId, value) {
    if (value === "" || value === null || value === undefined) {
        delete state.patientSessionValues[patientId];
    } else {
        state.patientSessionValues[patientId] = Number(value);
    }

    writeLocalJson(SESSION_VALUES_KEY, state.patientSessionValues);
}

function getPatientSessionValue(patientId) {
    return state.patientSessionValues[patientId];
}

function getAppointmentSessionValue(appointment) {
    const patient = getAppointmentPatient(appointment);
    return patient ? getPatientSessionValue(patient.id) : null;
}

function getAppointmentPatient(appointment) {
    return state.patients.find(patient =>
        Number(patient.id) === Number(appointment.patientId) ||
        patient.fullName === appointment.patientName
    );
}

function getAppointmentPatientName(appointment) {
    return appointment.patientName || getAppointmentPatient(appointment)?.fullName || "";
}

function sortedAppointments() {
    return [...state.appointments].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

function appointmentsForToday() {
    return sortedAppointments().filter(item => isSameDate(item.startsAt, new Date()));
}

function canStartAppointment(appointment) {
    const startsAt = new Date(appointment.startsAt).getTime();
    const now = Date.now();
    return now >= startsAt - 15 * 60 * 1000;
}

function nextDays(total) {
    return Array.from({ length: total }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index);
        date.setHours(0, 0, 0, 0);
        return date;
    });
}

function isSameDate(value, date) {
    if (!value) return false;
    const current = new Date(value);
    return current.getFullYear() === date.getFullYear() &&
        current.getMonth() === date.getMonth() &&
        current.getDate() === date.getDate();
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

function formatOptionalCurrency(value) {
    return value || value === 0 ? currency(value) : "Não definido";
}

function formatDate(value) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "";
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString("pt-BR") : "";
}

function formatTime(value) {
    return value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
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

function readLocalJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
}

function writeLocalJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
