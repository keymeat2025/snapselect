// razorpay-integration.js - Client-side integration for Razorpay

// Define subscription plans if they don't exist
window.SUBSCRIPTION_PLANS = window.SUBSCRIPTION_PLANS || {
  basic: {
    name: 'Basic',
    price: 499,
    features: ['Basic feature 1', 'Basic feature 2']
  },
  pro: {
    name: 'Pro',
    price: 999,
    features: ['Pro feature 1', 'Pro feature 2', 'Pro feature 3']
  },
  premium: {
    name: 'Premium',
    price: 1999,
    features: ['All Pro features', 'Premium feature 1', 'Premium feature 2']
  }
};

// Create subscription manager if it doesn't exist
window.subscriptionManager = window.subscriptionManager || {
  updatePlanDisplay: function(planType) {
    // Find plan details section in the modal
    const planDetailsSection = document.getElementById('planDetailsSection');
    if (!planDetailsSection) return;
    
    // Get plan details
    const plan = window.SUBSCRIPTION_PLANS[planType];
    if (!plan) return;
    
    // Update plan name and price
    const planNameElement = document.getElementById('selectedPlanName');
    const planPriceElement = document.getElementById('selectedPlanPrice');
    
    if (planNameElement) planNameElement.textContent = plan.name;
    if (planPriceElement) planPriceElement.textContent = `₹${plan.price}`;
    
    // Update features list
    const featuresList = document.getElementById('planFeaturesList');
    if (featuresList) {
      featuresList.innerHTML = '';
      plan.features.forEach(feature => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-check"></i> ${feature}`;
        featuresList.appendChild(li);
      });
    }
  },
  
  refreshSubscriptionData: function() {
    // This function would typically fetch updated subscription data from your backend
    console.log('Refreshing subscription data...');
    
    // Check if Firebase Auth is available
    if (window.firebaseServices && window.firebaseServices.auth) {
      const user = window.firebaseServices.auth.currentUser;
      if (user) {
        // Here you would typically fetch user subscription data
        // For now, we'll just update the UI with a placeholder
        const currentPlanElement = document.getElementById('currentPlanName');
        if (currentPlanElement) {
          currentPlanElement.textContent = selectedPlan || 'Free';
        }
      }
    }
  }
};

// Initialize Firebase services if they don't exist
window.firebaseServices = window.firebaseServices || {
  functions: null,
  auth: null,
  
  // Initialize Firebase
  init: function() {
    console.log('Initializing Firebase services...');
    // Check if Firebase SDK is loaded
    if (typeof firebase !== 'undefined') {
      try {
        // Initialize Firebase functions
        this.functions = firebase.functions();
        
        // Initialize Firebase auth
        this.auth = firebase.auth();
        
        console.log('Firebase services initialized successfully');
      } catch (error) {
        console.error('Error initializing Firebase:', error);
      }
    } else {
      console.error('Firebase SDK not loaded. Make sure to include Firebase scripts before this script.');
    }
  }
};

// Global variables
let selectedPlan = null;
let currentPlan = null;

