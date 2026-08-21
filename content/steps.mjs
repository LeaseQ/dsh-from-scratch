// content/steps.mjs —— 正文分段（与代码切片解耦）。
// 每个 step 指向 nano-src 里的一个 region，构建时由 generate-content.mjs 注入真实代码。
export const meta = {
  title: "nano-dsh",
  subtitle: "从零手写 dsh",
  tagline: "Everything is a plugin, Every run is traceable.",
  repo: "https://github.com/deepseek-ai/deepseek-harness",
  // 先导：暖场，讲清楚这篇是啥、怎么读
  preface:
    "<blockquote class='pf-quote'>看懂一个框架，与其读完它上万行源码，不如挑出关键的部分，自己动手写一遍。</blockquote>" +
    "<p>dsh（DeepSeek Harness）是 DeepSeek 开源的 agent harness，知识和内容很多，但随之而来的是上万行代码和大量 AI 生成的、难以理解的冗杂解析。</p>" +
    "<p>这篇文章不打算详细阐述它全部的设计思想，而是挑出了两个有代表性的模块，用一百多行从零写一遍。写完后，你就可以直观感受到它长什么样、有什么优缺点。</p>" +
    "<p>这个精简版我叫它 nano-dsh。</p>" +
    "<p>读法很简单：跟着文字往下走，需要什么就写什么，右边编辑器里对应的代码会自己浮现出来。你不用一上来就盯着几百行发怵，读到哪里、代码就会定位到哪里。</p>" +
    "<p>为什么挑这两个？因为 dsh 的立意可以概括成：<b>Everything is a plugin, Every run is traceable</b>。前半句「万物皆插件」是它区别于其余框架的地方；后半句「可追溯」则是所有需要可观测的框架 / 项目都值得借鉴的。</p>" +
    "<p>放轻松，这是篇文章，不是一本书，看不懂的语法先跳过，让我们直观地体验一次 Loop 的流程。</p>" +
    "<p class='pf-note'>说明：形式参考了 <a href='https://pi-from-scratch.vercel.app/' target='_blank' rel='noreferrer'>pi-from-scratch</a>。</p>",
};

