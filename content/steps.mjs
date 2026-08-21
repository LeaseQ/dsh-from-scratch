// content/steps.mjs —— 正文分段（与代码切片解耦）。
// 每个 step 指向 nano-src 里的一个 region，构建时由 generate-content.mjs 注入真实代码。
export const meta = {
  title: "nano-dsh",
  subtitle: "从零手写 dsh",
  tagline: "Everything is a plugin, Every run is traceable.",
  repo: "https://github.com/deepseek-ai/deepseek-harness",
  // 先导：暖场，讲清楚这篇是啥、怎么读
  preface:
    "<blockquote class='pf-quote'>看懂一个框架，最快的办法不是读完它上万行源码，而是挑出最关键的部分，自己动手写一遍。</blockquote>" +
    "<p>dsh（DeepSeek Harness）是 DeepSeek 开源的 agent harness，知识和内容很多，但随之而来的是上万行代码和大量 AI 生成的、难以理解的冗杂解析。</p>" +
    "<p>这篇文章不打算详细阐述它全部的设计思想，而是挑出了两个最能代表它的模块，用一百多行从零写一遍。写完后，你就可以直观感受到它长什么样、有什么优缺点。</p>" +
    "<p>这个精简版我叫它 nano-dsh。</p>" +
    "<p>读法很简单：跟着文字往下走，需要什么就写什么，右边编辑器里对应的代码会自己浮现出来。你不用一上来就盯着几百行发怵，读到哪里、代码就会定位到哪里。</p>" +
    "<p>为什么挑这两个？因为 dsh 就一句话：<b>Everything is a plugin, Every run is traceable</b>。前半句「万物皆插件」是它跟其余框架最不一样的地方；后半句「可追溯」则是所有需要可观测框架 / 项目都值得借鉴的。</p>" +
    "<p>放轻松，这是篇文章，不是一本书，看不懂的语法先跳过，让我们用最直观的方式来体验一次 Loop 的流程。</p>" +
    "<p class='pf-note'>说明：这是照着 <a href='https://pi-from-scratch.vercel.app/' target='_blank' rel='noreferrer'>pi-from-scratch</a> 的形式做的 dsh 版。nano-dsh 是为讲清楚重写的极简代码，不是 dsh 的真实源码，但概念对得上。</p>",
};

