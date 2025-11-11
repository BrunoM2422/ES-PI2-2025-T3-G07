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

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Caminhos absolutos da raiz do projeto e da pasta public
const ROOT_DIR = path.resolve(__dirname, ".."); // sobe da pasta dist/ para a raiz
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Public path
app.use(express.static(PUBLIC_DIR));
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
            senha VARCHAR2(100) NOT NULL
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
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
            periodo_curso NUMBER CHECK (periodo_curso BETWEEN 0 AND 10) NOT NULL,
            nome VARCHAR2(100) NOT NULL,
            id_instituicao NUMBER NOT NULL,
            CONSTRAINT fk_curso_instituicao FOREIGN KEY (id_instituicao) REFERENCES instituicao(id_instituicao) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 4. DISCIPLINA (SEM IDENTITY - ID MANUAL)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE disciplina (
            id_disciplina NUMBER NOT NULL PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
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
    // 6. TURMA (SEM IDENTITY - ID MANUAL)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE turma (
            id_turma NUMBER NOT NULL PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            horario TIMESTAMP NOT NULL,
            dia DATE NOT NULL,
            local VARCHAR2(100) NOT NULL,
            apelido VARCHAR2(50),
            id_disciplina NUMBER NOT NULL,
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
            id_estudante NUMBER NOT NULL PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            id_turma NUMBER NOT NULL,
            CONSTRAINT fk_estudante_turma FOREIGN KEY (id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 8. COMPONENTE_NOTA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE componente_nota (
            id_componente_nota NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            peso NUMBER(4,2) CHECK (peso BETWEEN 0 AND 10),
            nome VARCHAR2(100) NOT NULL,
            sigla VARCHAR2(20) NOT NULL,
            descricao VARCHAR2(255),
            nota NUMBER(4,2) CHECK (nota BETWEEN 0 AND 10)
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 9. AUDITORIA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE auditoria (
            id_auditoria NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            data DATE,
            hora TIMESTAMP,
            id_turma NUMBER,
            CONSTRAINT fk_auditoria_turma FOREIGN KEY (id_turma) REFERENCES turma(id_turma) ON DELETE SET NULL
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 10. MEDIA (RELACIONAMENTO ENTRE ESTUDANTE, COMPONENTE_NOTA E AUDITORIA)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE media (
            id_estudante NUMBER NOT NULL,
            id_componente_nota NUMBER NOT NULL,
            id_auditoria NUMBER NOT NULL,
            CONSTRAINT pk_media PRIMARY KEY (id_estudante, id_componente_nota, id_auditoria),
            CONSTRAINT fk_media_estudante FOREIGN KEY (id_estudante) REFERENCES estudante(id_estudante) ON DELETE CASCADE,
            CONSTRAINT fk_media_componente FOREIGN KEY (id_componente_nota) REFERENCES componente_nota(id_componente_nota) ON DELETE CASCADE,
            CONSTRAINT fk_media_auditoria FOREIGN KEY (id_auditoria) REFERENCES auditoria(id_auditoria) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    console.log("✅ Tabelas verificadas/criadas com sucesso.");

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
      },
      { autoCommit: true }
    );

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
      },
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
      },
      { autoCommit: true }
    );
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
    const institutions = result?.rows || [];

    res.json({ ok: true, institutions, count: institutions.length });
  } catch (err) {
    console.error("❌ Erro ao buscar instituições:", err);
    res.status(500).json({ ok: false, error: 'Erro ao buscar instituições' });
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
    if (period < 0 || period > 10) {
    return res.status(400).json({ ok: false, error: "Período deve estar entre 0 e 10." });
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
      },
      { autoCommit: true }
    );
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
    const courses = result.rows || [];
    
    
    res.json({ ok: true, courses, count: courses.length });
  } catch (err) {
    console.error("❌ Erro ao buscar cursos:", err);
    res.status(500).json({ ok: false, error: "Erro interno ao buscar cursos." });
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
    if (!email) return res.status(400).json({ ok: false, error: "Email é obrigatório." });

    connection = await getConnection();

    const result = await connection.execute("SELECT * FROM usuario WHERE email = :email", [email]);
    const user = result.rows?.[0] as any;
    if (!user) return res.status(404).json({ ok: false, error: "Usuário não encontrado." });

    const token = generateToken();
    const expireDate = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    const expireStr = formatTimestampForOracle(expireDate);

    // Atualiza o usuário com token e expiração
    await connection.execute(
      `UPDATE usuario
       SET token_recuperacao = :token,
           expira_em = TO_TIMESTAMP(:expira, 'YYYY-MM-DD HH24:MI:SS')
       WHERE email = :email`,
      { token, expira: expireStr, email },
      { autoCommit: true }
    );

    // Envia email com o token
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


    res.json({ ok: true, message: "Token enviado para o email (se existir)." });
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
      { senha: newPassword, email },
      { autoCommit: true }
    );

    res.json({ ok: true, message: "Senha redefinida com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao resetar senha:", err);
    res.status(500).json({ ok: false, error: "Erro no servidor." });
  } finally {
    if (connection) await connection.close();
  }
});

startServer();
