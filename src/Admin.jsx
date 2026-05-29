import { useState, useEffect } from 'react'
import { fetchSupabase } from './supabase'

const URL = 'https://cilbkzvuvwjeqtdpxcbs.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbGJrenZ1dndqZXF0ZHB4Y2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQwNTAsImV4cCI6MjA5MzE1MDA1MH0._bn3Je-gsu4Edc8SKr-fQBVW5dxCOIKn_zxqT61wq2M'
const EMAILS_ADMIN = ['compras@trezaco.com.br', 'raphael@trezaco.com.br', 'brandao@trezaco.com.br']

async function deleteSupabase(tabela, filtro) {
  await fetch(`${URL}/rest/v1/${tabela}?${filtro}`, {
    method: 'DELETE',
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
  })
}

async function insertLotes(tabela, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const lote = rows.slice(i, i + 200)
    await fetch(`${URL}/rest/v1/${tabela}`, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(lote)
    })
  }
}

function lerArquivoComoArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsArrayBuffer(file)
  })
}

function lerArquivoComoTexto(file, encoding = 'utf-8') {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsText(file, encoding)
  })
}

async function carregarXLSX() {
  if (window.XLSX) return window.XLSX
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = () => resolve(window.XLSX); s.onerror = reject; document.head.appendChild(s)
  })
}

// ── PARSERS ─────────────────────────────────────────────────

// Marcegaglia: XLS — Item, Descrição, Material, Tipo, Espessura, Quant.
async function parsearMarcegaglia(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  const hoje = new Date().toISOString().split('T')[0]
  return rows.map(row => {
    const desc = String(row['Descrição '] || row['Descricao'] || row['Descrição'] || '').trim()
    const qtd = parseFloat(String(row['Quant. '] || row['Quant.'] || row['Quantidade'] || 0).replace(',', '.')) || 0
    if (!desc) return null
    return { fornecedor_nome: fornecedor, item_codigo: String(row['Item'] || '').trim() || null, item_descricao: desc, material: String(row['Material'] || '').trim() || null, tipo_material: String(row['Tipo de Material'] || '').trim() || null, espessura: String(row['Espessura'] || '').trim() || null, quantidade: qtd, data_referencia: hoje }
  }).filter(Boolean)
}

// Tuper: CSV — "Código item", "Descrição do item", "Quantidade KG"
async function parsearTuper(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  const hoje = new Date().toISOString().split('T')[0]
  return rows.map(row => {
    const desc = String(row['Descrição do item'] || row['Descricao do item'] || row['Descrição'] || '').trim()
    const qtd = parseFloat(String(row['Quantidade KG'] || row['Quantidade Kg'] || row['Quantidade'] || 0).replace(',', '.')) || 0
    if (!desc || qtd === 0) return null
    return { fornecedor_nome: fornecedor, item_codigo: String(row['Código item'] || row['Codigo item'] || '').trim() || null, item_descricao: desc, material: null, tipo_material: String(row['Família Comercial'] || '').trim() || null, espessura: null, quantidade: qtd, data_referencia: hoje }
  }).filter(Boolean)
}

// Itaúna/Cariacica: XLSX — CODIGO, DESCRICAO, SALDO (toneladas)
async function parsearItauna(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  const hoje = new Date().toISOString().split('T')[0]
  return rows.map(row => {
    const desc = String(row['DESCRICAO'] || row['Descricao'] || row['DESCRIÇÃO'] || '').trim()
    const saldoRaw = row['SALDO (to)'] || row['SALDO (t)'] || row['SALDO'] || row['Saldo'] || 0
    const qtdTon = parseFloat(String(saldoRaw).replace(',', '.')) || 0
    if (!desc || qtdTon === 0) return null
    return { fornecedor_nome: fornecedor, item_codigo: String(row['CODIGO'] || row['Codigo'] || '').trim() || null, item_descricao: desc, material: null, tipo_material: null, espessura: null, quantidade: qtdTon * 1000, data_referencia: hoje }
  }).filter(Boolean)
}

