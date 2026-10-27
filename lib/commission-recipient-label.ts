/**
 * Business names deliberately differ from legacy database names.
 * /asm = Branch Admin; /bm = Area Sales Manager. Presentation only.
 */
export function commissionRecipientLabel(source: string): string {
  switch (source) {
    case "affiliate": return "Sales Executive";
    case "branch_admin": return "Area Sales Manager (/bm)";
    case "area_manager": return "Branch Admin (/asm)";
    case "asm_direct": return "Branch Admin (/asm) — direct sale";
    case "state_admin":
    case "state_admin_direct": return "State Head";
    default: return "Commission recipient";
  }
}