// Initialize Razorpay integration
function initRazorpayIntegration() {
  // Initialize Firebase services
  window.firebaseServices.init();
  
  // Event listener for plan tabs
  document.querySelectorAll('.plan-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs
      document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Update selected plan
      selectedPlan = this.getAttribute('data-plan');
      window.subscriptionManager.updatePlanDisplay(selectedPlan);
    });
  });

  // Event listener for upgrade button
  const upgradePlanBtn = document.getElementById('upgradePlanBtn');
  if (upgradePlanBtn) {
    upgradePlanBtn.addEventListener('click', function() {
      // Get current plan from the UI
      const currentPlanElement = document.getElementById('currentPlanName');
      currentPlan = currentPlanElement ? currentPlanElement.textContent : 'Free';
      
      // Show upgrade modal
      const modal = document.getElementById('upgradePlanModal');
      if (modal) {
        modal.style.display = 'block';
        
        // Set default selected plan (Basic)
        const basicPlanTab = document.querySelector('.plan-tab[data-plan="basic"]');
        if (basicPlanTab) {
          basicPlanTab.click();
        }
      }
    });
  }

  // Event listener for confirm upgrade button
  const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmUpgradeBtn) {
    confirmUpgradeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (selectedPlan) {
        processPayment(selectedPlan);
      }
    });
  }

  // Event listener for cancel button
  const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
  if (cancelUpgradeBtn) {
    cancelUpgradeBtn.addEventListener('click', function() {
      const modal = document.getElementById('upgradePlanModal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  }

  // Event listener for modal close button
  const closeModalBtn = document.querySelector('#upgradePlanModal .close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', function() {
      const modal = document.getElementById('upgradePlanModal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  }
}

// Process payment through Razorpay

async function processPayment(planType) {
  try {
    // Show loading state
    showPaymentProgress('Processing your request...');
    
    // Check if plan type exists
    if (!window.SUBSCRIPTION_PLANS || !window.SUBSCRIPTION_PLANS[planType]) {
      throw new Error(`Invalid plan selected: ${planType}`);
    }
    
    // Get plan details using global SUBSCRIPTION_PLANS object
    const planDetails = window.SUBSCRIPTION_PLANS[planType];
    
    // IMPORTANT FIX: Use explicit region for functions
    const functions = firebase.app().functions("asia-south1");
    
    // Create payment order via Firebase function
    const createPaymentOrder = functions.httpsCallable('createPaymentOrder');
    const result = await createPaymentOrder({
      planType: planType,
      amount: planDetails.price,
      currency: 'INR' // Explicitly set currency
    });
    
    if (!result.data || !result.data.orderId) {
      throw new Error('Failed to create payment order');
    }
    
    // Check if Razorpay is available
    if (typeof Razorpay === 'undefined') {
      throw new Error('Razorpay SDK not loaded. Please refresh the page and try again.');
    }
    
    // Rest of your function remains the same
    const options = {
      key: 'rzp_test_EF3W5mVXB1Q3li',
      amount: result.data.amount * 100,
      currency: result.data.currency || 'INR',
      name: 'SnapSelect',
      description: `Upgrade to ${planDetails.name} Plan`,
      image: '../assets/images/snapselect-logo.png',
      order_id: result.data.orderId,
      handler: function(response) {
        verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
      },
      prefill: {
        name: getUserName(),
        email: getUserEmail()
      },
      theme: {
        color: '#4A90E2'
      },
      modal: {
        ondismiss: function() {
          hidePaymentProgress();
        }
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
    
  } catch (error) {
    console.error('Payment process error:', error);
    showPaymentError(`Payment failed: ${error.message}`);
    setTimeout(hidePaymentProgress, 3000);
  }
}

// Helper function to get user name
function getUserName() {
  const userNameElement = document.getElementById('userName');
  return userNameElement ? userNameElement.textContent : '';
}

// Helper function to get user email
function getUserEmail() {
  return localStorage.getItem('userEmail') || '';
}

// Verify payment with Firebase function
async function verifyPayment(orderId, paymentId, signature) {
  try {
    showPaymentProgress('Verifying payment...');
    
    // Check if Firebase Functions are available
    if (!window.firebaseServices || !window.firebaseServices.functions) {
      throw new Error('Verification service is not available at the moment. Please contact support.');
    }
    
    const verifyPaymentFunc = window.firebaseServices.functions.httpsCallable('verifyPayment');
    const result = await verifyPaymentFunc({
      orderId: orderId,
      paymentId: paymentId,
      signature: signature,
      timezone: 'Asia/Kolkata' // Set timezone for India
    });
    
    if (result.data && result.data.success) {
      // Payment successful
      showPaymentSuccess(`Payment successful! Your subscription has been upgraded to ${result.data.planType}.`);
      
      // Update UI
      setTimeout(() => {
        const modal = document.getElementById('upgradePlanModal');
        if (modal) {
          modal.style.display = 'none';
        }
        // Refresh user subscription data
        window.subscriptionManager.refreshSubscriptionData();
      }, 2000);
    } else {
      throw new Error('Payment verification failed');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    showPaymentError(`Payment verification failed: ${error.message}`);
  } finally {
    setTimeout(hidePaymentProgress, 3000);
  }
}

// Show payment progress message
function showPaymentProgress(message) {
  const successElement = document.querySelector('.payment-success');
  const errorElement = document.querySelector('.payment-error');
  
  if (successElement) successElement.style.display = 'none';
  if (errorElement) errorElement.style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }
}

// Show payment success message
function showPaymentSuccess(message) {
  const successEl = document.querySelector('.payment-success');
  if (successEl) {
    successEl.textContent = message;
    successEl.style.display = 'block';
  }
  
  const errorEl = document.querySelector('.payment-error');
  if (errorEl) {
    errorEl.style.display = 'none';
  }
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Upgrade Complete!';
  }
}

// Show payment error message
function showPaymentError(message) {
  const errorEl = document.querySelector('.payment-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  
  const successEl = document.querySelector('.payment-success');
  if (successEl) {
    successEl.style.display = 'none';
  }
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Try Again';
  }
}

// Hide payment progress
function hidePaymentProgress() {
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Upgrade Now';
  }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
  initRazorpayIntegration();
});
