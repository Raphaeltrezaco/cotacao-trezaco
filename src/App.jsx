import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Vendedor from './Vendedor'
import Comprador from './Comprador'
import Admin from './Admin'
import DashboardCompras from './DashboardCompras'

// Procura o e-mail que o app já guardou no navegador. Como cada tela salva
// com uma chave diferente, varre tudo e pega o primeiro @trezaco que achar.
function emailSalvo() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const v = localStorage.getItem(localStorage.key(i)) || ''
      const m = v.match(/[\w.+-]+@[\w.-]*trezaco\.com\.br/i)
      if (m) return m[0].toLowerCase()
    }
  } catch (e) { /* modo privado bloqueia o localStorage */ }
  return ''
}

function RotaDashboard() {
  const [email, setEmail] = useState(emailSalvo)
  const [digitado, setDigitado] = useState('')

  if (email) return <DashboardCompras email={email} />

  return (
    <div style={{ padding: 32, fontFamily: 'Arial, sans-serif', maxWidth: 380 }}>
      <h2 style={{ fontSize: 17, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        Dashboard de compras
      </h2>
      <p style={{ fontSize: 13, color: '#3d454e' }}>Informe seu e-mail para entrar.</p>
      <input
        type="email"
        value={digitado}
        onChange={(e) => setDigitado(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') setEmail(digitado.trim().toLowerCase()) }}
        placeholder="compras@trezaco.com.br"
        style={{ width: '100%', padding: 10, border: '1px solid #c9ccd1', fontSize: 14 }}
      />
      <button
        onClick={() => setEmail(digitado.trim().toLowerCase())}
        style={{ width: '100%', marginTop: 10, padding: 12, border: 0,
                 background: '#2b3138', color: '#fff', fontSize: 14, cursor: 'pointer' }}
      >
        Entrar
      </button>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/vendedor" element={<Vendedor />} />
        <Route path="/comprador" element={<Comprador />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/compras" element={<RotaDashboard />} />
        <Route path="*" element={<Navigate to="/vendedor" />} />
      </Routes>
    </BrowserRouter>
  )
}