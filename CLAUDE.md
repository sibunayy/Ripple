# RippleFlow: instructions for Claude Code

Read `HANDOFF.md` first. It is the full brief.

## Rules
- The job is a port from one HTML file to a Vite + TypeScript multi-file app. Do not redesign anything.
- The reference is `source/ripple-flow-console.html`. Keep a copy in `legacy/` and do not edit that copy.
- Keep all behaviour, `data-act` names, `aria-*` attributes, CSS token names and `localStorage` keys (`rfp-*`).
- Keep the CSS cascade order from the source. The v8 inspector block must load last.
- Do not add runtime dependencies without approval.
- Run the parity checklist (HANDOFF.md section 10) after each phase. Commit after each phase.
- Nathan does not write code. Explain each decision in plain language. Ask him only the open decisions in HANDOFF.md section 13.
- Target Safari on iPadOS 16.4+ with touch and Apple Pencil. Test with Playwright WebKit at 1180×820 and 820×1180.
