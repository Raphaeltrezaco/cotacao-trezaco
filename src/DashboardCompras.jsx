import { useEffect, useMemo, useState } from 'react';
// AJUSTE O CAMINHO se o seu client ficar em outro lugar:
import { supabase as supabase } from './supabase';

// Quem vê o dashboard. Só o usuário de compras.
const EMAILS_COMPRAS = ['compras@trezaco.com.br', 'raphael@trezaco.com.br'];

const TZ = 'America/Sao_Paulo';

/* ---------- semana anterior (segunda 00:00 até domingo 23:59, Brasília) ---------- */
function semanaAnterior(agora = new Date()) {
  // "hoje" no calendário de Brasília, independente do fuso da máquina
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(agora);
  const g = (t) => f.find((x) => x.type === t).value;
  const hoje = new Date(`${g('year')}-${g('month')}-${g('day')}T00:00:00-03:00`);

  const dow = hoje.getUTCDay();           // 0 dom, 1 seg...
  const diasDesdeSegunda = (dow + 6) % 7; // seg=0, dom=6
  const segundaDestaSemana = new Date(hoje.getTime() - diasDesdeSegunda * 864e5);
  const ini = new Date(segundaDestaSemana.getTime() - 7 * 864e5);
  const fim = segundaDestaSemana;
  return { ini, fim, ehSegunda: dow === 1 };
}

const fmtData = (d) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(d);
const fmtDataHora = (s) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(s));
const num = (v, d = 0) =>
  v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });

