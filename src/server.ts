import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import oracledb from "oracledb";
import { getConnection, initOraclePool } from "./config/db.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { enviarEmailRecuperacao } from "./services/emailService.js";

dotenv.config();

/*
  Autores:
    Gabriel Scolfaro de Azeredo (principal)
    Matheus Antony Lucas Lima
*/

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT; // Formato de saída como objeto

oracledb.fetchTypeHandler = (meta) => {                       // configuração para tratar CLOB como STRING
  if (meta.dbType === oracledb.DB_TYPE_CLOB) {
    return { type: oracledb.STRING };
  }
};

// Caminhos absolutos da raiz do projeto e da pasta public
const ROOT_DIR = path.resolve(__dirname, ".."); // sobe da pasta dist/ para a raiz
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Public path
app.use(express.static(PUBLIC_DIR));
app.use(express.static(path.join(__dirname, "../public")));
app.use("/htmls", express.static(path.join(PUBLIC_DIR, "htmls")));
app.use("/styles", express.static(path.join(PUBLIC_DIR, "styles")));
app.use("/images", express.static(path.join(PUBLIC_DIR, "images")));
app.use("/scripts", express.static(path.join(PUBLIC_DIR, "scripts")));

//Criação de um interface conta
interface CreateAccount{
  name: string;
  surname:string;
  email: string;
  telefone:string;
  password:string;
}


// Gera um token curto (6 dígitos hex -> 6 chars)
function generateToken() {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // ex: "A1F3B2"
}

// Formata Date para 'YYYY-MM-DD HH24:MI:SS' para uso em TO_TIMESTAMP
function formatTimestampForOracle(d: Date) {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ===================================================
//  Criação de tabelas
// ===================================================
async function initializeDatabase() {
  let connection;
  try {
    connection = await getConnection();

    // ==========================================
    // 1. USUARIO
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE usuario (
            id_usuario NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            sobrenome VARCHAR2(100) NOT NULL,
            telefone VARCHAR2(20) NOT NULL,
            email VARCHAR2(100) NOT NULL UNIQUE,
            senha VARCHAR2(100) NOT NULL,

            -- Novas colunas adicionadas diretamente
            token_recuperacao VARCHAR2(20),
            expira_em TIMESTAMP
          )';
      EXCEPTION 
        WHEN OTHERS THEN 
          IF SQLCODE != -955 THEN -- ORA-00955: nome já usado
            RAISE;
          END IF;
      END;
    `);

    // ==========================================
    // 2. INSTITUICAO (COM FK PARA USUARIO)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE instituicao (
            id_instituicao NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            id_usuario NUMBER NOT NULL,
            CONSTRAINT fk_instituicao_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 3. CURSO (VINCULADO À INSTITUIÇÃO)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE curso (
            id_curso NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            periodo_curso NUMBER CHECK (periodo_curso BETWEEN 1 AND 12) NOT NULL,
            nome VARCHAR2(100) NOT NULL,
            id_instituicao NUMBER NOT NULL,
            CONSTRAINT fk_curso_instituicao FOREIGN KEY (id_instituicao) REFERENCES instituicao(id_instituicao) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 4. DISCIPLINA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE disciplina (
            id_disciplina NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            codigo VARCHAR2(50) NOT NULL,
            periodo NUMBER NOT NULL CHECK (periodo BETWEEN 1 AND 12),
            apelido VARCHAR2(50)
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 5. REL (RELACIONAMENTO CURSO ↔ DISCIPLINA)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE rel (
            id_curso NUMBER NOT NULL,
            id_disciplina NUMBER NOT NULL,
            CONSTRAINT pk_rel PRIMARY KEY (id_curso, id_disciplina),
            CONSTRAINT fk_rel_curso FOREIGN KEY (id_curso) REFERENCES curso(id_curso) ON DELETE CASCADE,
            CONSTRAINT fk_rel_disciplina FOREIGN KEY (id_disciplina) REFERENCES disciplina(id_disciplina) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 6. TURMA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE turma (
            id_turma NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            numero VARCHAR2(100) NOT NULL,
            horarios VARCHAR2(1000) NOT NULL,
            local VARCHAR2(100) NOT NULL,
            apelido VARCHAR2(50),
            id_disciplina NUMBER NOT NULL,
            
            -- Colunas para o sistema de avaliação
            tipo_media VARCHAR2(20) DEFAULT ''Aritmética'' NOT NULL,
            componentes_nota CLOB, -- Armazena JSON com { id, name, nickname, weight, ... }

            CONSTRAINT fk_turma_disciplina FOREIGN KEY (id_disciplina) REFERENCES disciplina(id_disciplina) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 7. ESTUDANTE (SEM IDENTITY - ID MANUAL)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE estudante (
            id_estudante NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            ra VARCHAR2(50) NOT NULL,
            id_turma NUMBER NOT NULL,
            CONSTRAINT fk_estudante_turma FOREIGN KEY (id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 8. NOTA_ESTUDANTE 
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE nota_estudante (
            id_nota NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            id_estudante NUMBER NOT NULL,
            id_turma NUMBER NOT NULL,
            componente_id VARCHAR2(100) NOT NULL, -- ID do componente (ex: "comp_123456")
            nota NUMBER(4,2) CHECK (nota BETWEEN 0 AND 10),
            CONSTRAINT fk_nota_estudante FOREIGN KEY (id_estudante) REFERENCES estudante(id_estudante) ON DELETE CASCADE,
            CONSTRAINT fk_nota_turma FOREIGN KEY (id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE,
            CONSTRAINT uq_estudante_componente UNIQUE (id_estudante, id_turma, componente_id)
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 9. MEDIA_CALCULADA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE media_calculada (
            id_estudante NUMBER NOT NULL,
            id_turma NUMBER NOT NULL,
            media NUMBER(4,2),
            tipo_media VARCHAR2(20) NOT NULL,
            data_calculo TIMESTAMP DEFAULT SYSTIMESTAMP,
            CONSTRAINT pk_media_calculada PRIMARY KEY (id_estudante, id_turma),
            CONSTRAINT fk_media_calc_estudante FOREIGN KEY (id_estudante) REFERENCES estudante(id_estudante) ON DELETE CASCADE,
            CONSTRAINT fk_media_calc_turma FOREIGN KEY (id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 10. AUDITORIA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE auditoria (
            id_auditoria NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            data DATE,
            hora TIMESTAMP,
            id_turma NUMBER
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // TRIGGER PARA AUDITORIA DE TURMA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE OR REPLACE TRIGGER audit_turma_changes
          AFTER INSERT OR UPDATE OR DELETE ON turma
          FOR EACH ROW
          BEGIN
            IF INSERTING THEN
              INSERT INTO auditoria (data, hora, id_turma) VALUES (SYSDATE, SYSTIMESTAMP, :NEW.id_turma);
            ELSIF UPDATING THEN
              INSERT INTO auditoria (data, hora, id_turma) VALUES (SYSDATE, SYSTIMESTAMP, :NEW.id_turma);
            ELSIF DELETING THEN
              INSERT INTO auditoria (data, hora, id_turma) VALUES (SYSDATE, SYSTIMESTAMP, :OLD.id_turma);
            END IF;
          END;
        ';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -20000 THEN RAISE; END IF;
      END;
    `);

    console.log("✅ Tabelas (lógica de notas refatorada) e trigger verificados/criados com sucesso.");

    // ==========================================
    // Adicionar colunas de recuperação de senha
    // ==========================================
    const colunas = await connection.execute(`
      SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'USUARIO'
    `);
    const existentes = colunas.rows?.map((r: any) => r.COLUMN_NAME) || [];

    if (!existentes.includes("TOKEN_RECUPERACAO")) {
      await connection.execute(`ALTER TABLE usuario ADD (token_recuperacao VARCHAR2(20))`);
      console.log("🛠️ Coluna TOKEN_RECUPERACAO adicionada.");
    }

    if (!existentes.includes("EXPIRA_EM")) {
      await connection.execute(`ALTER TABLE usuario ADD (expira_em TIMESTAMP)`);
      console.log("🛠️ Coluna EXPIRA_EM adicionada.");
    }

    await connection.commit();
    console.log("✅ Estrutura de recuperação de senha verificada com sucesso.");

  } catch (err) {
    console.error("❌ Erro ao inicializar banco:", err);
  } finally {
    if (connection) await connection.close();
  }
}



