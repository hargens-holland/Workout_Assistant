import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConvexClerkProvider from "@/providers/ConvexClerkProvider";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workout Assistant AI",
  description: "Your personal AI powered workout planner and tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexClerkProvider>
      <html lang="en" className="dark">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0B0F14]`}>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col lg:ml-64">
              <TopBar />
              <main className="flex-1 bg-[#0B0F14] overflow-hidden">{children}</main>
            </div>
          </div>
        </body>
      </html>
    </ConvexClerkProvider>
  );
}
