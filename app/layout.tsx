import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { getToken } from "@/lib/auth-server";
import ExtensionFetchErrorGuard from "@/components/ExtensionFetchErrorGuard";
import Script from "next/script";
import { PropsWithChildren } from "react";
import { Press_Start_2P, Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export default async function RootLayout({ children }: PropsWithChildren) {
  const token = await getToken();
  return (
    <html lang="en" className={`dark ${inter.variable} ${pixelFont.variable}`}>
      <body>
        <Script id="suppress-extension-fetch-failures" strategy="beforeInteractive">
          {`
            (function () {
              function isExtensionFailedFetch(reason) {
                if (!reason) return false;
                var message = reason.message || (reason.toString ? reason.toString() : "");
                var stack = reason.stack || "";
                var isTypeError = reason.name === "TypeError" || message.indexOf("TypeError") !== -1;
                var isFailedFetch = message.indexOf("Failed to fetch") !== -1;
                var fromExtension = stack.indexOf("chrome-extension://") !== -1;
                return isTypeError && isFailedFetch && fromExtension;
              }

              window.addEventListener("unhandledrejection", function (event) {
                if (isExtensionFailedFetch(event.reason)) {
                  event.preventDefault();
                }
              });

              window.addEventListener("error", function (event) {
                if (isExtensionFailedFetch(event.error)) {
                  event.preventDefault();
                }
              });
            })();
          `}
        </Script>
        <ExtensionFetchErrorGuard />
        <ConvexClientProvider initialToken={token}>
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