// CXS/CLP: HTML — Codigo, Descricao, UN, Qt.Disp
async function parsearCXS(file, fornecedor) {
  const texto = await lerArquivoComoTexto(file, 'latin-1')
  const parser = new DOMParser()
  const doc = parser.parseFromString(texto, 'text/html')
  const hoje = new Date().toISOString().split('T')[0]
  const itens = []
  for (const table of doc.querySelectorAll('table')) {
    const rows = table.querySelectorAll('tr')
    let colCodigo = -1, colDesc = -1, colQtd = -1, colUN = -1
    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td, th'))
      const vals = cells.map(c => c.textContent.trim())
      if (vals.some(v => v.toLowerCase().includes('descricao') || v.toLowerCase().includes('descrição'))) {
        vals.forEach((v, idx) => {
          const vl = v.toLowerCase()
          if (vl.includes('codigo') || vl.includes('código')) colCodigo = idx
          if (vl.includes('descricao') || vl.includes('descrição')) colDesc = idx
          if (vl.includes('qt') || vl.includes('disp')) colQtd = idx
          if (vl === 'un') colUN = idx
        }); continue
      }
      if (colDesc < 0) continue
      const desc = vals[colDesc]?.trim()
      if (!desc || desc.length < 3) continue
      const qtdRaw = colQtd >= 0 ? vals[colQtd] : '0'
      const un = colUN >= 0 ? vals[colUN] : 'T'
      const qtd = parseFloat(qtdRaw.replace(',', '.')) * (un === 'T' ? 1000 : 1) || 0
      if (qtd === 0) continue
      itens.push({ fornecedor_nome: fornecedor, item_codigo: colCodigo >= 0 ? vals[colCodigo] || null : null, item_descricao: desc, material: null, tipo_material: null, espessura: null, quantidade: qtd, data_referencia: hoje })
    }
  }
  return itens
}

// SAP HTM: Cen. | Material | Texto breve de material | Espessura | Tipo | Estoque | Ord.vend. | Saldo
async function parsearSAP(file, fornecedor) {
  const texto = await lerArquivoComoTexto(file, 'latin-1')
  const parser = new DOMParser()
  const doc = parser.parseFromString(texto, 'text/html')
  const hoje = new Date().toISOString().split('T')[0]
  const itens = []
  const table = doc.querySelector('table')
  if (!table) return itens
  const rows = table.querySelectorAll('tr')
  if (rows.length < 2) return itens

  // Detecta colunas pelo cabeçalho
  const headers = Array.from(rows[0].querySelectorAll('td, th'))
    .map(td => td.textContent.replace(/\xa0/g, ' ').trim().toLowerCase())

  const colDesc = headers.findIndex(h => h.includes('texto') && h.includes('breve'))
  const colMat = headers.findIndex(h => h === 'material')
  const colEsp = headers.findIndex(h => h.includes('espessura'))
  const colSaldo = headers.findIndex(h => h === 'saldo')
  const colEstoque = headers.findIndex(h => h === 'estoque')
  const colQtd = colSaldo >= 0 ? colSaldo : colEstoque

  if (colDesc < 0 || colQtd < 0) return itens

  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('td'))
      .map(td => td.textContent.replace(/\xa0/g, ' ').trim())
    const desc = cells[colDesc]?.trim()
    if (!desc || desc.length < 3) continue
    const qtdStr = cells[colQtd] || '0'
    // Formato europeu: 1.234,56 → remover pontos de milhar, trocar vírgula
    const qtd = parseFloat(qtdStr.replace(/\./g, '').replace(',', '.')) || 0
    if (qtd <= 0) continue
    const esp = colEsp >= 0 ? cells[colEsp]?.replace('MM', '').trim() : null
    const cod = colMat >= 0 ? cells[colMat]?.trim() : null
    itens.push({ fornecedor_nome: fornecedor, item_codigo: cod || null, item_descricao: desc, material: null, tipo_material: null, espessura: esp || null, quantidade: qtd, data_referencia: hoje })
  }
  return itens
}

