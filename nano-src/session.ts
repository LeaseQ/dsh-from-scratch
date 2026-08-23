//#region s0
// nano-dsh / session.ts
// 唯一事实来源：一条 append-only 的事件日志。
// 对齐 dsh 的 core/session（ctx.sessions）。

export type ToolCall = { id: string; name: string; args: unknown }
//#endregion

//#region s1
// 会话事件：一旦写入，seq 单调递增，历史不可改。
export type SessionEvent =
  | { seq: number; type: "turn/start"; turnId: string }
  | { seq: number; type: "user/message"; text: string }
  | { seq: number; type: "assistant/chunk"; delta: string }
  | { seq: number; type: "assistant/message"; text: string; toolCalls: ToolCall[] }
  | { seq: number; type: "tool/call"; id: string; name: string; args: unknown }
  | { seq: number; type: "tool/result"; id: string; content: string }
  | { seq: number; type: "turn/end"; turnId: string }
//#endregion

//#region s2
export class SessionLog {
  private events: SessionEvent[] = []
  private seq = 0

  // 追加一条事件，自动分配 seq
  append(e: Omit<SessionEvent, "seq">): SessionEvent {
    const withSeq = { ...e, seq: this.seq++ } as SessionEvent
    this.events.push(withSeq)
//#endregion
    //#region s2b
    // 追加成功后，逐一把这条事件递给已登记的订阅方（session/event firehose 的迷你版）
    for (const fn of this.listeners) fn(withSeq)
    //#endregion
//#region s2
    return withSeq
  }

  all(): readonly SessionEvent[] {
    return this.events
  }

  // 截取到某个 seq 为止 —— replay / fork 的公共原语
  slice(uptoSeq: number): SessionEvent[] {
    return this.events.filter((e) => e.seq <= uptoSeq)
  }
//#endregion

  //#region s2b
  // 观测的另一半：登记与注销订阅。
  // 日志每追加一条，上面 append 里的通知就把它实时发给这里登记过的每个订阅方，不必轮询。
  private listeners: ((e: SessionEvent) => void)[] = []

  // 订阅日志追加，返回一个取消订阅的函数
  subscribe(fn: (e: SessionEvent) => void): () => void {
    this.listeners.push(fn)
    return () => {
      const i = this.listeners.indexOf(fn)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }
  //#endregion
//#region s2
}
//#endregion
