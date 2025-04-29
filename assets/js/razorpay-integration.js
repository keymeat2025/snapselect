/**
 * razorpay-integration.js - Enhanced Razorpay payment gateway integration for SnapSelect
 * Updated with improved error handling, validation, and reliability
 */

// Configuration
const RAZORPAY_CONFIG = {
  key: 'rzp_test_EF3W5mVXB1Q3li', // Test key - replace with production key in production
  currency: 'INR',
  theme: { color: '#6366f1' },
  timeout: 30000, // 30 second timeout for API calls
  retryAttempts: 2, // Number of retry attempts for failed API calls
  debugMode: true // Set to false in production
};

// State tracking
let paymentInProgress = false;
let firebaseReady = false;
let firebaseCheckInterval;
let razorpayLoaded = false;

/**
 * Ensure Firebase is fully loaded and initialized
 * @returns {Promise<boolean>} Promise that resolves when Firebase is ready
 */
function ensureFirebaseIsReady() {
  // Clear any existing interval
  if (firebaseCheckInterval) {
    clearInterval(firebaseCheckInterval);
  }
  
  // If Firebase is already confirmed ready, return immediately
  if (firebaseReady) {
    return Promise.resolve(true);
  }
  
  // Check if Firebase is available right now
  if (typeof firebase !== 'undefined' && 
      typeof firebase.app === 'function' &&
      typeof firebase.auth === 'function' &&
      typeof firebase.functions === 'function') {
    
    firebaseReady = true;
    return Promise.resolve(true);
  }
  
  // Set up a promise that resolves when Firebase is ready
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 50; // Try for about 10 seconds
    
    firebaseCheckInterval = setInterval(() => {
      attempts++;
      
      // Check if Firebase is fully loaded
      if (typeof firebase !== 'undefined' && 
          typeof firebase.app === 'function' &&
          typeof firebase.auth === 'function' &&
          typeof firebase.functions === 'function') {
        
        clearInterval(firebaseCheckInterval);
        firebaseReady = true;
        resolve(true);
        return;
      }
      
      // Give up after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(firebaseCheckInterval);
        reject(new Error("Firebase initialization timed out"));
        return;
      }
    }, 200); // Check every 200ms
  });
}

/**
 * Ensure Razorpay SDK is loaded
 * @returns {Promise<boolean>} Promise that resolves when Razorpay is loaded
 */
function ensureRazorpayIsLoaded() {
  // If already loaded, return immediately
  if (typeof Razorpay !== 'undefined' && razorpayLoaded) {
    return Promise.resolve(true);
  }
  
  // If script is already in process of loading, wait for it
  if (document.querySelector('script[src*="checkout.razorpay.com"]')) {
    return new Promise((resolve) => {
      const checkRazorpay = setInterval(() => {
        if (typeof Razorpay !== 'undefined') {
          clearInterval(checkRazorpay);
          razorpayLoaded = true;
          resolve(true);
        }
      }, 200);
    });
  }
  
  // Load the script
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    
    script.onload = () => {
      razorpayLoaded = true;
      resolve(true);
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay SDK'));
    };
    
    document.body.appendChild(script);
  });
}

/**
 * Initialize the Razorpay integration
 * Sets up event listeners and loads required dependencies
 */