// PDF: texto corrido — código tipo descrição... quantidade
async function parsearPDF(file, fornecedor) {
  const texto = await lerArquivoComoTexto(file)
  const hoje = new Date().toISOString().split('T')[0]
  const itens = []
  // Palavras que indicam linha de cabeçalho, rodapé ou total — ignorar
  const IGNORAR = /^(codigo|c[oó]digo|descri|total|p[áa]gina|data|emiss|saldo|estoque|item|material)/i
  for (const linha of texto.split('\n')) {
    const trimmed = linha.trim()
    if (!trimmed || trimmed.length < 8) continue
    if (IGNORAR.test(trimmed)) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 3) continue
    // Último token deve ser número (quantidade)
    const ultimo = parts[parts.length - 1]
    const qtd = parseFloat(ultimo.replace(/\./g, '').replace(',', '.'))
    if (isNaN(qtd) || qtd <= 0 || qtd > 9999999) continue
    const desc = parts.slice(1, parts.length - 1).join(' ').trim()
    if (!desc || desc.length < 5) continue
    // Rejeita linhas onde a descrição parece ser só números/datas
    if (/^[\d\/\-\.\s]+$/.test(desc)) continue
    itens.push({ fornecedor_nome: fornecedor, item_codigo: parts[0] || null, item_descricao: desc, material: null, tipo_material: null, espessura: null, quantidade: qtd, data_referencia: hoje })
  }
  return itens
}

// Trezaço Posição de Estoque PDF — Código | Descrição | ... | Estoque Pes (última coluna)
async function carregarPDFJS() {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function parsearPosEstoque(file, filial) {
  const pdfjsLib = await carregarPDFJS()
  const buf = await lerArquivoComoArrayBuffer(file)
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const hoje = new Date().toISOString().split('T')[0]
  const itens = []
  let filialDetectada = filial

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const H = viewport.height

    // Detecta filial
    if (!filialDetectada) {
      const txt = tc.items.map(i => i.str).join(' ')
      const mf = txt.match(/TREZACO\s+(\w+)/i)
      if (mf) filialDetectada = mf[1]
    }

    // Coleta tokens com posição
    const tokens = tc.items
      .filter(i => i.str.trim())
      .map(i => ({
        str: i.str.trim(),
        x: Math.round(i.transform[4]),
        y: Math.round(H - i.transform[5])
      }))

    // Encontra linhas de dados: tokens que são código de 8 dígitos
    const codigos = tokens.filter(t => /^\d{8}$/.test(t.str))

    // Detecta X das colunas a partir da linha de cabeçalho
    // Cabeçalho tem "Descrição" — usa o X desse token como âncora da col descrição
    const tokDesc = tokens.find(t => t.str === 'Descrição')
    const tokEst = tokens.find(t => t.str === 'Estoque' && tokens.find(t2 => t2.str === 'Segurança' && Math.abs(t2.y - t.y) < 20))
    // X da coluna Estoque (não Estoque Segurança)
    // No PDF: Estoque Segurança aparece antes de Estoque
    // Pega o segundo "Estoque" do cabeçalho
    const tokEstAll = tokens.filter(t => t.str === 'Estoque')

    for (const tkCod of codigos) {
      const yCod = tkCod.y
      // Tokens na mesma linha (±4px de Y)
      const linha = tokens.filter(t => Math.abs(t.y - yCod) < 4).sort((a, b) => a.x - b.x)
      if (linha.length < 4) continue

      // Código = primeiro token (já sabemos)
      // Descrição = tokens entre o código (x~30-250) e Refer.1 (x~280)
      // Detecta X do código
      const xCod = tkCod.x

      // Todos os tokens numéricos no formato brasileiro da linha
      const nums = linha
        .map(t => t.str)
        .filter(s => /^\d{1,3}(?:\.\d{3})*,\d+$/.test(s))
        .map(s => parseFloat(s.replace(/\./g, '').replace(',', '.')))
        .filter(n => n > 0)

      if (nums.length === 0) continue
      // Estoque = 2º número >= 1º (Estoque >= Estoque Segurança normalmente)
      // Mas mais simples: pegar o maior número da linha (é o Peso ou Estoque)
      // Segundo número da esquerda = Estoque (após Estoque Segurança)
      const qtd = nums.length >= 2 ? nums[1] : nums[0]
      if (!qtd || qtd <= 0) continue

      // Descrição: tokens entre código e o token de classe (A/B/C/AA/BB)
      // Filtra tokens à direita do código e antes dos números
      const descTokens = linha.filter(t =>
        t.x > xCod + 5 &&
        !/^(AA|BB|A|B|C)$/.test(t.str) &&
        !/^\d/.test(t.str) &&
        t.str !== 'KG' && t.str !== 'PC' && t.str !== 'BR'
      )
      const desc = descTokens.map(t => t.str).join(' ').trim()
      if (!desc || desc.length < 3) continue

      itens.push({
        item_codigo: tkCod.str,
        item_descricao: desc,
        filial: filialDetectada,
        quantidade: qtd,
        data_referencia: hoje
      })
    }
  }
  return itens
}
// Detecção automática de formato
async function parsearEstoque(file, fornecedor) {
  const nome = file.name.toLowerCase()
  const ext = nome.split('.').pop()

  if (ext === 'csv') return parsearTuper(file, fornecedor)
  if (ext === 'pdf') return parsearPDF(file, fornecedor)

  if (ext === 'html' || ext === 'htm') {
    // Detecta se é SAP (tem coluna "Texto breve de material") ou CXS
    const texto = await lerArquivoComoTexto(file, 'latin-1')
    if (texto.includes('Texto') && (texto.includes('breve') || texto.includes('Saldo'))) {
      return parsearSAP(file, fornecedor)
    }
    return parsearCXS(file, fornecedor)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await carregarXLSX()
    const buf = await lerArquivoComoArrayBuffer(file)
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
    if (rows.length === 0) return []
    const cols = Object.keys(rows[0]).map(k => k.toLowerCase())
    if (cols.some(c => c.includes('quantidade kg') || c.includes('quantidade peça'))) return parsearTuper(file, fornecedor)
    if (cols.some(c => c.includes('saldo'))) return parsearItauna(file, fornecedor)
    return parsearMarcegaglia(file, fornecedor)
  }
  return []
}

