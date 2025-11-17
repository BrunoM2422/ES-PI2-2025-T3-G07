/*
    Autores originais:
        Bruno Lenitta Machado
        Matheus Antony Lucas Lima
        Nicolas Mitjans Nunes
    Atualização: Sistema de Médias e Notas + Novos campos de disciplina e turma + componentes com apelido/descrição (2025)
    Atualização adicional: migração para estrutura Institutions -> Courses -> Subjects -> Classes -> Students
*/

// elementos DOM
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

// dados (nova estrutura)
let data = { institutions: [] };
// path: indices de navegação
// path = [] -> nível 0 (instituições)
// path = [i] -> nível 1 (cursos da instituição i)
// path = [i,j] -> nível 2 (disciplinas do curso j da instituição i)
// path = [i,j,k] -> nível 3 (turmas da disciplina k)
// path = [i,j,k,l] -> nível 4 (alunos da turma l)
let path = [];

// ===== Verificação de Autenticação =====
function verificarAutenticacao() {
    const usuario = JSON.parse(localStorage.getItem("currentUser"));
    
    if (!usuario || !usuario.id_usuario) {
        console.warn("⚠️ Usuário não autenticado, redirecionando...");
        alert("Sessão expirada. Por favor, faça login novamente.");
        window.location.href = "index.html";
        return false;
    }
    
    console.log("✅ Usuário autenticado:", usuario.nome);
    return true;
}

// ==================================================
// renderTable — render principal adaptado para 5 níveis
// ==================================================
async function renderTable() {
    tableBody.innerHTML = "";
    let rows = [];
    noRecords.style.display = "none";

    // remove grading div antigo se existir
    let gradingDiv = document.getElementById("grading-div");
    if (gradingDiv) gradingDiv.remove();

    // Nível 0 — Instituições
    if (path.length === 0) {
        pageTitle.textContent = "Instituições";
        addBtn.textContent = "+ Adicionar Instituição";
        backBtn.classList.add("hidden");
        csvBtn.classList.add("hidden");
        exportCsvBtn.classList.add("hidden");

        tableHeader.innerHTML = `<th colspan="2">Instituição</th>`;
        rows = data.institutions.map((inst, idx) =>
            `<tr data-index="${idx}" data-type="institution">
                <td>${inst.name}</td>
                <td class="delete-action">
                <button type="button" class="delete-inst" data-index="${idx}">
                X
                </button>
                </td>
            </tr>`
        );
        
    }

    // Nível 1 — Cursos da instituição
    else if (path.length === 1) {
        const inst = data.institutions[path[0]];
        pageTitle.textContent = `Cursos de ${inst.name}`;
        addBtn.textContent = "+ Adicionar Curso";
        csvBtn.classList.add("hidden");
        backBtn.classList.remove("hidden");
        exportCsvBtn.classList.add("hidden");

        tableHeader.innerHTML = `<th class="delete-checkbox"><input type="checkbox" class="master-delete"></th><th>Curso</th><th>Duração (Semestres)</th>`;
        rows = (inst.courses || []).map((course, idx) =>
            `
                <tr data-index="${idx}" data-type="course">
                <td class="delete-checkbox"><input type="checkbox" class="solo-delete"></td>
                <td>${course.name}</td>
                <td>${course.period || "-"}</td>
            </tr>`
        );
        gradingDiv = document.createElement("div");
        gradingDiv.id = "grading-div";
        document.getElementById("content").appendChild(gradingDiv);
        

        
        if ((inst.courses || []).length > 0) {
            const btnDelete = document.createElement("button");
            gradingDiv.appendChild(btnDelete);
            btnDelete.id = "delete-selected";
            btnDelete.textContent = "- Excluir Curso";
            btnDelete.onclick = () => excluirCurso(inst);
        }
    }

    // Nível 2 — Disciplinas (subjects) do curso
    else if (path.length === 2) {
        const course = data.institutions[path[0]].courses[path[1]];
        pageTitle.textContent = `Disciplinas do curso ${course.name}`;
        addBtn.textContent = "+ Adicionar Disciplina";
        csvBtn.classList.add("hidden");
        backBtn.classList.remove("hidden");
        exportCsvBtn.classList.add("hidden");

        tableHeader.innerHTML = `<th class="delete-checkbox"><input type="checkbox" class="master-delete"></th><th>Disciplina</th><th>Código</th><th>Período</th><th>Apelido</th>`;

        rows = (course.subjects || []).map((subj, idx) =>
            `<tr data-index="${idx}" data-type="subject">
                <td class="delete-checkbox"><input type="checkbox" class="solo-delete"></td>
                <td>${subj.name}</td>
                <td>${subj.code || "-"}</td>
                <td>${subj.period || "-"}</td>
                <td>${subj.nickname || "-"}</td>
            </tr>`
        );

        gradingDiv = document.createElement("div");
        gradingDiv.id = "grading-div";
        document.getElementById("content").appendChild(gradingDiv);

        if ((course.subjects || []).length > 0) {
            const btnDelete = document.createElement("button");
            btnDelete.id = "delete-selected";
            btnDelete.textContent = "- Excluir Disciplinas";
            btnDelete.onclick = () => excluirDisciplina(course);
            gradingDiv.appendChild(btnDelete);
        }
    }

    // Nível 3 — Turmas da disciplina
    else if (path.length === 3) {
        const course = data.institutions[path[0]].courses[path[1]];
        const subj = course.subjects[path[2]];

        pageTitle.textContent = `Turmas de ${subj.name}`;
        addBtn.textContent = "+ Adicionar Turma";
        csvBtn.classList.add("hidden");
        backBtn.classList.remove("hidden");
        exportCsvBtn.classList.add("hidden");

        tableHeader.innerHTML = `
            <th class="delete-checkbox"><input type="checkbox" class="master-delete"></th>
            <th>Turma</th>
            <th>Apelido</th>
            <th>Horários</th>
            <th>Local</th>
        `;
        rows = (subj.classes || []).map((cls, idx) => {
            let horarios = "-";
            if (cls.schedule && cls.schedule.length) {
                horarios = cls.schedule
                    .map(s => `${s.day} ${s.start}–${s.end}`)
                    .join(", ");
            } else if (cls.day && cls.time) {
                horarios = `${cls.day} ${cls.time}`;
            }
            return `
                <tr data-index="${idx}" data-type="class">
                    <td class="delete-checkbox"><input type="checkbox" class="solo-delete"></td>
                    <td>${cls.number}</td>
                    <td>${cls.nickname || "-"}</td>
                    <td>${horarios}</td>
                    <td>${cls.location || "-"}</td>
                </tr>
            `;
        });

        gradingDiv = document.createElement("div");
        gradingDiv.id = "grading-div";
        document.getElementById("content").appendChild(gradingDiv);

        if ((subj.classes || []).length > 0) {
            const btnDelete = document.createElement("button");
            btnDelete.id = "delete-selected";
            btnDelete.textContent = "- Excluir Turmas";
            btnDelete.onclick = () => excluirTurmas(subj);
            gradingDiv.appendChild(btnDelete);
        }
    }

  // Nível 4 — Alunos da turma
else if (path.length === 4) {

    const cls = data.institutions[path[0]]
        .courses[path[1]]
        .subjects[path[2]]
        .classes[path[3]];

    if (!cls.grading) {
        await carregarSistemaAvaliacao(cls);
    }

    pageTitle.textContent = `Alunos da turma ${cls.number}`;
    addBtn.textContent = "+ Adicionar Aluno";
    backBtn.classList.remove("hidden");
    csvBtn.classList.remove("hidden");
    exportCsvBtn.classList.remove("hidden");
    csvBtn.onclick = importCSV;
    exportCsvBtn.onclick = exportCSV;

    // Cabeçalho da tabela
    tableHeader.innerHTML =
        `<th class="delete-checkbox"><input type="checkbox" class="master-delete"></th>
         <th>Nome</th>
         <th>RA</th>`;

    if (cls.grading && cls.grading.components.length) {
        cls.grading.components.forEach((c, i) => {
            tableHeader.innerHTML += `
                <th class="component-header" data-index="${i}">
                    <input type="checkbox" class="edit-toggle" data-comp="${i}">
                    ${c.nickname}${cls.grading.type === "Ponderada" ? ` (${c.weight})` : ""}
                </th>`;
        });

        tableHeader.innerHTML += `<th>Média</th>`;
    }

    // Linhas da tabela
    rows = (cls.students || []).map((stu, idx) => {

        let row = `
            <tr>
                <td class="delete-checkbox"><input type="checkbox" class="solo-delete"></td>
                <td>${stu.name}</td>
                <td>${stu.ra || "-"}</td>
        `;

        if (!stu.grades) stu.grades = [];

        if (cls.grading && cls.grading.components.length) {
            cls.grading.components.forEach((comp, i) => {
                const componente_id = `comp_${comp.id || i}`;
                const nota = stu.grades?.[componente_id] || 0;
                row += `
                    <td contenteditable="false" data-comp="${i}" class="grade-cell">${nota}</td>
                `;
            });

            row += `<td>${stu.media !== undefined ? stu.media.toFixed(2) : "-"}</td>`;
        }

        row += "</tr>";
        return row;
    });

    // DIV que recebe botões e controles
    gradingDiv = document.createElement("div");
    gradingDiv.id = "grading-div";
    document.getElementById("content").appendChild(gradingDiv);


    // ================================
    //     MOSTRAR BOTÕES APENAS SE
    //         EXISTE UM ALUNO
    // ================================
    const temAlunos = (cls.students || []).length > 0;

    if (temAlunos) {

        // Se ainda não tem definição de média → pode criar
        if (!cls.grading) {
            const btn = document.createElement("button");
            btn.id = "add-average";
            btn.textContent = "+ Adicionar Média";
            btn.onclick = () => escolherTipoMedia(cls);
            gradingDiv.appendChild(btn);
        }

        // Se já existe média → mostrar edição e componentes
        else if (cls.grading) {

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

        // Botão excluir alunos (sempre aparece se houver alunos)
        const btnDelete = document.createElement("button");
        btnDelete.id = "delete-selected";
        btnDelete.textContent = "- Excluir Alunos";
        btnDelete.onclick = () => excluirAlunos(cls);
        gradingDiv.appendChild(btnDelete);
    }

    // habilitar edição das notas
    setTimeout(() => configurarEdicaoNotas(), 100);
}



    tableBody.innerHTML = rows.join("");

    if (!rows.length) {
        noRecords.style.display = "block";
        noRecords.textContent = "Nenhum registro encontrado.";
    }

    // Após renderizar a tabela, conectamos os eventos responsáveis por permitir edição das notas
    // e manipulação dos componentes de avaliação.



    // Lógica de edição das células de nota (focus → registrar valor, blur → salvar, Enter → finalizar edição)
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
            let newValue = td.textContent.trim().replace(",", ".");  // aceita 8,5 também
            let number = parseFloat(newValue);

            if (isNaN(number)) {
                number = 0; // caso digite algo inválido
            }
            // rowIndex: calcular posição correta considerando header presence
            // usamos parentElement.rowIndex-1 como antes
            const rowIndex = td.parentElement.rowIndex - 1;
            const compIndex = parseInt(td.dataset.comp);
            const cls = data.institutions[path[0]].courses[path[1]].subjects[path[2]].classes[path[3]];
            if (newValue !== td.dataset.original) {
                cls.students[rowIndex].grades[compIndex] = parseFloat(newValue) || 0;
            }
            // não apagamos notas; não re-render completo para não perder foco
            
            // salvar como float real
            cls.students[rowIndex].grades[compIndex] = number;

            // formatar com 2 casas decimais SEM rerenderizar
            td.textContent = number.toFixed(2);
        });
    });

    // Header de componentes (nome da prova/trabalho):
    // permite editar ou remover o componente ao clicar sobre o título
    document.querySelectorAll(".component-header").forEach(th => {
        th.addEventListener("click", () => {
            const compIndex = parseInt(th.dataset.index);
            const cls = data.institutions[path[0]].courses[path[1]].subjects[path[2]].classes[path[3]];
            editarOuRemoverComponente(cls, compIndex);
        });
    });

