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
    "<p class='pf-note'>说明：形式参考了 <a href='https://pi-from-scratch.vercel.app/' target='_blank' rel='noreferrer'>pi-from-scratch</a>。</p>",
};

export const steps = [
  /* ========== 第一模块：万物皆插件 ========== */
  {
    id: "k0",
    file: "kernel.ts",
    region: "k0",
    title: "先想清楚：我们要造一个能跑的 agent",
    prose:
      "<p>目标很朴素：造一个能跑起来的 agent。它得能调模型、能用工具、能一轮轮往下走。</p>" +
      "<p>最直接的写法是写一个主循环，把模型、工具都塞进去。能跑，但想加个能力、换个模型、把某样东西拆掉，都得回去改这段循环。东西一多，它就越来越难动。</p>" +
      "<p>dsh 换了个思路：不写这个写死的主循环，而是把每个能力都做成一个插件，挂在一个共享的 <code>ctx</code> 上，最后用配置把它们拼起来。连 agent loop 自己都是一个插件。</p>" +
      "<p>这套插件机制有个名字，叫 <b>Cordis</b>，是 dsh 底下的框架层。它规定了插件怎么往共享的 <code>ctx</code> 上贡献三样东西：服务（像 model、tools）、事件、还有可撤销的副作用。这一章，我们就把这个内核亲手写一遍。</p>" +
      "<p>顺手和 pi 比一下，能看清 dsh 特别在哪：</p>" +
      "<table class='compare'><thead><tr><th>维度</th><th>pi</th><th>dsh</th></tr></thead><tbody>" +
      "<tr><td>核心</td><td>写死的主循环</td><td class='hi'>插件内核，没有特权核心</td></tr>" +
      "<tr><td>模型 / 工具 / 会话</td><td>主循环调用的模块</td><td class='hi'>挂在 ctx 上的插件</td></tr>" +
      "<tr><td>agent loop 本身</td><td>就是那个主循环</td><td class='hi'>也是一个插件，可换</td></tr>" +
      "<tr><td>怎么换装</td><td>改代码</td><td class='hi'>改配置，源码不动</td></tr>" +
      "</tbody></table>" +
      "<p>dsh 文档里那句话我挺喜欢：没有一个需要打补丁的特权内核。下面写的 nano-dsh，就是把这套机制用极简代码复刻一遍。</p>" +
      "<p class='cite'>参考：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档 · Cordis 章节</a></p>",
  },
  {
    id: "k1",
    file: "kernel.ts",
    region: "k1",
    title: "共享 ctx：先有个地方能挂插件",
    prose:
      "<p>插件多了，得先有个地方挂它们。这个地方就是内核唯一的东西：共享的 <code>ctx</code>。</p>" +
      "<p>插件不是被 import 进来，而是往 <code>ctx</code> 上挂服务，像这样：<code>provide('model', ...)</code>。这样谁想用 model，问 <code>ctx</code> 要就行，不用知道它是谁提供的。</p>" +
      "<p>注意 <code>provide</code> 最后那几行，它存服务的同时还记了一手「怎么撤销」：卸载时把服务恢复回上一个。就这一手，插件才既装得上、也拆得干净。后面你会看到它有多值。</p>",
  },
  {
    id: "k2",
    file: "kernel.ts",
    region: "k2",
    title: "事件总线：插件之间不点名，用事件说话",
    prose:
      "<p>能挂服务还不够。插件之间得能互相触发，又不能互相点名写死，不然又绕回到那个改来改去的主循环了。</p>" +
      "<p>办法是走事件：<code>on('run', ...)</code> 订阅，<code>emit('run', ...)</code> 触发。谁触发的、谁在听，彼此都不用知道。</p>" +
      "<p><code>on</code> 会还给你一个 <code>dispose</code>，也一并记进了「怎么撤销」。插件一卸，它挂的监听自己就没了，不留尾巴。</p>",
  },
  {
    id: "k3",
    file: "kernel.ts",
    region: "k3",
    title: "use()：装得上，也拆得干净",
    prose:
      "<p>服务和事件都能挂了，还差最后一步：能整块地装，也能整块地卸。<code>use(plugin)</code> 就是来收口的。</p>" +
      "<p>挂的时候，把这个插件干的所有事收进一个作用域，还你一个 <code>dispose</code>；一调用，就挨个撤回去：服务恢复、监听摘掉。</p>" +
      "<p>到这儿，装能力和卸能力就对上了，完全对称。dsh 说的「插件卸载时注册自动回滚」，就是这个。下面这个框可以直接点，挂一个卸一个，看 ctx 怎么变。</p>",
  },
  {
    id: "k4",
    file: "compose.ts",
    region: "k4",
    title: "配置即组装：把插件拼成一个 agent",
    prose:
      "<p>内核齐了，现在把开头说的那个 agent 拼出来。每个能力都写成插件：<code>openaiModel</code>、<code>deepseekModel</code>、<code>tools</code>，连 agent loop 也就是个监听 <code>run</code> 的插件而已。</p>" +
      "<p><code>buildAgent</code> 里换一个 model，整条链路跟着换，内核、loop、tools 一个字都不用动。这就是开头想要的：加能力、换模型、拆东西，都只改配置。下面这个框你可以直接点，切换 model 看输出怎么变。</p>",
  },

  /* ========== 第二模块：可追溯事件流 ========== */
  {
    id: "s0",
    file: "session.ts",
    region: "s0",
    title: "接着上一章：能跑起来，还得能看清、能回头",
    prose:
      "<p>上一章内核已经能把插件拼起来跑一个 agent 了。但只是跑起来还不够：它一步步在干嘛，你其实看不见。</p>" +
      "<p>而 agent 又老是要中断续跑、回看某一步、从中间分叉试别的走法。想做到这些，前提是把一次运行完整记下来。这就是 dsh 的第二件事：可追溯。</p>" +
      "<p>它的做法是：一次运行里发生的一切，都记进一条只增不改的日志，模型看到的历史是从这条日志算出来的，不另存。文档里的规矩是：模型能看到的，必须先写进日志。我们先把事件类型定出来。</p>",
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
