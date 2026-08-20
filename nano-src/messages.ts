//#region s3
// nano-dsh / messages.ts
import type { SessionEvent, ToolCall } from "./session"

export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string }

// 把事件日志投影成「模型看到的消息历史」
export function deriveMessages(events: readonly SessionEvent[]): Message[] {
  const messages: Message[] = []
  for (const e of events) {
    switch (e.type) {
      case "user/message":
        messages.push({ role: "user", content: e.text })
        break
      case "assistant/message":
        messages.push({ role: "assistant", content: e.text, toolCalls: e.toolCalls })
        break
      case "tool/result":
        messages.push({ role: "tool", toolCallId: e.id, content: e.content })
        break
      // turn/*、assistant/chunk、tool/call 不进模型历史
    }
  }
  return messages
}
//#endregion
