import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './lib/toast'
import { Home } from './pages/Home'
import { Pix } from './pages/Pix'
import { Cards } from './pages/Cards'
import { Transfer } from './pages/Transfer'
import { Statement } from './pages/Statement'
import { Profile } from './pages/Profile'
import { Pay } from './pages/Pay'
import { Deposit } from './pages/Deposit'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="pix" element={<Pix />} />
            <Route path="cartoes" element={<Cards />} />
            <Route path="transferir" element={<Transfer />} />
            <Route path="extrato" element={<Statement />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="pagar" element={<Pay />} />
            <Route path="depositar" element={<Deposit />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
