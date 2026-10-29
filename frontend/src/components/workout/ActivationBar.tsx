import type { SecondaryActivation } from "@/lib/types";
import { MUSCLE_TR_SOFT } from "@/lib/tr";

/** "Kas Aktivasyonu" — how strongly a movement targets the primary muscle versus the
 *  supporting muscles. An estimate from the exercise database, labelled as such. */
export default function ActivationBar({
  muscle,
  activation,
  secondary,
}: {
  muscle: string;
  activation: number;
  secondary: SecondaryActivation[];
}) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#141416] p-4" data-testid="activation-panel">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold tracking-wide text-zinc-400">Kas Aktivasyonu</p>
        <p className="font-heading text-sm font-bold text-zinc-500">tahmini değer</p>
      </div>

      <div className="mt-3 space-y-2.5">
        <Row
          label={MUSCLE_TR_SOFT[muscle] ?? muscle}
          pct={activation}
          primary
          testid="activation-primary"
        />
        {secondary.map((s) => (
          <Row
            key={s.muscle}
            label={MUSCLE_TR_SOFT[s.muscle] ?? s.muscle}
            pct={s.pct}
            testid={`activation-secondary-${s.muscle}`}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  pct,
  primary = false,
  testid,
}: {
  label: string;
  pct: number;
  primary?: boolean;
  testid: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className={primary ? "font-bold text-white" : "font-medium text-zinc-400"}>
          {label}
          {primary && <span className="ml-2 text-[10px] font-semibold text-zinc-500">BİRİNCİL</span>}
        </span>
        <span
          className={primary ? "font-heading font-extrabold text-[#84CC16]" : "font-heading font-bold text-zinc-400"}
          data-testid={testid}
        >
          %{pct}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#27272A]">
        <div
          className={primary ? "h-full rounded-full bg-[#84CC16]" : "h-full rounded-full bg-zinc-600"}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
