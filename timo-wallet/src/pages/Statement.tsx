import { useMemo, useState } from 'react'
import { Search, Filter } from 'lucide-react'
import {
  formatBRL,
  groupTransactions,
  transactions,
  type TxType,
} from '../data/mock'
import { TransactionItem } from '../components/TransactionItem'

const filters: { id: 'all' | TxType; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'pix_in', label: 'PIX in' },
  { id: 'pix_out', label: 'PIX out' },
  { id: 'card', label: 'Cartão' },
  { id: 'boleto', label: 'Contas' },
]

export function Statement() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof filters)[number]['id']>('all')

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const matchFilter =
        filter === 'all' ||
        tx.type === filter ||
        (filter === 'pix_in' && tx.type === 'pix_in') ||
        (filter === 'pix_out' && tx.type === 'pix_out')
      const q = query.trim().toLowerCase()
      const matchQuery =
        !q ||
        tx.title.toLowerCase().includes(q) ||
        tx.subtitle.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q)
      return matchFilter && matchQuery
    })
  }, [filter, query])

  const groups = groupTransactions(filtered)
  const monthTotal = filtered.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Novembro 2026
          </p>
          <h2>Extrato</h2>
        </div>
        <div className="icon-btn" aria-hidden>
          <Filter size={18} />
        </div>
      </header>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="stat-tile">
          <span>Entradas</span>
          <strong style={{ color: 'var(--success)' }}>
            {formatBRL(filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
          </strong>
        </div>
        <div className="stat-tile">
          <span>Saídas</span>
          <strong>
            {formatBRL(
              Math.abs(filtered.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)),
            )}
          </strong>
        </div>
      </div>

      <div className="field">
        <label htmlFor="search">Buscar</label>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 14, top: 15, color: 'var(--text-dim)' }}
          />
          <input
            id="search"
            style={{ paddingLeft: 40 }}
            placeholder="Nome, categoria ou estabelecimento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="contact-scroll" style={{ marginBottom: 14 }}>
        {filters.map((f) => (
          <button
            key={f.id}
            className={`btn ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '8px 14px', borderRadius: 999, whiteSpace: 'nowrap' }}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="dim" style={{ marginTop: 0, fontSize: '0.85rem' }}>
        Resultado do período:{' '}
        <strong style={{ color: monthTotal >= 0 ? 'var(--success)' : 'var(--text)' }}>
          {formatBRL(monthTotal)}
        </strong>
      </p>

      {groups.length === 0 ? (
        <div className="empty">Nenhuma movimentação encontrada.</div>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="day-group">
            <div className="day-label">
              <span>{group.label}</span>
              <span>{formatBRL(group.total)}</span>
            </div>
            <div className="tx-list">
              {group.items.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
