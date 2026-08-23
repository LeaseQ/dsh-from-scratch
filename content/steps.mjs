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

// s0 用图：一条 append-only 日志被当作不同「读法」来用。中心是单一真相源，
// 向外指到模型历史（deriveMessages）、回放（replay）、分叉（fork）、续跑（resume）、可观测（session/event）。
const LOG_READS_SVG =
  "<div class='dfd'>" +
  "<svg viewBox='0 0 820 400' role='img' aria-label='一条 append-only 日志与它的多种读法' style='width:100%;max-width:800px;height:auto;display:block'>" +
  "<defs>" +
  "<marker id='lh' markerWidth='10' markerHeight='10' refX='7' refY='3' orient='auto'><path d='M0,0 L7,3 L0,6 Z' fill='#8a8f98'/></marker>" +
  "</defs>" +
  "<text x='24' y='24' fill='#6b655c' font-size='13' font-weight='600'>同一条日志，多种读法，而不是各存各的状态</text>" +
  // 中心：单一真相源
  "<rect x='36' y='150' width='272' height='110' rx='14' fill='#eef5f3' stroke='#cfe4de' stroke-width='1.6'/>" +
  "<text x='172' y='186' text-anchor='middle' font-size='14' font-weight='700' fill='#0f766e'>append-only 事件日志</text>" +
  "<text x='172' y='208' text-anchor='middle' font-size='11.5' fill='#2c463f'>SessionEvent · 单一真相源</text>" +
  "<text x='172' y='232' text-anchor='middle' font-size='10.5' fill='#57606a' font-family='ui-monospace,monospace'>append / slice，只增不改</text>" +
  // 五种读法节点（右侧一列）
  "<rect x='470' y='34' width='314' height='52' rx='11' fill='#eef5f3' stroke='#cfe4de'/><text x='486' y='58' font-size='13' fill='#0f766e' font-weight='600'>模型历史</text><text x='486' y='76' font-size='10.5' fill='#2c463f' font-family='ui-monospace,monospace'>deriveMessages(log) 从日志派生</text>" +
  "<rect x='470' y='104' width='314' height='52' rx='11' fill='#eef0fb' stroke='#d7dbf5'/><text x='486' y='128' font-size='13' fill='#4f46e5' font-weight='600'>回放</text><text x='486' y='146' font-size='10.5' fill='#6b6fae' font-family='ui-monospace,monospace'>replay 对同批事件重新投影</text>" +
  "<rect x='470' y='174' width='314' height='52' rx='11' fill='#eef0fb' stroke='#d7dbf5'/><text x='486' y='198' font-size='13' fill='#4f46e5' font-weight='600'>分叉</text><text x='486' y='216' font-size='10.5' fill='#6b6fae' font-family='ui-monospace,monospace'>fork(source, boundary?)</text>" +
  "<rect x='470' y='244' width='314' height='52' rx='11' fill='#eef0fb' stroke='#d7dbf5'/><text x='486' y='268' font-size='13' fill='#4f46e5' font-weight='600'>续跑</text><text x='486' y='286' font-size='10.5' fill='#6b6fae' font-family='ui-monospace,monospace'>resume · session/end-seed 标 seed 边界</text>" +
  "<rect x='470' y='314' width='314' height='52' rx='11' fill='#eef5f3' stroke='#cfe4de'/><text x='486' y='338' font-size='13' fill='#0f766e' font-weight='600'>可观测</text><text x='486' y='356' font-size='10.5' fill='#2c463f' font-family='ui-monospace,monospace'>session/event 事件流</text>" +
  // 箭头：从中心指向每一种读法
  "<g stroke='#8a8f98' stroke-width='1.4' fill='none'>" +
  "<path d='M308,193 C 384,150 405,84 468,64' marker-end='url(#lh)'/>" +
  "<path d='M308,199 C 386,178 405,150 468,130' marker-end='url(#lh)'/>" +
  "<line x1='308' y1='205' x2='468' y2='200' marker-end='url(#lh)'/>" +
  "<path d='M308,211 C 386,232 405,252 468,270' marker-end='url(#lh)'/>" +
  "<path d='M308,217 C 384,258 405,322 468,340' marker-end='url(#lh)'/>" +
  "</g>" +
  "</svg>" +
  "<p class='dfd-cap'>图：同一条 append-only 日志，被当作模型历史、回放、分叉、续跑与可观测五种读法，而不是各存各的状态</p>" +
  "</div>";

