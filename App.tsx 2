import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {Home, MessageSquare, Wrench, History as Hist, Settings as Cog, Sparkles, Code2, Lightbulb, GraduationCap, Microscope, Search, Plus, Copy, RefreshCw, Square, Send, Trash2, Pencil, ArrowLeft, FileText, PenLine, Repeat, BookOpen, Brain, Wand2, type LucideIcon} from 'lucide-react';
import Robot from './Robot';
import {ask, health, load, save, uid, validChats, DEF, MODELS, VERSION, type Chat, type Msg, type Settings} from './lib';

type Tab = 'home' | 'chat' | 'tools' | 'history' | 'settings';
const MODES: {id: string; name: string; desc: string; Icon: LucideIcon; hue: string; sys: string}[] = [
  {id: 'general', name: 'General', desc: 'Everyday questions and conversation', Icon: Sparkles, hue: '#a855f7', sys: 'You are NEXUS AI, a helpful, concise assistant. Use Markdown.'},
  {id: 'coding', name: 'Coding', desc: 'Debugging, explanations, code generation', Icon: Code2, hue: '#38bdf8', sys: 'You are NEXUS AI in coding mode. Give correct, idiomatic code in fenced code blocks with the language tag, and explain briefly.'},
  {id: 'creative', name: 'Creative', desc: 'Brainstorming, writing, storytelling', Icon: Lightbulb, hue: '#f472b6', sys: 'You are NEXUS AI in creative mode: imaginative, vivid, original.'},
  {id: 'study', name: 'Study', desc: 'Tutoring and learning help', Icon: GraduationCap, hue: '#34d399', sys: 'You are NEXUS AI in study mode: a patient tutor. Explain step by step and check understanding.'},
  {id: 'research', name: 'Research', desc: 'Organize and explain complex topics', Icon: Microscope, hue: '#fbbf24', sys: 'You are NEXUS AI in research mode: structured, careful, and honest about uncertainty. Do not invent sources.'}
];
const TOOLS: {id: string; name: string; Icon: LucideIcon; ph: string; sys: string}[] = [
  {id: 'sum', name: 'Text Summarizer', Icon: FileText, ph: 'Paste text to summarize…', sys: 'Summarize the text: a 2-sentence summary, then key bullet points.'},
  {id: 'write', name: 'Writing Assistant', Icon: PenLine, ph: 'What should I write? Add context and tone…', sys: 'You are a writing assistant. Produce polished writing for the request.'},
  {id: 'code', name: 'Code Helper', Icon: Code2, ph: 'Paste code or describe what you need…', sys: 'You are a code helper. Respond with fenced code and a brief explanation.'},
  {id: 'idea', name: 'Idea Generator', Icon: Lightbulb, ph: 'What do you need ideas for?', sys: 'Generate 8 distinct, specific ideas as a numbered list with one line each.'},
  {id: 'study', name: 'Study Assistant', Icon: GraduationCap, ph: 'Topic or notes to learn…', sys: 'Teach the topic: key concepts, a worked example, then 3 practice questions.'},
  {id: 'rewrite', name: 'Text Rewriter', Icon: Repeat, ph: 'Paste text to rewrite…', sys: 'Rewrite the text for clarity and flow, keeping the meaning. Return only the rewrite.'},
  {id: 'explain', name: 'Explanation Generator', Icon: BookOpen, ph: 'What should I explain?', sys: 'Explain simply with an analogy first, then more detail.'},
  {id: 'brain', name: 'Brainstorm Assistant', Icon: Brain, ph: 'Describe the project or problem…', sys: 'Brainstorm: angles, options, risks, and concrete next steps, in sections.'}
];
const PROMPTS = ['Explain something complicated', 'Help me write something', 'Generate an idea', 'Help me code', 'Analyze a problem', 'Brainstorm a project'];
const ACCENTS = ['#a855f7', '#38bdf8', '#22d3ee', '#f472b6', '#34d399'];

