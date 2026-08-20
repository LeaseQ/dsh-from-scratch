# nano-dsh from scratch

从零手写 **DeepSeek Harness（dsh）** 最核心的一半：**可追溯事件流 + Trajectory 回放**。

这是一个「读文章、右侧代码随进度补全、还能逐帧回放」的互动教学站，形式参考 [pi-from-scratch](https://github.com/SaladDay/pi-from-scratch)，主题聚焦 dsh 的 *Everything is a plugin, Every run is traceable* 里 **traceable** 的那一半。

> nano-dsh 是为教学重写的极简版（约 120 行），概念对齐 [dsh 官方架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)（append-only `SessionEvent` 日志、`deriveMessages()` 投影、`replay`、`fork`），但不是 dsh 的真实源码。

## 本地运行

```bash
npm install
npm run dev      # http://localhost:3000
```

## 构建（静态导出）

```bash
npm run build    # 产物在 out/，可直接部署到任意静态托管
```

## 一键部署到 Vercel

导入本仓库到 Vercel 即可，零配置（框架自动识别为 Next.js）。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## 它是怎么组织的（数据驱动 + 构建时同步）

```
nano-src/            真实教学源码（session/messages/replay/agent-loop），带 //#region 标记
content/steps.mjs    正文分段（每段指向 nano-src 的一个 region）
content/trace.mjs    一条录好的运行（离线静态数据，回放不发模型请求）
scripts/generate-content.mjs   构建时把 region 代码切片注入正文 → app/generated/content.ts
app/page.tsx         互动 UI（左文右码 + 滚动联动 + trace 逐帧回放/断点）
```

关键点：**右侧展示的代码 = 仓库里 `nano-src/` 的真实源码切片**，由 `prebuild` 钩子在每次构建前自动生成，不会和源码脱节。换主题只改 `nano-src/` + `content/`，UI 不用动。

## License

MIT