// ===================================================
//  Criar conta
// ===================================================
app.post("/api/create-account", async (req: Request, res: Response) => {
  let connection;
  try {
    const { name, surname, email, telephone, password } = req.body;

    console.log("📥 Dados recebidos:", { name, surname, email, telephone });

    if (!name || !surname || !email || !telephone || !password) {
      return res.status(400).json({ ok: false, error: "Todos os campos são obrigatórios." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: "Email inválido." });
    }

    connection = await getConnection();

    const check = await connection.execute(
      "SELECT COUNT(*) AS COUNT FROM usuario WHERE email = :email",
      [email]
    );

    const count = (check.rows?.[0] as any).COUNT;
    if (count > 0) {
      return res.status(400).json({ ok: false, error: "Email já registrado." });
    }

    // Inserir usuário
    const result = await connection.execute(
      `INSERT INTO usuario (nome, sobrenome, email, telefone, senha)
       VALUES (:nome, :sobrenome, :email, :telefone, :senha)
       RETURNING id_usuario INTO :id`,
      {
        nome: name.trim(),
        sobrenome: surname.trim(),
        email,
        telefone: telephone,
        senha: password,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    await connection.commit();

    const outBinds = result.outBinds as { id: number[] };
    const userId = outBinds.id[0];

    res.status(201).json({ ok: true, message: "Conta criada com sucesso!", userId });
  } catch (err) {
    console.error("❌ Erro ao criar conta:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao criar conta." });
  } finally {
    if (connection) await connection.close();
  }
});


// ===================================================
//  Login
// ===================================================
app.post("/api/login", async (req: Request, res: Response) => {
  let connection;
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email e senha são obrigatórios." });
    }

    connection = await getConnection();

    const result = await connection.execute("SELECT * FROM usuario WHERE email = :email", [email]);
    const user = result.rows?.[0] as any;

    if (!user) {
      return res.status(404).json({ ok: false, error: "Usuário não encontrado." });
    }

    if (user.SENHA !== password) {
      return res.status(401).json({ ok: false, error: "Senha incorreta." });
    }

    console.log("✅ Login realizado:", user.EMAIL);
    res.json({
      ok: true,
      message: "Login realizado com sucesso!",
      user: {
        id_usuario: user.ID_USUARIO,
        email: user.EMAIL,
        nome: user.NOME,
        sobrenome: user.SOBRENOME,
      }
      ,
    });
  } catch (err) {
    console.error("❌ Erro no login:", err);
    res.status(500).json({ ok: false, error: "Erro interno no servidor." });
  } finally {
    if (connection) await connection.close();
  }
});


// ===================================================
//  Instituição - (CRIA E CONSULTA)
// ===================================================
app.post("/api/institutions", async (req: Request, res: Response) => {
  let connection;
  try {
    const { name, id_usuario } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ ok: false, error: "Nome da instituição é obrigatório." });
    }

    if (!id_usuario) {
      return res.status(400).json({ ok: false, error: "Usuário não autenticado." });
    }

    connection = await getConnection();

    // Verifica se o usuário existe
    const userCheck = await connection.execute(
      "SELECT COUNT(*) AS user_count FROM usuario WHERE id_usuario = :id_usuario",
      [id_usuario]
    );

    const userCount = (userCheck.rows?.[0] as any).USER_COUNT;
    if (userCount === 0) {
      return res.status(404).json({ ok: false, error: "Usuário não encontrado." });
    }

    const result = await connection.execute(
      `INSERT INTO instituicao (nome, id_usuario)
        VALUES (:nome, :id_usuario)
        RETURNING id_instituicao INTO :id`,
      {
        nome: name.trim(),
        id_usuario: id_usuario,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    await connection.commit();

    const outBinds = result.outBinds as { id: number[] };
    const instituicaoId = outBinds.id[0];

    res.status(201).json({ ok: true, message: "Instituição criada com sucesso!", instituicaoId });
  } catch (err) {
    console.error("❌ Erro ao criar instituição:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao criar instituição." });
  } finally {
    if (connection) await connection.close();
  }
});

