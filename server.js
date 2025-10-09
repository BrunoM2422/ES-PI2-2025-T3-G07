import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import oracledb from 'oracledb';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Configuração do Oracle
const dbConfig = {
  user: 'BANCO_DE_DADOS_1',                           // Substitua pelo seu usuário do Oracle
  password: '1234',                                // Substitua pela sua senha do Oracle
  connectString: 'localhost:1521/XEPDB1'
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/htmls', express.static(path.join(__dirname, 'public/htmls')));
app.use('/styles', express.static(path.join(__dirname, 'public/styles')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/scripts', express.static(path.join(__dirname, 'public/scripts')));

// Função para obter conexão
async function getConnection() {
  try {
    return await oracledb.getConnection(dbConfig);
  } catch (error) {
    console.error('Erro ao conectar com Oracle:', error);
    throw error;
  }
}

// Criar tabelas se não existirem
async function initializeDatabase() {
  let connection;
  try {
    connection = await getConnection();
    
    // Criar tabela de usuários - TAMANHOS OTIMIZADOS
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE usuario (
          id_usuario NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          email VARCHAR2(100) NOT NULL UNIQUE,
          senha VARCHAR2(60) NOT NULL,  
          nome VARCHAR2(100) NOT NULL,
          telefone VARCHAR2(15) NOT NULL
        )';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;
    `);

    // Criar tabela de instituições - TAMANHOS OTIMIZADOS
    await connection.execute(`
      BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE instituicao (
          id_instituicao NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          nome VARCHAR2(100) NOT NULL,
          fk_usuario_id_usuario NUMBER NOT NULL,
          CONSTRAINT fk_usuario FOREIGN KEY (fk_usuario_id_usuario) 
          REFERENCES usuario(id_usuario) ON DELETE CASCADE
        )';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;
    `);

    console.log('✅ Tabelas verificadas/criadas com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Erro ao fechar conexão:', error);
      }
    }
  }
}

// Rota de cadastro (create-account)
app.post('/api/create-account', async (req, res) => {
  let connection;
  try {
    const { name, surname, email, telephone, password } = req.body;

    console.log('📥 Dados recebidos:', { name, surname, email, telephone });

    // Validações OTIMIZADAS com os novos limites
    if (!name || !surname || !email || !telephone || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Todos os campos são obrigatórios' 
      });
    }

    if (name.length < 2 || name.length > 50) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Nome deve ter entre 2 e 50 caracteres' 
      });
    }

    if (surname.length < 2 || surname.length > 50) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Sobrenome deve ter entre 2 e 50 caracteres' 
      });
    }

    if (email.length > 100) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email muito longo (máximo 100 caracteres)' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Por favor, insira um email válido' 
      });
    }

    const cleanPhone = telephone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Telefone deve ter 10 ou 11 dígitos' 
      });
    }

    if (telephone.length > 15) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Telefone muito longo' 
      });
    }

    if (password.length < 6 || password.length > 50) {
      return res.status(400).json({ 
        ok: false, 
        error: 'A senha deve ter entre 6 e 50 caracteres' 
      });
    }

    connection = await getConnection();

    // Verificar se email já existe
    const checkResult = await connection.execute(
      'SELECT COUNT(*) as count FROM usuario WHERE email = :email',
      [email]
    );

    if (checkResult.rows[0][0] > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email já está registrado' 
      });
    }

    // Inserir usuário
    const nomeCompleto = `${name} ${surname}`;
    
    // Validação adicional do nome completo
    if (nomeCompleto.length > 100) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Nome completo muito longo (máximo 100 caracteres)' 
      });
    }

    const result = await connection.execute(
      `INSERT INTO usuario (email, senha, nome, telefone) 
       VALUES (:email, :senha, :nome, :telefone) 
       RETURNING id_usuario INTO :id`,
      {
        email: email,
        senha: password,
        nome: nomeCompleto,
        telefone: telephone,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    const userId = result.outBinds.id[0];

    console.log('✅ Usuário criado com ID:', userId);
    
    res.status(201).json({ 
      ok: true, 
      message: 'Conta criada com sucesso!',
      userId: userId
    });

  } catch (error) {
    console.error('❌ Erro ao criar conta:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Erro interno ao criar a conta' 
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Erro ao fechar conexão:', error);
      }
    }
  }
});

// Rota de login
app.post('/api/login', async (req, res) => {
  let connection;
  try {
    const { email, password } = req.body;

    console.log('📥 Tentativa de login:', email);

    // Validações básicas
    if (!email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email e senha são obrigatórios' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Por favor, insira um email válido' 
      });
    }

    connection = await getConnection();

    // Buscar usuário
    const result = await connection.execute(
      'SELECT * FROM usuario WHERE email = :email',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Usuário não encontrado' 
      });
    }

    const usuario = result.rows[0];
    const usuarioObj = {
      id_usuario: usuario[0],
      email: usuario[1],
      senha: usuario[2],
      nome: usuario[3],
      telefone: usuario[4]
    };

    // Verificar senha
    if (usuarioObj.senha !== password) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Senha incorreta' 
      });
    }

    console.log('✅ Login realizado:', email);
    
    res.json({ 
      ok: true, 
      message: 'Login realizado com sucesso',
      user: {
        id: usuarioObj.id_usuario,
        email: usuarioObj.email,
        nome: usuarioObj.nome
      }
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Erro interno do servidor' 
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Erro ao fechar conexão:', error);
      }
    }
  }
});

// Rota de recuperação de senha
app.post('/api/recover-password', async (req, res) => {
  let connection;
  try {
    const { email, token, newPassword } = req.body;

    console.log('📥 Recuperação de senha para:', email);

    if (!email) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email é obrigatório' 
      });
    }

    connection = await getConnection();

    // Verificar se usuário existe
    const result = await connection.execute(
      'SELECT * FROM usuario WHERE email = :email',
      [email]
    );

    if (result.rows.length === 0) {
      // Por segurança, não revelamos se o email existe ou não
      return res.json({ 
        ok: true, 
        message: 'Instruções de recuperação enviadas para seu email' 
      });
    }

    const usuario = result.rows[0];

    if (newPassword) {
      // Validar nova senha com limites
      if (newPassword.length < 6 || newPassword.length > 50) {
        return res.status(400).json({ 
          ok: false, 
          error: 'A senha deve ter entre 6 e 50 caracteres' 
        });
      }

      // Atualizar senha
      await connection.execute(
        'UPDATE usuario SET senha = :senha WHERE email = :email',
        [newPassword, email],
        { autoCommit: true }
      );

      console.log('✅ Senha atualizada para:', email);
      
      return res.json({ 
        ok: true, 
        message: 'Senha alterada com sucesso!' 
      });
    }

    // Se chegou aqui, é apenas solicitação de recuperação
    console.log('📧 Simulando envio de email para:', email);
    
    res.json({ 
      ok: true, 
      message: 'Instruções de recuperação enviadas para seu email' 
    });

  } catch (error) {
    console.error('❌ Erro na recuperação de senha:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Erro interno do servidor' 
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Erro ao fechar conexão:', error);
      }
    }
  }
});

// Rota para listar usuários (apenas para teste)
app.get('/api/usuarios', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    
    const result = await connection.execute('SELECT * FROM usuario');
    
    const usuarios = result.rows.map(row => ({
      id_usuario: row[0],
      email: row[1],
      senha: '***', // Não retornar a senha real
      nome: row[3],
      telefone: row[4]
    }));

    res.json(usuarios);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Erro ao fechar conexão:', error);
      }
    }
  }
});

// Rota para criar instituição
app.post('/api/instituicao', async (req, res) => {
  let connection;
  try {
    const { nome, usuarioId } = req.body;

    if (!nome || !usuarioId) {
      return res.status(400).json({ error: 'Nome e usuarioId são obrigatórios' });
    }

    // Validação do tamanho do nome
    if (nome.length > 100) {
      return res.status(400).json({ error: 'Nome da instituição muito longo (máximo 100 caracteres)' });
    }

    connection = await getConnection();

    const result = await connection.execute(
      `INSERT INTO instituicao (nome, fk_usuario_id_usuario) 
       VALUES (:nome, :usuarioId) 
       RETURNING id_instituicao INTO :id`,
      {
        nome: nome,
        usuarioId: usuarioId,
        id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      },
      { autoCommit: true }
    );

    const instituicaoId = result.outBinds.id[0];

    res.status(201).json({ 
      message: 'Instituição criada com sucesso',
      instituicaoId: instituicaoId
    });
  } catch (error) {
    console.error('Erro ao criar instituição:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Erro ao fechar conexão:', error);
      }
    }
  }
});

// Rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'htmls', 'index.html'));
});

// Rota para outras páginas 
app.get('/:page', (req, res) => {
  const page = req.params.page;
  const pagePath = path.join(__dirname, 'public', 'htmls', `${page}.html`);
  
  if (fs.existsSync(pagePath)) {
    res.sendFile(pagePath);
  } else {
    res.status(404).send('Página não encontrada');
  }
});

// Rota para arquivos específicos
app.get('/htmls/:file', (req, res) => {
  const file = req.params.file;
  const filePath = path.join(__dirname, 'public', 'htmls', file);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Arquivo não encontrado');
  }
});

// Inicializar servidor
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor Express + OracleDB rodando em http://localhost:${PORT}`);
      console.log(`📊 Banco de dados: Oracle (tabelas otimizadas)`);
      console.log(`📁 Arquivos estáticos: public/`);
      console.log(`🔧 Modo: ES Modules`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();