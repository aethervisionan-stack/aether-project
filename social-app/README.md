# Chama — Aether Social (protótipo local)

App full-stack de interação social com créditos (R$0,40), verificação facial **simulada**, Pix **simulado**, e VIP dual (12 níveis masculino + 12 feminino).

Dados persistem em `data/db.json` (criado automaticamente no primeiro start).

## Requisitos

- Node.js 20+

## Instalar e rodar

```bash
cd social-app
npm install
npm run dev
```

Abra: **http://localhost:3001**

Produção local:

```bash
cd social-app
npm install
npm run build
npm start
```

URL: **http://localhost:3001**

## Rotas principais

| Rota | Descrição |
| --- | --- |
| `/` | Seleção de gênero (Homem / Mulher) |
| `/onboarding` | Cadastro (nome, idade 18+, foto) |
| `/verify` | Verificação facial simulada → badge Verificado |
| `/discover` | Homem: perfis femininos seed verificados |
| `/chat/[userId]` | Chat com cota grátis + créditos |
| `/credits` | Compra de pacotes / valor custom (Pix simulado) |
| `/creator` | Mulher: saldo, ganhos, VIP, saque Pix do dia |
| `/inbox` | Lista de conversas |

## Contas de debug (painel canto inferior direito)

- **Homem Comum** — verificado, sem VIP, 10 msgs grátis/dia
- **Homem VIP avançado** — VIP6 (gasto R$1.280), créditos
- **Mulher Criadora** — VIP2 (ganhos R$520), saldo e saque

O painel também permite simular gasto/nível VIP masculino (1–12) e ganhos/nível VIP feminino (1–12, com bônus creditados), além de resetar o JSON.

## Economia

- 10 mensagens grátis/dia (homens) + bônus VIP
- 1 crédito = R$0,40 = 1 mensagem paga
- Mensagem paga → R$0,20 plataforma + R$0,20 criadora
- Criadora: “Sacar saldo do dia via Pix” (simulado)

## Banner

Toda a UI exibe aviso de que este é um protótipo localhost com Pix e verificação facial simulados.
