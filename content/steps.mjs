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

// 对标 pi 那张「一轮 Agent Loop 内部数据流」的内联 SVG：中心是共享 ctx，
// 组装期各插件登记到 ctx，运行期 emit('run') 驱动一轮循环，虚线为投影到 UI / Trace。
const FLOW_SVG =
  "<div class='dfd'>" +
  "<svg viewBox='0 0 840 620' role='img' aria-label='nano-dsh 装配与一轮 Agent Loop 数据流图' style='width:100%;max-width:820px;height:auto;display:block'>" +
  "<defs>" +
  "<marker id='ah' markerWidth='10' markerHeight='10' refX='7' refY='3' orient='auto'><path d='M0,0 L7,3 L0,6 Z' fill='#8a8f98'/></marker>" +
  "<marker id='ahd' markerWidth='10' markerHeight='10' refX='7' refY='3' orient='auto'><path d='M0,0 L7,3 L0,6 Z' fill='#4f46e5'/></marker>" +
  "</defs>" +
  "<text x='28' y='24' fill='#6b655c' font-size='13' font-weight='600'>组装期 · use(plugin)：向同一个 ctx 登记服务 / 监听 / 可撤销副作用</text>" +
  "<rect x='40' y='40' width='150' height='40' rx='9' fill='#eef5f3' stroke='#cfe4de'/><text x='115' y='65' text-anchor='middle' font-size='13' fill='#0f766e'>modelPlugin</text>" +
  "<rect x='228' y='40' width='150' height='40' rx='9' fill='#eef5f3' stroke='#cfe4de'/><text x='303' y='65' text-anchor='middle' font-size='13' fill='#0f766e'>toolsPlugin</text>" +
  "<rect x='416' y='40' width='172' height='40' rx='9' fill='#eef0fb' stroke='#d7dbf5'/><text x='502' y='65' text-anchor='middle' font-size='13' fill='#4f46e5'>agentLoopPlugin</text>" +
  "<rect x='624' y='40' width='150' height='40' rx='9' fill='#eef5f3' stroke='#cfe4de'/><text x='699' y='65' text-anchor='middle' font-size='13' fill='#0f766e'>sessionPlugin</text>" +
  "<g stroke='#8a8f98' stroke-width='1.4' fill='none'>" +
  "<line x1='115' y1='80' x2='115' y2='154' marker-end='url(#ah)'/>" +
  "<line x1='303' y1='80' x2='303' y2='154' marker-end='url(#ah)'/>" +
  "<line x1='502' y1='80' x2='502' y2='154' marker-end='url(#ah)'/>" +
  "<line x1='699' y1='80' x2='699' y2='154' marker-end='url(#ah)'/>" +
  "</g>" +
  "<g font-size='11' fill='#57606a' text-anchor='middle' font-family='ui-monospace,monospace'>" +
  "<rect x='63' y='112' width='104' height='15' rx='3' fill='#fbfaf8'/><text x='115' y='124'>provide('model')</text>" +
  "<rect x='255' y='112' width='96' height='15' rx='3' fill='#fbfaf8'/><text x='303' y='124'>provide('tools')</text>" +
  "<rect x='472' y='112' width='60' height='15' rx='3' fill='#fbfaf8'/><text x='502' y='124'>on('run')</text>" +
  "<rect x='643' y='112' width='112' height='15' rx='3' fill='#fbfaf8'/><text x='699' y='124'>provide('sessions')</text>" +
  "</g>" +
  "<rect x='40' y='154' width='734' height='64' rx='14' fill='#eef5f3' stroke='#cfe4de' stroke-width='1.4'/>" +
  "<text x='407' y='182' text-anchor='middle' font-size='15' font-weight='700' fill='#0f766e'>共享 ctx</text>" +
  "<text x='407' y='205' text-anchor='middle' font-size='11.5' fill='#2c463f'>服务注册表 provide / get　·　事件总线 on / emit　·　可撤销副作用（卸载即回滚）</text>" +
  "<text x='28' y='260' fill='#6b655c' font-size='13' font-weight='600'>运行期 · emit('run') 触发 agentLoop 监听器，驱动一轮循环</text>" +
  "<line x1='100' y1='218' x2='100' y2='294' stroke='#8a8f98' stroke-width='1.4' fill='none' marker-end='url(#ah)'/>" +
  "<rect x='108' y='247' width='40' height='15' rx='3' fill='#fbfaf8'/><text x='128' y='259' text-anchor='middle' font-size='11' fill='#57606a' font-family='ui-monospace,monospace'>触发</text>" +
  "<rect x='40' y='298' width='120' height='46' rx='10' fill='#eef0fb' stroke='#d7dbf5'/><text x='100' y='326' text-anchor='middle' font-size='12.5' fill='#4f46e5' font-family='ui-monospace,monospace'>emit('run')</text>" +
  "<rect x='196' y='298' width='168' height='46' rx='10' fill='#eef0fb' stroke='#d7dbf5'/><text x='280' y='320' text-anchor='middle' font-size='12.5' fill='#4f46e5'>agentLoop 监听器</text><text x='280' y='336' text-anchor='middle' font-size='10.5' fill='#6b6fae' font-family='ui-monospace,monospace'>on('run') handler</text>" +
  "<rect x='402' y='298' width='176' height='46' rx='10' fill='#eef5f3' stroke='#cfe4de'/><text x='490' y='320' text-anchor='middle' font-size='12.5' fill='#0f766e'>deriveMessages</text><text x='490' y='336' text-anchor='middle' font-size='10.5' fill='#2c463f'>从日志算出模型输入</text>" +
  "<rect x='618' y='298' width='178' height='46' rx='10' fill='#ffffff' stroke='#ddd8cf'/><text x='707' y='320' text-anchor='middle' font-size='12.5' fill='#1f1d1a'>model 产出</text><text x='707' y='336' text-anchor='middle' font-size='10' fill='#6b655c' font-family='ui-monospace,monospace'>assistant/message · toolCalls</text>" +
  "<g stroke='#8a8f98' stroke-width='1.4' fill='none'>" +
  "<line x1='160' y1='321' x2='196' y2='321' marker-end='url(#ah)'/>" +
  "<line x1='364' y1='321' x2='402' y2='321' marker-end='url(#ah)'/>" +
  "<line x1='578' y1='321' x2='618' y2='321' marker-end='url(#ah)'/>" +
  "<line x1='707' y1='344' x2='707' y2='432' marker-end='url(#ah)'/>" +
  "</g>" +
  "<rect x='560' y='436' width='236' height='46' rx='10' fill='#ffffff' stroke='#ddd8cf'/><text x='678' y='458' text-anchor='middle' font-size='12.5' fill='#1f1d1a'>tool.execute</text><text x='678' y='474' text-anchor='middle' font-size='10.5' fill='#6b655c' font-family='ui-monospace,monospace'>产出 tool/result</text>" +
  "<rect x='250' y='436' width='252' height='46' rx='10' fill='#eef5f3' stroke='#cfe4de'/><text x='376' y='458' text-anchor='middle' font-size='12.5' fill='#0f766e'>append SessionEvent</text><text x='376' y='474' text-anchor='middle' font-size='10.5' fill='#2c463f'>写入只增不改的日志</text>" +
  "<line x1='558' y1='459' x2='506' y2='459' stroke='#8a8f98' stroke-width='1.4' fill='none' marker-end='url(#ah)'/>" +
  "<path d='M376,436 C 400,392 450,372 486,346' stroke='#8a8f98' stroke-width='1.4' fill='none' marker-end='url(#ah)'/>" +
  "<rect x='398' y='386' width='72' height='15' rx='3' fill='#fbfaf8'/><text x='434' y='398' text-anchor='middle' font-size='11' fill='#57606a' font-family='ui-monospace,monospace'>next turn</text>" +
  "<rect x='40' y='498' width='196' height='46' rx='10' fill='#eef0fb' stroke='#d7dbf5'/><text x='138' y='520' text-anchor='middle' font-size='12.5' fill='#383a52'>UI · Trace 面板</text><text x='138' y='536' text-anchor='middle' font-size='10' fill='#6b655c'>回放 / 可观测（emitted to UI）</text>" +
  "<g stroke='#4f46e5' stroke-width='1.3' fill='none' stroke-dasharray='5 4'>" +
  "<line x1='320' y1='482' x2='185' y2='498' marker-end='url(#ahd)'/>" +
  "<line x1='270' y1='344' x2='110' y2='498' marker-end='url(#ahd)'/>" +
  "</g>" +
  "<rect x='206' y='479' width='96' height='15' rx='3' fill='#fbfaf8'/><text x='254' y='491' text-anchor='middle' font-size='10.5' fill='#4f46e5' font-family='ui-monospace,monospace'>session 事件投影</text>" +
  "<rect x='104' y='402' width='92' height='15' rx='3' fill='#fbfaf8'/><text x='150' y='414' text-anchor='middle' font-size='10.5' fill='#4f46e5' font-family='ui-monospace,monospace'>agent 事件投影</text>" +
  "<line x1='300' y1='576' x2='340' y2='576' stroke='#8a8f98' stroke-width='1.6' marker-end='url(#ah)'/>" +
  "<text x='348' y='580' font-size='11.5' fill='#57606a'>实线：在 ctx 内流动 / 写入日志</text>" +
  "<line x1='560' y1='576' x2='600' y2='576' stroke='#4f46e5' stroke-width='1.4' stroke-dasharray='5 4' marker-end='url(#ahd)'/>" +
  "<text x='608' y='580' font-size='11.5' fill='#4f46e5'>虚线：投影到 UI · Trace</text>" +
  "</svg>" +
  "<p class='dfd-cap'>图：nano-dsh 一轮 Agent Loop 的装配与内部数据流</p>" +
  "</div>";

