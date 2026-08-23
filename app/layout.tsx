import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nano-dsh · 从零手写可追溯事件流",
  description:
    "交互式教学站：从零手写 DeepSeek Harness 的核心思想 —— 可追溯事件流 + Trajectory 回放。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
