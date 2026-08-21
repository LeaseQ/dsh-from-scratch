"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TUTORIAL } from "./generated/content";

/* eslint-disable @typescript-eslint/no-explicit-any */
const T: any = TUTORIAL;
const STEPS: any[] = T.steps;
const TR: any = T.trace;
const EVENTS: any[] = TR.events;
const N = EVENTS.length;

/* ---------- 轻量 TS 语法高亮 ---------- */
const KW = new Set(["import","export","from","class","private","public","return","const","let","new","for","of","in","while","if","else","break","switch","case","async","await","function","yield","extends","implements","this","true","false","null","undefined","crypto"]);
const TYPES = new Set(["type","string","number","boolean","unknown","any","void","readonly","Omit","Generator","Promise","Array","Map","Message","SessionEvent","SessionLog","ToolCall","Frame","Role"]);
function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function highlight(line: string) {
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d.]*\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s\w$])/g;
  let out = "", m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out += `<span class="tok-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tok-num">${esc(m[3])}</span>`;
    else if (m[4]) {
      const w = m[4];
      const after = line.slice(re.lastIndex).match(/^\s*\(/);
      if (KW.has(w)) out += `<span class="tok-kw">${esc(w)}</span>`;
      else if (TYPES.has(w) || /^[A-Z]/.test(w)) out += `<span class="tok-typ">${esc(w)}</span>`;
      else if (after) out += `<span class="tok-fn">${esc(w)}</span>`;
      else out += esc(w);
    } else if (m[5]) out += m[5];
    else out += `<span class="tok-pun">${esc(m[6])}</span>`;
  }
  return out || "&nbsp;";
}

const TY: Record<string, [string, boolean]> = {
  "turn/start": ["ty-turn", false],
  "turn/end": ["ty-turn", false],
  "user/message": ["ty-user", true],
  "assistant/chunk": ["ty-chunk", false],
  "assistant/message": ["ty-amsg", true],
  "tool/call": ["ty-tcall", false],
  "tool/result": ["ty-tres", true],
};

function deriveMessages(applied: any[]) {
  const msgs: any[] = [];
  for (const e of applied) {
    if (e.type === "user/message") msgs.push({ role: "user", content: e.data.text });
    else if (e.type === "assistant/message") msgs.push({ role: "assistant", content: e.data.text, toolCalls: e.data.toolCalls });
    else if (e.type === "tool/result") msgs.push({ role: "tool", toolCallId: e.data.id, content: e.data.content });
  }
  return msgs;
}

