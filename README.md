# ES-PI2-2025-T3-G07
Repositório para a criação do Projeto Integrador 2 - NotaDez

<p align="center">
  <img src="public/images/notadezlogo1.png" alt="Logo NotaDez" width="400"/>
</p>

## Pré-requisitos

Antes de rodar o projeto, certifique-se de ter instalado:

- **Node.js** 
  [Baixar aqui](https://nodejs.org/)
- **Oracle Database** (ex: Oracle XE)
- **SQL Developer** (Para gerenciar o banco)

## Configuração do Banco de Dados

O projeto utiliza **OracleDB** através do módulo `oracledb`.

1. Acesse a pasta:
`src/config/db.ts`

2. Edite as credenciais conforme o seu ambiente Oracle:

```ts
export const dbConfig = {
  user: "SEU_USUARIO",           // exemplo: "system" ou "BANCO_DE_DADOS_1"
  password: "SUA_SENHA",         // senha definida no Oracle
  connectString: "localhost:1521/XEPDB1" // ajuste conforme seu Oracle
};
```

3. Teste a conexão com seu Oracle antes de iniciar o servidor.


## Como executar o projeto:

1. Clone o repositório

```bash
git clone https://github.com/BrunoM2422/ES-PI2-2025-T3-G07.git
```

Acesse a pasta ES-PI2-2025-T3-G07

```bash
cd ES-PI2-2025-T3-G07
```

2. Instale todas as dependências

```bash
npm install
npm install nodemailer 
npm install dotenv
```

3. Compile o TypeScript

```bash
npm run build
```

5. Inicie o servidor

```bash
npm run start
```

6. Acesse

```bash
http://localhost:3000
```