# Dime Time — Patent & Technology Summary

## Patent Application

**Title:** Dynamic Dual-Split and Multi-Destination Round-Up Microallocation System

**Applicant:** Dime Time

**Status:** Preparing for USPTO filing

**App:** Dime Time (com.dimetime.mobile)

**Website:** dime-time.com

---

## What the Patent Covers

A computerized allocation engine that:

1. Detects a financial transaction via bank API integration
2. Calculates the round-up residual (e.g., $4.37 purchase → $0.63 residual)
3. Determines proportional allocation weights (user-configured or algorithmic)
4. Distributes the residual across two or more destinations (debt, crypto, savings, tokens)
5. Executes transfer instructions with idempotency protection
6. Logs all allocation activity in a ledger database

---

## Key Differentiators from Existing Round-Up Systems

| Feature | Existing Systems | Dime Time |
|---|---|---|
| Destinations | Single (savings only) | Multi-destination (debt, crypto, savings, tokens) |
| Percentage Range | Fixed presets | Continuous 0%–100% (integer + decimal) |
| Allocation Logic | Static | Dynamic, rule-based, algorithmic |
| Digital Assets | Not supported | Cryptocurrency + tokenized assets |
| Recalculation | Manual only | Automatic per-transaction or periodic |
| Fiat + Crypto | Fiat only | Simultaneous fiat and digital asset routing |

---

## Working Implementation (Reduction to Practice)

- **TestFlight Build 92** — Live and available for testing
- **41 API endpoints** built and functional
- **27 database tables** storing all transaction, allocation, and ledger data
- **4 idempotency-protected financial endpoints** (transactions, payments, accelerated payments, crypto purchases)
- **Round-up split engine** — Fully operational with configurable debt/crypto percentages

---

## Technology Stack

- **Frontend:** React.js, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Mobile:** Capacitor 7.4.x (iOS + Android)
- **Banking:** Plaid API v37
- **Crypto:** Coinbase API v2
- **Cloud:** AWS S3, DynamoDB, RDS
- **Security:** Bcrypt (cost 12), rate limiting, AES-GCM encryption, PIN lock
- **CI/CD:** CodeMagic (Mac mini M2) → App Store Connect / TestFlight

---

## Third-Party Integrations

| Integration | Purpose | Status |
|---|---|---|
| Plaid | Bank account linking, transactions, balances | Sandbox active, production pending |
| Coinbase | Crypto purchases, portfolio tracking | Demo mode, production pending |
| Sila Money | ACH transfers | Routes scaffolded |
| Axos Bank | Business banking | Pending setup |
| AWS | Cloud storage, backup, sync | SDK integrated |

---

## Target Launch: February 2026
