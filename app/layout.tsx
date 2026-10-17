import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThreadsMonitoring - Bank BTN",
  description: "Dashboard social listening untuk postingan Threads tentang BTN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
