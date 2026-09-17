-- Esquema do Doce Sabor.
-- Roda sozinho na subida do servidor (db.js), e é seguro rodar de novo.

CREATE TABLE IF NOT EXISTS administradores (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,           -- bcrypt; a senha em texto nunca é gravada
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS produtos (
  id            SERIAL PRIMARY KEY,
  nome          TEXT NOT NULL,
  descricao     TEXT NOT NULL DEFAULT '',
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos >= 0),
  imagem        BYTEA,                   -- a foto mora no banco: o disco do Render é apagado a cada deploy
  imagem_tipo   TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produtos_nome_idx ON produtos (nome);

-- O controle de estoque foi retirado: a loja mostra tudo que estiver cadastrado.
ALTER TABLE produtos DROP COLUMN IF EXISTS estoque;
