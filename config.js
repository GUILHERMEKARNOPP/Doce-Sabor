// Endereço da API. Trocar aqui vale para a loja e para o painel.
// Em desenvolvimento o back-end roda em localhost:3000; em produção, no Render.
window.DOCE_SABOR_API =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://doce-sabor-api.onrender.com";
