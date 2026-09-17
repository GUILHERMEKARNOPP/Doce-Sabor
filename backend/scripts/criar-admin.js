// Cria ou troca a senha de um administrador.
//   node scripts/criar-admin.js dona@docesabor.com.br "senha forte aqui"
require("dotenv").config();
const { consultar, encerrar } = require("../db");
const { gerarHash } = require("../auth");

const [email, senha] = process.argv.slice(2);

if (!email || !senha) {
  console.error('Uso: node scripts/criar-admin.js <email> "<senha>"');
  process.exit(1);
}
if (senha.length < 10) {
  console.error("A senha precisa ter pelo menos 10 caracteres.");
  process.exit(1);
}

(async () => {
  const hash = await gerarHash(senha);
  await consultar(
    `INSERT INTO administradores (email, senha_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash`,
    [email.toLowerCase().trim(), hash]
  );
  console.log("Administrador pronto:", email);
  await encerrar();
})().catch((erro) => {
  console.error("Falhou:", erro.message);
  process.exit(1);
});
