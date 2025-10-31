import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import oracledb from "oracledb";
import { getConnection, initOraclePool } from "./config/db.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// ===================================================
//  Criação de tabelas
// ===================================================
async function initializeDatabase() {
  let connection;
  try {
    connection = await getConnection();

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
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN RAISE; END IF;
      END;
    `);

    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE instituicao (
            id_instituicao NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            nome VARCHAR2(100) NOT NULL,
            fk_usuario_id_usuario NUMBER NOT NULL,
            CONSTRAINT fk_usuario FOREIGN KEY (fk_usuario_id_usuario)
            REFERENCES usuario(id_usuario) ON DELETE CASCADE
          )';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN RAISE; END IF;
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

    if (!name || !surname || !email || !telephone || !password) {
      return res.status(400).json({ ok: false, error: "Todos os campos são obrigatórios." });
    }

    const nomeCompleto = `${name.trim()} ${surname.trim()}`;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: "Email inválido." });
    }

    connection = await getConnection();

    const check = await connection.execute("SELECT COUNT(*) FROM usuario WHERE email = :email", [email]);
    const count = (check.rows?.[0] as number[])[0];

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

    // Correção: informar tipo explícito
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

    const rows = result.rows as (string | number)[][];
    if (!rows || rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Usuário não encontrado." });
    }

    const [id_usuario, userEmail, senha, nome, telefone] = rows[0];
    if (senha !== password) {
      return res.status(401).json({ ok: false, error: "Senha incorreta." });
    }

    res.json({
      ok: true,
      message: "Login realizado com sucesso!",
      user: { id_usuario, email: userEmail, nome },
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

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Falha ao iniciar servidor:", err);
    process.exit(1);
  }
}

startServer();
