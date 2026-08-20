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
    return withSeq
  }

  all(): readonly SessionEvent[] {
    return this.events
  }

  // 截取到某个 seq 为止 —— replay / fork 的公共原语
  slice(uptoSeq: number): SessionEvent[] {
    return this.events.filter((e) => e.seq <= uptoSeq)
  }
}
//#endregion
