import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import ActivityTracker from "@/components/ActivityTracker";

export const metadata: Metadata = {
  title: "Badminton Booking Platform",
  description: "Book badminton courts online"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased transition-colors duration-300 dark:bg-slate-950 dark:text-slate-50">
        <ThemeProvider>
          <ActivityTracker />
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
