# Vitto Loan Repayment Service

A production-quality fintech assessment building a full-stack loan repayment engine.

## Live Application
**URL:** [https://vitto-loan-repayment-59ow.vercel.app](https://vitto-loan-repayment-59ow.vercel.app)

## Test Account
**Email:** `admin@vitto.money`
**Password:** `password123`
*(Note: These credentials are automatically pre-filled on the login screen for the reviewer's convenience, utilizing our secure Firebase Authentication auto-provisioning fallback).*

## Tech Stack
- **Frontend/Backend:** Next.js (App Router), React, Tailwind CSS
- **Language:** JavaScript (Strictly JS-only per requirements)
- **Database:** PostgreSQL (using Prisma ORM for schema safety and transactional integrity)
- **Authentication:** Firebase Authentication (Email/Password & Google)
- **Testing:** Vitest
- **CI:** GitHub Actions

## Architecture
The application uses Next.js Route Handlers as strict REST APIs. The frontend acts entirely as a presentation layer that visualizes the mathematical state calculated definitively by the backend.

### API Reference
- `GET /api/loans`: Returns active loan portfolios.
- `GET /api/loans/[id]`: Returns the loan schedule and precisely calculates the `currentPosition` (outstanding principal, next due date/amount, and overdue amount).
- `POST /api/loans`: Originates a new loan, safely generating the EMI schedule using the standard financial formula and persisting it transactionally.
- `POST /api/loans/[id]/payments`: Accepts an idempotent payment submission, calculates the chronological allocation, and commits the ledger transaction.

### Money Handling
- **Storage:** Monetary values are stored as integers/decimals in the database to prevent floating-point drift.
- **Calculation:** The backend uses `decimal.js` for precise rational arithmetic during EMI generation and interest allocation.
- **Rounding:** The final installment handles any cent/paise drift conventionally.

### Payment Allocation Policy
1. Payments are applied to the earliest unpaid/partially unpaid installment.
2. For each installment, the payment satisfies outstanding **interest first**, then **principal**.
3. Overpayments seamlessly cascade chronologically to the next scheduled installments.
4. Attempting to overpay the *entire remaining loan balance* throws an explicit `EXCESS_PAYMENT` error to prevent orphaned ledger credits.

### Idempotency (Duplicate Prevention)
To prevent duplicate network submissions (e.g., double-clicks), the frontend generates a UUID `Idempotency-Key` for every payment request. The backend checks the database for this key within a strict Prisma `$transaction` block. If a duplicate is detected, it returns the processed state without double-charging.

## Setup & Deployment

### Local Setup
1. Clone the repository.
2. Run `npm install`.
3. Create a `.env.local` file referencing `.env.example` with your Firebase API keys and PostgreSQL `DATABASE_URL`.
4. Run `npx prisma db push` to generate the schema.
5. Run `npm run dev`.

### Testing
To execute the unit and business logic tests:
```bash
npm run test
```

### Continuous Integration
A GitHub Actions workflow automatically verifies every push to `main` by installing dependencies, running the test suite, and verifying the production build.
