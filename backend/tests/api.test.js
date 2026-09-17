/**
 * Teste de integração contra um Postgres de verdade (embutido).
 * Cobre o caminho feliz e, principalmente, as tentativas de burlar a autorização.
 *
 *   npm test
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

const EmbeddedPostgres = require("embedded-postgres").default || require("embedded-postgres");
const sharp = require("sharp");

const SENHA_ADMIN = "senha-de-teste-123";
const EMAIL_ADMIN = "teste@docesabor.com.br";

let pg, servidor, base, token;

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doce-pg-"));
  pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "teste",
    port: 54329,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("docesabor_teste");

  process.env.DATABASE_URL = "postgres://postgres:teste@localhost:54329/docesabor_teste";
  process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres-ok";
  process.env.ADMIN_EMAIL = EMAIL_ADMIN;
  process.env.ADMIN_SENHA = SENHA_ADMIN;
  process.env.ORIGENS_PERMITIDAS = "http://localhost:8000";

  const { app } = require("../server");
  const { migrar } = require("../db");
  await migrar();

  // recria o admin do zero (semearAdmin só roda no iniciar())
  const { consultar } = require("../db");
  const { gerarHash } = require("../auth");
  await consultar(
    `INSERT INTO administradores (email, senha_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
    [EMAIL_ADMIN, await gerarHash(SENHA_ADMIN)]
  );

  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = "http://127.0.0.1:" + servidor.address().port;
}, { timeout: 120_000 });

after(async () => {
  if (servidor) servidor.close();
  const { encerrar } = require("../db");
  await encerrar();
  if (pg) await pg.stop();
});

const json = (caminho, opcoes) => fetch(base + caminho, opcoes);

async function fotoDeTeste() {
  return sharp({ create: { width: 40, height: 40, channels: 3, background: "#C9A227" } })
    .png()
    .toBuffer();
}

/* ------------------------------------------------------------- login */

test("login com senha errada é recusado", async () => {
  const r = await json("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_ADMIN, senha: "errada" }),
  });
  assert.equal(r.status, 401);
});

test("login com e-mail inexistente devolve a mesma mensagem", async () => {
  const r = await json("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ninguem@lugar.com", senha: "errada" }),
  });
  const corpo = await r.json();
  assert.equal(r.status, 401);
  // não pode revelar que o e-mail não existe
  assert.match(corpo.erro, /E-mail ou senha incorretos/);
});

test("login correto devolve token", async () => {
  const r = await json("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_ADMIN, senha: SENHA_ADMIN }),
  });
  const corpo = await r.json();
  assert.equal(r.status, 200);
  assert.ok(corpo.token);
  token = corpo.token;
});

test("a senha nunca é gravada em texto", async () => {
  const { consultar } = require("../db");
  const { rows } = await consultar("SELECT senha_hash FROM administradores WHERE email = $1", [EMAIL_ADMIN]);
  assert.ok(rows[0].senha_hash.startsWith("$2"), "deveria ser um hash bcrypt");
  assert.ok(!rows[0].senha_hash.includes(SENHA_ADMIN));
});

test("e-mail inexistente demora o mesmo que e-mail real (sem oráculo de tempo)", async () => {
  const medir = async (email) => {
    const t = Date.now();
    await json("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha: "senha-qualquer-errada" }),
    });
    return Date.now() - t;
  };

  const existente = await medir(EMAIL_ADMIN);
  const inexistente = await medir("naoexiste@lugar.nenhum");

  // Se o hash de fachada tivesse tamanho inválido, o bcrypt devolveria na hora
  // e o e-mail inexistente responderia perto de 0 ms.
  assert.ok(
    inexistente > existente / 3,
    `e-mail inexistente respondeu em ${inexistente}ms contra ${existente}ms do real`
  );
});

test("trocar ADMIN_SENHA redefine a senha na subida (recuperação de acesso)", async () => {
  const { semearAdmin } = require("../server");
  const NOVA = "senha-trocada-no-painel-do-render";

  process.env.ADMIN_SENHA = NOVA;
  await semearAdmin();

  const antiga = await json("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_ADMIN, senha: SENHA_ADMIN }),
  });
  assert.equal(antiga.status, 401, "a senha antiga deve parar de funcionar");

  const nova = await json("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_ADMIN, senha: NOVA }),
  });
  assert.equal(nova.status, 200, "a senha nova deve entrar");

  // devolve o estado para os testes seguintes
  process.env.ADMIN_SENHA = SENHA_ADMIN;
  await semearAdmin();
  token = (await (await json("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_ADMIN, senha: SENHA_ADMIN }),
  })).json()).token;
});

/* ----------------------------------------------------- autorização */

test("criar produto sem token é barrado", async () => {
  const dados = new FormData();
  dados.append("nome", "Invasor");
  dados.append("preco", "10");
  const r = await json("/api/produtos", { method: "POST", body: dados });
  assert.equal(r.status, 401);
});

