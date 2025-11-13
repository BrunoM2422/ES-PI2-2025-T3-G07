/*
    Autores originais:
        Bruno Lenitta Machado
        Matheus Antony Lucas Lima
        Nicolas Mitjans Nunes
    Atualização: Sistema de Médias e Notas + Novos campos de disciplina e turma + componentes com apelido/descrição (2025)
*/

const addBtn = document.getElementById("add-button");
const backBtn = document.getElementById("back-button");
const csvBtn = document.getElementById("csv-button");
const exportCsvBtn = document.getElementById("export-csv-button");
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
    csvBtn.classList.add("hidden");
    exportCsvBtn.classList.add("hidden");

    tableHeader.innerHTML = `<th>Instituição</th><th>Curso</th><th>Duração(Semestres)</th>`;
    rows = data.institutions.map((inst, idx) =>
        `<tr data-index="${idx}" data-type="institution">
            <td>${inst.name}</td>
            <td>${inst.course}</td>
            <td>${inst.period || "-"}</td>
        </tr>`
    );


    // ===== Nível 1 - Disciplinas (com código, período e apelido) =====
    } else if (path.length === 1) {
        const inst = data.institutions[path[0]];
        pageTitle.textContent = `Disciplinas do curso ${inst.course}`;
        addBtn.textContent = "+ Adicionar Disciplina";
        csvBtn.classList.add("hidden");
        backBtn.classList.remove("hidden");
        exportCsvBtn.classList.add("hidden");


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
    csvBtn.classList.add("hidden");
    backBtn.classList.remove("hidden");
    exportCsvBtn.classList.add("hidden");

    tableHeader.innerHTML = `
        <th>Turma</th>
        <th>Apelido</th>
        <th>Horários</th>
        <th>Local</th>
    `;

    rows = (subj.classes || []).map((cls, idx) => {
        // Se a turma usa o novo formato (schedule)
        let horarios = "-";
        if (cls.schedule && cls.schedule.length) {
            horarios = cls.schedule
                .map(s => `${s.day} ${s.start}–${s.end}`)
                .join(", ");
        }
        // Caso ainda tenha o formato antigo (compatibilidade)
        else if (cls.day && cls.time) {
            horarios = `${cls.day} ${cls.time}`;
        }

        return `
            <tr data-index="${idx}" data-type="class">
                <td>${cls.number}</td>
                <td>${cls.nickname || "-"}</td>
                <td>${horarios}</td>
                <td>${cls.location}</td>
            </tr>
        `;
    });

    // ===== Nível 3 - Alunos =====
    } else if (path.length === 3) {
        
        const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
        pageTitle.textContent = `Alunos da turma ${cls.number}`;
        addBtn.textContent = "+ Adicionar Aluno";
        backBtn.classList.remove("hidden");
        csvBtn.classList.remove("hidden");
        exportCsvBtn.classList.remove("hidden");
        csvBtn.onclick = importCSV;
        exportCsvBtn.onclick = exportCSV;

        tableHeader.innerHTML = `<th class="delete-checkbox"><input type="checkbox" class="master-delete"></th><th>Nome</th><th>RA</th>`;
        if (cls.grading && cls.grading.components.length) {
            cls.grading.components.forEach((c, i) => {
                // usa apelido (nickname) na coluna
                tableHeader.innerHTML += `<th class="component-header" data-index="${i}" title="Clique para editar/remover">${c.nickname}${cls.grading.type === "Ponderada" ? ` (${c.weight})` : ""}</th>`;
            });
            tableHeader.innerHTML += `<th>Média</th>`;
        }

        rows = (cls.students || []).map((stu, idx) => {
            let row = `<tr><td class="delete-checkbox"><input type="checkbox" class="solo-delete"></td><td>${stu.name}</td><td>${stu.ra}</td>`;
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
            const btnDelete = document.createElement("button");

            btn.id = "add-average";
            btn.textContent = "+ Adicionar Média";
            btn.onclick = () => escolherTipoMedia(cls);
            gradingDiv.appendChild(btn);

            btnDelete.id = "delete-selected";
            btnDelete.textContent = "- Excluir Alunos";
            btnDelete.onclick = () => excluirAlunos(cls);
            gradingDiv.appendChild(btnDelete);
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
            const rowIndex = td.parentElement.rowIndex - 1;
            const compIndex = parseInt(td.dataset.comp);
            const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
            if (newValue !== td.dataset.original) {
                cls.students[rowIndex].grades[compIndex] = parseFloat(newValue) || 0;
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

    // foco inicial no primeiro input (UX)
    setTimeout(() => {
        const first = modalForm.querySelector("input, textarea, select");
        if (first) first.focus();
    }, 50);

    modalForm.onsubmit = (e) => {
        e.preventDefault();
        const success = onSubmit(); // <- agora retorna true ou false
        if (success !== false) {    // fecha o modal apenas se sucesso
            modal.classList.add("hidden");
            renderTable();
        }
    };
}


closeModal.onclick = () => modal.classList.add("hidden");

// ===== Navegação =====
tableBody.addEventListener("click", (e) => {
    const elementoClicado = e.target;
    if (elementoClicado.classList.contains('solo-delete')) {
        const masterCheckbox = tableHeader.querySelector('.master-delete');
        if (masterCheckbox) { 
            if (elementoClicado.checked === false) {
                masterCheckbox.checked = false;
            } else {
                const todosCheckboxes = tableBody.querySelectorAll('.solo-delete');
                const todosMarcados = Array.from(todosCheckboxes).every(cb => cb.checked);
                masterCheckbox.checked = todosMarcados;
            }
        }
        return; 
    }

    if (elementoClicado.classList.contains("grade-cell") || elementoClicado.isContentEditable) {
        e.stopPropagation();
        return;
    }

    const row = elementoClicado.closest("tr");
    if (!row) return; 
    if (!row.dataset.type) return; 

    const idx = parseInt(row.dataset.index);
    const type = row.dataset.type;
    if (type === "institution") path = [idx];
    else if (type === "subject") path = [path[0], idx];
    else if (type === "class") path = [path[0], path[1], idx];
    renderTable();
});

tableHeader.addEventListener("click", (e) => {
    const elementoClicado = e.target;

if (elementoClicado.classList.contains('master-delete')) {
const allCheckboxes = tableBody.querySelectorAll('.solo-delete');        
const isMarked = elementoClicado.checked;
allCheckboxes.forEach(checkbox => {
checkbox.checked = isMarked;
        });
    }
});

backBtn.onclick = () => {
    path.pop();
    renderTable();
};

addBtn.onclick = () => {
    // ===== Adicionar Instituição =====
    if (path.length === 0) {
        openModal("Adicionar Instituição e Curso",
            `<input id="inst-name" placeholder="Nome da Instituição" required>
             <input id="inst-course" placeholder="Nome do Curso" required>
             <input id="inst-period" type="number" min="1" max="12" placeholder="Duração do Curso (1 a 12 semestres)" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("inst-name").value.trim();
                const course = document.getElementById("inst-course").value.trim();
                const period = parseInt(document.getElementById("inst-period").value);
                if (!name || !course || !(period >= 1 && period <= 12)) {
                    alert("Preencha todos os campos e insira um período válido (1 a 12).");
                    return false;
                }
                data.institutions.push({ name, course, period, subjects: [] });
            });
    }

    // ===== Adicionar Disciplina =====
    else if (path.length === 1) {
        const inst = data.institutions[path[0]];
        const maxPeriod = inst.period || 1;
       
        openModal("Adicionar Disciplina",
            `<input id="subject-name" placeholder="Nome da Disciplina" required>
             <input id="subject-code" placeholder="Código da Disciplina" required>
             <input id="subject-period" type="number" min="1" max="${maxPeriod}" placeholder="Período (1 a ${maxPeriod})" required>
             <input id="subject-nickname" placeholder="Apelido da Disciplina (opcional)">
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("subject-name").value.trim();
                const code = document.getElementById("subject-code").value.trim();
                const period = parseInt(document.getElementById("subject-period").value);
                const nickname = document.getElementById("subject-nickname").value.trim() || "-";

                if (!name || !code || !(period >= 1 && period <= maxPeriod)) {
                    alert(`Preencha nome, código e período válido (1 a ${maxPeriod}).`);
                    return false;
                }

                const existeCodigo = (inst.subjects || []).some(s => s.code.toLowerCase() === code.toLowerCase());
                if (existeCodigo) {
                    alert(`Já existe uma disciplina com o código "${code}" neste curso.`);
                    return false; // ❌ não fecha modal
                }

                inst.subjects.push({ name, code, period, nickname, classes: [] });
            });
    }

// ===== Adicionar Turma =====
else if (path.length === 2) {
    const subj = data.institutions[path[0]].subjects[path[1]];
    const inst = data.institutions[path[0]];

    // dias e HTML da grade (4 em cima, 3 embaixo)
    const diasSemana = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    const horariosHTML = `
      <div class="add-class-modal">
        <div class="modal-week-grid">
          ${diasSemana.map(dia => `
            <div class="day-block">
              <label class="day-toggle">
                <input type="checkbox" id="check-${dia}" value="${dia}" class="day-check">
                <span>${dia}</span>
              </label>
              <div class="time-inputs">
                <input type="time" id="start-${dia}" disabled>
                <span class="time-sep">—</span>
                <input type="time" id="end-${dia}" disabled>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    openModal("Adicionar Turma",
        `<div class="add-class-modal-wrapper">
           <input id="class-number" placeholder="Código/Número da Turma" required>
           <input id="class-nickname" placeholder="Apelido da Turma (opcional)">
           ${horariosHTML}
           <input id="class-location" placeholder="Local (ex: Sala 12)" required>
           <button type="submit">Adicionar</button>
         </div>`,
        () => {
            const number = document.getElementById("class-number").value.trim();
            const nickname = document.getElementById("class-nickname").value.trim() || "-";
            const location = document.getElementById("class-location").value.trim();

            // coletar dias selecionados (onde start/end habilitados)
            const selectedDays = diasSemana
                .filter(dia => !document.getElementById(`start-${dia}`).disabled)
                .map(dia => ({
                    day: dia,
                    start: document.getElementById(`start-${dia}`).value,
                    end: document.getElementById(`end-${dia}`).value
                }))
                .filter(d => d.start && d.end);

            if (!number || selectedDays.length === 0 || !location) {
                alert("Preencha todos os campos e selecione ao menos um dia com horários válidos.");
                return false;
            }

            // hora final > hora inicial
            for (const d of selectedDays) {
                if (d.end <= d.start) {
                    alert(`O horário final deve ser maior que o inicial (${d.day}).`);
                    return false;
                }
            }

            // duplicidade número dentro da mesma disciplina
            const existeTurma = (subj.classes || []).some(c => c.number.toLowerCase() === number.toLowerCase());
            if (existeTurma) {
                alert(`Já existe uma turma com o código/número "${number}" nesta disciplina.`);
                return false;
            }

            // conflito de horário dentro da MESMA INSTITUIÇÃO (verifica todas as turmas de todos os cursos desta instituição)
            const conflito = inst.subjects.some(s =>
                (s.classes || []).some(c =>
                    (c.schedule || []).some(horarioExistente =>
                        selectedDays.some(novo =>
                            horarioExistente.day === novo.day &&
                            !(novo.end <= horarioExistente.start || novo.start >= horarioExistente.end)
                        )
                    )
                )
            );

            if (conflito) {
                alert("⚠️ Conflito de horário detectado: já existe uma turma no mesmo dia e faixa de horário.");
                return false;
            }

            // salva com novo formato "schedule" (array de {day, start, end})
            subj.classes.push({
                number,
                nickname,
                location,
                schedule: selectedDays,
                students: []
            });
        }
    );

    // --- depois de abrir o modal: ampliar apenas essa .modal-content e ligar listeners ---
    setTimeout(() => {
        // 1) marcar modal-content só para esse modal (usado pelo CSS)
        const mc = document.querySelector(".modal-content");
        if (mc) mc.classList.add("add-class-modal-content");

        // 2) ligar checkbox -> habilita inputs de time
        diasSemana.forEach(dia => {
            const chk = document.getElementById(`check-${dia}`);
            const start = document.getElementById(`start-${dia}`);
            const end = document.getElementById(`end-${dia}`);
            if (!chk || !start || !end) return;
            // sincronia: quando checkbox muda, ativa/desativa inputs
            chk.addEventListener("change", (e) => {
                const ativo = !!e.target.checked;
                start.disabled = !ativo;
                end.disabled = !ativo;
                if (!ativo) { start.value = ""; end.value = ""; }
            });
        });
    }, 60);

    // remover a classe extra quando fechar pelo X
    const originalClose = closeModal.onclick;
    closeModal.onclick = () => {
        const mc = document.querySelector(".modal-content");
        if (mc) mc.classList.remove("add-class-modal-content");
        // mantém comportamento anterior de fechar
        modal.classList.add("hidden");
    };

    // também garantir remoção da classe quando o modal for fechado via submit (sucesso)
    // (openModal fecha o modal; após fechar, removemos a classe)
    // adiciona observer simples para quando modal for escondido
    const observer = new MutationObserver((mutations, obs) => {
        if (modal.classList.contains("hidden")) {
            const mc = document.querySelector(".modal-content");
            if (mc) mc.classList.remove("add-class-modal-content");
            obs.disconnect();
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
}




    // ===== Adicionar Aluno =====
    else if (path.length === 3) {
        const inst = data.institutions[path[0]];
        const cls = inst.subjects[path[1]].classes[path[2]];

        openModal("Adicionar Aluno",
            `<input id="student-name" placeholder="Nome do Aluno" required>
             <input id="student-ra" placeholder="RA" required>
             <button type="submit">Adicionar</button>`,
            () => {
                const name = document.getElementById("student-name").value.trim();
                const ra = document.getElementById("student-ra").value.trim();

                if (!name || !ra) {
                    alert("Preencha o nome e o RA do aluno.");
                    return false;
                }

                const raExiste = inst.subjects.some(sub =>
                    (sub.classes || []).some(c =>
                        (c.students || []).some(s => s.ra === ra)
                    )
                );

                if (raExiste) {
                    alert(`Já existe um aluno com o RA "${ra}" nesta instituição.`);
                    return false; // ❌ não fecha o modal
                }

                cls.students.push({ name, ra, grades: [] });
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

//Importar o CSV 
function importCSV(){
    
    const csvFileInput = document.createElement ('input');
    csvFileInput.type = 'file';
    csvFileInput.accept = '.csv'; //para aceitar apenas CSV
    csvFileInput.style.display = 'none';
    document.body.appendChild(csvFileInput);
    
    
    csvFileInput.addEventListener ('change', (event)=>
    {
        const file = event.target.files[0];

        if (file){
            const fileReader = new FileReader();

            fileReader.onload = (e) => {
                const csvText = e.target.result;
                csvData(csvText);
            };

            fileReader.onerror = () => {
                alert("Erro ao ler o arquivo");
            };

            fileReader.readAsText(file);

        }

    });

    csvFileInput.click();
}

function csvData (csvText) {
    const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
    const lines = csvText.split(/\r?\n/);

    let count = 0;

    for (let i = 1; i < lines.length; i++){
        const line = lines[i].trim();

        if (line === "") continue;

        const columns = line.split(';');

        if (columns.length>=2){
            const name = columns[0].trim();
            const ra = columns[1].trim();

            cls.students.push({
                name : name,
                ra : ra,
                grades : []
            });
            count++;
        }

    }
    renderTable();
}

function exportCSV(){
    const cls = data.institutions[path[0]].subjects[path[1]].classes[path[2]];
    const students = cls.students || [];
    
    if (students.length === 0){
        alert("Não há estudantes cadastrados.");
        return;
    }

    const separator = ';';

    let headers = ['Nome', 'RA'];

    if(cls.grading && cls.grading.components.length){
        cls.grading.components.forEach (comp =>{            
            headers.push(comp.nickname);
        });

        headers.push("Média");
    }
    
    let csvContent = headers.join(separator) + "\n";

    students.forEach(stu =>{
    let row = [];
    row.push(stu.name);
    row.push(stu.ra);

    if (cls.grading && cls.grading.components.length){
        cls.grading.components.forEach((comp, index) => {
            const grade = stu.grades[index] !== undefined ? stu.grades[index] : 0;
                row.push(grade.toString().replace('.',','));
                    });
                }
                    const media = stu.media !== undefined ? stu.media.toFixed(2).replace('.',',') : '-';
                    row.push(media);

                    csvContent += row.join(separator) + "\n";
        
            });
        
        const blob = new Blob (["\uFEFF" + csvContent], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement("a");
    
        // Cria uma URL para o Blob
        const url = URL.createObjectURL(blob);
        link.href = url;
        
        link.download = `export_${cls.number}.csv`;
        document.body.appendChild(link);
        
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Libera a memória
        
}

function excluirAlunos(cls) {
    const checkboxesSelected = tableBody.querySelectorAll('.solo-delete:checked'); // <- Sua variável chama "Selected"

    if (checkboxesSelected.length === 0) {
        alert("Selecione pelo menos um aluno para remover.");
        return;
    }

    if (!confirm(`Você tem certeza que quer remover ${checkboxesSelected.length} aluno(s)?`)) {
        return;
    }
    const rasParaRemover = [];
    
    checkboxesSelected.forEach(cb => {
        const linha = cb.closest('tr');
        const raCell = linha.cells[2]; // Pega a 3ª célula (índice 2)
        if (raCell) {
            rasParaRemover.push(raCell.textContent);
        }
    });
    cls.students = cls.students.filter(stu => !rasParaRemover.includes(stu.ra));

    renderTable();
}


// ===== Inicialização =====
renderTable();
