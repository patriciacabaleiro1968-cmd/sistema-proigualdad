export const onRequestGet = async ({ request, env }) => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ ok: false, error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en Environment variables' }, 500);
    }

    const url = new URL(request.url);
    const anio = url.searchParams.get('anio');        // ej: 2025
    const mes  = url.searchParams.get('mes');         // ej: '01'
    const comp = url.searchParams.get('componente');  // ej: 'C1'
    const agg  = url.searchParams.get('agg');         // 'donut' | 'barras' | 'stacked' | null

    // Agregados por RPC
    if (agg === 'donut') {
      const data = await callRpc(SUPABASE_URL, SUPABASE_SERVICE_KEY, 'ef_donut_comp', { p_anio: anio ? Number(anio) : null });
      return json({ ok:true, data });
    }
    if (agg === 'barras') {
      const data = await callRpc(SUPABASE_URL, SUPABASE_SERVICE_KEY, 'ef_barras_por_actividad', { p_anio: anio ? Number(anio) : null });
      return json({ ok:true, data });
    }
    if (agg === 'stacked') {
      const data = await callRpc(SUPABASE_URL, SUPABASE_SERVICE_KEY, 'ef_stacked_mes_comp', { p_anio: anio ? Number(anio) : null });
      return json({ ok:true, data });
    }

    // Datos crudos (para tablas/export)
    const params = new URLSearchParams();
    params.set('select', '*');
    if (anio) params.set('anio_gestion', `eq.${Number(anio)}`);
    if (mes)  params.set('mes', `eq.${mes}`);
    if (comp) params.set('componente', `eq.${comp}`);

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/entradas_form?${params.toString()}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    if (!resp.ok) {
      const err = await safeJson(resp);
      return json({ ok:false, error: err?.message || `Error Supabase (${resp.status})` }, 500);
    }

    const data = await resp.json();
    return json({ ok:true, data });
  } catch (e) {
    return json({ ok:false, error: e.message || 'Error inesperado' }, 500);
  }
};

// Helpers
async function callRpc(SUPABASE_URL, SERVICE_KEY, fnName, body) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify(body || {})
  });
  if (!resp.ok) {
    const err = await safeJson(resp);
    throw new Error(err?.message || `Error RPC ${fnName} (${resp.status})`);
  }
  return await resp.json();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
async function safeJson(resp) { try { return await resp.json(); } catch { return null; } }
