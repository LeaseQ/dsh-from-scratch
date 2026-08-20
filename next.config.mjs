/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // 纯静态导出，Vercel / 任意静态托管零配置
  images: { unoptimized: true },
};

export default nextConfig;