function inline(s: string) {
  return s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((p, i) =>
    p.length > 2 && p.startsWith('`') && p.endsWith('`') ? <code key={i}>{p.slice(1, -1)}</code>
    : p.length > 4 && p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p);
}
function Md({text}: {text: string}) {
  return <>{text.split(/(```[\s\S]*?(?:```|$))/g).map((b, i) => {
    if (b.startsWith('```')) {
      const body = b.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      return <pre key={i}><button className="cp" onClick={() => navigator.clipboard?.writeText(body)}>Copy</button><code>{body}</code></pre>;
    }
    return <div key={i}>{b.split('\n').map((l, j) => /^#{1,3} /.test(l) ? <h4 key={j}>{inline(l.replace(/^#+ /, ''))}</h4>
      : /^[-*] /.test(l) ? <li key={j}>{inline(l.slice(2))}</li> : l.trim() ? <p key={j}>{inline(l)}</p> : null)}</div>;
  })}</>;
}
function Composer({onSend, busy, onStop, initial = '', ph}: {onSend: (t: string) => void; busy: boolean; onStop: () => void; initial?: string; ph: string}) {
  const [t, setT] = useState(initial);
  const submit = () => { if (t.trim()) { onSend(t); setT(''); } };
  return <div className="big">
    <textarea rows={1} value={t} placeholder={ph} aria-label="Message" onChange={e => setT(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) submit(); } }}/>
    {busy ? <button className="go" aria-label="Stop generating" onClick={onStop}><Square size={18}/></button>
      : <button className="go" aria-label="Send" disabled={!t.trim()} onClick={submit}><Send size={18}/></button>}
  </div>;
}

