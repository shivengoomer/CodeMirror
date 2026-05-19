import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import StyledJsxRegistry from "../lib/registry";
import { Providers } from "@/components/Providers";
import { LayoutContent } from "@/components/layout/LayoutContent";

export const metadata: Metadata = {
  title: "CodeMirror",
  description: "Coding mistake pattern dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="flex w-screen h-screen bg-background text-foreground font-sans overflow-hidden">
        <StyledJsxRegistry>
          <Providers>
            <LayoutContent>{children}</LayoutContent>
          </Providers>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}
