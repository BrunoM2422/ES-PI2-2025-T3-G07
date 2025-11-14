// src/config/db.ts
/*
  Autores:
    Gabriel Scolfaro de Azeredo
 */
import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const dbConfig = {
  user: 'SYSTEM',                    // Substitua pelo seu usuário do Oracle
  password: 'Pedro@05',                              // Substitua pela sua senha do Oracle
  connectString:'localhost:1521/XE', 
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
