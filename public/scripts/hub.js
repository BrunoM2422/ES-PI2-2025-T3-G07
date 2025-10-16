const addBtn = document.getElementById("add-button");
const backBtn = document.getElementById("back-button");
const tableBody = document.getElementById("table-body");
const tableHeader = document.getElementById("table-header");
const pageTitle = document.getElementById("page-title");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalForm = document.getElementById("modal-form");
const closeModal = document.getElementById("close-modal");
const noRecords = document.getElementById("no-records");

let data = {
    institutions: []
};
let path = []; // Para saber em que nível estamos

function renderTable() {
    tableBody.innerHTML = "";
    noRecords.style.display = "none";
    let rows = [];

    if (path.length === 0) {
        // Instituições
        pageTitle.textContent = "Instituições e Cursos Cadastrados";
        addBtn.textContent = "+ Adicionar Instituição";
        backBtn.classList.add("hidden");
        tableHeader.innerHTML = `
            <th>Instituição</th>
            <th>Curso</th>
        `;
        rows = data.institutions.map((inst, idx) => `
            <tr data-index="${idx}" data-type="institution">
                <td>${inst.name}</td>
                <td>${inst.course}</td>
            </tr>
        `);
    } else if (path.length === 1) {
        // Matérias do curso
        const inst = data.institutions[path[0]];
        pageTitle.textContent = `Matérias do curso ${inst.course}`;
        addBtn.textContent = "+ Adicionar Matéria";
        backBtn.classList.remove("hidden");
        tableHeader.innerHTML = `
            <th>Curso</th>
            <th>Matéria</th>
        `;
        rows = (inst.subjects || []).map((subj, idx) => `
            <tr data-index="${idx}" data-type="subject">
                <td>${inst.course}</td>
                <td>${subj.name}</td>
            </tr>
        `);
    } else if (path.length === 2) {
        // Turmas
        const inst = data.institutions[path[0]];
        const subj = inst.subjects[path[1]];
        pageTitle.textContent = `Turmas de ${subj.name}`;
        addBtn.textContent = "+ Adicionar Turma";
        tableHeader.innerHTML = `
            <th>Matéria</th>
            <th>Turma</th>
        `;
        rows = (subj.classes || []).map((cls, idx) => `
            <tr data-index="${idx}" data-type="class">
                <td>${subj.name}</td>
                <td>${cls.number}</td>
            </tr>
        `);
    } else if (path.length === 3) {
        // Alunos
        const inst = data.institutions[path[0]];
        const subj = inst.subjects[path[1]];
        const cls = subj.classes[path[2]];
        pageTitle.textContent = `Alunos da turma ${cls.number}`;
        addBtn.textContent = "+ Adicionar Aluno";
        tableHeader.innerHTML = `
            <th>Nome</th>
            <th>RA</th>
        `;
        rows = (cls.students || []).map((stu, idx) => `
            <tr>
                <td>${stu.name}</td>
                <td>${stu.ra}</td>
            </tr>
        `);
    }

    if (rows.length === 0) {
        noRecords.style.display = "block";
    }
    tableBody.innerHTML = rows.join("");
}

// Modal
addBtn.onclick = () => {
    modal.classList.remove("hidden");
    modalForm.innerHTML = "";
    if (path.length === 0) {
        modalTitle.textContent = "Adicionar Instituição e Curso";
        modalForm.innerHTML = `
            <input type="text" id="inst-name" placeholder="Nome da Instituição" required>
            <input type="text" id="inst-course" placeholder="Nome do Curso" required>
            <button type="submit">Adicionar</button>
        `;
    } else if (path.length === 1) {
        modalTitle.textContent = "Adicionar Matéria";
        modalForm.innerHTML = `
            <input type="text" id="subject-name" placeholder="Nome da Matéria" required>
            <button type="submit">Adicionar</button>
        `;
    } else if (path.length === 2) {
        modalTitle.textContent = "Adicionar Turma";
        modalForm.innerHTML = `
            <input type="text" id="class-number" placeholder="Número da Turma" required>
            <button type="submit">Adicionar</button>
        `;
    } else if (path.length === 3) {
        modalTitle.textContent = "Adicionar Aluno";
        modalForm.innerHTML = `
            <input type="text" id="student-name" placeholder="Nome do Aluno" required>
            <input type="text" id="student-ra" placeholder="RA" required>
            <button type="submit">Adicionar</button>
        `;
    }
};

closeModal.onclick = () => modal.classList.add("hidden");

modalForm.onsubmit = (e) => {
    e.preventDefault();
    if (path.length === 0) {
        const name = document.getElementById("inst-name").value.trim();
        const course = document.getElementById("inst-course").value.trim();
        if (name && course) {
            data.institutions.push({ name, course, subjects: [] });
        }
    } else if (path.length === 1) {
        const subject = document.getElementById("subject-name").value.trim();
        if (subject) {
            data.institutions[path[0]].subjects.push({ name: subject, classes: [] });
        }
    } else if (path.length === 2) {
        const number = document.getElementById("class-number").value.trim();
        if (number) {
            data.institutions[path[0]].subjects[path[1]].classes.push({ number, students: [] });
        }
    } else if (path.length === 3) {
        const name = document.getElementById("student-name").value.trim();
        const ra = document.getElementById("student-ra").value.trim();
        if (name && ra) {
            data.institutions[path[0]].subjects[path[1]].classes[path[2]].students.push({ name, ra });
        }
    }
    modal.classList.add("hidden");
    renderTable();
};

// Clique em linha
tableBody.onclick = (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const idx = parseInt(row.dataset.index);
    const type = row.dataset.type;
    if (type === "institution") path = [idx];
    else if (type === "subject") path = [path[0], idx];
    else if (type === "class") path = [path[0], path[1], idx];
    else return;
    renderTable();
};

backBtn.onclick = () => {
    path.pop();
    renderTable();
};

renderTable();