export default function App() {
  const [s, setS] = useState<Settings>(() => ({...DEF, ...load<Partial<Settings>>('nexus.settings', {}, v => !!v && typeof v === 'object' && !Array.isArray(v))}));
  const [chats, setChats] = useState<Chat[]>(() => load<Chat[]>('nexus.chats', [], validChats));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [mode, setMode] = useState('general');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [prov, setProv] = useState<Record<string, boolean> | null>(null);
  const [q, setQ] = useState('');
  const [tool, setTool] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const active = chats.find(c => c.id === activeId) || null;
  const ready = s.demo || (!!prov && !!prov[s.provider]);

  useEffect(() => save('nexus.settings', s), [s]);
  useEffect(() => save('nexus.chats', chats), [chats]);
  useEffect(() => { document.documentElement.style.setProperty('--accent', s.accent); }, [s.accent]);
  useEffect(() => { setProv(null); if (s.workerUrl) health(s.workerUrl).then(setProv); }, [s.workerUrl]);
  useEffect(() => { end.current?.scrollIntoView({behavior: 'smooth'}); }, [active?.msgs.length, busy, tab]);

  const patch = (id: string, f: (c: Chat) => Chat) => setChats(cs => cs.map(c => c.id === id ? f(c) : c));
  async function run(id: string, hist: Msg[], m: string) {
    setBusy(true); const ac = new AbortController(); abort.current = ac;
    try {
      const text = await ask(s, MODES.find(x => x.id === m)!.sys, hist.map(({role, content}) => ({role, content})), ac.signal);
      patch(id, c => ({...c, ts: Date.now(), msgs: [...c.msgs, {id: uid(), role: 'assistant', content: text}]}));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') patch(id, c => ({...c, msgs: [...c.msgs, {id: uid(), role: 'assistant', content: (e as Error).message, err: true}]}));
    } finally { setBusy(false); abort.current = null; }
  }
  function send(text: string) {
    const t = text.trim(); if (!t || busy) return;
    if (!ready) { setDraft(t); setTab('chat'); return; }
    setDraft('');
    const um: Msg = {id: uid(), role: 'user', content: t};
    if (active) { patch(active.id, c => ({...c, msgs: [...c.msgs, um]})); run(active.id, [...active.msgs.filter(x => !x.err), um], active.mode); }
    else { const id = uid(); setChats(cs => [{id, title: t.slice(0, 40), mode, msgs: [um], ts: Date.now()}, ...cs]); setActiveId(id); run(id, [um], mode); }
    setTab('chat');
  }
  function regen() {
    if (!active || busy) return;
    const msgs = [...active.msgs]; while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    patch(active.id, c => ({...c, msgs})); run(active.id, msgs.filter(x => !x.err), active.mode);
  }
  const newChat = () => { abort.current?.abort(); setActiveId(null); setTab('chat'); };
  const curMode = active?.mode || mode;
  const MI = MODES.find(m => m.id === curMode) || MODES[0];

  const Setup = () => <div className="card warn" style={{margin: '10px 0'}}>
    <b>AI backend not connected</b>
    <p className="mu">NEXUS AI never stores API keys in the app. Deploy the included Cloudflare Worker (see README), then paste its URL in Settings{s.workerUrl && prov === null ? ' — the current URL did not respond or has no providers configured' : ''}{s.workerUrl && prov && !prov[s.provider] ? ` — the Worker has no key for ${s.provider}` : ''}.</p>
    <div className="row"><button className="btn" onClick={() => setTab('settings')}>Open Settings</button><button className="btn g" onClick={() => setS({...s, demo: true})}>Try demo mode</button></div>
  </div>;

  const pages: Record<Tab, JSX.Element> = {
    home: <>
      <div className="top"><div><div className="logo">NEXUS AI</div><h1>What can I help<br/>you with?</h1></div><Robot size={104} talk={busy}/></div>
      <Composer ph="Ask NEXUS anything…" busy={busy} onStop={() => abort.current?.abort()} onSend={send}/>
      <div className="row" style={{margin: '10px 0 0'}}>
        <select aria-label="Model" value={`${s.provider}|${s.model}`} onChange={e => { const [provider, model] = e.target.value.split('|'); setS({...s, provider, model}); }}>
          {Object.entries(MODELS).map(([p, ms]) => <optgroup key={p} label={p}>{ms.map(m => <option key={m} value={`${p}|${m}`}>{m}</option>)}</optgroup>)}
        </select>
        <button className="btn g" aria-label="Settings" onClick={() => setTab('settings')}><Cog size={18}/></button>
      </div>
      {!ready && <Setup/>}
      <h2>Suggested</h2><div className="grid">{PROMPTS.map(p => <button key={p} className="card" onClick={() => send(p + ': ')}>{p}</button>)}</div>
      <h2>Quick tools</h2><div className="chips">{TOOLS.slice(0, 5).map(t => <button key={t.id} className="chip" onClick={() => { setTool(t.id); setTab('tools'); }}><t.Icon size={14}/>{t.name}</button>)}</div>
      <h2>Recent</h2>
      {chats.length === 0 ? <p className="mu">No conversations yet.</p> : chats.slice(0, 3).map(c => <button key={c.id} className="card" style={{marginBottom: 8}} onClick={() => { setActiveId(c.id); setTab('chat'); }}>{c.title}<div className="mu">{c.msgs.length} messages</div></button>)}
    </>,
    chat: <div className="chat">
      <div className="row"><Robot size={52} talk={busy}/><div className="sp"><b>{MI.name}</b><div className="mu">{s.demo ? 'Demo mode' : s.model}</div></div>
        <button className="btn g" aria-label="New chat" onClick={newChat}><Plus size={18}/></button>
        {active && <button className="btn g" aria-label="Clear conversation" onClick={() => { if (confirm('Clear this conversation?')) patch(active.id, c => ({...c, msgs: []})); }}><Trash2 size={18}/></button>}
      </div>
      <div className="chips">{MODES.map(m => <button key={m.id} className={'chip' + (m.id === curMode ? ' on' : '')} style={{'--c': m.hue} as CSSProperties} title={m.desc} onClick={() => active ? patch(active.id, c => ({...c, mode: m.id})) : setMode(m.id)}><m.Icon size={14}/>{m.name}</button>)}</div>
      {!ready && <Setup/>}
      <div className="msgs">
        {(!active || active.msgs.length === 0) && <p className="mu" style={{textAlign: 'center', marginTop: 30}}>{MI.desc}. Start typing below.</p>}
        {active?.msgs.map((m, i) => <div key={m.id} className={'b ' + m.role + (m.err ? ' err' : '')}>
          {m.role === 'assistant' ? <Md text={m.content}/> : m.content}
          {m.role === 'assistant' && <div className="acts">
            {!m.err && <button onClick={() => navigator.clipboard?.writeText(m.content)}><Copy size={13}/>Copy</button>}
            {i === active.msgs.length - 1 && !busy && <button onClick={regen}><RefreshCw size={13}/>Regenerate</button>}</div>}
        </div>)}
        {busy && <div className="b assistant"><span className="dots"><span/><span/><span/></span></div>}
        <div ref={end}/>
      </div>
      <Composer key={draft} initial={draft} ph={`Message ${MI.name} mode…`} busy={busy} onStop={() => abort.current?.abort()} onSend={send}/>
    </div>,
    tools: <ToolsPage s={s} ready={ready} tool={tool} setTool={setTool} Setup={Setup}/>,
    history: <>
      <h1>History</h1>
      <div className="row" style={{marginBottom: 12}}><Search size={18}/><input className="t" placeholder="Search conversations" aria-label="Search" value={q} onChange={e => setQ(e.target.value)}/></div>
      {chats.filter(c => (c.title + c.msgs.map(m => m.content).join(' ')).toLowerCase().includes(q.toLowerCase())).map(c =>
        <div key={c.id} className="card row" style={{marginBottom: 8}}>
          <button className="sp" style={{textAlign: 'left'}} onClick={() => { setActiveId(c.id); setTab('chat'); }}>{c.title}<div className="mu">{new Date(c.ts).toLocaleString()} · {c.msgs.length} msgs</div></button>
          <button aria-label="Rename" onClick={() => { const n = prompt('Rename conversation', c.title); if (n?.trim()) patch(c.id, x => ({...x, title: n.trim()})); }}><Pencil size={17}/></button>
          <button aria-label="Delete" onClick={() => { if (confirm('Delete this conversation?')) { setChats(cs => cs.filter(x => x.id !== c.id)); if (activeId === c.id) setActiveId(null); } }}><Trash2 size={17}/></button>
        </div>)}
      {chats.length === 0 && <p className="mu">Nothing here yet — start a chat.</p>}
    </>,
    settings: <>
      <h1>Settings</h1>
      <h2>Appearance</h2><div className="row">{ACCENTS.map(a => <button key={a} aria-label={'Accent ' + a} className={'sw' + (s.accent === a ? ' on' : '')} style={{background: a}} onClick={() => setS({...s, accent: a})}/>)}</div>
      <h2>AI provider</h2>
      <label>Provider</label><select value={s.provider} onChange={e => setS({...s, provider: e.target.value, model: MODELS[e.target.value][0]})}>{Object.keys(MODELS).map(p => <option key={p}>{p}</option>)}</select>
      <label>Model</label><select value={s.model} onChange={e => setS({...s, model: e.target.value})}>{MODELS[s.provider].map(m => <option key={m}>{m}</option>)}</select>
      <label>Max response tokens (Worker caps at 4096)</label><input className="t" type="number" min={64} max={4096} value={s.maxTokens} onChange={e => setS({...s, maxTokens: Math.max(64, Math.min(4096, +e.target.value || 1024))})}/>
      <label>Worker URL (your Cloudflare Worker — never an API key)</label><input className="t" placeholder="https://nexus-ai-proxy.you.workers.dev" value={s.workerUrl} onChange={e => setS({...s, workerUrl: e.target.value.trim()})}/>
      <p className="mu">Backend: {!s.workerUrl ? 'not configured' : prov ? 'connected — keys set for: ' + (Object.keys(prov).filter(k => prov[k]).join(', ') || 'none') : 'unreachable'}</p>
      <div className="row"><button className="btn g" onClick={() => setS({...s, demo: !s.demo})}>Demo mode: {s.demo ? 'ON' : 'OFF'}</button></div>
      <h2>Data</h2><button className="btn d" onClick={() => { if (confirm('Delete ALL chat history?')) { setChats([]); setActiveId(null); } }}>Clear chat history</button>
      <h2>About</h2><div className="card"><div className="row"><Robot size={56}/><div><b>NEXUS AI</b><div className="mu">Version {VERSION}. Chats are stored only in this browser. AI requires an internet connection; only the app shell works offline.</div></div></div></div>
    </>
  };
  const nav: [Tab, LucideIcon, string][] = [['home', Home, 'Home'], ['chat', MessageSquare, 'Chat'], ['tools', Wrench, 'Toolbox'], ['history', Hist, 'History'], ['settings', Cog, 'Settings']];
  return <div className="app"><main key={tab}>{pages[tab]}</main>
    <nav>{nav.map(([t, I, l]) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}><I size={21}/>{l}</button>)}</nav></div>;
}

