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

// 一份「有代表性的可挂载插件清单」，类目对齐 dsh 官网列出的「皆为插件」的能力
// （models / tools / skills / sessions / sandboxes / storage / loops / scheduling / UI）。
// 带 * 的 ctx 键为教学示意：官网将其列为插件类目，但架构文档未给出确切键名。
const PD_TOGGLES: { key: string; label: string; cat: string }[] = [
  { key: "tools", label: "tools", cat: "工具注册表" },
  { key: "skills", label: "skills", cat: "可复用技能" },
  { key: "session", label: "session", cat: "事件日志" },
  { key: "sandbox", label: "sandbox", cat: "隔离执行" },
  { key: "storage", label: "storage", cat: "持久化" },
  { key: "scheduler", label: "scheduler", cat: "后台调度" },
  { key: "ui", label: "ui", cat: "界面渲染" },
  { key: "loop", label: "agentLoop", cat: "run 循环" },
];

function PluginDemo() {
  const [model, setModel] = useState<"openai" | "deepseek">("deepseek");
  const [on, setOn] = useState<Record<string, boolean>>({
    tools: true, skills: true, session: true, sandbox: false,
    storage: true, scheduler: false, ui: true, loop: true,
  });
  const [input, setInput] = useState("读 config.json 并跑一段脚本");
  const [res, setRes] = useState<{ model: string; lines: string[] } | null>(null);
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
    if (on.tools) ctx.provide("tools", { read: (p: string) => `content of ${p}` });
    if (on.skills) ctx.provide("skills", { hint: () => "read-then-summarize" });
    if (on.session) ctx.provide("sessions", { log: [] as string[] });
    if (on.sandbox) ctx.provide("sandbox", { exec: (c: string) => `exit 0 · ${c}` });
    if (on.storage) ctx.provide("storage", { save: (_: string) => true });
    if (on.scheduler) ctx.provide("scheduler", { every: (_: string) => true });
    if (on.ui) ctx.provide("ui", { render: (_: string) => true });
    if (on.loop)
      ctx.on("run", async (x: string) => {
        const lines: string[] = [];
        const reply = await ctx.get("model").call(x);
        lines.push(`model → ${reply}`);
        const tools = ctx.get("tools");
        if (tools) {
          lines.push(`tools 在场：tools.read('config.json') → ${tools.read("config.json")}`);
          lines.push(ctx.get("sandbox")
            ? "sandbox 在场：代码 / shell 类工具可在隔离环境执行"
            : "缺 sandbox：代码 / shell 类工具被跳过（示意）");
        } else {
          lines.push("缺 tools：模型只能空手作答，读不了文件也调不了工具");
        }
        lines.push(ctx.get("skills") ? "skills 在场：注入了可复用技能提示" : "缺 skills：无额外技能提示");
        lines.push(ctx.get("sessions") ? "session 在场：每步写进 append-only 日志，可回放 / 分叉" : "缺 session：本次运行不留痕，无法回放（示意）");
        lines.push(ctx.get("storage") ? "storage 在场：结果已持久化，重启仍在" : "缺 storage：结果只在内存，重启即丢（示意）");
        lines.push(ctx.get("scheduler") ? "scheduler 在场：可把后续任务排进后台队列" : "缺 scheduler：只能同步跑完这一次（示意）");
        lines.push(ctx.get("ui") ? "ui 在场：结果渲染到界面" : "缺 ui：仅返回数据，无界面呈现");
        return lines;
      });
    const lines = await ctx.emit("run", input);
    setRes({ model: ctx.get("model").name, lines: lines ?? ["没有插件在监听 run（agentLoop 没挂）"] });
    setMounted([`model: ${ctx.get("model").name}`, ...PD_TOGGLES.filter((t) => on[t.key]).map((t) => t.label)]);
  }, [model, input, on]);

  useEffect(() => { run(); }, [model, on]); // 任一插件变动就重算

  return (
    <div className="plugin-demo">
      <div className="pd-title">交互演示：model / tools / skills / session / sandbox / storage / scheduler / ui / agentLoop 均为插件，可替换、可卸载</div>
      <div className="pd-config">buildAgent(&#123; model: <span className="pd-val">&quot;{model}&quot;</span> &#125;)</div>
      <div className="pd-toggle">
        <span className="pd-tag2">model</span>
        <button className={model === "openai" ? "on" : ""} onClick={() => setModel("openai")}>openaiModel</button>
        <button className={model === "deepseek" ? "on" : ""} onClick={() => setModel("deepseek")}>deepseekModel</button>
      </div>
      <div className="pd-grid">
        {PD_TOGGLES.map((t) => (
          <button
            key={t.key}
            className={`pd-cell${on[t.key] ? " on" : ""}`}
            title={t.cat}
            onClick={() => setOn((s) => ({ ...s, [t.key]: !s[t.key] }))}
          >
            {t.label} {on[t.key] ? "✓" : "✗"}
          </button>
        ))}
      </div>
      <div className="pd-chips">挂载的插件：{mounted.map((m) => <span key={m} className="chip">{m}</span>)}</div>
      <div className="pd-run">
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button onClick={run}>run ▶</button>
      </div>
      <div className={`pd-out ${model}`} key={res ? res.model + res.lines.join("|") : "empty"}>
        {res ? (
          <>
            <span className="pd-badge">{res.model}</span>
            <span className="pd-arrow">← 现在挂着的 model 插件</span>
            <div className="pd-line"><span className="pd-fn">run(</span><span className="pd-str">&quot;{input}&quot;</span><span className="pd-fn">)</span> ={res.lines.length > 1 ? "" : " "}
              {res.lines.map((l, i) => <div key={i} className="pd-effline">{l}</div>)}
            </div>
          </>
        ) : "点上面的按钮或 run ▶"}
      </div>
      <div className="pd-note">替换 model、勾掉某个插件，输出都会随之变化，而内核一行都未改动。卸载 agentLoop 后无人监听 run；卸载 tools 后读文件那一步失效；缺 sandbox 则代码类工具跳过，缺 storage 则结果不持久化。这些能力都挂在同一个 ctx 上，没有谁是特权核心。</div>
    </div>
  );
}

