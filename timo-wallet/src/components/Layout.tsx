import { NavLink, Outlet } from 'react-router-dom'
import {
  ArrowLeftRight,
  CreditCard,
  Home,
  QrCode,
  UserRound,
  FileText,
} from 'lucide-react'

const links = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/pix', label: 'PIX', icon: QrCode },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/extrato', label: 'Extrato', icon: FileText },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
]

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div className="brand-mark">
          <div className="logo">T</div>
          <div>
            <h1>Timó</h1>
            <span>Conta digital</span>
          </div>
        </div>
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/transferir"
          className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
        >
          <ArrowLeftRight size={18} />
          Transferir
        </NavLink>
      </aside>

      <div className="main-pane">
        <Outlet />
      </div>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={20} strokeWidth={2.2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