// Consulta instituições
app.get('/api/institutions', async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_usuario, name } = req.query;

    connection = await getConnection();

    let query = 'SELECT id_instituicao, nome, id_usuario FROM instituicao WHERE 1=1';
    const params: any[] = [];

    if (id_usuario) {
      query += ' AND id_usuario = :id_usuario';
      params.push(id_usuario);
    }
    if (name) {
        query += ' AND UPPER(nome) LIKE UPPER(:name)';
      params.push(`%${name}%`);
    }

    query += ' ORDER BY nome';
    const result = await connection.execute(query, params);
    
    const institutions = (result.rows || []).map((row: any) => ({
      ID_INSTITUICAO: row.ID_INSTITUICAO,
      NOME: row.NOME,
      ID_USUARIO: row.ID_USUARIO
    }));

    res.json({ 
      ok: true, 
      institutions: institutions, 
      count: institutions.length 
    });
    
  } catch (err) {
    console.error("❌ Erro ao buscar instituições:", err);
    res.status(500).json({ 
      ok: false, 
      error: 'Erro ao buscar instituições' 
    });
  } finally {
    if (connection) await connection.close();
  }
});



// ===================================================
//  Disciplina - (CRIA E CONSULTA)
// ===================================================
app.post("/api/subjects", async (req: Request, res: Response) => {
  let connection;
  try {
    const { name, code, period, nickname, id_curso } = req.body;

    console.log("📥 Dados recebidos para disciplina:", { name, code, period, nickname,id_curso });

    if (!name?.trim() || !code?.trim() || !period || !id_curso) {
      return res.status(400).json({ ok: false, error: "Nome, código, período  e curso são obrigatórios." });
    }
    if (period < 1 || period > 12) {
      return res.status(400).json({ ok: false, error: "Período deve estar entre 1 e 12." });
    }

    connection = await getConnection();

    // Verifica se o curso existe
    const courseCheck = await connection.execute(
      "SELECT COUNT(*) AS course_count FROM curso WHERE id_curso = :id_curso",
      [id_curso]
    );
    const courseCount = (courseCheck.rows?.[0] as any).COURSE_COUNT;
    if (courseCount === 0) {
      return res.status(404).json({ ok: false, error: "Curso não encontrado." });
    }

    // Verifica se o código já existe
    const codeCheck = await connection.execute(
      "SELECT COUNT(*) AS code_count FROM disciplina WHERE UPPER(codigo) = UPPER(:codigo)",
      [code]
    );
    const codeCount = (codeCheck.rows?.[0] as any).CODE_COUNT;
    if (codeCount > 0) {
      return res.status(400).json({ ok: false, error: "Código da disciplina já existe." });
    }

    
    const result = await connection.execute(
      `INSERT INTO disciplina (nome, codigo, periodo, apelido)
        VALUES (:nome, :codigo, :periodo, :apelido)
        RETURNING id_disciplina INTO :id`,
      {
        nome: name.trim(),
        codigo: code.trim(),
        periodo: period,
        apelido: nickname?.trim() || null,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    const outBinds = result.outBinds as { id: number[] };
    const disciplinaId = outBinds.id[0];

    
    await connection.execute(
      `INSERT INTO rel (id_curso, id_disciplina)
        VALUES (:id_curso, :id_disciplina)`,
      {
        id_curso: id_curso,
        id_disciplina: disciplinaId
      }
    );

    await connection.commit();

    res.status(201).json({ ok: true, message: "Disciplina criada com sucesso!", disciplinaId });
  } catch (err) {
    console.error("❌ Erro ao criar disciplina:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao criar disciplina." });
  } finally {
    if (connection) await connection.close();
  }
});


// Consulta disciplinas
app.get("/api/subjects", async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_curso, name, code } = req.query;

    connection = await getConnection();

    let query = '';
    const params: any[] = [];

    if (id_curso) {

      query = `
        SELECT d.id_disciplina, d.nome, d.codigo, d.periodo, d.apelido
        FROM disciplina d
        INNER JOIN rel r ON d.id_disciplina = r.id_disciplina
        INNER JOIN curso c ON r.id_curso = c.id_curso
        WHERE c.id_curso = :id_curso
      `;
      params.push(id_curso);
      
      if (name) {
        query += ' AND UPPER(d.nome) LIKE UPPER(:name)';
        params.push(`%${name}%`);
      }
      if (code) {
        query += ' AND UPPER(d.codigo) LIKE UPPER(:code)';
        params.push(`%${code}%`);
      }
    } else {
      // Consulta geral de disciplinas
      query = 'SELECT id_disciplina, nome, codigo, periodo, apelido FROM disciplina WHERE 1=1';
      
      if (name) {
        query += ' AND UPPER(nome) LIKE UPPER(:name)';
        params.push(`%${name}%`);
      }
      if (code) {
        query += ' AND UPPER(codigo) LIKE UPPER(:code)';
        params.push(`%${code}%`);
      }
    }

    query += ' ORDER BY nome';

    const result = await connection.execute(query, params);
    
    const subjects = (result.rows || []).map((row: any) => ({
      ID_DISCIPLINA: row.ID_DISCIPLINA,
      NOME: row.NOME,
      CODIGO: row.CODIGO,
      PERIODO: row.PERIODO,
      APELIDO: row.APELIDO
    }));

    res.json({ 
      ok: true, 
      subjects: subjects, 
      count: subjects.length 
    });
    
  } catch (err) {
    console.error("❌ Erro ao buscar disciplinas:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Erro interno ao buscar disciplinas." 
    });
  } finally {
    if (connection) await connection.close();
  }
});

