# Provisional Patent Application — Version 1

## Dynamic Dual-Split and Multi-Destination Round-Up Microallocation System

---

## FIELD OF THE INVENTION

The present invention relates to computerized financial transaction processing systems and automated microallocation engines that proportionally distribute transaction round-up residual amounts across one or more financial or digital asset destinations using static, dynamic, or algorithmically recalculated proportional weighting.

---

## BACKGROUND

Existing financial round-up systems detect transactions, round to a defined increment, and allocate the residual amount to a single destination (e.g., savings). Such systems lack:

- Multi-destination proportional distribution
- Continuous percentage support (0%–100%)
- Integer and decimal proportional flexibility
- Dynamic rule-based allocation adjustment
- Algorithmic recalculation logic
- Simultaneous fiat and digital asset routing

---

## SUMMARY OF THE INVENTION

The invention provides a computerized allocation engine configured to:

1. Detect a financial transaction
2. Calculate a round-up residual
3. Determine proportional allocation weights
4. Distribute the residual across two or more destinations
5. Execute transfer instructions
6. Log allocation activity in a ledger system

---

## DETAILED DESCRIPTION

### 1. Transaction Detection

The system monitors transactions via financial institution API integration (Plaid API).

**Example:**
- Transaction: $4.37
- Rounded Amount: $5.00
- Residual (Round-Up): $0.63

The residual is passed to the allocation engine.

### 2. Allocation Proportionality

#### A. Integer Percentage Pairs (100/0 through 0/100)

The allocation engine may distribute the residual between two destinations using any whole-number percentage pair from 100%/0% through 0%/100%.

Complete list of supported integer pairs:

100%/0%, 99%/1%, 98%/2%, 97%/3%, 96%/4%, 95%/5%, 94%/6%, 93%/7%, 92%/8%, 91%/9%, 90%/10%, 89%/11%, 88%/12%, 87%/13%, 86%/14%, 85%/15%, 84%/16%, 83%/17%, 82%/18%, 81%/19%, 80%/20%, 79%/21%, 78%/22%, 77%/23%, 76%/24%, 75%/25%, 74%/26%, 73%/27%, 72%/28%, 71%/29%, 70%/30%, 69%/31%, 68%/32%, 67%/33%, 66%/34%, 65%/35%, 64%/36%, 63%/37%, 62%/38%, 61%/39%, 60%/40%, 59%/41%, 58%/42%, 57%/43%, 56%/44%, 55%/45%, 54%/46%, 53%/47%, 52%/48%, 51%/49%, 50%/50%, 49%/51%, 48%/52%, 47%/53%, 46%/54%, 45%/55%, 44%/56%, 43%/57%, 42%/58%, 41%/59%, 40%/60%, 39%/61%, 38%/62%, 37%/63%, 36%/64%, 35%/65%, 34%/66%, 33%/67%, 32%/68%, 31%/69%, 30%/70%, 29%/71%, 28%/72%, 27%/73%, 26%/74%, 25%/75%, 24%/76%, 23%/77%, 22%/78%, 21%/79%, 20%/80%, 19%/81%, 18%/82%, 17%/83%, 16%/84%, 15%/85%, 14%/86%, 13%/87%, 12%/88%, 11%/89%, 10%/90%, 9%/91%, 8%/92%, 7%/93%, 6%/94%, 5%/95%, 4%/96%, 3%/97%, 2%/98%, 1%/99%, 0%/100%

Each pairing represents a complete 100% distribution.

#### B. Fractional and Decimal Allocations

The allocation engine supports:
- Fractional percentages
- Decimal percentages
- Any real number between 0% and 100%

**Examples:**
- 33.33%/66.67%
- 12.5%/87.5%
- 0.01%/99.99%

The proportional range is continuous from 0% to 100%.

#### C. Dynamically Generated Percentages

Allocation weights may be generated or modified based on:
- Debt balance thresholds
- Savings goals
- Token purchase rules
- Time-based triggers
- Behavioral metrics
- Market conditions
- Risk parameters

The system may modify percentages automatically without manual adjustment per transaction.

#### D. Algorithmic Recalculation

The allocation engine may:
- Recalculate weights at each transaction
- Periodically rebalance proportions
- Apply rule-based logic
- Apply optimization models
- Apply predictive algorithms

All allocations must total 100% of the round-up residual.

#### E. Multi-Destination Support

The system may distribute residual amounts across more than two destinations, including:
- Debt accounts
- Savings accounts
- Investment accounts
- Cryptocurrency wallets
- Tokenized asset systems

Each destination may assume any proportional value between 0% and 100%, provided the total equals 100%.

---

## EXECUTION LAYER

The execution layer:
- Validates idempotency keys (24-hour TTL)
- Confirms transaction uniqueness
- Executes ACH transfers
- Executes digital asset purchases
- Logs confirmation data
- Records ledger entries

---

## LEDGER LOGGING

The ledger database stores:
- Original transaction amount
- Round-up residual
- Allocation percentages
- Destination identifiers
- Timestamps
- Execution confirmations

---

## SYSTEM ARCHITECTURE (FIG. 1)

- 100 — User Device (iOS/Android mobile application via Capacitor 7.4.x)
- 110 — Financial Institution API (Plaid API v37)
- 120 — Transaction Monitoring Module
- 130 — Round-Up Calculation Engine
- 140 — Allocation Engine (Dynamic Dual-Split)
- 150 — Execution Layer (Idempotency-Protected)
- 160 — Banking Network (Sila Money / Axos Bank)
- 170 — Digital Asset Exchange API (Coinbase API v2)
- 180 — Ledger Database (PostgreSQL with Drizzle ORM)

---

## FLOW LOGIC (FIG. 2)

- Step 200 — Detect Transaction
- Step 210 — Calculate Residual
- Step 220 — Retrieve Allocation Parameters
- Step 230 — Apply Integer/Fractional/Dynamic Weighting
- Step 240 — Validate Idempotency
- Step 250 — Execute Transfers
- Step 260 — Log Results

---

## CONCLUSION

The invention provides a dynamic, rule-responsive, algorithmically adjustable round-up allocation infrastructure capable of distributing residual transaction amounts across two or more destinations using integer, fractional, decimal, dynamic, and recalculated proportional distributions encompassing the full 0%–100% range.

---

## REDUCTION TO PRACTICE

This system has been implemented as a working mobile application:

- **App Name:** Dime Time
- **Bundle ID:** com.dimetime.mobile
- **TestFlight:** Build 92 uploaded and available
- **API Endpoints:** 41 functional endpoints
- **Database:** 27 tables in PostgreSQL
- **Financial Endpoints Protected:** 4 (with idempotency keys, 24-hour TTL)
- **Website:** dime-time.com
- **Target Launch:** February 2026
