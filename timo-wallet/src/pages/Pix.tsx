import { useMemo, useState } from 'react'
import { Copy, Check, KeyRound, QrCode, Send } from 'lucide-react'
import { contacts, formatBRL, pixKeys, user } from '../data/mock'
import { useToast } from '../lib/toast'

type Tab = 'enviar' | 'receber' | 'chaves'

export function Pix() {
  const { show } = useToast()
  const [tab, setTab] = useState<Tab>('enviar')
  const [key, setKey] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [copied, setCopied] = useState(false)

  const primary = useMemo(() => pixKeys.find((k) => k.primary) ?? pixKeys[0], [])
  const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.')) || 0

  function copyKey(value: string) {
    void navigator.clipboard?.writeText(value.replace(/\D/g, value.includes('@') ? value : value))
    setCopied(true)
    show('Chave PIX copiada')
    window.setTimeout(() => setCopied(false), 1600)
  }

  function submitPix(e: React.FormEvent) {
    e.preventDefault()
    if (!key || numericAmount <= 0) {
      show('Informe chave e valor válidos')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="page">
        <div className="success-screen">
          <div className="check">
            <Check size={36} strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 8px' }}>
            PIX enviado
          </h2>
          <p className="muted">Para {key}</p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 800,
              margin: '12px 0 24px',
            }}
          >
            {formatBRL(numericAmount)}
          </p>
          <div className="panel" style={{ textAlign: 'left', marginBottom: 18 }}>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="dim">Quando</span>
              <strong>Agora · Instantâneo</strong>
            </div>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="dim">Mensagem</span>
              <strong>{message || '—'}</strong>
            </div>
            <div className="row-between">
              <span className="dim">ID da transação</span>
              <strong style={{ fontSize: '0.8rem' }}>E401202611272145ABCD</strong>
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setSent(false)}>
            Novo PIX
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
            Transferências instantâneas
          </p>
          <h2>Área PIX</h2>
        </div>
        <div className="icon-btn" aria-hidden>
          <QrCode size={18} />
        </div>
      </header>

      <div className="tabs" role="tablist">
        {(
          [
            ['enviar', 'Enviar'],
            ['receber', 'Receber'],
            ['chaves', 'Minhas chaves'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            className={`tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'enviar' && (
        <form onSubmit={submitPix} className="stack-gap">
          <div className="section-title" style={{ marginTop: 0 }}>
            <h3>Contatos frequentes</h3>
          </div>
          <div className="contact-scroll">
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                className="contact-chip"
                onClick={() => setKey(c.pixKey)}
              >
                <div className="avatar">{c.initials}</div>
                <span>{c.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="pix-key">Chave PIX</label>
            <input
              id="pix-key"
              placeholder="CPF, e-mail, celular ou aleatória"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pix-amount">Valor</label>
            <input
              id="pix-amount"
              className="amount-input"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pix-msg">Mensagem (opcional)</label>
            <input
              id="pix-msg"
              placeholder="Ex.: Almoço de sexta"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            <Send size={18} /> Continuar
          </button>
        </form>
      )}

      {tab === 'receber' && (
        <div className="stack-gap">
          <div className="panel" style={{ textAlign: 'center' }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Mostre o QR Code ou compartilhe sua chave
            </p>
            <div className="qr-box" aria-label="QR Code PIX simulado" />
            <p style={{ fontWeight: 700, marginBottom: 4 }}>{user.name}</p>
            <p className="dim" style={{ marginTop: 0, fontSize: '0.85rem' }}>
              {primary.label}: {primary.value}
            </p>
            <button
              className="btn btn-ghost btn-block"
              type="button"
              onClick={() => copyKey(primary.value)}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              Copiar chave PIX
            </button>
          </div>
          <div className="panel">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="recv-amount">Cobrar valor específico</label>
              <input id="recv-amount" placeholder="R$ 0,00" inputMode="decimal" />
            </div>
          </div>
        </div>
      )}

      {tab === 'chaves' && (
        <div className="key-list">
          {pixKeys.map((k) => (
            <div key={k.id} className="list-row">
              <div className="tx-icon in">
                <KeyRound size={18} />
              </div>
              <div className="tx-body">
                <strong>
                  {k.label} {k.primary && <span className="badge">Principal</span>}
                </strong>
                <span>{k.value}</span>
              </div>
              <button
                className="icon-btn"
                aria-label="Copiar chave"
                onClick={() => copyKey(k.value)}
              >
                <Copy size={16} />
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-block" type="button" onClick={() => show('Cadastro de nova chave (demo)')}>
            Cadastrar nova chave
          </button>
        </div>
      )}
    </div>
  )
}