// Controle dos toggles de edição: ativa edição somente das notas do componente selecionado
const toggles = document.querySelectorAll(".edit-toggle");
const allCells = document.querySelectorAll(".grade-cell");

// Função auxiliar: bloqueia edição de todas as células de nota
function disableAllGradeCells() {
    allCells.forEach(td => td.setAttribute("contenteditable", "false"));
}

disableAllGradeCells();

toggles.forEach(toggle => {
    
    // Impede que o clique abra o modal
    toggle.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    toggle.addEventListener("change", () => {
        // Garante que apenas um componente possa estar em modo de edição por vez
        if (toggle.checked) {
            toggles.forEach(t => {
                if (t !== toggle) t.checked = false;
            });

            const compIndex = toggle.dataset.comp;
            disableAllGradeCells();
            
            
            document.querySelectorAll(`td.grade-cell[data-comp="${compIndex}"]`)
                .forEach(td => td.setAttribute("contenteditable", "true"));
        } else {
            disableAllGradeCells();
        }
    });
});


}

// =======================
// Modal dinâmico (igual ao seu padrão)
// =======================
function openModal(title, innerHTML, onSubmit) {
    modalTitle.textContent = title;
    modalForm.innerHTML = innerHTML;
    modal.classList.remove("hidden");

    // foco inicial
    setTimeout(() => {
        const first = modalForm.querySelector("input, textarea, select");
        if (first) first.focus();
    }, 50);

    modalForm.onsubmit = (e) => {
        e.preventDefault();
        const success = onSubmit(); // retorna true/false
        if (success !== false) {
            modal.classList.add("hidden");
            renderTable();
        }
    };
}

closeModal.onclick = () => modal.classList.add("hidden");

// =======================
// Navegação — clique nas linhas da tabela
// =======================
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

    // Não navega se clicou em célula editável de nota
    if (elementoClicado.classList.contains("grade-cell") || elementoClicado.isContentEditable) {
        e.stopPropagation();
        return;
    }

    const row = elementoClicado.closest("tr");
    if (!row) return;
    if (!row.dataset.type) return;

    // Atualiza o path com base no tipo da linha
    const idx = parseInt(row.dataset.index);
    const type = row.dataset.type;

    if (type === "institution") path = [idx];
    else if (type === "course") path = [path[0], idx];
    else if (type === "subject") path = [path[0], path[1], idx];
    else if (type === "class") path = [path[0], path[1], path[2], idx];
    renderTable();
});

//Para deletar a instituição
tableBody.addEventListener("click", async (e) => {
    if (e.target.classList.contains('delete-inst')) {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        await excluirInstituicaoPeloIndice(index);
        return;
    }
});

// Checkbox no header que marca/desmarca todos os alunos
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

// Volta um nível no path
backBtn.onclick = () => {
    path.pop();
    renderTable();
};

