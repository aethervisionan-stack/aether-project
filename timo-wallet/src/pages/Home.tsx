import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Landmark,
  QrCode,
  ArrowLeftRight,
  Plus,
} from 'lucide-react'
import {
  balances,
  contacts,
  formatBRL,
  transactions,
  user,
} from '../data/mock'
import { TransactionItem } from '../components/TransactionItem'

const actionIcons = {
  pix: QrCode,
  transfer: ArrowLeftRight,
  pay: FileText,
  deposit: Plus,
  cards: CreditCard,
  statement: Landmark,
}

const homeActions = [
  { id: 'pix', label: 'Área PIX', path: '/pix', icon: 'pix' as const },
  { id: 'transfer', label: 'Transferir', path: '/transferir', icon: 'transfer' as const },
  { id: 'pay', label: 'Pagar boleto', path: '/pagar', icon: 'pay' as const },
  { id: 'deposit', label: 'Depositar', path: '/depositar', icon: 'deposit' as const },
  { id: 'cards', label: 'Cartões', path: '/cartoes', icon: 'cards' as const },
  { id: 'statement', label: 'Extrato', path: '/extrato', icon: 'statement' as const },
]

export function Home() {
  const [hidden, setHidden] = useState(false)
  const recent = transactions.slice(0, 5)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Olá, {user.firstName}
          </p>
          <h2>Sua conta Timó</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="icon-btn"
            aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
            onClick={() => setHidden((v) => !v)}
          >
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button className="icon-btn" aria-label="Notificações">
            <Bell size={18} />
          </button>
        </div>
      </header>

      <motion.section
        className="balance-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="eyebrow">
          <span>Saldo disponível</span>
          <span className="brand-inline">Timó</span>
        </div>
        <div className={`balance-amount${hidden ? ' hide-balance' : ''}`}>
          {hidden ? '••••••' : formatBRL(balances.available)}
        </div>
        <div className="balance-meta">
          <div className="chip">
            Rendimento do mês <strong>{hidden ? '••••' : formatBRL(balances.yieldMonth)}</strong>
          </div>
          <div className="chip">
            Cashback <strong>{hidden ? '••••' : formatBRL(balances.cashbackMonth)}</strong>
          </div>
          <div className="chip">
            Guardado <strong>{hidden ? '••••' : formatBRL(balances.invested)}</strong>
          </div>
        </div>
      </motion.section>

      <div className="actions-grid">
        {homeActions.map((action, i) => {
          const Icon = actionIcons[action.icon]
          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.15 }}
            >
              <Link to={action.path} className="action-tile">
                <div className="icon">
                  <Icon size={20} />
                </div>
                <span>{action.label}</span>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="section-title">
        <h3>Transferir de novo</h3>
        <Link to="/transferir">Ver todos</Link>
      </div>
      <div className="contact-scroll">
        {contacts.slice(0, 6).map((c) => (
          <Link key={c.id} to={`/transferir?contato=${c.id}`} className="contact-chip">
            <div className="avatar">{c.initials}</div>
            <span>{c.name.split(' ')[0]}</span>
          </Link>
        ))}
      </div>

      <div className="section-title">
        <h3>Últimas movimentações</h3>
        <Link to="/extrato">Ver extrato</Link>
      </div>
      <div className="tx-list">
        {recent.map((tx) => (
          <TransactionItem key={tx.id} tx={tx} />
        ))}
      </div>
    </div>
  )
}
