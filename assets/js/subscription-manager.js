/**
 * subscription-manager.js - Manages user subscriptions and Razorpay integration
 * 
 * This script handles:
 * - Displaying current subscription info
 * - Plan upgrade modal
 * - Razorpay integration for payments
 * - Updating user subscription after successful payment
 */

// Subscription plans data
const SUBSCRIPTION_PLANS = {
  lite: {
    name: 'Lite',
    price: 79,
    priceType: 'per client',
    storageLimit: 2, // GB
    galleryLimit: 1,
    photosPerGallery: 100,
    maxClients: 1,
    expiryDays: 7,
    features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature']
  },
  mini: {
    name: 'Mini',
    price: 149,
    priceType: 'per client',
    storageLimit: 5, // GB
    galleryLimit: 1,
    photosPerGallery: 200,
    maxClients: 1,
    expiryDays: 14,
    features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Basic Gallery Customization']
  },
  basic: {
    name: 'Basic',
    price: 399,
    priceType: 'per client',
    storageLimit: 15, // GB
    galleryLimit: 1,
    photosPerGallery: 500,
    maxClients: 1,
    expiryDays: 30,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Custom branding', 'Basic Analytics']
  },
  pro: {
    name: 'Pro',
    price: 799,
    priceType: 'per client',
    storageLimit: 25, // GB
    galleryLimit: 1,
    photosPerGallery: 800,
    maxClients: 1,
    expiryDays: 45,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Advanced Gallery Customization', 'Client Comments', 'Detailed Analytics']
  },
  premium: {
    name: 'Premium',
    price: 1499,
    priceType: 'per client',
    storageLimit: 50, // GB
    galleryLimit: 1,
    photosPerGallery: 1200,
    maxClients: 1,
    expiryDays: 60,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Complete Gallery Customization', 'Client Comments', 'Detailed Analytics', 'Priority Support']
  },
  ultimate: {
    name: 'Ultimate',
    price: 2999,
    priceType: 'per client',
    storageLimit: 100, // GB
    galleryLimit: 2,
    photosPerGallery: 1250,
    maxClients: 1,
    expiryDays: 90,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'White-label Gallery Customization', 'Client Comments', 'Advanced Analytics', 'Priority Phone Support']
  }
};

// Global variables
let selectedPlan = null;
let currentPlan = null;
let currentUser = null;
let subscriptionData = null;

/**
 * Initialize subscription manager
 */
function initSubscriptionManager() {
  // Check if user is logged in
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      loadUserSubscription();
    }
  });

  // Set up event listeners
  setupEventListeners();
}

/**
 * Set up all event listeners for subscription management
 */
function setupEventListeners() {
  // Plan upgrade button
  const upgradePlanBtn = document.getElementById('upgradePlanBtn');
  if (upgradePlanBtn) {
    upgradePlanBtn.addEventListener('click', showUpgradeModal);
  }

  // Plan tabs in upgrade modal
  document.querySelectorAll('.plan-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      selectedPlan = this.getAttribute('data-plan');
      updatePlanDisplay(selectedPlan);
    });
  });

  // Confirm upgrade button
  const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmUpgradeBtn) {
    confirmUpgradeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (selectedPlan) {
        processPayment(selectedPlan);
      }
    });
  }

  // Cancel upgrade button
  const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
  if (cancelUpgradeBtn) {
    cancelUpgradeBtn.addEventListener('click', hideUpgradeModal);
  }

  // Modal close button
  const closeModalBtn = document.querySelector('#upgradePlanModal .close-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideUpgradeModal);
  }
}

/**
 * Load user subscription data from Firestore
 */
