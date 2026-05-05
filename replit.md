# Dime Time - Fintech Debt Reduction App

## Overview
Dime Time is an innovative fintech mobile application designed to make debt reduction engaging and user-friendly. It features real user authentication, bank account integration via Plaid, cryptocurrency functionalities, and automated round-up debt payment technology. The app aims to help users systematically reduce debt through automated financial tracking, micro-investment strategies, and consistent micro-payments. The project's ambition is to provide a fully functional, secure, and intuitive platform for financial well-being.

## User Preferences
- Focus on mobile-first experience
- Clean, intuitive UI with purple branding
- Real functioning app, not demo/website
- Proper user authentication and data separation
- Full fintech feature set accessible to users

## System Architecture

### UI/UX Decisions
- **Styling**: Tailwind CSS with a custom Dime Time purple (#918EF4)
- **UI Components**: shadcn/ui for professional design
- **Branding**: Clean, intuitive UI with purple branding

### Technical Implementations
- **Platform**: Capacitor Hybrid App (iOS/Android)
  - **Web Framework**: React.js with TypeScript (runs in native WebView)
  - **Native Layer**: Capacitor 7.4.x (wraps web app for iOS/Android)
  - **Routing**: Wouter for SPA navigation
- **Frontend State Management**: TanStack Query (React Query) for API calls
- **Backend**: Express.js with Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Email/password with SHA256 hashing; PostgreSQL session store
- **API**: RESTful endpoints for all fintech features

### Feature Specifications
- **User Authentication**: Email/password signup, secure login with session management, real user accounts.
- **Debt Management**: View and track personal debts, interest rates, minimum payments, and accelerated payment options.
- **Roundup Technology**: Collect spare change from purchases, direct roundups to debt payments, customizable multiplier settings.
- **Banking Integration**: Connect real bank accounts, view actual transactions.
- **Crypto Features**: Coinbase integration, Bitcoin purchases via roundups, portfolio tracking.
- **Analytics & Insights**: Debt-free projections, payment tracking, financial progress visualization.

### System Design Choices
- **Security**: Auth tokens encrypted at rest using AES-GCM (WebCrypto API) and stored in localStorage. PIN lock with SHA-256 hash, auto-lock on background.
- **ACH Production Hardening**:
    - **Transfer Ledger**: `transfers` table tracks money movements with full lifecycle status.
    - **Idempotency**: `Idempotency-Key` header support for `collect-roundup` and `pay-debt` routes.
    - **Plaid Access Token Encryption**: Tokens stored AES-256-GCM encrypted at rest.
    - **Plaid Webhook Endpoint**: `POST /webhooks/plaid` for status updates, signature-verified and idempotent.
    - **Structured Reconciliation Logging**: JSON logs with `correlationId` for all transfer operations.
    - **Funding Account Validation**: Explicit failure if `MERCURY_PLAID_FUNDING_ID` is not set in production.
- **Mobile Deployment**: CodeMagic CI/CD on Mac mini M2, distribution via App Store Connect (TestFlight → App Store) with Apple Developer Account certificates.

## Investor / Patent Materials
- `attached_assets/patent-application/` — USPTO provisional draft (.pdf + .docx) and 7 black-and-white figures
- `attached_assets/patent-deck-slides/dime-time-patent-deck.pptx` — 12-slide investor patent overview deck (Google Slides-uploadable). PDF and per-slide PNG previews in same folder.
- `attached_assets/pitch-deck-slides/` — 13-slide pitch deck (.pptx + .pdf)
- `attached_assets/business-plan-slides/` — 14-slide business plan (.pptx + .pdf)

## External Dependencies
- **Plaid**: For banking integration and linking user bank accounts.
- **Coinbase**: For cryptocurrency features and Bitcoin purchases.
- **CodeMagic**: CI/CD for building and deploying iOS and Android applications.
- **PostgreSQL**: Primary database for application data.
- **Express.js**: Backend framework.
- **Node.js**: Backend runtime environment.
- **React.js**: Frontend framework.
- **TypeScript**: For type-safe development.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **shadcn/ui**: For UI components.
- **TanStack Query (React Query)**: For API data fetching and state management.
- **Drizzle ORM**: Object-Relational Mapper for PostgreSQL.