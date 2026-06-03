import { useState, useEffect } from 'react'
import { fetchSupabase } from './supabase'

const URL = 'https://cilbkzvuvwjeqtdpxcbs.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbGJrenZ1dndqZXF0ZHB4Y2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQwNTAsImV4cCI6MjA5MzE1MDA1MH0._bn3Je-gsu4Edc8SKr-fQBVW5dxCOIKn_zxqT61wq2M'
const EMAILS_ADMIN = ['compras@trezaco.com.br', 'raphael@trezaco.com.br', 'brandao@trezaco.com.br']

// Lista fixa de fornecedores de estoque — ordem de exibição na tela
const FORNECEDORES_PADRAO = [
  { nome: 'Marcegaglia',     formatos: 'XLSX' },
  { nome: 'Soufer',          formatos: 'HTM (15 arquivos SAP)' },
  { nome: 'Pana CXS',        formatos: 'HTML' },
  { nome: 'Pana CLP',        formatos: 'HTML' },
  { nome: 'Perfipar',        formatos: 'PDF' },
  { nome: 'Sigma',           formatos: 'PDF' },
  { nome: 'Acofergo',        formatos: 'PDF' },
  { nome: 'Tuper',           formatos: 'XLSX' },
  { nome: 'Simec Itauna',    formatos: 'XLSX' },
  { nome: 'Simec Cariacica', formatos: 'XLSX' },
  { nome: 'Meincol',         formatos: 'XLSX' },
  { nome: 'Usiminas',        formatos: 'XLSX' },
  { nome: 'Tuberfil',        formatos: 'XLSX' },
  { nome: 'Arvedi',          formatos: 'PDF (3 arquivos)' },
  { nome: 'Cosmetal',        formatos: 'PDF' },
]

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

// Marcegaglia: XLS/XLSX — Item, Descrição (pode ser VLOOKUP), Material, Tipo, Espessura, Quant.
async function parsearMarcegaglia(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  // cellFormula:false faz SheetJS retornar o valor calculado da fórmula (ex: VLOOKUP)
  const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellText: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
  const hoje = new Date().toISOString().split('T')[0]
  return rows.map(row => {
    // Busca coluna Descrição por várias grafias (encoding pode variar)
    const descKey = Object.keys(row).find(k => k.toLowerCase().replace(/[^a-z]/g,'').startsWith('descri'))
    const desc = String(row[descKey] || row['Description'] || '').trim()
    const descLimpa = desc.replace(/\u0000/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim()
    // Busca coluna Quantidade por várias grafias
    const qtdKey = Object.keys(row).find(k => k.toLowerCase().replace(/[^a-z]/g,'').startsWith('quant'))
    const qtd = parseFloat(String(row[qtdKey] || '0').replace(',', '.')) || 0
    if (!descLimpa || descLimpa.length < 3) return null
    const espKey = Object.keys(row).find(k => k.toLowerCase().includes('espessura'))
    const tipoKey = Object.keys(row).find(k => k.toLowerCase().includes('tipo'))
    const matKey = Object.keys(row).find(k => k.toLowerCase() === 'material')
    return {
      fornecedor_nome: fornecedor,
      item_codigo: String(row['Item'] || '').trim() || null,
      item_descricao: descLimpa,
      material: matKey ? String(row[matKey] || '').trim() || null : null,
      tipo_material: tipoKey ? String(row[tipoKey] || '').trim() || null : null,
      espessura: espKey ? String(row[espKey] || '').trim() || null : null,
      quantidade: qtd,
      data_referencia: hoje
    }
  }).filter(Boolean)
}

// Meincol: XLSX — Descrição | Preço (sem quantidade — importa com qtd=1 para aparecer no match)
async function parsearMeincol(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellText: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
  const hoje = new Date().toISOString().split('T')[0]
  const nk = k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'')
  return rows.map(row => {
    const descKey = Object.keys(row).find(k => nk(k).startsWith('descri'))
    const desc = String(row[descKey] || '').trim()
    if (!desc || desc.length < 3) return null
    return { fornecedor_nome: fornecedor, item_codigo: null, item_descricao: desc, material: null, tipo_material: null, espessura: null, quantidade: 1, data_referencia: hoje }
  }).filter(Boolean)
}
async function parsearTuper(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellText: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
  const hoje = new Date().toISOString().split('T')[0]
  const nk = k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'')
  return rows.map(row => {
    const descKey = Object.keys(row).find(k => nk(k).startsWith('descri'))
    const desc = String(row[descKey] || '').trim()
    const qtdKgKey = Object.keys(row).find(k => nk(k) === 'quantidadekg')
    const qtd = parseFloat(String(row[qtdKgKey] || '0').replace(',', '.')) || 0
    if (!desc || qtd === 0) return null
    const codKey = Object.keys(row).find(k => nk(k).startsWith('codigoitem') || nk(k) === 'codigoitem')
    const famKey = Object.keys(row).find(k => nk(k).startsWith('familia') || nk(k).startsWith('familiacomercial'))
    return {
      fornecedor_nome: fornecedor,
      item_codigo: codKey ? String(row[codKey] || '').trim() || null : null,
      item_descricao: desc,
      material: null,
      tipo_material: famKey ? String(row[famKey] || '').trim() || null : null,
      espessura: null,
      quantidade: qtd,
      data_referencia: hoje
    }
  }).filter(Boolean)
}
}

