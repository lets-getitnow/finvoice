# Match price and submit

Codex, 2026-10-28. User requests price for a matched address, an Enter button to submit, committed/pushed code and live deployment.

AC-01: A unique exact match supported by the actual entered/spoken address displays its source price immediately. Partial, phonetic, interpreted or ambiguous matches still require explicit confirmation; conflicting values stay clearly unresolved.
AC-02: Show a prominent price next to the matched address, clear it when the query changes, and add an accessible Enter submit button with the same behavior as keyboard Enter. Keep Speak and LiveKit tool calls.
AC-03: Preserve usable narrow-screen layout and server-only CSV, verify matching/confirmation/price and submission behavior, then commit, push GitHub and publish the existing public Site.

Supersedes 00010's requirement to confirm every exact tool-path match, only for unique exact matches independently validated against the actual reply. Also supersedes 00007's single-button restriction to add the requested Enter control. Other uncertainty/auth/privacy rules remain effective.

Checks: exact-match price reproduction; fuzzy/prefix and malicious-hint guard; explicit confirmation; conflicting/missing/zero values; price reset; form/button/keyboard submission and responsive CSS; active JS/Python checks; source synchronization, normal pushes and native publication.
