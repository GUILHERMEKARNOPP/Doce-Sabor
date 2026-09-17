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
├── index.html    → a loja
├── admin.html    → painel da dona da loja (login + produtos)
├── style.css     → estilos das duas páginas, responsivo no final
├── script.js     → menu mobile, rolagem suave, catálogo e carrinho
├── admin.js      → login e CRUD de produtos
├── config.js     → endereço da API (um lugar só, vale para as duas páginas)
├── render.yaml   → configuração do deploy da API no Render
├── images/       → fotos do site
└── backend/      → a API (Node + Express + PostgreSQL)
    ├── server.js         rotas, CORS, limites, tratamento de erro
    ├── db.js             conexão com o Postgres
    ├── auth.js           bcrypt, JWT e o middleware que barra quem não é admin
    ├── routes/produtos.js CRUD e tratamento da imagem
    ├── schema.sql        tabelas
    ├── scripts/          criar-admin e o Postgres de desenvolvimento
    └── tests/            testes de integração
```

A página tem estas seções, nesta ordem: barra de contato, navegação, hero,
Nossos Sabores, O Melhor Bolo de Pote, Sobre Nós, Nós Entregamos, galeria e rodapé.

---

## Rodando com o back-end

O site sozinho funciona (veja acima). Para mexer no painel da loja, são três terminais:

```bash
# 1. banco de dados local (não precisa instalar Postgres nem Docker)
cd backend && npm install && npm run db:dev

# 2. a API
cd backend && cp .env.example .env    # depois edite o .env
npm start

# 3. o site
python -m http.server 8000            # http://localhost:8000/admin.html
```

O `backend/.env` guarda a senha do banco, o segredo das sessões e a senha do
administrador. **Ele nunca vai para o Git** — está no `.gitignore`. Use o
`.env.example` como molde.

Para criar ou trocar a senha de um administrador:

```bash
cd backend && npm run criar-admin dona@docesabor.com.br "uma senha forte"
```

Os testes sobem um Postgres de verdade e exercitam login, autorização e upload:

```bash
cd backend && npm test
```

### Publicando a API no Render

O `render.yaml` já descreve o serviço. No painel do Render: **New → Blueprint**,
aponte para este repositório e preencha as variáveis marcadas como `sync: false`
(`DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_SENHA`). O `JWT_SECRET` o Render gera sozinho.

Depois de publicar, troque a URL de produção em `config.js` pela do serviço.

> No plano gratuito o servidor hiberna após 15 minutos parado e a primeira
> requisição pode levar meio minuto. Por isso a loja abre com uma lista de sabores
> de reserva (em `script.js`) e troca pelos dados reais quando a API responde —
> **a loja nunca aparece vazia**, mesmo com a API fora do ar.

> Se a conexão com o banco falhar com erro de certificado, o provedor usa uma CA
> própria: coloque o certificado na variável `DATABASE_CA_CERT`. Não desative a
> validação — ela é o que impede alguém no caminho de ler a senha do banco.

---

## Como o pedido funciona

O catálogo vem da API; o carrinho e o fechamento acontecem no navegador:

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

**Com o back-end no ar, isso se faz pelo painel** (`/admin.html`), sem tocar em código:
adicionar, editar preço, descrição, foto e estoque, ou excluir. Produtos com estoque
zero aparecem como "Esgotado" na loja e não podem ser adicionados ao carrinho.

A lista abaixo, em `script.js`, é só a **reserva** usada enquanto a API não responde:

```js
const RESERVA = [
  { id: "morango-creme", nome: "Morango com creme", preco: 15, estoque: null, img: "images/menu-morango-creme.jpg" },
  ...
];
```

Vale mantê-la parecida com o catálogo real, já que é ela que o cliente vê nos
primeiros segundos enquanto a API acorda.

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

## Segurança

Decisões que valem conhecer antes de mexer:

- **Senhas** são guardadas só como hash bcrypt (custo 12). A senha em texto nunca
  toca o banco.
- **Autorização é no servidor.** Esconder o botão no navegador não protege nada:
  toda rota que cria, altera ou apaga passa pelo middleware `exigirAdmin`.
- **Login** devolve sempre a mesma mensagem para e-mail inexistente e senha errada,
  e leva o mesmo tempo nos dois casos — senão dá para descobrir quais e-mails existem.
- **A sessão** é um JWT de 8 horas guardado em `sessionStorage`, enviado no cabeçalho
  `Authorization`. Não usa cookie, então não há superfície de CSRF.
- **Upload de imagem:** o arquivo é reprocessado pelo `sharp`, o que valida que é
  mesmo uma imagem (extensão e Content-Type se falsificam), descarta qualquer coisa
  embutida nos metadados e padroniza o tamanho. Nada é gravado em disco com nome
  vindo do cliente.
- **SQL** é sempre parametrizado. No `UPDATE` os nomes de coluna vêm de uma lista
  fixa no código, nunca do corpo da requisição.
- **CORS** aceita só as origens listadas em `ORIGENS_PERMITIDAS`. Nunca `*`.
- **Erros** chegam genéricos ao cliente; o detalhe fica no log do servidor.

---

## Limitações conhecidas

- **O carrinho vive só na memória da aba.** Recarregar a página esvazia o pedido.
- **A imagem do produto é guardada no banco**, não em disco: o disco do Render é
  apagado a cada deploy. Funciona bem para dezenas de produtos; para centenas,
  valeria um armazenamento de arquivos à parte.
- **Sair do painel não invalida o token** no servidor — ele continua válido até
  expirar (8 h). É o preço de uma sessão sem estado.
- **Preços não são confiáveis no servidor** — ver o aviso acima.
- O bloco "Peça seu Doce Sabor" no rodapé é informativo: não há formulário por trás.
- O link do Instagram aponta para `instagram.com` genérico, à espera do perfil da loja.
- A página não tem tags Open Graph nem favicon, então o link compartilhado no WhatsApp
  aparece sem imagem e sem descrição.
