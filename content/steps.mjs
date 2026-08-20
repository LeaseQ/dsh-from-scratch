// content/steps.mjs —— 正文分段（与代码切片解耦）。
// 每个 step 指向 nano-src 里的一个 region，构建时由 generate-content.mjs 注入真实代码。
export const meta = {
  title: "nano-dsh",
  subtitle: "从零手写「可追溯事件流 + Trajectory 回放」",
  repo: "https://github.com/deepseek-ai/deepseek-harness",
  intro:
    "DeepSeek Harness（dsh）最出彩的一点，是「每一次运行都可追溯」：模型看到的一切都写进一条 append-only 的事件日志，resume / fork / search / replay 全部从这条流派生。这篇跟着它的数据流，从零写一个能记录、能投影、能逐帧回放的迷你版。右侧代码会随阅读进度逐段补全；读完，nano-dsh 的核心代码也就成型了。",
};

export const steps = [
  {
    id: "s0",
    file: "session.ts",
    region: "s0",
    title: "0 · 一个反直觉的起点：不存对话，存事件",
    prose:
      "<p>大多数人写 agent，会拿一个 <code>messages</code> 数组存对话。dsh 反过来：<b>唯一的事实来源是一条事件日志</b>，模型看到的历史是从日志「算」出来的，不是另存一份。</p>" +
      "<p>官方架构文档里那句话说得很硬——<em>Model-visible means logged</em>：任何进入模型请求的东西，都必须能从日志重建出来。先把事件类型定义出来。</p>" +
      "<p class='cite'>依据：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档 · Session log 章节</a></p>",
  },
  {
    id: "s1",
    file: "session.ts",
    region: "s1",
    title: "1 · 定义 SessionEvent：一次运行里会发生的所有「事实」",
    prose:
      "<p>把一轮对话拆成一串离散事实：开始一轮（turn/start）、用户说话（user/message）、模型流式吐字（assistant/chunk）、模型完整回复（assistant/message）、调用工具（tool/call）、工具返回（tool/result）、结束一轮（turn/end）。</p>" +
      "<p>注意 <code>assistant/chunk</code>：它是流式增量，只为<b>保真回放和 UI</b> 存在，并不进入模型历史。这个区分是后面 replay 能「逐字重演」的关键。</p>",
  },
  {
    id: "s2",
    file: "session.ts",
    region: "s2",
    title: "2 · append-only 日志：只能追加，不能改历史",
    prose:
      "<p>日志本体就一件事：<b>只允许 append 和读</b>。每条事件进来自动打上单调递增的 <code>seq</code>。不提供任何「修改第 3 条」的方法——历史一旦发生就固定，这正是「可追溯」的底座。</p>" +
      "<p><code>slice(uptoSeq)</code> 取「到某个时刻为止」的所有事件，是 replay 和 fork 共同的原语。</p>",
  },
  {
    id: "s3",
    file: "messages.ts",
    region: "s3",
    title: "3 · deriveMessages：从事件「投影」出模型看到的历史",
    prose:
      "<p>核心的一步。模型历史不是单独维护的状态，而是对日志做一次<b>投影</b>（projection）。dsh 里这个函数叫 <code>deriveMessages()</code>。</p>" +
      "<p>规则很直白：<code>user/message</code>、<code>assistant/message</code>、<code>tool/result</code> 进入历史；而 <code>assistant/chunk</code>、<code>turn/*</code>、<code>tool/call</code> 不进——它们只服务回放与 UI。改一次投影规则，全局模型输入就跟着变，不用到处改状态。</p>",
  },
  {
    id: "s4",
    file: "replay.ts",
    region: "s4",
    title: "4 · replay：把日志逐帧「重演」出来",
    prose:
      "<p>既然模型历史能从日志算出来，那么<b>回放到任意一步，就能还原出当时模型看到的世界</b>。这就是 dsh Trajectory 视图的原理。</p>" +
      "<p>replay 是个生成器：每吐出一帧，就带上「这一步的事件」和「重演到此刻的模型历史」。右侧的 Trace 面板正是消费这样的帧。</p>",
  },
  {
    id: "s5",
    file: "replay.ts",
    region: "s5",
    title: "5 · fork：从任意一步切一刀，另起一条会话",
    prose:
      "<p>因为历史是不可变事件，<b>分叉几乎是白送的</b>：把 <code>boundary</code> 之前的事件复制到一条新日志，历史共享、未来分叉。对齐 dsh 的 <code>ctx.sessions.fork(source, boundary?)</code>。</p>" +
      "<p>resume（断点续跑）、fork（试不同分支）、replay（回看），本质是同一条事件流上的三种读法——这就是「一切从日志派生」的红利。</p>",
  },
  {
    id: "s6",
    file: "agent-loop.ts",
    region: "s6",
    title: "6 · 把 loop 接上：模型看到的每件事都先落日志",
    prose:
      "<p>最后把 agent loop 接上来。关键纪律只有一条：<b>任何要给模型看的东西，先 append 成事件，再从日志派生请求</b>——绝不在 loop 里私藏一份 messages。</p>" +
      "<p>这样一来，loop 跑过的每一步都天然可追溯、可回放、可 fork。右侧切到「Trace 回放」标签，就能对着这段代码逐帧走这条录好的运行。</p>",
  },
];
