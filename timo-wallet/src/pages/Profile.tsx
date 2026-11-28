import {
  Bell,
  ChevronRight,
  HelpCircle,
  LogOut,
  Shield,
  Smartphone,
  UserRound,
} from 'lucide-react'
import { pixKeys, user } from '../data/mock'
import { useToast } from '../lib/toast'

const menu = [
  { icon: UserRound, label: 'Dados pessoais', hint: 'Nome, CPF, endereço' },
  { icon: Shield, label: 'Segurança', hint: 'Senha, biometria, dispositivos' },
  { icon: Bell, label: 'Notificações', hint: 'Push, e-mail e SMS' },
  { icon: Smartphone, label: 'Limites PIX', hint: 'Diurno e noturno' },
  { icon: HelpCircle, label: 'Ajuda', hint: 'Central Timó' },
]

export function Profile() {
  const { show } = useToast()
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Conta Timó
          </p>
          <h2>Perfil</h2>
        </div>
      </header>

      <div className="profile-hero">
        <div className="avatar">{initials}</div>
        <div>
          <strong style={{ fontSize: '1.1rem' }}>{user.name}</strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
            Cliente desde {user.memberSince}
          </p>
          <span className="badge" style={{ marginTop: 8 }}>
            Conta verificada
          </span>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="dim">Agência</span>
          <strong>{user.agency}</strong>
        </div>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="dim">Conta</span>
          <strong>{user.account}</strong>
        </div>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="dim">Instituição</span>
          <strong style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            {user.bank} ({user.bankCode})
          </strong>
        </div>
        <div className="row-between">
          <span className="dim">CPF</span>
          <strong>{user.cpf}</strong>
        </div>
      </div>

      <div className="section-title">
        <h3>Chaves PIX</h3>
      </div>
      <div className="stack-gap" style={{ marginBottom: 18 }}>
        {pixKeys.slice(0, 2).map((k) => (
          <div key={k.id} className="list-row">
            <div className="tx-body">
              <strong>{k.label}</strong>
              <span>{k.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="stack-gap">
        {menu.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              className="list-row"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => show(`${item.label} (demo)`)}
            >
              <div className="tx-icon">
                <Icon size={18} />
              </div>
              <div className="tx-body">
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>
          )
        })}
        <button
          className="btn btn-danger btn-block"
          onClick={() => show('Sessão encerrada (demo)')}
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>
    </div>
  )
}
