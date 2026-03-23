import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Gemini Embedding 2 x AI SDK x Supabase",
  description:
    "Embed text, images, audio, video, and PDFs into a searchable library powered by Gemini Embedding 2.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body
        className={`${fraunces.variable} ${jetbrainsMono.variable} min-h-screen bg-[#edeae2] font-[family:var(--font-mono)] text-[13px] leading-[1.65] text-stone-900 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
