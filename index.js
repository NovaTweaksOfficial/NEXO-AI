// Cloudflare Worker: keeps API keys server-side. Secrets: ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY. Var: ALLOWED_ORIGIN.
export default {async fetch(req, env) {
  const h = {'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*','Access-Control-Allow-Headers': 'content-type','Access-Control-Allow-Methods': 'GET,POST,OPTIONS','content-type': 'application/json'};
  const out = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: h});
  if (req.method === 'OPTIONS') return new Response(null, {headers: h});
  if (req.method === 'GET') return out({ok: true, providers: {anthropic: !!env.ANTHROPIC_API_KEY, openai: !!env.OPENAI_API_KEY, gemini: !!env.GEMINI_API_KEY}});
  try {
    const {provider, model, system = '', messages = [], maxTokens = 1024} = await req.json();
    const mt = Math.min(Number(maxTokens) || 1024, 4096);
    let r, d, text;
    if (provider === 'anthropic') {
      r = await fetch('https://api.anthropic.com/v1/messages', {method: 'POST', headers: {'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'}, body: JSON.stringify({model, max_tokens: mt, system, messages})});
      d = await r.json(); text = (d.content || []).map(c => c.text || '').join('');
    } else if (provider === 'openai') {
      r = await fetch('https://api.openai.com/v1/chat/completions', {method: 'POST', headers: {authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json'}, body: JSON.stringify({model, max_completion_tokens: mt, messages: [{role: 'system', content: system}, ...messages]})});
      d = await r.json(); text = d.choices?.[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {method: 'POST', headers: {'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json'}, body: JSON.stringify({systemInstruction: {parts: [{text: system}]}, generationConfig: {maxOutputTokens: mt}, contents: messages.map(m => ({role: m.role === 'assistant' ? 'model' : 'user', parts: [{text: m.content}]}))})});
      d = await r.json(); text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    } else return out({error: 'Unknown provider'}, 400);
    if (!r.ok) return out({error: d.error?.message || `Provider error ${r.status}`}, 502);
    return out({text});
  } catch (e) { return out({error: String(e.message || e)}, 500); }
}};
