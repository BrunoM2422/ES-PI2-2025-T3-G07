/*
    Autores originais:
        Bruno Lenitta Machado
        Nicolas Mitjans Nunes
    Atualização: Sistema de Médias e Notas (Fix edição + botão estilizado - 2025)
*/

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

let data = { institutions: [] };
let path = [];

// ===== Renderização da Tabela =====
function renderTable() {
    tableBody.innerHTML = "";
    let rows = [];
    noRecords.style.display = "none";

    let gradingDiv = document.getElementById("grading-div");
    if (gradingDiv) gradingDiv.remove();

    // ===== Nível 0 - Instituições =====
    if (path.length === 0) {
        pageTitle.textContent = "Instituições e Cursos Cadastrados";
        addBtn.textContent = "+ Adicionar Instituição";
        backBtn.classList.add("hidden");
        tableHeader.innerHTML = `<th>Instituição</th><th>Curso</th>`;
        rows = data.institutions.map((inst, idx) =>
            `<tr data-index="${idx}" data-type="institution"><td>${inst.name}</td><td>${inst.course}</td></tr>`
        );

    // ===== Nível 1 - Matérias =====
    } else if (path.length === 1) {
        const inst = data.institutions[path[0]];
        pageTitle.textContent = `Matérias do curso ${inst.course}`;
        addBtn.textContent = "+ Adicionar Matéria";
        backBtn.classList.remove("hidden");
        tableHeader.innerHTML = `<th>Curso</th><th>Matéria</th>`;
        rows = (inst.subjects || []).map((subj, idx) =>
            `<tr data-index="${idx}" data-type="subject"><td>${inst.course}</td><td>${subj.name}</td></tr>`
        );

    // ===== Nível 2 - Turmas =====
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

    // ===== Nível 3 - Alunos =====
    } else if (path.length === 3) {
        const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
        pageTitle.textContent = `Alunos da turma ${cls.number}`;
        addBtn.textContent = "+ Adicionar Aluno";
        backBtn.classList.remove("hidden");

        // Cabeçalho
        tableHeader.innerHTML = `<th>Nome</th><th>RA</th>`;
        if (cls.grading && cls.grading.components.length) {
            cls.grading.components.forEach((c, i) => {
                tableHeader.innerHTML += `<th class="component-header" data-index="${i}" title="Clique para editar/remover">${c.name}${cls.grading.type === "Ponderada" ? ` (${c.weight})` : ""}</th>`;
            });
            tableHeader.innerHTML += `<th>Média</th>`;
        }

        // Linhas de alunos
        rows = (cls.students || []).map((stu, idx) => {
            let row = `<tr><td>${stu.name}</td><td>${stu.ra}</td>`;
            if (!stu.grades) stu.grades = [];
            if (cls.grading && cls.grading.components.length) {
                cls.grading.components.forEach((c, i) => {
                    if (stu.grades[i] === undefined) stu.grades[i] = 0;
                    row += `<td contenteditable="true" data-comp="${i}" class="grade-cell">${stu.grades[i]}</td>`;
                });
                row += `<td>${stu.media !== undefined ? stu.media.toFixed(2) : "-"}</td>`;
            }
            row += "</tr>";
            return row;
        });

        // ===== Área de Média =====
        gradingDiv = document.createElement("div");
        gradingDiv.id = "grading-div";
        document.getElementById("content").appendChild(gradingDiv);

        if ((cls.students || []).length && !cls.grading) {
            const btn = document.createElement("button");
            btn.id = "add-average";
            btn.textContent = "+ Adicionar Média";
            btn.onclick = () => escolherTipoMedia(cls);
            gradingDiv.appendChild(btn);
        } else if (cls.grading) {
            const mediaInfo = document.createElement("h3");
            mediaInfo.textContent = `Tipo de Média: ${cls.grading.type}`;
            gradingDiv.appendChild(mediaInfo);

            // Novo botão estilizado
            const editBtn = document.createElement("button");
            editBtn.classList.add("edit-average-btn");
            editBtn.innerHTML = "✎ Editar Tipo de Média";
            editBtn.onclick = () => editarTipoMedia(cls);
            gradingDiv.appendChild(editBtn);

            const addCompBtn = document.createElement("button");
            addCompBtn.id = "add-comp";
            addCompBtn.textContent = "+ Adicionar Componente";
            addCompBtn.onclick = () => adicionarComponente(cls);
            gradingDiv.appendChild(addCompBtn);

            if (cls.grading.components.length) {
                const calcBtn = document.createElement("button");
                calcBtn.classList.add("btn-primary");
                calcBtn.textContent = "Calcular Média";
                calcBtn.onclick = () => calcularMedia(cls);
                gradingDiv.appendChild(calcBtn);
            }
        }
    }

    tableBody.innerHTML = rows.join("");

    if (!rows.length) {
        noRecords.style.display = "block";
        noRecords.textContent = "Nenhum registro encontrado.";
    }

    // ===== Edição estável de notas =====
    tableBody.querySelectorAll("td.grade-cell").forEach(td => {
        td.addEventListener("focus", () => {
            td.dataset.original = td.textContent.trim();
        });
    
        td.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                td.blur();
            }
        });
    
        td.addEventListener("blur", () => {
            let newValue = td.textContent.trim();
            const rowIndex = td.parentElement.rowIndex - 1;
            const compIndex = parseInt(td.dataset.comp);
            const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
    
            // Se não for número, volta ao valor original
            const grade = parseFloat(newValue);
            if (isNaN(grade)) {
                td.textContent = td.dataset.original;
                return;
            }
    
            // Validação de faixa (0 a 10)
            if (grade < 0 || grade > 10) {
                alert("A nota deve estar entre 0 e 10.");
                td.textContent = td.dataset.original;
                return;
            }
    
            // Atualiza apenas se o valor mudou
            if (grade != td.dataset.original) {
                cls.students[rowIndex].grades[compIndex] = grade;
            }
        });
    });
    

    // Clique no nome do componente (editar/remover)
    document.querySelectorAll(".component-header").forEach(th => {
        th.addEventListener("click", () => {
            const compIndex = parseInt(th.dataset.index);
            const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
            editarOuRemoverComponente(cls, compIndex);
        });
    });
}

