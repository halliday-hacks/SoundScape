import SignUp from "@/app/(unauth)/sign-up/SignUp";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#06080F]">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-6">
          <span
            className="text-2xl font-bold text-[#E2E8F0]"
            style={{ fontFamily: "var(--font-syne, sans-serif)", letterSpacing: "-0.02em" }}
          >
            Sound<span className="text-[#22D3EE]">Scape</span>
          </span>
        </div>
        <SignUp />
        <p className="text-center mt-4 text-sm text-[#64748B]">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-[#22D3EE] hover:text-[#06B6D4] underline underline-offset-2 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