// ===================================================
//  Turma - (CRIA E CONSULTA)
// ===================================================
app.post("/api/classes", async (req: Request, res: Response) => {
  let connection;
  try {
    const { number, nickname, schedule, location, id_disciplina } = req.body;
    
    console.log("📥 Dados recebidos para turma:", { number, nickname, schedule, location, id_disciplina });

    if (!number?.trim() || !schedule || !Array.isArray(schedule) || schedule.length === 0 || !location?.trim() || !id_disciplina) {
      return res.status(400).json({ ok: false, error: "Número, horários (array), local e disciplina são obrigatórios." });
    }

    connection = await getConnection();

    // Verifica se a disciplina existe
    const disciplineCheck = await connection.execute(
      "SELECT COUNT(*) AS discipline_count FROM disciplina WHERE id_disciplina = :id_disciplina",
      [id_disciplina]
    );
    const disciplineCount = (disciplineCheck.rows?.[0] as any).DISCIPLINE_COUNT;
    if (disciplineCount === 0) {
      return res.status(404).json({ ok: false, error: "Disciplina não encontrada." });
    }

    
    const horariosJSON = JSON.stringify(schedule);

    const result = await connection.execute(
      `INSERT INTO turma (numero, apelido, horarios, local, id_disciplina)
        VALUES (:numero, :apelido, :horarios, :local, :id_disciplina)
        RETURNING id_turma INTO :id`,
      {
        numero: number.trim(),
        apelido: nickname?.trim() || null,
        horarios: horariosJSON,
        local: location.trim(),
        id_disciplina: id_disciplina,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    await connection.commit();

    const outBinds = result.outBinds as { id: number[] };
    const turmaId = outBinds.id[0];

    res.status(201).json({ ok: true, message: "Turma criada com sucesso!", turmaId });
  } catch (err) {
    console.error("❌ Erro ao criar turma:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao criar turma." });
  } finally {
    if (connection) await connection.close();
  }
});



// ===================================================
//  Deletar Estudante
// ===================================================
app.delete('/api/students/:id', async (req: Request, res: Response) => {
  let connection;
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ ok: false, error: "ID do estudante é obrigatório." });
    }

    connection = await getConnection();

    // Verifica se o estudante existe
    const studentCheck = await connection.execute(
      "SELECT COUNT(*) AS student_count FROM estudante WHERE id_estudante = :id_estudante",
      [id]
    );
    
    const studentCount = (studentCheck.rows?.[0] as any).STUDENT_COUNT;
    if (studentCount === 0) {
      return res.status(404).json({ ok: false, error: "Estudante não encontrado." });
    }

    // Deleta o estudante (CASCADE vai deletar as notas vinculadas)
    await connection.execute(
      "DELETE FROM estudante WHERE id_estudante = :id_estudante",
      [id]
    );

    await connection.commit();

    console.log(`✅ Estudante ID ${id} deletado com sucesso`);
    res.json({ ok: true, message: "Estudante deletado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao deletar estudante:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao deletar estudante." });
  } finally {
    if (connection) await connection.close();
  }
});

