const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida — veja backend/.env.example");
}

/**
 * Quando validar o certificado do banco.
 *
 * Hostname público (tem ponto: Neon, Supabase, o endereço externo do Render) →
 * o tráfego atravessa a internet, então o certificado é validado de verdade.
 * Aceitar qualquer certificado, como se vê em muito tutorial, criptografa sem
 * autenticar: quem se pusesse no caminho leria a senha do banco e o hash do
 * admin, e poderia forjar a resposta do login.
 *
 * Hostname sem ponto (localhost, ou o DNS interno do Render, tipo "dpg-xxxx-a") →
 * a conexão não sai da rede privada, que é o próprio limite de confiança. Esse
 * endereço não tem certificado de CA pública, e exigir um só impediria a conexão.
 *
 * Se o provedor usar CA própria num endereço público, informe DATABASE_CA_CERT.
 */
const hospedeiro = new URL(process.env.DATABASE_URL).hostname.replace(/^\[|\]$/g, "");
const ehLoopback = hospedeiro === "localhost" || hospedeiro === "::1" || hospedeiro.startsWith("127.");
const ehRedeInterna = ehLoopback || !hospedeiro.includes(".");

const tls = ehRedeInterna
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
