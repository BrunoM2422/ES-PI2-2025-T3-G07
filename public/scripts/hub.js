/*
    Autores originais:
        Bruno Lenitta Machado
        Nicolas Mitjans Nunes
    Atualização: Sistema de Médias e Notas + Novos campos de disciplina e turma + componentes com apelido/descrição (2025)
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

    // ===== Nível 1 - Disciplinas (com código, período e apelido) =====
    } else if (path.length === 1) {
        const inst = data.institutions[path[0]];
        pageTitle.textContent = `Disciplinas do curso ${inst.course}`;
        addBtn.textContent = "+ Adicionar Disciplina";
        backBtn.classList.remove("hidden");

        tableHeader.innerHTML = `<th>Disciplina</th><th>Código</th><th>Período</th><th>Apelido</th>`;

        rows = (inst.subjects || []).map((subj, idx) =>
            `<tr data-index="${idx}" data-type="subject">
                <td>${subj.name}</td>
                <td>${subj.code}</td>
                <td>${subj.period}</td>
                <td>${subj.nickname || "-"}</td>
            </tr>`
        );

    // ===== Nível 2 - Turmas (com apelido, dia, horário e local) =====
    } else if (path.length === 2) {
        const inst = data.institutions[path[0]];
        const subj = inst.subjects[path[1]];
        pageTitle.textContent = `Turmas de ${subj.name}`;
        addBtn.textContent = "+ Adicionar Turma";
        backBtn.classList.remove("hidden");

        tableHeader.innerHTML = `
            <th>Turma</th>
            <th>Apelido</th>
            <th>Dia</th>
            <th>Horário</th>
            <th>Local</th>
        `;

        rows = (subj.classes || []).map((cls, idx) =>
            `<tr data-index="${idx}" data-type="class">
                <td>${cls.number}</td>
                <td>${cls.nickname || "-"}</td>
                <td>${cls.day || "-"}</td>
                <td>${cls.time}</td>
                <td>${cls.location}</td>
            </tr>`
        );

    // ===== Nível 3 - Alunos =====
    } else if (path.length === 3) {
        const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
        pageTitle.textContent = `Alunos da turma ${cls.number}`;
        addBtn.textContent = "+ Adicionar Aluno";
        backBtn.classList.remove("hidden");

        tableHeader.innerHTML = `<th>Nome</th><th>RA</th>`;
        if (cls.grading && cls.grading.components.length) {
            cls.grading.components.forEach((c, i) => {
                // usa apelido (nickname) na coluna
                tableHeader.innerHTML += `<th class="component-header" data-index="${i}" title="Clique para editar/remover">${c.nickname}${cls.grading.type === "Ponderada" ? ` (${c.weight})` : ""}</th>`;
            });
            tableHeader.innerHTML += `<th>Média</th>`;
        }

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

    // ===== after render: attach listeners for grade-cells and component headers =====

    // grade-cell stable editing
    tableBody.querySelectorAll("td.grade-cell").forEach(td => {
        // make cells editable (they already are via contenteditable)
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
            const newValue = td.textContent.trim();
            const rowIndex = td.parentElement.rowIndex - 1; // because header row present
            const compIndex = parseInt(td.dataset.comp);
            const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
            if (newValue !== td.dataset.original) {
                // parse float or zero
                cls.students[rowIndex].grades[compIndex] = parseFloat(newValue.replace(',', '.')) || 0;
            }
            // re-render to update media column if needed (but avoid losing focus loops)
            // only recalc/display, not necessary to call full render here
        });
    });

    // component-header click (attach to each th that has class)
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

    // focus first input if exists (small UX nicety)
    setTimeout(() => {
        const first = modalForm.querySelector("input, textarea, select");
        if (first) first.focus();
    }, 50);

    modalForm.onsubmit = (e) => {
        e.preventDefault();
        onSubmit();
        modal.classList.add("hidden");
        renderTable();
    };
}

closeModal.onclick = () => modal.classList.add("hidden");

// ===== Navegação =====
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

    // ===== Adicionar Disciplina (antes: Matéria) =====
    } else if (path.length === 1) {
        openModal("Adicionar Disciplina",
            `<input id="subject-name" placeholder="Nome da Disciplina" required>
             <input id="subject-code" placeholder="Código da Disciplina" required>
             <input id="subject-period" type="number" min="1" max="10" placeholder="Período (1 a 10)" required>
             <input id="subject-nickname" placeholder="Apelido da Disciplina (opcional)">
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("subject-name").value.trim();
                const code = document.getElementById("subject-code").value.trim();
                const period = parseInt(document.getElementById("subject-period").value);
                const nickname = document.getElementById("subject-nickname").value.trim() || "-";

                if (name && code && period >= 1 && period <= 10) {
                    data.institutions[path[0]].subjects.push({
                        name,
                        code,
                        period,
                        nickname,
                        classes: []
                    });
                } else {
                    alert("Preencha nome, código e período válido (1-10).");
                }
            });

    // ===== Adicionar Turma =====
    } else if (path.length === 2) {
        openModal("Adicionar Turma",
            `<input id="class-number" placeholder="Número da Turma" required>
             <input id="class-nickname" placeholder="Apelido da Turma (opcional)">

             <div class="week-days">
                <label><input type="checkbox" value="Segunda"><span>Segunda</span></label>
                <label><input type="checkbox" value="Terça"><span>Terça</span></label>
                <label><input type="checkbox" value="Quarta"><span>Quarta</span></label>
                <label><input type="checkbox" value="Quinta"><span>Quinta</span></label>
                <label><input type="checkbox" value="Sexta"><span>Sexta</span></label>
                <label><input type="checkbox" value="Sábado"><span>Sábado</span></label>
                <label><input type="checkbox" value="Domingo"><span>Domingo</span></label>
             </div>
             <br>

             <input id="class-time" placeholder="Horário (ex: 19:00 - 21:30)" required>
             <input id="class-location" placeholder="Local (ex: Sala 12)" required>

             <button type="submit">Adicionar</button>`,
            () => {
                const number = document.getElementById("class-number").value.trim();
                const nickname = document.getElementById("class-nickname").value.trim() || "-";

                const days = Array.from(document.querySelectorAll(".week-days input:checked"))
                                  .map(d => d.value);

                const time = document.getElementById("class-time").value.trim();
                const location = document.getElementById("class-location").value.trim();

                if (number && days.length > 0 && time && location) {
                    data.institutions[path[0]].subjects[path[1]].classes.push({
                        number,
                        nickname,
                        day: days.join(", "),
                        time,
                        location,
                        students: []
                    });
                } else {
                    alert("Selecione ao menos 1 dia da semana e preencha horário/local.");
                }
            });

    // ===== Adicionar Aluno =====
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

// ===== Adicionar Componente (ordem: Nome, Apelido obrigatório, Descrição, Peso se Ponderada) =====
function adicionarComponente(cls) {
    const isPonderada = cls.grading.type === "Ponderada";
    openModal("Adicionar Componente",
        `<input id="comp-name" placeholder="Nome interno (ex: Prova 1)" required>
         <input id="comp-nickname" placeholder="Apelido que aparecerá na tabela (ex: P1)" required>
         <textarea id="comp-desc" placeholder="Descrição (opcional, ex: Prova aplicada em 20/04)"></textarea>
         ${isPonderada ? '<input id="comp-weight" type="number" placeholder="Peso (0 a 10)" min="0" max="10" step="0.1" required>' : ''}
         <button type="submit">Adicionar</button>`,
        () => {
            const name = document.getElementById("comp-name").value.trim();
            const nickname = document.getElementById("comp-nickname").value.trim();
            const description = document.getElementById("comp-desc").value.trim();
            const weight = isPonderada ? parseFloat(document.getElementById("comp-weight").value) : 1;

            if (!name) return alert("Preencha o nome interno do componente.");
            if (!nickname) return alert("Preencha o apelido do componente (obrigatório).");

            // add component object with nickname + description
            cls.grading.components.push({ name, nickname, description, weight });

            // ensure each student has this grade index initialized
            cls.students.forEach(s => {
                if (!s.grades) s.grades = [];
                if (s.grades.length < cls.grading.components.length) s.grades.push(0);
            });
        });
}

// ===== Editar/Remover Componente (edita name, nickname, description, peso) =====
function editarOuRemoverComponente(cls, index) {
    const comp = cls.grading.components[index];
    const isPonderada = cls.grading.type === "Ponderada";

    // safety: if comp undefined (race) just return
    if (!comp) return alert("Componente não encontrado.");

    openModal("Editar ou Remover Componente",
        `<input id="edit-name" value="${comp.name.replace(/"/g, '&quot;')}" placeholder="Nome interno" required>
         <input id="edit-nickname" value="${(comp.nickname||'').replace(/"/g, '&quot;')}" placeholder="Apelido (coluna) (obrigatório)" required>
         <textarea id="edit-desc" placeholder="Descrição (opcional)">${comp.description ? comp.description.replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''}</textarea>
         ${isPonderada ? `<input id="edit-weight" type="number" min="0" max="10" step="0.1" value="${comp.weight}">` : ""}
         <button type="submit">Salvar Alterações</button>
         <button type="button" id="remove-comp" style="background:#d9534f;color:white;border:none;border-radius:8px;padding:10px;margin-top:10px;">Remover Componente</button>`,
        () => {
            const newName = document.getElementById("edit-name").value.trim();
            const newNickname = document.getElementById("edit-nickname").value.trim();
            const newDesc = document.getElementById("edit-desc").value.trim();
            const newWeight = isPonderada ? parseFloat(document.getElementById("edit-weight").value) : 1;

            if (!newName) return alert("Nome interno não pode ficar vazio.");
            if (!newNickname) return alert("Apelido do componente é obrigatório.");

            comp.name = newName;
            comp.nickname = newNickname;
            comp.description = newDesc;
            comp.weight = newWeight;
        });

    // remove handler (after modal created)
    setTimeout(() => {
        const remBtn = document.getElementById("remove-comp");
        if (remBtn) {
            remBtn.onclick = () => {
                if (confirm("Deseja remover este componente?")) {
                    // remove component
                    cls.grading.components.splice(index, 1);
                    // remove grade value for each student at that index
                    cls.students.forEach(s => {
                        if (s.grades && s.grades.length > index) s.grades.splice(index, 1);
                    });
                    modal.classList.add("hidden");
                    renderTable();
                }
            };
        }
    }, 80);
}

// ===== Calcular Média =====
function calcularMedia(cls) {
    if (!cls.grading || !cls.grading.components.length) return alert("Adicione ao menos um componente.");
    const totalPeso = cls.grading.components.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (cls.grading.type === "Ponderada" && Math.abs(totalPeso - 10) > 1e-6)
        return alert("A soma dos pesos deve ser exatamente 10.");

    cls.students.forEach(stu => {
        if (!stu.grades || !stu.grades.length) stu.media = 0;
        else if (cls.grading.type === "Aritmética") {
            const soma = stu.grades.reduce((a, b) => a + (parseFloat(b) || 0), 0);
            stu.media = soma / stu.grades.length;
        } else {
            const somaPond = stu.grades.reduce((acc, nota, i) => acc + ((parseFloat(nota) || 0) * (cls.grading.components[i].weight || 0)), 0);
            stu.media = somaPond / 10;
        }
    });
    renderTable();
}

// ===== Inicialização =====
renderTable();
