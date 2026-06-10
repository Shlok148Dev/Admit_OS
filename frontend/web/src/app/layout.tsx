import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import Navbar from "@/components/nav/Navbar";
import MotionProvider from "@/components/motion/MotionProvider";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FORESIGHT — Signal Intelligence Platform",
  description: "Predict trends before they happen. Signal intelligence monitoring 50+ platforms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen bg-[#050508] text-[#f8fafc] grain grid-bg`}>
        <ThemeProvider 
          attribute="class" 
          defaultTheme="dark" 
          forcedTheme="dark"
          enableSystem={false}
        >
          <div className="relative flex flex-col min-h-screen overflow-x-hidden">
            <Navbar />
            <MotionProvider>
              <main className="flex-grow pt-20">
                {children}
              </main>
            </MotionProvider>
            <Toaster position="bottom-right" />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