// Parser tabela de preços
async function parsearPrecos(file) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array' })
  const hoje = new Date().toISOString().split('T')[0]
  const todos = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    const fornecedor = sheetName.trim()
    let colCuritiba = null, colCascavel = null, colEspessura = null, familiaAtual = null
    for (let r = 0; r < Math.min(5, matriz.length); r++) {
      const row = matriz[r]
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase()
        if (val.includes('curitiba')) colCuritiba = c
        if (val.includes('cascavel')) colCascavel = c
        if (val.includes('espessura')) colEspessura = c
      }
    }
    const apenasUmPreco = colCuritiba !== null && colCascavel === null
    for (let r = 0; r < matriz.length; r++) {
      const row = matriz[r]
      if (!row || row.every(c => c === null)) continue
      if (row[0] && String(row[0]).trim().length > 2 && !String(row[0]).trim().match(/^\d/)) familiaAtual = String(row[0]).trim()
      const desc = String(row[1] || '').trim()
      if (!desc || desc.toLowerCase().includes('família') || desc.toLowerCase().includes('espessura')) continue
      const precoCTBA = colCuritiba !== null ? parseFloat(String(row[colCuritiba] || '').replace(',', '.')) : null
      const precoCAS = colCascavel !== null ? parseFloat(String(row[colCascavel] || '').replace(',', '.')) : (apenasUmPreco ? precoCTBA : null)
      if (!precoCTBA || isNaN(precoCTBA)) continue
      todos.push({ fornecedor_nome: fornecedor, familia: familiaAtual, item_descricao: desc, espessura: colEspessura !== null ? String(row[colEspessura] || '').trim() : null, preco_curitiba: precoCTBA, preco_cascavel: isNaN(precoCAS) ? precoCTBA : precoCAS, data_referencia: hoje })
    }
  }
  return todos
}