async function loadUserSubscription() {
  try {
    if (!currentUser) return;

    const db = firebase.firestore();
    
    // Get user document
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (!userDoc.exists) return;
    
    const userData = userDoc.data();
    currentPlan = userData.currentPlan || 'free';
    
    // Update UI with current plan
    document.getElementById('currentPlanName').textContent = SUBSCRIPTION_PLANS[currentPlan]?.name || 'Free';
    document.getElementById('planBadge').textContent = SUBSCRIPTION_PLANS[currentPlan]?.name || 'Free';
    
    // Get subscription details
    const subscriptionDoc = await db.collection('subscriptions').doc(currentUser.uid).get();
    if (subscriptionDoc.exists) {
      subscriptionData = subscriptionDoc.data();
      
      // Update storage usage
      updateStorageUsage();
      
      // Update gallery usage
      updateGalleryUsage();
    }
  } catch (error) {
    console.error('Error loading subscription data:', error);
  }
}

/**
 * Show the upgrade plan modal
 */
function showUpgradeModal() {
  const modal = document.getElementById('upgradePlanModal');
  if (modal) {
    modal.style.display = 'block';
    
    // Set default selected plan (Basic)
    document.querySelector('.plan-tab[data-plan="basic"]').click();
  }
}

/**
 * Hide the upgrade plan modal
 */
