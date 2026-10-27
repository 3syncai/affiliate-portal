"use client";
import { useState } from "react";
import { commissionRecipientLabel } from "@/lib/commission-recipient-label";
type Preview = { catalog_product_id: string; fingerprint: string; items: { id: string; order_id: string; commission_source: string; affiliate_code: string; rate: number; base: number; share: number; order_amount: number; earned: number }[] };
export default function CommissionRepair({ productId }: { productId: string }) {
  const [preview,setPreview] = useState<Preview | null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  async function request(apply: boolean) {
    setBusy(true); setMessage("");
    try {
      const headers = { Authorization: "Bearer " + localStorage.getItem("affiliate_token"), "Content-Type": "application/json" };
      const response = await fetch("/api/affiliate/admin/commission-repair" + (apply ? "" : "?product_id=" + encodeURIComponent(productId)), {
        method: apply ? "POST" : "GET", headers,
        ...(apply ? { body: JSON.stringify({ product_id: productId, fingerprint: preview?.fingerprint }) } : {})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      if (apply) { setPreview(null); setMessage(data.message); } else setPreview(data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); if (apply) setPreview(null); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 text-sm">
    <button disabled={busy} onClick={() => request(false)} className="text-indigo-700 underline disabled:opacity-50">Review old ₹0 entries</button>
    {message && <p role="status" className="mt-2 text-slate-700">{message}</p>}
    {preview && <div className="fixed inset-0 z-[70] bg-black/40 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Review commission correction">
      <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[85dvh] overflow-auto">
        <h2 className="font-bold text-lg">Review ₹0 commission corrections</h2>
        <p className="my-2 text-slate-600">Uses the product commission pool and each recipient’s recorded share. /bm is Area Sales Manager; /asm is Branch Admin. Corrections return to pending delivery/return checks. Wallets are not credited here.</p>
        <ul className="divide-y">{preview.items.map(item => <li key={item.id} className="py-2 break-words">
          <p className="font-semibold">{commissionRecipientLabel(item.commission_source)} · {item.share}% share</p>
          <p className="text-xs text-slate-500">{item.order_id}{!["BRANCH", "AREA", "STATE"].includes(item.affiliate_code) && ` · ${item.affiliate_code}`}</p>
          <p>₹{item.order_amount.toFixed(2)} × {item.rate}% product rate = ₹{item.base.toFixed(2)} commission pool</p>
          <p>{item.share}% of ₹{item.base.toFixed(2)} · ₹0 → <strong>₹{item.earned.toFixed(2)}</strong></p>
        </li>)}</ul>
        {!preview.items.length && <p className="py-4">No eligible entries. Cancelled, returned, already corrected and non-zero entries are excluded.</p>}
        <div className="flex flex-wrap gap-3 mt-4">
          <button disabled={busy || !preview.items.length} onClick={() => request(true)} className="rounded-lg px-4 py-2 bg-indigo-600 text-white disabled:opacity-50">Confirm {preview.items.length} corrections</button>
          <button disabled={busy} onClick={() => setPreview(null)} className="border rounded-lg px-4 py-2">Close</button>
        </div>
      </div>
    </div>}
  </div>;
}
