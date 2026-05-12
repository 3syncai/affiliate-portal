// The "Order Layout" route was replaced with the Commission Ledger view so
// both /admin/order-layout (e.g. the "Total Orders" card on the dashboard)
// and /admin/ledger render the same screen. Existing links elsewhere in the
// app continue to work without any redirect.
export { default } from "@/app/admin/ledger/page";
