/**
 * Recalcula a versão dos scripts no HTML.
 *
 *   node versionar.js
 *
 * O GitHub Pages manda o navegador guardar os arquivos por 10 minutos. Sem isto,
 * uma correção publicada pode demorar esse tempo para chegar em quem já visitou
 * a página — foi o que fez um produto recém-cadastrado não aparecer na loja.
 *
 * A versão é um resumo do próprio conteúdo: mudou o arquivo, muda a URL, e o
 * navegador é obrigado a buscar de novo. Rode antes de publicar qualquer mudança
 * em style.css, script.js, admin.js ou config.js.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");

function resumo(arquivos) {
  const h = crypto.createHash("sha1");
  for (const a of arquivos) h.update(fs.readFileSync(a));
  return h.digest("hex").slice(0, 8);
}

const paginas = [
  { html: "index.html", arquivos: ["style.css", "config.js", "script.js"] },
  { html: "admin.html", arquivos: ["style.css", "config.js", "admin.js"] },
];

let mudou = false;

for (const { html, arquivos } of paginas) {
  const versao = resumo(arquivos);
  let conteudo = fs.readFileSync(html, "utf8");
  const antes = conteudo;

  for (const arquivo of arquivos) {
    // a folha de estilo entra por href; os scripts, por src
    const atributo = arquivo.endsWith(".css") ? "href" : "src";
    conteudo = conteudo.replace(
      new RegExp(`${atributo}="${arquivo}(\\?v=[a-f0-9]+)?"`),
      `${atributo}="${arquivo}?v=${versao}"`
    );
  }

  if (conteudo !== antes) {
    fs.writeFileSync(html, conteudo);
    mudou = true;
    console.log(`${html} → v=${versao}`);
  } else {
    console.log(`${html} já está em v=${versao}`);
  }
}

if (!mudou) console.log("Nada a fazer.");