async function initRazorpayIntegration() {
  try {
    // Load Razorpay script
    await ensureRazorpayIsLoaded();
    
    // Setup event listeners
    setupRazorpayEventListeners();
    
    // Log success
    if (RAZORPAY_CONFIG.debugMode) {
      console.log('Razorpay integration initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing Razorpay integration:', error);
    // Fallback initialization for event listeners even if script failed to load
    setupRazorpayEventListeners();
  }
}

/**
 * Set up event listeners for payment-related UI elements
 */
function setupRazorpayEventListeners() {
  const paymentForm = document.getElementById('paymentForm');
  const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
  
  if (paymentForm) {
    paymentForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Prevent multiple submissions
      if (paymentInProgress) {
        console.warn('Payment already in progress, ignoring duplicate submission');
        return;
      }
      
      // Validate form
      if (window.securityManager?.validatePaymentForm && !window.securityManager.validatePaymentForm()) {
        return;
      }
      
      // Update button state
      if (confirmUpgradeBtn) {
        confirmUpgradeBtn.disabled = true;
        confirmUpgradeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      }
      
      // Get selected plan
      const activeTab = document.querySelector('.plan-tab.active');
      if (!activeTab) {
        showPaymentError('No plan selected. Please select a plan to continue.');
        resetButton();
        return;
      }
      
      // Get plan details
      const planType = activeTab.getAttribute('data-plan');
      const planDetails = window.subscriptionManager?.SUBSCRIPTION_PLANS?.[planType];
      
      if (!planDetails) {
        showPaymentError('Invalid plan selected. Please refresh and try again.');
        resetButton();
        return;
      }
      
      // Set payment in progress flag
      paymentInProgress = true;
      
      // Create order
      createRazorpayOrder(planType, planDetails.price)
        .catch(error => {
          console.error('Error in payment flow:', error);
          // Payment flow completed (even with error)
          paymentInProgress = false;
        });
    });
  }
  
  // Add listener for upgrade plan button if present
  const upgradePlanBtn = document.getElementById('upgradePlanBtn');
  if (upgradePlanBtn) {
    upgradePlanBtn.addEventListener('click', function() {
      // If modal opening function exists, use it
      if (typeof openUpgradePlanModal === 'function') {
        openUpgradePlanModal();
      } else {
        // Fallback - show modal directly if function not available
        const modal = document.getElementById('upgradePlanModal');
        if (modal) {
          modal.style.display = 'block';
          document.body.style.overflow = 'hidden';
        }
      }
    });
  }
}

/**
 * Create a Razorpay order via Firebase Function
 * @param {string} planType - The plan type selected
 * @param {number} amount - The amount to charge
 * @returns {Promise} Promise that resolves when order is created
 */
async function createRazorpayOrder(planType, amount) {
  try {
    // Validate parameters first
    if (!planType || !amount) {
      throw new Error('Invalid plan parameters: plan type and amount are required');
    }
    
    // Check if we have security validation available
    if (window.securityManager?.validateOrderCreation) {
      const validation = window.securityManager.validateOrderCreation(planType, amount);
      if (!validation.valid) {
        throw new Error(validation.message || 'Invalid order parameters');
      }
    }
    
    // Log payment attempt
    if (RAZORPAY_CONFIG.debugMode) {
      console.log('Creating Razorpay order:', {
        planType, 
        amount, 
        timestamp: new Date().toISOString()
      });
    }
    
    // Ensure Firebase is ready
    await ensureFirebaseIsReady();
    
    // Make sure user is authenticated
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      throw new Error('Authentication required. Please log in to continue.');
    }
    
    // Get user info for tracking
    const userId = currentUser.uid;
    const userEmail = currentUser.email;
    
    // Get functions instance - use both region specifications for compatibility
    let functionsInstance;
    try {
      // Try with region parameter first (preferred)
      functionsInstance = firebase.app().functions('asia-south1');
      
      if (RAZORPAY_CONFIG.debugMode) {
        console.log('Using asia-south1 region for functions');
      }
    } catch (error) {
      console.warn('Error initializing regional functions, falling back to default:', error);
      // Fallback to default
      functionsInstance = firebase.functions();
    }
    
    // Start timer for performance tracking
    const startTime = Date.now();
    
    // Create nonce for request
    const nonce = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Helper for retrying function calls
    const callWithRetry = async (fn, retries = RAZORPAY_CONFIG.retryAttempts) => {
      try {
        return await fn();
      } catch (error) {
        if (retries > 0 && isRetriableError(error)) {
          console.warn(`Retrying function call, ${retries} attempts remaining`);
          // Wait between retries (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (RAZORPAY_CONFIG.retryAttempts - retries + 1)));
          return callWithRetry(fn, retries - 1);
        }
        throw error;
      }
    };
    
    // Check if an error is retriable
    const isRetriableError = (error) => {
      // Retry network errors, timeouts, or internal server errors
      return !error.code || 
             error.code === 'functions/deadline-exceeded' ||
             error.code === 'functions/internal' ||
             error.code === 'functions/unavailable';
    };
    
    // Call the function with retry logic
    const createOrderFn = functionsInstance.httpsCallable('createPaymentOrder');
    const result = await callWithRetry(() => createOrderFn({
      planType,
      amount,
      nonce,
      timestamp: Date.now()
    }));
    
    // Calculate latency
    const latency = Date.now() - startTime;
    
    if (RAZORPAY_CONFIG.debugMode) {
      console.log(`Order created in ${latency}ms:`, result);
    }
    
    // Track metrics if analytics is available
    if (window.analyticsManager?.trackEvent) {
      window.analyticsManager.trackEvent('order_created', {
        planType,
        amount,
        latency,
        userId
      });
    }
    
    // Get order data from result
    const orderData = result.data;
    
    if (!orderData || !orderData.orderId) {
      throw new Error('Failed to create order. Please try again later.');
    }
    
    // Open Razorpay checkout
    await openRazorpayCheckout(orderData.orderId, amount, planType);
    
    return true;
  } catch (error) {
    // Handle different error types
    let errorMessage = 'An error occurred during payment processing.';
    
    if (error.code && error.code.startsWith('functions/')) {
      // Firebase Functions error
      switch (error.code) {
        case 'functions/invalid-argument':
          errorMessage = 'Invalid payment parameters. Please check your plan selection.';
          break;
        case 'functions/unauthenticated':
        case 'functions/permission-denied':
          errorMessage = 'Authentication error. Please log in again to continue.';
          break;
        case 'functions/resource-exhausted':
          errorMessage = 'Payment service is currently busy. Please try again later.';
          break;
        case 'functions/deadline-exceeded':
        case 'functions/unavailable':
          errorMessage = 'Payment service is temporarily unavailable. Please try again later.';
          break;
        default:
          errorMessage = `Payment service error: ${error.message}. Please try again later.`;
      }
    } else if (error.message) {
      // Regular error with message
      errorMessage = error.message;
    }
    
    console.error('Error creating Razorpay order:', error);
    showPaymentError(errorMessage);
    resetButton();
    
    // Track error if analytics available
    if (window.analyticsManager?.trackEvent) {
      window.analyticsManager.trackEvent('order_creation_failed', {
        planType,
        amount,
        error: error.message || 'Unknown error',
        errorCode: error.code || 'none'
      });
    }
    
    // Release payment in progress flag
    paymentInProgress = false;
    
    // Re-throw so calling code can handle it
    throw error;
  }
}

