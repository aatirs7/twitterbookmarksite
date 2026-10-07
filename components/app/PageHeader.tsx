/** Editorial page header: mono catalog marking, serif title, optional subtitle. */
export function PageHeader({
  index,
  label,
  title,
  subtitle,
  children,
}: {
  index: string;
  label: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rise flex flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-2">
        <span className="label-mono text-brand">{index}</span>
        <span className="h-px w-6 bg-hairline-strong" />
        <span className="label-mono">{label}</span>
      </div>
      <h1 className="font-serif text-5xl leading-[0.95] tracking-[-0.025em] sm:text-6xl">{title}</h1>
      {subtitle && <p className="max-w-md text-sm text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}
