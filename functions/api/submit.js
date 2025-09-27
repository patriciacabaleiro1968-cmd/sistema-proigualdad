// functions/api/submit.js
// Cloudflare Pages Function: recibe el formulario y guarda en Supabase vía REST.
// Requiere Secrets en Pages: SUPABASE_URL y SUPABASE_SERVICE_KEY

export async function onRequestPost({ request, env }) {
  try {
    const SUPABASE_URL = env.SUPABASE_URL;                 // p.ej. https://xxxx.supabase.co
    const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY; // service_role key

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ ok: false, error: 'Faltan variables de entorno' }, 500);
    }

    // ---- Lee cuerpo (espera JSON) ----
    let payload;
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      payload = await request.json();
    } else {
      // Fallback: si por error llega form-data/urlencoded, lo convertimos
      const form = await request.formData().catch(() => null);
      if (!form) return json({ ok: false, error: 'Content-Type no soportado' }, 400);
      payload = Object.fromEntries(form.entries());
    }

    // ---- Helpers de limpieza ----
    const clean = (v) =>
      typeof v === 'string' ? v.replace(/\u00A0/g, ' ').trim() : v;
    const MONTHS = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio',
      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];

    // ---- Validación mínima de campos obligatorios ----
    const required = ['Anio_Gestion','Mes','Componente','Objetivo','Indicador','Descripcion'];
    for (const k of required) {
      if (!payload[k] || String(payload[k]).trim() === '') {
        return json({ ok:false, error:`Falta campo: ${k}` }, 400);
      }
    }

    // ---- Normalizaciones ----
    // Año
    const anio = Number(clean(payload.Anio_Gestion));
    if (![2025, 2026, 2027].includes(anio)) {
      return json({ ok:false, error:'Anio_Gestion inválido' }, 400);
    }

    // Mes
    const mes = clean(payload.Mes);
    if (!MONTHS.includes(mes)) {
      return json({ ok:false, error:'Mes inválido' }, 400);
    }

    // Componente: aceptar C1/C2/C3 o textos largos que empiecen con "COMPONENTE 1/2/3"
    let componente = clean(payload.Componente);
    if (/^COMPONENTE\s*1/i.test(componente)) componente = 'C1';
    else if (/^COMPONENTE\s*2/i.test(componente)) componente = 'C2';
    else if (/^COMPONENTE\s*3/i.test(componente)) componente = 'C3';
    componente = componente.toUpperCase();
    if (!['C1','C2','C3'].includes(componente)) {
      return json({ ok:false, error:'Componente inválido (debe ser C1/C2/C3)' }, 400);
    }

    // Objetivo / Indicador / Descripción / Observaciones
    const objetivo      = clean(payload.Objetivo);
    const indicador     = clean(payload.Indicador);
    const descripcion   = clean(payload.Descripcion);
    const observaciones = clean(payload.Observaciones || '');

    if (!descripcion) {
      return json({ ok:false, error:'Descripcion vacía' }, 400);
    }

    // Evidencia URL: limpiar NBSP/espacios; forzar https:// si es dominio; NULL si no parece URL
    let evidencia_url = clean(payload.Evidencia_URL || '');
    if (evidencia_url) {
      if (!/^https?:\/\//i.test(evidencia_url)) {
        if (/^(www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(evidencia_url)) {
          evidencia_url = 'https://' + evidencia_url;
        } else {
          evidencia_url = null; // evita violar el CHECK en BD
        }
      }
    } else {
      evidencia_url = null;
    }

    // Enriquecer con cabeceras
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';

    // ---- Mapeo final a columnas de la tabla ----
    const row = {
      anio_gestion: anio,
      mes,
      componente,
      objetivo,
      indicador,
      descripcion,
      observaciones,
      evidencia_url,
      user_agent: ua,
      ip
    };

    // ---- Insert en Supabase (REST / PostgREST) ----
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
      const txt = await resp.text();
      return json({ ok:false, error:`Supabase ${resp.status}: ${txt}` }, 500);
    }

    const data = await resp.json();
    return json({ ok:true, data }, 201);

  } catch (err) {
    return json({ ok:false, error: String(err) }, 500);
  }
}

// Helper para respuestas JSON
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

   