export const steps = [
  /* ========== 第一模块：万物皆插件 ========== */
  {
    id: "k0",
    file: "kernel.ts",
    region: "k0",
    title: "第一模块 · 万物皆插件：先说它和 pi 差在哪",
    prose:
      "<p>先说个容易误会的点：可追溯这事儿 pi 也有，光看它分不出谁是谁。dsh 真正特别的地方在结构。</p>" +
      "<p>pi 说到底是一个写死的主循环，模型、工具都是它调用的模块，想加东西就得改它。dsh 不是这么长的：它没有这个主循环，所有能力都是插件，挂在一个共享的 <code>ctx</code> 上，用配置拼起来。连 agent loop 自己都是一个插件。</p>" +
      "<p>下面这张表是两边的对照。这一章，我们把这个内核亲手写出来。</p>" +
      "<table class='compare'><thead><tr><th>维度</th><th>pi</th><th>dsh</th></tr></thead><tbody>" +
      "<tr><td>核心</td><td>写死的主循环</td><td class='hi'>插件内核，没有特权核心</td></tr>" +
      "<tr><td>模型 / 工具 / 会话</td><td>主循环调用的模块</td><td class='hi'>挂在 ctx 上的插件</td></tr>" +
      "<tr><td>agent loop 本身</td><td>就是那个主循环</td><td class='hi'>也是一个插件，可换</td></tr>" +
      "<tr><td>怎么换装</td><td>改代码</td><td class='hi'>改配置，源码不动</td></tr>" +
      "</tbody></table>" +
      "<p>dsh 文档里那句话我挺喜欢：没有一个需要打补丁的特权内核。</p>" +
      "<p class='cite'>参考：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档 · Cordis 章节</a></p>",
  },
  {
    id: "k1",
    file: "kernel.ts",
    region: "k1",
    title: "共享 ctx：插件往上面挂服务",
    prose:
      "<p>内核就一个东西：共享的 <code>ctx</code>。插件不是被 import 进来，而是往 <code>ctx</code> 上挂服务，像这样：<code>provide('model', ...)</code>。</p>" +
      "<p>注意 <code>provide</code> 最后那几行，它存服务的同时还记了一手「怎么撤销」：卸载时把服务恢复回上一个。就这一手，插件才既装得上、也拆得干净。后面你会看到它有多值。</p>",
  },
  {
    id: "k2",
    file: "kernel.ts",
    region: "k2",
    title: "事件总线：插件之间用事件说话",
    prose:
      "<p>插件之间不直接喊话，走事件：<code>on('run', ...)</code> 订阅，<code>emit('run', ...)</code> 触发。</p>" +
      "<p><code>on</code> 会还给你一个 <code>dispose</code>，也一并记进了「怎么撤销」。插件一卸，它挂的监听自己就没了，不留尾巴。</p>",
  },
  {
    id: "k3",
    file: "kernel.ts",
    region: "k3",
    title: "use()：装得上，也拆得干净",
    prose:
      "<p><code>use(plugin)</code> 把前面两件事收口。挂的时候，把这个插件干的所有事收进一个作用域，还你一个 <code>dispose</code>；一调用，就挨个撤回去：服务恢复、监听摘掉。</p>" +
      "<p>到这儿，装能力和卸能力就对上了，完全对称。dsh 说的「插件卸载时注册自动回滚」，就是这个。</p>",
  },
  {
    id: "k4",
    file: "compose.ts",
    region: "k4",
    title: "配置即组装：换个 model 只改一行",
    prose:
      "<p>现在把能力都写成插件：<code>openaiModel</code>、<code>deepseekModel</code>、<code>tools</code>。连 agent loop 也就是个监听 <code>run</code> 的插件而已。</p>" +
      "<p><code>buildAgent</code> 里换一个 model，整条链路跟着换，内核、loop、tools 一个字都不用动。下面这个框你可以直接点，切换 model 看输出怎么变。</p>",
  },

  /* ========== 第二模块：可追溯事件流 ========== */
  {
    id: "s0",
    file: "session.ts",
    region: "s0",
    title: "第二模块 · 可追溯：不存对话，存事件",
    prose:
      "<p>换个模块。第二件事是「可追溯」：一次运行里发生的一切，dsh 都记进一条只增不改的日志，模型看到的历史是从这条日志算出来的，不另存。</p>" +
      "<p>它文档里的规矩是：模型能看到的，必须先写进日志。我们先把事件类型定出来。</p>",
  },
  {
    id: "s1",
    file: "session.ts",
    region: "s1",
    title: "定义 SessionEvent",
    prose:
      "<p>把一轮对话拆成一串事件：开一轮、用户说话、模型流式吐字、模型说完、调工具、工具返回、收一轮。</p>" +
      "<p>单独提一句 <code>assistant/chunk</code>：它是流式的碎片，只拿来回放和显示，不进模型历史。后面 replay 能一个字一个字重演，就靠它。</p>",
  },
  {
    id: "s2",
    file: "session.ts",
    region: "s2",
    title: "append-only 日志",
    prose:
      "<p>日志就干两件事：往后加、往回读。每条进来自动编个号 <code>seq</code>，没有「改第几条」这种方法。</p>" +
      "<p><code>slice(uptoSeq)</code> 拿「到某一步为止」的所有事件，等下 replay 和 fork 都要用。</p>",
  },
  {
    id: "s3",
    file: "messages.ts",
    region: "s3",
    title: "deriveMessages：从日志算出模型历史",
    prose:
      "<p>重点来了。模型看到的历史不是另存一份，而是把日志从头过一遍算出来，dsh 里这个函数叫 <code>deriveMessages</code>。</p>" +
      "<p>谁进历史谁不进，一句话：<code>user/message</code>、<code>assistant/message</code>、<code>tool/result</code> 进；<code>assistant/chunk</code>、<code>turn/*</code>、<code>tool/call</code> 不进，它们只管回放和显示。</p>",
  },
  {
    id: "s4",
    file: "replay.ts",
    region: "s4",
    title: "replay：把日志逐帧放一遍",
    prose:
      "<p>既然历史能算出来，那放到任意一步，就能还原出那一刻模型眼里的样子。dsh 的 Trajectory 视图就是这么回事。</p>" +
      "<p>replay 是个生成器，每走一步给你「这一步的事件」加「到这步为止的历史」。右边那个 Trace 面板，吃的就是这个。</p>",
  },
  {
    id: "s5",
    file: "replay.ts",
    region: "s5",
    title: "fork：从某一步分叉",
    prose:
      "<p>事件不可变，所以分叉特别便宜：把某一步之前的事件拷到一条新日志，前面共用，后面各走各的。</p>" +
      "<p>断点续跑、试别的分支、回看，其实是同一条日志的三种读法而已。</p>",
  },
  {
    id: "s6",
    file: "agent-loop.ts",
    region: "s6",
    title: "接上 loop：先写日志，再问模型",
    prose:
      "<p>最后接上 loop。规矩就一条：要给模型看的，先写成事件，再从日志算出请求，别在 loop 里偷偷存一份 messages。</p>" +
      "<p>守住这条，每一步就自动能回放、能分叉。右边切到「Trace 回放」，对着这段 loop 一步步走一遍看看。</p>",
  },
];
