// /functions/api/submit.js (Cloudflare Pages Functions)
export async function onRequestPost({ request, env }) {
  try {
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: 'Faltan variables de entorno' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Lee el cuerpo (JSON) que envía tu formulario
    const payload = await request.json();

    // Validación mínima
    const required = ['Anio_Gestion','Mes','Componente','Objetivo','Indicador','Descripcion'];
    for (const k of required) {
      if (!payload[k] || String(payload[k]).trim() === '') {
        return new Response(JSON.stringify({ ok:false, error:`Falta campo: ${k}` }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Toma IP y User-Agent (si no quieres guardar, elimina estas 2 líneas y quita las columnas del row)
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';

    // Mapea nombres del formulario → columnas de la tabla
    const row = {
      anio_gestion: Number(payload.Anio_Gestion),
      mes: String(payload.Mes),
      componente: String(payload.Componente),
      objetivo: String(payload.Objetivo),
      indicador: String(payload.Indicador),
      descripcion: String(payload.Descripcion).trim(),
      observaciones: (payload.Observaciones || '').trim(),
      evidencia_url: (payload.Evidencia_URL || '').trim(),
      user_agent: ua,
      ip
    };

    // Inserta en Supabase usando la API REST (PostgREST)
    const url = `${SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/entradas_form`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify(row)
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ ok:false, error:`Supabase ${resp.status}: ${text}` }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify({ ok:true, data }), {
      status: 201, headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok:false, error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
