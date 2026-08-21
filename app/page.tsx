"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TUTORIAL } from "./generated/content";

/* eslint-disable @typescript-eslint/no-explicit-any */
const T: any = TUTORIAL;
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
      <div className="pd-title">交互演示：model、tools、agentLoop 均为插件，可替换、可卸载</div>
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
      <div className="pd-note">替换 model、卸载 tools、卸载 agentLoop，输出都会随之变化，而内核一行都未改动。卸载 agentLoop 后无人监听 run，卸载 tools 后读文件那一步随之失效。这正是「万物皆插件、装卸对称」。</div>
    </div>
  );
}

function CordisDemo() {
  const ALL = [
    { id: "model", label: "modelPlugin", effect: "provide('model')" },
    { id: "tools", label: "toolsPlugin", effect: "provide('tools')" },
    { id: "loop", label: "agentLoopPlugin", effect: "on('run')" },
  ];
  const [mounted, setMounted] = useState<string[]>(["model", "loop"]);
  const [log, setLog] = useState<string[]>(["初始：挂了 modelPlugin、agentLoopPlugin"]);
  const [out, setOut] = useState<string | null>(null);

  const services = mounted.filter((m) => m !== "loop"); // model / tools 提供服务；loop 只挂监听
  const runListeners = mounted.includes("loop") ? ["agentLoopPlugin"] : [];

  const mount = (id: string) => {
    if (mounted.includes(id)) return;
    const p = ALL.find((x) => x.id === id)!;
    setMounted([...mounted, id]);
    setLog((l) => [...l, `use(${p.label})：注册 ${p.effect}`]);
    setOut(null);
  };
  const unmount = (id: string) => {
    const p = ALL.find((x) => x.id === id)!;
    setMounted(mounted.filter((x) => x !== id));
    setLog((l) => [...l, `dispose(${p.label})：回滚 ${p.effect}`]);
    setOut(null);
  };
  const emitRun = () => {
    if (!mounted.includes("loop")) return setOut("emit('run') → 没有插件在监听 run，什么都没发生");
    if (!mounted.includes("model")) return setOut("emit('run') → agentLoop 想调 model，但 model 服务没挂，报错");
    const t = mounted.includes("tools");
    setOut(`emit('run') → agentLoop 触发 → 调 model 服务${t ? "，并用 tools 读文件" : "（tools 没挂，跳过读文件）"} → 返回结果`);
  };

  return (
    <div className="cordis-demo">
      <div className="pd-title">挂载 / 卸载 / 替换这些能力，再点 emit('run') 观察结果</div>
      <div className="cd-cols">
        <div className="cd-box">
          <div className="cd-h">可挂载插件</div>
          {ALL.map((p) => (
            <button key={p.id} className="cd-mount" disabled={mounted.includes(p.id)} onClick={() => mount(p.id)}>
              + {p.label}
            </button>
          ))}
        </div>
        <div className="cd-box">
          <div className="cd-h">共享 ctx</div>
          <div className="cd-row"><span className="cd-k">services</span>{services.length ? services.map((s) => <span key={s} className="cd-chip svc">{s}</span>) : <span className="cd-empty">空</span>}</div>
          <div className="cd-row"><span className="cd-k">on(run)</span>{runListeners.length ? runListeners.map((s) => <span key={s} className="cd-chip ev">{s}</span>) : <span className="cd-empty">空</span>}</div>
          <div className="cd-h cd-h2">已挂插件</div>
          <div className="cd-row">
            {mounted.length ? mounted.map((id) => {
              const p = ALL.find((x) => x.id === id)!;
              return <span key={id} className="cd-chip mnt">{p.label}<button onClick={() => unmount(id)} title="卸载">×</button></span>;
            }) : <span className="cd-empty">还没挂任何插件</span>}
          </div>
        </div>
      </div>
      <div className="cd-run"><button onClick={emitRun}>emit(&apos;run&apos;) ▶</button>{out && <span className="cd-outtext">{out}</span>}</div>
      <div className="cd-log">
        <div className="cd-h">操作日志（副作用的登记与回滚）</div>
        {log.map((l, i) => <div key={i} className="cd-logline">{l}</div>)}
      </div>
      <div className="pd-note">挂载一项能力，它提供的东西就出现在共享区里；卸载它，此前登记的副作用会被逐条撤销。请留意这个「挂载即出现、卸载即撤销」的现象，稍后我们会给它准确的名称。</div>
    </div>
  );
}

