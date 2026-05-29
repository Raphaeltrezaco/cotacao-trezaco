import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Vendedor from './Vendedor'
import Comprador from './Comprador'
import Admin from './Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/vendedor" element={<Vendedor />} />
        <Route path="/comprador" element={<Comprador />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/vendedor" />} />
      </Routes>
    </BrowserRouter>
  )
}