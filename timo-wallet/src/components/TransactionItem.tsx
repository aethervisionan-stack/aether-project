import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Gift,
  Landmark,
  Receipt,
  Wallet,
} from 'lucide-react'
import type { Transaction } from '../data/mock'
import { formatBRL } from '../data/mock'

const icons = {
  pix_in: ArrowDownLeft,
  pix_out: ArrowUpRight,
  ted: Landmark,
  card: CreditCard,
  salary: Wallet,
  boleto: Receipt,
  cashback: Gift,
  fee: Receipt,
}

export function TransactionItem({ tx }: { tx: Transaction }) {
  const Icon = icons[tx.type]
  const incoming = tx.amount > 0
  const zero = tx.amount === 0

  return (
    <div className="tx-item">
      <div className={`tx-icon ${incoming ? 'in' : 'out'}`}>
        <Icon size={18} />
      </div>
      <div className="tx-body">
        <strong>{tx.title}</strong>
        <span>
          {tx.subtitle} · {tx.time}
        </span>
      </div>
      <div className={`tx-amount ${incoming ? 'pos' : 'neg'}`}>
        {zero ? formatBRL(0) : `${incoming ? '+' : ''}${formatBRL(tx.amount)}`}
      </div>
    </div>
  )
}
