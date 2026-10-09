"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { olvidarPaginas } from "./registrar-sw";

export function BotonSalir() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={async () => {
        await authClient.signOut();
        olvidarPaginas();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut />
    </Button>
  );
}