function PluginDemo() {
  const [model, setModel] = useState<"openai" | "deepseek">("deepseek");
  const [toolsOn, setToolsOn] = useState(true);
  const [loopOn, setLoopOn] = useState(true);
  const [input, setInput] = useState("读 config.json");
  const [res, setRes] = useState<{ model: string; text: string } | null>(null);
  const [mounted, setMounted] = useState<string[]>([]);

  const run = useCallback(async () => {
    const services = new Map<string, any>();
    const listeners = new Map<string, Set<any>>();
    const ctx = {
      provide: (n: string, impl: any) => services.set(n, impl),
      get: (n: string) => services.get(n),
      on: (e: string, fn: any) => { if (!listeners.has(e)) listeners.set(e, new Set()); listeners.get(e)!.add(fn); },
      emit: async (e: string, ...a: any[]) => { let r: any; for (const fn of listeners.get(e) ?? []) r = await fn(...a); return r; },
    };
    // 每个能力都是一个插件，装不装、装哪个，都由下面的开关决定
    if (model === "deepseek")
      ctx.provide("model", { name: "DeepSeek-V3", call: async (m: string) => `「DeepSeek-V3」收到「${m}」` });
    else
      ctx.provide("model", { name: "GPT-4o", call: async (m: string) => `「GPT-4o」handling「${m}」` });
    if (toolsOn) ctx.provide("tools", { read: (p: string) => `content of ${p}` });
    if (loopOn)
      ctx.on("run", async (x: string) => {
        const reply = await ctx.get("model").call(x);
        const tools = ctx.get("tools");
        const read = tools ? tools.read("config.json") : "tools 没挂，读不了文件";
        return `${reply} ｜ 顺手 tools.read → ${read}`;
      });
    const text = await ctx.emit("run", input);
    setRes({ model: ctx.get("model").name, text: text ?? "没有插件在监听 run（agentLoop 没挂）" });
    setMounted([`model: ${ctx.get("model").name}`, ...(toolsOn ? ["tools"] : []), ...(loopOn ? ["agentLoop"] : [])]);
  }, [model, input, toolsOn, loopOn]);

  useEffect(() => { run(); }, [model, toolsOn, loopOn]); // 任一插件变动就重算

  return (
    <div className="plugin-demo">
      <div className="pd-title">点一下试试：model、tools、agentLoop 都是插件，能换也能卸</div>
      <div className="pd-config">buildAgent(&#123; model: <span className="pd-val">&quot;{model}&quot;</span> &#125;)</div>
      <div className="pd-toggle">
        <span className="pd-tag2">model</span>
        <button className={model === "openai" ? "on" : ""} onClick={() => setModel("openai")}>openaiModel</button>
        <button className={model === "deepseek" ? "on" : ""} onClick={() => setModel("deepseek")}>deepseekModel</button>
      </div>
      <div className="pd-toggle">
        <span className="pd-tag2">其它</span>
        <button className={toolsOn ? "on" : ""} onClick={() => setToolsOn((v) => !v)}>tools {toolsOn ? "已挂 ✓" : "已卸 ✗"}</button>
        <button className={loopOn ? "on" : ""} onClick={() => setLoopOn((v) => !v)}>agentLoop {loopOn ? "已挂 ✓" : "已卸 ✗"}</button>
      </div>
      <div className="pd-chips">挂载的插件：{mounted.map((m) => <span key={m} className="chip">{m}</span>)}</div>
      <div className="pd-run">
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button onClick={run}>run ▶</button>
      </div>
      <div className={`pd-out ${model}`} key={res ? res.model + res.text : "empty"}>
        {res ? (
          <>
            <span className="pd-badge">{res.model}</span>
            <span className="pd-arrow">← 现在挂着的 model 插件</span>
            <div className="pd-line"><span className="pd-fn">run(</span><span className="pd-str">&quot;{input}&quot;</span><span className="pd-fn">)</span> = <b>{res.text}</b></div>
          </>
        ) : "点上面的按钮或 run ▶"}
      </div>
      <div className="pd-note">换 model、卸掉 tools、卸掉 agentLoop，输出都会跟着变，而内核一行都没改。卸掉 agentLoop 后没人监听 run，卸掉 tools 后读文件那步就失效。这就是「万物皆插件、装得上也拆得干净」。</div>
    </div>
  );
}

export default function Page() {
  const [activeId, setActiveId] = useState(STEPS[0].id);
  const [tab, setTab] = useState<"code" | "trace">("code");
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const traceCodeRef = useRef<HTMLPreElement>(null);

  /* 滚动联动：选出当前阅读到的 step */
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const els = articleRef.current?.querySelectorAll<HTMLElement>(".step");
        if (els) {
          const ref = window.innerHeight * 0.35;
          let active = els[0];
          els.forEach((el) => { if (el.getBoundingClientRect().top <= ref) active = el; });
          if (active) setActiveId(active.dataset.id!);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* 代码累积（同文件按顺序拼接，当前 step 高亮） */
  const codeView = useMemo(() => {
    const step = STEPS.find((s) => s.id === activeId);
    const file = step.file;
    const idx = STEPS.indexOf(step);
    const lines: { ln: string; isNew: boolean }[] = [];
    for (let i = 0; i <= idx; i++) {
      const s = STEPS[i];
      if (s.file !== file) continue;
      s.code.split("\n").forEach((ln: string) => lines.push({ ln, isNew: s.id === activeId }));
    }
    return { file, lines };
  }, [activeId]);

  useLayoutEffect(() => {
    const first = codeScrollRef.current?.querySelector<HTMLElement>(".is-new");
    if (first && codeScrollRef.current) codeScrollRef.current.scrollTop = Math.max(0, first.offsetTop - 56);
  }, [codeView]);

  const activeIdx = STEPS.findIndex((s) => s.id === activeId);

  /* Trace 播放 */
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPos((p) => {
        if (p >= N) { setPlaying(false); return p; }
        const np = p + 1;
        if (breakpoints.has(np - 1)) setPlaying(false);
        return np;
      });
    }, 1150);
    return () => clearInterval(id);
  }, [playing, breakpoints]);

  useLayoutEffect(() => {
    if (tab !== "trace") return;
    const hot = traceCodeRef.current?.querySelector<HTMLElement>(".hot");
    hot?.scrollIntoView({ block: "nearest" });
  }, [pos, tab]);

  const toggleBp = useCallback((i: number) => {
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const hotLine = pos > 0 ? EVENTS[pos - 1].line : 0;
  const msgs = deriveMessages(EVENTS.slice(0, pos));

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">🐳</span>
          <div className="brand-text">
            <strong>nano-dsh</strong>
            <span className="brand-sub">从零手写「可追溯事件流 + Trajectory 回放」</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="badge">教学极简版 · 对齐 DeepSeek Harness 思想</span>
          <a className="ghost-btn" href={T.meta.repo} target="_blank" rel="noreferrer">dsh 源码 ↗</a>
        </div>
        <div className="progress-rail">
          <div className="progress-fill" style={{ width: `${(activeIdx / (STEPS.length - 1)) * 100}%` }} />
        </div>
      </header>

      <main className="layout">
        <section className="article" ref={articleRef}>
          <div className="hero">
            <h1>{T.meta.subtitle}</h1>
            <p className="hero-sub">{T.meta.tagline}</p>
          </div>
          <section className="preface" dangerouslySetInnerHTML={{ __html: T.meta.preface }} />
          {STEPS.map((s, i) => (
            <article key={s.id} className={`step${s.id === activeId ? " active" : ""}`} data-id={s.id}>
              <span className="step-num">STEP {i} · {s.file}</span>
              <h2>{s.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: s.prose }} />
              {s.id === "k4" && <PluginDemo />}
            </article>
          ))}
          <footer className="article-foot">
            <p>本页是一个<b>数据驱动的互动教学模板</b>：正文来自 <code>content/steps.mjs</code>，右侧代码切片由构建脚本从 <code>nano-src/*.ts</code> 真实源码注入。</p>
            <p className="muted">nano-dsh 为教学重写的极简版，概念对齐 dsh 官方架构文档，非其真实源码。</p>
          </footer>
        </section>

        <section className="stage">
          <div className="stage-tabs">
            <button className={`tab${tab === "code" ? " active" : ""}`} onClick={() => setTab("code")}>
              <span className="dot" /> 代码 <span className="tab-file">{codeView.file}</span>
            </button>
            <button className={`tab${tab === "trace" ? " active" : ""}`} onClick={() => setTab("trace")}>▶ Trace 回放</button>
          </div>

          <div className={`pane${tab === "code" ? " active" : ""}`}>
            <div className="editor">
              <div className="code-scroll" ref={codeScrollRef}>
                {codeView.lines.map((l, i) => (
                  <div key={i} className={`code-line${l.isNew ? " is-new" : ""}`}>
                    <span className="ln">{i + 1}</span>
                    <span className="lc" dangerouslySetInnerHTML={{ __html: highlight(l.ln) }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`pane${tab === "trace" ? " active" : ""}`}>
            <div className="trace-scenario">🎬 录制场景：<b>{TR.scenario}</b>（离线静态数据，回放不发任何模型请求）</div>
            <div className="trace-body">
              <div className="trace-code">
                <div className="mini-title">agent-loop.ts <span className="muted">· 高亮 = 当前事件由这行产生</span></div>
                <pre className="mini-code" ref={traceCodeRef}>
                  {TR.code.map((ln: string, i: number) => (
                    <div key={i} className={`mini-line${i + 1 === hotLine ? " hot" : ""}`}>
                      <span className="ln">{i + 1}</span>
                      <span className="lc" dangerouslySetInnerHTML={{ __html: highlight(ln) }} />
                    </div>
                  ))}
                </pre>
              </div>
              <div className="trace-side">
                <div className="panel">
                  <div className="panel-head">📜 append-only 日志 <span className="muted">{pos} 条</span></div>
                  <div className="panel-body log-list">
                    {EVENTS.map((e, i) => {
                      const [cls, visible] = TY[e.type];
                      const applied = i < pos;
                      const cur = i === pos - 1;
                      const bp = breakpoints.has(i);
                      return (
                        <div key={i} className={`ev${applied ? "" : " dim"}${cur ? " cur" : ""}${bp ? " bp" : ""}`} onClick={() => toggleBp(i)}>
                          <span className="seq">{applied ? i : "·"}</span>
                          <span className={`ty ${cls}`}>{e.type}</span>
                          {!visible && <span className="badge-skip">不入历史</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head">🧠 模型看到的历史 <span className="muted">deriveMessages(日志)</span></div>
                  <div className="panel-body msg-list">
                    {msgs.length === 0 ? (
                      <div className="empty">还没有任何模型可见消息</div>
                    ) : (
                      msgs.map((m, i) => (
                        <div key={i} className={`msg ${m.role}`}>
                          <div className="role">{m.role === "tool" ? `tool · ${m.toolCallId}` : m.role}</div>
                          {m.content}
                          {m.toolCalls && m.toolCalls.length > 0 && (
                            <div className="tc">↳ tool_call: {m.toolCalls.map((c: any) => `${c.name}(${JSON.stringify(c.args)})`).join(", ")}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="trace-controls">
              <button onClick={() => { setPlaying(false); setPos(0); }} title="回到开头">⟲</button>
              <button onClick={() => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); }} disabled={pos === 0}>◀ 上一步</button>
              <button className="primary" onClick={() => { if (pos >= N) setPos(0); setPlaying((v) => !v); }}>{playing ? "⏸ 暂停" : "▶ 播放"}</button>
              <button onClick={() => { setPlaying(false); setPos((p) => Math.min(N, p + 1)); }} disabled={pos >= N}>下一步 ▶</button>
              <div className="step-indicator"><span>{pos}</span> / {N}</div>
              <label className="bp-hint">🔴 点左侧事件行可设为断点，播放会在断点处暂停</label>
            </div>
            <div className="trace-note">{pos > 0 ? EVENTS[pos - 1].note : "点「播放」或「下一步」，看事件如何一条条落进日志、模型历史又是怎么从日志算出来的。"}</div>
          </div>
        </section>
      </main>
    </>
  );
}
