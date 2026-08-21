//#region k4
// nano-dsh / compose.ts —— 用「配置」组装一个 agent，不改任何内核代码。
import { Context, type Plugin } from "./kernel"

// 每个能力都是插件：往 ctx 注册一个服务
const openaiModel: Plugin = (ctx) =>
  ctx.provide("model", { name: "gpt", call: async (m: string) => `gpt: ${m}` })
const deepseekModel: Plugin = (ctx) =>
  ctx.provide("model", { name: "deepseek", call: async (m: string) => `ds: ${m}` })
const tools: Plugin = (ctx) =>
  ctx.provide("tools", { read: (p: string) => `content of ${p}` })

// 连 agent loop 也只是个插件：从 ctx 取 model，谁挂着就用谁
const agentLoop: Plugin = (ctx) => {
  ctx.on("run", async (input: string) => {
    const model = ctx.get<any>("model")
    return model.call(input)
  })
}

// 「配置即组装」：换一行配置就换掉整个 model，内核和 loop 一行都不用动
export function buildAgent(config: { model: "openai" | "deepseek" }) {
  const ctx = new Context()
  ctx.use(config.model === "deepseek" ? deepseekModel : openaiModel)
  ctx.use(tools)
  ctx.use(agentLoop)   // loop 也是挂上去的，不是硬编码的核心
  return ctx
}
//#endregion