export default function Admin() {
  const [email, setEmail] = useState('')
  const [logado, setLogado] = useState(() => sessionStorage.getItem('admin_email') || null)
  const [erroLogin, setErroLogin] = useState('')
  const [uploads, setUploads] = useState([])
  const [arqPrecos, setArqPrecos] = useState(null)
  const [arqPosEstoque, setArqPosEstoque] = useState([])
  const [processando, setProcessando] = useState(null)
  const [stats, setStats] = useState({ estoque: 0, precos: 0, fornecedores: [] })

  useEffect(() => { if (logado) carregarStats() }, [logado])

  async function carregarStats() {
    const [eCount, pCount, eForn, posCount, posFil] = await Promise.all([
      fetch(`${URL}/rest/v1/estoque_fornecedor?select=*&quantidade=gt.0`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' }
      }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
      fetch(`${URL}/rest/v1/tabela_precos_fornecedor?select=*`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' }
      }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
      fetchSupabase('estoque_fornecedor', '?select=fornecedor_nome&quantidade=gt.0&limit=1000'),
      fetch(`${URL}/rest/v1/pos_estoque?select=*`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' }
      }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
      fetchSupabase('pos_estoque', '?select=filial&limit=1000')
    ])
    const fornSet = new Set(Array.isArray(eForn) ? eForn.map(x => x.fornecedor_nome) : [])
    const filSet = new Set(Array.isArray(posFil) ? posFil.map(x => x.filial) : [])
    setStats({ estoque: eCount, precos: pCount, fornecedores: [...fornSet], posEstoque: posCount, posFiliais: [...filSet] })
  }

  async function importarPosEstoque() {
    if (!arqPosEstoque?.length) { alert('Selecione os arquivos PDF'); return }
    setProcessando('pos_estoque')
    try {
      let totalItens = 0
      for (const arquivo of arqPosEstoque) {
        const itens = await parsearPosEstoque(arquivo, null)
        if (itens.length === 0) {
          alert(`⚠️ "${arquivo.name}" — nenhum item reconhecido. Verifique se é o PDF "Posição de Estoque" do ERP.`)
          continue
        }
        // Apaga estoque do dia para essa filial antes de reimportar
        const filial = itens[0].filial
        const hoje = new Date().toISOString().split('T')[0]
        await fetch(`${URL}/rest/v1/pos_estoque?filial=eq.${encodeURIComponent(filial)}&data_referencia=eq.${hoje}`, {
          method: 'DELETE', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
        })
        await insertLotes('pos_estoque', itens)
        totalItens += itens.length
      }
      setArqPosEstoque([])
      carregarStats()
      if (totalItens > 0) alert(`✅ Estoque interno importado: ${totalItens.toLocaleString('pt-BR')} itens`)
    } catch (err) { alert('Erro: ' + err.message) }
    setProcessando(null)
  }

  function handleLogin(e) {
    e.preventDefault()
    if (EMAILS_ADMIN.includes(email.trim().toLowerCase())) {
      sessionStorage.setItem('admin_email', email.trim().toLowerCase())
      setLogado(email.trim().toLowerCase())
    } else setErroLogin('E-mail não autorizado.')
  }

  function adicionarUpload() {
    setUploads(u => [...u, { id: Date.now(), fornecedor: '', arquivo: null, status: 'pendente', resultado: null, erro: null }])
  }

  function atualizarUpload(id, campo, valor) {
    setUploads(u => u.map(item => item.id === id ? { ...item, [campo]: valor } : item))
  }

  async function importarEstoque(id) {
    const upload = uploads.find(u => u.id === id)
    if (!upload?.fornecedor || !upload?.arquivos?.length) { alert('Preencha o fornecedor e selecione os arquivos'); return }
    setProcessando('estoque_' + id)
    atualizarUpload(id, 'status', 'processando')
    try {
      const hoje = new Date().toISOString().split('T')[0]
      // Apaga estoque do dia antes de reimportar
      await deleteSupabase('estoque_fornecedor', `fornecedor_nome=eq.${encodeURIComponent(upload.fornecedor)}&data_referencia=eq.${hoje}`)
      
      let totalItens = 0
      const avisos = []
      for (const arquivo of upload.arquivos) {
        const itens = await parsearEstoque(arquivo, upload.fornecedor)
        if (itens.length === 0) {
          avisos.push(`⚠️ "${arquivo.name}" — nenhum item reconhecido. Verifique se o formato está correto (colunas esperadas: Descrição/Quant ou DESCRICAO/SALDO ou Texto breve/Saldo).`)
        }
        await insertLotes('estoque_fornecedor', itens)
        totalItens += itens.length
      }
      if (avisos.length > 0) {
        alert(avisos.join('\n\n'))
      }
      atualizarUpload(id, 'status', totalItens > 0 ? 'ok' : 'erro')
      atualizarUpload(id, 'erro', totalItens === 0 ? 'Nenhum item importado — verifique o formato do arquivo' : null)
      atualizarUpload(id, 'resultado', totalItens)
      carregarStats()
    } catch (err) {
      atualizarUpload(id, 'status', 'erro')
      atualizarUpload(id, 'erro', err.message)
    }
    setProcessando(null)
  }

  async function importarPrecos() {
    if (!arqPrecos) { alert('Selecione o arquivo de preços'); return }
    setProcessando('precos')
    try {
      const itens = await parsearPrecos(arqPrecos)
      const hoje = new Date().toISOString().split('T')[0]
      const fors = [...new Set(itens.map(i => i.fornecedor_nome))]
      for (const f of fors) await deleteSupabase('tabela_precos_fornecedor', `fornecedor_nome=eq.${encodeURIComponent(f)}&data_referencia=eq.${hoje}`)
      await insertLotes('tabela_precos_fornecedor', itens)
      setArqPrecos(null)
      carregarStats()
      alert(`✅ Preços importados: ${itens.length} itens de ${fors.join(', ')}`)
    } catch (err) { alert('Erro: ' + err.message) }
    setProcessando(null)
  }

  if (!logado) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f8f6' }}>
      <div style={{ background:'#fff', borderRadius:16, border:'0.5px solid rgba(0,0,0,0.1)', padding:'2.5rem', width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, borderRadius:10, background:'#185FA5', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700 }}>⚙</div>
          <div><div style={{ fontSize:18, fontWeight:600 }}>Trezaço</div><div style={{ fontSize:12, color:'#888780' }}>Admin — Upload de Planilhas</div></div>
        </div>
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={{ fontSize:13, fontWeight:500 }}>E-mail</label>
            <input style={{ padding:'10px 12px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:14, outline:'none' }}
              type="email" value={email} onChange={e => { setEmail(e.target.value); setErroLogin('') }} placeholder="seu@trezaco.com.br" required />
          </div>
          {erroLogin && <div style={{ background:'#FCEBEB', color:'#A32D2D', padding:'10px 12px', borderRadius:8, fontSize:13 }}>{erroLogin}</div>}
          <button style={{ background:'#185FA5', color:'#fff', border:'none', borderRadius:8, padding:'12px', fontSize:15, fontWeight:500, cursor:'pointer' }} type="submit">Entrar</button>
        </form>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8f8f6' }}>
      <header style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.1)', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:'#185FA5', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>⚙</div>
          <div><div style={{ fontWeight:600, fontSize:15 }}>Trezaço</div><div style={{ fontSize:12, color:'#888780' }}>Admin — {logado}</div></div>
        </div>
        <button style={{ fontSize:13, color:'#888780', background:'none', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:6, padding:'6px 12px', cursor:'pointer' }}
          onClick={() => { sessionStorage.removeItem('admin_email'); setLogado(null) }}>Sair</button>
      </header>

      <div style={{ maxWidth:800, margin:'24px auto', padding:'0 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:24 }}>
          <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #1D9E75' }}>
            <div style={{ fontSize:24, fontWeight:700, color:'#1D9E75' }}>{stats.estoque.toLocaleString('pt-BR')}</div>
            <div style={{ fontSize:12, color:'#888780', marginTop:4 }}>Itens de estoque</div>
          </div>
          <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #185FA5' }}>
            <div style={{ fontSize:24, fontWeight:700, color:'#185FA5' }}>{stats.precos}</div>
            <div style={{ fontSize:12, color:'#888780', marginTop:4 }}>Itens de preço</div>
          </div>
          <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', borderLeft:'3px solid #EF9F27' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#EF9F27' }}>{stats.fornecedores.length > 0 ? stats.fornecedores.join(', ') : '—'}</div>
            <div style={{ fontSize:12, color:'#888780', marginTop:4 }}>Fornecedores com estoque hoje</div>
          </div>
        </div>

        <div style={{ background:'#E6F1FB', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:13, color:'#0C447C' }}>
          📋 <strong>Formatos aceitos:</strong> XLS/XLSX (Marcegaglia, Itaúna, Cariacica) · CSV (Tuper) · HTM/HTML (SAP: Tubos/Chapas/Perfis/Vigas · CXS/CLP) · PDF
        </div>

        <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.5rem', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>📦</span>
              <div style={{ fontSize:15, fontWeight:600 }}>Planilhas de Estoque</div>
            </div>
            <button onClick={adicionarUpload} style={{ background:'#1D9E75', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:13, cursor:'pointer' }}>+ Adicionar</button>
          </div>

          {uploads.length === 0 && (
            <div style={{ textAlign:'center', padding:'1.5rem', color:'#888780', fontSize:13 }}>Clique em "+ Adicionar" para importar planilhas de estoque</div>
          )}

          {uploads.map(u => (
            <div key={u.id} style={{ padding:'12px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'180px 1fr auto', gap:10, alignItems:'flex-start' }}>
                <input style={{ padding:'8px 10px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:13, outline:'none' }}
                  placeholder="Fornecedor" value={u.fornecedor} onChange={e => atualizarUpload(u.id, 'fornecedor', e.target.value)} />
                <div>
                  <input type="file" accept=".xlsx,.xls,.csv,.html,.htm,.pdf" multiple
                    style={{ width:'100%', padding:'7px 10px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:12, cursor:'pointer' }}
                    onChange={e => atualizarUpload(u.id, 'arquivos', Array.from(e.target.files))} />
                  {u.arquivos?.length > 0 && (
                    <div style={{ fontSize:11, color:'#888780', marginTop:4 }}>
                      {u.arquivos.length} arquivo{u.arquivos.length > 1 ? 's' : ''} selecionado{u.arquivos.length > 1 ? 's' : ''}: {u.arquivos.map(f => f.name).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {u.status === 'pendente' && (
                    <button onClick={() => importarEstoque(u.id)} disabled={!u.fornecedor || !u.arquivos?.length || !!processando}
                      style={{ background: (!u.fornecedor || !u.arquivos?.length || !!processando) ? '#E0DED8' : '#185FA5', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                      Importar
                    </button>
                  )}
                  {u.status === 'processando' && <span style={{ fontSize:12, color:'#EF9F27', whiteSpace:'nowrap' }}>⏳ Lendo...</span>}
                  {u.status === 'ok' && <span style={{ fontSize:12, color:'#1D9E75', whiteSpace:'nowrap' }}>✓ {u.resultado?.toLocaleString('pt-BR')} itens</span>}
                  {u.status === 'erro' && <span style={{ fontSize:12, color:'#E24B4A', whiteSpace:'nowrap' }} title={u.erro}>✗ Erro</span>}
                  <button onClick={() => setUploads(us => us.filter(x => x.id !== u.id))} style={{ background:'none', border:'none', color:'#888780', cursor:'pointer', fontSize:18 }}>×</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Estoque Interno Trezaço */}
        <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.5rem', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>🏭</span>
              <div style={{ fontSize:15, fontWeight:600 }}>Estoque Interno Trezaço</div>
            </div>
          </div>
          <div style={{ fontSize:12, color:'#888780', marginBottom:12, background:'#F1EFE8', borderRadius:8, padding:'8px 12px' }}>
            PDF "Posição de Estoque" do ERP — uma filial por vez. A filial é detectada automaticamente do cabeçalho.
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
            <input type="file" accept=".pdf" multiple
              style={{ flex:1, padding:'8px 12px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:13, cursor:'pointer', minWidth:200 }}
              onChange={e => setArqPosEstoque(Array.from(e.target.files))} />
            <button onClick={importarPosEstoque} disabled={!arqPosEstoque?.length || processando === 'pos_estoque'}
              style={{ background: (!arqPosEstoque?.length || processando === 'pos_estoque') ? '#E0DED8' : '#1D9E75', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px', fontSize:14, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
              {processando === 'pos_estoque' ? '⏳ Importando...' : '📥 Importar estoque'}
            </button>
          </div>
          {stats.posEstoque > 0 && (
            <div style={{ fontSize:12, color:'#1D9E75', marginTop:8 }}>✓ {stats.posEstoque.toLocaleString('pt-BR')} itens no banco · filiais: {stats.posFiliais?.join(', ')}</div>
          )}
        </div>

        <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:20 }}>💰</span>
            <div style={{ fontSize:15, fontWeight:600 }}>Tabela de Preços (todos os fornecedores)</div>
          </div>
          <div style={{ fontSize:12, color:'#888780', marginBottom:12, background:'#F1EFE8', borderRadius:8, padding:'8px 12px' }}>
            Uma aba por fornecedor: Marcegaglia, Tuper, Soufer, Sigma, Perfipar
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <input type="file" accept=".xlsx" style={{ flex:1, padding:'8px 12px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:13, cursor:'pointer' }}
              onChange={e => setArqPrecos(e.target.files[0])} />
            <button onClick={importarPrecos} disabled={!arqPrecos || processando === 'precos'}
              style={{ background: (!arqPrecos || processando === 'precos') ? '#E0DED8' : '#185FA5', color:'#fff', border:'none', borderRadius:8, padding:'10px 18px', fontSize:14, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
              {processando === 'precos' ? '⏳ Importando...' : '📥 Importar preços'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
