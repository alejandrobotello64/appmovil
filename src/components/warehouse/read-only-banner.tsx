export function ReadOnlyBanner({
  visible,
  message,
}: {
  visible: boolean;
  message?: string;
}) {
  if (!visible) return null;
  return (
    <p className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      {message ??
        "Tu rol es de consulta: puedes ver la información, pero no registrar cambios."}
    </p>
  );
}
