document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => navLinks.classList.remove("open"));
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (href.length < 2) return;            // href="#" nao aponta para nada
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ---------- Catálogo e carrinho ---------- */
  const WHATSAPP = "5547997417610";           // unico lugar para trocar o numero da loja
  const LINK_WHATSAPP = "https://wa.me/" + WHATSAPP;

  // o href fica no HTML para funcionar sem JS; aqui so garantimos que siga a constante
  document.querySelectorAll("[data-whatsapp]").forEach((a) => { a.href = LINK_WHATSAPP; });

  const API = window.DOCE_SABOR_API || "";

  /**
   * Lista de reserva. O catálogo de verdade vem da API, mas no plano gratuito do
   * Render o servidor hiberna e a primeira resposta pode levar meio minuto — a loja
   * não pode ficar vazia nesse tempo. Então ela abre com esta lista e troca pelos
   * dados reais assim que chegarem.
   */
  const RESERVA = [
    { id: "chocolate-wafer", nome: "Chocolate com wafer", preco: 16, img: "images/menu-chocolate-wafer.jpg" },
    { id: "morango-creme",   nome: "Morango com creme",   preco: 15, img: "images/menu-morango-creme.jpg" },
    { id: "cookies",         nome: "Cookies com chocolate", preco: 17, img: "images/menu-cookies.jpg" },
    { id: "doce-de-leite",   nome: "Doce de leite com brigadeiro", preco: 17, img: "images/menu-doce-de-leite.jpg" },
    { id: "maracuja",        nome: "Maracujá com chocolate branco", preco: 18, img: "images/menu-maracuja.jpg" },
  ];

  let PRODUTOS = RESERVA;

  /** Busca o catálogo na API. Se falhar, a loja segue com a lista de reserva. */
  async function carregarCatalogo() {
    if (!API) return;
    try {
      const resposta = await fetch(API + "/api/produtos");
      if (!resposta.ok) return;
      const vindos = await resposta.json();
      if (!Array.isArray(vindos) || vindos.length === 0) return;

      PRODUTOS = vindos.map((p) => ({
        id: String(p.id),
        nome: p.nome,
        preco: p.preco,
        img: p.imagem ? API + p.imagem : null,
      }));
      // o catálogo mudou: mantém no carrinho o que continua existindo
      const anterior = [...carrinho];
      carrinho.clear();
      anterior.forEach(([id, qtd]) => {
        if (produto(id)) carrinho.set(id, qtd);
      });
      gravarCarrinho();
      montarMenu();
      atualizar();
    } catch {
      /* servidor fora do ar: a lista de reserva continua valendo */
    }
  }

  const carrinho = new Map();                 // id do produto -> quantidade

  /**
   * O carrinho sobrevive a recarregar a página. Fica em localStorage e não em
   * memória porque o cliente costuma sair para conferir um sabor, trocar de aba
   * ou receber uma ligação no meio do pedido — e voltar para um carrinho vazio
   * faz ele começar tudo de novo.
   *
   * Guardamos só id e quantidade, nunca preço: o valor vem sempre do catálogo
   * atual, senão um preço antigo ficaria congelado no navegador de quem voltasse
   * dias depois.
   */
  const CHAVE_CARRINHO = "ds_carrinho";

  function gravarCarrinho() {
    try {
      localStorage.setItem(CHAVE_CARRINHO, JSON.stringify([...carrinho]));
    } catch {
      /* navegação anônima ou armazenamento bloqueado: segue sem persistir */
    }
  }

  function lerCarrinho() {
    try {
      const bruto = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || "[]");
      if (!Array.isArray(bruto)) return;

      bruto.forEach((par) => {
        if (!Array.isArray(par) || par.length !== 2) return;
        const [id, qtd] = par;
        // o conteúdo veio do navegador do cliente: só entra o que existe no
        // catálogo de agora e com quantidade que faça sentido
        if (typeof id !== "string" || !Number.isInteger(qtd) || qtd < 1) return;
        if (!produto(id)) return;
        carrinho.set(id, qtd);
      });
    } catch {
      /* conteúdo inválido: começa com o carrinho vazio */
    }
  }

  const menuModal = document.getElementById("menuModal");
  const cartModal = document.getElementById("cartModal");
  const menuGrid = document.getElementById("menuGrid");
  const menuStatus = document.getElementById("menuStatus");
  const cartList = document.getElementById("cartList");
  const cartVazio = document.getElementById("cartVazio");
  const cartTotalRow = document.getElementById("cartTotalRow");
  const cartTotal = document.getElementById("cartTotal");
  const navCartCount = document.getElementById("navCartCount");
  const finalizarBtn = document.getElementById("finalizar");

  const emReais = (v) => "R$ " + v.toFixed(2).replace(".", ",");
  const produto = (id) => PRODUTOS.find((p) => p.id === id);
  const totalItens = () => [...carrinho.values()].reduce((a, b) => a + b, 0);
  const totalValor = () =>
    [...carrinho].reduce((soma, [id, qtd]) => soma + produto(id).preco * qtd, 0);

  function montarMenu() {
    menuGrid.replaceChildren();
    PRODUTOS.forEach((p) => {
      const li = document.createElement("li");
      li.className = "menu-item";

      let img;
      if (p.img) {
        img = document.createElement("img");
        img.src = p.img;
        img.alt = "Bolo de pote sabor " + p.nome;
        img.loading = "lazy";
      } else {
        img = document.createElement("div");
        img.className = "menu-sem-foto";
        img.textContent = "sem foto";
      }

      const nome = document.createElement("h3");
      nome.textContent = p.nome;

      const preco = document.createElement("p");
      preco.className = "menu-preco";
      preco.textContent = emReais(p.preco);

      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn btn-outline menu-add";
      botao.textContent = "Adicionar";
      botao.addEventListener("click", () => adicionar(p.id));

      li.append(img, nome, preco, botao);
      menuGrid.append(li);
    });
  }

  function adicionar(id) {
    mudarQtd(id, 1);
  }

  function mudarQtd(id, delta) {
    const p = produto(id);
    if (!p) return;

    const nova = (carrinho.get(id) || 0) + delta;

    if (nova > 0) carrinho.set(id, nova);
    else carrinho.delete(id);
    gravarCarrinho();
    atualizar();
  }

  function atualizar() {
    const itens = totalItens();

    navCartCount.textContent = String(itens);
    navCartCount.hidden = itens === 0;

    menuStatus.textContent = itens
      ? itens + (itens === 1 ? " item no carrinho · " : " itens no carrinho · ") + emReais(totalValor())
      : "Seu carrinho está vazio.";

    cartList.replaceChildren();
    carrinho.forEach((qtd, id) => {
      const p = produto(id);
      const li = document.createElement("li");
      li.className = "cart-item";

      const nome = document.createElement("span");
      nome.className = "cart-nome";
      nome.textContent = p.nome;

      const controles = document.createElement("div");
      controles.className = "cart-qtd";
      const menos = document.createElement("button");
      menos.type = "button";
      menos.setAttribute("aria-label", "Remover uma unidade de " + p.nome);
      menos.textContent = "−";
      menos.addEventListener("click", () => mudarQtd(id, -1));
      const conta = document.createElement("span");
      conta.textContent = qtd + " un";
      const mais = document.createElement("button");
      mais.type = "button";
      mais.setAttribute("aria-label", "Adicionar uma unidade de " + p.nome);
      mais.textContent = "+";
      mais.addEventListener("click", () => mudarQtd(id, 1));
      controles.append(menos, conta, mais);

      const valor = document.createElement("strong");
      valor.className = "cart-valor";
      valor.textContent = emReais(p.preco * qtd);

      li.append(nome, controles, valor);
      cartList.append(li);
    });

    cartVazio.hidden = itens > 0;
    cartTotalRow.hidden = itens === 0;
    cartTotal.textContent = emReais(totalValor());
    finalizarBtn.disabled = itens === 0;
  }

  /* ---------- Abrir / fechar ---------- */
  let focoAnterior = null;

  function abrir(modal) {
    focoAnterior = document.activeElement;
    menuModal.hidden = true;
    cartModal.hidden = true;
    modal.hidden = false;
    document.body.classList.add("sem-scroll");
    modal.querySelector(".modal-close").focus();
  }

  function fechar() {
    menuModal.hidden = true;
    cartModal.hidden = true;
    document.body.classList.remove("sem-scroll");
    if (focoAnterior) focoAnterior.focus();
  }

  document.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fechar));
  [menuModal, cartModal].forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m) fechar(); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !(menuModal.hidden && cartModal.hidden)) fechar();
  });

  document.querySelectorAll("[data-abrir-menu]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.preventDefault();
      abrir(menuModal);
    });
  });
  document.getElementById("navCart").addEventListener("click", () => abrir(cartModal));
  document.getElementById("irCarrinho").addEventListener("click", () => abrir(cartModal));
  document.getElementById("voltarMenu").addEventListener("click", () => abrir(menuModal));

  finalizarBtn.addEventListener("click", () => {
    if (carrinho.size === 0) return;
    const linhas = [...carrinho].map(
      ([id, qtd]) =>
        "• Bolo de pote sabor " + produto(id).nome + " — " + qtd + " un — " + emReais(produto(id).preco * qtd)
    );
    const texto =
      "Olá! Quero fazer um pedido no Doce Sabor:\n\n" +
      linhas.join("\n") +
      "\n\nTotal: " + emReais(totalValor());
    window.open(LINK_WHATSAPP + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
  });

  lerCarrinho();
  montarMenu();
  atualizar();
  carregarCatalogo();
});