// Consulta turmas
app.get("/api/classes", async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_disciplina, number } = req.query;

    connection = await getConnection();

    let query = `
      SELECT id_turma, numero, apelido, horarios, local, id_disciplina,
             tipo_media, componentes_nota 
      FROM turma 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_disciplina) {
      query += ' AND id_disciplina = :id_disciplina';
      params.push(id_disciplina);
    }
    if (number) {
      query += ' AND UPPER(numero) LIKE UPPER(:number)';
      params.push(`%${number}%`);
    }

    query += ' ORDER BY numero';

    const result = await connection.execute(query, params);
    

    const classes = (result.rows || []).map((row: any) => {
      // Processar horários
      let horariosArray = [];
      try {
        if (row.HORARIOS) {
          if (typeof row.HORARIOS === 'string') {
            horariosArray = JSON.parse(row.HORARIOS);
          } else if (Array.isArray(row.HORARIOS)) {
            horariosArray = row.HORARIOS;
          }
        }
      } catch (e) {
        console.error("Erro ao parsear horários:", e);
        horariosArray = [];
      }
      
      // Processar componentes_nota
      let componentesArray = [];
      try {
        if (row.COMPONENTES_NOTA) {
          // Se for string, tenta parsear
          if (typeof row.COMPONENTES_NOTA === 'string') {
            componentesArray = JSON.parse(row.COMPONENTES_NOTA);
          } 
          // Se já for objeto, cria uma cópia limpa
          else if (typeof row.COMPONENTES_NOTA === 'object' && row.COMPONENTES_NOTA !== null) {
            // Fazer uma cópia profunda limpa do objeto
            componentesArray = JSON.parse(JSON.stringify(row.COMPONENTES_NOTA));
          }
        }
      } catch (e) {
        console.error(`Erro ao processar componentes_nota (ID_TURMA: ${row.ID_TURMA}):`, e);
        componentesArray = [];
      }

      // Retornar objeto simples e limpo
      return {
        ID_TURMA: row.ID_TURMA,
        NUMERO: row.NUMERO,
        APELIDO: row.APELIDO,
        HORARIOS: horariosArray,
        LOCAL: row.LOCAL,
        ID_DISCIPLINA: row.ID_DISCIPLINA,
        TIPO_MEDIA: row.TIPO_MEDIA,
        COMPONENTES_NOTA: componentesArray
      };
    });

    res.json({ 
      ok: true, 
      classes: classes, 
      count: classes.length 
    });
    
  } catch (err) {
    console.error("❌ Erro ao buscar turmas:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Erro interno ao buscar turmas." 
    });
  } finally {
    if (connection) await connection.close();
  }
});

app.get("/api/classes/:id/grading-system", async (req: Request, res: Response) => {
  let connection;

  try {
    const { id } = req.params;

    connection = await getConnection();

    const result = await connection.execute(
      `SELECT tipo_media, componentes_nota 
         FROM turma 
        WHERE id_turma = :id_turma`,
      { id_turma: id }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Turma não encontrada." });
    }

    const row = result.rows[0] as any;

    let componentes = [];

    try {
      if (row.COMPONENTES_NOTA) {

        if (typeof row.COMPONENTES_NOTA === "string") {
          componentes = JSON.parse(row.COMPONENTES_NOTA);

        
        } else if (row.COMPONENTES_NOTA instanceof Buffer) {
          const text = row.COMPONENTES_NOTA.toString("utf8");
          componentes = JSON.parse(text);

        
        } else {
          console.warn("Valor inesperado em COMPONENTES_NOTA. Ignorando.");
          componentes = [];
        }
      }
    } catch (e) {
      console.error(`Erro ao processar componentes_nota (ID_TURMA: ${id}):`, e);
      componentes = [];
    }

    return res.json({
      ok: true,
      tipo_media: row.TIPO_MEDIA,
      componentes_nota: componentes
    });

  } catch (err) {
    console.error("❌ Erro ao carregar sistema de avaliação:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao carregar sistema de avaliação."
    });
  } finally {
    if (connection) await connection.close();
  }
});



// ===================================================
//  Estudante - (CRIA E CONSULTA)
// ===================================================
app.post("/api/students", async (req: Request, res: Response) => {
  let connection;
  try {
    const { name, ra, id_turma } = req.body;
    if (!name?.trim() || !ra?.trim() || !id_turma) {
      return res.status(400).json({ ok: false, error: "Nome, RA e turma são obrigatórios." });
    }

    connection = await getConnection();

    // Verifica se a turma existe
    const classCheck = await connection.execute(
      "SELECT COUNT(*) AS class_count FROM turma WHERE id_turma = :id_turma",
      [id_turma]
    );
    const classCount = (classCheck.rows?.[0] as any).CLASS_COUNT;
    if (classCount === 0) {
      return res.status(404).json({ ok: false, error: "Turma não encontrada." });
    }

    const result = await connection.execute(
      `INSERT INTO estudante (nome, ra, id_turma)
        VALUES (:nome, :ra, :id_turma)
        RETURNING id_estudante INTO :id`,
      {
        nome: name.trim(),
        ra: ra.trim(),
        id_turma: id_turma,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    await connection.commit();

    const outBinds = result.outBinds as { id: number[] };
    const estudanteId = outBinds.id[0];

    res.status(201).json({ ok: true, message: "Estudante criado com sucesso!", estudanteId });
  } catch (err) {
    console.error("❌ Erro ao criar estudante:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao criar estudante." });
  } finally {
    if (connection) await connection.close();
  }
});

// Consulta estudantes
app.get("/api/students", async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_turma, name, ra } = req.query;

    connection = await getConnection();

    let query = 'SELECT id_estudante, nome, ra, id_turma FROM estudante WHERE 1=1';
    const params: any[] = [];

    if (id_turma) {
      query += ' AND id_turma = :id_turma';
      params.push(id_turma);
    }
    if (name) {
      query += ' AND UPPER(nome) LIKE UPPER(:name)';
      params.push(`%${name}%`);
    }
    if (ra) {
      query += ' AND UPPER(ra) LIKE UPPER(:ra)';
      params.push(`%${ra}%`);
    }

    query += ' ORDER BY nome';

    const result = await connection.execute(query, params);
    
    const students = (result.rows || []).map((row: any) => ({
      ID_ESTUDANTE: row.ID_ESTUDANTE,
      NOME: row.NOME,
      RA: row.RA,
      ID_TURMA: row.ID_TURMA
    }));

    res.json({ 
      ok: true, 
      students: students, 
      count: students.length 
    });
    
  } catch (err){
    console.error("❌ Erro ao buscar estudantes:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Erro interno ao buscar estudantes." 
    });
  } finally {
    if (connection) await connection.close();
  }
});


// ===================================================
//  Curso - (CRIA E CONSULTA)
// ===================================================

app.post("/api/courses", async (req: Request, res: Response) => {
  let connection;
  try {
    const { name, period, id_instituicao} = req.body;
    if (!name?.trim() || !period ) {
      return res.status(400).json({ ok: false, error: "Nome e período do curso são obrigatórios." });
    }
    if (period < 1 || period > 12) {
    return res.status(400).json({ ok: false, error: "Período deve estar entre 1 e 12." });
    }

    if (!id_instituicao) {
      return res.status(400).json({ ok: false, error: "Instituição é obrigatória." });
    }

    connection = await getConnection();


    // Verifica se a instituição existe
    const institutionCheck  = await connection.execute(
      "SELECT COUNT(*) AS institution_count  FROM instituicao WHERE id_instituicao = :id_instituicao",
      [id_instituicao]
    );

    const institutionCount = (institutionCheck.rows?.[0] as any).INSTITUTION_COUNT;
    if (institutionCount === 0) {
      return res.status(404).json({ ok: false, error: "Instituição não encontrada." });
    }

    const result = await connection.execute(
      `INSERT INTO curso (nome, periodo_curso, id_instituicao)
        VALUES (:nome, :periodo_curso, :id_instituicao)
        RETURNING id_curso INTO :id`,
      {
        nome: name.trim(),
        periodo_curso: period,
        id_instituicao: id_instituicao,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      }
    );

    await connection.commit();

    const outBinds = result.outBinds as { id: number[] };
    const cursoId = outBinds.id[0];

    res.status(201).json({ ok: true, message: "Curso criado com sucesso!", cursoId });
  } catch (err) {
    console.error("❌ Erro ao criar curso:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao criar curso." });
  } finally {
    if (connection) await connection.close();
  }

});

// Consulta cursos
app.get("/api/courses", async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_instituicao, name, period} = req.query;

    connection = await getConnection();

    let query = `
      SELECT c.id_curso, c.nome, c.periodo_curso, c.id_instituicao, i.nome as instituicao_nome
      FROM curso c
      INNER JOIN instituicao i ON c.id_instituicao = i.id_instituicao
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_instituicao) {
      query += ' AND c.id_instituicao = :id_instituicao';
      params.push(id_instituicao);
    }
    if (name) {
      query += ' AND UPPER(c.nome) LIKE UPPER(:name)';
      params.push(`%${name}%`);
    }
    if (period) {
      query += ' AND c.periodo_curso = :periodo_curso';
      params.push(period);
    }

    query += ' ORDER BY c.nome, c.periodo_curso';

    const result = await connection.execute(query, params);
    
    const courses = (result.rows || []).map((row: any) => ({
      ID_CURSO: row.ID_CURSO,
      NOME: row.NOME,
      PERIODO_CURSO: row.PERIODO_CURSO,
      ID_INSTITUICAO: row.ID_INSTITUICAO,
      INSTITUICAO_NOME: row.INSTITUICAO_NOME
    }));

    res.json({ 
      ok: true, 
      courses: courses, 
      count: courses.length 
    });
    
  } catch (err) {
    console.error("❌ Erro ao buscar cursos:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Erro interno ao buscar cursos." 
    });
  } finally {
    if (connection) await connection.close();
  }
});




