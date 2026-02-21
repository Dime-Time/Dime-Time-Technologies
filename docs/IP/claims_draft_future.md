# Future Patent Claims — Draft for Attorney Review

## IMPORTANT: These are draft claims for discussion with a patent attorney. They are NOT finalized legal claims and should be professionally reviewed and formatted before any USPTO filing.

---

## Independent Claims

### Claim 1 — System Claim

A computerized financial microallocation system comprising:

a) a transaction monitoring module configured to detect financial transactions from a user's linked bank account via a financial institution application programming interface;

b) a round-up calculation engine configured to compute a residual amount by rounding each detected transaction amount to a next highest predetermined increment;

c) an allocation engine configured to determine proportional distribution weights for the computed residual amount across two or more destination accounts, wherein the proportional distribution weights comprise any value within a continuous range from 0% to 100%, and wherein the sum of all proportional distribution weights equals 100%;

d) an execution layer configured to route portions of the residual amount to each of the two or more destination accounts according to the determined proportional distribution weights, wherein the destination accounts include at least one of: a debt payment account, a savings account, a cryptocurrency wallet, or a tokenized digital asset account;

e) an idempotency validation module configured to prevent duplicate execution of transfer instructions by validating unique transaction keys; and

f) a ledger database configured to record the original transaction amount, the residual amount, the proportional distribution weights, destination identifiers, timestamps, and execution confirmations.

### Claim 2 — Method Claim

A computer-implemented method for proportionally distributing financial transaction round-up residuals, the method comprising:

a) monitoring, by a processor, financial transactions from a user's bank account through a financial institution API;

b) calculating, for each detected transaction, a round-up residual amount representing the difference between the transaction amount and the next highest predetermined increment;

c) retrieving allocation parameters specifying proportional distribution weights for two or more destination accounts;

d) applying the proportional distribution weights to the residual amount to determine individual transfer amounts for each destination account;

e) validating an idempotency key to confirm transaction uniqueness;

f) executing transfer instructions to route the individual transfer amounts to each destination account; and

g) recording the transaction, residual, allocation weights, and execution confirmation in a ledger database.

### Claim 3 — Dynamic Allocation Claim

The system of Claim 1, wherein the allocation engine is further configured to dynamically adjust the proportional distribution weights based on one or more of:

a) current debt balance thresholds;
b) user-defined savings goals;
c) digital asset purchase rules;
d) time-based triggers;
e) behavioral metrics derived from user transaction patterns;
f) market conditions for digital assets; and
g) risk parameters.

---

## Dependent Claims

### Claim 4

The system of Claim 1, wherein the proportional distribution weights support integer percentage values, fractional percentage values, and decimal percentage values within the continuous range from 0% to 100%.

### Claim 5

The system of Claim 1, wherein the allocation engine is configured to recalculate the proportional distribution weights at each transaction event using rule-based logic, optimization models, or predictive algorithms.

### Claim 6

The system of Claim 1, wherein the execution layer is configured to simultaneously route portions of the residual amount to both fiat currency destinations via ACH transfer and digital asset destinations via cryptocurrency exchange API.

### Claim 7

The method of Claim 2, wherein the two or more destination accounts comprise at least one debt payment account and at least one cryptocurrency wallet, enabling simultaneous debt reduction and digital asset acquisition from a single round-up residual.

### Claim 8

The system of Claim 1, wherein the allocation engine supports distribution across three or more destination accounts, each assuming any proportional value between 0% and 100%, provided the total of all proportional values equals 100%.

### Claim 9

The system of Claim 1, wherein the idempotency validation module assigns a time-to-live expiration to each idempotency key, preventing reprocessing of duplicate transfer instructions within a defined time window.

### Claim 10

The method of Claim 2, further comprising:

a) detecting that the user's debt balance has crossed a predefined threshold; and
b) automatically adjusting the proportional distribution weights to increase the allocation percentage directed toward debt payment.

### Claim 11

The system of Claim 1, wherein the tokenized digital asset account represents a proprietary utility token within the system, and the allocation engine is configured to route a portion of the round-up residual toward acquisition of said utility token.

### Claim 12

The system of Claim 1, further comprising a user interface module configured to display:

a) current allocation percentages for each destination account;
b) cumulative round-up amounts collected over a defined period;
c) projected debt-free dates based on current round-up allocation rates; and
d) real-time digital asset portfolio values.

---

## Future Claims to Consider (Post-v1)

### Biometric Authentication
- Claim covering biometric verification (Face ID / Touch ID) prior to modifying allocation percentages or executing transfers above a threshold amount

### Machine Learning Optimization
- Claim covering ML-based allocation optimization that learns from user spending patterns and debt reduction velocity to suggest optimal distribution weights

### Multi-User Household Allocation
- Claim covering a shared household allocation engine where multiple users' round-ups are pooled and distributed according to household-level financial goals

### Recurring Scheduled Rebalancing
- Claim covering automatic periodic rebalancing of allocation weights (weekly, monthly) based on changing financial conditions without user intervention

### Cross-Platform Synchronization
- Claim covering real-time synchronization of allocation settings and ledger data across multiple user devices and platforms

---

## Notes for Patent Attorney

1. **Prior Art:** Acorns, Qapital, and Chime offer single-destination round-up savings. None support multi-destination proportional distribution with simultaneous fiat and crypto routing.

2. **Reduction to Practice:** The Dime Time app (com.dimetime.mobile, TestFlight Build 92) implements all claims described above as a working system.

3. **Figures Needed:** FIG. 1 (System Architecture) and FIG. 2 (Flow Logic) referenced in the provisional application need formal patent drawings.

4. **Filing Strategy:** Consider filing a provisional application first to establish priority date, followed by a non-provisional within 12 months.

5. **International:** Consider PCT filing if international protection is desired.
