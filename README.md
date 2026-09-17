# Doce Sabor

Site de uma loja de bolo de pote em Joinville (SC). O cliente escolhe os sabores,
monta o carrinho e o pedido chega pronto no WhatsApp da loja.

**No ar:** https://docesaborbr.github.io

---

## Como abrir

Não tem instalação, build nem dependência. Clique duas vezes em `index.html`, ou
arraste o arquivo para o navegador.

Se precisar servir por HTTP (só é necessário se alguém adicionar algo que dependa
de requisições, como `fetch`), rode dentro da pasta:

```bash
python -m http.server 8000     # depois acesse http://localhost:8000
```

## Arquivos

```
├── index.html    → estrutura da página e dos dois modais (menu e carrinho)
├── style.css     → estilos, organizados por seção, com o responsivo no final
├── script.js     → menu mobile, rolagem suave, catálogo e carrinho
└── images/       → todas as fotos
```

A página tem estas seções, nesta ordem: barra de contato, navegação, hero,
Nossos Sabores, O Melhor Bolo de Pote, Sobre Nós, Nós Entregamos, galeria e rodapé.

---

## Como o pedido funciona

Não existe servidor nem banco de dados. O fluxo é todo no navegador:

1. O cliente clica em **Explore o menu** (ou em qualquer botão "Faça seu pedido pelo
   WhatsApp") e vê os sabores disponíveis.
2. Cada **Adicionar** soma uma unidade. O contador dourado na barra de navegação
   acompanha.
3. Em **Ir para o carrinho** ele revisa itens, quantidades e total.
4. **Finalizar compra** abre o WhatsApp da loja com a mensagem já escrita:

```
Olá! Quero fazer um pedido no Doce Sabor:

• Bolo de pote sabor Morango com creme — 1 un — R$ 15,00
• Bolo de pote sabor Chocolate com wafer — 2 un — R$ 32,00

Total: R$ 47,00
```

> **Atenção, para quem atende os pedidos:** o preço e a quantidade são calculados no
> navegador do cliente, e qualquer pessoa com o console aberto consegue alterá-los
> antes de enviar. **O total que chega no WhatsApp é uma proposta, não um valor
> confiável.** Sempre confira os itens e refaça a conta antes de confirmar o pedido.
> Só um site com servidor resolveria isso de verdade.

---

## O que você provavelmente vai querer mudar

### Número do WhatsApp

Uma linha só, em `script.js`:

```js
const WHATSAPP = "5547997417610";   // 55 + DDD + numero, sem espaco ou traco
```

Os ícones de WhatsApp da página derivam dessa mesma constante, então não é preciso
mexer em mais nada — eles nunca vão apontar para um número diferente do carrinho.

### Sabores e preços

A lista fica logo abaixo, no mesmo arquivo:

```js
const PRODUTOS = [
  { id: "morango-creme", nome: "Morango com creme", preco: 15, img: "images/menu-morango-creme.jpg" },
  ...
];
```

Para **mudar um preço**, troque o número (sem aspas, use ponto para centavos: `15.5`).
Para **acrescentar um sabor**, copie uma linha, troque o `id` (tem que ser único), o
`nome`, o `preco` e coloque uma foto quadrada em `images/`. A grade do menu se ajusta
sozinha à quantidade de sabores.

### Dados de contato

No rodapé de `index.html`, procure por `ENDEREÇO`, `CONTATO` e `HORAS`.

> ⚠️ O e-mail e o telefone do rodapé ainda são os do modelo original
> (`info@mysite.com` e `123-456-7890`). **Precisam ser trocados pelos reais** antes de
> divulgar o site.

### Cores

Todas as cores estão no topo de `style.css`, em variáveis:

```css
:root {
  --brown: #541F03;   /* texto e fundos escuros */
  --gold:  #C9A227;   /* molduras dos botões e detalhes */
  --pink:  #F9CFD9;   /* navegação, rodapé e seções claras */
}
```

Trocar o valor ali muda a cor em toda a página de uma vez.

---

## Publicação

O site é servido pelo GitHub Pages a partir da branch `main`, na raiz do repositório.
**Todo push para `main` atualiza o site no ar** em um ou dois minutos — não existe
passo de deploy manual.

O repositório se chama `docesaborbr.github.io` de propósito: é esse nome que faz o
GitHub servir o site em `docesaborbr.github.io` sem `/nome-do-repo/` no final.
Renomear o repositório quebra a URL.

---

## Responsivo

- **≥ 1350px** — medidas fixas em pixels.
- **860px – 1349px** — o mesmo desenho encolhe proporcionalmente (medidas em `vw`).
- **≤ 859px** — as colunas empilham, o menu vira sanduíche, as fotos que eram fundo
  passam a ser imagens no fluxo e o menu de sabores vira duas colunas.

## Tipografia

Duas fontes do Google Fonts: **Fraunces** (com os eixos `SOFT` e `WONK` ativados) nos
títulos serifados e **Inter** nos textos, botões e navegação.

---

## Limitações conhecidas

- **O carrinho vive só na memória da aba.** Recarregar a página esvazia o pedido.
- **Preços não são confiáveis no servidor** — ver o aviso acima.
- O bloco "Peça seu Doce Sabor" no rodapé é informativo: não há formulário por trás.
- O link do Instagram aponta para `instagram.com` genérico, à espera do perfil da loja.
- A página não tem tags Open Graph nem favicon, então o link compartilhado no WhatsApp
  aparece sem imagem e sem descrição.
