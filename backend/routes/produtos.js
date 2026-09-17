const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { consultar } = require("../db");
const { exigirAdmin } = require("../auth");

const router = express.Router();

const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB
const LADO_DA_FOTO = 600;

// Arquivo fica em memória: nada é gravado em disco com nome vindo do cliente,
// o que elimina path traversal e execução de arquivo enviado.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
});

/**
 * Reprocessa a imagem com sharp. Isso faz três coisas de uma vez:
 * valida que o conteúdo é mesmo uma imagem (extensão e Content-Type se falsificam),
 * descarta qualquer payload embutido nos metadados, e padroniza o tamanho.
 */
async function normalizarImagem(buffer) {
  const jpeg = await sharp(buffer)
    .resize(LADO_DA_FOTO, LADO_DA_FOTO, { fit: "cover", position: "centre" })
    .jpeg({ quality: 84, progressive: true })
    .toBuffer();
  return { dados: jpeg, tipo: "image/jpeg" };
}

/** Valida e converte o corpo do formulário. Devolve {erros, valores}. */
function validarProduto(corpo, { parcial = false } = {}) {
  const erros = [];
  const valores = {};

  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  if (nome) {
    if (nome.length > 80) erros.push("O nome deve ter até 80 caracteres.");
    else valores.nome = nome;
  } else if (!parcial) {
    erros.push("Informe o nome do produto.");
  }

  const descricao = typeof corpo.descricao === "string" ? corpo.descricao.trim() : "";
  if (descricao.length > 300) erros.push("A descrição deve ter até 300 caracteres.");
  else if (descricao || !parcial) valores.descricao = descricao;

  if (corpo.preco !== undefined && corpo.preco !== "") {
    const preco = Number(String(corpo.preco).replace(",", "."));
    if (!Number.isFinite(preco) || preco < 0 || preco > 9999) {
      erros.push("O preço deve ser um número entre 0 e 9999.");
    } else {
      valores.preco_centavos = Math.round(preco * 100);
    }
  } else if (!parcial) {
    erros.push("Informe o preço.");
  }

  return { erros, valores };
}

function paraJson(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    preco: linha.preco_centavos / 100,
    imagem: linha.tem_imagem ? `/api/produtos/${linha.id}/imagem` : null,
  };
}

/* ---------------------------------------------------------------- público */

router.get("/", async (_req, res, next) => {
  try {
    const { rows } = await consultar(
      `SELECT id, nome, descricao, preco_centavos, imagem IS NOT NULL AS tem_imagem
         FROM produtos ORDER BY nome`
    );
    res.json(rows.map(paraJson));
  } catch (erro) {
    next(erro);
  }
});

router.get("/:id/imagem", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: "Id inválido." });

    const { rows } = await consultar(
      "SELECT imagem, imagem_tipo FROM produtos WHERE id = $1",
      [id]
    );
    if (!rows[0] || !rows[0].imagem) return res.status(404).json({ erro: "Sem imagem." });

    res.type(rows[0].imagem_tipo || "image/jpeg");
    res.set("Cache-Control", "public, max-age=300");
    res.send(rows[0].imagem);
  } catch (erro) {
    next(erro);
  }
});

/* ------------------------------------------------ somente administrador */

router.post("/", exigirAdmin, upload.single("imagem"), async (req, res, next) => {
  try {
    const { erros, valores } = validarProduto(req.body);
    if (erros.length) return res.status(400).json({ erro: erros.join(" ") });

    let foto = { dados: null, tipo: null };
    if (req.file) {
      try {
        foto = await normalizarImagem(req.file.buffer);
      } catch {
        return res.status(400).json({ erro: "O arquivo enviado não é uma imagem válida." });
      }
    }

    const { rows } = await consultar(
      `INSERT INTO produtos (nome, descricao, preco_centavos, imagem, imagem_tipo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, descricao, preco_centavos, imagem IS NOT NULL AS tem_imagem`,
      [valores.nome, valores.descricao, valores.preco_centavos, foto.dados, foto.tipo]
    );
    res.status(201).json(paraJson(rows[0]));
  } catch (erro) {
    next(erro);
  }
});

router.put("/:id", exigirAdmin, upload.single("imagem"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: "Id inválido." });

    const { erros, valores } = validarProduto(req.body, { parcial: true });
    if (erros.length) return res.status(400).json({ erro: erros.join(" ") });

    if (req.file) {
      try {
        const foto = await normalizarImagem(req.file.buffer);
        valores.imagem = foto.dados;
        valores.imagem_tipo = foto.tipo;
      } catch {
        return res.status(400).json({ erro: "O arquivo enviado não é uma imagem válida." });
      }
    }

    const campos = Object.keys(valores);
    if (!campos.length) return res.status(400).json({ erro: "Nada para alterar." });

    // Os nomes de coluna vêm da lista fixa acima, nunca do corpo da requisição;
    // os valores seguem parametrizados.
    const atribuicoes = campos.map((campo, i) => `${campo} = $${i + 1}`);
    const parametros = campos.map((campo) => valores[campo]);

    const { rows } = await consultar(
      `UPDATE produtos SET ${atribuicoes.join(", ")}, atualizado_em = now()
        WHERE id = $${campos.length + 1}
       RETURNING id, nome, descricao, preco_centavos, imagem IS NOT NULL AS tem_imagem`,
      [...parametros, id]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Produto não encontrado." });
    res.json(paraJson(rows[0]));
  } catch (erro) {
    next(erro);
  }
});

router.delete("/:id", exigirAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: "Id inválido." });

    const { rowCount } = await consultar("DELETE FROM produtos WHERE id = $1", [id]);
    if (!rowCount) return res.status(404).json({ erro: "Produto não encontrado." });
    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
