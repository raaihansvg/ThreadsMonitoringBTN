import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { TopHeader } from "@/components/TopHeader";
import { Sidebar } from "@/components/Sidebar";
import { SubHeader } from "@/components/SubHeader";
import { ModalToken } from "@/components/modals/ModalToken";
import { ModalInput } from "@/components/modals/ModalInput";
import { ModalImpor } from "@/components/modals/ModalImpor";
import { ModalConfirm } from "@/components/modals/ModalConfirm";
import { ToastNotification } from "@/components/ToastNotification";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "BTN Threads Monitoring - Social Listening Dashboard",
  description:
    "Bank BTN Social Listening - Pemantauan postingan Threads tentang BTN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={plusJakarta.variable}>
      <body className="min-h-screen bg-[#E4E9F2] p-3 font-sans text-[#0A192F] antialiased selection:bg-[#EBF3FF] selection:text-[#0055FF] md:p-6">
        <AppProvider>
          {/* FRAME UTAMA BENTO */}
          <div className="mx-auto max-w-[1440px] rounded-[36px] border border-white bg-[#F4F7FB] p-4 shadow-2xl md:p-7">
            {/* 1. TOP HEADER BAR */}
            <TopHeader />

            {/* 2. BODY: SIDEBAR KIRI + KONTEN BENTO */}
            <div className="flex flex-col gap-5 md:flex-row">
              {/* SIDEBAR KIRI (FLOATING PILL) */}
              <Sidebar />

              {/* MAIN BENTO CONTAINER (INNER WELL) */}
              <main className="min-w-0 flex-1 rounded-[32px] border border-white bg-[#E9EEF6]/70 p-4 md:p-6">
                <SubHeader />
                {children}
              </main>
            </div>
          </div>

          {/* MODALS */}
          <ModalToken />
          <ModalInput />
          <ModalImpor />
          <ModalConfirm />
          <ToastNotification />
        </AppProvider>
      </body>
    </html>
  );
}