// ===================================================
//  Sistema de Avaliação (CRIA E CONSULTA)
// ===================================================
app.post("/api/classes/:id/grading-system", async (req: Request, res: Response) => {
  let connection;

  try {
    const { id } = req.params;
    const { tipo_media, componentes } = req.body;

    if (!tipo_media || !componentes || !Array.isArray(componentes)) {
      return res.status(400).json({
        ok: false,
        error: "Tipo de média e lista de componentes são obrigatórios."
      });
    }

    connection = await getConnection();

    await connection.execute(
      `UPDATE turma
          SET tipo_media = :tipo_media,
              componentes_nota = :componentes_nota
        WHERE id_turma = :id_turma`,
      {
        tipo_media,
        componentes_nota: {
          val: JSON.stringify(componentes),   // conteúdo do JSON
          type: oracledb.CLOB                 // garante salvar como CLOB
        },
        id_turma: id
      }
    );

    await connection.commit();

    return res.json({
      ok: true,
      message: "Sistema de avaliação salvo com sucesso!"
    });

  } catch (err) {
    console.error("❌ Erro ao salvar sistema de avaliação:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao salvar sistema de avaliação."
    });
  } finally {
    if (connection) await connection.close();
  }
});



// ===================================================
//  Notas dos Estudantes - (CRIA , ATUALIZA e CONSULTA)
// ===================================================
app.post("/api/student-grades", async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_estudante, id_turma, componente_id, nota } = req.body;

    if (!id_estudante || !id_turma || !componente_id || nota === undefined) {
      return res.status(400).json({ ok: false, error: "Todos os campos são obrigatórios (estudante, turma, componente, nota)." });
    }

    if (nota < 0 || nota > 10) {
      return res.status(400).json({ ok: false, error: "Nota deve estar entre 0 e 10." });
    }

    connection = await getConnection();

    // Insere ou atualiza a nota na nova tabela nota_estudante
    await connection.execute(
      `MERGE INTO nota_estudante n
       USING DUAL
       ON (n.id_estudante = :id_estudante AND n.id_turma = :id_turma AND n.componente_id = :componente_id)
       WHEN MATCHED THEN
         UPDATE SET n.nota = :nota
       WHEN NOT MATCHED THEN
         INSERT (id_estudante, id_turma, componente_id, nota)
         VALUES (:id_estudante, :id_turma, :componente_id, :nota)`,
      {
        id_estudante: id_estudante,
        id_turma: id_turma,
        componente_id: componente_id,
        nota: nota,
      }
    );

    await connection.commit();

    res.json({ ok: true, message: "Nota salva com sucesso!" });
  } catch (err) {
    console.error("❌ Erro ao salvar nota:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao salvar nota." });
  } finally {
    if (connection) await connection.close();
  }
});

// Consulta notas dos estudantes por turma
app.get("/api/student-grades", async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_turma } = req.query;

    if (!id_turma) {
      return res.status(400).json({ ok: false, error: "ID da turma é obrigatório." });
    }

    connection = await getConnection();

    // 1. Busca todos os estudantes da turma
    const studentsResult = await connection.execute(
      `SELECT id_estudante, nome, ra FROM estudante WHERE id_turma = :id_turma ORDER BY nome`,
      [id_turma]
    );

    // 2. Busca todas as notas da turma
    const gradesResult = await connection.execute(
      `SELECT id_estudante, componente_id, nota FROM nota_estudante WHERE id_turma = :id_turma`,
      [id_turma]
    );

    // 3. Mapeia as notas
    const gradesMap = new Map<number, any>(); // Map<id_estudante, {comp_id: nota, ...}>
    gradesResult.rows?.forEach((row: any) => {
      if (!gradesMap.has(row.ID_ESTUDANTE)) {
        gradesMap.set(row.ID_ESTUDANTE, {});
      }
      gradesMap.get(row.ID_ESTUDANTE)[row.COMPONENTE_ID] = row.NOTA;
    });

    // 4. Monta a resposta final
    const grades = studentsResult.rows?.map((student: any) => {
      return {
        ID_ESTUDANTE: student.ID_ESTUDANTE,
        NOME: student.NOME,
        RA: student.RA,
        NOTAS: gradesMap.get(student.ID_ESTUDANTE) || {}
      };
    });

    res.json({ ok: true, grades });
  } catch (err) {
    console.error("❌ Erro ao buscar notas:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao buscar notas." });
  } finally {
    if (connection) await connection.close();
  }
});


// ===================================================
//  Salvar Médias Calculadas
// ===================================================
app.post("/api/save-calculated-averages", async (req: Request, res: Response) => {
  let connection;
  try {
    const { averages, id_turma, tipo_media } = req.body;

    if (!averages || !id_turma || !tipo_media) {
      return res.status(400).json({ ok: false, error: "Dados incompletos." });
    }

    connection = await getConnection();

    for (const avg of averages) {
      await connection.execute(
        `MERGE INTO media_calculada USING DUAL
         ON (id_estudante = :id_estudante AND id_turma = :id_turma)
         WHEN MATCHED THEN
           UPDATE SET media = :media, tipo_media = :tipo_media, data_calculo = SYSTIMESTAMP
         WHEN NOT MATCHED THEN
           INSERT (id_estudante, id_turma, media, tipo_media)
           VALUES (:id_estudante, :id_turma, :media, :tipo_media)`,
        {
          id_estudante: avg.id_estudante,
          id_turma: id_turma,
          media: avg.media,
          tipo_media: tipo_media
        }
      );
    }

    await connection.commit();

    res.json({ ok: true, message: "Médias salvas com sucesso!" });
  } catch (err) {
    console.error("❌ Erro ao salvar médias:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao salvar médias." });
  } finally {
    if (connection) await connection.close();
  }
});

