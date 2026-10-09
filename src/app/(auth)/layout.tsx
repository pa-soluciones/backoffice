import Image from "next/image";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sidebar px-4 py-10">
      <Image src="/logo-alt.svg" alt="PAS Piedra Angular Solutions" width={140} height={77} priority className="mb-8" />
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-xl sm:p-8">
        {children}
      </div>
    </div>
  );
}