test("token adulterado é recusado", async () => {
  const r = await json("/api/produtos", {
    method: "POST",
    headers: { Authorization: "Bearer " + token.slice(0, -3) + "aaa" },
    body: new FormData(),
  });
  assert.equal(r.status, 401);
});

test("excluir sem token é barrado", async () => {
  const r = await json("/api/produtos/1", { method: "DELETE" });
  assert.equal(r.status, 401);
});

/* ---------------------------------------------------------- produtos */

let idCriado;

test("cria produto com imagem", async () => {
  const dados = new FormData();
  dados.append("nome", "Ninho com Nutella");
  dados.append("descricao", "Camadas de creme de ninho");
  dados.append("preco", "19,90");
  dados.append("estoque", "7");
  dados.append("imagem", new Blob([await fotoDeTeste()], { type: "image/png" }), "foto.png");

  const r = await json("/api/produtos", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: dados,
  });
  const corpo = await r.json();
  assert.equal(r.status, 201);
  assert.equal(corpo.nome, "Ninho com Nutella");
  assert.equal(corpo.preco, 19.9, "preço com vírgula deve ser aceito");
  assert.equal(corpo.estoque, 7);
  assert.ok(corpo.imagem);
  idCriado = corpo.id;
});

test("a imagem enviada é servida como JPEG normalizado", async () => {
  const r = await fetch(base + "/api/produtos/" + idCriado + "/imagem");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/jpeg");
  const meta = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
  assert.equal(meta.width, 600, "deve ter sido redimensionada");
});

test("arquivo que não é imagem é recusado", async () => {
  const dados = new FormData();
  dados.append("nome", "Fake");
  dados.append("preco", "10");
  // extensão e Content-Type mentem: o conteúdo é um script
  dados.append("imagem", new Blob(["<?php system($_GET[0]); ?>"], { type: "image/jpeg" }), "x.jpg");

  const r = await json("/api/produtos", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: dados,
  });
  assert.equal(r.status, 400);
});

test("preço negativo é recusado", async () => {
  const dados = new FormData();
  dados.append("nome", "Negativo");
  dados.append("preco", "-5");
  const r = await json("/api/produtos", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: dados,
  });
  assert.equal(r.status, 400);
});

test("estoque fracionado é recusado", async () => {
  const dados = new FormData();
  dados.append("nome", "Fracionado");
  dados.append("preco", "10");
  dados.append("estoque", "2.5");
  const r = await json("/api/produtos", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: dados,
  });
  assert.equal(r.status, 400);
});

test("nome com aspas e ponto-e-vírgula não quebra a query", async () => {
  const nome = `Pote'; DROP TABLE produtos; --`;
  const dados = new FormData();
  dados.append("nome", nome);
  dados.append("preco", "12");
  const r = await json("/api/produtos", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: dados,
  });
  assert.equal(r.status, 201);

  const lista = await (await fetch(base + "/api/produtos")).json();
  assert.ok(lista.some((p) => p.nome === nome), "a tabela continua de pé e o nome foi salvo literal");
});

test("atualiza preço e estoque", async () => {
  const dados = new FormData();
  dados.append("preco", "21.50");
  dados.append("estoque", "3");
  const r = await json("/api/produtos/" + idCriado, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token },
    body: dados,
  });
  const corpo = await r.json();
  assert.equal(r.status, 200);
  assert.equal(corpo.preco, 21.5);
  assert.equal(corpo.estoque, 3);
  assert.equal(corpo.nome, "Ninho com Nutella", "o nome não deve ter sido apagado");
});

test("a lista pública não expõe os bytes da imagem", async () => {
  const lista = await (await fetch(base + "/api/produtos")).json();
  const p = lista.find((x) => x.id === idCriado);
  assert.equal(typeof p.imagem, "string");
  assert.ok(p.imagem.startsWith("/api/produtos/"));
});

test("atualizar produto inexistente devolve 404", async () => {
  const dados = new FormData();
  dados.append("preco", "10");
  const r = await json("/api/produtos/999999", {
    method: "PUT",
    headers: { Authorization: "Bearer " + token },
    body: dados,
  });
  assert.equal(r.status, 404);
});

test("exclui produto", async () => {
  const r = await json("/api/produtos/" + idCriado, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(r.status, 204);

  const lista = await (await fetch(base + "/api/produtos")).json();
  assert.ok(!lista.some((p) => p.id === idCriado));
});

test("erro interno não vaza detalhe de infraestrutura", async () => {
  const r = await fetch(base + "/api/produtos/nao-e-numero/imagem");
  const corpo = await r.json();
  assert.equal(r.status, 400);
  assert.ok(!JSON.stringify(corpo).match(/postgres|pg|stack|at Object/i));
});
