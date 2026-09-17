document.addEventListener("DOMContentLoaded", () => {
  const API = window.DOCE_SABOR_API;   // definido em config.js

  /**
   * O token fica em sessionStorage: some ao fechar a aba e nunca é enviado
   * automaticamente pelo navegador, então não existe superfície de CSRF.
   */
  const guardaToken = {
    ler: () => { try { return sessionStorage.getItem("ds_token"); } catch { return null; } },
    gravar: (t) => { try { sessionStorage.setItem("ds_token", t); } catch {} },
    limpar: () => { try { sessionStorage.removeItem("ds_token"); } catch {} },
  };

  const el = (id) => document.getElementById(id);
  const telaLogin = el("telaLogin");
  const telaPainel = el("telaPainel");
  const lista = el("listaProdutos");
  const modalProduto = el("modalProduto");
  const modalExcluir = el("modalExcluir");

  let produtos = [];
  let idParaExcluir = null;

  const emReais = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",");

  function mostrarErro(campo, mensagem) {
    const alvo = el(campo);
    alvo.textContent = mensagem;
    alvo.hidden = !mensagem;
  }

  function avisar(mensagem) {
    const aviso = el("avisoPainel");
    aviso.textContent = mensagem;
    aviso.hidden = !mensagem;
    if (mensagem) setTimeout(() => { aviso.hidden = true; }, 4000);
  }

  /** Toda chamada autenticada passa por aqui: centraliza o token e o tratamento de sessão expirada. */
  async function chamar(caminho, opcoes = {}) {
    const cabecalhos = new Headers(opcoes.headers || {});
    const token = guardaToken.ler();
    if (token) cabecalhos.set("Authorization", "Bearer " + token);

    const resposta = await fetch(API + caminho, { ...opcoes, headers: cabecalhos });

    if (resposta.status === 401) {
      guardaToken.limpar();
      mostrarPainel(false);
      mostrarErro("erroLogin", "Sua sessão expirou. Entre novamente.");
      throw new Error("sessao");
    }

    if (resposta.status === 204) return null;

    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.erro || "Não foi possível concluir a operação.");
    return corpo;
  }

  /* ------------------------------------------------------------- login */

  function mostrarPainel(logado) {
    telaLogin.hidden = logado;
    telaPainel.hidden = !logado;
    el("sair").hidden = !logado;
  }

  el("formLogin").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarErro("erroLogin", "");
    const botao = el("botaoEntrar");
    botao.disabled = true;

    try {
      const resposta = await fetch(API + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: el("email").value, senha: el("senha").value }),
      });
      const corpo = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        mostrarErro("erroLogin", corpo.erro || "Não foi possível entrar.");
        return;
      }

      guardaToken.gravar(corpo.token);
      el("senha").value = "";
      mostrarPainel(true);
      await carregar();
    } catch {
      mostrarErro("erroLogin", "Servidor fora do ar. Tente de novo em instantes.");
    } finally {
      botao.disabled = false;
    }
  });

  el("sair").addEventListener("click", () => {
    guardaToken.limpar();
    produtos = [];
    mostrarPainel(false);
  });

  /* ---------------------------------------------------------- listagem */

  async function carregar() {
    try {
      produtos = await chamar("/api/produtos");
      desenhar();
    } catch (erro) {
      if (erro.message !== "sessao") avisar(erro.message);
    }
  }

  function desenhar() {
    lista.replaceChildren();
    el("listaVazia").hidden = produtos.length > 0;

    produtos.forEach((p) => {
      const linha = document.createElement("article");
      linha.className = "admin-linha";

      const foto = document.createElement("div");
      foto.className = "admin-foto";
      if (p.imagem) {
        const img = document.createElement("img");
        img.src = API + p.imagem;
        img.alt = "";
        img.loading = "lazy";
        foto.append(img);
      } else {
        foto.classList.add("admin-foto-vazia");
        foto.textContent = "sem foto";
      }

      const texto = document.createElement("div");
      texto.className = "admin-dados";
      const nome = document.createElement("h3");
      nome.textContent = p.nome;
      texto.append(nome);
      if (p.descricao) {
        const desc = document.createElement("p");
        desc.className = "admin-descricao";
        desc.textContent = p.descricao;
        texto.append(desc);
      }

      const preco = document.createElement("span");
      preco.className = "admin-preco";
      preco.textContent = emReais(p.preco);

      const acoes = document.createElement("div");
      acoes.className = "admin-acoes";

      const editar = document.createElement("button");
      editar.type = "button";
      editar.className = "btn btn-outline admin-btn-pequeno";
      editar.textContent = "Editar";
      editar.addEventListener("click", () => abrirFormulario(p));

      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "btn btn-outline admin-btn-pequeno admin-btn-perigo";
      excluir.textContent = "Excluir";
      excluir.addEventListener("click", () => pedirExclusao(p));

      acoes.append(editar, excluir);
      linha.append(foto, texto, preco, acoes);
      lista.append(linha);
    });
  }

  /* -------------------------------------------------- criar e editar */

  function abrirFormulario(produto) {
    mostrarErro("erroProduto", "");
    el("produtoId").value = produto ? produto.id : "";
    el("modoProduto").textContent = produto ? "Editando" : "Novo";
    el("tituloProduto").textContent = produto ? produto.nome : "Novo produto";
    el("nome").value = produto ? produto.nome : "";
    el("descricao").value = produto ? produto.descricao : "";
    el("preco").value = produto ? produto.preco : "";
    el("imagem").value = "";

    const previa = el("previa");
    if (produto && produto.imagem) {
      previa.src = API + produto.imagem;
      previa.hidden = false;
    } else {
      previa.removeAttribute("src");
      previa.hidden = true;
    }

    modalProduto.hidden = false;
    document.body.classList.add("sem-scroll");
    el("nome").focus();
  }

  function fecharFormulario() {
    modalProduto.hidden = true;
    document.body.classList.remove("sem-scroll");
  }

  el("imagem").addEventListener("change", (evento) => {
    const arquivo = evento.target.files[0];
    const previa = el("previa");
    if (!arquivo) return;
    previa.src = URL.createObjectURL(arquivo);
    previa.hidden = false;
  });

  el("formProduto").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarErro("erroProduto", "");
    const botao = el("salvarProduto");
    botao.disabled = true;

    const id = el("produtoId").value;
    const dados = new FormData();
    dados.append("nome", el("nome").value);
    dados.append("descricao", el("descricao").value);
    dados.append("preco", el("preco").value);
    const arquivo = el("imagem").files[0];
    if (arquivo) dados.append("imagem", arquivo);

    try {
      await chamar(id ? "/api/produtos/" + id : "/api/produtos", {
        method: id ? "PUT" : "POST",
        body: dados,
      });
      fecharFormulario();
      await carregar();
      avisar(id ? "Produto atualizado." : "Produto adicionado.");
    } catch (erro) {
      if (erro.message !== "sessao") mostrarErro("erroProduto", erro.message);
    } finally {
      botao.disabled = false;
    }
  });

  el("botaoNovo").addEventListener("click", () => abrirFormulario(null));
  el("cancelarProduto").addEventListener("click", fecharFormulario);
  el("fecharProduto").addEventListener("click", fecharFormulario);

  /* ------------------------------------------------------------ excluir */

  function pedirExclusao(produto) {
    idParaExcluir = produto.id;
    el("textoExcluir").textContent =
      'Excluir "' + produto.nome + '"? Esta ação não pode ser desfeita.';
    modalExcluir.hidden = false;
    document.body.classList.add("sem-scroll");
  }

  function fecharExclusao() {
    modalExcluir.hidden = true;
    idParaExcluir = null;
    document.body.classList.remove("sem-scroll");
  }

  el("confirmarExcluir").addEventListener("click", async () => {
    if (!idParaExcluir) return;
    try {
      await chamar("/api/produtos/" + idParaExcluir, { method: "DELETE" });
      fecharExclusao();
      await carregar();
      avisar("Produto excluído.");
    } catch (erro) {
      if (erro.message !== "sessao") avisar(erro.message);
    }
  });

  el("cancelarExcluir").addEventListener("click", fecharExclusao);
  el("fecharExcluir").addEventListener("click", fecharExclusao);

  [modalProduto, modalExcluir].forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) (m === modalProduto ? fecharFormulario : fecharExclusao)();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modalProduto.hidden) fecharFormulario();
    if (!modalExcluir.hidden) fecharExclusao();
  });

  /* ------------------------------------------------------------- início */

  if (guardaToken.ler()) {
    mostrarPainel(true);
    carregar();
  } else {
    mostrarPainel(false);
  }
});