// 可挂载插件目录：类目对齐 dsh 官网「皆为插件」的清单，ctx 键取自架构文档；
// 带 * 者官网列为插件类目、但架构文档未给确切键名，此处为教学示意。
const CD_ALL = [
  { id: "model", label: "modelPlugin", effect: "provide('model')", key: "ctx.llm", kind: "svc" },
  { id: "tools", label: "toolsPlugin", effect: "provide('tools')", key: "ctx.tools", kind: "svc" },
  { id: "skills", label: "skillsPlugin", effect: "provide('skills')", key: "ctx.skills*", kind: "svc" },
  { id: "session", label: "sessionPlugin", effect: "provide('sessions')", key: "ctx.sessions", kind: "svc" },
  { id: "sandbox", label: "sandboxPlugin", effect: "provide('sandbox')", key: "ctx.sandbox", kind: "svc" },
  { id: "storage", label: "storagePlugin", effect: "provide('storage')", key: "ctx.storage*", kind: "svc" },
  { id: "scheduler", label: "schedulerPlugin", effect: "provide('scheduler')", key: "ctx.jobs", kind: "svc" },
  { id: "ui", label: "uiPlugin", effect: "provide('ui')", key: "ctx.ui*", kind: "svc" },
  { id: "loop", label: "agentLoopPlugin", effect: "on('run')", key: "ctx.agentLoop", kind: "ev" },
];

