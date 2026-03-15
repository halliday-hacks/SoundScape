import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { getToken } from "@/lib/auth-server";
import { PropsWithChildren } from "react";
import { Press_Start_2P, Outfit, Cormorant_Garamond } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
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
      className={`dark ${outfit.variable} ${cormorant.variable} ${pixelFont.variable}`}
    >
      <body>
        <ConvexClientProvider initialToken={token}>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