/**
 * Open the Razorpay checkout modal
 * @param {string} orderId - The Razorpay order ID
 * @param {number} amount - The amount to charge
 * @param {string} planType - The plan type selected
 * @returns {Promise} Promise that resolves when checkout is complete
 */
async function openRazorpayCheckout(orderId, amount, planType) {
  try {
    // Ensure Razorpay is loaded
    await ensureRazorpayIsLoaded();
    
    // Get user details for prefill
    const userName = document.getElementById('userName')?.textContent || '';
    const userEmail = getUserEmail();
    
    // Set up checkout options
    const planDetails = window.subscriptionManager?.SUBSCRIPTION_PLANS?.[planType];
    const planName = planDetails?.name || planType.toUpperCase();
    
    const options = {
      key: RAZORPAY_CONFIG.key,
      amount: amount * 100, // Convert to paise
      currency: RAZORPAY_CONFIG.currency,
      name: 'SnapSelect',
      description: `Upgrade to ${planName} Plan`,
      order_id: orderId,
      handler: response => handleRazorpaySuccess(response, planType, amount),
      prefill: { 
        name: userName, 
        email: userEmail 
      },
      notes: { 
        planType,
        userId: firebase.auth()?.currentUser?.uid || '',
        timestamp: new Date().toISOString()
      },
      theme: RAZORPAY_CONFIG.theme,
      modal: {
        escape: false,
        ondismiss: () => {
          console.log('Checkout dismissed by user');
          resetButton();
          paymentInProgress = false;
          
          // Track cancellation
          if (window.analyticsManager?.trackEvent) {
            window.analyticsManager.trackEvent('checkout_cancelled', { planType, amount });
          }
        }
      }
    };
    
    if (RAZORPAY_CONFIG.debugMode) {
      console.log('Opening Razorpay checkout with options:', {
        orderId,
        amount: amount * 100,
        planType,
        currency: RAZORPAY_CONFIG.currency
      });
    }
    
    // Create and open checkout
    const rzp = new Razorpay(options);
    rzp.open();
    
    // Track event
    if (window.analyticsManager?.trackEvent) {
      window.analyticsManager.trackEvent('checkout_opened', { planType, amount });
    }
    
    // Return a promise that never resolves (will be handled by the handler)
    return new Promise(() => {});
  } catch (error) {
    console.error('Error opening Razorpay checkout:', error);
    showPaymentError(`Failed to open checkout: ${error.message}`);
    resetButton();
    paymentInProgress = false;
    
    // Track error
    if (window.analyticsManager?.trackEvent) {
      window.analyticsManager.trackEvent('checkout_failed', { 
        planType, 
        amount, 
        error: error.message 
      });
    }
    
    throw error;
  }
}