function CordisDemo() {
  const ALL = CD_ALL;
  const [mounted, setMounted] = useState<string[]>(["model", "loop"]);
  const [log, setLog] = useState<string[]>(["初始：挂了 modelPlugin、agentLoopPlugin"]);
  const [out, setOut] = useState<string[] | null>(null);

  const services = mounted.filter((m) => ALL.find((x) => x.id === m)!.kind === "svc");
  const runListeners = mounted.filter((m) => ALL.find((x) => x.id === m)!.kind === "ev").map((m) => ALL.find((x) => x.id === m)!.label);

  const mount = (id: string) => {
    if (mounted.includes(id)) return;
    const p = ALL.find((x) => x.id === id)!;
    setMounted([...mounted, id]);
    setLog((l) => [...l, `use(${p.label})：注册 ${p.effect} → ${p.key}`]);
    setOut(null);
  };
  const unmount = (id: string) => {
    const p = ALL.find((x) => x.id === id)!;
    setMounted(mounted.filter((x) => x !== id));
    setLog((l) => [...l, `dispose(${p.label})：回滚 ${p.effect}`]);
    setOut(null);
  };
  const emitRun = () => {
    if (!mounted.includes("loop")) return setOut(["emit('run') → 没有插件在监听 run，什么都没发生"]);
    if (!mounted.includes("model")) return setOut(["emit('run') → agentLoop 想调 model，但 model 服务没挂，报错"]);
    const has = (id: string) => mounted.includes(id);
    const lines = ["emit('run') → agentLoop 触发 → 调 model 服务"];
    lines.push(has("tools")
      ? (has("sandbox") ? "· tools 在场：可读文件，代码 / shell 类工具在 sandbox 里执行" : "· tools 在场：可读文件；缺 sandbox，代码 / shell 类工具跳过（示意）")
      : "· 缺 tools：模型只能空手作答，跳过读文件");
    lines.push(has("skills") ? "· skills 在场：注入可复用技能提示" : "· 缺 skills：无额外技能提示");
    lines.push(has("session") ? "· session 在场：每步写进 append-only 日志，可回放 / 分叉" : "· 缺 session：不留痕，无法回放（示意）");
    lines.push(has("storage") ? "· storage 在场：结果持久化，重启仍在" : "· 缺 storage：结果只在内存，重启即丢（示意）");
    lines.push(has("scheduler") ? "· scheduler 在场：可排后台 / 定时任务" : "· 缺 scheduler：只能同步跑完这一次（示意）");
    lines.push(has("ui") ? "· ui 在场：结果渲染到界面" : "· 缺 ui：仅返回数据，无界面呈现");
    setOut(lines);
  };

  return (
    <div className="cordis-demo">
      <div className="pd-title">挂载 / 卸载 / 替换这些能力，再点 emit('run') 观察结果</div>
      <div className="cd-cols">
        <div className="cd-box">
          <div className="cd-h">可挂载插件</div>
          {ALL.map((p) => (
            <button key={p.id} className="cd-mount" disabled={mounted.includes(p.id)} onClick={() => mount(p.id)}>
              + {p.label} <span className="cd-key">{p.key}</span>
            </button>
          ))}
        </div>
        <div className="cd-box">
          <div className="cd-h">共享 ctx</div>
          <div className="cd-row"><span className="cd-k">services</span>{services.length ? services.map((s) => <span key={s} className="cd-chip svc">{ALL.find((x) => x.id === s)!.label}</span>) : <span className="cd-empty">空</span>}</div>
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
      <div className="cd-run"><button onClick={emitRun}>emit(&apos;run&apos;) ▶</button></div>
      {out && <div className="cd-outbox">{out.map((l, i) => <div key={i} className="cd-outline">{l}</div>)}</div>}
      <div className="cd-log">
        <div className="cd-h">操作日志（副作用的登记与回滚）</div>
        {log.map((l, i) => <div key={i} className="cd-logline">{l}</div>)}
      </div>
      <div className="pd-note">这套「挂载即出现、卸载即撤销」的表现，背后是可撤销的副作用：每项能力登记时都记下了对应的回滚动作，插件卸载即回滚，共享区随之复原。</div>
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
