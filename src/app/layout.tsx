import type { Metadata, Viewport } from "next";
import { Outfit, Poppins } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "PAS Backoffice", template: "%s · PAS Backoffice" },
  description: "Gestión de presupuestos, obras, stock y documentación de Piedra Angular Solutions.",
};

export const viewport: Viewport = {
  themeColor: "#1f2123",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${outfit.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
