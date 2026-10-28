# Aether — Especificação da landing page

## Produto

**Aether** é um protocolo de valor nativo para pessoas e agentes, com o token **AETH** como unidade de conta, gás e governação.

**Aether Lite** é o primeiro cliente público: carteira leve, painel de saldo e envio, sem nó completo. Esta landing anuncia o lançamento do Lite e explica a tokenomics do AETH.

## Identidade visual

| Token | Valor | Uso |
| --- | --- | --- |
| Onyx Black | `#0B0B0C` | Fundo principal |
| Ether Neon | `#00F0FF` | Destaques, CTAs, gráficos |
| Superfície | `#121316` | Cards e header |
| Texto | `#F4F7F8` | Títulos e corpo |
| Muted | `#8A9199` | Secundário |
| Tipografia | Syne (display) + IBM Plex Sans (corpo) | next/font |

Modo único: **dark**. Sem tema claro nesta versão.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Componentes em `components/`
- Conteúdo estático em `lib/content.ts`

## Página (`/`)

1. **Header** — logo Aether, âncoras Lite / Tokenomics / Utilidade, CTA waitlist
2. **Hero** — lançamento Aether Lite
3. **Lite** — o que o cliente faz (carteira, taxas em AETH, sem full node)
4. **Tokenomics** — supply fixo, alocação, vesting
5. **Utilidade AETH** — gás, Lite, governação
6. **Footer** — aviso de early-stage

## Tokenomics AETH (landing)

- **Supply máximo:** 1 000 000 000 AETH (fixo, sem mint)
- **Unidade base:** 1 AETH = 1 000 000 uaeth
- **Alocação**
  - 40% Comunidade e mineração
  - 18% Tesouro do protocolo
  - 15% Liquidez
  - 12% Equipa (36 meses, cliff 12)
  - 10% Ecossistema Aether Lite
  - 5% Advisors (24 meses, cliff 6)

## Fora de âmbito (v1)

API, autenticação, compra on-chain, blog, i18n. Waitlist é UI local.
