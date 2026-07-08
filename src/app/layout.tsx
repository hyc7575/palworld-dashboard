import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Palworld Control",
  description: "Palworld 서버 제어판",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
