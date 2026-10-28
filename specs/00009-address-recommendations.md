# Partial address recommendations and clarification

User reports Mint 32 should show recommendations and asks about previously designed LiveKit disambiguation tools. Restore recommendations while retaining the minimal interface, source CSV and LiveKit text events. The recovered voice worker contains speech control RPC only; no historical function-tool definitions are available in this checkout. Do not claim those tools were preserved or invent their contract.

AC-01: Recognize street-before-number input. Offer partial-number candidates only as unconfirmed recommendations; never silently substitute a valuation.
AC-02: Recommend addresses for street-only and ambiguous input, bounded to three visible choices, retaining confirmation/ordinal/ZIP correction context.
AC-03: Show debounced recommendations while typing without speaking every keystroke. Preserve LiveKit transcript-to-lookup and spoken clarification.
AC-04: Maintain server-only source data, bounded runtime loading and strict default resolver behavior for callers not opting into prefix recommendations. Verify the actual Mint 32 source case and publish.

Checks: strict/suggestion resolver fixtures; confirmation/ZIP/ordinal flow; actual source recommendation/confirmation; preview does not reveal valuation or invoke speech; startup and API privacy regressions. Earlier named tool designs remain an explicit missing input; user asked asynchronously for their names/roles.
