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
            <h1>{T.meta.title} · {T.meta.subtitle}</h1>
            <p className="hero-sub">Everything is a plugin，Every run is traceable —— 这里手写 traceable 的那一半。</p>
            <p className="hero-intro">{T.meta.intro}</p>
            <div className="hero-hint">👉 往下读，右侧代码会随进度逐段补全；读到最后，切到「Trace 回放」逐帧走一遍真实运行。</div>
          </div>
          {STEPS.map((s, i) => (
            <article key={s.id} className={`step${s.id === activeId ? " active" : ""}`} data-id={s.id}>
              <span className="step-num">STEP {i} · {s.file}</span>
              <h2>{s.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: s.prose }} />
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
