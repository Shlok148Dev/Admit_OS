import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "next-themes";
import ThemeToggle from "@/components/theme-toggle";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

import NotificationCenter from "@/components/notification-center";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "ADMIT OS — Post-Exam Command Center",
  description: "The post-exam operating system for Indian students (JEE, NEET, MHT-CET, KCET)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${jetbrainsMono.variable} min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
          <QueryProvider>
            <div className="flex min-h-screen">
              {/* Responsive Sidebar */}
              <Sidebar />

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col md:pl-16 xl:pl-[240px] transition-all duration-300 min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 dark:border-slate-800/40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
                  <div className="container flex h-16 items-center justify-between">
                    <div className="flex items-center gap-8">
                      <Link href="/" className="flex items-center gap-2">
                        <span className="text-xl font-extrabold tracking-tight text-foreground flex items-center">
                          ADMIT<span className="text-emerald-500 dark:text-emerald-400 ml-1">OS</span>
                        </span>
                      </Link>
                      <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-muted-foreground dark:text-slate-400">
                        <Link href="/rank-radar" className="hover:text-primary transition-colors">
                          Rank Radar
                        </Link>
                        <span className="text-slate-350 dark:text-slate-700">|</span>
                        <Link href="/chat" className="hover:text-primary transition-colors">
                          Chat Assistant
                        </Link>
                        <span className="text-slate-350 dark:text-slate-700">|</span>
                        <Link href="/counsel" className="hover:text-primary transition-colors">
                          Counseling Compass
                        </Link>
                        <span className="text-slate-350 dark:text-slate-700">|</span>
                        <Link href="/branch" className="hover:text-primary transition-colors">
                          Branch Compass
                        </Link>
                      </nav>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 hidden sm:flex">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        Official Data Source Verified
                      </div>
                      <ThemeToggle />
                      <NotificationCenter />
                    </div>
                  </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 container py-8">
                  {children}
                </main>

                {/* Footer */}
                <footer className="border-t border-slate-200/50 dark:border-slate-800/40 bg-white dark:bg-slate-950 py-6 mt-auto">
                  <div className="container flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground dark:text-slate-500">
                    <div className="flex flex-col gap-1">
                      <div className="font-extrabold text-foreground">ADMIT OS (v1.0.0-beta)</div>
                      <div>DPDP Act 2023 Compliant. Student profiles are stored securely. No PII is logged.</div>
                    </div>
                    <div className="text-center md:text-right max-w-md">
                      Predictions are generated using historical multi-model ensemble analysis. Checked against verified official JoSAA, CSAB, and MCC allotments. All predictions show statistical confidence intervals.
                    </div>
                  </div>
                </footer>
              </div>
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
