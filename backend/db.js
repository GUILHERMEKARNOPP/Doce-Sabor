const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida — veja backend/.env.example");
}

// O Postgres local de desenvolvimento não tem certificado; em produção há TLS.
const ehLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

/**
 * Em produção o certificado é validado de verdade. Aceitar qualquer certificado
 * ("rejectUnauthorized: false", comum em tutoriais) criptografa sem autenticar:
 * quem conseguisse se pôr no caminho leria a senha do banco e o hash do admin,
 * e poderia forjar a resposta do login.
 * Se o provedor usar uma CA própria, coloque o certificado em DATABASE_CA_CERT.
 */
const tls = ehLocal
  ? false
  : { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT || undefined };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: tls,
  max: 5,
  idleTimeoutMillis: 30_000,
});

/** Executa uma query parametrizada. Nunca monte SQL concatenando valor. */
function consultar(sql, valores = []) {
  return pool.query(sql, valores);
}

/** Cria as tabelas se ainda não existirem. Idempotente. */
async function migrar() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
}

async function encerrar() {
  await pool.end();
}

module.exports = { consultar, migrar, encerrar, pool };
