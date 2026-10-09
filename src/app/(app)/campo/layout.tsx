import { Sincronizador } from "./_componentes/sincronizador";

export default function CampoLayout({ children }: LayoutProps<"/campo">) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Sincronizador />
      {children}
    </div>
  );
}
