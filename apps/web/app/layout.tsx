import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { Providers } from "@/app/providers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

/**
 * `metadataBase` é o ÚNICO ponto do projeto que transforma rotas relativas em
 * URLs absolutas (canonical, og:url, og:image). Ele lê `NEXT_PUBLIC_APP_URL`,
 * que é também a única variável de domínio da aplicação — não existe nenhum
 * host de produto hardcoded em lugar nenhum do código.
 *
 * CONSEQUÊNCIA PRÁTICA: trocar o domínio final é trocar essa variável no
 * Vercel (mais a configuração externa do Supabase/Google). Ver o checklist em
 * docs/BRAND_DOMAIN_PUBLIC_SURFACE.md.
 */
export const metadata: Metadata = {
  title: {
    default: "Peteen — Infraestrutura de confiança para serviços pet",
    template: "%s · Peteen",
  },
  description:
    "Encontre profissionais pet confiáveis. Construa reputação sustentável. Relacionamentos recorrentes baseados em confiança verificável.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  applicationName: "Peteen",
  // Open Graph herdado por toda página que não sobrescrever. O canal de
  // distribuição do piloto é WhatsApp, onde um link sem preview parece
  // suspeito — e "suspeito" é fatal para um convite pessoal.
  //
  // `images` NÃO é declarado aqui: o Next resolve automaticamente o
  // `opengraph-image` de cada rota, e apontar para um arquivo inexistente
  // produziria uma tag quebrada em toda a aplicação.
  openGraph: {
    type: "website",
    siteName: "Peteen",
    locale: "pt_BR",
    title: "Peteen — Infraestrutura de confiança para serviços pet",
    description:
      "Encontre profissionais pet confiáveis. Construa reputação sustentável.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Peteen — Infraestrutura de confiança para serviços pet",
    description:
      "Encontre profissionais pet confiáveis. Construa reputação sustentável.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1F2E" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Leitura server-side da sessão para evitar flash no client
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers initialUser={user}>{children}</Providers>
      </body>
    </html>
  );
}
