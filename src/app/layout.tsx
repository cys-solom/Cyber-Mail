import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diaa Store — Outlook Mail Fetcher",
  description: "Fast Outlook mail fetching with IMAP OAuth2 + Graph API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <div className="dragon-bg" />
        <div className="stars" />
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
