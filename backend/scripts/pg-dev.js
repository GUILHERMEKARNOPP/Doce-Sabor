/**
 * Sobe um Postgres local para desenvolvimento, sem precisar instalar nada.
 * O binário vem do pacote embedded-postgres (dependência de desenvolvimento).
 *
 *   npm run db:dev        (deixe rodando numa aba do terminal)
 *
 * Os dados ficam em %TEMP%/doce-pg-dev e sobrevivem entre execuções.
 * Para começar do zero, apague essa pasta.
 */
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

const EmbeddedPostgres = require("embedded-postgres").default || require("embedded-postgres");

const PASTA = path.join(os.tmpdir(), "doce-pg-dev");
const PORTA = 54330;

(async () => {
  const primeiraVez = !fs.existsSync(PASTA);

  const pg = new EmbeddedPostgres({
    databaseDir: PASTA,
    user: "postgres",
    password: "teste",
    port: PORTA,
    persistent: true,
  });

  if (primeiraVez) {
    console.log("Preparando o banco pela primeira vez...");
    await pg.initialise();
  }

  await pg.start();
  try {
    await pg.createDatabase("docesabor_dev");
  } catch {
    /* já existe */
  }

  console.log(`Postgres de desenvolvimento pronto em localhost:${PORTA}`);
  console.log("Use no backend/.env:");
  console.log(`  DATABASE_URL=postgres://postgres:teste@localhost:${PORTA}/docesabor_dev`);
  console.log("\nCtrl+C para parar.");

  const parar = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", parar);
  process.on("SIGTERM", parar);
})().catch((erro) => {
  console.error("Não foi possível subir o Postgres local:", erro.message);
  process.exit(1);
});