/* ---------- Chapter：一整章的文章列表 + 右侧 stage ---------- */
function Chapter({ steps, hasTrace, onNext, nextLabel, onProgress }: {
  steps: any[];
  hasTrace: boolean;
  onNext?: () => void;
  nextLabel?: string;
  onProgress?: (pct: number) => void;
}) {
  const [activeId, setActiveId] = useState(steps[0].id);
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
    const step = steps.find((s) => s.id === activeId)!;
    const file = step.file;
    const idx = steps.indexOf(step);
    const lines: { ln: string; isNew: boolean }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i <= idx; i++) {
      const s = steps[i];
      if (s.file !== file) continue;
      if (seen.has(s.code)) continue; // 同一 region 被多个 step 复用时只累积一次
      seen.add(s.code);
      s.code.split("\n").forEach((ln: string) => lines.push({ ln, isNew: s.id === activeId }));
    }
    return { file, lines };
  }, [activeId, steps]);

  useLayoutEffect(() => {
    const first = codeScrollRef.current?.querySelector<HTMLElement>(".is-new");
    if (first && codeScrollRef.current) codeScrollRef.current.scrollTop = Math.max(0, first.offsetTop - 56);
  }, [codeView]);

  const activeIdx = steps.findIndex((s) => s.id === activeId);

  /* 进度条：按当前 active step 在本章内的位置算 */
  useEffect(() => {
    onProgress?.(steps.length > 1 ? (activeIdx / (steps.length - 1)) * 100 : 100);
  }, [activeIdx, steps, onProgress]);

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
    <main className="layout">
      <section className="article" ref={articleRef}>
        {steps.map((s, i) => (
          <article className={`step${s.id === activeId ? " active" : ""}`} data-id={s.id} key={s.id}>
            <span className="step-num">STEP {i} · {s.file}</span>
            <h2>{s.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: s.prose }} />
            {s.id === "k0" && <CordisDemo />}
            {s.id === "k5" && <PluginDemo />}
          </article>
        ))}
        {onNext && (
          <div className="chapter-next">
            <button className="next-btn" onClick={onNext}>{nextLabel ?? "下一章 →"}</button>
          </div>
        )}
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
          {hasTrace && (
            <button className={`tab${tab === "trace" ? " active" : ""}`} onClick={() => setTab("trace")}>▶ Trace 回放</button>
          )}
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

        {hasTrace && (
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
        )}
      </section>
    </main>
  );
}

/* ---------- Page：hash 切屏 ---------- */
type Screen = "preface" | "chapter1" | "chapter2";
const SCREENS: Screen[] = ["preface", "chapter1", "chapter2"];

function readHash(): Screen {
  if (typeof window === "undefined") return "preface";
  const h = window.location.hash.replace(/^#/, "") as Screen;
  return SCREENS.includes(h) ? h : "preface";
}

export default function Page() {
  const [screen, setScreen] = useState<Screen>("preface");
  const [progress, setProgress] = useState(0);

  const chapter1Steps = useMemo(() => T.steps.filter((s: any) => String(s.id).startsWith("k")), []);
  const chapter2Steps = useMemo(() => T.steps.filter((s: any) => String(s.id).startsWith("s")), []);

  /* 初始读 hash + 监听 hashchange */
  useEffect(() => {
    setScreen(readHash());
    const onHash = () => setScreen(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((s: Screen) => {
    if (typeof window !== "undefined") {
      history.pushState(null, "", "#" + s);
      window.scrollTo(0, 0);
    }
    setProgress(0);
    setScreen(s);
  }, []);

  const onProgress = useCallback((pct: number) => setProgress(pct), []);

  return (
    <>
      <header className="topbar">
        <div className="brand" role="button" onClick={() => go("preface")} style={{ cursor: "pointer" }}>
          <span className="logo">🐳</span>
          <div className="brand-text">
            <strong>nano-dsh</strong>
            <span className="brand-sub">从零手写 dsh</span>
          </div>
        </div>
        <nav className="chapter-nav">
          <a onClick={() => go("preface")} className={screen === "preface" ? "on" : ""}>先导</a>
          <a onClick={() => go("chapter1")} className={screen === "chapter1" ? "on" : ""}>万物皆插件</a>
          <a onClick={() => go("chapter2")} className={screen === "chapter2" ? "on" : ""}>可追溯事件流</a>
        </nav>
        <div className="topbar-right">
          <a className="ghost-btn" href={T.meta.repo} target="_blank" rel="noreferrer">dsh 源码 ↗</a>
        </div>
        <div className="progress-rail">
          <div className="progress-fill" style={{ width: `${screen === "preface" ? 0 : progress}%` }} />
        </div>
      </header>

      {screen === "preface" && (
        <main className="screen-preface" key="preface">
          <div className="hero">
            <h1>{T.meta.subtitle}</h1>
            <p className="hero-sub">{T.meta.tagline}</p>
          </div>
          <section className="preface" dangerouslySetInnerHTML={{ __html: T.meta.preface }} />
          <div className="chapter-next">
            <button className="next-btn" onClick={() => go("chapter1")}>进入第一章 · 万物皆插件 →</button>
          </div>
        </main>
      )}

      {screen === "chapter1" && (
        <Chapter
          key="chapter1"
          steps={chapter1Steps}
          hasTrace={false}
          onNext={() => go("chapter2")}
          nextLabel="下一章 · 可追溯事件流 →"
          onProgress={onProgress}
        />
      )}

      {screen === "chapter2" && (
        <Chapter
          key="chapter2"
          steps={chapter2Steps}
          hasTrace={true}
          onProgress={onProgress}
        />
      )}
    </>
  );
}
