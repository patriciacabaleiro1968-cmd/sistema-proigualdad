// functions/api/submit.js

const COMP_OK = ['C1','C2','C3','C4'];

function monthToMM(v){
  if (!v) return '';
  const mapa = {
    enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', setiembre:'09',
    octubre:'10', noviembre:'11', diciembre:'12'
  };
  const s = String(v).trim().toLowerCase();
  if (/^(0[1-9]|1[0-2])$/.test(s)) return s; // ya está en formato "01".."12"
  return mapa[s] || '';
}
function pascalToSnake(key){
  return key
    .replace(/([a-z0-9])([A-Z])/g,'$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g,'$1_$2')
    .toLowerCase();
}
function normalizeIncoming(obj){
  const out = {};
  for (const k in obj) out[pascalToSnake(k)] = obj[k];

  // mes
  if (out.mes) out.mes = monthToMM(out.mes);

  // componente
  if (out.componente){
    const v = String(out.componente).trim().toUpperCase();
    const m = v.match(/COMPONENTE\\s*([1-4])/i) || v.match(/^C([1-4])$/);
    out.componente = m ? `C${m[1]}` : v;
  }
  return out;
}
function bad(msg){ return new Response(msg, { status:400 }); }

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response('Faltan variables SUPABASE_URL/SUPABASE_ANON_KEY', { status: 500 });
  }

  let incoming;
  try { incoming = await request.json(); } catch {
    return bad('JSON inválido');
  }
  const data = normalizeIncoming(incoming);

  if (!data.anio_gestion) return bad('anio_gestion requerido');
  if (!data.mes || !/^(0[1-9]|1[0-2])$/.test(data.mes)) return bad('mes inválido; use "01".."12"');
  if (!data.componente || !COMP_OK.includes(data.componente)) return bad('componente inválido (use C1..C4)');

  // Inserción vía REST en public.entradas_form
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/entradas_form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([data])
    });
    const body = await resp.text();
    if (!resp.ok) {
      return new Response(body || 'Error al insertar en Supabase', { status: 500 });
    }
    return new Response(body || JSON.stringify({ ok:true }), {
      status: 200,
      headers: { 'Content-Type':'application/json' }
    });
  } catch (e) {
    return new Response('Fallo de red al insertar en Supabase: ' + e.message, { status: 500 });
  }
}