export const steps = [
  /* ========== 第一模块：万物皆插件 ========== */
  {
    id: "k0",
    file: "kernel.ts",
    region: "k0",
    title: "万物皆插件",
    prose:
      "<p>在一切开始之前让我们先思考一个问题，一个能跑起来的 agent 需要哪些能力呢？负责生成回复的 <code>model</code>？负责查询外部信息的 <code>tools</code>？可以在 run 时把流程推进下去的逻辑（<code>agentLoop</code>）？</p>" +
      "<p>dsh认为，<b>每项能力都是一个插件</b>，可以根据用户的需求进行<b>动态的组装</b>。而组装的拆卸逻辑是经过精心设计的：每个插件挂载时，会把「如何复原自己」记成一个<b>撤销动作</b>（<code>provide</code> 捕获旧值 <code>prev</code>，<code>on</code> 返回移除监听的函数），记在该插件名下；<b>卸载时只需要执行对应的dispose函数</b>，所以影响范围被控制在该插件内部。</p>"+
      "<p>下面这个交互框模拟了插件挂载与卸载的过程，你可以点击插件进行装卸，并观察右侧「共享 ctx · 实时状态」面板里 services 与 on(run) 的增减，各插件的 dispose 也会随之登记与移除。</p>",
      principleProse:
      "<p>有了初步概念，再看一眼卸载为什么能精确到单个插件、互不牵连。</p>" +
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
      "<p>为什么卸载能这么干净？因为每个插件挂载时产生的副作用，都被单独收进它私有的一包，卸载谁就只回滚谁那一包，别的插件不受影响；单个插件内部登记了多条副作用时，才在自己这包里按登记顺序 LIFO 逐条撤销。至于这一包具体怎么切出来、每条撤销动作又落在哪行代码，后面「由表及里」讲 <code>provide</code> 与 <code>use</code> 时会对着源码看。</p>" +
      "<div class='callout tip'><span class='c-h'>事件不止 run，一个事件也不止一个监听者</span>为便于教学，nano 只演示了 <code>'run'</code> 这一个事件。对齐 dsh 架构文档，真实事件按域细分，例如 <code>session/*</code>、<code>agent/*</code>、<code>llm/*</code>；内核用 <code>Map&lt;event, Set&lt;fn&gt;&gt;</code> 存监听者，因此同一个事件可以挂多个插件，日志、埋点、限流都能在每轮 run 时依次介入。右侧交互面板挂上 logPlugin（教学示意插件，非 dsh 自带），即可看到 <code>on('run')</code> 同时列出 agentLoopPlugin 与 logPlugin 两个监听者。</div>",
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
    title: "由表及里（四）：配置换装，能力组合决定行为",
    prose:
      "<p>内核齐了，把开头组装的那个 agent 正式拼出来。每项能力都写成插件：<code>openaiModel</code>、<code>deepseekModel</code>、<code>tools</code>，连 agent loop 也不过是个监听 <code>run</code> 的插件。</p>" +
      "<p>在 <code>buildAgent</code> 里换一个 model，整条链路随之切换，内核、loop、tools 一处都不用改。这正是开头那种「随取随换、随取随卸」背后的机制：增加能力、替换模型、拆除组件，都只改配置。下面这个交互框换一种看法：不再盯着内核如何登记 / 回滚，而是勾选一组能力、点 <code>emit('run')</code> 跑一轮，看在场的插件组合把这一轮的行为塑造成什么样。缺哪类能力，输出里对应的那一行就会降级，行为的差异一目了然。</p>",
  },
  {
    id: "k6",
    file: "compose.ts",
    region: "k4",
    title: "组装与数据流：从 buildAgent 到一轮 run",
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
    title: "可追溯事件流",
    prose:
      "<p>上一章内核已经把插件拼起来跑一个 agent 了，但只是跑起来还不够，用户仍看不见它每一步在做什么。鉴于 agent 往往会<b>中断</b>、<b>恢复</b>、<b>回退</b>、<b>分叉</b>，想真正做到可观测，必须把每次的运行情况都完整记下来。</p>" +
      "<p>这就是 dsh 的第二大模块：<b>可追溯</b>。</p>" +
      "<p>它的做法是：一次运行里发生的一切，都记进一条<b>只增不改</b>的日志，模型看到的历史由这条日志<b>算出来</b>，不另存一份。</p>" +
      "<p>请观察下面这张图，中间是 append-only 日志，几条分叉则是从同一条日志读出来的不同能力，模型历史由 <code>deriveMessages</code> 派生，回放、分叉、续跑、可观测各取所需。</p>" +
      LOG_READS_SVG +
      "<div class='callout tip'><span class='c-h'>这一章的主线</span>围绕唯一的 <b>source of truth</b> 展开，那就是 append-only 的事件日志，<code>replay</code>、<code>fork</code>、模型历史等是对这份日志的不同解读，而不是各自维护一份状态。想清楚了这点，可观测与可回溯便水到渠成。</div>",
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
    id: "s5b",
    file: "replay.ts",
    region: "s7",
    title: "resume：把存档的事件喂回去，接着往下跑",
    prose:
      "<p>fork 是从某一步岔出一条新会话，前缀共享、往后各走各的。续跑要解决的是另一件事：会话中断过，或者换了个进程，怎么让它从上次停下的地方接着走。</p>" +
      "<p>办法顺着这一章的主线：既然一次运行的全部都躺在那条日志里，把<b>保存下来</b>的事件按 <code>seq</code> 顺序<b>重新喂回</b>一条新日志，会话状态就重建好了，接着往它后面 <code>append</code>、<code>runTurn</code> 即可。这就是 <code>resume</code>。</p>" +
      "<p>它和 <code>fork</code> 长得像、意图不同：<code>fork</code> 是<b>岔出一条新会话</b>，从某个边界复制前缀，之后原会话与子会话互不影响；<code>resume</code> 是把<b>同一条会话</b>从存档恢复回来，继续往下写。一个在分岔，一个在接续，读代码时留意这层区别就不会用混。</p>" +
      "<div class='callout def'><span class='c-h'>说清简化点</span>nano 的 <code>resume</code> 只做最小的一件事：按 <code>seq</code> 把存下来的事件重建一遍，再接着跑。真实 dsh 还带有 <code>session/end-seed</code> 的 seed 边界语义，用来标定从哪一步起算，这里不展开，免得把它讲成 dsh 里更完整的那套。</div>",
  },
  {
    id: "s5c",
    file: "session.ts",
    region: "s2b",
    title: "subscribe：日志每加一条，订阅方实时收到",
    prose:
      "<p>回放是回头看，续跑是接着跑，还差图里最后一条：<b>正在发生</b>的时候，能不能<b>实时</b>看到。既然每条事件都要先写进日志，那把「写进来」这个动作本身对外<b>广播</b>一下，观测就有了着落。</p>" +
      "<p>给 <code>SessionLog</code> 加一个 <code>subscribe</code>：登记一个回调，返回一个取消订阅的函数；<code>append</code> 每追加一条，就顺着已登记的订阅方逐一通知。观测方不用反复去问「有没有新事件」，日志会主动把新增推过来。</p>" +
      "<p>它是可观测的最小形态，对应 dsh 里的 <code>session/event</code> 事件流：观测到的内容<b>直接来自真相源</b>那条日志，而不是另开一路自己维护，所以看到的与真正发生的是同一份。</p>" +
      "<div class='callout tip'><span class='c-h'>为什么挂在这一层</span>把通知放在 <code>append</code> 落库之后，观测就与写入<b>同源同序</b>：先落日志、再广播，订阅方收到的顺序与事件真正写入的顺序一致。这也顺着「要给模型看的先写进日志」那条纪律，白捡到的一点好处。</div>",
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
  {
    id: "s7",
    file: "agent-loop.ts",
    region: "s6",
    title: "小结：可追溯到底换来了什么",
    prose:
      "<p>第二章从一条只增不改的日志起步，一节一节把它的读法补齐。走到这里，可以把它换来的东西收拢一下，也顺带说清它的边界。</p>" +
      "<p>先看结论：把一次运行完整写进日志之后，回看、续跑、分叉、可观测这几件事，就都变成了对同一条日志的不同读法，而不是各自维护一份状态。为此，前面几节一直守着同一条纪律，要给模型看的内容，先写成事件，再从日志派生。有了这条纪律，几样能力便顺势而来。</p>" +
      "<ul class='plist'>" +
      "<li><b>回看</b>靠的是 <code>replay</code>，它按 <code>seq</code> 把已存事件重新投影一遍，既不重跑 agent 也不发模型请求，所以想知道第三步时模型看到了什么，重放出来即可，不必猜。</li>" +
      "<li><b>续跑</b>则是中断之后从日志接着往下写，<code>session/end-seed</code> 标出 seed 边界，续跑时清楚从哪一步起算。</li>" +
      "<li><b>分叉</b>用 <code>fork(source, boundary?)</code> 把边界之前的事件拷到新日志，前缀只读且共享，试别的走法不会改坏原分支。</li>" +
      "<li><b>可观测</b>来自 <code>session/event</code> 这类事件流，它本就出自真相源，观测到的与真正发生的是一回事。</li>" +
      "<li><b>模型历史不漂移</b>，是因为历史由 <code>deriveMessages</code> 从日志算出、不另存一份，也就不会和日志对不上。</li>" +
      "</ul>" +
      "<div class='callout def'><span class='c-h'>Tips</span>这套做法本质是<b>事件溯源</b>（读写分离）在 agent 场景里的一次彻底落地，并非 dsh 首创。它更值得学的地方，是把「模型输入必须能从日志重构」定成硬不变量，连模型返回的原始 chunk 与请求的 header 都一并写进日志，让「第几步模型看到了什么」都有据可查。</div>" +
      "<p>把它和 pi 的做法对比，差别集中在 <b>source of truth</b>：pi 直接维护并原地改写 <code>context.messages</code>，compaction 也改它，事件流只喂 UI、不持久；dsh 则把事件写进 append-only 日志，状态一律从日志派生。</p>" +
      "<table class='compare'><thead><tr><th>维度</th><th>pi（存并改写 messages）</th><th>dsh（append-only 事件 + 派生）</th></tr></thead><tbody>" +
      "<tr><td>真相源</td><td>原地维护的 <code>context.messages</code> 数组</td><td class='hi'>append-only 的 <code>SessionEvent</code> 日志</td></tr>" +
      "<tr><td>模型历史</td><td>就是 messages 本身，compaction 也直接改它</td><td class='hi'>由 <code>deriveMessages</code> 从日志派生，不另存一份</td></tr>" +
      "<tr><td>回看某一步</td><td>历史被改写后难以还原</td><td class='hi'><code>replay</code> 按 <code>seq</code> 重放同批事件</td></tr>" +
      "<tr><td>从中间分叉</td><td>无内建分叉</td><td class='hi'><code>fork(source, boundary?)</code> 从边界拷贝前缀</td></tr>" +
      "<tr><td>续跑</td><td>无持久日志，续跑依赖内存里的 messages</td><td class='hi'>可从日志续写，<code>session/end-seed</code> 标 seed 边界</td></tr>" +
      "<tr><td>可观测</td><td>事件流只喂 UI、不持久、非真相源</td><td class='hi'><code>session/event</code> 事件流，来源即真相源</td></tr>" +
      "</tbody></table>" +
      "<p class='cite'>对照另一类做法：LangGraph 的持久化靠 checkpointer 保存线程的图状态快照（<a href='https://docs.langchain.com/oss/python/langgraph/persistence' target='_blank' rel='noreferrer'>LangChain 官方文档 · Persistence，2026-08 访问</a>：Checkpointers persist a thread's graph state as checkpoints），属于「存状态」的路子；dsh 走的是「存事件、派生状态」。</p>" +
      "<div class='callout warn'><span class='c-h'>代价</span>当然，可追溯也不是白来的，需要承担相应的代价：" +
      "<ol class='plist'>" +
      "<li>日志只增不改，体积会持续增长；</li>" +
      "<li>模型历史每轮都要重新派生，带来额外开销；</li>" +
      "<li>它成立的前提，是严格遵循「模型可见必先入日志」这条规则，dsh 的 compaction 用 <code>surfaceOp: replace</code> 叠加来压缩、而非改写历史。</li>" +
      "</ol></div>" +
      "<h3 class='wrapup-h'>回过头看 dsh</h3>" +
      "<p>两章合起来，dsh 的骨架其实只有两根：<b>能力怎么来</b>，交给插件装配，<code>ctx</code> 既是服务注册表也是事件总线，连 agent loop 自己都是挂上去的插件，没有特权核心；<b>发生了什么</b>，交给 append-only 的事件日志，模型历史、回放、分叉、续跑都从这条日志派生，不另存一份状态。这两根骨架分别对应它那句 <code>Everything is a plugin, Every run is traceable</code>。</p>" +
      "<p>两者是互相咬合的：插件可以随时替换、叠加，行为组合会变得很松散，此时日志作为唯一真相源，把「谁在什么时候做了什么」钉死下来，插件再怎么换，运行过程仍然可查、可回放。</p>" +
      "<p>nano-dsh 用 6 个文件、166 行代码（含注释与空行共 271 行）复刻的就是这两根骨架。真实 dsh 的 <code>packages/</code> 核心代码（TS/TSX，排除测试与生成文件）约 24.6 万行，多出来的部分是模型适配、工具与技能、sandbox、存储、调度、终端 UI 这些工程层，内核这两条主线并没有变。</p>" +
      "<p class='cite'>行数为本站实测：克隆 <a href='https://github.com/deepseek-ai/deepseek-harness' target='_blank' rel='noreferrer'>deepseek-ai/deepseek-harness</a> 于 commit <code>b150a55</code>（2026-08 统计）后按上述口径统计得到。</p>" +
      "<p class='cite'>参考：<a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/subsystems/session.md' target='_blank' rel='noreferrer'>dsh session 子系统文档</a> · <a href='https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/master/docs/architecture.md' target='_blank' rel='noreferrer'>dsh 架构文档</a></p>",
  },
];