/**
 * Handle successful payment from Razorpay
 * @param {Object} response - The Razorpay response
 * @param {string} planType - The plan type selected
 * @param {number} amount - The amount charged
 */
async function handleRazorpaySuccess(response, planType, amount) {
  try {
    if (RAZORPAY_CONFIG.debugMode) {
      console.log('Payment successful, verifying payment:', {
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id
      });
    }
    
    // Update UI
    const confirmButton = document.getElementById('confirmUpgradeBtn');
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying payment...';
    }
    
    // Ensure Firebase is ready
    await ensureFirebaseIsReady();
    
    // Validate response parameters
    if (!response.razorpay_order_id || !response.razorpay_payment_id || !response.razorpay_signature) {
      throw new Error('Invalid payment response. Missing required parameters.');
    }
    
    // Perform security validation if available
    if (window.securityManager?.validatePaymentVerification) {
      const validation = window.securityManager.validatePaymentVerification(
        response.razorpay_order_id,
        response.razorpay_payment_id,
        response.razorpay_signature
      );
      
      if (!validation.valid) {
        throw new Error(validation.message || 'Payment validation failed');
      }
    }
    
    // Get functions instance with explicit region
    let functionsInstance;
    try {
      functionsInstance = firebase.app().functions('asia-south1');
    } catch (error) {
      console.warn('Error initializing regional functions, falling back to default:', error);
      functionsInstance = firebase.functions();
    }
    
    // Start timer for performance tracking
    const startTime = Date.now();
    
    // Helper for retrying function calls
    const callWithRetry = async (fn, retries = RAZORPAY_CONFIG.retryAttempts) => {
      try {
        return await fn();
      } catch (error) {
        if (retries > 0 && 
            (!error.code || 
             error.code === 'functions/deadline-exceeded' ||
             error.code === 'functions/internal' ||
             error.code === 'functions/unavailable')) {
          console.warn(`Retrying verification, ${retries} attempts remaining`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (RAZORPAY_CONFIG.retryAttempts - retries + 1)));
          return callWithRetry(fn, retries - 1);
        }
        throw error;
      }
    };
    
    // Sanitize payment data if sanitizer is available
    const paymentData = window.securityManager?.sanitizePaymentData ? 
      window.securityManager.sanitizePaymentData({
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
        planType: planType,
        amount: amount
      }) : {
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
        planType: planType,
        amount: amount
      };
    
    // Verify payment signature
    const verifyPaymentFn = functionsInstance.httpsCallable('verifyPayment');
    const verificationResult = await callWithRetry(() => verifyPaymentFn(paymentData));
    
    // Calculate latency
    const latency = Date.now() - startTime;
    
    if (RAZORPAY_CONFIG.debugMode) {
      console.log(`Payment verified in ${latency}ms:`, verificationResult);
    }
    
    const verificationData = verificationResult.data;
    
    if (!verificationData || !verificationData.success) {
      throw new Error(verificationData?.message || 'Payment verification failed. Please contact support.');
    }
    
    // Track analytics event
    if (window.analyticsManager?.trackEvent) {
      window.analyticsManager.trackEvent('payment_success', {
        planType, 
        amount, 
        paymentId: response.razorpay_payment_id,
        latency
      });
    }
    
    // Show success message
    showPaymentSuccess(planType);
    
    // Release payment in progress flag
    paymentInProgress = false;
    
    // Close modal and refresh data after delay
    setTimeout(() => {
      // Close modal if function exists
      if (typeof closeUpgradePlanModal === 'function') {
        closeUpgradePlanModal();
      } else {
        // Fallback if function doesn't exist
        const modal = document.getElementById('upgradePlanModal');
        if (modal) {
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }
      }
      
      // Refresh subscription data if function exists
      if (window.subscriptionManager?.loadSubscriptionData) {
        window.subscriptionManager.loadSubscriptionData();
      } else {
        // Otherwise reload the page after a short delay
        setTimeout(() => window.location.reload(), 1000);
      }
    }, 2000);
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    
    // Determine appropriate error message
    let errorMessage;
    if (error.code?.startsWith('functions/')) {
      switch (error.code) {
        case 'functions/invalid-argument':
          errorMessage = 'Payment verification failed. Invalid signature.';
          break;
        case 'functions/permission-denied':
          errorMessage = 'Unauthorized payment verification attempt.';
          break;
        default:
          errorMessage = `Payment verification error: ${error.message}. Please contact support.`;
      }
    } else {
      errorMessage = `Failed to verify payment: ${error.message}`;
    }
    
    showPaymentError(errorMessage);
    resetButton();
    
    // Track error
    if (window.analyticsManager?.trackEvent) {
      window.analyticsManager.trackEvent('payment_verification_failed', {
        planType,
        amount, 
        error: error.message,
        errorCode: error.code || 'none'
      });
    }
    
    // Release payment in progress flag
    paymentInProgress = false;
  }
}

