import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SeuPetBem — Gestão completa para seu petshop",
  description:
    "SaaS multi-tenant para clínicas veterinárias, pet shops e hoteleiras.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
