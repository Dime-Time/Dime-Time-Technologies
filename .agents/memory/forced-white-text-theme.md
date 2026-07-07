---
name: Forced white-text lavender theme (index.css)
description: Why input text / custom colors look wrong on in-app screens and how to opt out
---

# Global forced-theme rules in `client/src/index.css`

The in-app lavender theme applies **very aggressive global rules** (inside `@layer base`) that override normal Tailwind utilities:

- `* { color: white !important; text-shadow: <dark #5a56a8 outline>; }` — forces ALL text white with a neon outline, **including characters typed into inputs** (this is why input text reads as muddy / "hard to read").
- `.text-white`, `h1..h6`, `button`, `nav` each get the same `text-shadow` outline with `!important`.
- `svg`, `img:not(.logo-image-clean)` get a `drop-shadow` outline `!important`.
- `.bg-white`, `.bg-slate-*`, `.bg-gray-*` are all remapped to `var(--dime-background)` (lavender) `!important`, so a `bg-white` class does **not** give you a white surface.

**Why:** it's an intentional branded look for the authenticated app, but it fights any screen that needs real text colors or a genuine white surface.

**How to apply:** to make a screen render with normal colors, wrap it in a scoped opt-out class and add scoped `!important` overrides at the END of `@layer base` (later source order wins ties):
- `.dt-marketing` — full opt-out (white page bg, real text colors). Used by landing/privacy/terms.
- `.dt-auth` — keeps the purple brand bg + white headings but makes inputs dark-on-white and drops the neon outline. Used by all auth pages (Login, signup, ForgotPassword, ResetPassword, VerifyEmail).

For readable inputs: don't rely on a `bg-white` class (it gets remapped) or a `text-...` utility (loses to `* !important`). Force it via a scoped selector like `.dt-auth input { background:#fff !important; color:#0f172a !important; text-shadow:none !important }`, and add a `-webkit-autofill` box-shadow-inset override so autofilled values stay dark-on-white.