function hideUpgradeModal() {
  const modal = document.getElementById('upgradePlanModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Update plan display in the modal
 */
function updatePlanDisplay(planType) {
  const planDetails = SUBSCRIPTION_PLANS[planType];
  if (!planDetails) return;

  // Update selected plan display
  document.getElementById('selectedPlanDisplay').textContent = planDetails.name;
  document.getElementById('selectedPlanPrice').textContent = `₹${planDetails.price}/${planDetails.priceType}`;

  // Update features list
  const featuresList = document.getElementById('selectedPlanFeatures');
  featuresList.innerHTML = '';
  planDetails.features.forEach(feature => {
    const li = document.createElement('li');
    li.textContent = feature;
    featuresList.appendChild(li);
  });

  // Update current plan display
  const currentPlanDetails = SUBSCRIPTION_PLANS[currentPlan] || {
    name: 'Free',
    price: 0,
    priceType: 'month',
    features: ['1 GB Storage', '3 Galleries', '50 Photos per gallery', '3-day client selection window']
  };
  
  document.getElementById('currentPlanDisplay').textContent = currentPlanDetails.name;
  document.getElementById('currentPlanPrice').textContent = `₹${currentPlanDetails.price}/${currentPlanDetails.priceType}`;

  // Update current plan features
  const currentFeaturesList = document.getElementById('currentPlanFeatures');
  currentFeaturesList.innerHTML = '';
  currentPlanDetails.features.forEach(feature => {
    const li = document.createElement('li');
    li.textContent = feature;
    currentFeaturesList.appendChild(li);
  });
}

/**
 * Process payment through Razorpay
 */
async function processPayment(planType) {
  try {
    // Show loading state
    showPaymentProgress('Processing your request...');
    
    // Get plan details
    const planDetails = SUBSCRIPTION_PLANS[planType];
    if (!planDetails) {
      throw new Error('Invalid plan selected');
    }
    
    // Create payment order via Firebase function
    const createPaymentOrder = firebase.functions().httpsCallable('createPaymentOrder');
    const result = await createPaymentOrder({
      planType: planType,
      amount: planDetails.price
    });
    
    if (!result.data || !result.data.orderId) {
      throw new Error('Failed to create payment order');
    }
    
    // Initialize Razorpay checkout
    const options = {
      key: 'rzp_test_EF3W5mVXB1Q3li', // Replace with your Razorpay key
      amount: result.data.amount * 100, // Amount is in paisa
      currency: result.data.currency || 'INR',
      name: 'SnapSelect',
      description: `Upgrade to ${planDetails.name} Plan`,
      image: '../assets/images/snapselect-logo.png',
      order_id: result.data.orderId,
      handler: function(response) {
        // Handle successful payment
        verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
      },
      prefill: {
        name: document.getElementById('userName').textContent,
        email: currentUser.email || ''
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

/**
 * Verify payment with Firebase function
 */
async function verifyPayment(orderId, paymentId, signature) {
  try {
    showPaymentProgress('Verifying payment...');
    
    const verifyPaymentFunc = firebase.functions().httpsCallable('verifyPayment');
    const result = await verifyPaymentFunc({
      orderId: orderId,
      paymentId: paymentId,
      signature: signature
    });
    
    if (result.data && result.data.success) {
      // Payment successful
      showPaymentSuccess(`Payment successful! Your subscription has been upgraded to ${result.data.planType}.`);
      
      // Update UI
      setTimeout(() => {
        hideUpgradeModal();
        // Refresh user subscription data
        loadUserSubscription();
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

/**
 * Show payment progress message
 */
function showPaymentProgress(message) {
  document.querySelector('.payment-success').style.display = 'none';
  document.querySelector('.payment-error').style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
}

/**
 * Show payment success message
 */
function showPaymentSuccess(message) {
  const successEl = document.querySelector('.payment-success');
  successEl.textContent = message;
  successEl.style.display = 'block';
  
  document.querySelector('.payment-error').style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = false;
  confirmBtn.innerHTML = 'Upgrade Complete!';
}

/**
 * Show payment error message
 */
function showPaymentError(message) {
  const errorEl = document.querySelector('.payment-error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  
  document.querySelector('.payment-success').style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = false;
  confirmBtn.innerHTML = 'Try Again';
}

/**
 * Hide payment progress
 */
function hidePaymentProgress() {
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = false;
  confirmBtn.innerHTML = 'Upgrade Now';
}

/**
 * Update storage usage display
 */
function updateStorageUsage() {
  // Get current storage usage
  const storageEl = document.getElementById('storageUsed');
  const storageText = storageEl.textContent;
  const storage = parseFloat(storageText.replace(/[^0-9.]/g, ''));
  
  // Get storage limit from subscription
  const storageLimit = subscriptionData?.storageLimit || 1; // Default to 1GB for free plan
  
  // Calculate percentage
  const usagePercent = Math.min((storage / (storageLimit * 1000)) * 100, 100);
  
  // Update UI
  document.getElementById('storageUsageBar').style.width = `${usagePercent}%`;
  document.getElementById('storageUsageText').textContent = `${storage}/${storageLimit} GB`;
  
  // Add warning class if usage is high
  if (usagePercent > 90) {
    document.getElementById('storageUsageBar').classList.add('high-usage');
  } else {
    document.getElementById('storageUsageBar').classList.remove('high-usage');
  }
}

/**
 * Update gallery usage display
 */
function updateGalleryUsage() {
  // Get current galleries count
  const galleriesEl = document.getElementById('activeGalleriesCount');
  const galleries = parseInt(galleriesEl.textContent);
  
  // Get gallery limit from subscription
  const galleryLimit = subscriptionData?.galleryLimit || 3; // Default to 3 for free plan
  
  // Calculate percentage
  const usagePercent = Math.min((galleries / galleryLimit) * 100, 100);
  
  // Update UI
  document.getElementById('galleryUsageBar').style.width = `${usagePercent}%`;
  document.getElementById('galleryUsageText').textContent = `${galleries}/${galleryLimit}`;
  
  // Add warning class if usage is high
  if (usagePercent > 90) {
    document.getElementById('galleryUsageBar').classList.add('high-usage');
  } else {
    document.getElementById('galleryUsageBar').classList.remove('high-usage');
  }
}

// Initialize the subscription manager when the document is ready
document.addEventListener('DOMContentLoaded', function() {
  initSubscriptionManager();
});

// Export functions for use in other modules
window.subscriptionManager = {
  refreshSubscription: loadUserSubscription,
  getPlanDetails: (planType) => SUBSCRIPTION_PLANS[planType] || null,
  getCurrentPlan: () => currentPlan,
  showUpgradeModal: showUpgradeModal
};