function mediana(arr) {
  const a = arr.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/* ---------- busca paginada: sem o teto de 1000 do PostgREST ---------- */
async function todos(query, passo = 1000) {
  const out = [];
  for (let de = 0; ; de += passo) {
    const { data, error } = await query.range(de, de + passo - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < passo) break;
  }
  return out;
}

export default function DashboardCompras({ email }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState(null);

  const { ini, fim, ehSegunda } = useMemo(() => semanaAnterior(), []);
  const autorizado = EMAILS_COMPRAS.includes((email || '').trim().toLowerCase());

  useEffect(() => {
    if (!autorizado) { setCarregando(false); return; }
    let vivo = true;

    (async () => {
      try {
        const pedidos = await todos(
          supabase.from('pedidos_cotacao')
            .select('id,numero_pedido,numero_cotacao,criado_em,item_codigo,item_descricao,'
                  + 'classe,quantidade,unidade,filial,status,destino,vendedor_id')
            .gte('criado_em', ini.toISOString())
            .lt('criado_em', fim.toISOString())
            .order('criado_em', { ascending: true })
        );

        const abertos = await todos(
          supabase.from('pedidos_cotacao')
            .select('id,numero_pedido,criado_em,item_descricao,quantidade,unidade,filial,classe')
            .eq('status', 'aberto')
            .eq('destino', 'comprador')
            .order('criado_em', { ascending: true })
        );

        const ids = pedidos.map((p) => p.id);
        let respostas = [];
        for (let i = 0; i < ids.length; i += 200) {
          respostas.push(...await todos(
            supabase.from('respostas_cotacao')
              .select('pedido_id,fornecedor_id,preco_unitario,prazo_entrega_dias,criado_em')
              .in('pedido_id', ids.slice(i, i + 200))
          ));
        }

        const criticos = await todos(
          supabase.from('itens_classe')
            .select('item_codigo,filial,abc,xyz,urgencia,disponivel,comprar,dias_cobertura')
            .neq('urgencia', 'OK')
        );

        const forn = await todos(supabase.from('fornecedores').select('id,nome'));

        if (vivo) setDados({ pedidos, abertos, respostas, criticos, forn });
      } catch (e) {
        if (vivo) setErro(e.message || String(e));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => { vivo = false; };
  }, [autorizado, ini, fim]);

  const calc = useMemo(() => {
    if (!dados) return null;
    const { pedidos, abertos, respostas, criticos, forn } = dados;

    // primeira resposta por pedido -> SLA
    const primeira = new Map();
    for (const r of respostas) {
      const t = Date.parse(r.criado_em);
      if (!r.pedido_id || Number.isNaN(t)) continue;
      const cur = primeira.get(r.pedido_id);
      if (cur == null || t < cur) primeira.set(r.pedido_id, t);
    }
    const slas = pedidos.map((p) => {
      const t1 = primeira.get(p.id);
      return t1 == null ? null : (t1 - Date.parse(p.criado_em)) / 36e5;
    }).filter((x) => x != null);

    // top 5 itens da semana
    const porItem = new Map();
    for (const p of pedidos) {
      const k = p.item_codigo || p.item_descricao || '(sem código)';
      const a = porItem.get(k) || {
        codigo: p.item_codigo, desc: p.item_descricao, vezes: 0, kg: 0, cotacoes: new Set(),
      };
      a.vezes += 1;
      if ((p.unidade || '').toLowerCase() === 'kg') a.kg += Number(p.quantidade) || 0;
      if (p.numero_cotacao) a.cotacoes.add(String(p.numero_cotacao).trim());
      porItem.set(k, a);
    }
    const top5 = [...porItem.values()].sort((a, b) => b.vezes - a.vezes || b.kg - a.kg).slice(0, 5);

    // idade dos pedidos em aberto
    const agora = Date.now();
    const faixas = [
      { rot: 'até 24 h', min: 0, max: 24 },
      { rot: '1 a 3 dias', min: 24, max: 72 },
      { rot: '3 a 7 dias', min: 72, max: 168 },
      { rot: 'mais de 7 dias', min: 168, max: Infinity },
    ].map((f) => ({ ...f, n: 0 }));
    for (const p of abertos) {
      const h = (agora - Date.parse(p.criado_em)) / 36e5;
      const f = faixas.find((x) => h >= x.min && h < x.max);
      if (f) f.n += 1;
    }

    // urgência: o que foi cotado x o que ficou de fora
    const chaveCrit = new Set(criticos.map((c) => `${c.filial}|${c.item_codigo}`));
    const cotadosCrit = pedidos.filter((p) => chaveCrit.has(`${p.filial}|${p.item_codigo}`));
    const cotadosSet = new Set(pedidos.map((p) => `${p.filial}|${p.item_codigo}`));
    const naoCotados = criticos
      .filter((c) => !cotadosSet.has(`${c.filial}|${c.item_codigo}`))
      .sort((a, b) => (a.dias_cobertura ?? 1e9) - (b.dias_cobertura ?? 1e9))
      .slice(0, 8);

    // fornecedores que responderam na semana
    const nomeForn = new Map(forn.map((f) => [f.id, f.nome]));
    const porForn = new Map();
    for (const r of respostas) {
      const k = r.fornecedor_id || '(sem fornecedor)';
      const a = porForn.get(k) || { nome: nomeForn.get(k) || '(sem cadastro)', n: 0, prazos: [] };
      a.n += 1;
      if (r.prazo_entrega_dias != null) a.prazos.push(Number(r.prazo_entrega_dias));
      porForn.set(k, a);
    }
    const rankForn = [...porForn.values()].sort((a, b) => b.n - a.n).slice(0, 6);

    // classe e filial
    const porClasse = ['A', 'B', 'C'].map((c) => ({
      rot: `Classe ${c}`, n: pedidos.filter((p) => p.classe === c).length,
    }));
    const porFilial = [...new Set(pedidos.map((p) => p.filial))].filter(Boolean)
      .map((f) => ({ rot: f, n: pedidos.filter((p) => p.filial === f).length }))
      .sort((a, b) => b.n - a.n);

    return {
      total: pedidos.length,
      respondidos: pedidos.filter((p) => primeira.has(p.id)).length,
      semResposta: pedidos.filter((p) => !primeira.has(p.id)).length,
      slaMediana: mediana(slas),
      slaMedia: slas.length ? slas.reduce((a, b) => a + b, 0) / slas.length : null,
      acima24: slas.filter((s) => s > 24).length,
      kgTotal: pedidos.filter((p) => (p.unidade || '').toLowerCase() === 'kg')
        .reduce((a, p) => a + (Number(p.quantidade) || 0), 0),
      top5, faixas, abertosTotal: abertos.length, maisVelhos: abertos.slice(0, 5),
      cotadosCrit: cotadosCrit.length, naoCotados, rankForn, porClasse, porFilial,
    };
  }, [dados]);

  /* ---------- estilos ---------- */
  const S = {
    wrap: { padding: 24, background: '#f2f3f4', minHeight: '100%', color: '#1a1d21',
      fontFamily: '-apple-system,"Segoe UI",Roboto,Arial,sans-serif' },
    h1: { fontSize: 19, letterSpacing: '.06em', textTransform: 'uppercase', margin: '0 0 2px', fontWeight: 700 },
    sub: { color: '#3d454e', fontSize: 13, margin: '0 0 20px' },
    faixa: { background: '#2b3138', color: '#fff', padding: '10px 14px', fontSize: 13,
      borderLeft: '4px solid #f2b705', marginBottom: 18 },
    grid: { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' },
    card: { background: '#fff', border: '1px solid #c9ccd1', borderTop: '3px solid #2b3138', padding: '14px 16px' },
    lbl: { fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', color: '#3d454e',
      fontWeight: 600, margin: '0 0 10px' },
    kpi: { fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 30, fontWeight: 700, lineHeight: 1 },
    kpiSub: { fontSize: 12, color: '#3d454e', marginTop: 4 },
    row: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline',
      padding: '7px 0', borderBottom: '1px solid #eceef0', fontSize: 13 },
    mono: { fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 12 },
    barBg: { height: 6, background: '#eceef0', marginTop: 5 },
    bar: (pct, cor) => ({ height: 6, width: `${pct}%`, background: cor || '#2b3138' }),
    tag: (cor) => ({ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', padding: '2px 6px',
      color: '#fff', background: cor, whiteSpace: 'nowrap' }),
  };
  const corUrg = (u) => (u === 'URGENTE' ? '#b3261e' : u === 'CRÍTICO' ? '#c8641b' : '#8a7300');

  if (!autorizado) {
    return (
      <div style={S.wrap}>
        <h1 style={S.h1}>Dashboard de compras</h1>
        <p style={S.sub}>Esta tela é restrita ao usuário de compras.</p>
      </div>
    );
  }
  if (carregando) return <div style={S.wrap}><p style={S.sub}>Carregando os dados da semana…</p></div>;
  if (erro) {
    return (
      <div style={S.wrap}>
        <h1 style={S.h1}>Dashboard de compras</h1>
        <div style={{ ...S.card, borderTopColor: '#b3261e' }}>
          <p style={S.lbl}>Não foi possível carregar</p>
          <p style={{ fontSize: 13, margin: 0 }}>{erro}</p>
          <p style={{ fontSize: 12, color: '#3d454e', marginBottom: 0 }}>
            Se a mensagem citar <code>itens_classe</code>, a tabela ainda não foi criada —
            rode o <code>reclassificacao.sql</code> primeiro.
          </p>
        </div>
      </div>
    );
  }

  const c = calc;
  const maxTop = Math.max(...c.top5.map((t) => t.vezes), 1);

  return (
    <div style={S.wrap}>
      <h1 style={S.h1}>Dashboard de compras</h1>
      <p style={S.sub}>
        Semana de {fmtData(ini)} a {fmtData(new Date(fim.getTime() - 864e5))} — a semana fechada.
      </p>

      {ehSegunda && (
        <div style={S.faixa}>
          <strong>É segunda.</strong> Este é o fechamento da semana passada:
          {' '}{num(c.total)} cotações, {num(c.kgTotal)} kg, mediana de SLA em {num(c.slaMediana, 1)} h.
        </div>
      )}

      <div style={S.grid}>
        <div style={S.card}>
          <p style={S.lbl}>Cotações na semana</p>
          <div style={S.kpi}>{num(c.total)}</div>
          <p style={S.kpiSub}>{num(c.respondidos)} respondidas · {num(c.semResposta)} sem resposta</p>
        </div>
        <div style={S.card}>
          <p style={S.lbl}>SLA da 1ª resposta</p>
          <div style={S.kpi}>{num(c.slaMediana, 1)}<span style={{ fontSize: 14 }}> h</span></div>
          <p style={S.kpiSub}>mediana · média {num(c.slaMedia, 1)} h</p>
        </div>
        <div style={S.card}>
          <p style={S.lbl}>Passaram de 24 h</p>
          <div style={{ ...S.kpi, color: c.acima24 ? '#b3261e' : '#2f6b3a' }}>{num(c.acima24)}</div>
          <p style={S.kpiSub}>
            {c.respondidos ? `${num(c.acima24 / c.respondidos * 100, 0)}% das respondidas` : '—'}
          </p>
        </div>
        <div style={S.card}>
          <p style={S.lbl}>Volume cotado</p>
          <div style={S.kpi}>{num(c.kgTotal)}<span style={{ fontSize: 14 }}> kg</span></div>
          <p style={S.kpiSub}>só itens lançados em kg</p>
        </div>
      </div>

      <div style={{ ...S.grid, marginTop: 14 }}>
        <div style={{ ...S.card, gridColumn: 'span 2', minWidth: 0 }}>
          <p style={S.lbl}>Top 5 itens cotados na semana</p>
          {c.top5.length === 0 && <p style={{ fontSize: 13 }}>Nenhuma cotação na semana.</p>}
          {c.top5.map((t, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #eceef0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13 }}>
                  <span style={S.mono}>{t.codigo || '—'}</span> · {t.desc}
                </span>
                <span style={{ ...S.mono, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.vezes}×</span>
              </div>
              <div style={S.barBg}><div style={S.bar(t.vezes / maxTop * 100, '#f2b705')} /></div>
              <span style={{ fontSize: 11, color: '#3d454e' }}>
                {num(t.kg)} kg · {t.cotacoes.size} cotação(ões)
              </span>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <p style={S.lbl}>Em aberto, por idade</p>
          <div style={{ ...S.kpi, marginBottom: 10 }}>{num(c.abertosTotal)}</div>
          {c.faixas.map((f) => (
            <div key={f.rot} style={S.row}>
              <span>{f.rot}</span>
              <span style={{ ...S.mono, fontWeight: 700,
                color: f.min >= 72 && f.n ? '#b3261e' : undefined }}>{f.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...S.grid, marginTop: 14 }}>
        <div style={S.card}>
          <p style={S.lbl}>Aguardando há mais tempo</p>
          {c.maisVelhos.length === 0 && <p style={{ fontSize: 13 }}>Nada em aberto.</p>}
          {c.maisVelhos.map((p) => (
            <div key={p.id} style={S.row}>
              <span>
                <span style={S.mono}>#{p.numero_pedido}</span> {p.item_descricao}
                <br /><span style={{ fontSize: 11, color: '#3d454e' }}>
                  {p.filial} · {fmtDataHora(p.criado_em)}
                </span>
              </span>
              <span style={{ ...S.mono, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {num((Date.now() - Date.parse(p.criado_em)) / 864e5, 0)} d
              </span>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <p style={S.lbl}>Estoque crítico não cotado</p>
          <p style={{ fontSize: 12, color: '#3d454e', marginTop: -4 }}>
            {num(c.cotadosCrit)} itens críticos foram cotados na semana. Estes não:
          </p>
          {c.naoCotados.length === 0 && <p style={{ fontSize: 13 }}>Nenhum item crítico de fora.</p>}
          {c.naoCotados.map((x, i) => (
            <div key={i} style={S.row}>
              <span>
                <span style={S.mono}>{x.item_codigo}</span> · {x.filial}
                <br /><span style={{ fontSize: 11, color: '#3d454e' }}>
                  cobertura {num(x.dias_cobertura, 1)} d · comprar {num(x.comprar)} kg
                </span>
              </span>
              <span style={S.tag(corUrg(x.urgencia))}>{x.urgencia}</span>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <p style={S.lbl}>Fornecedores que responderam</p>
          {c.rankForn.length === 0 && <p style={{ fontSize: 13 }}>Sem respostas na semana.</p>}
          {c.rankForn.map((f, i) => (
            <div key={i} style={S.row}>
              <span>{f.nome}
                <br /><span style={{ fontSize: 11, color: '#3d454e' }}>
                  prazo médio {f.prazos.length
                    ? num(f.prazos.reduce((a, b) => a + b, 0) / f.prazos.length, 1) + ' d'
                    : '—'}
                </span>
              </span>
              <span style={{ ...S.mono, fontWeight: 700 }}>{f.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...S.grid, marginTop: 14 }}>
        <div style={S.card}>
          <p style={S.lbl}>Por classe</p>
          {c.porClasse.map((x) => (
            <div key={x.rot} style={S.row}><span>{x.rot}</span>
              <span style={{ ...S.mono, fontWeight: 700 }}>{x.n}</span></div>
          ))}
        </div>
        <div style={S.card}>
          <p style={S.lbl}>Por filial</p>
          {c.porFilial.map((x) => (
            <div key={x.rot} style={S.row}><span>{x.rot}</span>
              <span style={{ ...S.mono, fontWeight: 700 }}>{x.n}</span></div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#3d454e', marginTop: 18 }}>
        Semana contada de segunda a domingo, horário de Brasília. SLA = horas entre a criação do
        pedido e a primeira resposta de fornecedor. Estoque e urgência vêm da tabela
        <code> itens_classe</code>, com a data de referência da última importação.
      </p>
    </div>
  );
}
