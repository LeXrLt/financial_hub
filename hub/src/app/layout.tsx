import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Financial Hub - 抓取系统监控',
  description: '信息抓取系统运行状态监控面板',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