function ToolsPage({s, ready, tool, setTool, Setup}: {s: Settings; ready: boolean; tool: string | null; setTool: (t: string | null) => void; Setup: () => JSX.Element}) {
  const [inp, setInp] = useState(''); const [out, setOut] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const t = TOOLS.find(x => x.id === tool);
  async function go() {
    if (!t || !inp.trim()) return; setBusy(true); setErr(''); setOut('');
    try { setOut(await ask(s, t.sys, [{role: 'user', content: inp}])); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  if (!t) return <><h1>Toolbox</h1><div className="grid">{TOOLS.map(x => <button key={x.id} className="card" onClick={() => { setTool(x.id); setInp(''); setOut(''); setErr(''); }}><div className="ic"><x.Icon size={20}/></div>{x.name}</button>)}</div></>;
  return <>
    <button className="chip" onClick={() => setTool(null)}><ArrowLeft size={14}/>Toolbox</button>
    <h1><Wand2 size={22}/> {t.name}</h1>
    {!ready && <Setup/>}
    <textarea className="t" placeholder={t.ph} aria-label="Tool input" value={inp} onChange={e => setInp(e.target.value)}/>
    <div className="row" style={{margin: '10px 0'}}><button className="btn" disabled={busy || !inp.trim() || !ready} onClick={go}>{busy ? 'Working…' : 'Run'}</button></div>
    {err && <div className="b assistant err">{err}</div>}
    {out && <div className="b assistant" style={{maxWidth: '100%'}}><Md text={out}/><div className="acts"><button onClick={() => navigator.clipboard?.writeText(out)}><Copy size={13}/>Copy</button></div></div>}
  </>;
}
