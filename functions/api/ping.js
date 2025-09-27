// /functions/api/ping.js
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, msg: 'pong' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
