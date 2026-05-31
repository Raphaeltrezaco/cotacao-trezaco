import { useState, useEffect } from 'react'
import { fetchSupabase, postSupabase } from './supabase'

const URL = 'https://cilbkzvuvwjeqtdpxcbs.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbGJrenZ1dndqZXF0ZHB4Y2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQwNTAsImV4cCI6MjA5MzE1MDA1MH0._bn3Je-gsu4Edc8SKr-fQBVW5dxCOIKn_zxqT61wq2M'

const BADGE = { A: { bg:'#E6F1FB', color:'#0C447C' }, B: { bg:'#FAEEDA', color:'#633806' }, C: { bg:'#E1F5EE', color:'#085041' } }
const COMPRADOR_ID = 'deac539a-6a2f-416e-b05f-7b613059d2e9'
const EMAILS_AUTORIZADOS = [
  'compras@trezaco.com.br',
  'brandao@trezaco.com.br',
  'benildo@trezaco.com.br',
  'raphael@trezaco.com.br',
]

async function patchSupabase(tabela, filtro, body) {
  await fetch(`${URL}/rest/v1/${tabela}?${filtro}`, {
    method: 'PATCH',
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

// Calcula minutos úteis entre duas datas (seg-sex, 8h-18h)
function minutosUteis(inicio, fim) {
  if (!inicio || !fim) return null
  const start = new Date(inicio)
  const end = new Date(fim)
  if (end <= start) return 0
  let total = 0
  let current = new Date(start)
  while (current < end) {
    const dow = current.getDay()
    if (dow === 0 || dow === 6) {
      current.setDate(current.getDate() + (dow === 6 ? 2 : 1))
      current.setHours(8, 0, 0, 0)
      continue
    }
    const dayStart = new Date(current); dayStart.setHours(8, 0, 0, 0)
    const dayEnd = new Date(current); dayEnd.setHours(18, 0, 0, 0)
    if (current < dayStart) { current = dayStart; continue }
    if (current >= dayEnd) {
      current.setDate(current.getDate() + 1)
      current.setHours(8, 0, 0, 0)
      continue
    }
    const segEnd = new Date(Math.min(end, dayEnd))
    total += (segEnd - current) / 60000
    current.setDate(current.getDate() + 1)
    current.setHours(8, 0, 0, 0)
  }
  return Math.round(total)
}

function formatarLeadTime(min) {
  if (min === null || min === undefined) return '—'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function LoginComprador({ onLogin }) {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  function handleSubmit(e) {
    e.preventDefault()
    if (EMAILS_AUTORIZADOS.includes(email.trim().toLowerCase())) {
      sessionStorage.setItem('comprador_email', email.trim().toLowerCase())
      onLogin(email.trim().toLowerCase())
    } else {
      setErro('E-mail não autorizado para acessar o painel de compras.')
    }
  }
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f8f6' }}>
      <div style={{ background:'#fff', borderRadius:16, border:'0.5px solid rgba(0,0,0,0.1)', padding:'2.5rem', width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, borderRadius:10, background:'#1D9E75', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 }}>T</div>
          <div><div style={{ fontSize:18, fontWeight:600 }}>Trezaço</div><div style={{ fontSize:12, color:'#888780' }}>Painel de Compras</div></div>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:13, fontWeight:500, color:'#444441' }}>E-mail</label>
            <input style={{ padding:'10px 12px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:14, outline:'none' }}
              type="email" value={email} onChange={e => { setEmail(e.target.value); setErro('') }} placeholder="seu@trezaco.com.br" required />
          </div>
          {erro && <div style={{ background:'#FCEBEB', color:'#A32D2D', padding:'10px 12px', borderRadius:8, fontSize:13 }}>{erro}</div>}
          <button style={{ background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:15, fontWeight:500, cursor:'pointer' }} type="submit">Entrar</button>
        </form>
      </div>
    </div>
  )
}

function PedidoCard({ p, onClick, leadtime }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', marginBottom:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
          <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:5, fontSize:12, fontWeight:500, ...(BADGE[p.classe]||{}) }}>Classe {p.classe}</span>
          {p.numero_pedido && <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:5, fontSize:12, fontWeight:600, background:'#1D9E75', color:'#fff' }}>#{p.numero_pedido}</span>}
          {p.numero_cotacao && <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:5, fontSize:12, fontWeight:500, background:'#F1EFE8', color:'#444441' }}>ORC #{p.numero_cotacao}</span>}
          {leadtime !== null && leadtime !== undefined && (
            <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:5, fontSize:12, fontWeight:500, background:'#E6F1FB', color:'#0C447C' }}>⏱ {formatarLeadTime(leadtime)}</span>
          )}
        </div>
        <div style={{ fontWeight:500, fontSize:15, marginBottom:3 }}>{p.item_descricao}</div>
        <div style={{ fontSize:12, color:'#888780' }}>{p.quantidade} {p.unidade} · {p.filial} · {new Date(p.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <div style={{ fontSize:18, color:'#888780' }}>›</div>
    </div>
  )
}

