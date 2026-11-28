import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ArrowLeftRight } from 'lucide-react'
import { contacts, formatBRL } from '../data/mock'
import { useToast } from '../lib/toast'

export function Transfer() {
  const { show } = useToast()
  const [params] = useSearchParams()
  const preset = params.get('contato')
  const initial = contacts.find((c) => c.id === preset)

  const [mode, setMode] = useState<'pix' | 'ted'>('pix')
  const [contactId, setContactId] = useState(initial?.id ?? '')
  const [amount, setAmount] = useState(initial?.lastAmount?.toString() ?? '')
  const [done, setDone] = useState(false)

  const contact = useMemo(
    () => contacts.find((c) => c.id === contactId),
    [contactId],
  )
  const value = Number(String(amount).replace(',', '.')) || 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contact || value <= 0) {
      show('Selecione um contato e um valor')
      return
    }
    setDone(true)
  }

  if (done && contact) {
    return (
      <div className="page">
        <div className="success-screen">
          <div className="check">
            <Check size={36} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Transferência concluída</h2>
          <p className="muted">
            {mode.toUpperCase()} para {contact.name}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 800,
            }}
          >
            {formatBRL(value)}
          </p>
          <button className="btn btn-primary btn-block" onClick={() => setDone(false)}>
            Nova transferência
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            PIX ou TED
          </p>
          <h2>Transferir</h2>
        </div>
        <div className="icon-btn" aria-hidden>
          <ArrowLeftRight size={18} />
        </div>
      </header>

      <div className="tabs">
        <button className={`tab${mode === 'pix' ? ' active' : ''}`} onClick={() => setMode('pix')}>
          PIX
        </button>
        <button className={`tab${mode === 'ted' ? ' active' : ''}`} onClick={() => setMode('ted')}>
          TED
        </button>
      </div>

      <form onSubmit={submit} className="stack-gap">
        <div className="field">
          <label htmlFor="contact">Para quem</label>
          <select
            id="contact"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">Selecione um contato</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.bank}
              </option>
            ))}
          </select>
        </div>

        {contact && (
          <div className="panel">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span className="dim">Banco</span>
              <strong>{contact.bank}</strong>
            </div>
            <div className="row-between">
              <span className="dim">Chave / conta</span>
              <strong style={{ fontSize: '0.85rem' }}>{contact.pixKey}</strong>
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="amount">Valor</label>
          <input
            id="amount"
            className="amount-input"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {mode === 'ted' && (
          <p className="dim" style={{ margin: 0, fontSize: '0.85rem' }}>
            TED gratuita Timó → Timó. Para outros bancos, processamento em até 1 hora útil.
          </p>
        )}

        <button className="btn btn-primary btn-block" type="submit">
          Transferir {value > 0 ? formatBRL(value) : ''}
        </button>
      </form>
    </div>
  )
}
