// content/steps.mjs —— 正文分段（与代码切片解耦）。
// 每个 step 指向 nano-src 里的一个 region，构建时由 generate-content.mjs 注入真实代码。
export const meta = {
  title: "nano-dsh",
  subtitle: "从零手写 dsh 的两半：万物皆插件 + 可追溯事件流",
  repo: "https://github.com/deepseek-ai/deepseek-harness",
  intro:
    "DeepSeek Harness（dsh）的一句话是 Everything is a plugin, Every run is traceable。其中真正把它和 pi 区分开的，是前半句——「万物皆插件」：模型、工具、会话、甚至 agent loop 本身，都是挂在共享 ctx 上、可换可组合的插件。这篇先手写这套可插拔内核（第一章），再手写可追溯事件流（第二章）。右侧代码随阅读进度逐段补全。",
};

export const steps = [
  /* ========== 第一章：万物皆插件（dsh 区别于 pi 的核心） ========== */
  {
    id: "k0",
    file: "kernel.ts",
    region: "k0",
    title: "一 · 0 · 为什么这才是 dsh 和 pi 的分水岭",
    prose:
      "<p>先把话说清楚：<b>「可追溯事件流」不是 dsh 的独门绝技</b>，pi 也有 traceable sessions。真正让 dsh 不一样的是<em>架构形态</em>——它没有一个「特权内核」，一切能力都是插件。</p>" +
      "<p>对比一下就懂：<br/>· <b>pi</b>：一个写死的 agent loop 主循环，工具、模型是它调用的模块，扩展靠改代码 / 注入函数。<br/>· <b>dsh</b>：一个 Cordis 插件内核，模型、工具、会话、<b>连 loop 本身都是插件</b>，挂在共享 <code>ctx</code> 上，靠<b>配置</b >换装，不碰源码。</p>" +
      "<p>官方架构文档原话：<em>There is no privileged core to patch.</em> 这一章就把这个内核从零写出来。</p>" +
      "<p class='cite'>依据：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档 · Cordis 章节</a></p>",
  },
  {
    id: "k1",
    file: "kernel.ts",
    region: "k1",
    title: "一 · 1 · 共享 ctx：服务表 + 可撤销副作用",
    prose:
      "<p>内核只有一个共享上下文 <code>ctx</code>。插件不是「被 import 进来」，而是往 <code>ctx</code> 上<b>贡献服务</b>：<code>provide('model', ...)</code>、<code>provide('tools', ...)</code>。</p>" +
      "<p>关键设计在 <code>provide</code> 的最后几行：注册服务的同时，登记一条<b>可撤销副作用</b>（卸载时恢复上一个实现）。这是「可插拔」能成立的地基——装得上，也拆得干净。</p>",
  },
  {
    id: "k2",
    file: "kernel.ts",
    region: "k2",
    title: "一 · 2 · 事件总线：插件之间靠事件协作",
    prose:
      "<p>插件之间不直接相互调用，而是通过 <code>ctx</code> 上的<b>类型化事件</b>协作：<code>on('run', ...)</code> 订阅、<code>emit('run', ...)</code> 触发。</p>" +
      "<p><code>on</code> 返回的 <code>dispose</code> 同样被登记为可撤销副作用——插件一卸载，它挂的监听自动摘掉，不留残留。</p>",
  },
  {
    id: "k3",
    file: "kernel.ts",
    region: "k3",
    title: "一 · 3 · use()：挂载 = 收集副作用，卸载 = 回滚",
    prose:
      "<p><code>use(plugin)</code> 是整套机制的收口：挂载时把这个插件产生的所有副作用收进一个作用域，返回一个 <code>dispose</code>；调用它就<b>逐个回滚</b>（服务恢复、监听移除）。</p>" +
      "<p>到这里，「装一个能力」和「卸一个能力」就完全对称了。这就是 dsh 说的 <em>reversible effects that unwind when a plugin unloads</em>——没有需要打补丁的特权核心。</p>",
  },
  {
    id: "k4",
    file: "compose.ts",
    region: "k4",
    title: "一 · 4 · 配置即组装：换一行配置换掉整个 model",
    prose:
      "<p>见证时刻。把每个能力都写成插件（<code>openaiModel</code> / <code>deepseekModel</code> / <code>tools</code>），<b>连 agent loop 也只是个监听 <code>run</code> 事件的插件</b>。</p>" +
      "<p><code>buildAgent({ model })</code> 里只改一行，就把整个模型换掉——内核不动、loop 不动、tools 不动。这就是「万物皆插件 + 配置即组装」，也是你在 pi 里做不到、必须改代码才能达到的效果。</p>",
  },

  /* ========== 第二章：可追溯事件流（dsh 也做得很扎实，但非独有） ========== */
  {
    id: "s0",
    file: "session.ts",
    region: "s0",
    title: "二 · 0 · 不存对话，存事件",
    prose:
      "<p>第二章讲 traceable 那半。dsh 的做法是：<b>唯一事实来源是一条 append-only 事件日志</b>，模型看到的历史从日志「算」出来，不是另存一份。</p>" +
      "<p>官方那句 <em>Model-visible means logged</em>：任何进入模型请求的东西都必须能从日志重建。先定义事件类型。</p>",
  },
  {
    id: "s1",
    file: "session.ts",
    region: "s1",
    title: "二 · 1 · 定义 SessionEvent",
    prose:
      "<p>把一轮对话拆成一串离散事实：turn/start、user/message、assistant/chunk、assistant/message、tool/call、tool/result、turn/end。</p>" +
      "<p><code>assistant/chunk</code> 是流式增量，只为<b>保真回放和 UI</b> 存在，不进模型历史——这是后面 replay 能逐字重演的关键。</p>",
  },
  {
    id: "s2",
    file: "session.ts",
    region: "s2",
    title: "二 · 2 · append-only 日志",
    prose:
      "<p>日志只允许 append 和读，每条自动打上单调递增的 <code>seq</code>，不提供「改历史」的方法。<code>slice(uptoSeq)</code> 取「到某时刻为止」的事件，是 replay / fork 的公共原语。</p>",
  },
  {
    id: "s3",
    file: "messages.ts",
    region: "s3",
    title: "二 · 3 · deriveMessages：从日志投影出模型历史",
    prose:
      "<p>模型历史不是单独维护的状态，而是对日志做一次<b>投影</b>。<code>user/message</code>、<code>assistant/message</code>、<code>tool/result</code> 进历史；<code>assistant/chunk</code>、<code>turn/*</code>、<code>tool/call</code> 不进。</p>",
  },
  {
    id: "s4",
    file: "replay.ts",
    region: "s4",
    title: "二 · 4 · replay：逐帧重演",
    prose:
      "<p>既然历史能从日志算出来，回放到任意一步就能还原当时模型看到的世界。replay 是个生成器，每帧带上「这一步事件」和「重演到此刻的历史」。右侧 Trace 面板正是消费这样的帧。</p>",
  },
  {
    id: "s5",
    file: "replay.ts",
    region: "s5",
    title: "二 · 5 · fork：从任意一步分叉",
    prose:
      "<p>历史是不可变事件，分叉几乎白送：复制 <code>boundary</code> 之前的事件到新日志，历史共享、未来分叉。resume / fork / replay 本质是同一条流上的三种读法。</p>",
  },
  {
    id: "s6",
    file: "agent-loop.ts",
    region: "s6",
    title: "二 · 6 · 把 loop 接上：先落日志再派生请求",
    prose:
      "<p>纪律只有一条：<b>任何要给模型看的东西，先 append 成事件，再从日志派生请求</b>，绝不私藏 messages。切到「Trace 回放」标签，对着这段 loop 逐帧走一遍真实运行。</p>",
  },
];
