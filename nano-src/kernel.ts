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
  //#region kp
  provide<T>(name: string, impl: T): void {
    const prev = this.services.get(name)   // 写入前先捕获旧值，作为「反操作」的依据
    this.services.set(name, impl)
    // 注册即记下撤销动作：首次注册 prev 为空就 delete 掉该 key（这就是「移除该服务」），否则还原成旧值
    this.effects.push(() => {
      if (prev === undefined) this.services.delete(name)
      else this.services.set(name, prev)
    })
  }
  //#endregion

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
  // 挂载插件：把它这一趟登记的副作用切进「私有的一包」，卸载时只回滚这一包，这就是「可插拔」。
  use(plugin: Plugin): Dispose {
    const start = this.effects.length        // 记下起点
    plugin(this)                             // 插件把服务/监听推进公共 effects
    const mine = this.effects.splice(start)  // 剪出属于它的那几条，收进私有闭包 mine
    // 卸载 model 时只遍历它自己的 mine，tools、session 的 mine 不受影响
    return () => { while (mine.length) mine.pop()!() }
  }
}
//#endregion