export default function Comprador() {
  const [emailLogado, setEmailLogado] = useState(() => sessionStorage.getItem('comprador_email') || null)
  const [pedidos, setPedidos] = useState([])
  const [leadtimes, setLeadtimes] = useState({})
  const [selecionado, setSelecionado] = useState(null)
  const [respostas, setRespostas] = useState([])
  const [historico, setHistorico] = useState([])
  const [sugestoes, setSugestoes] = useState([])
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false)
  const [fornecedoresMap, setFornecedoresMap] = useState({})
  const [novaResposta, setNovaResposta] = useState({ fornecedor_nome:'', preco_unitario:'', prazo_entrega_dias:'', observacoes:'' })
  const [salvando, setSalvando] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroClasse, setFiltroClasse] = useState('todas')

  useEffect(() => { if (emailLogado) carregarPedidos() }, [emailLogado])

  if (!emailLogado) return <LoginComprador onLogin={setEmailLogado} />

  async function carregarPedidos() {
    const data = await fetchSupabase('pedidos_cotacao', '?destino=eq.comprador&order=criado_em.desc')
    const pedidosList = Array.isArray(data) ? data : []
    setPedidos(pedidosList)
    const ltMap = {}
    for (const p of pedidosList.filter(p => p.status !== 'aberto')) {
      const resps = await fetchSupabase('respostas_cotacao', `?pedido_id=eq.${p.id}&order=criado_em.asc&limit=1`)
      if (Array.isArray(resps) && resps.length > 0) {
        ltMap[p.id] = minutosUteis(p.criado_em, resps[0].criado_em)
      }
    }
    setLeadtimes(ltMap)
  }

  async function abrirPedido(pedido) {
    setSelecionado(pedido)
    setHistorico([])
    setSugestoes([])

    const data = await fetchSupabase('respostas_cotacao', `?pedido_id=eq.${pedido.id}&order=preco_unitario.asc`)
    const resps = Array.isArray(data) ? data : []
    setRespostas(resps)

    // Busca nomes dos fornecedores
    const ids = [...new Set(resps.map(r => r.fornecedor_id).filter(Boolean))]
    const mapa = {}
    for (const id of ids) {
      const f = await fetchSupabase('fornecedores', `?id=eq.${id}&select=id,nome`)
      if (Array.isArray(f) && f.length > 0) mapa[id] = f[0].nome
    }
    setFornecedoresMap(mapa)

    // Busca sugestões de estoque + preço dos fornecedores
    buscarSugestoesFornecedor(pedido)

    // Busca histórico de cotações anteriores para o mesmo item (outros pedidos)
    if (pedido.item_codigo) {
      const pedidosAnteriores = await fetchSupabase('pedidos_cotacao',
        `?item_codigo=eq.${pedido.item_codigo}&status=eq.respostas_recebidas&id=neq.${pedido.id}&order=criado_em.desc&limit=5`)
      if (Array.isArray(pedidosAnteriores) && pedidosAnteriores.length > 0) {
        const hist = []
        for (const pa of pedidosAnteriores) {
          const respsAnt = await fetchSupabase('respostas_cotacao', `?pedido_id=eq.${pa.id}&order=preco_unitario.asc&limit=3`)
          if (Array.isArray(respsAnt) && respsAnt.length > 0) {
            // Busca nomes dos fornecedores do histórico
            for (const r of respsAnt) {
              if (r.fornecedor_id && !mapa[r.fornecedor_id]) {
                const f = await fetchSupabase('fornecedores', `?id=eq.${r.fornecedor_id}&select=id,nome`)
                if (Array.isArray(f) && f.length > 0) mapa[r.fornecedor_id] = f[0].nome
              }
            }
            hist.push({ pedido: pa, respostas: respsAnt })
          }
        }
        setHistorico(hist)
        setFornecedoresMap({...mapa})
      }
    }
  }

  async function buscarSugestoesFornecedor(pedido) {
    setBuscandoSugestoes(true)
    try {
      // Supabase limita 1000/request — pagina com Range header
      const estoqueAll = []
      let from = 0
      const PAGE = 1000
      while (true) {
        const to = from + PAGE - 1
        const res = await fetch(`${URL}/rest/v1/estoque_fornecedor?quantidade=gt.0&select=*&order=data_referencia.desc`, {
          headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Range': `${from}-${to}`, 'Range-Unit': 'items' }
        })
        if (!res.ok) break
        const page = await res.json()
        if (!Array.isArray(page) || page.length === 0) break
        estoqueAll.push(...page)
        if (page.length < PAGE) break
        from += PAGE
      }
      const estoque = estoqueAll

      const precos = await fetchSupabase('tabela_precos_fornecedor', `?select=*&order=data_referencia.desc&limit=5000`)

      if (!Array.isArray(estoque) || estoque.length === 0) {
        setBuscandoSugestoes(false)
        return
      }

      const desc = pedido.item_descricao.toUpperCase()
      const filial = pedido.filial

      // Tabela de conversão polegadas → mm (diâmetros nominais de tubos)
      const POLEGADAS_MM = {
        '1/2': 12.70, '5/8': 15.88, '3/4': 19.05, '7/8': 22.22,
        '1': 25.40,
        '1.1/8': 28.58, '1.1/4': 31.75, '1.3/8': 34.93,
        '1.1/2': 38.10, '1.5/8': 41.28, '1.3/4': 44.45,
        '2': 50.80, '2.1/2': 63.50, '3': 76.20,
      }

      // Normaliza string: remove espaços extras
      function normalizar(s) {
        return s.toUpperCase().replace(/\s+/g, ' ').trim()
      }

      // Extrai dimensões numéricas convertendo polegadas para mm
      // Retorna apenas valores de dimensão (espessura/diâmetro/lado), ignora comprimento (6000)
      function extrairNumeros(s) {
        const S = normalizar(s)
        const resultado = []

        // 1. Captura padrões de polegada: 1", 1.1/2", 3/4" etc.
        // Ordem importa: tenta frações compostas antes de simples
        const regexPol = /(\d+\.\d+\/\d+|\d+\/\d+|\d+)\s*[\"']/g
        let m
        while ((m = regexPol.exec(S)) !== null) {
          const mm = POLEGADAS_MM[m[1]]
          if (mm) resultado.push(mm)
        }

        // 2. Captura números decimais (ponto ou vírgula), excluindo comprimentos (>=500)
        // Remove a parte de polegadas já processada para não duplicar
        const semPol = S.replace(/\d+\.\d+\/\d+\s*[\"']/g, ' ').replace(/\d+\/\d+\s*[\"']/g, ' ').replace(/\d+\s*[\"']/g, ' ')
        const regexNum = /(\d+[.,]\d+|\d+)/g
        while ((m = regexNum.exec(semPol)) !== null) {
          const val = parseFloat(m[1].replace(',', '.'))
          // Ignora comprimentos (>=500) e valores muito pequenos (<0.5)
          if (val >= 0.5 && val < 500) resultado.push(val)
        }

        return resultado
      }

      // Normaliza acabamento: FF (fina frio), FQ (fina quente), GI (galvanizado)
      function extrairAcabamento(s) {
        const S = normalizar(s)
        // Pana CXS: começa com "TF " = Tubo FF (fina frio)
        if (/^TF\s+[\d.]/.test(S)) return 'FF'
        if (/^TQ\s+[\d.]/.test(S)) return 'FQ'
        if (S.includes(' FF') || S.includes(' BF') || S.includes('FINA FRIO')) return 'FF'
        if (S.includes(' FQ') || S.includes('FINA QUENTE')) return 'FQ'
        if (S.includes(' GI') || S.includes(' GV') || S.includes('GALV') || S.includes(' ZN')) return 'GI'
        return null
      }

      // Normaliza tipo do produto — mapeia nomenclaturas diferentes para o mesmo tipo
      function extrairTipo(s) {
        const S = normalizar(s)

        // Pana CXS: formato "TF 1.20x25.40x6000" — TF=redondo FF, TQ=quadrado FQ
        // Detecta por padrão: 2 letras + espaço + número decimal
        if (/^TF\s+[\d.]/.test(S)) return 'TUBO REDONDO'
        if (/^TQ\s+[\d.]/.test(S)) return 'TUBO QUADRADO'
        if (/^TR\s+[\d.]/.test(S)) return 'TUBO RETANGULAR'

        // Tubos quadrados
        if (S.includes('QUADR') || S.includes('TUBO QUAD') || S.includes('TUBO QD') || S.includes('TB QD')) return 'TUBO QUADRADO'
        // Tubos retangulares
        if (S.includes('TUBO RET') || S.includes('TUBO FR') || S.includes('TB RT') || S.includes('TB RET')) return 'TUBO RETANGULAR'
        // Tubos redondos com nomenclatura explicita
        if (S.includes('TUBO RED') || S.includes('TUBO IND') || S.includes('TUBO NBR') || S.includes('TB RD') || S.includes('TB RED')) return 'TUBO REDONDO'
        // Tubos galvanizados
        if (S.includes('TUBO GI') || S.includes('TUBO GV') || S.includes('TUBO ZC') || S.includes('GALV') || S.includes('TB GI') || S.includes('TB ZN') || S.includes('TZ ')) return 'TUBO GALVANIZADO'
        // TUBO FF / TUBO FQ / TB FF / TB FQ sem qualificador (ex: Marcegaglia 'TUBO FF - (40X40X2,00X6000)')
        // Usa as dimensoes para distinguir: redondo=1 lado, quadrado=2 lados iguais, retangular=2 lados diferentes
        if (S.includes('TUBO FF') || S.includes('TUBO FQ') || S.includes('TB FF') || S.includes('TB FQ')) {
          const dims = extrairNumeros(s)
          const lados = dims.filter(d => d > 5)
          if (lados.length === 1) return 'TUBO REDONDO'
          if (lados.length === 2) {
            return Math.abs(lados[0] - lados[1]) / Math.max(lados[0], 0.01) < 0.01
              ? 'TUBO QUADRADO'
              : 'TUBO RETANGULAR'
          }
          return 'TUBO REDONDO'
        }
        if (S.includes('TUBO') || S.includes('TB ')) return 'TUBO'
        // Chapas
        if (S.includes('CHAPA FF') || S.includes('CHP FF') || (S.includes('CHP') && S.includes(' FF'))) return 'CHAPA FF'
        if (S.includes('CHAPA FQ') || S.includes('CHP FQ') || S.includes('CHP DO') || (S.includes('CHP') && S.includes(' FQ'))) return 'CHAPA FQ'
        if (S.includes('CHAPA ZC') || S.includes('CHAPA ZN') || S.includes('CHP ZC')) return 'CHAPA ZC'
        if (S.includes('CHAPA') || S.includes('CHP ')) return 'CHAPA'
        // Perfis
        if (S.includes('PERFIL UDC') || S.includes('PE UE') || S.includes('PE UC') || (S.includes('PERFIL U') && S.includes('CALHA'))) return 'PERFIL UDC'
        if (S.includes('PERFIL ZC') || S.includes('PE ZC')) return 'PERFIL ZC'
        if (S.includes('PERFIL') || S.includes('PE ')) return 'PERFIL'
        // Outros
        if (S.includes('CANTONEIRA') || S.includes('CTN ') || S.includes('PE EQ')) return 'CANTONEIRA'
        if (S.includes('VIGA') || S.includes('PERFIL W') || S.includes('PE W')) return 'VIGA'
        if (S.includes('BR CHATA') || S.includes('BARRA CHATA')) return 'BARRA CHATA'
        if (S.includes('BR RED') || S.includes('BARRA RED')) return 'BARRA REDONDA'
        return S.split(' ')[0]
      }

      const tipoDesc = extrairTipo(desc)
      const acabamentoDesc = extrairAcabamento(desc)
      const numerosDesc = extrairNumeros(desc)

      function scoreSimilaridade(itemDesc) {
        const B = normalizar(itemDesc)
        let score = 0
        let todasDimensoesBatem = false

        // 1. Tipo deve bater — peso alto
        const tipoB = extrairTipo(B)
        if (tipoDesc === tipoB) score += 50
        else if (tipoDesc.split(' ')[0] === tipoB.split(' ')[0]) score += 20
        else return { score: 0, todasDimensoesBatem: false }

        // 2. Acabamento: bônus se bater, não penaliza se um dos lados for null
        const acabamentoB = extrairAcabamento(B)
        if (acabamentoDesc && acabamentoB) {
          if (acabamentoDesc === acabamentoB) score += 10
          else score -= 15 // acabamento diferente penaliza mas não descarta
        }

        // 3. Compara dimensões — ordena ambas para comparação agnóstica a formato
        // (resolve "esp x diam" vs "diam x esp" da Pana CXS)
        const numerosB = extrairNumeros(B)
        const dimsA = [...numerosDesc].sort((a, b) => a - b)
        const dimsB = [...numerosB].sort((a, b) => a - b)

        let numerosEmComum = 0
        const numerosTotal = dimsA.length

        for (const n of dimsA) {
          const match = dimsB.some(nb => Math.abs(nb - n) / Math.max(n, 0.01) < 0.005)
          if (match) numerosEmComum++
        }

        if (numerosTotal > 0) {
          const pctMatch = numerosEmComum / numerosTotal
          score += Math.round(pctMatch * 50)
          // Alta confiança: match bidirecional perfeito nas dimensões (ordenadas)
          const pedidoBateItem = dimsA.every(n => dimsB.some(nb => Math.abs(nb - n) / Math.max(n, 0.01) < 0.005))
          const itemBatePedido = dimsB.every(n => dimsA.some(nb => Math.abs(nb - n) / Math.max(n, 0.01) < 0.005))
          todasDimensoesBatem = dimsA.length > 0 && pedidoBateItem && itemBatePedido
        }

        return { score, todasDimensoesBatem }
      }

      // Faz match no estoque
      const matches = estoque
        .map(item => {
          const { score, todasDimensoesBatem } = scoreSimilaridade(item.item_descricao)
          return { ...item, score, todasDimensoesBatem }
        })
        .filter(item => item.score >= 60)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      // Para cada match, busca o preço
      const sugestoesFinais = matches.map(item => {
        const precosDoFornecedor = (Array.isArray(precos) ? precos : [])
          .filter(p => p.fornecedor_nome === item.fornecedor_nome)

        let melhorPreco = null
        let melhorScore = 0

        for (const p of precosDoFornecedor) {
          const { score: s } = scoreSimilaridade(p.item_descricao)
          if (s > melhorScore) {
            melhorScore = s
            melhorPreco = p
          }
        }

        const preco = melhorPreco
          ? (filial === 'Cascavel' ? melhorPreco.preco_cascavel : melhorPreco.preco_curitiba)
          : null

        // Alta confiança = todas dimensões batem exatamente
        // Média = tipo bate mas dimensões parciais
        const confianca = item.todasDimensoesBatem ? 'alta' : 'media'

        return {
          fornecedor: item.fornecedor_nome,
          item_estoque: item.item_descricao,
          quantidade_disponivel: item.quantidade,
          preco_unitario: preco,
          confianca,
          espessura: item.espessura || null
        }
      })

      setSugestoes(sugestoesFinais)
    } catch (err) {
      console.error('Erro ao buscar sugestões:', err)
    }
    setBuscandoSugestoes(false)
  }

  async function salvarResposta(e) {
    e.preventDefault()
    setSalvando(true)
    let fornecedor_id = null
    const fExist = await fetchSupabase('fornecedores', `?nome=ilike.${encodeURIComponent(novaResposta.fornecedor_nome)}`)
    if (Array.isArray(fExist) && fExist.length > 0) {
      fornecedor_id = fExist[0].id
    } else {
      const fNew = await postSupabase('fornecedores', { nome: novaResposta.fornecedor_nome, tipo: 'distribuidora' })
      fornecedor_id = Array.isArray(fNew) ? fNew[0]?.id : null
    }
    await postSupabase('respostas_cotacao', { pedido_id: selecionado.id, fornecedor_id, preco_unitario: parseFloat(novaResposta.preco_unitario), prazo_entrega_dias: parseInt(novaResposta.prazo_entrega_dias)||null, observacoes: novaResposta.observacoes, origem: 'whatsapp_manual' })
    await patchSupabase('pedidos_cotacao', `id=eq.${selecionado.id}`, { status: 'respostas_recebidas' })
    setNovaResposta({ fornecedor_nome:'', preco_unitario:'', prazo_entrega_dias:'', observacoes:'' })
    abrirPedido(selecionado)
    carregarPedidos()
    setSalvando(false)
  }

  const menorPreco = respostas.length ? Math.min(...respostas.map(r => parseFloat(r.preco_unitario)||Infinity)) : null

  // Filtros
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtro === 'aguardando' && p.status !== 'aberto') return false
    if (filtro === 'respondidos' && p.status === 'aberto') return false
    if (filtroFilial !== 'todas' && p.filial !== filtroFilial) return false
    if (filtroClasse !== 'todas' && p.classe !== filtroClasse) return false
    if (busca && !p.item_descricao?.toLowerCase().includes(busca.toLowerCase()) && !p.item_codigo?.includes(busca) && !p.numero_cotacao?.includes(busca) && !String(p.numero_pedido ?? '').includes(busca.replace('#',''))) return false
    return true
  })

  const semResposta = pedidos.filter(p => p.status === 'aberto')
  const comResposta = pedidos.filter(p => p.status !== 'aberto')

  // Lead time médio dos respondidos
  const ltsValidos = Object.values(leadtimes).filter(v => v !== null && v !== undefined)
  const ltMedio = ltsValidos.length ? Math.round(ltsValidos.reduce((a,b) => a+b, 0) / ltsValidos.length) : null

  if (selecionado) return (
    <div style={s.wrap}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={() => setSelecionado(null)}>← Voltar</button>
        <div style={s.logoTitle}>Pedido de Cotação</div>
        <button style={s.btnLink} onClick={() => { sessionStorage.removeItem('comprador_email'); setEmailLogado(null) }}>Sair</button>
      </header>
      <div style={s.content}>
        <div style={s.card}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <span style={{ ...s.badge, ...(BADGE[selecionado.classe]||{}) }}>Classe {selecionado.classe}</span>
            <span style={{ fontWeight:600, fontSize:16 }}>{selecionado.item_descricao}</span>
          </div>
          <div style={s.metaGrid}>
            <div><div style={s.metaLabel}>Quantidade</div><div style={s.metaVal}>{selecionado.quantidade} {selecionado.unidade}</div></div>
            <div><div style={s.metaLabel}>Filial</div><div style={s.metaVal}>{selecionado.filial}</div></div>
            {selecionado.numero_cotacao && <div><div style={s.metaLabel}>Nº Cotação</div><div style={s.metaVal}>#{selecionado.numero_cotacao}</div></div>}
            <div><div style={s.metaLabel}>Lead time resposta</div><div style={s.metaVal}>{formatarLeadTime(leadtimes[selecionado.id])}</div></div>
          </div>
          {selecionado.observacoes && <div style={s.obs}>{selecionado.observacoes}</div>}
        </div>

        {/* Card de sugestões automáticas */}
        {(buscandoSugestoes || sugestoes.length > 0) && (
          <div style={{ ...s.card, background:'#F0FBF7', border:'1px solid #1D9E75' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: buscandoSugestoes ? 0 : 14 }}>
              <span style={{ fontSize:16 }}>🤖</span>
              <h3 style={{ fontSize:14, fontWeight:600, color:'#085041' }}>
                {buscandoSugestoes ? 'Buscando disponibilidade nos fornecedores...' : `Estoque disponível — ${sugestoes.length} fornecedor${sugestoes.length !== 1 ? 'es' : ''} com o item`}
              </h3>
            </div>
            {buscandoSugestoes && (
              <div style={{ fontSize:13, color:'#0F6E56', marginTop:8 }}>Consultando planilhas importadas e fazendo match com Claude AI...</div>
            )}
            {sugestoes.map((s2, i) => (
              <div key={i} style={{ background:'#fff', borderRadius:8, padding:'12px 14px', marginBottom:8, border:`1px solid ${s2.confianca === 'alta' ? '#1D9E75' : s2.confianca === 'media' ? '#EF9F27' : '#E0DED8'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontWeight:600, fontSize:15 }}>{s2.fornecedor}</span>
                      <span style={{ fontSize:11, padding:'2px 7px', borderRadius:4, background: s2.confianca === 'alta' ? '#E1F5EE' : s2.confianca === 'media' ? '#FAEEDA' : '#F1EFE8', color: s2.confianca === 'alta' ? '#085041' : s2.confianca === 'media' ? '#633806' : '#888780', fontWeight:600 }}>
                        {s2.confianca === 'alta' ? '✓ Alta confiança' : s2.confianca === 'media' ? '~ Média confiança' : '? Baixa confiança'}
                      </span>
                    </div>
                    <div style={{ fontSize:13, color:'#5F5E5A', marginBottom:4 }}>{s2.item_estoque}</div>
                    <div style={{ fontSize:12, color:'#888780' }}>📦 Estoque: <strong style={{ color: s2.quantidade_disponivel >= selecionado.quantidade ? '#085041' : '#A32D2D' }}>{s2.quantidade_disponivel?.toLocaleString('pt-BR')} kg</strong>
                      {s2.quantidade_disponivel < selecionado.quantidade && <span style={{ color:'#A32D2D' }}> — insuficiente para {selecionado.quantidade} kg</span>}
                    </div>
                    {s2.observacao && <div style={{ fontSize:12, color:'#888780', marginTop:4, fontStyle:'italic' }}>{s2.observacao}</div>}
                  </div>
                  {s2.preco_unitario > 0 && (
                    <div style={{ textAlign:'right', flexShrink:0, marginLeft:16 }}>
                      <div style={{ fontSize:10, color:'#888780', marginBottom:2 }}>preço tabela</div>
                      <div style={{ fontSize:20, fontWeight:700, color:'#185FA5' }}>R$ {parseFloat(s2.preco_unitario).toFixed(2)}<span style={{ fontSize:11, color:'#888780', fontWeight:400 }}>/kg</span></div>
                      <div style={{ fontSize:12, color:'#5F5E5A' }}>Total: R$ {(s2.preco_unitario * selecionado.quantidade).toLocaleString('pt-BR', { minimumFractionDigits:2 })}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!buscandoSugestoes && sugestoes.length === 0 && (
              <div style={{ fontSize:13, color:'#5F5E5A', fontStyle:'italic' }}>Nenhum item correspondente encontrado nas planilhas importadas de hoje.</div>
            )}
          </div>
        )}

        {/* Histórico de cotações anteriores */}
        {historico.length > 0 && (
          <div style={{ ...s.card, background:'#FFFBF0', border:'1px solid #FAE8A0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <span style={{ fontSize:16 }}>💡</span>
              <h3 style={{ fontSize:14, fontWeight:600, color:'#633806' }}>Referência — cotações anteriores deste item</h3>
            </div>
            {historico.map((h, idx) => (
              <div key={idx} style={{ marginBottom: idx < historico.length - 1 ? 12 : 0 }}>
                <div style={{ fontSize:11, color:'#888780', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  {new Date(h.pedido.criado_em).toLocaleDateString('pt-BR')} · {h.pedido.filial} · {h.pedido.quantidade} {h.pedido.unidade}
                </div>
                {h.respostas.map((r, i) => (
                  <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background: i===0 ? '#FEF3C7' : '#fff', borderRadius:8, marginBottom:4, border:'0.5px solid rgba(0,0,0,0.08)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {i === 0 && <span style={{ fontSize:11, background:'#F59E0B', color:'#fff', padding:'1px 6px', borderRadius:4, fontWeight:600 }}>menor</span>}
                      <span style={{ fontSize:14, fontWeight:500 }}>{fornecedoresMap[r.fornecedor_id] || '—'}</span>
                      {r.prazo_entrega_dias && <span style={{ fontSize:12, color:'#888780' }}>· {r.prazo_entrega_dias} dias</span>}
                    </div>
                    <span style={{ fontSize:16, fontWeight:700, color: i===0 ? '#633806' : '#444441' }}>R$ {parseFloat(r.preco_unitario).toFixed(2)}<span style={{ fontSize:11, fontWeight:400, color:'#888780' }}>/kg</span></span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={s.card}>
          <h3 style={s.sectionTitle}>Lançar resposta do fornecedor</h3>
          <form onSubmit={salvarResposta} style={s.form}>
            <div style={s.row}>
              <div style={s.field}><label style={s.label}>Fornecedor</label><input style={s.input} value={novaResposta.fornecedor_nome} onChange={e => setNovaResposta(f=>({...f,fornecedor_nome:e.target.value}))} placeholder="Nome do fornecedor" required /></div>
              <div style={s.field}><label style={s.label}>Preço unitário (R$/kg)</label><input style={s.input} type="number" step="0.01" value={novaResposta.preco_unitario} onChange={e => setNovaResposta(f=>({...f,preco_unitario:e.target.value}))} placeholder="0,00" required /></div>
            </div>
            <div style={s.row}>
              <div style={s.field}><label style={s.label}>Prazo (dias)</label><input style={s.input} type="number" value={novaResposta.prazo_entrega_dias} onChange={e => setNovaResposta(f=>({...f,prazo_entrega_dias:e.target.value}))} /></div>
              <div style={s.field}><label style={s.label}>Observações</label><input style={s.input} value={novaResposta.observacoes} onChange={e => setNovaResposta(f=>({...f,observacoes:e.target.value}))} /></div>
            </div>
            <button style={s.btnPrimary} type="submit" disabled={salvando}>{salvando?'Salvando...':'Lançar resposta'}</button>
          </form>
        </div>

        {respostas.length > 0 && (
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Mapa comparativo — {respostas.length} {respostas.length===1?'resposta':'respostas'}</h3>
            {respostas.map(r => (
              <div key={r.id} style={{ ...s.respostaCard, ...(parseFloat(r.preco_unitario)===menorPreco?s.melhor:{}) }}>
                <div style={{ flex:1 }}>
                  {parseFloat(r.preco_unitario)===menorPreco && <span style={s.melhorBadge}>⭐ Melhor preço</span>}
                  <div style={{ fontWeight:500, fontSize:15 }}>{fornecedoresMap[r.fornecedor_id]||'—'}</div>
                  <div style={{ fontSize:12, color:'#888780', marginTop:2 }}>Prazo: {r.prazo_entrega_dias||'—'} dias{r.observacoes&&` · ${r.observacoes}`}</div>
                  <div style={{ fontSize:13, color:'#5F5E5A', marginTop:4 }}>Total: <strong>R$ {(parseFloat(r.preco_unitario)*parseFloat(selecionado.quantidade)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></div>
                </div>
                <div style={{ fontSize:22, fontWeight:700 }}>R$ {parseFloat(r.preco_unitario).toFixed(2)}<span style={{ fontSize:12, color:'#888780', fontWeight:400 }}>/kg</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logo}>T</div>
          <div><div style={s.logoTitle}>Trezaço</div><div style={s.logoSub}>Comprador — {emailLogado}</div></div>
        </div>
        <button style={s.btnLink} onClick={() => { sessionStorage.removeItem('comprador_email'); setEmailLogado(null) }}>Sair</button>
      </header>

      <div style={{ padding:'20px 24px 0', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #E24B4A' }}>
          <div style={{ fontSize:24, fontWeight:700, color:'#E24B4A' }}>{semResposta.length}</div>
          <div style={{ fontSize:11, color:'#888780', marginTop:4 }}>Aguardando</div>
        </div>
        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #1D9E75' }}>
          <div style={{ fontSize:24, fontWeight:700, color:'#1D9E75' }}>{comResposta.length}</div>
          <div style={{ fontSize:11, color:'#888780', marginTop:4 }}>Respondidos</div>
        </div>
        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #185FA5' }}>
          <div style={{ fontSize:24, fontWeight:700, color:'#185FA5' }}>{formatarLeadTime(ltMedio)}</div>
          <div style={{ fontSize:11, color:'#888780', marginTop:4 }}>Lead time médio</div>
        </div>
        <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #888780' }}>
          <div style={{ fontSize:24, fontWeight:700, color:'#888780' }}>{pedidos.length}</div>
          <div style={{ fontSize:11, color:'#888780', marginTop:4 }}>Total</div>
        </div>
      </div>

      <div style={s.layout}>
        {/* Sidebar esquerda */}
        <aside style={s.sidebar}>
        {/* Filtros */}
          <div style={{ marginBottom:20 }}>
            <div style={s.sideSection}>BUSCA</div>
            <input
              style={{ width:'100%', padding:'8px 12px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' }}
              placeholder="🔍 Buscar item..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={s.sideSection}>STATUS</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[['todos','Todos',null],['aguardando','🔴 Aguardando',semResposta.length],['respondidos','🟢 Respondidos',comResposta.length]].map(([f,label,count]) => (
                <button key={f} onClick={() => setFiltro(f)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: filtro===f ? '#E1F5EE' : 'transparent', border: filtro===f ? '0.5px solid #1D9E75' : '0.5px solid transparent', borderRadius:8, fontSize:13, cursor:'pointer', color: filtro===f ? '#085041' : '#444441', fontWeight: filtro===f ? 600 : 400, textAlign:'left' }}>
                  <span>{label}</span>
                  {count !== null && <span style={{ fontSize:11, background: filtro===f ? '#1D9E75' : '#F1EFE8', color: filtro===f ? '#fff' : '#888780', padding:'1px 6px', borderRadius:10 }}>{count}</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={s.sideSection}>FILIAL</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[['todas','Todas'],['Curitiba','Curitiba'],['Cascavel','Cascavel']].map(([f,label]) => (
                <button key={f} onClick={() => setFiltroFilial(f)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: filtroFilial===f ? '#E1F5EE' : 'transparent', border: filtroFilial===f ? '0.5px solid #1D9E75' : '0.5px solid transparent', borderRadius:8, fontSize:13, cursor:'pointer', color: filtroFilial===f ? '#085041' : '#444441', fontWeight: filtroFilial===f ? 600 : 400, textAlign:'left' }}>
                  <span>{label}</span>
                  {f !== 'todas' && <span style={{ fontSize:11, background:'#F1EFE8', color:'#888780', padding:'1px 6px', borderRadius:10 }}>{pedidos.filter(p=>p.filial===f).length}</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={s.sideSection}>CLASSE</div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[['todas','Todas',null],['A','Classe A','#E6F1FB','#0C447C'],['B','Classe B','#FAEEDA','#633806'],['C','Classe C','#E1F5EE','#085041']].map(([f,label,bg,color]) => (
                <button key={f} onClick={() => setFiltroClasse(f)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background: filtroClasse===f ? '#E1F5EE' : 'transparent', border: filtroClasse===f ? '0.5px solid #1D9E75' : '0.5px solid transparent', borderRadius:8, fontSize:13, cursor:'pointer', color: filtroClasse===f ? '#085041' : '#444441', fontWeight: filtroClasse===f ? 600 : 400, textAlign:'left' }}>
                  <span>{label}</span>
                  {bg && <span style={{ fontSize:11, background: filtroClasse===f ? '#1D9E75' : bg, color: filtroClasse===f ? '#fff' : color, padding:'1px 6px', borderRadius:10 }}>{pedidos.filter(p=>p.classe===f).length}</span>}
                </button>
              ))}
            </div>
          </div>

          {(filtro !== 'todos' || filtroFilial !== 'todas' || filtroClasse !== 'todas' || busca) && (
            <button onClick={() => { setFiltro('todos'); setFiltroFilial('todas'); setFiltroClasse('todas'); setBusca('') }}
              style={{ width:'100%', padding:'8px', background:'none', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:13, cursor:'pointer', color:'#888780' }}>
              ✕ Limpar filtros
            </button>
          )}
        </aside>

        {/* Lista principal */}
        <main style={s.main}>
          {pedidosFiltrados.length === 0
            ? <div style={s.empty}>Nenhum pedido encontrado com esses filtros.</div>
            : <>
                <div style={{ fontSize:13, color:'#888780', marginBottom:12 }}>
                  {pedidosFiltrados.length} {pedidosFiltrados.length===1?'pedido':'pedidos'}{pedidosFiltrados.length !== pedidos.length ? ` de ${pedidos.length}` : ''}
                </div>
                {pedidosFiltrados.map(p => <PedidoCard key={p.id} p={p} onClick={() => abrirPedido(p)} leadtime={leadtimes[p.id]} />)}
              </>
          }
        </main>
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight:'100vh', background:'#f8f8f6' },
  header: { background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.1)', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 },
  headerLeft: { display:'flex', alignItems:'center', gap:12 },
  logo: { width:36, height:36, borderRadius:8, background:'#1D9E75', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 },
  logoTitle: { fontWeight:600, fontSize:15 },
  logoSub: { fontSize:12, color:'#888780' },
  btnLink: { fontSize:13, color:'#888780', background:'none', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:6, padding:'6px 12px', cursor:'pointer' },
  backBtn: { fontSize:14, color:'#1D9E75', background:'none', border:'none', cursor:'pointer', fontWeight:500 },
  layout: { display:'flex', minHeight:'calc(100vh - 57px)' },
  sidebar: { width:220, flexShrink:0, background:'#fff', borderRight:'0.5px solid rgba(0,0,0,0.08)', padding:'20px 16px', position:'sticky', top:57, height:'calc(100vh - 57px)', overflowY:'auto' },
  sideSection: { fontSize:10, fontWeight:700, color:'#888780', letterSpacing:'0.08em', marginBottom:8, textTransform:'uppercase' },
  statSide: { background:'#f8f8f6', borderRadius:8, padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' },
  main: { flex:1, padding:'24px', maxWidth:'100%', overflowY:'auto' },
  content: { maxWidth:780, margin:'24px auto', padding:'0 24px' },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 },
  stat: { background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center' },
  statNum: { fontSize:24, fontWeight:600 },
  statLabel: { fontSize:11, color:'#888780', marginTop:4 },
  filtro: { padding:'7px 14px', background:'#fff', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:20, fontSize:13, cursor:'pointer', color:'#5F5E5A', whiteSpace:'nowrap' },
  filtroActive: { padding:'7px 14px', background:'#1D9E75', border:'0.5px solid #1D9E75', borderRadius:20, fontSize:13, cursor:'pointer', color:'#fff', fontWeight:500, whiteSpace:'nowrap' },
  card: { background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.25rem', marginBottom:16 },
  sectionTitle: { fontSize:14, fontWeight:600, marginBottom:14, color:'#444441' },
  badge: { display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:5, fontSize:12, fontWeight:500 },
  metaGrid: { display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:12 },
  metaLabel: { fontSize:11, color:'#888780', textTransform:'uppercase', letterSpacing:'0.04em' },
  metaVal: { fontSize:14, fontWeight:500 },
  obs: { background:'#F1EFE8', borderRadius:8, padding:'10px 12px', fontSize:13 },
  form: { display:'flex', flexDirection:'column', gap:14 },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  field: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:12, fontWeight:500, color:'#5F5E5A', textTransform:'uppercase', letterSpacing:'0.04em' },
  input: { padding:'10px 12px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:14, outline:'none' },
  btnPrimary: { background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, padding:'11px', fontSize:14, fontWeight:500, cursor:'pointer' },
  respostaCard: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:10, marginBottom:8 },
  melhor: { border:'1.5px solid #1D9E75', background:'#f0fdf7' },
  melhorBadge: { display:'inline-block', background:'#1D9E75', color:'#fff', fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:4, marginBottom:6 },
  empty: { textAlign:'center', padding:'3rem', color:'#888780' },
}
