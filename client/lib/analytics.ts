import { Capacitor } from '@capacitor/core';

// Define the gtag function globally
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Get Google Analytics Measurement ID from environment (no fallback for safety)
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

// Check if analytics should be enabled
const isAnalyticsEnabled = () => {
  if (!MEASUREMENT_ID) {
    console.warn('Google Analytics disabled: VITE_GA_MEASUREMENT_ID environment variable not set');
    return false;
  }
  return true;
};

// Flag to prevent double initialization
let gaInitialized = false;

// Initialize Google Analytics with consent mode
export const initGA = () => {
  // Never load analytics inside the native Capacitor app — Apple treats
  // in-app analytics as user tracking. GA runs only on the public website.
  if (Capacitor.isNativePlatform()) return;
  if (gaInitialized || typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  
  // Set default consent state (denied until user consents)
  window.gtag?.('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  
  // Add Google Analytics script to the head
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script1);

  // Initialize gtag
  const script2 = document.createElement('script');
  script2.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${MEASUREMENT_ID}', {
      page_title: document.title,
      page_location: window.location.href,
      send_page_view: false // We'll handle page views manually
    });
  `;
  document.head.appendChild(script2);
  
  gaInitialized = true;
};

// Update consent when user makes a choice
export const updateConsent = (granted: boolean) => {
  if (typeof window === 'undefined' || !window.gtag || !isAnalyticsEnabled()) return;
  
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: granted ? 'granted' : 'denied',
    ad_user_data: granted ? 'granted' : 'denied',
    ad_personalization: granted ? 'granted' : 'denied',
  });
};

/**
 * Build a sanitized page_location string for analytics — strips query
 * string AND fragment so we never exfiltrate secrets like
 *   /reset-password?token=...
 *   /verify-email?token=...
 *   /reset-password#token=...
 * to Google Analytics or anyone with analytics-export access.
 */
const sanitizedPageLocation = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const u = new URL(window.location.href);
    return `${u.origin}${u.pathname}`;
  } catch {
    return window.location.origin + window.location.pathname;
  }
};

const sanitizedPath = (path: string): string => {
  // Strip query + hash from the wouter-supplied path as well — defensive,
  // since callers may pass `useLocation()` values that include them.
  const qIdx = path.indexOf('?');
  const hIdx = path.indexOf('#');
  let end = path.length;
  if (qIdx >= 0) end = Math.min(end, qIdx);
  if (hIdx >= 0) end = Math.min(end, hIdx);
  return path.slice(0, end);
};

// Track page views - improved for single-page applications
export const trackPageView = (url: string, title?: string) => {
  if (typeof window === 'undefined' || !window.gtag || !isAnalyticsEnabled()) return;

  // Send explicit page_view event instead of config to avoid resetting settings.
  // SECURITY: never forward query strings or fragments to GA — they can
  // contain one-time secrets (reset/verify tokens). See sanitizedPageLocation.
  window.gtag('event', 'page_view', {
    page_path: sanitizedPath(url),
    page_title: title || document.title,
    page_location: sanitizedPageLocation(),
  });
};

// Set user ID for authenticated users (use internal UUID, not PII)
export const setUserId = (userId: string) => {
  if (typeof window === 'undefined' || !window.gtag || !isAnalyticsEnabled()) return;
  
  window.gtag('config', MEASUREMENT_ID, {
    user_id: userId,
  });
};

// Set user properties for audience segmentation (GA4 syntax)
export const setUserProperties = (properties: {
  has_bank_connected?: boolean;
  crypto_enabled?: boolean;
  subscription_tier?: string;
  user_type?: string;
  signup_month?: string; // Changed from signup_date to be less specific
}) => {
  if (typeof window === 'undefined' || !window.gtag || !isAnalyticsEnabled()) return;
  
  // Remove any PII and set user properties using correct GA4 syntax
  const cleanProperties = Object.fromEntries(
    Object.entries(properties).filter(([_, value]) => value !== undefined)
  );
  
  window.gtag('set', 'user_properties', cleanProperties);
};

// Track events
export const trackEvent = (
  action: string, 
  category?: string, 
  label?: string, 
  value?: number
) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// ===== FINTECH-SPECIFIC ANALYTICS =====

// Round-up transaction tracking (GA4 custom event)
export const trackRoundUp = (amount: number, category?: string) => {
  window.gtag?.('event', 'roundup_collected', {
    currency: 'USD',
    value: amount,
    category: category || 'general',
    event_category: 'finance',
  });
  
  // Track milestone achievements
  if (amount >= 1.0) {
    window.gtag?.('event', 'milestone_achieved', {
      milestone_type: 'roundup_dollar',
      value: amount,
      currency: 'USD',
    });
  }
};

// Debt payment tracking (proper GA4 ecommerce or custom event)
export const trackDebtPayment = (amount: number, debtType: string, success: boolean, transactionId?: string) => {
  if (success) {
    window.gtag?.('event', 'purchase', {
      transaction_id: transactionId || `debt_${Date.now()}`,
      currency: 'USD',
      value: amount,
      items: [{
        item_id: `debt_payment_${debtType}`,
        item_name: `${debtType} Debt Payment`,
        item_category: 'debt_payment',
        quantity: 1,
        price: amount
      }]
    });
  } else {
    window.gtag?.('event', 'payment_failed', {
      currency: 'USD',
      value: amount,
      failure_reason: 'payment_processing',
      debt_type: debtType
    });
  }
};

// Crypto investment tracking (proper GA4 ecommerce)
export const trackCryptoInvestment = (amount: number, cryptoType: string = 'bitcoin', transactionId?: string) => {
  window.gtag?.('event', 'purchase', {
    transaction_id: transactionId || `crypto_${Date.now()}`,
    currency: 'USD',
    value: amount,
    items: [{
      item_id: `crypto_${cryptoType}`,
      item_name: `${cryptoType.toUpperCase()} Investment`,
      item_category: 'cryptocurrency',
      quantity: 1,
      price: amount
    }]
  });
};

// Banking connection tracking (remove bank name for privacy)
export const trackBankConnection = (success: boolean, connectionMethod?: string) => {
  if (success) {
    window.gtag?.('event', 'bank_account_linked', {
      method: connectionMethod || 'plaid',
      event_category: 'onboarding',
      success: true
    });
  } else {
    window.gtag?.('event', 'bank_connection_failed', {
      method: connectionMethod || 'plaid',
      event_category: 'onboarding',
      success: false
    });
  }
};

// Standard GA4 Events for Authentication
export const trackSignUp = (method: string = 'email') => {
  window.gtag?.('event', 'sign_up', {
    method: method,
  });
};

export const trackLogin = (method: string = 'replit_auth') => {
  window.gtag?.('event', 'login', {
    method: method,
  });
};

// User onboarding milestones
export const trackUserMilestone = (milestone: string, value?: number) => {
  window.gtag?.('event', 'milestone_achieved', {
    milestone_type: milestone,
    value: value,
    event_category: 'user_journey'
  });
};

// Feature usage tracking
export const trackFeatureUsage = (feature: string, action: string) => {
  window.gtag?.('event', 'feature_interaction', {
    feature_name: feature,
    interaction_type: action,
    event_category: 'engagement'
  });
};

// Financial goal tracking
export const trackGoalProgress = (goalType: string, progress: number, target: number) => {
  const progressPercent = Math.round((progress / target) * 100);
  window.gtag?.('event', 'goal_progress_update', {
    goal_type: goalType,
    progress_percentage: progressPercent,
    currency: 'USD',
    progress_amount: progress,
    target_amount: target
  });
  
  // Track goal completion
  if (progress >= target) {
    window.gtag?.('event', 'goal_achieved', {
      goal_type: goalType,
      final_amount: target,
      currency: 'USD'
    });
  }
};

// Enhanced error and performance tracking (GA4 custom events)
export const trackError = (errorType: string, errorContext?: string) => {
  window.gtag?.('event', 'js_error', {
    error_type: errorType,
    error_context: errorContext || 'unknown',
    fatal: false
  });
};

export const trackPerformance = (metric: string, value: number) => {
  window.gtag?.('event', 'performance_metric', {
    metric_name: metric,
    metric_value: Math.round(value),
    event_category: 'performance'
  });
};

// Track form interactions
export const trackFormStart = (formName: string) => {
  window.gtag?.('event', 'form_start', {
    form_name: formName,
  });
};

export const trackFormComplete = (formName: string, success: boolean) => {
  window.gtag?.('event', 'form_submit', {
    form_name: formName,
    success: success,
  });
};

// Track search usage
export const trackSearch = (searchTerm: string, results?: number) => {
  window.gtag?.('event', 'search', {
    search_term: searchTerm,
    results_count: results
  });
};

// Enhanced revenue tracking (proper GA4 ecommerce schema)
export const trackRevenue = (amount: number, source: string, transactionId?: string) => {
  if (!isAnalyticsEnabled()) return;
  
  window.gtag?.('event', 'purchase', {
    transaction_id: transactionId || `revenue_${Date.now()}`,
    currency: 'USD',
    value: amount,
    items: [{
      item_id: 'subscription',
      item_name: 'Subscription',
      item_category: 'subscription',
      item_variant: source,
      price: amount,
      quantity: 1
    }]
  });
};

// Enhanced engagement tracking (custom event to avoid conflicts)
export const trackEngagement = (action: string, duration?: number, element?: string) => {
  window.gtag?.('event', 'page_engagement', {
    engagement_time_msec: duration,
    action_type: action,
    element_name: element,
    event_category: 'engagement'
  });
};

// Track scroll depth
export const trackScrollDepth = (percentage: number, page: string) => {
  window.gtag?.('event', 'scroll', {
    percent_scrolled: percentage,
    page_path: page
  });
};

// Track file downloads
export const trackDownload = (fileName: string, fileType: string) => {
  window.gtag?.('event', 'file_download', {
    file_name: fileName,
    file_extension: fileType,
    // SECURITY: do not include query/hash — sanitizedPageLocation strips tokens.
    link_url: sanitizedPageLocation()
  });
};

// Global error handler setup
export const setupGlobalErrorTracking = () => {
  if (typeof window === 'undefined') return;
  
  // Track JavaScript errors
  window.addEventListener('error', (event) => {
    trackError('javascript_error', event.filename || 'unknown');
  });
  
  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError('unhandled_promise_rejection', 'async_error');
  });
};