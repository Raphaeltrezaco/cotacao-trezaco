import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSupabase, postSupabase } from './supabase'

const BADGE = {
  A: { bg: '#E6F1FB', color: '#0C447C' },
  B: { bg: '#FAEEDA', color: '#633806' },
  C: { bg: '#E1F5EE', color: '#085041' },
}

const EMAILS_VENDEDORES = [
  'daniela@trezaco.com.br',
  'aline@trezaco.com.br',
  'brenda@trezaco.com.br',
  'bruno@trezaco.com.br',
  'gil@trezaco.com.br',
  'junior@treza.com.br',
  'kamila@trezaco.com.br',
  'kauana@trezaco.com.br',
  'leila@trezaco.com.br',
  'leonardo@trezaco.com.br',
  'marcelo@trezaco.com.br',
  'nayara@trezaco.com.br',
  'sirlene@trezaco.com.br',
  'vinicius@trezaco.com.br',
  'thalita@trezaco.com.br',
  'hadassa@trezaco.com.br',
  'compras@trezaco.com.br',
  'raphael@trezaco.com.br',
  'brandao@trezaco.com.br',
  'benildo@trezaco.com.br',
]

function LoginVendedor({ onLogin }) {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const emailNorm = email.trim().toLowerCase()
    if (!EMAILS_VENDEDORES.includes(emailNorm)) {
      setErro('E-mail não autorizado.')
      return
    }
    // Busca o usuário no banco
    const data = await fetchSupabase('usuarios', `?email=eq.${emailNorm}&select=*`)
    if (Array.isArray(data) && data.length > 0) {
      sessionStorage.setItem('vendedor_usuario', JSON.stringify(data[0]))
      onLogin(data[0])
    } else {
      setErro('Usuário não encontrado. Contate o administrador.')
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f8f6' }}>
      <div style={{ background:'#fff', borderRadius:16, border:'0.5px solid rgba(0,0,0,0.1)', padding:'2.5rem', width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, borderRadius:10, background:'#1D9E75', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 }}>T</div>
          <div><div style={{ fontSize:18, fontWeight:600 }}>Trezaço</div><div style={{ fontSize:12, color:'#888780' }}>Portal do Vendedor</div></div>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:13, fontWeight:500, color:'#444441' }}>E-mail</label>
            <input style={{ padding:'10px 12px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:14, outline:'none' }}
              type="email" value={email} onChange={e => { setEmail(e.target.value); setErro('') }}
              placeholder="seu@trezaco.com.br" required />
          </div>
          {erro && <div style={{ background:'#FCEBEB', color:'#A32D2D', padding:'10px 12px', borderRadius:8, fontSize:13 }}>{erro}</div>}
          <button style={{ background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:15, fontWeight:500, cursor:'pointer' }} type="submit">Entrar</button>
        </form>
      </div>
    </div>
  )
}

function minutosUteis(inicio, fim) {
  if (!inicio || !fim) return null
  const start = new Date(inicio), end = new Date(fim)
  let mins = 0, cur = new Date(start)
  while (cur < end) {
    const h = cur.getHours(), d = cur.getDay()
    if (d !== 0 && d !== 6 && h >= 8 && h < 18) mins++
    cur = new Date(cur.getTime() + 60000)
    if (mins > 14400) break
  }
  return mins
}

function formatarLeadTimeV(min) {
  if (min === null || min === undefined) return '—'
  if (min < 60) return `${min}min`
  if (min < 480) return `${Math.round(min/60*10)/10}h`
  return `${Math.round(min/480*10)/10}d`
}

