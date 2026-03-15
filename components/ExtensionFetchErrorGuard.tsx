"use client";

import { useEffect } from "react";

function isExtensionFailedFetch(reason: unknown): boolean {
  const asAny = reason as {
    name?: string;
    message?: string;
    stack?: string;
    toString?: () => string;
  };
  const message = asAny?.message ?? asAny?.toString?.() ?? "";
  const stack = asAny?.stack ?? "";
  const isTypeError = asAny?.name === "TypeError" || message.includes("TypeError");
  const isFailedFetch = message.includes("Failed to fetch");
  const fromExtension = stack.includes("chrome-extension://");
  return isTypeError && isFailedFetch && fromExtension;
}

export default function ExtensionFetchErrorGuard() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isExtensionFailedFetch(event.reason)) {
        event.preventDefault();
      }
    };

    const onError = (event: ErrorEvent) => {
      if (isExtensionFailedFetch(event.error)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