/**
 * Reset the payment button state
 */
function resetButton() {
  const confirmButton = document.getElementById('confirmUpgradeBtn');
  if (confirmButton) {
    confirmButton.disabled = false;
    confirmButton.textContent = 'Upgrade Now';
  }
}

/**
 * Show payment error message
 * @param {string} message - The error message to display
 */
function showPaymentError(message) {
  if (!message) return;
  
  let errorElement = document.querySelector('.payment-error');
  
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'payment-error alert-danger';
    
    const paymentSection = document.querySelector('.payment-section');
    if (paymentSection) {
      paymentSection.insertBefore(errorElement, paymentSection.firstChild);
    } else {
      // Fallback to alert if container not found
      alert(`Error: ${message}`);
      return;
    }
  }
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  // Auto-hide after delay
  setTimeout(() => {
    if (errorElement.textContent === message) {
      errorElement.style.display = 'none';
    }
  }, 7000);
}

/**
 * Show payment success message
 * @param {string} planType - The plan type purchased
 */
function showPaymentSuccess(planType) {
  const planDetails = window.subscriptionManager?.SUBSCRIPTION_PLANS?.[planType];
  const planName = planDetails?.name || planType.toUpperCase();
  
  let successElement = document.querySelector('.payment-success');
  
  if (!successElement) {
    successElement = document.createElement('div');
    successElement.className = 'payment-success alert-success';
    
    const paymentSection = document.querySelector('.payment-section');
    if (paymentSection) {
      paymentSection.insertBefore(successElement, paymentSection.firstChild);
    } else {
      // Fallback to alert if container not found
      alert(`Payment successful! Your account has been upgraded to ${planName} plan.`);
      return;
    }
  }
  
  successElement.innerHTML = `
    <i class="fas fa-check-circle"></i> 
    Payment successful! Your account has been upgraded to 
    <strong>${planName}</strong> plan.
  `;
  successElement.style.display = 'block';
}

/**
 * Get current user's email
 * @returns {string} The user's email or empty string
 */
function getUserEmail() {
  if (firebase.auth()?.currentUser?.email) {
    return firebase.auth().currentUser.email;
  }
  
  // Fallback to stored email
  return localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail') || '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initRazorpayIntegration);

// Make functions available globally
window.razorpayIntegration = {
  createRazorpayOrder,
  openRazorpayCheckout,
  handleRazorpaySuccess,
  resetPaymentState: () => {
    paymentInProgress = false;
    resetButton();
  },
  getConfig: () => ({ ...RAZORPAY_CONFIG, key: '***' }) // Hide actual key in returned config
};