export default function Vendedor() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('vendedor_usuario')) } catch { return null }
  })
  const [tab, setTab] = useState('novo')
  const [pedidos, setPedidos] = useState([])
  const [leadtimesVend, setLeadtimesVend] = useState({})
  const [verTodos, setVerTodos] = useState(false)
  const [numeroCotacao, setNumeroCotacao] = useState('')
  const [itensCarrinho, setItensCarrinho] = useState([])
  const [form, setForm] = useState({ item_codigo: '', item_descricao: '', classe: '', quantidade: '', unidade: 'kg', filial: 'Curitiba', prazo_necessario: '', observacoes: '' })
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [fornecedores, setFornecedores] = useState([])
  const [pedidoAberto, setPedidoAberto] = useState(null)
  const [respostasPedido, setRespostasPedido] = useState([])
  const [editando, setEditando] = useState(false)
  const [formEdicao, setFormEdicao] = useState({})
  const [logEdicao, setLogEdicao] = useState([])
  const [showLog, setShowLog] = useState(false)
  const [buscaPedidos, setBuscaPedidos] = useState('')
  const [filtroPedidos, setFiltroPedidos] = useState('todos')
  const [filtroDestino, setFiltroDestino] = useState('todos')
  const [filtroClassePedidos, setFiltroClassePedidos] = useState('todos')
  const [precosPedidos, setPrecosPedidos] = useState({})

  useEffect(() => { if (usuario) carregarPedidos() }, [verTodos, usuario?.id])

  if (!usuario) return <LoginVendedor onLogin={u => setUsuario(u)} />

  async function carregarPedidos() {
    const filtroUrl = verTodos
      ? '?order=criado_em.desc'
      : `?vendedor_id=eq.${usuario.id}&order=criado_em.desc`
    const data = await fetchSupabase('pedidos_cotacao', filtroUrl + '&select=*,usuarios!pedidos_cotacao_vendedor_id_fkey(nome)')
    const lista = Array.isArray(data) ? data : []
    setPedidos(lista)
    const precos = {}
    for (const p of lista.filter(p => p.status === 'respostas_recebidas')) {
      const resps = await fetchSupabase('respostas_cotacao', `?pedido_id=eq.${p.id}&order=preco_unitario.asc&limit=1&select=*,fornecedores(nome)`)
      if (Array.isArray(resps) && resps.length > 0) {
        precos[p.id] = { preco: resps[0].preco_unitario, prazo: resps[0].prazo_entrega_dias, fornecedor: resps[0].fornecedores?.nome }
      }
    }
    setPrecosPedidos(precos)
    // Calcular leadtime de cada pedido
    const ltMap = {}
    for (const p of lista) {
      if (p.status !== 'aberto') {
        const resps = await fetchSupabase('respostas_cotacao', `?pedido_id=eq.${p.id}&order=criado_em.asc&limit=1`)
        if (Array.isArray(resps) && resps.length > 0) ltMap[p.id] = minutosUteis(p.criado_em, resps[0].criado_em)
      } else {
        ltMap[p.id] = minutosUteis(p.criado_em, new Date().toISOString())
      }
    }
    setLeadtimesVend(ltMap)
  }

  async function abrirPedido(pedido) {
    setPedidoAberto(pedido)
    setEditando(false)
    setFormEdicao({})
    setShowLog(false)
    const data = await fetchSupabase('respostas_cotacao', `?pedido_id=eq.${pedido.id}&order=preco_unitario.asc&select=*,fornecedores(nome)`)
    setRespostasPedido(Array.isArray(data) ? data : [])
    const log = await fetchSupabase('pedidos_cotacao_log', `?pedido_id=eq.${pedido.id}&order=editado_em.desc`)
    setLogEdicao(Array.isArray(log) ? log : [])
  }

  async function salvarEdicao() {
    const campos = ['item_descricao', 'classe', 'quantidade', 'unidade', 'filial', 'prazo_necessario', 'observacoes']
    const alteracoes = []
    for (const campo of campos) {
      const anterior = String(pedidoAberto[campo] ?? '')
      const novo = String(formEdicao[campo] ?? '')
      if (anterior !== novo) alteracoes.push({ campo, valor_anterior: anterior, valor_novo: novo })
    }
    if (alteracoes.length === 0) { setEditando(false); return }

    // Salvar edição no pedido
    const { URL, KEY } = { URL: 'https://cilbkzvuvwjeqtdpxcbs.supabase.co', KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbGJrenZ1dndqZXF0ZHB4Y2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQwNTAsImV4cCI6MjA5MzE1MDA1MH0._bn3Je-gsu4Edc8SKr-fQBVW5dxCOIKn_zxqT61wq2M' }
    const patch = {}
    for (const a of alteracoes) patch[a.campo] = formEdicao[a.campo]

    await fetch(`${URL}/rest/v1/pedidos_cotacao?id=eq.${pedidoAberto.id}`, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    })

    // Salvar log
    for (const a of alteracoes) {
      await fetch(`${URL}/rest/v1/pedidos_cotacao_log`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoAberto.id, editado_por: usuario.nome || usuario.email, campo: a.campo, valor_anterior: a.valor_anterior, valor_novo: a.valor_novo })
      })
    }

    const atualizado = { ...pedidoAberto, ...patch }
    setPedidoAberto(atualizado)
    setEditando(false)
    const log = await fetchSupabase('pedidos_cotacao_log', `?pedido_id=eq.${pedidoAberto.id}&order=editado_em.desc`)
    setLogEdicao(Array.isArray(log) ? log : [])
    carregarPedidos()
  }

  async function buscarItem(codigo) {
    if (!codigo || codigo.length < 3) return
    setBuscando(true)
    const data = await fetchSupabase('itens', `?codigo=eq.${codigo.trim()}&select=*`)
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0]
      setForm(f => ({ ...f, item_codigo: item.codigo, item_descricao: item.descricao, classe: item.classe, unidade: item.unidade || 'kg' }))
    } else {
      // Item não cadastrado — mantém o código e permite preencher descrição manualmente
      setForm(f => ({ ...f, item_codigo: codigo.trim() }))
    }
    setBuscando(false)
  }

  function adicionarAoCarrinho() {
    if (!form.item_descricao || !form.quantidade) { alert('Preencha o item e a quantidade'); return }
    setItensCarrinho(prev => [...prev, { ...form, id: Date.now() }])
    setForm({ item_codigo: '', item_descricao: '', classe: '', quantidade: '', unidade: 'kg', filial: form.filial, prazo_necessario: '', observacoes: '' })
  }

  function removerDoCarrinho(id) {
    setItensCarrinho(prev => prev.filter(i => i.id !== id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const todosItens = itensCarrinho.length > 0 
      ? [...itensCarrinho, ...(form.item_descricao && form.quantidade ? [form] : [])]
      : [form]
    if (todosItens.length === 0 || !todosItens[0].item_descricao) { alert('Adicione pelo menos um item'); return }
    if (!todosItens[0].classe) { alert('Busque o item primeiro'); return }
    setEnviando(true)
    setResultado(null)
    let ultimoPedido = null
    for (const item of todosItens) {
      const payload = {
        numero_cotacao: numeroCotacao || null,
        item_codigo: item.item_codigo,
        item_descricao: item.item_descricao,
        classe: item.classe,
        quantidade: parseFloat(item.quantidade),
        unidade: item.unidade,
        filial: item.filial,
        prazo_necessario: parseInt(item.prazo_necessario) || null,
        observacoes: item.observacoes,
        vendedor_id: usuario.id,
      }
      const data = await postSupabase('pedidos_cotacao', payload)
      if (Array.isArray(data) && data.length > 0) ultimoPedido = data[0]
    }
    if (ultimoPedido) {
      if (ultimoPedido.destino === 'vendedor') {
        const forn = await fetchSupabase('item_fornecedor', `?item_codigo=eq.${todosItens[0].item_codigo}&select=*,fornecedores(*)`)
        setFornecedores(Array.isArray(forn) ? forn.map(f => f.fornecedores).filter(Boolean) : [])
      }
      setResultado(ultimoPedido)
      setItensCarrinho([])
      carregarPedidos()
    } else {
      alert('Erro ao salvar pedido')
    }
    setEnviando(false)
  }



  function gerarWhatsApp(fornecedor) {
    const msg = encodeURIComponent(
      `Olá, ${fornecedor.contato || fornecedor.nome}! 👋\n\n` +
      `Cotação — *${resultado.item_descricao}*\n` +
      `📐 Qtd: ${resultado.quantidade} ${resultado.unidade}\n` +
      `🏭 Entrega: ${resultado.filial}\n` +
      `📅 Prazo: ${resultado.prazo_necessario || '—'} dias\n\n` +
      `Por favor, informe preço unitário e prazo de entrega.\n\nObrigado!`
    )
    window.open(`https://wa.me/${fornecedor.whatsapp}?text=${msg}`, '_blank')
  }

  function novoForm() {
    setNumeroCotacao('')
    setItensCarrinho([])
    setForm({ item_codigo: '', item_descricao: '', classe: '', quantidade: '', unidade: 'kg', filial: 'Curitiba', prazo_necessario: '', observacoes: '' })
    setResultado(null)
    setFornecedores([])
  }

  // Agrupa pedidos por numero_cotacao (Item 1)
  const pedidosAgrupados = useMemo(() => {
    const filtrados = pedidos.filter(p => {
      if (filtroPedidos === 'aberto' && p.status !== 'aberto') return false
      if (filtroPedidos === 'respostas_recebidas' && p.status !== 'respostas_recebidas') return false
      if (filtroDestino !== 'todos' && p.destino !== filtroDestino) return false
      if (filtroClassePedidos !== 'todos' && p.classe !== filtroClassePedidos) return false
      if (buscaPedidos) {
        const b = buscaPedidos.toLowerCase()
        if (!p.item_descricao?.toLowerCase().includes(b) &&
            !p.item_codigo?.includes(buscaPedidos) &&
            !String(p.numero_pedido??'').includes(b.replace('#','')) &&
            !String(p.numero_cotacao??'').includes(b.replace('#',''))) return false
      }
      return true
    })
    // Agrupar por numero_cotacao
    const grupos = []
    const vistos = new Set()
    for (const p of filtrados) {
      if (p.numero_cotacao) {
        if (!vistos.has(p.numero_cotacao)) {
          vistos.add(p.numero_cotacao)
          const itens = filtrados.filter(x => x.numero_cotacao === p.numero_cotacao)
          grupos.push({ tipo: 'grupo', numero_cotacao: p.numero_cotacao, itens, id: 'g_' + p.numero_cotacao })
        }
      } else {
        grupos.push({ tipo: 'pedido', ...p, itens: [p] })
      }
    }
    return grupos
  }, [pedidos, filtroPedidos, filtroDestino, filtroClassePedidos, buscaPedidos])

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroPedidos === 'aberto' && p.status !== 'aberto') return false
    if (filtroPedidos === 'respostas_recebidas' && p.status !== 'respostas_recebidas') return false
    if (filtroDestino !== 'todos' && p.destino !== filtroDestino) return false
    if (filtroClassePedidos !== 'todos' && p.classe !== filtroClassePedidos) return false
    if (buscaPedidos && !p.item_descricao?.toLowerCase().includes(buscaPedidos.toLowerCase()) && !p.item_codigo?.includes(buscaPedidos)) return false
    return true
  })

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logo}>T</div>
          <div>
            <div style={s.logoTitle}>Trezaço</div>
            <div style={s.logoSub}>Vendedor — {usuario.nome}</div>
          </div>
        </div>
        <button style={s.btnLink} onClick={() => { sessionStorage.removeItem('vendedor_usuario'); setUsuario(null) }}>Sair</button>
      </header>

      <div style={s.tabs}>
        <button style={tab === 'novo' ? s.tabActive : s.tab} onClick={() => { setTab('novo'); novoForm() }}>Nova cotação</button>
        <button style={tab === 'pedidos' ? s.tabActive : s.tab} onClick={() => setTab('pedidos')}>
          {verTodos ? 'Todos os pedidos' : 'Meus pedidos'} ({pedidos.length})
        </button>
        {tab === 'pedidos' && !pedidoAberto && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, paddingRight:24 }}>
            <span style={{ fontSize:13, color:'#888780' }}>Ver:</span>
            <button onClick={() => setVerTodos(false)} style={{ padding:'5px 12px', background: !verTodos ? '#1D9E75' : '#fff', border: !verTodos ? '0.5px solid #1D9E75' : '0.5px solid rgba(0,0,0,0.15)', borderRadius:20, fontSize:12, cursor:'pointer', color: !verTodos ? '#fff' : '#5F5E5A', fontWeight: !verTodos ? 500 : 400 }}>
              Meus pedidos
            </button>
            <button onClick={() => setVerTodos(true)} style={{ padding:'5px 12px', background: verTodos ? '#1D9E75' : '#fff', border: verTodos ? '0.5px solid #1D9E75' : '0.5px solid rgba(0,0,0,0.15)', borderRadius:20, fontSize:12, cursor:'pointer', color: verTodos ? '#fff' : '#5F5E5A', fontWeight: verTodos ? 500 : 400 }}>
              Todos
            </button>
          </div>
        )}
      </div>

      <div style={{ ...s.content, maxWidth: tab === 'pedidos' ? '100%' : 640 }}>
        {tab === 'novo' && !resultado && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>Novo pedido de cotação</h2>
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Número do Orçamento <span style={{ color:'#888780', fontWeight:400 }}>(opcional — para agrupar itens)</span></label>
                <input style={s.input} value={numeroCotacao}
                  onChange={e => setNumeroCotacao(e.target.value)}
                  placeholder="ex: 172580" />
              </div>

              {/* Lista de itens já adicionados */}
              {itensCarrinho.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#888780', textTransform:'uppercase', marginBottom:6 }}>Itens adicionados ({itensCarrinho.length})</div>
                  {itensCarrinho.map(item => (
                    <div key={item.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#E1F5EE', borderRadius:8, marginBottom:6 }}>
                      <span style={{ ...s.badge, ...BADGE[item.classe] }}>Classe {item.classe}</span>
                      <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{item.item_descricao}</span>
                      <span style={{ fontSize:12, color:'#5F5E5A' }}>{item.quantidade} {item.unidade}</span>
                      <button type="button" onClick={() => removerDoCarrinho(item.id)}
                        style={{ background:'none', border:'none', color:'#E24B4A', cursor:'pointer', fontSize:16, padding:'0 4px' }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={s.field}>
                <label style={s.label}>Código do item</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...s.input, flex: 1 }} value={form.item_codigo}
                    onChange={e => setForm(f => ({ ...f, item_codigo: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscarItem(form.item_codigo))}
                    placeholder="ex: 01010004" />
                  <button type="button" style={s.btnSec} onClick={() => buscarItem(form.item_codigo)} disabled={buscando}>
                    {buscando ? '...' : 'Buscar'}
                  </button>
                </div>
              </div>

              {form.item_descricao && (
                <div style={s.itemBox}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...s.badge, ...BADGE[form.classe] }}>Classe {form.classe}</span>
                    <span style={{ fontWeight: 500 }}>{form.item_descricao}</span>
                  </div>
                </div>
              )}

              {form.item_codigo && !form.item_descricao && (
                <div style={{ marginBottom: 12, padding: '10px 14px', background: '#FEF3C7', border: '0.5px solid #F59E0B', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#633806', marginBottom: 6 }}>⚠ Item não encontrado no cadastro — preencha a descrição manualmente:</div>
                  <div style={s.row}>
                    <div style={{ ...s.field, flex: 2 }}>
                      <label style={s.label}>Descrição do item</label>
                      <input style={s.input} value={form.item_descricao}
                        onChange={e => setForm(f => ({ ...f, item_descricao: e.target.value }))}
                        placeholder="Ex: PERFIL I A572 GR50 W610 x 113,0 x 6MTS" required />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Classe</label>
                      <select style={s.input} value={form.classe}
                        onChange={e => setForm(f => ({ ...f, classe: e.target.value }))}>
                        <option value="">Selecione</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Quantidade</label>
                  <input style={s.input} type="number" value={form.quantidade}
                    onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Unidade</label>
                  <select style={s.input} value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}>
                    <option>kg</option><option>ton</option><option>pçs</option><option>brs</option><option>m</option>
                  </select>
                </div>
              </div>

              <div style={s.field}>
                  <label style={s.label}>Filial</label>
                  <select style={s.input} value={form.filial} onChange={e => setForm(f => ({ ...f, filial: e.target.value }))}>
                    <option>Curitiba</option><option>Cascavel</option>
                  </select>
                </div>

              <div style={s.field}>
                <label style={s.label}>Observações</label>
                <textarea style={{ ...s.input, height: 72, resize: 'vertical' }} value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Especificações adicionais..." />
              </div>

              <div style={{ display:'flex', gap:8 }}>
                {/* Botão adicionar mais um item */}
                <button type="button"
                  onClick={adicionarAoCarrinho}
                  disabled={!form.item_descricao || !form.quantidade}
                  style={{ ...s.btnSec, flex:1, opacity: (!form.item_descricao || !form.quantidade) ? 0.5 : 1 }}>
                  + Adicionar outro item
                </button>
                {/* Botão enviar tudo */}
                <button style={{ ...s.btnPrimary, flex:1 }} type="submit"
                  disabled={enviando || (!form.item_descricao && itensCarrinho.length === 0) || (!form.quantidade && itensCarrinho.length === 0)}>
                  {enviando ? 'Enviando...' : itensCarrinho.length > 0 ? `Abrir cotação (${itensCarrinho.length + (form.item_descricao ? 1 : 0)} itens)` : 'Abrir pedido'}
                </button>
              </div>
            </form>
          </div>
        )}

        {tab === 'novo' && resultado && (
          <div style={s.card}>
            {resultado.destino === 'comprador' ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={s.iconOk}>✓</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Pedido enviado ao comprador</h3>
                <p style={{ color: '#5F5E5A', fontSize: 14, marginBottom: 16 }}>{resultado.motivo_roteamento}</p>
                <div style={s.itemBox}>
                  <strong>{resultado.item_descricao}</strong>
                  <span style={{ color: '#888780', fontSize: 13 }}>{resultado.quantidade} {resultado.unidade} — {resultado.filial}</span>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FAEEDA', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ ...s.iconOk, background: '#FAEEDA', color: '#633806', margin: 0, width: 32, height: 32, fontSize: 16 }}>!</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Você deve cotar diretamente</div>
                    <div style={{ fontSize: 13, color: '#633806' }}>{resultado.motivo_roteamento}</div>
                  </div>
                </div>
                {fornecedores.length > 0 ? (
                  <div>
                    <p style={{ fontSize: 13, color: '#5F5E5A', marginBottom: 10, fontWeight: 500 }}>Envie via WhatsApp:</p>
                    {fornecedores.map(f => (
                      <div key={f.id} style={s.fornCard}>
                        <span style={{ fontWeight: 500 }}>{f.nome}</span>
                        <button style={s.wppBtn} onClick={() => gerarWhatsApp(f)}>WhatsApp ↗</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: '#F1EFE8', padding: 12, borderRadius: 8, fontSize: 13, color: '#5F5E5A' }}>
                    Nenhum fornecedor cadastrado para este item ainda.
                  </div>
                )}
              </div>
            )}
            <button style={{ ...s.btnSec, marginTop: 20, width: '100%' }} onClick={novoForm}>Novo pedido</button>
          </div>
        )}

        {tab === 'pedidos' && !pedidoAberto && (
          <div style={{ display:'flex', minHeight:'calc(100vh - 100px)', margin:'0 -24px' }}>
            {/* Sidebar filtros */}
            <aside style={{ width:200, flexShrink:0, background:'#fff', borderRight:'0.5px solid rgba(0,0,0,0.08)', padding:'20px 16px', position:'sticky', top:100, height:'calc(100vh - 100px)', overflowY:'auto' }}>

              <div style={{ fontSize:10, fontWeight:700, color:'#888780', letterSpacing:'0.08em', marginBottom:8, textTransform:'uppercase' }}>STATUS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:20 }}>
                {[['todos','Todos',null],['aberto','Aguardando',pedidos.filter(p=>p.status==='aberto').length],['respostas_recebidas','● Respondido',pedidos.filter(p=>p.status==='respostas_recebidas').length]].map(([f,label,count]) => (
                  <button key={f} onClick={() => setFiltroPedidos(f)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background: filtroPedidos===f ? '#E1F5EE' : 'transparent', border: filtroPedidos===f ? '0.5px solid #1D9E75' : '0.5px solid transparent', borderRadius:8, fontSize:13, cursor:'pointer', color: filtroPedidos===f ? '#085041' : '#444441', fontWeight: filtroPedidos===f ? 600 : 400, textAlign:'left' }}>
                    <span>{label}</span>
                    {count !== null && <span style={{ fontSize:11, background: filtroPedidos===f ? '#1D9E75' : '#F1EFE8', color: filtroPedidos===f ? '#fff' : '#888780', padding:'1px 6px', borderRadius:10 }}>{count}</span>}
                  </button>
                ))}
              </div>

              <div style={{ fontSize:10, fontWeight:700, color:'#888780', letterSpacing:'0.08em', marginBottom:8, textTransform:'uppercase' }}>DESTINO</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:20 }}>
                {[['todos','Todos'],['comprador','Comprador'],['vendedor','Vendedor']].map(([f,label]) => (
                  <button key={f} onClick={() => setFiltroDestino(f)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background: filtroDestino===f ? '#E1F5EE' : 'transparent', border: filtroDestino===f ? '0.5px solid #1D9E75' : '0.5px solid transparent', borderRadius:8, fontSize:13, cursor:'pointer', color: filtroDestino===f ? '#085041' : '#444441', fontWeight: filtroDestino===f ? 600 : 400, textAlign:'left' }}>
                    <span>{label}</span>
                    {f !== 'todos' && <span style={{ fontSize:11, background:'#F1EFE8', color:'#888780', padding:'1px 6px', borderRadius:10 }}>{pedidos.filter(p=>p.destino===f).length}</span>}
                  </button>
                ))}
              </div>

              <div style={{ fontSize:10, fontWeight:700, color:'#888780', letterSpacing:'0.08em', marginBottom:8, textTransform:'uppercase' }}>CLASSE</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:20 }}>
                {[['todos','Todas'],['A','Classe A'],['B','Classe B'],['C','Classe C']].map(([f,label]) => (
                  <button key={f} onClick={() => setFiltroClassePedidos(f)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background: filtroClassePedidos===f ? '#E1F5EE' : 'transparent', border: filtroClassePedidos===f ? '0.5px solid #1D9E75' : '0.5px solid transparent', borderRadius:8, fontSize:13, cursor:'pointer', color: filtroClassePedidos===f ? '#085041' : '#444441', fontWeight: filtroClassePedidos===f ? 600 : 400, textAlign:'left' }}>
                    <span>{label}</span>
                    {f !== 'todos' && <span style={{ fontSize:11, background: BADGE[f]?.bg||'#F1EFE8', color: BADGE[f]?.color||'#888780', padding:'1px 6px', borderRadius:10 }}>{pedidos.filter(p=>p.classe===f).length}</span>}
                  </button>
                ))}
              </div>

              {(filtroPedidos !== 'todos' || filtroDestino !== 'todos' || filtroClassePedidos !== 'todos' || buscaPedidos) && (
                <button onClick={() => { setFiltroPedidos('todos'); setFiltroDestino('todos'); setFiltroClassePedidos('todos'); setBuscaPedidos('') }}
                  style={{ width:'100%', padding:'8px', background:'none', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:12, cursor:'pointer', color:'#888780' }}>
                  ✕ Limpar filtros
                </button>
              )}
            </aside>

            {/* Lista principal */}
            <div style={{ flex:1, padding:'20px 24px', overflowY:'auto' }}>
              {/* Busca no topo */}
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16 }}>
                <input
                  style={{ flex:1, padding:'8px 14px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:20, fontSize:13, outline:'none' }}
                  placeholder="🔍 Buscar por nome ou código do item..."
                  value={buscaPedidos}
                  onChange={e => setBuscaPedidos(e.target.value)}
                />
                <span style={{ fontSize:13, color:'#888780', whiteSpace:'nowrap' }}>
                  {pedidosFiltrados.length} {pedidosFiltrados.length===1?'pedido':'pedidos'}{pedidosFiltrados.length !== pedidos.length ? ` de ${pedidos.length}` : ''}
                </span>
              </div>

              {pedidosAgrupados.length === 0
                ? <div style={s.empty}>Nenhum pedido encontrado.</div>
                : pedidosAgrupados.map(grupo => {
                    if (grupo.tipo === 'grupo') {
                      const temRespostas = grupo.itens.some(p => p.status === 'respostas_recebidas')
                      return (
                        <div key={grupo.id} style={{ background:'#fff', borderRadius:10, border:'1.5px solid #185FA5', padding:'1rem', marginBottom:8 }}>
                          <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                            <span style={{ ...s.badge, background:'#185FA5', color:'#fff' }}>ORC #{grupo.numero_cotacao}</span>
                            <span style={{ fontSize:12, color:'#888780' }}>{grupo.itens.length} itens</span>
                            {temRespostas && <span style={{ ...s.badge, background:'#FAEEDA', color:'#633806' }}>● Respondido</span>}
                          </div>
                          {grupo.itens.map(p => {
                            const melhorPreco = precosPedidos[p.id]
                            return (
                              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:'0.5px solid rgba(0,0,0,0.06)', cursor:'pointer' }} onClick={() => abrirPedido(p)}>
                                <div style={{ flex:1 }}>
                                  <div style={{ display:'flex', gap:4, marginBottom:3, flexWrap:'wrap' }}>
                                    {p.numero_pedido && <span style={{ ...s.badge, background:'#1D9E75', color:'#fff' }}>#{p.numero_pedido}</span>}
                                    <span style={{ ...s.badge, ...(BADGE[p.classe]||{}) }}>Classe {p.classe}</span>
                                    <span style={{ ...s.badge, background: p.destino==='comprador'?'#E6F1FB':'#FAEEDA', color: p.destino==='comprador'?'#0C447C':'#633806' }}>{p.destino==='comprador'?'Comprador':'Vendedor'}</span>
                                  </div>
                                  <div style={{ fontWeight:500, fontSize:14 }}>{p.item_descricao}</div>
                                  <div style={{ fontSize:11, color:'#888780' }}>{p.quantidade} {p.unidade} · {p.filial}</div>
                                </div>
                                {melhorPreco && <div style={{ textAlign:'right', flexShrink:0 }}><div style={{ fontSize:15, fontWeight:700, color:'#1D9E75' }}>R$ {parseFloat(melhorPreco.preco).toFixed(2)}</div></div>}
                                <div style={{ fontSize:16, color:'#888780' }}>›</div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }
                    const p = grupo
                    const melhorPreco = precosPedidos[p.id]
                    return (
                      <div key={p.id} style={{ background:'#fff', borderRadius:10, border: p.status==='respostas_recebidas' ? '1.5px solid #EF9F27' : '0.5px solid rgba(0,0,0,0.1)', padding:'1rem', marginBottom:8, cursor:'pointer', display:'flex', alignItems:'center', gap:12 }} onClick={() => abrirPedido(p)}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                            {p.numero_pedido && <span style={{ ...s.badge, background:'#1D9E75', color:'#fff' }}>#{p.numero_pedido}</span>}
                            <span style={{ ...s.badge, ...(BADGE[p.classe]||{}) }}>Classe {p.classe}</span>
                            <span style={{ ...s.badge, background: p.destino==='comprador' ? '#E6F1FB' : '#FAEEDA', color: p.destino==='comprador' ? '#0C447C' : '#633806' }}>
                              {p.destino==='comprador' ? 'Comprador' : 'Vendedor'}
                            </span>
                            {p.status==='respostas_recebidas' && <span style={{ ...s.badge, background:'#FAEEDA', color:'#633806' }}>● Respondido</span>}
                          </div>
                          <div style={{ fontWeight:500, fontSize:15, marginBottom:3 }}>{p.item_descricao}</div>
                          <div style={{ fontSize:12, color:'#888780' }}>
                            {p.usuarios?.nome && <span style={{ fontWeight:500, color:'#444441' }}>{p.usuarios.nome} · </span>}
                            {p.quantidade} {p.unidade} · {p.filial} · {new Date(p.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                          </div>
                          {leadtimesVend[p.id] !== undefined && (
                            <div style={{ fontSize:11, marginTop:3 }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:5, background: p.status==='aberto' ? '#E6F1FB' : '#E1F5EE', color: p.status==='aberto' ? '#0C447C' : '#085041', fontWeight:500 }}>
                                ⏱ {formatarLeadTimeV(leadtimesVend[p.id])}
                              </span>
                            </div>
                          )}
                        </div>
                        {melhorPreco && (
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontSize:10, color:'#888780', marginBottom:2 }}>melhor preço</div>
                            {melhorPreco.fornecedor && <div style={{ fontSize:12, fontWeight:600, color:'#444441', marginBottom:2 }}>{melhorPreco.fornecedor}</div>}
                            <div style={{ fontSize:18, fontWeight:700, color:'#1D9E75' }}>R$ {parseFloat(melhorPreco.preco).toFixed(2)}<span style={{ fontSize:11, color:'#888780', fontWeight:400 }}>/kg</span></div>
                            {melhorPreco.prazo && <div style={{ fontSize:11, color:'#888780' }}>prazo: {melhorPreco.prazo} dias</div>}
                          </div>
                        )}
                        <div style={{ fontSize:18, color:'#888780' }}>›</div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}

        {tab === 'pedidos' && pedidoAberto && (
          <div>
            <button style={{ ...s.btnSec, marginBottom: 16 }} onClick={() => setPedidoAberto(null)}>← Voltar</button>
            <div style={s.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
                  <span style={{ ...s.badge, ...(BADGE[pedidoAberto.classe]||{}) }}>Classe {pedidoAberto.classe}</span>
                  <span style={{ fontWeight:600, fontSize:16 }}>{pedidoAberto.item_descricao}</span>
                </div>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  {logEdicao.length > 0 && (
                    <button title="Ver histórico de edições" onClick={() => setShowLog(!showLog)}
                      style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#185FA5' }}>ⓘ</button>
                  )}
                  {!editando
                    ? <button onClick={() => { setEditando(true); setFormEdicao({ item_descricao: pedidoAberto.item_descricao, classe: pedidoAberto.classe, quantidade: pedidoAberto.quantidade, unidade: pedidoAberto.unidade, filial: pedidoAberto.filial, prazo_necessario: pedidoAberto.prazo_necessario || '', observacoes: pedidoAberto.observacoes || '' }) }}
                        style={{ ...s.btnSec, fontSize:12, padding:'5px 12px' }}>✏️ Editar</button>
                    : <div style={{ display:'flex', gap:6 }}>
                        <button onClick={salvarEdicao} style={{ ...s.btnPrimary, fontSize:12, padding:'5px 12px' }}>Salvar</button>
                        <button onClick={() => setEditando(false)} style={{ ...s.btnSec, fontSize:12, padding:'5px 12px' }}>Cancelar</button>
                      </div>
                  }
                </div>
              </div>

              {showLog && logEdicao.length > 0 && (
                <div style={{ background:'#F1EFE8', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:12 }}>
                  <div style={{ fontWeight:600, marginBottom:6, color:'#444441' }}>Histórico de edições</div>
                  {logEdicao.map((l,i) => (
                    <div key={i} style={{ borderBottom:'0.5px solid rgba(0,0,0,0.08)', paddingBottom:4, marginBottom:4 }}>
                      <span style={{ color:'#888780' }}>{new Date(l.editado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · </span>
                      <span style={{ fontWeight:500 }}>{l.editado_por}</span>
                      <span style={{ color:'#888780' }}> alterou </span>
                      <span style={{ fontWeight:500 }}>{l.campo}</span>
                      <span style={{ color:'#888780' }}> de </span>
                      <span style={{ textDecoration:'line-through', color:'#E24B4A' }}>{l.valor_anterior || '—'}</span>
                      <span style={{ color:'#888780' }}> para </span>
                      <span style={{ color:'#1D9E75', fontWeight:500 }}>{l.valor_novo || '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              {!editando ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <div><div style={{ fontSize:11, color:'#888780', textTransform:'uppercase' }}>Vendedor</div><div style={{ fontWeight:500 }}>{pedidoAberto.usuarios?.nome || '—'}</div></div>
                  <div><div style={{ fontSize:11, color:'#888780', textTransform:'uppercase' }}>Filial</div><div style={{ fontWeight:500 }}>{pedidoAberto.filial}</div></div>
                  <div><div style={{ fontSize:11, color:'#888780', textTransform:'uppercase' }}>Quantidade</div><div style={{ fontWeight:500 }}>{pedidoAberto.quantidade} {pedidoAberto.unidade}</div></div>
                  <div><div style={{ fontSize:11, color:'#888780', textTransform:'uppercase' }}>Prazo necessário</div><div style={{ fontWeight:500 }}>{pedidoAberto.prazo_necessario || '—'} dias</div></div>
                  <div><div style={{ fontSize:11, color:'#888780', textTransform:'uppercase' }}>Status</div><div style={{ fontWeight:500 }}>{pedidoAberto.status==='aprovado' ? '✓ Aprovado' : pedidoAberto.status==='respostas_recebidas' ? 'Respondido' : 'Em aberto'}</div></div>
                  {pedidoAberto.observacoes && <div style={{ gridColumn:'1/-1' }}><div style={{ fontSize:11, color:'#888780', textTransform:'uppercase' }}>Observações</div><div style={{ fontWeight:500 }}>{pedidoAberto.observacoes}</div></div>}
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={s.label}>Descrição</label>
                    <input style={s.input} value={formEdicao.item_descricao||''} onChange={e => setFormEdicao(f=>({...f,item_descricao:e.target.value}))} />
                  </div>
                  <div>
                    <label style={s.label}>Classe</label>
                    <select style={s.input} value={formEdicao.classe||''} onChange={e => setFormEdicao(f=>({...f,classe:e.target.value}))}>
                      <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Filial</label>
                    <select style={s.input} value={formEdicao.filial||''} onChange={e => setFormEdicao(f=>({...f,filial:e.target.value}))}>
                      <option>Curitiba</option><option>Cascavel</option>
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>Quantidade</label>
                    <input style={s.input} type="number" value={formEdicao.quantidade||''} onChange={e => setFormEdicao(f=>({...f,quantidade:e.target.value}))} />
                  </div>
                  <div>
                    <label style={s.label}>Prazo (dias)</label>
                    <input style={s.input} type="number" value={formEdicao.prazo_necessario||''} onChange={e => setFormEdicao(f=>({...f,prazo_necessario:e.target.value}))} />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={s.label}>Observações</label>
                    <input style={s.input} value={formEdicao.observacoes||''} onChange={e => setFormEdicao(f=>({...f,observacoes:e.target.value}))} />
                  </div>
                </div>
              )}
            </div>

            {respostasPedido.length > 0 ? (
              <div style={s.card}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: '#444441' }}>
                  Respostas dos fornecedores
                </h3>
                {respostasPedido.map(r => (
                  <div key={r.id} style={{ ...s.pedidoCard, border: r.aprovada ? '1.5px solid #1D9E75' : '0.5px solid rgba(0,0,0,0.1)', background: r.aprovada ? '#f0fdf7' : '#fff', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {r.aprovada && <div style={{ display: 'inline-block', background: '#1D9E75', color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, marginBottom: 4 }}>✓ Aprovado pelo comprador</div>}
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{r.fornecedores?.nome || '—'}</div>
                        <div style={{ fontWeight: 500, fontSize: 15 }}>R$ {parseFloat(r.preco_unitario).toFixed(2)}/kg</div>
                        <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>
                          Prazo: {r.prazo_entrega_dias || '—'} dias
                          {r.observacoes && ` · ${r.observacoes}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: r.aprovada ? '#1D9E75' : '#1a1a18' }}>
                        R$ {(parseFloat(r.preco_unitario) * parseFloat(pedidoAberto.quantidade)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <div style={{ fontSize: 11, color: '#888780', fontWeight: 400, textAlign: 'right' }}>total</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ ...s.card, textAlign: 'center', color: '#888780', padding: '2rem' }}>
                {pedidoAberto.destino === 'comprador'
                  ? 'Aguardando o comprador lançar as respostas dos fornecedores.'
                  : 'Nenhuma resposta registrada ainda.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', background: '#f8f8f6' },
  header: { background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.1)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: { width: 36, height: 36, borderRadius: 8, background: '#1D9E75', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  logoTitle: { fontWeight: 600, fontSize: 15 },
  logoSub: { fontSize: 12, color: '#888780' },
  btnLink: { fontSize: 13, color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 },
  tabs: { display: 'flex', padding: '0 24px', borderBottom: '0.5px solid rgba(0,0,0,0.1)', background: '#fff' },
  tab: { padding: '12px 20px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 14, color: '#888780', cursor: 'pointer' },
  tabActive: { padding: '12px 20px', background: 'none', border: 'none', borderBottom: '2px solid #1D9E75', fontSize: 14, color: '#1D9E75', fontWeight: 500, cursor: 'pointer' },
  content: { maxWidth: 640, margin: '24px auto', padding: '0 24px' },
  card: { background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1.5rem' },
  cardTitle: { fontSize: 17, fontWeight: 600, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff' },
  btnPrimary: { background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 500, cursor: 'pointer' },
  btnSec: { background: '#fff', color: '#1a1a18', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 5, fontSize: 12, fontWeight: 500 },
  itemBox: { background: '#F1EFE8', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  iconOk: { width: 44, height: 44, borderRadius: '50%', background: '#E1F5EE', color: '#085041', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 12px' },
  fornCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, marginBottom: 8 },
  wppBtn: { background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  pedidoCard: { background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.1)', padding: '1rem', marginBottom: 10 },
  empty: { textAlign: 'center', padding: '3rem', color: '#888780' },
}
