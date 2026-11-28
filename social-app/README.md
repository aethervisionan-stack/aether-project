# Chama — Aether Social (protótipo web + PWA)

App full-stack de interação social com créditos (R$0,40), fotos view-once, hora online remunerada, verificação facial **simulada**, Pix **simulado**, VIP dual (12 níveis) e **PWA básica** (manifest + service worker + ícones).

Dados persistem em `data/db.json` (criado automaticamente no primeiro start).

Módulos de negócio reutilizáveis (futuro nativo): `src/lib/economy.ts`, `src/lib/vip.ts`, `src/lib/store.ts`, `src/lib/types.ts`.

## Requisitos

- Node.js 20+

## Instalar e rodar (localhost)

```bash
cd social-app
npm install
npm run dev
```

Abra: **http://localhost:3001**

Produção local (PWA/service worker mais fiel):

```bash
cd social-app
npm install
npm run build
npm start
```

URL: **http://localhost:3001**

## PWA

- Manifest: `/manifest.webmanifest`
- Service worker: `/sw.js` (cache do shell + `/offline.html`; APIs nunca em cache)
- Ícones: `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/apple-touch-icon.png`
- Meta: `theme-color`, `apple-mobile-web-app`, botão “Instalar app” quando o browser disparar `beforeinstallprompt`

> Em `next dev` o SW registra, mas o comportamento de instalação/offline é mais confiável após `npm run build && npm start`.

## Rotas principais

| Rota | Descrição |
| --- | --- |
| `/` | Seleção de gênero (Homem / Mulher) |
| `/onboarding` | Cadastro (nome, idade 18+, foto) |
| `/verify` | Verificação facial simulada → badge Verificado |
| `/discover` | Homem: perfis femininos seed verificados |
| `/chat/[userId]` | Chat (msgs + fotos view-once) |
| `/credits` | Compra de pacotes / valor custom (Pix simulado) |
| `/creator` | Painel: saldo, Hora Online, ledger, saque Pix |
| `/inbox` | Lista de conversas |

## Regras de negócio (resumo)

- Onboarding: gênero → cadastro (bloqueia &lt;18) → verificação facial simulada
- Homem: 10 msgs grátis/dia + extras VIP; 1 crédito = R$0,40 = 1 msg paga (R$0,20 + R$0,20)
- Fotos: 3 grátis (escopo debug: por conversa **ou** por usuário masculino); 4ª+ = 5 créditos / R$2,00 (R$1 + R$1); view-once
- VIP masculino 1–12 por gasto acumulado; VIP feminino 1–12 por comissões (msgs + fotos); hora online só no VIP se toggle debug
- Criadora: Hora Online Remunerada + ledger separado + saque Pix do dia
- Debug: contas seed, VIP jump, fotos teste, taxa/hora, resumo plataforma

## Contas de debug

- **Homem Comum** / **Homem VIP avançado** / **Mulher Criadora** (painel canto inferior direito)
