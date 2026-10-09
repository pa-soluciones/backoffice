import {
  BarChart3,
  CalendarDays,
  FolderTree,
  HardHat,
  House,
  KanbanSquare,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Visible en la barra inferior en mobile (máx. 4 + "Más"). */
  mobile?: boolean;
  /** false hasta que el módulo exista (ver spec/14-roadmap.md). */
  enabled: boolean;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: House, mobile: true, enabled: true },
  { href: "/explorador", label: "Explorador", icon: FolderTree, mobile: true, enabled: true },
  { href: "/seguimiento", label: "Seguimiento", icon: KanbanSquare, enabled: false },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, mobile: true, enabled: false },
  { href: "/campo", label: "Campo", icon: HardHat, mobile: true, enabled: false },
  { href: "/stock", label: "Stock", icon: Package, enabled: false },
  { href: "/finanzas", label: "Finanzas", icon: BarChart3, enabled: false },
  { href: "/ajustes", label: "Ajustes", icon: Settings, enabled: true },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
