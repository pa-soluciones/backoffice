import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Campo({
  label,
  ayuda,
  className,
  ...props
}: { label: string; ayuda?: string } & React.ComponentProps<typeof Input>) {
  const id = props.id ?? props.name;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

export function AreaTexto({ label, className, ...props }: { label: string } & React.ComponentProps<"textarea">) {
  const id = props.id ?? props.name;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        {...props}
      />
    </div>
  );
}

export function MensajeError({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
}
