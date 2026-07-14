/**
 * Throwaway TEST-MODE verification for the ACH subscription flow.
 *
 * Verifies, against the real Stripe test API, the exact code path the app
 * will use (subscriptionService functions):
 *   1. ensurePlanPrice — lookup_key find-or-create
 *   2. SetupIntent mandate (server-side confirm, us_bank_account)
 *   3. subscriptions.create allow_incomplete → what status does the sub get
 *      while the first ACH invoice is processing?
 *
 * Run: npx tsx scripts/verify-subscription-flow.ts
 * Safe: dev resolves STRIPE_SECRET_KEY_TEST (resolveStripeSecretKey forces
 * test mode outside production); cleans up after itself (cancels sub).
 */

import { getStripe, resolveStripeSecretKey } from "../server/services/stripeService";
import {
  ensurePlanPrice,
  createRecurringAchMandate,
  createPlanSubscription,
  setCancelAtPeriodEnd,
  cancelSubscriptionImmediately,
  subscriptionRowFromStripe,
} from "../server/services/subscriptionService";

async function main() {
  const { mode } = resolveStripeSecretKey();
  if (mode !== "test") {
    console.error(`ABORT: resolved Stripe key mode is '${mode}', not 'test'.`);
    process.exit(1);
  }
  const stripe: any = await getStripe();
  if (!stripe) {
    console.error("ABORT: Stripe client unavailable (flag off or key unset).");
    process.exit(1);
  }
  console.log("✓ Stripe test-mode client ready");

  // 1. Price by lookup_key
  const priceId = await ensurePlanPrice("debt");
  console.log(`✓ ensurePlanPrice -> ${priceId}`);
  const priceId2 = await ensurePlanPrice("debt");
  if (priceId2 !== priceId) throw new Error("ensurePlanPrice not idempotent!");
  console.log("✓ ensurePlanPrice idempotent");

  // 2. Test customer + verified test bank account PM
  const customer = await stripe.customers.create({
    email: "subs-verify@dime-time.com",
    metadata: { dimeTimeUserId: "verify-script" },
  });
  const pm = await stripe.paymentMethods.create({
    type: "us_bank_account",
    us_bank_account: {
      routing_number: "110000000",
      account_number: "000123456789", // test: payment succeeds after verification
      account_holder_type: "individual",
      account_type: "checking",
    },
    billing_details: { name: "Verify Script", email: "subs-verify@dime-time.com" },
  });
  console.log(`✓ customer ${customer.id}, pm ${pm.id}`);

  // TEST-ONLY: raw test PMs need microdeposit verification. Production PMs
  // come from Financial Connections and are instantly verified, so the app
  // never does this. Verify via a bootstrap SetupIntent + descriptor code.
  const bootstrapSi = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method: pm.id,
    payment_method_types: ["us_bank_account"],
    confirm: true,
    mandate_data: {
      customer_acceptance: {
        type: "online",
        online: { ip_address: "203.0.113.7", user_agent: "verify-script/1.0" },
      },
    },
  });
  if (bootstrapSi.status === "requires_action") {
    await stripe.setupIntents.verifyMicrodeposits(bootstrapSi.id, {
      descriptor_code: "SM11AA",
    });
    console.log("✓ test microdeposit verification done");
  } else {
    console.log(`✓ bootstrap SetupIntent status=${bootstrapSi.status} (no microdeposit step)`);
  }

  // 3. SetupIntent mandate
  const mandate = await createRecurringAchMandate({
    customerId: customer.id,
    paymentMethodId: pm.id,
    mandateIpAddress: "203.0.113.7",
    mandateUserAgent: "verify-script/1.0",
    idempotencyKey: `verify_${Date.now()}`,
  });
  console.log(`✓ SetupIntent ${mandate.setupIntentId} status=${mandate.status}`);

  // 4. Subscription
  const sub = await createPlanSubscription({
    customerId: customer.id,
    paymentMethodId: pm.id,
    planId: "debt",
    priceId,
    userId: "verify-script",
    idempotencyKey: `verify_sub_${Date.now()}`,
  });
  const inv = sub.latest_invoice;
  const pi = typeof inv === "object" ? inv?.payment_intent : null;
  console.log("=== RESULT ===");
  console.log(`subscription.status        = ${sub.status}`);
  console.log(`latest_invoice.status      = ${typeof inv === "object" ? inv?.status : inv}`);
  console.log(`payment_intent.status      = ${typeof pi === "object" ? pi?.status : pi}`);
  console.log(`current_period_start/end   = ${sub.current_period_start} / ${sub.current_period_end}`);
  console.log(`cancel_at_period_end       = ${sub.cancel_at_period_end}`);

  const row = subscriptionRowFromStripe(sub, "verify-script");
  console.log("mapped row:", JSON.stringify(row, null, 2));

  // 5. cancel-at-period-end then immediate cancel + cleanup
  const updated = await setCancelAtPeriodEnd(sub.id, true);
  console.log(`✓ cancel_at_period_end=true -> status=${updated.status}, cape=${updated.cancel_at_period_end}`);
  await cancelSubscriptionImmediately(sub.id);
  const after = await stripe.subscriptions.retrieve(sub.id);
  console.log(`✓ hard cancel -> status=${after.status}`);
  await stripe.customers.del(customer.id);
  console.log("✓ cleanup done");
}

main().catch((err) => {
  console.error("FAILED:", err?.raw?.message || err?.message || err);
  process.exit(1);
});
