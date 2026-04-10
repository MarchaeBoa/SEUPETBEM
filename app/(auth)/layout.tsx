import Link from "next/link";
import { PawPrint } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-xl font-semibold"
      >
        <PawPrint className="h-6 w-6 text-primary" />
        SeuPetBem
      </Link>
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
