require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { migrar, consultar } = require("./db");
const { autenticar, gerarToken, gerarHash, HORAS_DE_SESSAO } = require("./auth");
const produtos = require("./routes/produtos");

const app = express();
app.set("trust proxy", 1); // o Render fica atrás de proxy; sem isso o rate limit vê um IP só

// A API é consumida por outro domínio (o site no GitHub Pages), então as imagens
// precisam poder ser lidas de fora. O padrão do helmet (same-origin) as bloquearia.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "16kb" }));

// CORS restrito: só o site da loja e o desenvolvimento local podem chamar a API.
// Nunca "*" — isso liberaria qualquer site a usar a sessão de quem estiver logado.
const ORIGENS = (process.env.ORIGENS_PERMITIDAS || "http://localhost:8000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origem, callback) {
      if (!origem || ORIGENS.includes(origem)) return callback(null, true);
      callback(new Error("Origem não permitida"));
    },
  })
);

const limiteDeLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Tente novamente em alguns minutos." },
});

app.get("/api/saude", (_req, res) => res.json({ ok: true }));

app.post("/api/login", limiteDeLogin, async (req, res, next) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ erro: "Informe e-mail e senha." });
    }

    const admin = await autenticar(email, senha);
    if (!admin) {
      return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    res.json({
      token: gerarToken(admin),
      email: admin.email,
      expiraEmHoras: HORAS_DE_SESSAO,
    });
  } catch (erro) {
    next(erro);
  }
});

app.use("/api/produtos", produtos);

app.use((_req, res) => res.status(404).json({ erro: "Rota não encontrada." }));

// O cliente recebe uma mensagem genérica; o detalhe fica só no log do servidor.
app.use((erro, _req, res, _next) => {
  if (erro && erro.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ erro: "A imagem deve ter no máximo 5 MB." });
  }
  if (erro && erro.message === "Origem não permitida") {
    return res.status(403).json({ erro: "Origem não permitida." });
  }
  console.error("[erro]", erro);
  res.status(500).json({ erro: "Não foi possível concluir a operação." });
});

/** Cria o primeiro administrador a partir das variáveis de ambiente, se ainda não existir. */
async function semearAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const senha = process.env.ADMIN_SENHA || "";
  if (!email || !senha) return;

  if (senha.length < 10) {
    console.warn("[aviso] ADMIN_SENHA tem menos de 10 caracteres — troque por uma senha forte.");
  }

  const { rows } = await consultar("SELECT 1 FROM administradores WHERE email = $1", [email]);
  if (rows.length) return;

  await consultar("INSERT INTO administradores (email, senha_hash) VALUES ($1, $2)", [
    email,
    await gerarHash(senha),
  ]);
  console.log("[setup] administrador criado:", email);
}

async function iniciar() {
  await migrar();
  await semearAdmin();
  const porta = process.env.PORT || 3000;
  app.listen(porta, () => console.log("API do Doce Sabor ouvindo na porta " + porta));
}

if (require.main === module) {
  iniciar().catch((erro) => {
    console.error("Falha ao iniciar:", erro);
    process.exit(1);
  });
}

module.exports = { app, iniciar };
