import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import oracledb from "oracledb";
import { getConnection, initOraclePool } from "./config/db.js";

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
            email VARCHAR2(100) NOT NULL UNIQUE,
            senha VARCHAR2(60) NOT NULL,
            nome VARCHAR2(100) NOT NULL,
            telefone VARCHAR2(15) NOT NULL
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 2. INSTITUICAO
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE instituicao (
            id_instituicao NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 3. DISCIPLINA — vinculada à instituição
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE disciplina (
            id_disciplina NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome_curso VARCHAR2(100) NOT NULL,
            sigla VARCHAR2(20),
            periodo_curso VARCHAR2(50),
            fk_instituicao_id_instituicao NUMBER,
            CONSTRAINT fk_disciplina_instituicao FOREIGN KEY (fk_instituicao_id_instituicao) REFERENCES instituicao(id_instituicao) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 4. TRABALHA_EM (relaciona usuario ↔ instituicao)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE trabalha_em (
            fk_usuario_id_usuario NUMBER NOT NULL,
            fk_instituicao_id_instituicao NUMBER NOT NULL,
            CONSTRAINT pk_trabalha_em PRIMARY KEY (fk_usuario_id_usuario, fk_instituicao_id_instituicao),
            CONSTRAINT fk_trab_usuario FOREIGN KEY (fk_usuario_id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
            CONSTRAINT fk_trab_instituicao FOREIGN KEY (fk_instituicao_id_instituicao) REFERENCES instituicao(id_instituicao) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 5. TURMA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE turma (
            id_turma NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            apelido VARCHAR2(50),
            horario VARCHAR2(50),
            local VARCHAR2(50),
            dia VARCHAR2(20)
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 6. RELACIONAMENTO DISCIPLINA ↔ TURMA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE disciplina_turma (
            fk_disciplina_id_disciplina NUMBER NOT NULL,
            fk_turma_id_turma NUMBER NOT NULL,
            CONSTRAINT pk_disciplina_turma PRIMARY KEY (fk_disciplina_id_disciplina, fk_turma_id_turma),
            CONSTRAINT fk_disc_tur_disc FOREIGN KEY (fk_disciplina_id_disciplina) REFERENCES disciplina(id_disciplina) ON DELETE CASCADE,
            CONSTRAINT fk_disc_tur_turma FOREIGN KEY (fk_turma_id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 7. ESTUDANTE
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE estudante (
            id_estudante NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            ra VARCHAR2(20) NOT NULL UNIQUE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 8. FAZ_PARTE (aluno ↔ turma)
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE faz_parte (
            fk_aluno_id_estudante NUMBER NOT NULL,
            fk_turma_id_turma NUMBER NOT NULL,
            CONSTRAINT pk_faz_parte PRIMARY KEY (fk_aluno_id_estudante, fk_turma_id_turma),
            CONSTRAINT fk_faz_aluno FOREIGN KEY (fk_aluno_id_estudante) REFERENCES estudante(id_estudante) ON DELETE CASCADE,
            CONSTRAINT fk_faz_turma FOREIGN KEY (fk_turma_id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 9. COMPONENTE_NOTA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE componente_nota (
            id_componente_nota NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            sigla VARCHAR2(20),
            descricao VARCHAR2(200),
            pesos NUMBER(5,2)
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
            data DATE NOT NULL,
            hora VARCHAR2(10),
            fk_turma_id_turma NUMBER,
            CONSTRAINT fk_auditoria_turma FOREIGN KEY (fk_turma_id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);


    // ==========================================
    // 11. MEDIA — aparece ao adicionar aluno e RA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE media (
            id_media NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            fk_estudante_id_estudante NUMBER NOT NULL,
            fk_turma_id_turma NUMBER NOT NULL,
            media_final NUMBER(5,2),
            tipo_media VARCHAR2(20) DEFAULT ''Aritmética'',
            CONSTRAINT fk_media_estud FOREIGN KEY (fk_estudante_id_estudante) REFERENCES estudante(id_estudante) ON DELETE CASCADE,
            CONSTRAINT fk_media_turma FOREIGN KEY (fk_turma_id_turma) REFERENCES turma(id_turma) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    // ==========================================
    // 12. NOTAS - RELAÇÃO MEDIA ↔ COMPONENTE_NOTA
    // ==========================================
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE notas (
            fk_media_id_media NUMBER NOT NULL,
            fk_componente_id_componente NUMBER NOT NULL,
            nota NUMBER(5,2) CHECK (nota BETWEEN 0 AND 10),
            CONSTRAINT pk_notas PRIMARY KEY (fk_media_id_media, fk_componente_id_componente),
            CONSTRAINT fk_notas_media FOREIGN KEY (fk_media_id_media) REFERENCES media(id_media) ON DELETE CASCADE,
            CONSTRAINT fk_notas_componente FOREIGN KEY (fk_componente_id_componente) REFERENCES componente_nota(id_componente_nota) ON DELETE CASCADE
          )';
      EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);


    console.log("✅ Tabelas verificadas/criadas com sucesso.");
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

    const nomeCompleto = `${name.trim()} ${surname.trim()}`;
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
      `INSERT INTO usuario (email, senha, nome, telefone)
       VALUES (:email, :senha, :nome, :telefone)
       RETURNING id_usuario INTO :id`,
      {
        email,
        senha: password,
        nome: nomeCompleto,
        telefone: telephone,
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

startServer();
