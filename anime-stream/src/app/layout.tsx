import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import ToastContainer from "@/components/Toast";
import { AuthProvider } from "@/contexts/AuthContext";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnimeStream - Watch Anime Online",
  description:
    "Free anime streaming. Watch your favorite anime online.",
  keywords: [
    "anime",
    "anime streaming",
    "watch anime free",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-600">
            <p>AnimeStream — For educational purposes only.</p>
          </footer>
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  );
}
