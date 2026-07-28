---
name: Plaid Link inside Radix/shadcn Dialogs
description: Opening Plaid Link while a Radix Dialog is open breaks typing and closes Link on click — how to embed it safely
---

# Plaid Link inside Radix/shadcn Dialogs

Never open Plaid Link (react-plaid-link) while a Radix/shadcn `Dialog` is open in its default modal mode. Plaid appends its iframe to `document.body`, OUTSIDE the dialog, so:
- the dialog's focus trap steals every keystroke → user cannot type in Plaid's inputs (phone number field appears frozen);
- any click inside Plaid's iframe counts as "interact outside" → Radix closes the dialog, unmounting the Link launcher and killing the flow mid-link.

**Why:** exactly this broke the founder's first real debt import on web (2026-07-28): couldn't type a phone number, and "Continue without phone number" dumped him back to the Debts page. The Banking-page link flow never hit it because it runs in a plain page/Card, not a Dialog.

**How to apply:** while Link is active, set `modal={false}` on the Dialog AND `e.preventDefault()` in `onInteractOutside`/`onEscapeKeyDown` on DialogContent (see ImportDebtsModal's `plaidActive` pattern). Any future surface that launches Link from a modal needs the same treatment — or launch Link from a non-modal surface.
