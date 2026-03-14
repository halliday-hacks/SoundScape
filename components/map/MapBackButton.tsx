"use client";

import Link from "next/link";

type Props = {
  href?: string;
  label?: string;
};

export function MapBackButton({ href = "/", label = "Back" }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        zIndex: 50,
        top: 12,
        left: 12,
      }}
    >
      <Link
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 12,
          background: "#171A12",
          color: "#EDE8DC",
          border: "1px solid rgba(255,255,255,0.08)",
          textDecoration: "none",
          fontSize: 13,
          lineHeight: 1,
          fontFamily: "var(--font-inter, system-ui)",
        }}
      >
        <span aria-hidden style={{ opacity: 0.9 }}>
          ←
        </span>
        <span>{label}</span>
      </Link>
    </div>
  );
}

