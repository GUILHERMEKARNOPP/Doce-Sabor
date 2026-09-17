const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { consultar } = require("./db");

/**
 * Hash descartável usado quando o e-mail não existe, para que a resposta demore
 * o mesmo tanto de um login real. Precisa ser um hash bcrypt válido de 60
 * caracteres: com qualquer outro tamanho o bcrypt devolve false na hora e o
 * tempo de resposta denuncia quais e-mails estão cadastrados.
 */
const HASH_DE_FACHADA = bcrypt.hashSync(require("node:crypto").randomBytes(16).toString("hex"), 12);

const SEGREDO = process.env.JWT_SECRET;
if (!SEGREDO || SEGREDO.length < 32) {
  throw new Error("JWT_SECRET ausente ou curto demais (use 32+ caracteres aleatórios)");
}

const HORAS_DE_SESSAO = 8;
const CUSTO_BCRYPT = 12;

function gerarHash(senha) {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

function gerarToken(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email }, SEGREDO, {
    expiresIn: HORAS_DE_SESSAO + "h",
  });
}

/**
 * Confere e-mail e senha.
 * Devolve sempre a mesma falha, sem dizer se o erro foi no e-mail ou na senha:
 * distinguir os dois entrega ao atacante quais contas existem.
 */
async function autenticar(email, senha) {
  const { rows } = await consultar(
    "SELECT id, email, senha_hash FROM administradores WHERE email = $1",
    [String(email).toLowerCase().trim()]
  );
  const admin = rows[0];

  // Mesmo sem usuário, gastamos o tempo do bcrypt: responder rápido revelaria
  // que o e-mail não existe (ataque de temporização).
  const hash = admin ? admin.senha_hash : HASH_DE_FACHADA;
  const confere = await bcrypt.compare(String(senha), hash);

  if (!admin || !confere) return null;
  return { id: admin.id, email: admin.email };
}

/** Middleware: barra a requisição se não houver um token válido de administrador. */
function exigirAdmin(req, res, next) {
  const cabecalho = req.get("authorization") || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;

  if (!token) return res.status(401).json({ erro: "Não autenticado." });

  try {
    req.admin = jwt.verify(token, SEGREDO);
    next();
  } catch {
    res.status(401).json({ erro: "Sessão inválida ou expirada." });
  }
}

module.exports = { gerarHash, gerarToken, autenticar, exigirAdmin, HORAS_DE_SESSAO };
