import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware para ler JSON do body das requisições
app.use(bodyParser.json());

// Permitir arquivos estáticos na pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Caminho do arquivo JSON que vai armazenar usuários
const usersFile = path.join(__dirname, 'data', 'users.json');

// Função para ler usuários
function readUsers() {
    if (!fs.existsSync(usersFile)) return [];
    return JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
}

// Função para salvar usuários
function writeUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Rota de cadastro
app.post('/api/register', (req, res) => {
    try {
      const { name, surname, email, telephone, password } = req.body;
  
      if (!name || !surname || !email || !telephone || !password) {
        console.log('❌ Campos ausentes:', req.body);
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
      }
  
      const users = readUsers();
  
      if (users.some(u => u.email === email)) {
        console.log('⚠️ Email já existente:', email);
        return res.status(400).json({ message: 'Email já cadastrado.' });
      }
  
      const newUser = { name, surname, email, telephone, password };
      users.push(newUser);
      writeUsers(users);
  
      console.log('✅ Novo usuário salvo:', newUser);
  
      res.status(200).json({ message: 'Usuário cadastrado com sucesso!', data: newUser });
    } catch (err) {
      console.error('💥 Erro no cadastro:', err);
      res.status(500).json({ message: 'Erro interno do servidor.' });
    }
  });
  

// Rota de login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();

    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ message: 'Email ou senha incorretos.' });
    }

    res.status(200).json({ message: 'Login realizado com sucesso!', data: user });
});

// Rota raiz (opcional)
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.send('Servidor rodando! Coloque um index.html na pasta public.');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
