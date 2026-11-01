import { normalCommissionPool, type CommissionPercentage } from "@/lib/commission-pool";

export default function CommissionPoolSummary({ values }: { values: Record<string, CommissionPercentage> }) {
  const state = normalCommissionPool(values);
  return (
    <div role="status" aria-live="polite" className={`rounded-lg border p-4 ${state.valid ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
        <span>Normal commission pool</span>
        <span>{state.total.toFixed(2)}% / 100%</span>
      </div>
      <p className="mt-1 text-sm">{state.valid ? "All four normal shares total exactly 100%." : state.error}</p>
      <p className="mt-2 text-xs">Sales Executive + Area Sales Manager (/bm) + Branch Admin (/asm) + State Head. Additional commission and the legacy direct-referral setting are outside this total.</p>
    </div>
  );
}
