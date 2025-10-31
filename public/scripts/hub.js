// ===== Referências principais =====
const addBtn = document.getElementById("add-button");
const backBtn = document.getElementById("back-button");
const tableBody = document.getElementById("table-body");
const tableHeader = document.getElementById("table-header");
const pageTitle = document.getElementById("page-title");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalForm = document.getElementById("modal-form");
const noRecords = document.getElementById("no-records");
const closeModal = document.getElementById("close-modal");

// ===== Estrutura principal (dados em memória) =====
let data = { institutions: [] };
let path = []; // 0 = instituição, 1 = matéria, 2 = turma, 3 = alunos

// ===== Função principal de renderização =====
function renderTable() {
    tableBody.innerHTML = "";
    let rows = [];

    // Sempre esconder e limpar "Nenhum registro encontrado"
    noRecords.style.display = "none";
    noRecords.textContent = "";

    // Remover ou resetar o gradingDiv ao trocar de nível
    let gradingDiv = document.getElementById("grading-div");
    if (gradingDiv) gradingDiv.remove();

    // ================= Nível 0 - Instituições =================
    if (path.length === 0) {
        pageTitle.textContent = "Instituições e Cursos Cadastrados";
        addBtn.textContent = "+ Adicionar Instituição";
        backBtn.classList.add("hidden");
        tableHeader.innerHTML = `<th>Instituição</th><th>Curso</th>`;
        rows = data.institutions.map((inst, idx) =>
            `<tr data-index="${idx}" data-type="institution"><td>${inst.name}</td><td>${inst.course}</td></tr>`
        );

    // ================= Nível 1 - Matérias =================
    } else if (path.length === 1) {
        const inst = data.institutions[path[0]];
        pageTitle.textContent = `Matérias do curso ${inst.course}`;
        addBtn.textContent = "+ Adicionar Matéria";
        backBtn.classList.remove("hidden");
        tableHeader.innerHTML = `<th>Curso</th><th>Matéria</th>`;
        rows = (inst.subjects || []).map((subj, idx) =>
            `<tr data-index="${idx}" data-type="subject"><td>${inst.course}</td><td>${subj.name}</td></tr>`
        );

    // ================= Nível 2 - Turmas =================
    } else if (path.length === 2) {
        const inst = data.institutions[path[0]];
        const subj = inst.subjects[path[1]];
        pageTitle.textContent = `Turmas de ${subj.name}`;
        addBtn.textContent = "+ Adicionar Turma";
        backBtn.classList.remove("hidden");
        tableHeader.innerHTML = `<th>Matéria</th><th>Turma</th>`;
        rows = (subj.classes || []).map((cls, idx) =>
            `<tr data-index="${idx}" data-type="class"><td>${subj.name}</td><td>${cls.number}</td></tr>`
        );

    // ================= Nível 3 - Alunos =================
    } else if (path.length === 3) {
        const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
        pageTitle.textContent = `Alunos da turma ${cls.number}`;
        addBtn.textContent = "+ Adicionar Aluno";
        backBtn.classList.remove("hidden");

        // Cabeçalho básico
        tableHeader.innerHTML = `<th>Nome</th><th>RA</th>`;
        if (cls.grading && cls.grading.components.length) {
            cls.grading.components.forEach(c => tableHeader.innerHTML += `<th>${c.name}</th>`);
        }

        // Linhas de alunos
        rows = (cls.students || []).map((stu, idx) => {
            let row = `<tr><td>${stu.name}</td><td>${stu.ra}</td>`;
            if (cls.grading && cls.grading.components.length) {
                cls.grading.components.forEach((c, i) => {
                    if (!stu.grades) stu.grades = [];
                    if (stu.grades[i] === undefined) stu.grades[i] = 0;
                    row += `<td contenteditable="true" data-comp="${i}">${stu.grades[i]}</td>`;
                });
            }
            row += "</tr>";
            return row;
        });

        // ===== Área de média =====
        gradingDiv = document.createElement("div");
        gradingDiv.id = "grading-div";
        gradingDiv.classList.add("grading-container");
        document.getElementById("content").appendChild(gradingDiv);

        if ((cls.students || []).length && !cls.grading) {
            const btn = document.createElement("button");
            btn.id = "add-average";
            btn.textContent = "+ Adicionar Média";
            btn.classList.add("btn-primary");
            btn.onclick = () => escolherTipoMedia(cls);
            gradingDiv.appendChild(btn);
        } else if (cls.grading) {
            const btn = document.createElement("button");
            btn.id = "add-comp";
            btn.textContent = "+ Adicionar Componente";
            btn.classList.add("btn-primary");
            btn.onclick = () => adicionarComponente(cls);
            gradingDiv.appendChild(btn);
        }
    }

    // Exibir as linhas geradas
    tableBody.innerHTML = rows.join("");

    // Mostrar "Nenhum registro" apenas se realmente não houver nada
    if (!rows.length) {
        noRecords.style.display = "block";
        noRecords.textContent = "Nenhum registro encontrado.";
    }

    // Atualizar notas inline
    tableBody.querySelectorAll("td[contenteditable=true]").forEach(td => {
        td.addEventListener("input", () => {
            const rowIndex = td.parentElement.rowIndex - 1;
            const compIndex = parseInt(td.dataset.comp);
            const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
            cls.students[rowIndex].grades[compIndex] = parseFloat(td.textContent) || 0;
        });
    });
}