// =======================
// addBtn — adiciona Instituição / Curso / Disciplina / Turma / Aluno
// =======================
addBtn.onclick = () => {
    // Nível 0 -> Adicionar Instituição (apenas nome)
    if (path.length === 0) {
        openModal("Adicionar Instituição",
            `<input id="inst-name" placeholder="Nome da Instituição" required>
             <button type="submit">Adicionar</button>`,
            async () => {
                const name = document.getElementById("inst-name").value.trim();
                if (!name) {
                    alert("Digite o nome da instituição.");
                    return false;
                }
                
                try {
                    // Salva instituição no banco
                    const idInstituicao = await salvarInstituicaoNoBanco(name);
                    if (!idInstituicao) return false;
                    
                    await carregarInstituicoesECursos();
                    
                    alert("Instituição adicionada com sucesso!");
                    return true;
                } catch (error) {
                    console.error("Erro ao salvar:", error);
                    alert("Erro ao salvar instituição.");
                    return false;
                }
            });
    }

    // Nível 1 -> Adicionar Curso dentro da instituição selecionada
    else if (path.length === 1) {
        const inst = data.institutions[path[0]];
        openModal("Adicionar Curso",
            `<input id="course-name" placeholder="Nome do Curso" required>
             <input id="course-period" type="number" min="1" max="12" placeholder="Duração do Curso (1 a 12 semestres)" required>
             <button type="submit">Adicionar</button>`,
            async () => {
                const name = document.getElementById("course-name").value.trim();
                const period = parseInt(document.getElementById("course-period").value);
                if (!name || !(period >= 1 && period <= 12)) {
                    alert("Preencha o nome e um período válido (1 a 12).");
                    return false;
                }
                
                try {
                    // Salva curso no banco vinculado à instituição
                    const okCurso = await salvarCursoNoBanco(name, period, inst.id_instituicao);
                    if (!okCurso) return false;
                    
                    await carregarInstituicoesECursos();
                    
                    alert("Curso adicionado com sucesso!");
                    return true;
                } catch (error) {
                    console.error("Erro ao salvar:", error);
                    alert("Erro ao salvar curso.");
                    return false;
                }
            });
    }

    // Nível 2 -> Adicionar Disciplina ao curso
    else if (path.length === 2) {
        const course = data.institutions[path[0]].courses[path[1]];
        const maxPeriod = course.period || 1;

        openModal("Adicionar Disciplina",
            `<input id="subject-name" placeholder="Nome da Disciplina" required>
            <input id="subject-code" placeholder="Código da Disciplina" required>
            <input id="subject-period" type="number" min="1" max="${maxPeriod}" placeholder="Período (1 a ${maxPeriod})" required>
            <input id="subject-nickname" placeholder="Apelido da Disciplina (opcional)">
            <button type="submit">Adicionar</button>`,
            async () => {
                const name = document.getElementById("subject-name").value.trim();
                const code = document.getElementById("subject-code").value.trim();
                const period = parseInt(document.getElementById("subject-period").value);
                const nickname = document.getElementById("subject-nickname").value.trim() || "-";

                if (!name || !code || !(period >= 1 && period <= maxPeriod)) {
                    alert(`Preencha nome, código e período válido (1 a ${maxPeriod}).`);
                    return false;
                }

                
                const subjects = course.subjects || [];
                const codigoExisteNoCurso = subjects.some(subject => 
                    subject.code && subject.code.toLowerCase() === code.toLowerCase()
                );

                if (codigoExisteNoCurso) {
                    alert(`Já existe uma disciplina com o código "${code}" neste curso.`);
                    return false;
                }

                try {
                    // Salva disciplina no banco vinculada ao curso
                    const disciplinaSalva = await salvarDisciplinaNoBanco(
                        name, 
                        code, 
                        period, 
                        nickname, 
                        course.id_curso // ID do curso
                    );
                    
                    if (disciplinaSalva) {
                        await carregarInstituicoesECursos();
                        alert("Disciplina adicionada com sucesso!");
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error("Erro ao salvar:", error);
                    alert("Erro ao salvar disciplina.");
                    return false;
                }
            });
    }

    // Nível 3 -> Adicionar Turma à disciplina
    else if (path.length === 3) {
        const subj = data.institutions[path[0]].courses[path[1]].subjects[path[2]];
        const inst = data.institutions[path[0]];

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
            async () => {
                const number = document.getElementById("class-number").value.trim();
                const nickname = document.getElementById("class-nickname").value.trim() || "-";
                const location = document.getElementById("class-location").value.trim();

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

                for (const d of selectedDays) {
                    if (d.end <= d.start) {
                        alert(`O horário final deve ser maior que o inicial (${d.day}).`);
                        return false;
                    }
                }
                
                const classes = subj.classes || [];
                const existeTurma = classes.some(cls =>
                    cls.number && cls.number.toLowerCase() === number.toLowerCase()
                );

                    if (existeTurma) {
                        alert(`Já existe uma turma com o código/número "${number}" nesta disciplina.`);
                        return false;
                    }


                // conflito de horário dentro da mesma instituição
                const conflito = inst.courses.some(curso =>
                    (curso.subjects || []).some(s =>
                        (s.classes || []).some(c =>
                            (c.schedule || []).some(horarioExistente =>
                                selectedDays.some(novo =>
                                    horarioExistente.day === novo.day &&
                                    !(novo.end <= horarioExistente.start || novo.start >= horarioExistente.end)
                                )
                            )
                        )
                    )
                );

                if (conflito) {
                    alert("⚠️ Conflito de horário detectado: já existe uma turma no mesmo dia e faixa de horário.");
                    return false;
                }

                try {
                    const turmaSalva = await salvarTurmaNoBanco(
                        number,  
                        nickname || "-",
                        location,
                        selectedDays, 
                        subj.id_disciplina
                    );
                    
                    if (turmaSalva) {
                        await carregarInstituicoesECursos();
                        alert("Turma adicionada com sucesso!");
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error("Erro ao salvar:", error);
                    alert("Erro ao salvar turma.");
                    return false;
                }
            }
        );

        // handlers para modal de turma (habilitar time inputs)
        setTimeout(() => {
            const mc = document.querySelector(".modal-content");
            if (mc) mc.classList.add("add-class-modal-content");

            diasSemana.forEach(dia => {
                const chk = document.getElementById(`check-${dia}`);
                const start = document.getElementById(`start-${dia}`);
                const end = document.getElementById(`end-${dia}`);
                if (!chk || !start || !end) return;
                chk.addEventListener("change", (e) => {
                    const ativo = !!e.target.checked;
                    start.disabled = !ativo;
                    end.disabled = !ativo;
                    if (!ativo) { start.value = ""; end.value = ""; }
                });
            });
        }, 60);

        // remover classe extra ao fechar via X
        const originalClose = closeModal.onclick;
        closeModal.onclick = () => {
            const mc = document.querySelector(".modal-content");
            if (mc) mc.classList.remove("add-class-modal-content");
            modal.classList.add("hidden");
        };

        const observer = new MutationObserver((mutations, obs) => {
            if (modal.classList.contains("hidden")) {
                const mc = document.querySelector(".modal-content");
                if (mc) mc.classList.remove("add-class-modal-content");
                obs.disconnect();
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    }

    // Nível 4 -> Adicionar Aluno
    else if (path.length === 4) {
        const inst = data.institutions[path[0]];
        const cls = data.institutions[path[0]].courses[path[1]].subjects[path[2]].classes[path[3]];

        openModal("Adicionar Aluno",
            `<input id="student-name" placeholder="Nome do Aluno" required>
             <input id="student-ra" placeholder="RA" required>
             <button type="submit">Adicionar</button>`,
            async () => {
                const name = document.getElementById("student-name").value.trim();
                const ra = document.getElementById("student-ra").value.trim();

                if (!name || !ra) {
                    alert("Preencha o nome e o RA do aluno.");
                    return false;
                }

                // verifica RA duplicado dentro da instituição
                const raExiste = inst.courses.some(course =>
                    (course.subjects || []).some(sub =>
                        (sub.classes || []).some(c =>
                            (c.students || []).some(s => s.ra === ra)
                        )
                    )
                );

                if (raExiste) {
                    alert(`Já existe um aluno com o RA "${ra}" nesta instituição.`);
                    return false;
                }

                try {
                    const alunoSalva = await salvarAlunoNoBanco(
                        name,  
                        ra ,
                        cls.id_turma
                    );
                    
                    if (alunoSalva) {
                        await carregarInstituicoesECursos();
                        alert("Aluno adicionado com sucesso!");
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error("Erro ao salvar:", error);
                    alert("Erro ao salvar aluno.");
                    return false;
                }
            });
    }
};

// =======================
// Média: escolha / edição sem apagar notas
// =======================
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

// editarTipoMedia agora NÃO apaga notas nem componentes.
// Comportamento desejado:
// - Aritmética -> Ponderada: mantém componentes; se existirem componentes sem weight, cria weight=0.
// - Ponderada -> Aritmética: mantém componentes; remove campo weight (ou o ignora).
function editarTipoMedia(cls) {
    const oldType = cls.grading ? cls.grading.type : "Aritmética";
    
    openModal("Alterar Tipo de Média",
        `<label><input type="radio" name="tipoMedia" value="Aritmética" ${oldType === "Aritmética" ? "checked" : ""}> Média Aritmética</label><br>
         <label><input type="radio" name="tipoMedia" value="Ponderada" ${oldType === "Ponderada" ? "checked" : ""}> Média Ponderada</label><br><br>
         <button type="submit">Confirmar</button>`,
        async () => {
            const newType = document.querySelector('input[name="tipoMedia"]:checked').value;
            
            if (newType === oldType) return true;

            // Atualiza no banco
            const sucesso = await atualizarTipoMediaNoBanco(cls, newType);
            if (!sucesso) {
                alert("Erro ao atualizar tipo de média no banco.");
                return false;
            }

            // Atualiza localmente
            if (!cls.grading) cls.grading = { type: newType, components: [] };
            cls.grading.type = newType;

            // Se mudando para ponderada, garante que todos os componentes tenham peso
            if (newType === "Ponderada") {
                cls.grading.components.forEach(comp => {
                    if (comp.weight === undefined || comp.weight === null) {
                        comp.weight = 0;
                    }
                });
            }

            alert("Tipo de média atualizado com sucesso!");
            return true;
        });
}

// =======================
// Adicionar Componente
// =======================
function adicionarComponente(cls) {
    const isPonderada = cls.grading.type === "Ponderada";
    
    openModal("Adicionar Componente",
        `<input id="comp-name" placeholder="Nome interno (ex: Prova 1)" required>
         <input id="comp-nickname" placeholder="Apelido que aparecerá na tabela (ex: P1)" required>
         <textarea id="comp-desc" placeholder="Descrição (opcional, ex: Prova aplicada em 20/04)"></textarea>
         ${isPonderada ? '<input id="comp-weight" type="number" placeholder="Peso (0 a 10)" min="0" max="10" step="0.1" required>' : ''}
         <button type="submit">Adicionar</button>`,
        async () => {
            const name = document.getElementById("comp-name").value.trim();
            const nickname = document.getElementById("comp-nickname").value.trim();
            const description = document.getElementById("comp-desc").value.trim();
            const weight = isPonderada ? parseFloat(document.getElementById("comp-weight").value) : undefined;

            if (!name) {
                alert("Preencha o nome interno do componente.");
                return false;
            }
            if (!nickname) {
                alert("Preencha o apelido do componente (obrigatório).");
                return false;
            }

            const compObj = { name, nickname, description };
            if (isPonderada) compObj.weight = isNaN(weight) ? 0 : weight;

            if (!cls.grading) cls.grading = { type: isPonderada ? "Ponderada" : "Aritmética", components: [] };
            cls.grading.components.push(compObj);

            // Salva no banco
            const sucesso = await salvarSistemaAvaliacaoNoBanco(cls);
            if (!sucesso) {
                alert("Erro ao salvar componente no banco.");
                cls.grading.components.pop(); // Remove se falhou
                return false;
            }

            // Inicializa notas para cada aluno
            cls.students.forEach(s => {
                if (!s.grades) s.grades = {};
            });

            alert("Componente adicionado com sucesso!");
            return true;
        });
}

// =======================
// Editar ou Remover Componente
// =======================
function editarOuRemoverComponente(cls, index) {
    const comp = cls.grading.components[index];
    const isPonderada = cls.grading.type === "Ponderada";

    if (!comp) return alert("Componente não encontrado.");

    openModal("Editar ou Remover Componente",
        `<input id="edit-name" value="${comp.name.replace(/"/g, '&quot;')}" placeholder="Nome interno" required>
         <input id="edit-nickname" value="${(comp.nickname||'').replace(/"/g, '&quot;')}" placeholder="Apelido (coluna) (obrigatório)" required>
         <textarea id="edit-desc" placeholder="Descrição (opcional)">${comp.description ? comp.description.replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''}</textarea>
         ${isPonderada ? `<input id="edit-weight" type="number" min="0" max="10" step="0.1" value="${comp.weight}">` : ""}
         <button type="submit">Salvar Alterações</button>
         <button type="button" id="remove-comp" style="background:#d9534f;color:white;border:none;border-radius:8px;padding:10px;margin-top:10px;">Remover Componente</button>`,
        async () => {
            const newName = document.getElementById("edit-name").value.trim();
            const newNickname = document.getElementById("edit-nickname").value.trim();
            const newDesc = document.getElementById("edit-desc").value.trim();
            const newWeight = isPonderada ? parseFloat(document.getElementById("edit-weight").value) : undefined;

            if (!newName) {
                alert("Nome interno não pode ficar vazio.");
                return false;
            }
            if (!newNickname) {
                alert("Apelido do componente é obrigatório.");
                return false;
            }

            comp.name = newName;
            comp.nickname = newNickname;
            comp.description = newDesc;
            if (isPonderada) comp.weight = isNaN(newWeight) ? 0 : newWeight;

            // Salva no banco
            const sucesso = await salvarSistemaAvaliacaoNoBanco(cls);
            if (!sucesso) {
                alert("Erro ao salvar alterações no banco.");
                return false;
            }

            alert("Componente atualizado com sucesso!");
            return true;
        });

    // Remove handler
    setTimeout(() => {
        const remBtn = document.getElementById("remove-comp");
        if (remBtn) {
            remBtn.onclick = async () => {
                if (confirm("Deseja remover este componente?")) {
                    cls.grading.components.splice(index, 1);
                    
                    // Remove as notas deste componente de todos os alunos
                    const componente_id = `comp_${comp.id || index}`;
                    cls.students.forEach(s => {
                        if (s.grades && s.grades[componente_id]) {
                            delete s.grades[componente_id];
                        }
                    });

                    // Salva no banco
                    const sucesso = await salvarSistemaAvaliacaoNoBanco(cls);
                    if (!sucesso) {
                        alert("Erro ao remover componente no banco.");
                        return;
                    }

                    modal.classList.add("hidden");
                    renderTable();
                }
            };
        }
    }, 80);
}

// =======================
// Calcular Média
// =======================
async function calcularMedia(cls) {
    if (!cls.grading || !cls.grading.components.length) {
        alert("Adicione ao menos um componente.");
        return;
    }

    // Verificação de pesos para média ponderada
    if (cls.grading.type === "Ponderada") {
        const totalPeso = cls.grading.components.reduce((sum, c) => sum + (c.weight || 0), 0);
        if (Math.abs(totalPeso - 10) > 0.01) {
            alert(`A soma dos pesos deve ser exatamente 10. Atual: ${totalPeso}`);
            return;
        }
    }

    const averages = [];

    cls.students.forEach(stu => {
        let media = 0;

        if (cls.grading.type === "Aritmética") {
            // Soma todas as notas e divide pela quantidade de componentes
            const notas = Object.values(stu.grades || {});
            if (notas.length > 0) {
                const soma = notas.reduce((a, b) => a + (parseFloat(b) || 0), 0);
                media = soma / notas.length;
            }
        } else {
            // Média ponderada
            let somaPond = 0;
            cls.grading.components.forEach((comp, index) => {
                const componente_id = `comp_${comp.id || index}`;
                const nota = stu.grades?.[componente_id] || 0;
                somaPond += (parseFloat(nota) || 0) * (comp.weight || 0);
            });
            media = somaPond / 10;
        }

        stu.media = Math.round(media * 100) / 100;
        averages.push({ 
            id_estudante: stu.id_estudante, 
            media: stu.media 
        });
    });

    // Salva as médias no banco
    const sucesso = await salvarMediasNoBanco(averages, cls.id_turma, cls.grading.type);
    if (!sucesso) {
        alert("Erro ao salvar médias no banco.");
        return;
    }

    renderTable();
    alert("Médias calculadas e salvas com sucesso!");
}

// =======================
// Importar CSV (lista de alunos)
// =======================
function importCSV(){
    const csvFileInput = document.createElement('input');
    csvFileInput.type = 'file';
    csvFileInput.accept = '.csv';
    csvFileInput.style.display = 'none';
    document.body.appendChild(csvFileInput);

    csvFileInput.addEventListener('change', (event) => {
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


// =======================
// PROCESSAR CSV
// =======================

async function csvData(csvText) {
    // CSV esperado: Nome;RA
    const cls = data.institutions[path[0]].courses[path[1]].subjects[path[2]].classes[path[3]];

    const lines = csvText.split(/\r?\n/);
    
    let sucessos = 0;
    let erros = [];
    
    // Mostra indicador de carregamento
    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Importando alunos do CSV...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;font-weight:bold;';
    document.body.appendChild(loadingMsg);

    try {
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = line.split(';');
            if (columns.length >= 2) {
                const name = columns[0].trim();
                const ra = columns[1].trim();

                if (!name || !ra) {
                    console.warn(`⚠ Linha ${i+1} ignorada: dados incompletos`);
                    continue;
                }

                // ============================
                // 🔒 VERIFICAÇÃO LOCAL
                // Evita adicionar RA duplicado no array
                // ============================
                const existsLocal = cls.students.some(s => s.ra === ra);
                if (existsLocal) {
                    console.warn(`⚠ RA duplicado ignorado: ${ra}`);
                    erros.push(`RA ${ra}: já existe na turma`);
                    continue;
                }

                // ============================
                // 📤 ENVIA PARA O BACKEND
                // ============================
                try {
                    const response = await fetch("/api/students", {  // Endpoint pra qual é enviado
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: name,
                            ra: ra,
                            id_turma: cls.id_turma  // utilização do ID da turma
                        })
                    });

                    const result = await response.json();
                    
                    if (response.ok && result.ok) {
                        sucessos++;
                        console.log(`✅ Aluno ${name} (${ra}) adicionado com sucesso`);
                    } else {
                        console.error(`Erro ao adicionar ${name} (${ra}):`, result.error);
                        erros.push(`${name} (${ra}): ${result.error || 'Erro desconhecido'}`);
                    }
                } catch (err) {
                    console.error(`Erro ao enviar estudante ${name} (${ra}):`, err);
                    erros.push(`${name} (${ra}): Erro de conexão`);
                }
            }
        }

        // Remove indicador de carregamento
        document.body.removeChild(loadingMsg);

        // Mostra resultado
        let mensagem = `✅ ${sucessos} aluno(s) importado(s) com sucesso!`;
        
        if (erros.length > 0) {
            mensagem += `\n\n⚠️ ${erros.length} erro(s):\n` + erros.join('\n');
        }
        
        alert(mensagem);

        // Recarrega os dados para refletir as mudanças
        await carregarInstituicoesECursos();
        
    } catch (err) {
        // Remove indicador de carregamento em caso de erro
        if (document.body.contains(loadingMsg)) {
            document.body.removeChild(loadingMsg);
        }
        console.error("Erro ao processar CSV:", err);
        alert("Erro ao processar arquivo CSV.");
    }
}

// =======================
// Exportar CSV
// =======================
function exportCSV(){
    // Obtém a turma atual navegando pela estrutura de dados
    const cls = data.institutions[path[0]].courses[path[1]].subjects[path[2]].classes[path[3]];
    const students = cls.students || [];

    if (students.length === 0){
        alert("Não há estudantes cadastrados.");
        return;
    }

    //seprador utilizado no arquivo CSV
    const separator = ';';

    // Cabeçalhos padrões
    let headers = ['Nome', 'RA'];

    if (cls.grading && cls.grading.components.length) {
        cls.grading.components.forEach(comp => {
            headers.push(comp.nickname);
        });
        headers.push("Média");
    }

    let csvContent = headers.join(separator) + "\n";
    students.forEach(stu => {
        let row = [];
        row.push(stu.name);
        row.push(stu.ra || "-");

        // Adiciona as notas caso existam componentes cadastrados
        if (cls.grading && cls.grading.components.length) {
            cls.grading.components.forEach((comp, index) => {
                const grade = stu.grades && stu.grades[index] !== undefined ? stu.grades[index] : 0;
                row.push(grade.toString().replace('.',','));
            });
        }
        const media = stu.media !== undefined && stu.media !== null ? stu.media.toFixed(2).replace('.',',') : '-';
        row.push(media);
        csvContent += row.join(separator) + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], {type: 'text/csv;charset=utf-8;'});
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;

    // Define nome do arquivo usando o número da turma
    const clsId = cls.number || 'turma';
    link.download = `export_${clsId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}


// ===== Integração com o servidor =====

// 1 Salvar Instituição
async function salvarInstituicaoNoBanco(nomeInstituicao) {
    try {
        //Obtem o usuário logado
        const usuario = JSON.parse(localStorage.getItem("currentUser"));
        if (!usuario || !usuario.id_usuario) {
            alert("Usuário não autenticado.");
            return null;
        }

        console.log("Salvando instituição:", nomeInstituicao);
        
        const response = await fetch("/api/institutions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_usuario: usuario.id_usuario,
                name: nomeInstituicao
            })
        });

        const result = await response.json();
        console.log("Resposta do servidor:", result);
        
        if (!response.ok || !result.ok) {
            console.error("Erro ao salvar instituição:", result.error);
            alert("Erro ao salvar instituição: " + (result.error || "Erro desconhecido"));
            return null;
        }

        console.log("✅ Instituição salva:", result);
        return result.instituicaoId;
    } catch (err) {
        console.error("❌ Erro inesperado ao salvar instituição:", err);
        alert("Erro inesperado ao salvar instituição.");
        return null;
    }
}

// 2 Salvar Curso vinculado à Instituição
async function salvarCursoNoBanco(nomeCurso, periodo, idInstituicao) {
    try {
        const response = await fetch("/api/courses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: nomeCurso,
                period: periodo,
                id_instituicao: idInstituicao
            })
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
            console.error("Erro ao salvar curso:", result.error);
            alert("Erro ao salvar curso no banco.");
            return false;
        }

        console.log("✅ Curso salvo:", result);
        return true;
    } catch (err) {
        console.error("Erro inesperado ao salvar curso:", err);
        alert("Erro inesperado ao salvar curso.");
        return false;
    }
}

// 3. Salva a Disciplina vinculada ao Curso
async function salvarDisciplinaNoBanco(nomeDisciplina, codigo, periodo, apelido, idCurso) {
    try {
        
        const response = await fetch("/api/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: nomeDisciplina,
                code: codigo,
                period: periodo,
                nickname: apelido || "-",
                id_curso: idCurso
            })
        });

        const result = await response.json();
        console.log("Resposta da API:", result);
        
        if (!response.ok || !result.ok) {
            console.error("Erro ao salvar disciplina:", result.error);
            alert("Erro ao salvar disciplina: " + (result.error || "Erro desconhecido"));
            return false;
        }

        console.log("✅ Disciplina salva:", result);
        return true;
    } catch (err) {
        console.error("Erro inesperado ao salvar disciplina:", err);
        alert("Erro de conexão ao salvar disciplina.");
        return false;
    }
}

// 4. Salva a Turma vinculada à Disciplina
async function salvarTurmaNoBanco(number, nickname, location, schedule, idDisciplina) {
    try {
        console.log("Enviando turma para o servidor:", { number, nickname, location, schedule, idDisciplina });

        const response = await fetch("/api/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                number: number,
                nickname: nickname || "-",
                schedule: schedule,
                location: location,
                id_disciplina: idDisciplina
            })
        });
        
        const result = await response.json();
        console.log("Resposta da API:", result);
        
        if (!response.ok || !result.ok) {
            console.error("Erro ao salvar turma:", result.error);
            alert("Erro ao salvar turma: " + (result.error || "Erro desconhecido"));
            return false;
        }
        
        console.log("✅ Turma salva:", result);
        return true;
    } catch (err) {
        console.error("Erro inesperado ao salvar turma:", err);
        alert("Erro de conexão ao salvar turma.");
        return false;
    }
}

// 5. Salva o Aluno vinculado à Turma
async function salvarAlunoNoBanco(name, ra, idTurma) {
    try {
        console.log("Enviando aluno para o servidor:", { name, ra, idTurma });
        const response = await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                ra: ra,
                id_turma: idTurma
            })
        });
        const result = await response.json();
        console.log("Resposta da API:", result);
        if (!response.ok || !result.ok) {
            console.error("Erro ao salvar aluno:", result.error);
            alert("Erro ao salvar aluno: " + (result.error || "Erro desconhecido"));
            return false;
        }
        console.log("✅ Aluno salvo:", result);
        return true;
    } catch (err) {
        console.error("Erro inesperado ao salvar aluno:", err);
        alert("Erro de conexão ao salvar aluno.");
        return false;
    }
}

// 7. Salva a Nota do Estudante para um Componente
async function salvarNotaNoBanco(id_estudante, id_turma, componente_id, nota) {
    try {
        const response = await fetch("/api/student-grades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_estudante: id_estudante,
                id_turma: id_turma,
                componente_id: componente_id,
                nota: nota
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (err) {
        console.error("Erro ao salvar nota:", err);
        return false;
    }
}

// 8. Salva as Médias Calculadas no Banco
async function salvarMediasNoBanco(averages, id_turma, tipo_media) {
    try {
        const response = await fetch("/api/save-calculated-averages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                averages: averages,
                id_turma: id_turma,
                tipo_media: tipo_media
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (err) {
        console.error("Erro ao salvar médias:", err);
        return false;
    }
}


// =======================
// Gerenciar Componentes de Nota
// =======================
async function carregarComponentesNota(cls) {
    try {
        const response = await fetch(`/api/grade-components?id_turma=${cls.id_turma}`);
        const result = await response.json();
        
        if (result.ok && Array.isArray(result.components)) {

            // Garante estrutura de grading
            cls.grading = cls.grading || { 
                type: cls.tipo_media || "Aritmética", 
                components: [] 
            };

            // Mapeia componentes vindos da API
            cls.grading.components = result.components.map(comp => ({
                id_componente_nota: comp.ID_COMPONENTE_NOTA,
                name: comp.NOME,
                nickname: comp.SIGLA,
                description: comp.DESCRICAO || "",
                weight: comp.PESO || 0
            }));
        }
    } catch (err) {
        console.error("Erro ao carregar componentes:", err);
    }
}

async function carregarNotasEstudantes(cls) {
    try {
        const response = await fetch(`/api/student-grades?id_turma=${cls.id_turma}`);
        const result = await response.json();
        
        if (result.ok && Array.isArray(result.grades)) {

            // Inicializa grades para todos os estudantes
            cls.students.forEach(estudante => {
                if (!estudante.grades) estudante.grades = {};
            });

            // Preenche as notas do banco
            result.grades.forEach(gradeData => {
                const estudante = cls.students.find(s => s.id_estudante === gradeData.ID_ESTUDANTE);
                if (estudante && gradeData.NOTAS) {
                    // NOTAS é um objeto { componente_id: nota }
                    estudante.grades = { ...estudante.grades, ...gradeData.NOTAS };
                }
            });
        }
    } catch (err) {
        console.error("Erro ao carregar notas:", err);
    }
}

function configurarEdicaoNotas() {
    tableBody.querySelectorAll("td.grade-cell").forEach(td => {

        //Salvar valor original ao "focar"
        td.addEventListener("focus", () => {
            td.dataset.original = td.textContent.trim();
        });

        td.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                await salvarNotaEmFoco(td);
                td.blur();
            }
        });

        td.addEventListener("blur", async () => {
            await salvarNotaEmFoco(td);
        });
    });
}

//Salva a nota alterada pelo usuário
async function salvarNotaEmFoco(td) {
    const newValue = td.textContent.trim();
    const originalValue = td.dataset.original;
    
    // Só salva se houve alteração
    if (newValue !== originalValue) {
        const rowIndex = td.parentElement.rowIndex - 1;
        const compIndex = parseInt(td.dataset.comp);
        const cls = data.institutions[path[0]].courses[path[1]].subjects[path[2]].classes[path[3]];
        const aluno = cls.students[rowIndex];
        const componente = cls.grading.components[compIndex];
        
        const nota = parseFloat(newValue) || 0;
        
        // Validação da nota
        if (nota < 0 || nota > 10) {
            alert("Nota deve estar entre 0 e 10.");
            td.textContent = originalValue;
            return;
        }
        
        // Gera o componente_id no formato usado pelo servidor
        const componente_id = `comp_${componente.id || compIndex}`;
        
        // Atualiza localmente
        if (!aluno.grades) aluno.grades = {};
        aluno.grades[componente_id] = nota;
        
        // Salva no banco
        const sucesso = await salvarNotaNoBanco(
            aluno.id_estudante,
            cls.id_turma,
            componente_id,
            nota
        );
        
        
        if (!sucesso) {
            alert("Erro ao salvar nota no banco.");
            td.textContent = originalValue;
        } 
        
    }
}

async function carregarMediasDoBanco(cls) {
    try {
        const response = await fetch(`/api/calculated-averages?id_turma=${cls.id_turma}`);
        const result = await response.json();
        
        if (result.ok && Array.isArray(result.averages)) {
            //Associação do aluno com sua média
            result.averages.forEach(avg => {
                const aluno = cls.students.find(s => s.id_estudante === avg.ID_ESTUDANTE);
                if (aluno) {
                    aluno.media = avg.MEDIA;
                }
            });
        }
    } catch (err) {
        console.error("Erro ao carregar médias:", err);
    }
}

// Carregar sistema de avaliação (componentes) do banco
async function carregarSistemaAvaliacao(cls) {
    try {
        const response = await fetch(`/api/classes/${cls.id_turma}/grading-system`);
        const result = await response.json();
        
        if (result.ok) {
            cls.tipo_media = result.tipo_media || 'Aritmética';
            
            let componentes = [];
            if (result.componentes_nota && Array.isArray(result.componentes_nota)) {
                componentes = result.componentes_nota;
            }
            
            cls.grading = {
                type: cls.tipo_media,
                components: componentes
            };
            
            console.log("✅ Sistema de avaliação carregado:", cls.grading);
        }
    } catch (err) {
        console.error("Erro ao carregar sistema de avaliação:", err);
    }
}

// Salvar sistema de avaliação no banco
async function salvarSistemaAvaliacaoNoBanco(cls) {
    try {
        const response = await fetch(`/api/classes/${cls.id_turma}/grading-system`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tipo_media: cls.grading.type,
                componentes: cls.grading.components
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (err) {
        console.error("Erro ao salvar sistema de avaliação:", err);
        return false;
    }
}

async function atualizarTipoMediaNoBanco(cls, novoTipo) {
    try {
        // Atualiza através do endpoint de sistema de avaliação
        const sucesso = await salvarSistemaAvaliacaoNoBanco(cls);
        return sucesso;
    } catch (err) {
        console.error("Erro ao atualizar tipo de média:", err);
        return false;
    }
}

// Função para carregar turmas
async function carregarTurmasParaDisciplinas() {
    try {
        console.log("🔄 Carregando turmas para todas as disciplinas...");
        for (let inst of data.institutions) {
            for (let course of inst.courses) {
                for (let subject of course.subjects) {
                    if (!subject.id_disciplina) {
                        console.warn("Disciplina sem ID:", subject);
                        continue;
                    }
                    try {
                        const response = await fetch(`/api/classes?id_disciplina=${subject.id_disciplina}`);
                        if (!response.ok) {
                            console.error(`Erro ao buscar turmas para disciplina ${subject.id_disciplina}:`, response.statusText);
                            continue;
                        }
                        const result = await response.json();
                        if (result.ok && Array.isArray(result.classes)) {
                            // Mapeia turmas recebidas
                            subject.classes = result.classes.map(turma => ({
                                id_turma: turma.ID_TURMA,
                                number: turma.NUMERO,
                                nickname: turma.APELIDO || "-",
                                schedule: turma.HORARIOS || [],
                                location: turma.LOCAL,
                                tipo_media: turma.TIPO_MEDIA,
                                students: []
                            }));
                            console.log(`✅ ${subject.classes.length} turmas carregadas para disciplina ${subject.name}`);
                        }
                        else {
                            console.log(`❌ Nenhuma turma encontrada para disciplina ${subject.name}`);
                            subject.classes = []; 
                        }
                    } catch (err) {
                        console.error(`❌ Erro ao carregar turmas para disciplina ${subject.id_disciplina}:`, err);
                        subject.classes = []; 
                    }
                }
            }
        }
        console.log("✅ Carregamento de turmas concluído");
    } catch (err) {
        console.error("❌ Erro geral ao carregar turmas:", err);
    }
}


// Função para carregar disciplinas
async function carregarDisciplinasParaCursos() {
    try {
        console.log("🔄 Carregando disciplinas para todos os cursos...");
        
        for (let inst of data.institutions) {
            for (let course of inst.courses) {
                if (!course.id_curso) {
                    console.warn("Curso sem ID:", course);
                    continue;
                }
                
                try {
                    const response = await fetch(`/api/subjects?id_curso=${course.id_curso}`);
                    
                    if (!response.ok) {
                        console.error(`Erro ao buscar disciplinas para curso ${course.id_curso}:`, response.statusText);
                        continue;
                    }
                    
                    const result = await response.json();
                    
                    
                    if (result.ok && Array.isArray(result.subjects)) {
                        course.subjects = result.subjects.map(disciplina => ({
                            id_disciplina: disciplina.ID_DISCIPLINA,
                            name: disciplina.NOME,
                            code: disciplina.CODIGO,
                            period: disciplina.PERIODO,
                            nickname: disciplina.APELIDO || "-",
                            classes: []
                        }));
                        console.log(`✅ ${course.subjects.length} disciplinas carregadas para curso ${course.name}`);
                    } else {
                        console.log(`❌ Nenhuma disciplina encontrada para curso ${course.name}`);
                        course.subjects = []; 
                    }
                } catch (err) {
                    console.error(`❌ Erro ao carregar disciplinas para curso ${course.id_curso}:`, err);
                    course.subjects = []; 
                }
            }
        }
        
        console.log("✅ Carregamento de disciplinas concluído");
    } catch (err) {
        console.error("❌ Erro geral ao carregar disciplinas:", err);
    }
}

// Função para carregar alunos para turmas
async function carregarAlunosParaTurmas() {
    try {
        console.log("🔄 Carregando alunos para todas as turmas...");
        for (let inst of data.institutions) {
            for (let course of inst.courses) {
                for (let subject of course.subjects) {
                    for (let cls of subject.classes) {
                        if (!cls.id_turma) {
                            console.warn("Turma sem ID:", cls);
                            continue;
                        }
                        try {
                            const response = await fetch(`/api/students?id_turma=${cls.id_turma}`);
                            if (!response.ok) {
                                console.error(`Erro ao buscar alunos para turma ${cls.id_turma}:`, response.statusText);
                                continue;
                            }
                            const result = await response.json();
                            if (result.ok && Array.isArray(result.students)) {
                                cls.students = result.students.map(aluno => ({
                                    id_estudante: aluno.ID_ESTUDANTE,
                                    name: aluno.NOME,
                                    ra: aluno.RA,
                                    grades: {} // Inicializa como objeto vazio
                                }));
                                
                                // Carrega as notas para esta turma
                                await carregarNotasEstudantes(cls);
                                
                                // Carrega as médias calculadas
                                await carregarMediasDoBanco(cls);
                                
                                console.log(`✅ ${cls.students.length} alunos carregados para turma ${cls.number}`);
                            } else {
                                console.log(`❌ Nenhum aluno encontrado para turma ${cls.number}`);
                                cls.students = []; 
                            }
                        } catch (err) {
                            console.error(`❌ Erro ao carregar alunos para turma ${cls.id_turma}:`, err);
                            cls.students = []; 
                        }
                    }
                }
            }
        }
        console.log("✅ Carregamento de alunos concluído");
    } catch (err) {
        console.error("❌ Erro geral ao carregar alunos:", err);
    }   
}

async function carregarInstituicoesECursos() {
    try {
        // Faz autenticação primeiro
        if (!verificarAutenticacao()) return;

        const usuario = JSON.parse(localStorage.getItem("currentUser"));
        
        console.log("Carregando instituições para usuário:", usuario.id_usuario);
        
        const response = await fetch(`/api/institutions?id_usuario=${usuario.id_usuario}`);
        
        if (!response.ok) {
            console.error("Erro ao buscar instituições:", response.statusText);
            alert("Erro ao carregar instituições.");
            return;
        }
        
        const result = await response.json();
        console.log("Resposta da API:", result);

        if (!result.ok) {
            console.error("Erro na resposta:", result.error);
            return;
        }

        if (Array.isArray(result.institutions)) {
            
            data.institutions = result.institutions.map(inst => ({
                id_instituicao: inst.ID_INSTITUICAO, 
                name: inst.NOME,
                courses: []
            }));
            
            console.log("Instituições carregadas:", data.institutions);
            
            // Carrega cursos para cada instituição
            await carregarCursosParaInstituicoes();
            
            // Carrega as disciplinas para todos os cursos
            await carregarDisciplinasParaCursos();

            // Carrega as turmas para todas as disciplinas
            await carregarTurmasParaDisciplinas();

            // Carrega os alunos para todas as turmas
            await carregarAlunosParaTurmas();

            // Carrega componentes de nota corretamente
            await carregarComponentesNotaParaTodasTurmas();

            // Carrega notas dos estudantes corretamente
            await carregarNotasParaTodasTurmas();
            
        } else {
            data.institutions = [];
            console.log("Nenhuma instituição encontrada");
        }

        renderTable();

    } catch (err) {
        console.error("❌ Erro ao carregar instituições:", err);
        alert("Erro ao carregar dados. Verifique sua conexão.");
    }
}

async function carregarComponentesNotaParaTodasTurmas() {
    try {
        console.log("📄 Carregando componentes de nota para todas as turmas...");
        for (let inst of data.institutions) {
            for (let course of inst.courses || []) {
                for (let subject of course.subjects || []) {
                    for (let cls of subject.classes || []) {
                        if (cls && cls.id_turma) {
                            await carregarComponentesNota(cls);
                        }
                    }
                }
            }
        }
        console.log("✅ Componentes de nota carregados");
    } catch (err) {
        console.error("❌ Erro ao carregar componentes de nota:", err);
    }
}

async function carregarNotasParaTodasTurmas() {
    try {
        console.log("📄 Carregando notas para todas as turmas...");
        for (let inst of data.institutions) {
            for (let course of inst.courses || []) {
                for (let subject of course.subjects || []) {
                    for (let cls of subject.classes || []) {
                        if (cls && cls.id_turma) {
                            await carregarNotasEstudantes(cls);
                            await carregarMediasDoBanco(cls);
                        }
                    }
                }
            }
        }
        console.log("✅ Notas carregadas");
    } catch (err) {
        console.error("❌ Erro ao carregar notas:", err);
    }
}


async function carregarCursosParaInstituicoes() {
    try {
        for (let inst of data.institutions) {
            // Verifica se a instituição tem ID válido
            if (!inst.id_instituicao) {
                console.warn("Instituição sem ID:", inst);
                continue;
            }

            try {
                const response = await fetch(`/api/courses?id_instituicao=${inst.id_instituicao}`);
                
                if (!response.ok) {
                    console.error(`Erro ao buscar cursos para instituição ${inst.id_instituicao}:`, response.statusText);
                    continue;
                }
                
                const result = await response.json();
                
                if (result.ok && result.courses && result.courses.length > 0) {
                    // Mapeia os cursos para a estrutura interna
                    inst.courses = result.courses.map(curso => ({
                        id_curso: curso.ID_CURSO,
                        name: curso.NOME,
                        period: curso.PERIODO_CURSO,
                        subjects: []
                    }));
                    console.log(`✅ Cursos carregados para instituição ${inst.id_instituicao}:`, inst.courses.length);
                } else {
                    console.log(`Nenhum curso encontrado para instituição ${inst.id_instituicao}`);
                    inst.courses = [];
                }
            } catch (err) {
                console.error(`❌ Erro ao carregar cursos para instituição ${inst.id_instituicao}:`, err);
                inst.courses = [];
            }
        }
    } catch (err) {
        console.error("Erro geral ao carregar cursos:", err);
    }
}


// =======================
// Excluir Alunos (checkboxes)
// =======================
async function excluirAlunos(cls) {
    const checkboxesSelected = tableBody.querySelectorAll('.solo-delete:checked');
    
    if (checkboxesSelected.length === 0) {
        alert("Selecione pelo menos um aluno para remover.");
        return;
    }
    
    if (!confirm(`Você tem certeza que quer remover ${checkboxesSelected.length} aluno(s)?\n\n⚠️ ATENÇÃO: Todas as notas e médias vinculadas a este(s) aluno(s) também serão removidas!`)) {
        return;
    }

    const idsParaRemover = [];
    const indicesParaRemover = [];
    
    checkboxesSelected.forEach(cb => {
        const linha = cb.closest('tr');
        const rowIndex = linha.rowIndex - 1; // -1 por causa do header
        const aluno = cls.students[rowIndex];
        
        if (aluno && aluno.id_estudante) {
            idsParaRemover.push(aluno.id_estudante);
            indicesParaRemover.push(rowIndex);
        }
    });

    // Mostra indicador de carregamento
    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Excluindo alunos...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;font-weight:bold;';
    document.body.appendChild(loadingMsg);

    try {
        let erros = [];
        
        // Deleta cada aluno do banco
        for (const id_estudante of idsParaRemover) {
            const response = await fetch(`/api/students/${id_estudante}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();
            
            if (!response.ok || !result.ok) {
                console.error(`Erro ao deletar estudante ${id_estudante}:`, result.error);
                erros.push(`Estudante ID ${id_estudante}: ${result.error || "Erro desconhecido"}`);
            }
        }

        if (erros.length > 0) {
            alert("Alguns alunos não puderam ser deletados:\n" + erros.join("\n"));
        } else {
            alert("Aluno(s) deletado(s) com sucesso!");
        }

        // Recarrega os dados para refletir as mudanças
        await carregarInstituicoesECursos();
        
    } catch (err) {
        console.error("Erro ao deletar alunos:", err);
        alert("Erro ao deletar alunos. Verifique sua conexão.");
    } finally {
        // Remove indicador de carregamento
        document.body.removeChild(loadingMsg);
    }
}

// =======================
// Excluir Instituição (com validação)
// =======================
async function excluirInstituicaoPeloIndice(index) {
    const inst = data.institutions[index];
    if (!inst) {
        alert("Instituição não encontrada.");
        return;
    }
    
    if (!inst.id_instituicao) {
        alert("Instituição sem ID válido.");
        return;
    }

    // ✅ VALIDAÇÃO LOCAL: Verifica se tem cursos
    const totalCursos = inst.courses?.length || 0;
    if (totalCursos > 0) {
        alert(`❌ Não é possível excluir esta instituição.\n\nEla possui ${totalCursos} curso(s) vinculado(s).\n\n💡 Remova todos os cursos primeiro.`);
        return;
    }
    
    if (!confirm(`Tem certeza que deseja excluir a instituição "${inst.name}"?`)) {
        return;
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-delete-inst';
    loadingMsg.textContent = 'Excluindo instituição...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;font-weight:bold;';
    document.body.appendChild(loadingMsg);

    try {
        const response = await fetch(`/api/institutions/${inst.id_instituicao}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });

        const result = await response.json();
        
        if (!response.ok || !result.ok) {
            console.error("Erro ao deletar instituição:", result.error);
            alert(result.error || "Erro desconhecido ao deletar instituição");
            return;
        }

        data.institutions.splice(index, 1);
        path = [];
        alert("✅ Instituição deletada com sucesso!");
        await renderTable();
        
    } catch (err) {
        console.error("❌ Erro ao deletar instituição:", err);
        alert("Erro de conexão ao deletar instituição.");
    } finally {
        const loading = document.getElementById('loading-delete-inst');
        if (loading) document.body.removeChild(loading);
    }
}

// =======================
// Excluir Cursos (com validação)
// =======================
async function excluirCurso(inst) { 
    const checkboxesSelected = tableBody.querySelectorAll('.solo-delete:checked');
    if (checkboxesSelected.length === 0) {
        alert("Por favor, selecione pelo menos um curso para remover.");
        return;
    }

    const idsParaRemover = [];
    const cursosComDisciplinas = [];
    
    checkboxesSelected.forEach(cb => {
        const linha = cb.closest('tr');
        const index = parseInt(linha.dataset.index);
        const curso = inst.courses[index];
        
        if (curso && curso.id_curso) {
            idsParaRemover.push(curso.id_curso);
            
            // ✅ VALIDAÇÃO LOCAL: Verifica se tem disciplinas
            const totalDisciplinas = curso.subjects?.length || 0;
            if (totalDisciplinas > 0) {
                cursosComDisciplinas.push(`${curso.name} (${totalDisciplinas} disciplina${totalDisciplinas > 1 ? 's' : ''})`);
            }
        }
    });

    // Se algum curso tiver disciplinas, bloqueia
    if (cursosComDisciplinas.length > 0) {
        alert(`❌ Não é possível excluir os seguintes cursos:\n\n${cursosComDisciplinas.join('\n')}\n\n💡 Remova todas as disciplinas primeiro.`);
        return;
    }

    if (!confirm(`Você tem certeza que quer remover ${checkboxesSelected.length} curso(s)?`)) {
        return;
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Excluindo cursos...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;font-weight:bold;';
    document.body.appendChild(loadingMsg);

    try {
        let erros = [];
        
        for (const id_curso of idsParaRemover) {
            const response = await fetch(`/api/courses/${id_curso}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();
            
            if (!response.ok || !result.ok) {
                erros.push(result.error || `Curso ID ${id_curso}: Erro desconhecido`);
            }
        }

        if (erros.length > 0) {
            alert("❌ Alguns cursos não puderam ser deletados:\n\n" + erros.join("\n"));
        } else {
            alert("✅ Curso(s) deletado(s) com sucesso!");
        }

        await carregarInstituicoesECursos();
        
    } catch (err) {
        console.error("Erro ao deletar cursos:", err);
        alert("Erro ao deletar cursos. Verifique sua conexão.");
    } finally {
        document.body.removeChild(loadingMsg);
    }
}

// =======================
// Excluir Disciplinas (com validação)
// =======================
async function excluirDisciplina(course) {
    const checkboxesSelected = tableBody.querySelectorAll('.solo-delete:checked');
    if (checkboxesSelected.length === 0) {
        alert("Por favor, selecione pelo menos uma disciplina para remover.");
        return;
    }

    const idsParaRemover = [];
    const disciplinasComTurmas = [];
    
    checkboxesSelected.forEach(cb => {
        const linha = cb.closest('tr');
        const index = parseInt(linha.dataset.index);
        const disciplina = course.subjects[index];
        
        if (disciplina && disciplina.id_disciplina) {
            idsParaRemover.push(disciplina.id_disciplina);
            
            // ✅ VALIDAÇÃO LOCAL: Verifica se tem turmas
            const totalTurmas = disciplina.classes?.length || 0;
            if (totalTurmas > 0) {
                disciplinasComTurmas.push(`${disciplina.name} (${totalTurmas} turma${totalTurmas > 1 ? 's' : ''})`);
            }
        }
    });

    // Se alguma disciplina tiver turmas, bloqueia
    if (disciplinasComTurmas.length > 0) {
        alert(`❌ Não é possível excluir as seguintes disciplinas:\n\n${disciplinasComTurmas.join('\n')}\n\n💡 Remova todas as turmas primeiro.`);
        return;
    }
    
    if (!confirm(`Você tem certeza que quer remover ${checkboxesSelected.length} disciplina(s)?`)) {
        return;
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Excluindo disciplinas...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;font-weight:bold;';
    document.body.appendChild(loadingMsg);

    try {
        let erros = [];
        
        for (const id_disciplina of idsParaRemover) {
            const response = await fetch(`/api/subjects/${id_disciplina}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();
            
            if (!response.ok || !result.ok) {
                erros.push(result.error || `Disciplina ID ${id_disciplina}: Erro desconhecido`);
            }
        }

        if (erros.length > 0) {
            alert("❌ Algumas disciplinas não puderam ser deletadas:\n\n" + erros.join("\n"));
        } else {
            alert("✅ Disciplina(s) deletada(s) com sucesso!");
        }

        await carregarInstituicoesECursos();
        
    } catch (err) {
        console.error("Erro ao deletar disciplinas:", err);
        alert("Erro ao deletar disciplinas. Verifique sua conexão.");
    } finally {
        document.body.removeChild(loadingMsg);
    }
}

// =======================
// Excluir Turmas (com validação)
// =======================
async function excluirTurmas(subj) {
    const checkboxesSelected = tableBody.querySelectorAll('.solo-delete:checked');
    if (checkboxesSelected.length === 0) {
        alert("Por favor, selecione pelo menos uma turma para remover.");
        return;
    }

    const idsParaRemover = [];
    const turmasComAlunos = [];
    
    checkboxesSelected.forEach(cb => {
        const linha = cb.closest('tr');
        const index = parseInt(linha.dataset.index);
        const turma = subj.classes[index];
        
        if (turma && turma.id_turma) {
            idsParaRemover.push(turma.id_turma);
            
            // ✅ VALIDAÇÃO LOCAL: Verifica se tem estudantes
            const totalEstudantes = turma.students?.length || 0;
            if (totalEstudantes > 0) {
                turmasComAlunos.push(`${turma.number} (${totalEstudantes} estudante${totalEstudantes > 1 ? 's' : ''})`);
            }
        }
    });

    // Se alguma turma tiver estudantes, bloqueia
    if (turmasComAlunos.length > 0) {
        alert(`❌ Não é possível excluir as seguintes turmas:\n\n${turmasComAlunos.join('\n')}\n\n💡 Remova todos os estudantes primeiro.`);
        return;
    }
    
    if (!confirm(`Você tem certeza que quer remover ${checkboxesSelected.length} turma(s)?`)) {
        return;
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = 'Excluindo turmas...';
    loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:9999;font-weight:bold;';
    document.body.appendChild(loadingMsg);

    try {
        let erros = [];
        
        for (const id_turma of idsParaRemover) {
            const response = await fetch(`/api/classes/${id_turma}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" }
            });

            const result = await response.json();
            
            if (!response.ok || !result.ok) {
                erros.push(result.error || `Turma ID ${id_turma}: Erro desconhecido`);
            }
        }

        if (erros.length > 0) {
            alert("❌ Algumas turmas não puderam ser deletadas:\n\n" + erros.join("\n"));
        } else {
            alert("✅ Turma(s) deletada(s) com sucesso!");
        }

        await carregarInstituicoesECursos();
        
    } catch (err) {
        console.error("Erro ao deletar turmas:", err);
        alert("Erro ao deletar turmas. Verifique sua conexão.");
    } finally {
        document.body.removeChild(loadingMsg);
    }
}
// =======================
// Inicialização
// =======================
document.addEventListener('DOMContentLoaded', async function() {
    if (!verificarAutenticacao()) {
        return;
    }
    
    console.log("Iniciando carregamento de dados...");
    await carregarInstituicoesECursos();
    console.log("✅ Dados carregados com sucesso!");
    
});