export const steps = [
  /* ========== 第一模块：万物皆插件 ========== */
  {
    id: "k0",
    file: "kernel.ts",
    region: "k0",
    title: "先动手组装一个 agent",
    prose:
      "<p>我们先组装一个能运行的 agent。它需要几项能力：一项负责生成回复（model），一项负责查询外部信息（tools），还有一段在 run 时把流程推进下去的逻辑（agentLoop）。</p>" +
      "<p>dsh 主打「万物皆插件」，可挂载的能力远不止这三样。官网把 models、tools、skills、sessions、sandboxes、storage、loops、scheduling、UI 都列为插件类目：model 提供生成回复的适配器、tools 提供可被调用的工具、skills 提供可复用的技能片段、session 提供 append-only 事件日志、sandbox 提供隔离执行环境、storage 提供持久化、scheduler 负责后台与定时任务、ui 负责界面渲染。它们都挂在同一个 <code>ctx</code> 上，没有谁是特权核心。</p>" +
      "<p>下面这个交互框可直接操作。这些能力都可以挂载、卸载或替换，配置好后点 <code>emit('run')</code> 观察结果。先通过挂载、卸载与多次 run 建立直观印象。</p>" +
      "<p>操作时不妨观察一点：卸载某项能力，与它相关的行为随即消失；重新挂载，行为又恢复。</p>",
  },
  {
    id: "k1",
    file: "kernel.ts",
    region: "k0",
    title: "揭示：你刚才操作的这套机制，叫 Cordis",
    prose:
      "<p>恭喜你，其实你已经上手了 Cordis。刚才对能力的挂载、卸载与替换，以及点击 <code>emit('run')</code>，看似随意，背后是一套有名字的机制，即 <b>Cordis</b>，dsh 的底层框架层。</p>" +
      "<p>用准确的说法描述：每项能力都是一个插件。插件之间不互相 import，而是向一个共享上下文 <code>ctx</code> 贡献三类东西：服务（如 model、tools）、事件（<code>on</code> / <code>emit</code>），以及可撤销的副作用（卸载时自动回滚，也就是你刚才观察到的「卸载即消失、挂载即恢复」）。</p>" +
      "<p>dsh 文档中有一句概括很到位：没有一个需要打补丁的特权核心。连 agent loop 本身也是插件，不存在改不动的中心。</p>" +
      "<p>与 pi 对照一下，dsh 的特点会更清晰：</p>" +
      "<table class='compare'><thead><tr><th>维度</th><th>pi</th><th>dsh</th></tr></thead><tbody>" +
      "<tr><td>核心</td><td>写死的主循环</td><td class='hi'>插件内核，没有特权核心</td></tr>" +
      "<tr><td>模型 / 工具 / 会话</td><td>主循环调用的模块</td><td class='hi'>挂在 ctx 上的插件</td></tr>" +
      "<tr><td>agent loop 本身</td><td>就是那个主循环</td><td class='hi'>也是一个插件，可换</td></tr>" +
      "<tr><td>怎么换装</td><td>改代码</td><td class='hi'>改配置，源码不动</td></tr>" +
      "</tbody></table>" +
      "<p>有了名字，接下来把刚才建立的直观印象对应到内核代码里去看。右边先展示这个文件的开头，讲的正是这件事。</p>" +
      "<p class='cite'>参考：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档 · Cordis 章节</a></p>",
  },
  {
    id: "k2",
    file: "kernel.ts",
    region: "k1",
    title: "由表及里（一）：ctx 与 provide，挂上一个服务",
    prose:
      "<p>先看你刚才挂载的 model、tools。落到代码里，它们就是向共享上下文 <code>ctx</code> 用 <code>provide</code> 注册一个服务。谁要用 model，向 <code>ctx</code> 请求即可，无需知道由谁提供。</p>" +
      "<p>注意 <code>provide</code> 末尾几行：它在存入服务的同时，也记录了对应的撤销方式，卸载时把服务恢复为上一个。你此前观察到的「卸载即消失」，正是由这几行实现的。</p>",
  },
  {
    id: "k3",
    file: "kernel.ts",
    region: "k2",
    title: "由表及里（二）：事件 on / emit，插件之间不点名",
    prose:
      "<p>你点击的那个 <code>emit('run')</code> 就在这里。插件之间需要能互相触发，又不能互相点名写死，否则又退回到那种反复改动的主循环。</p>" +
      "<p>解决方式是走事件：<code>on('run', ...)</code> 订阅，<code>emit('run', ...)</code> 触发。触发方与监听方彼此无需知道对方存在。<code>on</code> 还会返回一个 <code>dispose</code>，同样登记进了撤销记录。</p>",
  },
  {
    id: "k4",
    file: "kernel.ts",
    region: "k3",
    title: "由表及里（三）：use，装卸对称",
    prose:
      "<p>服务和事件都能注册了，还差最后一步：既能整体装载，也能整体卸载。<code>use(plugin)</code> 负责收口。</p>" +
      "<p>装载时，把这个插件做的所有事收进一个作用域，并返回一个 <code>dispose</code>；一旦调用，就逐条撤销：服务恢复，监听移除。你此前观察到的「挂载即恢复、卸载即干净」，到这里形成了装卸对称。dsh 所说的「插件卸载时注册自动回滚」，指的就是这个。</p>",
  },
  {
    id: "k5",
    file: "compose.ts",
    region: "k4",
    title: "由表及里（四）：用配置把插件拼成一个 agent",
    prose:
      "<p>内核齐了，现在把开头你组装的那个 agent 正式拼出来。每项能力都写成插件：<code>openaiModel</code>、<code>deepseekModel</code>、<code>tools</code>，连 agent loop 也不过是个监听 <code>run</code> 的插件。skills、session、sandbox、storage、scheduler、ui 这些类目同样按这套写法挂到同一个 <code>ctx</code> 上，没有谁是特权核心。</p>" +
      "<p>在 <code>buildAgent</code> 里换一个 model，整条链路随之切换，内核、loop、tools 一处都不用改。这正是开头那种「随取随换、随取随卸」背后的机制：增加能力、替换模型、拆除组件，都只改配置。下面这个交互框可直接操作，切换 model 观察输出如何变化。</p>",
  },

  /* ========== 第二模块：可追溯事件流 ========== */
  {
    id: "s0",
    file: "session.ts",
    region: "s0",
    title: "接着上一章：能跑起来，还得能看清、能回头",
    prose:
      "<p>上一章内核已经能把插件拼起来跑一个 agent 了。但只是跑起来还不够：它一步步在干嘛，你其实<b>看不见</b>。</p>" +
      "<p>而 agent 又老是要<b>中断续跑</b>、<b>回看某一步</b>、<b>从中间分叉</b>试别的走法。想做到这些，前提是把一次运行完整记下来。这就是 dsh 的第二件事：<b>可追溯</b>。</p>" +
      "<p>它的做法是：一次运行里发生的一切，都记进一条<b>只增不改</b>的日志，模型看到的历史由这条日志<b>算出来</b>，不另存一份。我们先把事件类型 <code>SessionEvent</code> 定出来。</p>" +
      "<div class='callout tip'><span class='c-h'>这一章的主线</span>围绕一个<b>真相源</b>展开：append-only 的事件日志。<code>replay</code>、<code>fork</code>、模型历史，都是这条日志的不同<b>读法</b>，而不是各存各的状态。守住这点，可观测与可回溯便水到渠成。</div>",
  },
  {
    id: "s1",
    file: "session.ts",
    region: "s1",
    title: "定义 SessionEvent",
    prose:
      "<p>把一轮对话拆成一串事件：<b>开一轮</b> <code>turn/start</code>、<b>用户说话</b> <code>user/message</code>、<b>模型流式吐字</b> <code>assistant/chunk</code>、<b>模型说完</b> <code>assistant/message</code>、<b>调工具</b> <code>tool/call</code>、<b>工具返回</b> <code>tool/result</code>、<b>收一轮</b> <code>turn/end</code>。每种事件都是 <code>SessionEvent</code> 联合类型里的一支。</p>" +
      "<p>单独提一句 <code>assistant/chunk</code>：它是流式的<b>碎片</b>，只拿来回放和显示，<b>不进模型历史</b>。后面 <code>replay</code> 能一个字一个字重演，就靠它。</p>" +
      "<div class='callout warn'><span class='c-h'>易踩的坑</span>别把 <code>chunk</code> 也塞进模型历史。碎片本就是 <code>assistant/message</code> 的中间态，两者都进就会让模型看到<b>重复的半截文本</b>。区分「进历史」和「只回放」这两类事件，是这一层的第一道纪律。</div>",
  },
  {
    id: "s2",
    file: "session.ts",
    region: "s2",
    title: "append-only 日志",
    prose:
      "<p>日志 <code>SessionLog</code> 只干两件事：往后<b>加</b>（<code>append</code>）、往回<b>读</b>（<code>slice</code>）。每条进来自动编个号 <code>seq</code>，<b>没有</b>「改第几条」这种方法，也没有删除。</p>" +
      "<p><code>slice(uptoSeq)</code> 拿「到某一步为止」的所有事件，等下 <code>replay</code> 和 <code>fork</code> 都要用它来定位某个时间点。</p>" +
      "<div class='callout tip'><span class='c-h'>为什么只增不改</span>一旦允许<b>原地修改</b>历史，「第 3 步时模型看到了什么」就再也说不清了。只增不改换来的是：任意 <code>seq</code> 处的状态都<b>可复现</b>、可比对。这也是 <code>append</code> 只接收数据、由日志自己派发 <code>seq</code> 的原因，编号权不交给调用方。</div>",
  },
  {
    id: "s3",
    file: "messages.ts",
    region: "s3",
    title: "deriveMessages：从日志算出模型历史",
    prose:
      "<p>重点来了。模型看到的历史<b>不是另存一份</b>，而是把日志从头过一遍<b>算</b>出来，dsh 里这个函数叫 <code>deriveMessages</code>。</p>" +
      "<p>谁进历史谁不进，规则很清楚：<code>user/message</code>、<code>assistant/message</code>、<code>tool/result</code> <b>进</b>；<code>assistant/chunk</code>、<code>turn/*</code>、<code>tool/call</code> <b>不进</b>，它们只管回放和显示。</p>" +
      "<div class='flow'>" +
      "<div class='flow-title'>数据流：日志是源头，历史是投影</div>" +
      "<div class='flow-row'><span class='flow-node x'>agent 运行</span><span class='flow-arrow'>→ append →</span><span class='flow-node k'>SessionLog（只增不改）</span></div>" +
      "<div class='flow-row'><span class='flow-node k'>SessionLog</span><span class='flow-arrow'>→ deriveMessages →</span><span class='flow-node m'>Message[]（喂给模型）</span></div>" +
      "<div class='flow-row'><span class='flow-node k'>SessionLog</span><span class='flow-arrow'>→ replay / fork →</span><span class='flow-node'>回放 · 分叉</span></div>" +
      "<div class='flow-note'>只有 <code>SessionLog</code> 是持久状态；<code>Message[]</code>、回放帧、分支都是从它<b>派生</b>出来的视图，用完即弃。</div>" +
      "</div>" +
      "<div class='callout tip'><span class='c-h'>为什么这么设计</span>历史一旦是<b>算出来</b>的而非存出来的，就不会和日志<b>对不上</b>。想改模型看到的内容，只能改日志里的事件，没有第二个入口。这正是 dsh「模型能看到的，必须先写进日志」那条规矩落到代码里的样子。</div>",
  },
  {
    id: "s4",
    file: "replay.ts",
    region: "s4",
    title: "replay：把日志逐帧放一遍",
    prose:
      "<p>既然历史能<b>算</b>出来，那放到<b>任意一步</b>，就能还原出那一刻模型眼里的样子。dsh 的 <b>Trajectory 视图</b>就是这么回事。</p>" +
      "<p><code>replay</code> 是个<b>生成器</b>，每走一步给你「这一步的事件」加「到这步为止的历史」（对每个 <code>seq</code> 调一次 <code>deriveMessages</code>）。右边那个 <b>Trace 面板</b>，吃的就是这个。</p>" +
      "<div class='callout tip'><span class='c-h'>要点</span><code>replay</code> 本身<b>不重跑</b> agent、不发任何模型请求，它只是按 <code>seq</code> 把已存的事件重新<b>投影</b>一遍。所以回放是纯读、可离线、可反复，右侧面板的逐帧播放正是它的直接产物。</div>",
  },
  {
    id: "s5",
    file: "replay.ts",
    region: "s5",
    title: "fork：从某一步分叉",
    prose:
      "<p>事件<b>不可变</b>，所以分叉特别<b>便宜</b>：<code>fork(uptoSeq)</code> 把某一步之前的事件拷到一条<b>新日志</b>，前面共用，后面各走各的。</p>" +
      "<p><b>断点续跑</b>、<b>试别的分支</b>、<b>回看</b>，其实是同一条日志的三种<b>读法</b>而已，区别只在从哪个 <code>seq</code> 起、往哪条日志写。</p>" +
      "<div class='callout tip'><span class='c-h'>要点</span>因为前缀事件<b>只读且共享</b>，分叉不需要深拷贝整段历史，也不怕改坏原分支。这就是把「历史是算出来的、日志只增不改」两条约束叠在一起后，白捡到的能力。</div>",
  },
  {
    id: "s6",
    file: "agent-loop.ts",
    region: "s6",
    title: "接上 loop：先写日志，再问模型",
    prose:
      "<p>最后接上 loop。这里的规矩是：要给模型看的，<b>先写成事件</b>（<code>append</code>），再从日志 <code>deriveMessages</code> 算出请求，别在 loop 里偷偷存一份 <code>messages</code>。</p>" +
      "<p>守住这条，每一步就自动能<b>回放</b>、能<b>分叉</b>。右边切到「<b>Trace 回放</b>」，对着这段 loop 一步步走一遍看看。</p>" +
      "<div class='callout warn'><span class='c-h'>这里的顺序不能反</span>一旦 loop 里出现一份<b>私藏的</b> <code>messages</code>，或者<b>先问模型再补日志</b>，可追溯就破了：回放会与真实运行<b>对不上</b>，分叉也会缺事件。破坏的根源都在写入次序被打乱。</div>",
  },
];