// ===== Modal dinâmico =====
function openModal(title, innerHTML, onSubmit) {
    modalTitle.textContent = title;
    modalForm.innerHTML = innerHTML;
    modal.classList.remove("hidden");

    modalForm.onsubmit = (e) => {
        e.preventDefault();
        onSubmit();
        modal.classList.add("hidden");
        renderTable();
    };
}

// ===== Eventos =====
addBtn.onclick = () => {
    if (path.length === 0) {
        openModal("Adicionar Instituição e Curso",
            `<input type="text" id="inst-name" placeholder="Nome da Instituição" required>
             <input type="text" id="inst-course" placeholder="Nome do Curso" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("inst-name").value.trim();
                const course = document.getElementById("inst-course").value.trim();
                if (name && course) data.institutions.push({ name, course, subjects: [] });
            });
    } else if (path.length === 1) {
        openModal("Adicionar Matéria",
            `<input type="text" id="subject-name" placeholder="Nome da Matéria" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const subject = document.getElementById("subject-name").value.trim();
                if (subject) data.institutions[path[0]].subjects.push({ name: subject, classes: [] });
            });
    } else if (path.length === 2) {
        openModal("Adicionar Turma",
            `<input type="text" id="class-number" placeholder="Número da Turma" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const number = document.getElementById("class-number").value.trim();
                if (number) data.institutions[path[0]].subjects[path[1]].classes.push({ number, students: [] });
            });
    } else if (path.length === 3) {
        openModal("Adicionar Aluno",
            `<input type="text" id="student-name" placeholder="Nome do Aluno" required>
             <input type="text" id="student-ra" placeholder="RA" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("student-name").value.trim();
                const ra = document.getElementById("student-ra").value.trim();
                if (name && ra) {
                    const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
                    cls.students.push({ name, ra, grades: [] });
                }
            });
    }
};

// ===== Fechar modal =====
closeModal.onclick = () => modal.classList.add("hidden");

// ===== Navegação =====
tableBody.onclick = (e) => {
    const row = e.target.closest("tr");
    if (!row) return;
    const idx = parseInt(row.dataset.index);
    const type = row.dataset.type;
    if (type === "institution") path = [idx];
    else if (type === "subject") path = [path[0], idx];
    else if (type === "class") path = [path[0], path[1], idx];
    renderTable();
};

backBtn.onclick = () => {
    path.pop();
    renderTable();
};

// ===== Funções de Média =====
function escolherTipoMedia(cls) {
    openModal("Escolher Tipo de Média",
        `<div style="text-align:center">
            <label><input type="radio" name="tipoMedia" value="Aritmetica" checked> Média Aritmética</label><br>
            <label><input type="radio" name="tipoMedia" value="Ponderada"> Média Ponderada</label><br><br>
            <button type="submit">Confirmar</button>
        </div>`,
        () => {
            const tipo = document.querySelector('input[name="tipoMedia"]:checked').value;
            cls.grading = { type: tipo, components: [] };
        });
}

function adicionarComponente(cls) {
    const isPonderada = cls.grading.type === "Ponderada";
    openModal("Adicionar Componente de Nota",
        `<input type="text" id="comp-name" placeholder="Nome do Componente" required>
         ${isPonderada ? `<input type="number" id="comp-weight" placeholder="Peso (0 a 10)" min="0" max="10" step="0.1" required>` : ""}
         <button type="submit">Adicionar</button>`,
        () => {
            const name = document.getElementById("comp-name").value.trim();
            const weight = isPonderada ? parseFloat(document.getElementById("comp-weight").value) : 1;
            cls.grading.components.push({ name, weight });
        });
}

// ===== Inicialização =====
renderTable();
