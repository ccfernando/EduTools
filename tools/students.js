const API = "/api/students";

const yearSelect = document.getElementById("year-select");
const sectionSelect = document.getElementById("section-select");
const tbody = document.getElementById("students-tbody");
const modal = document.getElementById("student-modal");
const form = document.getElementById("student-form");
const sectionsList = document.getElementById("sections-list");
const passwordInput = document.getElementById("student-password");
const passwordHint = document.getElementById("student-password-hint");

function updatePasswordUi(isEditMode) {
    passwordInput.required = !isEditMode;
    passwordInput.placeholder = isEditMode ? "Leave blank to keep current password" : "Create a student password";
    passwordHint.textContent = isEditMode
        ? "Leave this blank to keep the student's current password."
        : "This password is used for student login.";
}

function clearElement(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function createIconButton(className, title, svgMarkup) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn-icon ${className}`;
    button.title = title;
    button.innerHTML = svgMarkup;
    return button;
}

function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text || "";
    return cell;
}

function renderEmptyState(message) {
    clearElement(tbody);
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "loading";
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
}

function openEditModal(student) {
    document.getElementById("modal-title").textContent = "Edit Student";
    document.getElementById("student-id").value = student.id;
    document.getElementById("student-firstname").value = student.firstname;
    document.getElementById("student-lastname").value = student.lastname;
    document.getElementById("student-email").value = student.email || "";
    document.getElementById("student-section").value = student.section;
    document.getElementById("student-year").value = student.year;
    document.getElementById("student-password").value = "";
    updatePasswordUi(true);
    modal.classList.remove("hidden");
}

function renderStudents(students) {
    clearElement(tbody);

    const editIcon = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
    `;
    const deleteIcon = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
    `;

    for (const student of students) {
        const row = document.createElement("tr");
        row.appendChild(createCell(student.firstname));
        row.appendChild(createCell(student.lastname));
        row.appendChild(createCell(student.email));
        row.appendChild(createCell(student.section));
        row.appendChild(createCell(String(student.year)));

        const actionsCell = document.createElement("td");
        actionsCell.className = "actions";

        const editButton = createIconButton("edit", "Edit", editIcon);
        editButton.addEventListener("click", () => openEditModal(student));

        const deleteButton = createIconButton("delete", "Delete", deleteIcon);
        deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete this student?")) return;
            await Auth.api(`${API}?id=${encodeURIComponent(student.id)}`, { method: "DELETE" });
            await loadSections();
            await loadStudents();
        });

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell);
        tbody.appendChild(row);
    }
}

async function loadStudents() {
    const year = yearSelect.value;
    const section = sectionSelect.value;

    let url = `${API}?year=${encodeURIComponent(year)}`;
    if (section) url += `&section=${encodeURIComponent(section)}`;

    const students = await Auth.api(url).then(r => r.json());

    if (!students.length) {
        renderEmptyState("No students found");
        return;
    }

    renderStudents(students);
}

async function loadSections() {
    const year = yearSelect.value;
    const sections = await Auth.api(`/api/sections?year=${encodeURIComponent(year)}`).then(r => r.json());

    clearElement(sectionSelect);
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All Sections";
    sectionSelect.appendChild(allOption);

    clearElement(sectionsList);
    for (const section of sections) {
        const option = document.createElement("option");
        option.value = section;
        option.textContent = section;
        sectionSelect.appendChild(option.cloneNode(true));

        const datalistOption = document.createElement("option");
        datalistOption.value = section;
        sectionsList.appendChild(datalistOption);
    }
}

yearSelect.addEventListener("change", async () => {
    await loadSections();
    await loadStudents();
});

sectionSelect.addEventListener("change", loadStudents);

document.getElementById("add-student-btn").addEventListener("click", () => {
    document.getElementById("modal-title").textContent = "Add Student";
    form.reset();
    document.getElementById("student-id").value = "";
    document.getElementById("student-year").value = yearSelect.value;
    updatePasswordUi(false);
    modal.classList.remove("hidden");
});

document.getElementById("cancel-btn").addEventListener("click", () => {
    modal.classList.add("hidden");
});

form.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("student-id").value;
    const data = {
        firstname: document.getElementById("student-firstname").value.trim(),
        lastname: document.getElementById("student-lastname").value.trim(),
        email: document.getElementById("student-email").value.trim(),
        password: document.getElementById("student-password").value,
        section: document.getElementById("student-section").value.trim(),
        year: Number.parseInt(document.getElementById("student-year").value, 10)
    };

    if (!id && !data.password) {
        alert("Password is required when creating a student.");
        return;
    }

    const request = {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    };

    const url = id ? `${API}?id=${encodeURIComponent(id)}` : API;
    await Auth.api(url, request);

    modal.classList.add("hidden");
    await loadSections();
    await loadStudents();
});

document.getElementById("csv-upload-btn").addEventListener("click", () => {
    document.getElementById("csv-upload").click();
});

document.getElementById("csv-upload").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    const loading = document.getElementById("loading-overlay");
    loading.style.display = "flex";

    try {
        const text = await file.text();
        const response = await Auth.api("/api/students/batch", {
            method: "POST",
            headers: { "Content-Type": "text/csv" },
            body: text
        });

        const result = await response.json();
        if (result.error) {
            alert("Error: " + result.error);
        } else {
            alert(`Added ${result.count} students`);
        }
    } finally {
        loading.style.display = "none";
        event.target.value = "";
    }

    await loadSections();
    await loadStudents();
});

updatePasswordUi(false);
loadSections().then(loadStudents);
