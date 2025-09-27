export const onRequestPost = async ({ request, env }) => {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ ok: false, error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en Environment variables' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const { anio_gestion, mes, componente, url, id_actividad } = body || {};

    // Validaciones simples
    const aniosOk = [2025, 2026, 2027];
    const mesesOk = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const compOk  = ['C1','C2','C3'];

    if (!aniosOk.includes(Number(anio_gestion))) {
      return json({ ok:false, error:'anio_gestion debe ser 2025, 2026 o 2027' }, 400);
    }
    if (!mesesOk.includes(String(mes))) {
      return json({ ok:false, error:'mes debe ser 01..12' }, 400);
    }
    if (!compOk.includes(String(componente))) {
      return json({ ok:false, error:'componente debe ser C1/C2/C3' }, 400);
    }
    if (url && !/^https?:\/\//i.test(url)) {
      return json({ ok:false, error:'URL debe iniciar con http:// o https://' }, 400);
    }

    const insertObj = {
      anio_gestion: Number(anio_gestion),
      mes: String(mes),
      componente: String(componente),
      url: url || null
    };
    if (id_actividad) insertObj.id_actividad = id_actividad; // opcional

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/entradas_form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(insertObj)
    });

    if (!resp.ok) {
      const err = await safeJson(resp);
      return json({ ok:false, error: err?.message || `Error Supabase (${resp.status})` }, 500);
    }

    const data = await resp.json();
    return json({ ok:true, data: Array.isArray(data) ? data[0] : data }, 200);
  } catch (e) {
    return json({ ok:false, error: e.message || 'Error inesperado' }, 500);
  }
};

// Helpers
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
async function safeJson(resp) { try { return await resp.json(); } catch { return null; } }
