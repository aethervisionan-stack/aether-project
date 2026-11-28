import { useState } from 'react'
import { Check, ScanLine } from 'lucide-react'
import { formatBRL } from '../data/mock'
import { useToast } from '../lib/toast'

export function Pay() {
  const { show } = useToast()
  const [code, setCode] = useState('')
  const [done, setDone] = useState(false)
  const amount = 186.42

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().length < 8) {
      show('Cole um código de barras válido (demo)')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="page">
        <div className="success-screen">
          <div className="check">
            <Check size={36} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Boleto pago</h2>
          <p className="muted">Enel SP · Conta de luz</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800 }}>
            {formatBRL(amount)}
          </p>
          <button className="btn btn-primary btn-block" onClick={() => setDone(false)}>
            Pagar outro
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
            Boletos e convênios
          </p>
          <h2>Pagar</h2>
        </div>
      </header>

      <form onSubmit={submit} className="stack-gap">
        <div className="panel" style={{ textAlign: 'center' }}>
          <ScanLine size={40} color="var(--accent)" />
          <p className="muted">Escaneie o código de barras ou cole abaixo</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCode('23793.38128 60000.000003 00000.000400 1 84370000018642')
              show('Código de exemplo preenchido')
            }}
          >
            Usar boleto de exemplo
          </button>
        </div>
        <div className="field">
          <label htmlFor="barcode">Código de barras</label>
          <textarea
            id="barcode"
            rows={3}
            placeholder="Digite ou cole o código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        {code.trim().length >= 8 && (
          <div className="panel">
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="dim">Beneficiário</span>
              <strong>Enel SP</strong>
            </div>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span className="dim">Vencimento</span>
              <strong>28/11/2026</strong>
            </div>
            <div className="row-between">
              <span className="dim">Valor</span>
              <strong>{formatBRL(amount)}</strong>
            </div>
          </div>
        )}
        <button className="btn btn-primary btn-block" type="submit">
          Confirmar pagamento
        </button>
      </form>
    </div>
  )
}
