//#region k0
// nano-dsh / kernel.ts
// dsh 的灵魂：万物皆插件。模型、工具、会话、甚至 agent loop 本身，
// 都是挂在共享 ctx 上的插件。底层是 Cordis 内核：插件向共享上下文
// 贡献「服务 / 事件 / 可撤销的副作用」。
// 对齐 dsh 架构文档原话：There is no privileged core to patch.

export type Dispose = () => void
export type Plugin = (ctx: Context) => void
//#endregion

//#region k1
// 共享上下文：服务表 + 事件总线。所有能力都挂在这上面。
export class Context {
  private services = new Map<string, unknown>()
  private listeners = new Map<string, Set<(...a: any[]) => any>>()
  // 当前收集到的「可撤销副作用」——卸载插件时逐个回滚
  private effects: Dispose[] = []

  // 注册一个服务（model、tools、session… 全是服务）
  provide<T>(name: string, impl: T): void {
    const prev = this.services.get(name)
    this.services.set(name, impl)
    // 关键：注册本身是可撤销的。卸载时恢复上一个实现。
    this.effects.push(() => {
      if (prev === undefined) this.services.delete(name)
      else this.services.set(name, prev)
    })
  }

  get<T>(name: string): T {
    return this.services.get(name) as T
  }
//#endregion

//#region k2
  // 监听事件；返回的 dispose 也登记为可撤销副作用
  on(event: string, fn: (...a: any[]) => any): Dispose {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    const set = this.listeners.get(event)!
    set.add(fn)
    const dispose = () => set.delete(fn)
    this.effects.push(dispose)
    return dispose
  }

  // 触发事件：让各插件协作（这里简化为串行）
  async emit(event: string, ...args: any[]): Promise<void> {
    for (const fn of this.listeners.get(event) ?? []) await fn(...args)
  }
//#endregion

//#region k3
  // 挂载插件：把它产生的所有副作用收进一个作用域，
  // 返回 dispose —— 卸载时逐个回滚（服务恢复、监听移除）。这就是「可插拔」。
  use(plugin: Plugin): Dispose {
    const start = this.effects.length
    plugin(this)                    // 插件在 ctx 上注册服务/监听
    const mine = this.effects.splice(start)
    return () => { while (mine.length) mine.pop()!() }
  }
}
//#endregion
