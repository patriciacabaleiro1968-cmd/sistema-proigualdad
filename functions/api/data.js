// functions/api/data.js
// Endpoint de lectura para el dashboard: devuelve datos crudos + agregados.
// Filtros: ?anio=2025&componente=C1&mes=Marzo

export async function onRequestGet({ env, request }) {
  try {
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY; // service_role key

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ ok: false, error: 'Faltan variables de entorno' }, 500);
    }

    const urlReq = new URL(request.url);
    const anio = urlReq.searchParams.get('anio')?.trim() || null;
    const componente = urlReq.searchParams.get('componente')?.trim() || null;
    const mes = urlReq.searchParams.get('mes')?.trim() || null;

    const MONTHS = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio',
      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];
    if (anio && !['2025','2026','2027'].includes(anio)) {
      return json({ ok:false, error:'Parámetro anio inválido (use 2025/2026/2027)' }, 400);
    }
    if (componente && !['C1','C2','C3'].includes(componente.toUpperCase())) {
      return json({ ok:false, error:'Parámetro componente inválido (use C1/C2/C3)' }, 400);
    }
    if (mes && !MONTHS.includes(capitalize(mes))) {
      return json({ ok:false, error:'Parámetro mes inválido (use Enero..Diciembre)' }, 400);
    }

    const qp = new URLSearchParams();
    qp.set('select', [
      'created_at',
      'anio_gestion',
      'mes',
      'componente',
      'objetivo',
      'indicador',
      'descripcion',
      'observaciones',
      'evidencia_url'
    ].join(','));
    if (anio) qp.set('anio_gestion', `eq.${Number(anio)}`);
    if (componente) qp.set('componente', `eq.${componente.toUpperCase()}`);
    if (mes) qp.set('mes', `eq.${capitalize(mes)}`);
    qp.set('order', 'created_at.desc');
    qp.set('limit', '10000');

    const restURL = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/entradas_form?${qp.toString()}`;
    const resp = await fetch(restURL, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Accept-Profile': 'public'
      }
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return json({ ok:false, error:`Supabase ${resp.status}: ${txt}` }, 500);
    }

    const rows = await resp.json();

    const byComponente = aggregateCount(rows, r => r.componente);
    const byIndicador  = aggregateCount(rows, r => `${r.componente}||${r.indicador}`)
      .map(({ key, total }) => {
        const [comp, ind] = key.split('||'); return { componente: comp, indicador: ind, total };
      });
    const MONTHS = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio',
      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];
    const byMes = aggregateCount(rows, r => `${r.componente}||${r.mes}`)
      .map(({ key, total }) => {
        const [comp, m] = key.split('||'); return { componente: comp, mes: m, total };
      })
      .sort((a,b) => {
        const mi = MONTHS.indexOf(a.mes) - MONTHS.indexOf(b.mes);
        return mi !== 0 ? mi : a.componente.localeCompare(b.componente);
      });
    const byAnioComp = aggregateCount(rows, r => `${r.anio_gestion}||${r.componente}`)
      .map(({ key, total }) => {
        const [a, c] = key.split('||'); return { anio_gestion: Number(a), componente: c, total };
      })
      .sort((a,b) => (a.anio_gestion - b.anio_gestion) || a.componente.localeCompare(b.componente));

    return json({
      ok: true,
      filters: {
        anio: anio ? Number(anio) : null,
        componente: componente ? componente.toUpperCase() : null,
        mes: mes ? capitalize(mes) : null
      },
      counts: { total: rows.length },
      data: rows,
      aggregates: {
        byComponente,
        byIndicador,
        byMes,
        byAnioComponente: byAnioComp
      },
      meta: { schemaVersion: 1 }
    }, 200, { 'Cache-Control': 'no-store' });

  } catch (err) {
    return json({ ok:false, error: String(err) }, 500);
  }
}

/* ===== Helpers ===== */
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}
function capitalize(s) {
  if (!s) return s;
  const t = String(s).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function aggregateCount(list, keyFn) {
  const map = new Map();
  for (const r of list) {
    const key = keyFn(r);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, total]) => (String(key).includes('||') ? ({ key, total }) : ({ componente: key, total })))
    .sort((a,b) => b.total - a.total);
}