export const steps = [
  /* ========== 第一模块：万物皆插件 ========== */
  {
    id: "k0",
    file: "kernel.ts",
    region: "k0",
    title: "动手组装一个 agent",
    prose:
      "<p>我们来组装一个能运行的 agent。它需要几项能力：一项负责生成回复（model），一项负责查询外部信息（tools），还有一段在 run 时把流程推进下去的逻辑（agentLoop）。</p>" +
      "<p>下面这个交互框模拟了插件挂载与卸载的过程：点插件挂载、再点一次卸载，右侧「共享 ctx · 实时状态」面板里的 services 与 on(run) 会随之增减，回滚栈 dispose[] 也会成对压入与弹出，操作日志把每次登记（＋）与回滚（－）打印出来。</p>",
    principleProse:
      "<p>上手之后再看原理落在哪几行：卸载为什么能精确到单个插件、「移除该服务」到底移除了什么，右侧同步给出 <code>kernel.ts</code> 的两段真实源码，一段是 <code>use(plugin)</code>，一段是 <code>provide(name, impl)</code>，对照着读。</p>" +
      "<figure class='rollback-fig'>" +
      "<svg viewBox='0 0 640 360' role='img' aria-label='两层回滚结构示意图' xmlns='http://www.w3.org/2000/svg'>" +
      "<defs><style>" +
      ".rf-plug{fill:var(--bg-2);stroke:var(--line-2);}" +
      ".rf-plug.hi{fill:rgba(180,83,9,0.08);stroke:var(--amber);stroke-dasharray:5 4;}" +
      ".rf-undo{fill:var(--panel-2);stroke:var(--line-2);}" +
      ".rf-undo.hi{fill:rgba(180,83,9,0.12);stroke:var(--amber);}" +
      ".rf-t{font-family:var(--sans);fill:var(--txt);}" +
      ".rf-m{font-family:var(--mono);fill:var(--txt-dim);}" +
      ".rf-dim{fill:var(--txt-dim);}.rf-am{fill:var(--amber);}.rf-ac{fill:var(--accent-2);}" +
      "</style></defs>" +
      "<text x='20' y='26' class='rf-t' font-size='13' font-weight='700'>外层：一排相互独立的插件（可精确卸载任意一个，非全局 LIFO）</text>" +
      // model plugin (highlighted / being removed)
      "<rect class='rf-plug hi' x='20' y='42' width='180' height='52' rx='10'/>" +
      "<text x='36' y='66' class='rf-t' font-size='14' font-weight='700'>model</text>" +
      "<text x='36' y='84' class='rf-m' font-size='11'>正在卸载 ✕</text>" +
      "<text x='150' y='72' class='rf-am' font-size='20' font-weight='700'>✕</text>" +
      // tools plugin
      "<rect class='rf-plug' x='230' y='42' width='180' height='52' rx='10'/>" +
      "<text x='246' y='66' class='rf-t' font-size='14' font-weight='700'>tools</text>" +
      "<text x='246' y='84' class='rf-m' font-size='11'>不受扰动</text>" +
      // session plugin
      "<rect class='rf-plug' x='440' y='42' width='180' height='52' rx='10'/>" +
      "<text x='456' y='66' class='rf-t' font-size='14' font-weight='700'>session</text>" +
      "<text x='456' y='84' class='rf-m' font-size='11'>不受扰动</text>" +
      // connectors
      "<path d='M110 94 L110 118' stroke='var(--amber)' stroke-width='1.5'/>" +
      "<path d='M320 94 L320 118' stroke='var(--line-2)' stroke-width='1.5'/>" +
      "<path d='M530 94 L530 118' stroke='var(--line-2)' stroke-width='1.5'/>" +
      "<text x='20' y='138' class='rf-t' font-size='13' font-weight='700'>内层：每个插件私有的撤销包（插件内部多条副作用才按 LIFO 逐条弹出）</text>" +
      // model's private undo stack (highlighted)
      "<rect class='rf-undo hi' x='20' y='150' width='180' height='34' rx='7'/>" +
      "<text x='34' y='172' class='rf-m' font-size='12' font-weight='700'>delete 'model'</text>" +
      "<text x='34' y='202' class='rf-am' font-size='11'>← 只执行这一包</text>" +
      // tools undo stack
      "<rect class='rf-undo' x='230' y='150' width='180' height='34' rx='7'/>" +
      "<text x='244' y='172' class='rf-m' font-size='12'>delete 'tools'</text>" +
      // session undo stack (two entries -> LIFO within one plugin)
      "<rect class='rf-undo' x='440' y='150' width='180' height='34' rx='7'/>" +
      "<text x='454' y='172' class='rf-m' font-size='12'>off('run')</text>" +
      "<rect class='rf-undo' x='440' y='188' width='180' height='34' rx='7'/>" +
      "<text x='454' y='210' class='rf-m' font-size='12'>delete 'session'</text>" +
      "<path d='M630 205 L630 167' stroke='var(--accent-2)' stroke-width='1.5' marker-end='url(#rf-arr)'/>" +
      "<defs><marker id='rf-arr' markerWidth='7' markerHeight='7' refX='5' refY='3' orient='auto'><path d='M0 0 L6 3 L0 6 z' fill='var(--accent-2)'/></marker></defs>" +
      "<text x='454' y='240' class='rf-ac' font-size='11'>单插件内多条 → LIFO 弹出</text>" +
      // bottom note box
      "<rect x='20' y='268' width='600' height='72' rx='10' fill='var(--sel)' stroke='var(--line-2)'/>" +
      "<text x='38' y='294' class='rf-t' font-size='12.5' font-weight='700'>回滚是两层的</text>" +
      "<text x='38' y='314' class='rf-t' font-size='12'>插件之间相互独立，卸载 model 只跑它自己那包撤销动作，tools / session 纹丝不动。</text>" +
      "<text x='38' y='332' class='rf-t' font-size='12'>只有单个插件内部登记的多条副作用，才在它自己那包里严格 LIFO 逐条弹出。</text>" +
      "</svg>" +
      "</figure>" +
      "<p>卸载精确到单插件，靠的是 <code>use</code> 里的 <code>splice</code>。看右侧 <code>use</code>：<code>const start = this.effects.length</code> 先记下起点，<code>plugin(this)</code> 让插件把这一趟登记的副作用推进公共的 <code>effects</code>，随后 <code>const mine = this.effects.splice(start)</code> 把属于它的那几条剪下来、收进私有闭包 <code>mine</code>。返回的 dispose 里 <code>while (mine.length) mine.pop()!()</code> 只遍历这一包，于是卸载 model 时，tools、session 各自的 <code>mine</code> 没被触碰。</p>" +
      "<p>「移除该服务」是注册时就记下的反操作，落在 <code>provide</code> 里。看右侧 <code>provide</code>：写入前用 <code>const prev = this.services.get(name)</code> 捕获旧值，再压入撤销动作，<code>prev === undefined</code>（此前这个 key 为空）就 <code>delete</code> 掉该 key，否则 <code>set(prev)</code> 还原。model 属于首次注册，prev 为空，它的撤销动作正是把 <code>'model'</code> 这个 key 删掉。</p>" +
      "<p>两段并起来看：<code>provide</code> 决定每条撤销动作做什么，<code>use</code> 的 <code>splice</code> 决定它们归谁那一包。单个插件内部登记了多条副作用时，才在自己这包里按登记顺序 LIFO 逐条弹出。</p>" +
      "<div class='callout def'><span class='c-h'>两层回滚的边界</span>插件之间是一排并列的独立闭包，谁卸载只跑谁那包，没有跨插件的全局 LIFO；<code>on('run')</code> 返回的 dispose 也走这套登记，卸载时把监听者从事件表移除。</div>",
  },
  {
    id: "k1",
    file: "kernel.ts",
    region: "k0",
    title: "揭示：你刚才操作的这套机制，叫 Cordis",
    prose:
      "<p>恭喜你，其实你已经上手了 Cordis。刚才对能力的挂载与卸载，以及那套「登记副作用、卸载即回滚」的表现，看似随意，背后是一套有名字的机制，即 <b>Cordis</b>，dsh 的底层框架层。</p>" +
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
      "<p>本章末尾那个演示里的 <code>emit('run')</code> 就落在这里。插件之间需要能互相触发，又不能互相点名写死，否则又退回到那种反复改动的主循环。</p>" +
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
      "<p>在 <code>buildAgent</code> 里换一个 model，整条链路随之切换，内核、loop、tools 一处都不用改。这正是开头那种「随取随换、随取随卸」背后的机制：增加能力、替换模型、拆除组件，都只改配置。下面这个交互框换一种看法：不再盯着内核如何登记 / 回滚，而是勾选一组能力、点 <code>emit('run')</code> 跑一轮，看在场的插件组合把这一轮的行为塑造成什么样。缺哪类能力，输出里对应的那一行就会降级，行为的差异一目了然。</p>",
  },
  {
    id: "k6",
    file: "compose.ts",
    region: "k4",
    title: "组装与数据流：这些插件怎么拼成一个能跑的 agent",
    prose:
      "<p>到这里，<code>model</code>、<code>tools</code>、<code>agentLoop</code> 都以插件形式挂在同一个 <code>ctx</code> 上了。回到开头几个具体疑问：给了这么多文件，它们怎么组装成一个能跑的 agent？谁在监听、谁在分发？插件之间从不互相 <code>import</code>，凭什么能对上话？答案都落在 <code>ctx</code> 这一层。把过程拆成<b>组装期</b>与<b>运行期</b>两段来看。</p>" +
      "<p><b>组装期</b>发生在 <code>buildAgent</code> 里。<code>new Context()</code> 先建出一个空的 <code>ctx</code>，随后按顺序 <code>use</code> 每个插件。每次 <code>use(plugin)</code> 执行时，插件把要贡献的东西登记到 <code>ctx</code>：<code>model</code>、<code>tools</code> 用 <code>provide</code> 注册服务，<code>agentLoop</code> 用 <code>ctx.on('run', handler)</code> 注册一个监听器，登记的同时留下可撤销的回滚记录。<code>use</code> 的先后有意义：<code>agentLoop</code> 运行时会向 <code>ctx</code> 取 <code>model</code>，因此 <code>model</code> 服务要在触发之前就位。顺序保证的是「触发那一刻 <code>ctx</code> 上该有的都在」，而非插件间互相调用。装配结束，<code>ctx</code> 上攒齐了服务表与监听表，没有需要打补丁的特权核心。</p>" +
      "<div class='callout tip'><span class='c-h'>插件靠什么对上话</span>插件之间零直接 <code>import</code>，全靠 <code>ctx</code> 契约会合：约定好的事件名（如 <code>'run'</code>）、服务键（如 <code>'model'</code> / <code>'tools'</code>）、以及类型化的载荷（<code>SessionEvent</code> 等类型定义）就是它们提前签好的通信协议。谁都不点名对方，只在 <code>ctx</code> 上按约定的名字会合。</div>" +
      "<p><b>谁监听、谁分发</b>：监听方是插件，<code>agentLoop</code> 通过 <code>ctx.on('run', handler)</code> 订阅了 <code>'run'</code>；分发方是 <code>ctx</code> 本身，<code>ctx.emit('run', ...)</code> 把这次触发派发给所有注册在 <code>'run'</code> 上的监听器，逐个调用。触发方与监听方彼此不点名。<code>ctx</code> 既是服务注册表（<code>provide</code> / <code>get</code> 查找服务），又是事件总线（<code>on</code> / <code>emit</code> 收发事件），承担的正是居中转发这一角色。</p>" +
      "<p><b>运行期</b>：装配好后，<code>emit('run')</code> 就能跑。<code>ctx</code> 找到 <code>agentLoop</code> 的监听器并调用；监听器从 <code>ctx</code> 取到 <code>model</code> 与 <code>tools</code>，用 <code>deriveMessages</code> 从会话日志算出模型输入，交给 <code>model</code> 产出回复与工具调用，逐个 <code>tool.execute</code>，把每一步作为 <code>SessionEvent</code> 追加进只增不改的日志；本轮结束后，下一轮再从日志重新派生历史，如此循环。下图对标 pi 那张「一轮 Agent Loop 内部数据流」，画的是 dsh 的装配与一轮循环。</p>" +
      FLOW_SVG +
      "<div class='callout def'><span class='c-h'>与真实 dsh 对照</span>真实 dsh 把这套装配交给 <code>profile</code> / <code>bundle</code> 在启动时分层组合，服务键是 <code>ctx.llm</code> / <code>ctx.tools</code> / <code>ctx.sessions</code> / <code>ctx.agentLoop</code>，事件也细分为 <code>session/*</code>、<code>agent/*</code>、<code>llm/*</code> 等多个域；<code>deriveMessages()</code> 从日志投影模型历史、以及「模型能看到的必须先写进日志」这两条，与 nano 版一致。nano 版把键名简化成 <code>'model'</code> / <code>'tools'</code>，把触发简化成单个 <code>'run'</code> 事件，机制对齐，字段做了裁剪。</div>" +
      "<p class='cite'>参考：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档 · Cordis / Turn flow / Session log</a></p>",
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
