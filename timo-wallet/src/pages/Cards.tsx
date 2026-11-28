import { useState } from 'react'
import { Eye, EyeOff, Lock, Snowflake, RefreshCw, Settings2 } from 'lucide-react'
import { cards as seedCards, formatBRL, type CardInfo } from '../data/mock'
import { useToast } from '../lib/toast'
import { motion } from 'framer-motion'

export function Cards() {
  const { show } = useToast()
  const [cards, setCards] = useState(seedCards)
  const [activeId, setActiveId] = useState(seedCards[0].id)
  const [reveal, setReveal] = useState(false)
  const active = cards.find((c) => c.id === activeId) ?? cards[0]
  const usage = Math.round((active.used / active.limit) * 100)

  function toggleBlock(card: CardInfo) {
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, blocked: !c.blocked } : c)),
    )
    show(card.blocked ? 'Cartão desbloqueado' : 'Cartão bloqueado temporariamente')
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Crédito sem anuidade
          </p>
          <h2>Cartões</h2>
        </div>
      </header>

      <div className="tabs">
        {cards.map((c) => (
          <button
            key={c.id}
            className={`tab${activeId === c.id ? ' active' : ''}`}
            onClick={() => {
              setActiveId(c.id)
              setReveal(false)
            }}
          >
            {c.virtual ? 'Virtual' : 'Físico'}
          </button>
        ))}
      </div>

      <motion.div
        key={active.id}
        className={`card-visual ${active.color}${active.blocked ? ' blocked' : ''}`}
        initial={{ rotateY: -12, opacity: 0.6 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
      >
        <div className="card-top">
          <div>
            <div className="card-brand">Timó</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: 4 }}>
              {active.label}
              {active.blocked ? ' · Bloqueado' : ''}
            </div>
          </div>
          <strong style={{ letterSpacing: '0.04em' }}>{active.brand}</strong>
        </div>
        <div className="card-number">
          {reveal ? active.number : `•••• •••• •••• ${active.last4}`}
        </div>
        <div className="card-bottom">
          <div>
            Titular
            <strong>{active.holder}</strong>
          </div>
          <div>
            Validade
            <strong>{active.expiry}</strong>
          </div>
          <div>
            CVV
            <strong>{reveal ? active.cvv : '•••'}</strong>
          </div>
        </div>
      </motion.div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span className="muted">Limite usado</span>
          <strong>
            {formatBRL(active.used)} / {formatBRL(active.limit)}
          </strong>
        </div>
        <div className="progress" aria-label={`Uso do limite ${usage}%`}>
          <span style={{ width: `${usage}%` }} />
        </div>
        <p className="dim" style={{ marginBottom: 0, fontSize: '0.8rem' }}>
          Disponível {formatBRL(active.limit - active.used)} · fatura fecha dia 10
        </p>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={() => setReveal((v) => !v)}>
          {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          {reveal ? 'Ocultar dados' : 'Mostrar dados'}
        </button>
        <button className="btn btn-ghost" onClick={() => toggleBlock(active)}>
          {active.blocked ? <Lock size={16} /> : <Snowflake size={16} />}
          {active.blocked ? 'Desbloquear' : 'Bloquear'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => show('CVV regenerado (demo)')}
        >
          <RefreshCw size={16} /> Novo CVV
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => show('Ajustes de cartão (demo)')}
        >
          <Settings2 size={16} /> Ajustes
        </button>
      </div>

      <div className="section-title">
        <h3>Benefícios Timó</h3>
      </div>
      <div className="stack-gap">
        <div className="list-row">
          <div className="tx-body">
            <strong>Cashback em compras</strong>
            <span>Até 1,5% de volta na fatura</span>
          </div>
        </div>
        <div className="list-row">
          <div className="tx-body">
            <strong>Parcelamento inteligente</strong>
            <span>Em até 12x sem juros no app</span>
          </div>
        </div>
        <div className="list-row">
          <div className="tx-body">
            <strong>Cartão virtual descartável</strong>
            <span>Gere um cartão para compras online</span>
          </div>
        </div>
      </div>
    </div>
  )
}