// ===================================================
//  Carregar Médias Calculadas
// ===================================================
app.get("/api/calculated-averages", async (req: Request, res: Response) => {
  let connection;
  try {
    const { id_turma } = req.query;

    if (!id_turma) {
      return res.status(400).json({ ok: false, error: "ID da turma é obrigatório." });
    }

    connection = await getConnection();

    const result = await connection.execute(
      `SELECT id_estudante, media, tipo_media 
       FROM media_calculada 
       WHERE id_turma = :id_turma`,
      [id_turma]
    );

    const averages = (result.rows || []).map((row: any) => ({
      ID_ESTUDANTE: row.ID_ESTUDANTE,
      MEDIA: row.MEDIA,
      TIPO_MEDIA: row.TIPO_MEDIA
    }));

    res.json({ 
      ok: true, 
      averages: averages 
    });
    
  } catch (err) {
    console.error("❌ Erro ao carregar médias:", err);
    res.status(500).json({ 
      ok: false, 
      error: "Erro interno ao carregar médias." 
    });
  } finally {
    if (connection) await connection.close();
  }
});



// ===================================================
//  Rotas estáticas
// ===================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "htmls", "index.html"));
});

app.get("/:page", (req, res) => {
  const page = path.join(PUBLIC_DIR, "htmls", `${req.params.page}.html`);
  fs.existsSync(page) ? res.sendFile(page) : res.status(404).send("Página não encontrada");
});

// ===================================================
// 🚀 Inicialização
// ===================================================
async function startServer() {
  try {
    await initOraclePool();
    await initializeDatabase();
    app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));
  } catch (err) {
    console.error("❌ Falha ao iniciar servidor:", err);
    process.exit(1);
  }
}
// =====================
// Solicitar reset: gera token, grava no usuario, envia email
// =====================
app.post("/api/request-password-reset", async (req: Request, res: Response) => {
  let connection;
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ ok: false, error: "Email é obrigatório." });

    connection = await getConnection();

    // Verifica se o usuário existe
    const result = await connection.execute(
      "SELECT * FROM usuario WHERE email = :email",
      [email]
    );
    const user = result.rows?.[0] as any;
    if (!user)
      return res.status(404).json({ ok: false, error: "Usuário não encontrado." });

    //  Gera token e define expiração
    const token = generateToken();
    const expireDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    const expireStr = formatTimestampForOracle(expireDate);

    //  Atualiza o usuário com token e expiração
    await connection.execute(
      `UPDATE usuario
         SET token_recuperacao = :token,
             expira_em = TO_TIMESTAMP(:expira, 'YYYY-MM-DD HH24:MI:SS')
       WHERE email = :email`,
      { token, expira: expireStr, email }
    );

    await connection.commit();

    
    
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: "Recuperação de senha - seu token",
      text: `Você solicitou redefinição de senha. Use o token abaixo (válido por 15 minutos):\n\n${token}\n\nSe não foi você, ignore este email.`,
      html: `<p>Você solicitou redefinição de senha. Use o token abaixo (válido por 15 minutos):</p>
             <h2>${token}</h2>
             <p>Se não foi você, ignore este email.</p>`
    };

    await enviarEmailRecuperacao(email, token);
    

    //  Resposta ao cliente
    res.json({ ok: true, message: "Token gerado com sucesso (email não enviado)." });
  } catch (err) {
    console.error("❌ Erro ao solicitar reset:", err);
    res.status(500).json({ ok: false, error: "Erro no servidor." });
  } finally {
    if (connection) await connection.close();
  }
});


// =====================
// Verificar token
// =====================
app.post("/api/verify-token", async (req: Request, res: Response) => {
  let connection;
  try {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ ok: false, error: "Email e token são obrigatórios." });

    connection = await getConnection();
    const result = await connection.execute("SELECT token_recuperacao, expira_em FROM usuario WHERE email = :email", [email]);
    const row = result.rows?.[0] as any;
    if (!row || !row.TOKEN_RECUPERACAO) return res.status(404).json({ ok: false, error: "Token não encontrado para esse usuário." });

    const storedToken = row.TOKEN_RECUPERACAO;
    const expiresAt = row.EXPIRA_EM; // should be JS Date object

    if (storedToken !== token) return res.status(401).json({ ok: false, error: "Token inválido." });

    const now = new Date();
    if (expiresAt && expiresAt instanceof Date && expiresAt < now) {
      return res.status(401).json({ ok: false, error: "Token expirou." });
    }

    res.json({ ok: true, message: "Token válido." });
  } catch (err) {
    console.error("❌ Erro ao verificar token:", err);
    res.status(500).json({ ok: false, error: "Erro no servidor." });
  } finally {
    if (connection) await connection.close();
  }
});

// =====================
// Resetar senha
// =====================
app.post("/api/reset-password", async (req: Request, res: Response) => {
  let connection;
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ ok: false, error: "Email, token e nova senha são obrigatórios." });

    connection = await getConnection();
    const result = await connection.execute("SELECT token_recuperacao, expira_em FROM usuario WHERE email = :email", [email]);
    const row = result.rows?.[0] as any;
    if (!row || !row.TOKEN_RECUPERACAO) return res.status(404).json({ ok: false, error: "Token não encontrado." });

    const storedToken = row.TOKEN_RECUPERACAO;
    const expiresAt = row.EXPIRA_EM;

    if (storedToken !== token) return res.status(401).json({ ok: false, error: "Token inválido." });

    if (expiresAt && expiresAt instanceof Date && expiresAt < new Date()) {
      return res.status(401).json({ ok: false, error: "Token expirou." });
    }

    // Atualiza a senha e limpa token/expiração
    await connection.execute(
      `UPDATE usuario
       SET senha = :senha,
           token_recuperacao = NULL,
           expira_em = NULL
       WHERE email = :email`,
      { senha: newPassword, email }
    );

    await connection.commit();

    res.json({ ok: true, message: "Senha redefinida com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao resetar senha:", err);
    res.status(500).json({ ok: false, error: "Erro no servidor." });
  } finally {
    if (connection) await connection.close();
  }
});