// Itaúna/Cariacica: XLSX — CODIGO, DESCRICAO, SALDO (toneladas)
async function parsearItauna(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellText: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
  const hoje = new Date().toISOString().split('T')[0]
  const nk = k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'')
  return rows.map(row => {
    const descKey = Object.keys(row).find(k => nk(k).startsWith('descri') || nk(k) === 'desc')
    const desc = String(row[descKey] || '').trim()
    const saldoKey = Object.keys(row).find(k => nk(k).startsWith('saldo'))
    const qtdTon = parseFloat(String(row[saldoKey] || '0').replace(',', '.')) || 0
    if (!desc || qtdTon === 0) return null
    const codKey = Object.keys(row).find(k => nk(k) === 'codigo' || nk(k) === 'cod')
    return {
      fornecedor_nome: fornecedor,
      item_codigo: codKey ? String(row[codKey] || '').trim() || null : null,
      item_descricao: desc,
      material: null, tipo_material: null, espessura: null,
      quantidade: qtdTon * 1000,
      data_referencia: hoje
    }
  }).filter(Boolean)
}
async function parsearCXS(file, fornecedor) {
  const texto = await lerArquivoComoTexto(file, 'latin-1')
  const parser = new DOMParser()
  const doc = parser.parseFromString(texto, 'text/html')
  const hoje = new Date().toISOString().split('T')[0]
  const itens = []
  const nk = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'')
  for (const table of doc.querySelectorAll('table')) {
    const rows = table.querySelectorAll('tr')
    let colCodigo = -1, colDesc = -1, colQtd = -1, colUN = -1
    for (let i = 0; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td, th'))
      const vals = cells.map(c => c.textContent.trim())
      if (vals.some(v => nk(v).startsWith('descri'))) {
        vals.forEach((v, idx) => {
          const vn = nk(v)
          if (vn.startsWith('codigo') || vn === 'cod') colCodigo = idx
          if (vn.startsWith('descri')) colDesc = idx
          if (vn.startsWith('qt') || vn.includes('disp')) colQtd = idx
          if (vn === 'un') colUN = idx
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

  const nk = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'')
  const headers = Array.from(rows[0].querySelectorAll('td, th'))
    .map(td => td.textContent.replace(/\xa0/g, ' ').trim())

  const colDesc = headers.findIndex(h => nk(h).includes('textob') || nk(h).includes('textobreve'))
  const colMat  = headers.findIndex(h => nk(h) === 'material')
  const colEsp  = headers.findIndex(h => nk(h).includes('espessura'))
  const colSaldo   = headers.findIndex(h => nk(h) === 'saldo')
  const colEstoque = headers.findIndex(h => nk(h) === 'estoque')
  const colQtd = colSaldo >= 0 ? colSaldo : colEstoque

  if (colDesc < 0 || colQtd < 0) return itens

  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('td'))
      .map(td => td.textContent.replace(/\xa0/g, ' ').trim())
    const desc = cells[colDesc]?.trim()
    if (!desc || desc.length < 3) continue
    const qtd = parseFloat((cells[colQtd] || '0').replace(/\./g, '').replace(',', '.')) || 0
    if (qtd <= 0) continue
    const esp = colEsp >= 0 ? cells[colEsp]?.replace('MM','').trim() : null
    const cod = colMat >= 0 ? cells[colMat]?.trim() : null
    itens.push({ fornecedor_nome: fornecedor, item_codigo: cod || null, item_descricao: desc, material: null, tipo_material: null, espessura: esp || null, quantidade: qtd, data_referencia: hoje })
  }
  return itens
}
async function parsearPDF(file, fornecedor) {
  const pdfjsLib = await carregarPDFJS()
  const buf = await lerArquivoComoArrayBuffer(file)
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const hoje = new Date().toISOString().split('T')[0]
  const itens = []
  const IGNORAR = /^(ff|fq|gi|codigo|descri|total|p.gina|data|emiss|saldo|estoque|item|material|subtotal)/i

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const H = viewport.height

    // Agrupa tokens por linha (Y similar, tolerÂ¢ncia 3px)
    const tokensPorLinha = {}
    for (const item of tc.items) {
      const txt = item.str.replace(/ /g, '').trim()
      if (!txt) continue
      const y = Math.round(H - item.transform[5])
      const x = Math.round(item.transform[4])
      const yKey = Math.round(y / 3) * 3  // agrupa Y com tolerÂ¢ncia 3px
      if (!tokensPorLinha[yKey]) tokensPorLinha[yKey] = []
      tokensPorLinha[yKey].push({ txt, x })
    }

    // Processa cada linha
    for (const yKey of Object.keys(tokensPorLinha).sort((a,b) => +a - +b)) {
      const tokens = tokensPorLinha[yKey].sort((a, b) => a.x - b.x).map(t => t.txt)
      if (tokens.length < 3) continue

      // Último token = quantidade
      const ultimo = tokens[tokens.length - 1]
      if (!/^\d[\d.,]*$/.test(ultimo)) continue
      const qtd = parseFloat(ultimo.replace(/\./g, '').replace(',', '.'))
      if (isNaN(qtd) || qtd <= 0 || qtd > 9999999) continue

      // Detecta se primeiro token é código (Acofergo) ou parte da descrição (Perfipar/Sigma)
      const primeiroToken = tokens[0]
      const temCodigo = /^[A-Za-z0-9]{5,}$/.test(primeiroToken)
        && !IGNORAR.test(primeiroToken)
        && !/^(TUBO|PERFIL|CHAPA|BARRA|BLANK|ROLO|TELHA|LAMBRI|STANLEY|CUMEEIRA)/i.test(primeiroToken)

      let codigo = null
      let descTokens
      if (temCodigo) {
        codigo = primeiroToken
        descTokens = tokens.slice(1, tokens.length - 1)
      } else {
        descTokens = tokens.slice(0, tokens.length - 1)
      }

      const desc = descTokens.join(' ').trim()
      if (!desc || desc.length < 5) continue
      if (/^[\d\/\-\.\s,]+$/.test(desc)) continue
      if (IGNORAR.test(desc)) continue

      // Perfipar/Sigma: qtd em toneladas (ex: 7,8 → 7800 kg). Heurística: valor < 500 = toneladas
      const qtdFinal = qtd < 500 ? qtd * 1000 : qtd

      itens.push({ fornecedor_nome: fornecedor, item_codigo: codigo, item_descricao: desc, material: null, tipo_material: null, espessura: null, quantidade: qtdFinal, data_referencia: hoje })
    }
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
    // Cabeçalho tem "Descrição" — usa o X desse token como Â¢ncora da col descrição
    const tokDesc = tokens.find(t => t.str === 'Descrição')
    const tokEst = tokens.find(t => t.str === 'Estoque' && tokens.find(t2 => t2.str === 'Segurança' && Math.abs(t2.y - t.y) < 20))
    // X da coluna Estoque (não Estoque Segurança)
    // No PDF: Estoque Segurança aparece antes de Estoque
    // Pega o segundo "Estoque" do cabeçalho
    const tokEstAll = tokens.filter(t => t.str === 'Estoque')

    for (const tkCod of codigos) {
      const yCod = tkCod.y
      // Tokens na mesma linha (Â±4px de Y)
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
      // Filtra tokens Â  direita do código e antes dos números
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
// Usiminas: XLSX — DESPRODUTO = "TBC 100x100x2,00LQx6000 BC"
async function parsearUsiminas(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellText: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
  const hoje = new Date().toISOString().split('T')[0]
  return rows.map(row => {
    const desc = String(row['DESPRODUTO'] || row['Descricao'] || '').trim()
    const qtdTon = parseFloat(String(row['Estoque Disponível (tn)'] || row['Estoque Disponivel (tn)'] || row['ESTOQUE'] || 0).replace(',', '.')) || 0
    if (!desc || qtdTon === 0) return null
    // Normaliza: TBC 100x100x2,00LQx6000 → remove sufixos "LQ", "BC", etc.
    const descLimpa = desc.replace(/LQ[x\d]*/gi, 'x').replace(/\s+(BC|RIR|CIV\d+)\s*/gi, '').replace(/x+/g, 'x').trim()
    return {
      fornecedor_nome: fornecedor,
      item_codigo: String(row['CODPRODUTO'] || '').trim() || null,
      item_descricao: descLimpa,
      material: null,
      tipo_material: String(row['Desc_Tipo'] || '').trim() || null,
      espessura: row['ESPESSURA'] ? String(row['ESPESSURA']).trim() : null,
      quantidade: qtdTon * 1000,
      data_referencia: hoje
    }
  }).filter(Boolean)
}

// Tuberfil: XLSX — Descrição = "PE100x100x3,00x6600A PRETO CIV300" / "PL30x30x3,00x6000"
async function parsearTuberfil(file, fornecedor) {
  const XLSX = await carregarXLSX()
  const buf = await lerArquivoComoArrayBuffer(file)
  const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellText: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // Header na linha 1 (índice 1)
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, range: 1 })
  const hoje = new Date().toISOString().split('T')[0]
  return rows.map(row => {
    const desc = String(row['Descrição'] || row['Descricao'] || row['DESCRIÇÂO'] || '').trim()
    const qtdTon = parseFloat(String(row['Qtde'] || row['Quantidade'] || row['QTDE'] || 0).replace(',', '.')) || 0
    if (!desc || qtdTon === 0) return null
    // Normaliza PE/PL prefix: PE100x100x3,00 → TUBO 100x100x3,00 (mantém PE pra o tipo inferer)
    return {
      fornecedor_nome: fornecedor,
      item_codigo: String(row['Material'] || row['Codigo'] || '').trim() || null,
      item_descricao: desc,
      material: null,
      tipo_material: null,
      espessura: null,
      quantidade: qtdTon * 1000,
      data_referencia: hoje
    }
  }).filter(Boolean)
}

// Cosmetal: PDF — categorias em polegadas, estoque em toneladas
// O parsearPDF genérico já funciona para Cosmetal (código alfanum + desc + qtd inteira)
// Mas a quantidade está em toneladas (valor pequeno). Sobrescreve multiplicando por 1000.
async function parsearCosmetal(file, fornecedor) {
  const itens = await parsearPDF(file, fornecedor)
  // Quantidades do Cosmetal são em toneladas (ex: 35, 52) — converte para kg
  return itens.map(item => ({ ...item, quantidade: item.quantidade * 1000 }))
}

async function parsearEstoque(file, fornecedor) {
  const nome = file.name.toLowerCase()
  const ext = nome.split('.').pop()

  // PDF
  if (ext === 'pdf') {
    if (fornecedor === 'Cosmetal') return parsearCosmetal(file, fornecedor)
    return parsearPDF(file, fornecedor)
  }

  // HTML/HTM
  if (ext === 'html' || ext === 'htm') {
    const texto = await lerArquivoComoTexto(file, 'latin-1')
    if (texto.includes('Texto') && (texto.includes('breve') || texto.includes('Saldo'))) {
      return parsearSAP(file, fornecedor)
    }
    return parsearCXS(file, fornecedor)
  }

  // XLSX/XLS/CSV
  if (ext === 'csv') return parsearTuper(file, fornecedor)

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await carregarXLSX()
    const buf = await lerArquivoComoArrayBuffer(file)
    const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellText: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
    if (rows.length === 0) return []
    const cols = Object.keys(rows[0]).map(k => k.toLowerCase())
    const firstRow = rows[0]
    const firstVals = Object.values(firstRow).map(v => String(v).toLowerCase()).join(' ')

    // Usiminas: tem coluna DESPRODUTO
    if (cols.some(c => c.includes('desproduto') || c.includes('codproduto'))) return parsearUsiminas(file, fornecedor)

    // Tuper: tem coluna "Quantidade KG" (busca por prefixo normalizado)
    const nk2 = k => k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/gi,'').toLowerCase()
    if (cols.some(c => nk2(c) === 'quantidadekg')) return parsearTuper(file, fornecedor)

    // Simec Itaúna/Cariacica: tem coluna SALDO
    if (cols.some(c => c.includes('saldo'))) return parsearItauna(file, fornecedor)

    // Tuberfil: tem coluna Material + Descrição + Qtde (header na linha 1)
    // Detecta pelo nome do fornecedor ou pela estrutura (códigos começam com PE/PL/MP)
    if (fornecedor === 'Tuberfil' || firstVals.includes('estoque dpac') || cols.some(c => c.includes('qtde') && c !== 'quantidade')) {
      return parsearTuberfil(file, fornecedor)
    }

    // Meincol: só tem Descrição e Valor/Preço, sem Item/Quantidade
    if (cols.length <= 3 && cols.some(c => c.includes('descri')) && !cols.some(c => c.includes('item') || c.includes('quant'))) {
      return parsearMeincol(file, fornecedor)
    }

    // Fallback: Marcegaglia (Item, Descrição, Material, Espessura, Quant.)
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
  // Estado de importação por fornecedor (chave = nome do fornecedor)
  const [importacoes, setImportacoes] = useState({})
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
      fetchSupabase('estoque_fornecedor', '?select=fornecedor_nome,data_referencia&quantidade=gt.0&order=fornecedor_nome.asc&limit=10000'),
      fetch(`${URL}/rest/v1/pos_estoque?select=*`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' }
      }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
      fetchSupabase('pos_estoque', '?select=filial&limit=1000')
    ])
    // Monta mapa fornecedor -> data mais recente
    const fornMap = {}
    if (Array.isArray(eForn)) {
      for (const x of eForn) {
        if (!fornMap[x.fornecedor_nome] || x.data_referencia > fornMap[x.fornecedor_nome]) {
          fornMap[x.fornecedor_nome] = x.data_referencia
        }
      }
    }
    const filSet = new Set(Array.isArray(posFil) ? posFil.map(x => x.filial) : [])
    setStats({ estoque: eCount, precos: pCount, fornecedores: fornMap, posEstoque: posCount, posFiliais: [...filSet] })
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

  function setImportacao(nome, campos) {
    setImportacoes(prev => ({ ...prev, [nome]: { ...(prev[nome] || {}), ...campos } }))
  }

  async function importarEstoque(nome, arquivos) {
    if (!arquivos?.length) return
    setProcessando('estoque_' + nome)
    setImportacao(nome, { status: 'processando', erro: null })
    try {
      const hoje = new Date().toISOString().split('T')[0]
      await deleteSupabase('estoque_fornecedor', `fornecedor_nome=eq.${encodeURIComponent(nome)}`)
      let totalItens = 0
      const avisos = []
      for (const arquivo of arquivos) {
        const itens = await parsearEstoque(arquivo, nome)
        if (itens.length === 0) avisos.push(`⚠️ "${arquivo.name}" — nenhum item reconhecido.`)
        await insertLotes('estoque_fornecedor', itens)
        totalItens += itens.length
      }
      if (avisos.length > 0) alert(avisos.join('\n\n'))
      setImportacao(nome, { status: totalItens > 0 ? 'ok' : 'erro', resultado: totalItens, erro: totalItens === 0 ? 'Nenhum item importado' : null })
      // Pequeno delay para garantir que o Supabase processou antes de recarregar
      setTimeout(() => carregarStats(), 800)
    } catch (err) {
      setImportacao(nome, { status: 'erro', erro: err.message })
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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
          <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #1D9E75' }}>
            <div style={{ fontSize:24, fontWeight:700, color:'#1D9E75' }}>{stats.estoque.toLocaleString('pt-BR')}</div>
            <div style={{ fontSize:12, color:'#888780', marginTop:4 }}>Itens de estoque</div>
          </div>
          <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', textAlign:'center', borderLeft:'3px solid #185FA5' }}>
            <div style={{ fontSize:24, fontWeight:700, color:'#185FA5' }}>{stats.precos}</div>
            <div style={{ fontSize:12, color:'#888780', marginTop:4 }}>Itens de preço</div>
          </div>
          <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1rem', borderLeft:'3px solid #EF9F27', gridColumn:'1 / -1' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#888780', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>Fornecedores com estoque importado</div>
            {Object.keys(stats.fornecedores || {}).length === 0
              ? <div style={{ fontSize:13, color:'#888780' }}>Nenhum estoque importado ainda hoje</div>
              : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {Object.entries(stats.fornecedores || {}).sort((a,b) => a[0].localeCompare(b[0])).map(([nome, data]) => {
                    const hoje = new Date().toISOString().split('T')[0]
                    const isHoje = data === hoje
                    const dataFmt = data ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '—'
                    return (
                      <div key={nome} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, background: isHoje ? '#E1F5EE' : '#FEF3C7', border: `0.5px solid ${isHoje ? '#1D9E75' : '#F59E0B'}` }}>
                        <span style={{ fontSize:13, fontWeight:600, color: isHoje ? '#085041' : '#633806' }}>{nome}</span>
                        <span style={{ fontSize:11, color: isHoje ? '#1D9E75' : '#F59E0B', fontWeight:500 }}>{isHoje ? '✓ hoje' : dataFmt}</span>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.5rem', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <span style={{ fontSize:20 }}>ð¦</span>
            <div style={{ fontSize:15, fontWeight:600 }}>Planilhas de Estoque</div>
          </div>

          {FORNECEDORES_PADRAO.map(({ nome, formatos }) => {
            const imp = importacoes[nome] || {}
            const ultimaData = stats.fornecedores?.[nome]
            const hoje = new Date().toISOString().split('T')[0]
            const isHoje = ultimaData === hoje
            const dataFmt = ultimaData ? new Date(ultimaData + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : null
            const processandoEste = processando === 'estoque_' + nome

            return (
              <div key={nome} style={{ display:'grid', gridTemplateColumns:'160px 1fr auto', gap:12, alignItems:'center', padding:'10px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
                {/* Nome + última data */}
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{nome}</div>
                  <div style={{ fontSize:11, color:'#888780', marginTop:2 }}>{formatos}</div>
                  {dataFmt && (
                    <div style={{ marginTop:4, display:'inline-flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:5, background: isHoje ? '#E1F5EE' : '#FEF3C7', border:`0.5px solid ${isHoje ? '#1D9E75' : '#F59E0B'}` }}>
                      <span style={{ fontSize:10, fontWeight:600, color: isHoje ? '#085041' : '#633806' }}>{isHoje ? '✓ hoje' : dataFmt}</span>
                    </div>
                  )}
                  {!dataFmt && <div style={{ marginTop:4, fontSize:10, color:'#E24B4A' }}>⚠ não importado</div>}
                </div>

                {/* Seletor de arquivo */}
                <div>
                  <input type="file" accept=".xlsx,.xls,.csv,.html,.htm,.pdf" multiple
                    style={{ width:'100%', padding:'6px 10px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:8, fontSize:12, cursor:'pointer' }}
                    onChange={e => setImportacao(nome, { arquivos: Array.from(e.target.files), status: 'pendente' })} />
                  {imp.arquivos?.length > 0 && (
                    <div style={{ fontSize:11, color:'#888780', marginTop:3 }}>
                      {imp.arquivos.length} arquivo{imp.arquivos.length > 1 ? 's' : ''}: {imp.arquivos.map(f => f.name).join(', ')}
                    </div>
                  )}
                </div>

                {/* Botão importar + status */}
                <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:100 }}>
                  {processandoEste
                    ? <span style={{ fontSize:12, color:'#EF9F27' }}>⏳ Importando...</span>
                    : imp.status === 'ok'
                      ? <span style={{ fontSize:12, color:'#1D9E75' }}>✓ {imp.resultado?.toLocaleString('pt-BR')} itens</span>
                      : imp.status === 'erro'
                        ? <span style={{ fontSize:12, color:'#E24B4A' }} title={imp.erro}>✗ Erro</span>
                        : (
                          <button
                            onClick={() => importarEstoque(nome, imp.arquivos)}
                            disabled={!imp.arquivos?.length || !!processando}
                            style={{ background: (!imp.arquivos?.length || !!processando) ? '#E0DED8' : '#185FA5', color:'#fff', border:'none', borderRadius:8, padding:'7px 14px', fontSize:13, cursor: (!imp.arquivos?.length || !!processando) ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                            Importar
                          </button>
                        )
                  }
                </div>
              </div>
            )
          })}
        </div>

        {/* Estoque Interno Trezaço */}
        <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.5rem', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>ð­</span>
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
              {processando === 'pos_estoque' ? '⏳ Importando...' : 'ð¥ Importar estoque'}
            </button>
          </div>
          {stats.posEstoque > 0 && (
            <div style={{ fontSize:12, color:'#1D9E75', marginTop:8 }}>✓ {stats.posEstoque.toLocaleString('pt-BR')} itens no banco · filiais: {stats.posFiliais?.join(', ')}</div>
          )}
        </div>

        <div style={{ background:'#fff', borderRadius:12, border:'0.5px solid rgba(0,0,0,0.1)', padding:'1.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:20 }}>ð°</span>
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
              {processando === 'precos' ? '⏳ Importando...' : 'ð¥ Importar preços'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
