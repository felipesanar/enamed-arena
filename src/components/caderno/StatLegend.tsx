import { cn } from '@/lib/utils';

export function StatLegend({
  label,
  value,
  dotClass,
  valueClass,
}: {
  label: string;
  value: number;
  dotClass: string;
  valueClass: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-white/65">
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
      <span className={cn('font-bold tabular-nums', valueClass)}>{value}</span>
      <span>{label}</span>
    </span>
  );
}
