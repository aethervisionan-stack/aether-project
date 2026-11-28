# Chama — Aether Social (protótipo local)

App full-stack de interação social com créditos (R$0,40), fotos view-once, hora online remunerada, verificação facial **simulada**, Pix **simulado**, e VIP dual (12 níveis).

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
| `/chat/[userId]` | Chat (msgs + fotos view-once) |
| `/credits` | Compra de pacotes / valor custom (Pix simulado) |
| `/creator` | Painel: saldo, Hora Online, ledger, saque Pix |
| `/inbox` | Lista de conversas |

## Fotos (view once)

- 3 primeiras fotos **grátis** (escopo debug: por conversa **ou** por usuário masculino)
- A partir da 4ª: **5 créditos = R$2,00** (R$1,00 plataforma + R$1,00 criadora)
- Card bloqueado: “Desbloquear foto — 5 créditos (R$ 2,00)”
- Abrir → modal fullscreen com aviso de visualização única; ao fechar → `expired_viewed` (não reabre)
- Proteções web: sem clique direito/arrastar + watermark com id/nome; nota de apps nativos (screenshot + URL assinada)

## Hora Online Remunerada

No painel criadora (`/creator`):

- Taxa R$/hora configurável (padrão R$10)
- Status: Offline / Em Turno Ativo / Pausado
- Timer de horas + indicador de meta de atividade
- Botões: +1h turno online / Simular X minutos
- Ledger separado: Hora Online · Msgs R$0,20 · Fotos R$1,00 · Bônus VIP Feminino
- VIP feminino: **só comissões** por padrão (msgs + fotos); toggle debug para incluir hora online
- Saque Pix do dia: comissões + hora validada

## Contas de debug

- **Homem Comum** / **Homem VIP avançado** / **Mulher Criadora**
- Escopo das 3 fotos grátis, enviar foto teste, resetar contador
- Taxa horária + simular minutos online
- Resumo ledger plataforma (msgs, fotos, hora, saques)
- VIP 1–12 + reset do JSON

## Economia (resumo)

- 1 crédito = R$0,40
- Msg paga → R$0,20 + R$0,20
- Foto paga → 5 créditos / R$2,00 → R$1,00 + R$1,00
