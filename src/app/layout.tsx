import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ApplyPilot",
  description: "Autofill job applications, track every application, and tailor your resume with AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
