import { Copy, Building2 } from 'lucide-react'
import { user } from '../data/mock'
import { useToast } from '../lib/toast'

export function Deposit() {
  const { show } = useToast()

  function copy(text: string, label: string) {
    void navigator.clipboard?.writeText(text)
    show(`${label} copiado`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Sem taxas Timó
          </p>
          <h2>Depositar</h2>
        </div>
      </header>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div className="tx-icon in">
            <Building2 size={18} />
          </div>
          <div>
            <strong>Dados da conta</strong>
            <p className="dim" style={{ margin: 0, fontSize: '0.8rem' }}>
              Use PIX ou TED para sua conta Timó
            </p>
          </div>
        </div>
        {[
          ['Instituição', `${user.bank} (${user.bankCode})`],
          ['Agência', user.agency],
          ['Conta', user.account],
          ['Titular', user.name],
          ['CPF', user.cpf],
        ].map(([label, value]) => (
          <div key={label} className="row-between" style={{ marginBottom: 10 }}>
            <div>
              <div className="dim" style={{ fontSize: '0.75rem' }}>
                {label}
              </div>
              <strong style={{ fontSize: '0.92rem' }}>{value}</strong>
            </div>
            <button
              className="icon-btn"
              aria-label={`Copiar ${label}`}
              onClick={() => copy(value, label)}
            >
              <Copy size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="stack-gap">
        <div className="list-row">
          <div className="tx-body">
            <strong>Depósito via PIX</strong>
            <span>Instantâneo · use qualquer chave cadastrada</span>
          </div>
        </div>
        <div className="list-row">
          <div className="tx-body">
            <strong>Depósito via TED</strong>
            <span>Mesmo dia em horário bancário</span>
          </div>
        </div>
      </div>
    </div>
  )
}
