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