// ===== Modal Dinâmico =====
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

closeModal.onclick = () => modal.classList.add("hidden");

// ===== Navegação (com fix) =====
tableBody.addEventListener("click", (e) => {
    // Evita navegação se clicou em célula editável
    if (e.target.classList.contains("grade-cell") || e.target.isContentEditable) {
        e.stopPropagation();
        return;
    }

    const row = e.target.closest("tr");
    if (!row) return;
    const idx = parseInt(row.dataset.index);
    const type = row.dataset.type;
    if (type === "institution") path = [idx];
    else if (type === "subject") path = [path[0], idx];
    else if (type === "class") path = [path[0], path[1], idx];
    renderTable();
});

backBtn.onclick = () => {
    path.pop();
    renderTable();
};

// ===== Adição de Entidades =====
addBtn.onclick = () => {
    if (path.length === 0) {
        openModal("Adicionar Instituição e Curso",
            `<input id="inst-name" placeholder="Nome da Instituição" required>
             <input id="inst-course" placeholder="Nome do Curso" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("inst-name").value.trim();
                const course = document.getElementById("inst-course").value.trim();
                if (name && course) data.institutions.push({ name, course, subjects: [] });
            });
    } else if (path.length === 1) {
        openModal("Adicionar Matéria",
            `<input id="subject-name" placeholder="Nome da Matéria" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("subject-name").value.trim();
                if (name) data.institutions[path[0]].subjects.push({ name, classes: [] });
            });
    } else if (path.length === 2) {
        openModal("Adicionar Turma",
            `<input id="class-number" placeholder="Número da Turma" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const number = document.getElementById("class-number").value.trim();
                if (number) data.institutions[path[0]].subjects[path[1]].classes.push({ number, students: [] });
            });
    } else if (path.length === 3) {
        openModal("Adicionar Aluno",
            `<input id="student-name" placeholder="Nome do Aluno" required>
             <input id="student-ra" placeholder="RA" required>
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

// ===== Média =====
function escolherTipoMedia(cls) {
    openModal("Escolher Tipo de Média",
        `<label><input type="radio" name="tipoMedia" value="Aritmética" checked> Média Aritmética</label><br>
         <label><input type="radio" name="tipoMedia" value="Ponderada"> Média Ponderada</label><br><br>
         <button type="submit">Confirmar</button>`,
        () => {
            const tipo = document.querySelector('input[name="tipoMedia"]:checked').value;
            cls.grading = { type: tipo, components: [] };
        });
}

function editarTipoMedia(cls) {
    if (confirm("Alterar o tipo de média removerá todos os componentes e notas. Deseja continuar?")) {
        escolherTipoMedia(cls);
        cls.students.forEach(stu => {
            stu.grades = [];
            stu.media = undefined;
        });
    }
}

function adicionarComponente(cls) {
    const isPonderada = cls.grading.type === "Ponderada";
    openModal("Adicionar Componente",
        `<input id="comp-name" placeholder="Nome do Componente" required>
         ${isPonderada ? '<input id="comp-weight" type="number" placeholder="Peso (0 a 10)" min="0" max="10" step="0.1" required>' : ''}
         <button type="submit">Adicionar</button>`,
        () => {
            const name = document.getElementById("comp-name").value.trim();
            const weight = isPonderada ? parseFloat(document.getElementById("comp-weight").value) : 1;
            if (name) cls.grading.components.push({ name, weight });
        });
}

function editarOuRemoverComponente(cls, index) {
    const comp = cls.grading.components[index];
    const isPonderada = cls.grading.type === "Ponderada";
    openModal("Editar ou Remover Componente",
        `<input id="edit-name" value="${comp.name}" placeholder="Nome" required>
         ${isPonderada ? `<input id="edit-weight" type="number" min="0" max="10" step="0.1" value="${comp.weight}">` : ""}
         <button type="submit">Salvar Alterações</button>
         <button type="button" id="remove-comp" style="background:#d9534f;color:white;border:none;border-radius:8px;padding:10px;margin-top:10px;">Remover Componente</button>`,
        () => {
            comp.name = document.getElementById("edit-name").value.trim();
            comp.weight = isPonderada ? parseFloat(document.getElementById("edit-weight").value) : 1;
        });

    setTimeout(() => {
        document.getElementById("remove-comp").onclick = () => {
            if (confirm("Deseja remover este componente?")) {
                cls.grading.components.splice(index, 1);
                cls.students.forEach(s => s.grades.splice(index, 1));
                modal.classList.add("hidden");
                renderTable();
            }
        };
    }, 100);
}

function calcularMedia(cls) {
    if (!cls.grading || !cls.grading.components.length) return alert("Adicione ao menos um componente.");
    const totalPeso = cls.grading.components.reduce((sum, c) => sum + c.weight, 0);
    if (cls.grading.type === "Ponderada" && totalPeso !== 10)
        return alert("A soma dos pesos deve ser exatamente 10.");

    cls.students.forEach(stu => {
        if (!stu.grades || !stu.grades.length) stu.media = 0;
        else if (cls.grading.type === "Aritmética") {
            const soma = stu.grades.reduce((a, b) => a + (parseFloat(b) || 0), 0);
            stu.media = soma / stu.grades.length;
        } else {
            const somaPond = stu.grades.reduce((acc, nota, i) => acc + nota * cls.grading.components[i].weight, 0);
            stu.media = somaPond / 10;
        }
    });
    renderTable();
}

// ===== Inicialização =====
renderTable();
