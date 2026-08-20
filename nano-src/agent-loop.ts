//#region s6
// nano-dsh / agent-loop.ts
import { SessionLog } from "./session"
import { deriveMessages } from "./messages"

export async function runTurn(log: SessionLog, model: any, tools: any, userText: string) {
  const turnId = crypto.randomUUID()
  log.append({ type: "turn/start", turnId })
  log.append({ type: "user/message", text: userText })

  while (true) {
    // 从日志派生模型输入 —— 不另存 messages
    const history = deriveMessages(log.all())
    const { text, toolCalls } = await streamAssistant(model, history, log)
    log.append({ type: "assistant/message", text, toolCalls })

    if (toolCalls.length === 0) break
    for (const tc of toolCalls) {
      log.append({ type: "tool/call", id: tc.id, name: tc.name, args: tc.args })
      const result = await tools[tc.name](tc.args)
      log.append({ type: "tool/result", id: tc.id, content: result })
    }
  }

  log.append({ type: "turn/end", turnId })
}
//#endregion
