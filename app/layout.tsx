import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remember Brain",
  description: "A personal second brain with document upload and RAG chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
