import SignIn from "@/app/(unauth)/sign-in/SignIn";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#07090E]">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-6">
          <span className="wordmark text-3xl text-[#DDE4F0]">
            Sound<span className="text-[#93C5FD]">Scape</span>
          </span>
        </div>
        <SignIn />
        <p className="text-center mt-4 text-sm text-[#5C6A82]">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="text-[#93C5FD] hover:text-[#BFDBFE] underline underline-offset-2 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
