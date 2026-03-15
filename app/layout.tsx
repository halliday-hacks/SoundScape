import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { getToken } from "@/lib/auth-server";
import { PropsWithChildren } from "react";
import { Press_Start_2P, Syne, Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export default async function RootLayout({ children }: PropsWithChildren) {
  const token = await getToken();
  return (
    <html
      lang="en"
      className={`dark ${outfit.variable} ${syne.variable} ${pixelFont.variable}`}
    >
      <body>
        <ConvexClientProvider initialToken={token}>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
