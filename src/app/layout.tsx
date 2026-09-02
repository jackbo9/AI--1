import type { Metadata } from "next";
import "./globals.css";
import "./stage.css";
export const metadata: Metadata = { title: "九号行政智绘", description: "员工活动海报生成工具" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