// ===================================================
//  Deletar Instituição (apenas se vazia)
// ===================================================
app.delete('/api/institutions/:id', async (req: Request, res: Response) => {
  let connection;
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        ok: false, 
        error: "ID da instituição é obrigatório." 
      });
    }

    connection = await getConnection();

    // Verifica se a instituição existe
    const institutionCheck = await connection.execute(
      "SELECT COUNT(*) AS institution_count FROM instituicao WHERE id_instituicao = :id_instituicao",
      [id]
    );
    
    const institutionCount = (institutionCheck.rows?.[0] as any).INSTITUTION_COUNT;
    if (institutionCount === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: "Instituição não encontrada." 
      });
    }

    // ✅ VALIDAÇÃO: Verifica se tem cursos vinculados
    const coursesCheck = await connection.execute(
      "SELECT COUNT(*) AS course_count FROM curso WHERE id_instituicao = :id_instituicao",
      [id]
    );
    
    const courseCount = (coursesCheck.rows?.[0] as any).COURSE_COUNT;
    if (courseCount > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: `Não é possível excluir esta instituição. Ela possui ${courseCount} curso(s) vinculado(s). Remova todos os cursos primeiro.` 
      });
    }

    // Deleta a instituição
    await connection.execute(
      "DELETE FROM instituicao WHERE id_instituicao = :id_instituicao",
      [id]
    );

    await connection.commit();

    console.log(`✅ Instituição ID ${id} deletada com sucesso`);
    res.json({ ok: true, message: "Instituição deletada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao deletar instituição:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao deletar instituição." });
  } finally {
    if (connection) await connection.close();
  }
});

// ===================================================
//  Deletar Curso (apenas se vazio)
// ===================================================
app.delete('/api/courses/:id', async (req: Request, res: Response) => {
  let connection;
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ ok: false, error: "ID do curso é obrigatório." });
    }

    connection = await getConnection();

    // Verifica se o curso existe
    const courseCheck = await connection.execute(
      "SELECT COUNT(*) AS course_count FROM curso WHERE id_curso = :id_curso",
      [id]
    );
    
    const courseCount = (courseCheck.rows?.[0] as any).COURSE_COUNT;
    if (courseCount === 0) {
      return res.status(404).json({ ok: false, error: "Curso não encontrado." });
    }

    // ✅ VALIDAÇÃO: Verifica se tem disciplinas vinculadas
    const subjectsCheck = await connection.execute(
      `SELECT COUNT(*) AS subject_count 
       FROM disciplina d
       INNER JOIN rel r ON d.id_disciplina = r.id_disciplina
       WHERE r.id_curso = :id_curso`,
      [id]
    );
    
    const subjectCount = (subjectsCheck.rows?.[0] as any).SUBJECT_COUNT;
    if (subjectCount > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: `Não é possível excluir este curso. Ele possui ${subjectCount} disciplina(s) vinculada(s). Remova todas as disciplinas primeiro.` 
      });
    }

    // Deleta o curso
    await connection.execute(
      "DELETE FROM curso WHERE id_curso = :id_curso",
      [id]
    );

    await connection.commit();

    res.json({ ok: true, message: "Curso deletado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao deletar curso:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao deletar curso." });
  } finally {
    if (connection) await connection.close();
  }
});

// ===================================================
//  Deletar Disciplina (apenas se vazia)
// ===================================================
app.delete('/api/subjects/:id', async (req: Request, res: Response) => {
  let connection;
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ ok: false, error: "ID da disciplina é obrigatório." });
    }

    connection = await getConnection();

    // Verifica se a disciplina existe
    const subjectCheck = await connection.execute(
      "SELECT COUNT(*) AS subject_count FROM disciplina WHERE id_disciplina = :id_disciplina",
      [id]
    );
    
    const subjectCount = (subjectCheck.rows?.[0] as any).SUBJECT_COUNT;
    if (subjectCount === 0) {
      return res.status(404).json({ ok: false, error: "Disciplina não encontrada." });
    }

    // ✅ VALIDAÇÃO: Verifica se tem turmas vinculadas
    const classesCheck = await connection.execute(
      "SELECT COUNT(*) AS class_count FROM turma WHERE id_disciplina = :id_disciplina",
      [id]
    );
    
    const classCount = (classesCheck.rows?.[0] as any).CLASS_COUNT;
    if (classCount > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: `Não é possível excluir esta disciplina. Ela possui ${classCount} turma(s) vinculada(s). Remova todas as turmas primeiro.` 
      });
    }

    // Deleta os relacionamentos na tabela REL primeiro
    await connection.execute(
      "DELETE FROM rel WHERE id_disciplina = :id_disciplina",
      [id]
    );

    // Deleta a disciplina
    await connection.execute(
      "DELETE FROM disciplina WHERE id_disciplina = :id_disciplina",
      [id]
    );

    await connection.commit();

    res.json({ ok: true, message: "Disciplina deletada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao deletar disciplina:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao deletar disciplina." });
  } finally {
    if (connection) await connection.close();
  }
});

// ===================================================
//  Deletar Turma (apenas se vazia)
// ===================================================
app.delete('/api/classes/:id', async (req: Request, res: Response) => {
  let connection;
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ ok: false, error: "ID da turma é obrigatório." });
    }

    connection = await getConnection();

    // Verifica se a turma existe
    const classCheck = await connection.execute(
      "SELECT COUNT(*) AS class_count FROM turma WHERE id_turma = :id_turma",
      [id]
    );
    
    const classCount = (classCheck.rows?.[0] as any).CLASS_COUNT;
    if (classCount === 0) {
      return res.status(404).json({ ok: false, error: "Turma não encontrada." });
    }

    // ✅ VALIDAÇÃO: Verifica se tem estudantes vinculados
    const studentsCheck = await connection.execute(
      "SELECT COUNT(*) AS student_count FROM estudante WHERE id_turma = :id_turma",
      [id]
    );
    
    const studentCount = (studentsCheck.rows?.[0] as any).STUDENT_COUNT;
    if (studentCount > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: `Não é possível excluir esta turma. Ela possui ${studentCount} estudante(s) matriculado(s). Remova todos os estudantes primeiro.` 
      });
    }

    // Deleta a turma
    await connection.execute(
      "DELETE FROM turma WHERE id_turma = :id_turma",
      [id]
    );

    await connection.commit();

    console.log(`✅ Turma ID ${id} deletada com sucesso`);
    res.json({ ok: true, message: "Turma deletada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao deletar turma:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao deletar turma." });
  } finally {
    if (connection) await connection.close();
  }
});

startServer();
