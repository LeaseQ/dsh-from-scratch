//#region s4
// nano-dsh / replay.ts
import { SessionLog, type SessionEvent } from "./session"
import { deriveMessages, type Message } from "./messages"

export type Frame = {
  cursor: number        // 回放到第几个事件
  event: SessionEvent   // 这一步的事件
  messages: Message[]   // 重演到此刻，模型看到的历史
}

export function* replay(log: SessionLog): Generator<Frame> {
  const events = log.all()
  for (let i = 0; i < events.length; i++) {
    const upto = log.slice(events[i].seq)
    yield { cursor: i, event: events[i], messages: deriveMessages(upto) }
  }
}
//#endregion

//#region s5
// 从某个 seq 切一刀，复制历史到子会话（未来各走各的）
export function fork(log: SessionLog, boundarySeq: number): SessionLog {
  const child = new SessionLog()
  for (const e of log.slice(boundarySeq)) {
    const { seq, ...rest } = e
    child.append(rest)  // 子会话重新分配 seq
  }
  return child
}
//#endregion

//#region s7
// 续跑：把之前保存下来的一串事件重新喂回一条新日志，会话就从上次断点接着往下走。
// 与 fork 的区别：fork 是从某个边界岔出一条新会话，前缀共享、往后各走各的；
// resume 是把同一条会话从存档恢复回来，继续往它后面 append / runTurn。
// 简化点：nano 的 resume 只做「按 seq 顺序重建，再接着跑」；真实 dsh 还有
// session/end-seed 的 seed 边界语义，用来标定从哪一步起算，这里不展开。
export function resume(events: readonly SessionEvent[]): SessionLog {
  const log = new SessionLog()
  const ordered = [...events].sort((a, b) => a.seq - b.seq)
  for (const e of ordered) {
    const { seq, ...rest } = e
    log.append(rest)  // 去掉旧 seq，由新日志顺序重新分配
  }
  return log
}
//#endregion
