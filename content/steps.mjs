// content/steps.mjs —— 正文分段（与代码切片解耦）。
// 每个 step 指向 nano-src 里的一个 region，构建时由 generate-content.mjs 注入真实代码。
export const meta = {
  title: "nano-dsh",
  subtitle: "从零手写 dsh 的两大模块：万物皆插件 + 可追溯事件流",
  tagline: "Everything is a plugin, Every run is traceable.",
  repo: "https://github.com/deepseek-ai/deepseek-harness",
  intro:
    "dsh 是 DeepSeek 开源的 agent harness。这篇把它两个最核心的模块，用极简代码从零写一遍：先写「万物皆插件」的内核，再写「可追溯事件流」。右侧编辑器里，你读到哪一块，代码就浮现到哪一块；读完，nano-dsh 的核心代码也就齐了。",
};

export const steps = [
  /* ========== 第一模块：万物皆插件 ========== */
  {
    id: "k0",
    file: "kernel.ts",
    region: "k0",
    title: "第一模块 · 万物皆插件：先说和 pi 差在哪",
    prose:
      "<p>先说清楚一件事：可追溯这件事 pi 也有，光看这个分不出两者。真正不一样的是结构。</p>" +
      "<p>pi 是一个写死的主循环，模型和工具是它调用的模块，想扩展就改代码。dsh 没有这种主循环，所有东西都是插件，挂在一个共享的 <code>ctx</code> 上，靠配置组装，不用动源码。连 agent loop 自己都是一个插件。</p>" +
      "<table class='compare'><thead><tr><th>维度</th><th>pi</th><th>dsh</th></tr></thead><tbody>" +
      "<tr><td>核心</td><td>写死的主循环</td><td class='hi'>插件内核，没有特权核心</td></tr>" +
      "<tr><td>模型 / 工具 / 会话</td><td>主循环调用的模块</td><td class='hi'>挂在 ctx 上的插件</td></tr>" +
      "<tr><td>agent loop 本身</td><td>就是那个主循环</td><td class='hi'>也是一个插件，可换</td></tr>" +
      "<tr><td>怎么换装</td><td>改代码</td><td class='hi'>改配置，源码不动</td></tr>" +
      "</tbody></table>" +
      "<p>dsh 文档里的原话是：没有一个需要打补丁的特权内核。这一章就把这个内核写出来。</p>" +
      "<p class='cite'>参考：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档 · Cordis 章节</a></p>",
  },
  {
    id: "k1",
    file: "kernel.ts",
    region: "k1",
    title: "共享 ctx：插件往上面挂服务",
    prose:
      "<p>内核只有一个共享上下文 <code>ctx</code>。插件不是被 import 进来的，而是往 <code>ctx</code> 上挂服务：<code>provide('model', ...)</code>、<code>provide('tools', ...)</code>。</p>" +
      "<p><code>provide</code> 里除了存服务，还顺手记了一条「怎么撤销」：卸载时把这个服务恢复成上一个。有了这条，插件才既装得上、也拆得干净。</p>",
  },
  {
    id: "k2",
    file: "kernel.ts",
    region: "k2",
    title: "事件总线：插件之间用事件说话",
    prose:
      "<p>插件之间不直接互相调用，而是通过 <code>ctx</code> 上的事件协作：<code>on('run', ...)</code> 订阅，<code>emit('run', ...)</code> 触发。</p>" +
      "<p><code>on</code> 返回一个 <code>dispose</code>，同样记进了「怎么撤销」。插件一卸载，它挂的监听自动摘掉，不留残留。</p>",
  },
  {
    id: "k3",
    file: "kernel.ts",
    region: "k3",
    title: "use()：装得上，也拆得干净",
    prose:
      "<p><code>use(plugin)</code> 把上面两件事收口。挂载时，把这个插件产生的所有副作用收进一个作用域，返回一个 <code>dispose</code>；调用它就逐个撤销：服务恢复、监听移除。</p>" +
      "<p>到这里，装一个能力和卸一个能力就完全对称了。dsh 说的「插件卸载时注册会自动回滚」就是这个意思。</p>",
  },
  {
    id: "k4",
    file: "compose.ts",
    region: "k4",
    title: "配置即组装：换个 model 只改一行",
    prose:
      "<p>把每个能力都写成插件：<code>openaiModel</code>、<code>deepseekModel</code>、<code>tools</code>。连 agent loop 也只是个监听 <code>run</code> 事件的插件。</p>" +
      "<p><code>buildAgent</code> 里换一个 model 插件，整条链路就换了，内核、loop、tools 都不用动。下面这个框可以直接点，切换 model 看输出。</p>",
  },

  /* ========== 第二模块：可追溯事件流 ========== */
  {
    id: "s0",
    file: "session.ts",
    region: "s0",
    title: "第二模块 · 可追溯：不存对话，存事件",
    prose:
      "<p>第二个模块是可追溯。dsh 的做法是：不单独存对话，而是存一条只增不改的事件日志，模型看到的历史从日志算出来。</p>" +
      "<p>它文档里的说法是：模型能看到的，必须先写进日志。先把事件类型定义出来。</p>",
  },
  {
    id: "s1",
    file: "session.ts",
    region: "s1",
    title: "定义 SessionEvent",
    prose:
      "<p>一轮对话拆成一串事件：开始一轮、用户说话、模型流式吐字、模型完整回复、调用工具、工具返回、结束一轮。</p>" +
      "<p>注意 <code>assistant/chunk</code>，它是流式的碎片，只用来回放和显示，不进模型历史。后面 replay 能逐字重演，靠的就是它。</p>",
  },
  {
    id: "s2",
    file: "session.ts",
    region: "s2",
    title: "append-only 日志",
    prose:
      "<p>日志只做两件事：往后加、往回读。每条进来自动编个号 <code>seq</code>，不提供改历史的方法。</p>" +
      "<p><code>slice(uptoSeq)</code> 取「到某一步为止」的所有事件，replay 和 fork 都用它。</p>",
  },
  {
    id: "s3",
    file: "messages.ts",
    region: "s3",
    title: "deriveMessages：从日志算出模型历史",
    prose:
      "<p>模型看到的历史不是另存一份，而是把日志过一遍算出来。dsh 里这个函数叫 <code>deriveMessages</code>。</p>" +
      "<p>规则很简单：<code>user/message</code>、<code>assistant/message</code>、<code>tool/result</code> 进历史；<code>assistant/chunk</code>、<code>turn/*</code>、<code>tool/call</code> 不进，它们只服务回放和显示。</p>",
  },
  {
    id: "s4",
    file: "replay.ts",
    region: "s4",
    title: "replay：把日志逐帧放一遍",
    prose:
      "<p>既然历史能从日志算出来，那放到任意一步，就能还原出那一刻模型看到的样子。dsh 的 Trajectory 视图就是这么来的。</p>" +
      "<p>replay 是个生成器，每走一步就给出「这一步的事件」和「到这一步为止的历史」。右边的 Trace 面板放的就是这个。</p>",
  },
  {
    id: "s5",
    file: "replay.ts",
    region: "s5",
    title: "fork：从某一步分叉",
    prose:
      "<p>事件是不可变的，所以分叉很便宜：把某一步之前的事件复制到一条新日志，前面共用，后面各走各的。</p>" +
      "<p>断点续跑、试不同分支、回看，其实是同一条日志的三种读法。</p>",
  },
  {
    id: "s6",
    file: "agent-loop.ts",
    region: "s6",
    title: "接上 loop：先写日志，再问模型",
    prose:
      "<p>最后把 loop 接上。规矩只有一条：要给模型看的东西，先写成事件，再从日志算出请求，不在 loop 里另存一份 messages。</p>" +
      "<p>这样每一步都自动可回放、可分叉。右边切到「Trace 回放」，对着这段 loop 一步步走一遍。</p>",
  },
];
