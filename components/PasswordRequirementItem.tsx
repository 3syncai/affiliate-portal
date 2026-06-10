import { Check, X } from "lucide-react"

export default function PasswordRequirementItem({
  met,
  label,
  showValidation,
}: {
  met: boolean
  label: string
  showValidation: boolean
}) {
  const status = !showValidation ? "neutral" : met ? "valid" : "invalid"

  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
          status === "valid"
            ? "bg-emerald-100"
            : status === "invalid"
              ? "bg-red-100"
              : "bg-slate-200"
        }`}
        aria-hidden="true"
      >
        {status === "valid" && (
          <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
        )}
        {status === "invalid" && (
          <X className="h-3 w-3 text-red-600" strokeWidth={3} />
        )}
        {status === "neutral" && (
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        )}
      </span>
      <span
        className={`text-sm transition-colors ${
          status === "valid"
            ? "text-emerald-700 font-medium"
            : status === "invalid"
              ? "text-red-600"
              : "text-slate-600"
        }`}
      >
        {label}
      </span>
    </li>
  )
}
