---
name: Radix Dialog vs Plaid Link focus trap
description: Why embedded Plaid Link (or any third-party overlay) must never stay behind an open Radix modal.
---

# Radix Dialog vs Plaid Link focus trap

Rule: while Plaid Link's iframe is on screen, any Radix Dialog that launched it must be FULLY closed (not just visually behind it). Render the Link launcher component outside the Dialog so it stays mounted while the dialog's `open` prop goes false.

**Why:** Radix modal dialogs trap focus and treat pointer events outside `DialogContent` as dismiss triggers. Plaid appends its iframe to `document.body` (outside the dialog), so: (a) the focus trap steals keyboard focus back — Plaid's phone-number input freezes and cannot be typed into; (b) clicks on Plaid's overlay count as outside-interactions that close the dialog and reset the flow. This broke the founder's first real production debt import (Chrome AND Safari, 2026-07-28) at the Plaid phone pane.

**How to apply:** any flow that opens a third-party full-screen overlay (Plaid, Stripe, OAuth popups rendered in-page) from inside a Radix Dialog/AlertDialog must hide the dialog while the overlay is active, then restore it on success/exit. Also guard react-plaid-link's `open()` with a ref — `open` is not referentially stable, and an unguarded `[ready, open]` effect can stack a duplicate Link iframe (second symptom seen in the same incident).
