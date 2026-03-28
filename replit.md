# Dime Time - Fintech Debt Reduction App

## Project Overview
Dime Time is an innovative fintech application that transforms debt reduction into an engaging, user-friendly experience. The iOS mobile app features real user authentication, bank account integration with Plaid, cryptocurrency features, and automated round-up debt payment technology.

The application leverages automated financial tracking, micro-investment strategies, and round-up collection mechanisms to help users systematically reduce debt through small, consistent actions and intelligent fund management.

## Recent Changes (January 2026) - CodeMagic iOS Build Pipeline COMPLETE ✅

### BUILD 63: Control Build (No Changes) ✅
- **Status**: No-change validation build for TestFlight baseline testing
- **Changes Implemented**: None
- **Purpose**: Stability and behavior validation against existing baseline
- **Note**: Any previously requested changes remain unimplemented for post-launch evaluation

### BUILD 92: SUCCESSFUL iOS TestFlight Upload via Apple ID ✅✅✅
- **Status**: BUILD SUCCESSFUL - App built and uploaded to TestFlight with Apple ID authentication!
- **Build Tool**: xcode-project build-ipa (CodeMagic's official iOS command)
- **Code Signing**: CodeMagic iOS signing integration with automatic provisioning profile management
- **TestFlight Upload**: xcrun altool with Apple ID credentials (APPLE_ID + APP_SPECIFIC_PASSWORD)
- **Build Number**: CFBundleVersion 45
- **App Status**: Ready for TestFlight beta testing and review
- **Next Step**: Apple reviews the app before it becomes available to testers

### Build Timeline (Exit Code 65 → Build 92 Success):
- **Builds 71-91**: Manual code signing attempts, API key configuration, environment variable fixes
- **Build 89**: First successful IPA build with simplified signing approach
- **Build 90**: IPA built but publishing failed (environment variable naming issue)
- **Build 91**: Added fetch-signing-files step from ChatGPT suggestion
- **Build 92**: SUCCESS using CodeMagic's ios_signing integration + xcrun altool upload

### Build Timeline (Exit Code 65 → Success):
- **Build 44-55**: Initial signing setup, certificate/profile issues
- **Build 56-58**: Xcode project configuration, development team setup
- **Build 59-60**: App Store Connect credential configuration
- **Build 61**: SUCCESS with `-allowProvisioningUpdates` + explicit Automatic code signing

### NEXT STEPS FOR APP STORE LAUNCH:
1. **TestFlight Beta Testing** (now live)
   - Invite internal testers via App Store Connect
   - Test all features: signup, banking, crypto, round-ups
   - Fix any bugs found during testing

2. **Prepare App Store Submission**
   - Write app description
   - Add screenshots (5-6 for each device type)
   - Set pricing tier ($0 free or $2.99 paid)
   - Add keywords for search

3. **Submit to App Store Review**
   - Go to App Store Connect
   - Click "Submit for Review"
   - Apple reviews in 24-72 hours
   - App goes live when approved

### BUILD 41: Full Authentication Fix (LIVE on TestFlight) ✅✅✅
- **CRITICAL FIX**: AccountCreationFlow now calls real `/api/signup` endpoint (was faking signup locally)
- **Signup Flow**: Email/password → Real backend API call → Session saved → Auth cache refreshed → Dashboard loads
- **Dashboard Visible**: After signup, users immediately see personalized dashboard with their debts, banks, crypto
- **Backend Integration**: Frontend now properly authenticates with backend instead of simulating signup
- **Session Persistence**: User sessions properly persist across app restarts
- **Real User Isolation**: Each user sees only their own data, no data leakage
- **Cache Invalidation**: Auth cache properly refreshes after signup so dashboard data loads immediately
- **CodeMagic Build 41**: Successfully uploaded to App Store Connect/TestFlight - WORKING ✅

### Build Progression to Working App
- **Build 41**: ✅✅✅ FULL WORKING APP - Real signup API + auth cache refresh
- **Build 40**: Session save fix in backend but frontend still faking signup
- **Build 39**: Had session save bug, users saw landing page
- **Builds 35-38**: Landing page routing loop issue
- **Build 34**: Initial authentication implementation

### iOS App Store Launch Status - READY FOR TESTING ✅
- ✅ **Build 41 on TestFlight**: Fully functional fintech app with working authentication
- ✅ **Bundle ID**: com.dimetime.mobile
- ✅ **Version**: 1.0.1 (Build 41)
- ✅ **App Icon**: Official Dime Time logo
- ✅ **Code Signing**: Properly configured with Apple Developer account
- ✅ **Encryption Compliance**: ITSAppUsesNonExemptEncryption = false
- ✅ **All Features Tested and Working**: Banking, Crypto, Round-ups, Analytics, Debts
- 🎯 **READY FOR 2-MONTH LAUNCH TIMELINE**: Next steps are TestFlight testing → Bug fixes → App Store submission

### Current App Features (All Functional)
1. **User Authentication**
   - Email/password signup
   - Secure login with session management
   - Real user accounts (not demo auto-login)

2. **Debt Management**
   - View personal debts with current balances
   - Track interest rates and minimum payments
   - Accelerated payment options

3. **Roundup Technology**
   - Collect spare change from purchases
   - Direct roundups to debt payments
   - Customizable multiplier settings

4. **Banking Integration**
   - Plaid sandbox integration
   - Connect real bank accounts
   - View actual transactions

5. **Crypto Features**
   - Coinbase integration
   - Bitcoin purchases via roundups
   - Portfolio tracking

6. **Analytics & Insights**
   - Debt-free projections
   - Payment tracking
   - Financial progress visualization

## ACH Production Hardening (March 2026)

### New Infrastructure
- **Transfer Ledger**: `transfers` table tracks every money movement (roundup_collection, debt_payment) with full lifecycle status (created → authorized → pending → posted → settled → failed → returned → cancelled)
- **Idempotency on Mercury routes**: Both `POST /api/mercury/collect-roundup` and `POST /api/mercury/pay-debt` accept `Idempotency-Key` header; duplicate requests return cached response without re-executing
- **Plaid Access Token Encryption**: Tokens stored AES-256-GCM encrypted at rest using `PLAID_TOKEN_ENCRYPTION_KEY`. Legacy plain-text tokens handled transparently. `getPlaidAccessToken(bankAccountId)` is the only way to retrieve a live decrypted token
- **Plaid Webhook Endpoint**: `POST /webhooks/plaid` — signature-verified, idempotent, updates transfer ledger on status events
- **Structured Reconciliation Logging**: All transfer operations emit JSON log lines with `correlationId`, masked sensitive fields; correlated end-to-end across Plaid + Mercury
- **Funding Account Validation**: `MERCURY_PLAID_FUNDING_ID` fails explicitly in production if not set

### New Env Vars Required
- `PLAID_TOKEN_ENCRYPTION_KEY` — 32-byte base64 key for AES-256-GCM (auto-generated and set)
- `PLAID_WEBHOOK_SECRET` — From Plaid Dashboard → Webhooks → Signing Secret (set when webhook URL is configured)
- `MERCURY_PLAID_FUNDING_ID` — Mercury's Plaid funding account ID (required before Plaid Transfer goes live)

### Transfer State Flow
```
Request received
  → Idempotency check (return cached if duplicate key)
  → Transfer ledger record created (status: created)
  → Plaid transferAuthorizationCreate (logged) → status: authorized
  → Plaid transferCreate (logged) → status: pending
  → Plaid webhook arrives → /webhooks/plaid → status: posted/settled/failed/returned
```

## Technical Architecture

### Platform: Capacitor Hybrid App (NOT React Native/Expo)
This is a **Capacitor-based hybrid application**, not React Native or Expo:
- **Web Framework**: React.js + TypeScript (runs in native WebView)
- **Native Layer**: Capacitor 7.4.x (wraps web app for iOS/Android)
- **Native Plugins**: @capacitor/core, @capacitor/ios, @capacitor/android, @capacitor/app, etc.
- **Build Pipeline**: CodeMagic compiles the native iOS/Android projects

**Why Capacitor?** Single React codebase runs in native WebView with access to device APIs via Capacitor plugins.

### Frontend
- **Framework**: React.js with TypeScript
- **Styling**: Tailwind CSS with custom Dime Time purple (#918EF4)
- **Routing**: Wouter for SPA navigation
- **Mobile**: Capacitor for iOS/Android native build
- **UI Components**: shadcn/ui for professional design
- **State Management**: TanStack Query (React Query) for API calls

### Security
- **Auth Tokens**: Encrypted at rest using AES-GCM (WebCrypto API)
- **Token Storage**: Encrypted tokens in localStorage (sandboxed per app in Capacitor WebView)
  - Note: Encryption key is stored in localStorage. For true secure storage (Keychain/Keystore), upgrade to Capacitor 8+ and use @capacitor/preferences or secure storage plugins.
- **PIN Lock**: 4-digit PIN with SHA-256 hash, auto-lock on background
- **Face ID/Touch ID**: Not yet implemented (requires Capacitor 8+ for native biometric plugins)

### Security Upgrade Path (Capacitor 8)
When upgrading to Capacitor 8, implement:
1. Move encryption key to native Keychain/Keystore using @capacitor/preferences or secure storage plugin
2. Add native biometric authentication for Face ID/Touch ID
3. This requires testing all existing Capacitor plugins for v8 compatibility

### Backend
- **Framework**: Express.js with Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Email/password with SHA256 hashing
- **Sessions**: PostgreSQL session store
- **API**: RESTful endpoints for all fintech features

### Mobile Deployment
- **Build Tool**: CodeMagic CI/CD
- **Instance**: Mac mini M2
- **Distribution**: App Store Connect → TestFlight → App Store
- **Signing**: Apple Developer Account certificates

## Database Schema

### Users Table
- `id`: UUID primary key
- `email`: Unique email for login
- `password`: SHA256 hashed password
- `firstName`: User's first name
- `lastName`: User's last name
- `profileImageUrl`: Optional profile picture
- `createdAt`: Account creation timestamp
- `updatedAt`: Last profile update timestamp

### Related Tables
- **Debts**: Track credit cards, loans, other debts
- **Transactions**: Purchase history from connected bank accounts
- **Payments**: Debt payment records
- **RoundUpSettings**: User preferences for roundup behavior
- **CryptoPurchases**: Bitcoin and crypto transaction history
- **BankAccounts**: Connected Plaid bank accounts

## API Endpoints (Build 34)

### Authentication
- `POST /api/signup` - Create new user account
- `POST /api/login` - Login with email/password
- `GET /api/user` - Get current user profile

### User Data
- `GET /api/debts` - Get user's debts
- `GET /api/transactions` - Get purchase history
- `GET /api/payments` - Get payment history
- `GET /api/crypto` - Get crypto purchases

### Features
- `POST /api/transactions` - Log new purchase (triggers roundup)
- `POST /api/payments` - Make debt payment
- `POST /api/accelerated-payment` - One-tap debt payment
- `POST /api/plaid/link-token` - Connect bank account

## Deployment Status

### App Store Connect (iOS)
- ✅ **App Name**: Dime Time
- ✅ **Bundle ID**: com.dimetime.mobile
- ✅ **Age Rating**: 16+
- ✅ **TestFlight**: Build 34 available for testing
- ⏳ **Next Step**: Submit to App Store for review

### Ready for App Store Submission
- All features implemented and tested
- User authentication working
- Real data (not demo data)
- Proper backend connection
- All fintech integrations functional

## Next Steps for User

1. **Test Build 34 on TestFlight**
   - Download from TestFlight app
   - Create new account with email/password
   - Test full signup/login flow
   - Verify all features work with real data

2. **App Store Submission** (When Ready)
   - Go to App Store Connect
   - Click "Submit for Review"
   - Apple reviews in 24-72 hours
   - App goes live when approved

3. **Marketing & Launch**
   - Prepare App Store description and screenshots
   - Plan launch campaign
   - Set up customer support channels

## Known Limitations & Future Enhancements

### Current Limitations
- Password hashing uses SHA256 (should use bcrypt for production)
- Demo user still exists for testing (can be removed for production)
- Limited rate limiting on API endpoints
- No email verification for signup

### Future Enhancements
- Two-factor authentication
- Email verification for accounts
- Advanced analytics dashboard
- Automated weekly roundup processing
- Direct ACH integration with Sila Money
- Premium features and subscriptions

## User Preferences
- Focus on mobile-first experience
- Clean, intuitive UI with purple branding
- Real functioning app, not demo/website
- Proper user authentication and data separation
- Full fintech feature set accessible to users

## Success Metrics Tracked
- Build progression (Build 34 = fully functional)
- User authentication working
- Real data per user
- All integrations responding
- iOS app connects to live backend
- TestFlight distribution active
