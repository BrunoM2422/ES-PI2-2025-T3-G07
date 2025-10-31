// src/config/db.ts
import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const dbConfig = {
  user: 'BANCO_DE_DADOS_1',                    // Substitua pelo seu usuário do Oracle
  password: '1234',                              // Substitua pela sua senha do Oracle
  connectString:'localhost:1521/XEPDB1', 
  
};

export async function initOraclePool() {
  try {
    await oracledb.createPool(dbConfig);
    console.log("✅ Conexão com Oracle inicializada com sucesso.");
  } catch (err) {
    console.error("❌ Erro ao criar pool Oracle:", err);
    process.exit(1);
  }
}

export async function closeOraclePool() {
  try {
    await oracledb.getPool().close(10);
    console.log("🛑 Pool Oracle fechado.");
  } catch (err) {
    console.error("Erro ao fechar pool Oracle:", err);
  }
}

export async function getConnection() {
  try {
    return await oracledb.getConnection();
  } catch (err) {
    console.error("Erro ao obter conexão Oracle:", err);
    throw err;
  }
}
