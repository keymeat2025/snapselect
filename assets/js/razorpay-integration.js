// razorpay-integration.js - Client-side integration for Razorpay

// Global variables
let selectedPlan = null;
let currentPlan = null;
let firebaseFunctions = null;

// Firebase configuration - Replace with your actual Firebase project details


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCAl15Yq8Y727PKknJNs0Q8UZbRRbcWkMo",
  authDomain: "snapselect01-eb74c.firebaseapp.com",
  projectId: "snapselect01-eb74c",
  storageBucket: "snapselect01-eb74c.firebasestorage.app",
  messagingSenderId: "749450852067",
  appId: "1:749450852067:web:8b1887075d607b3e91f7d6",
  measurementId: "G-J5XGE71VF6"
};

// Initialize Razorpay integration
function initRazorpayIntegration() {
  // Initialize Firebase app if not already initialized
  initializeFirebase();
  
  // Initialize Firebase Functions with India region
  initFirebaseFunctions();

  // Event listener for plan tabs
  document.querySelectorAll('.plan-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs
      document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Update selected plan
      selectedPlan = this.getAttribute('data-plan');
      updatePlanDisplay(selectedPlan);
    });
  });

  // Event listener for upgrade button
  document.getElementById('upgradePlanBtn').addEventListener('click', function() {
    // Get current plan from the UI
    currentPlan = document.getElementById('currentPlanName').textContent;
    
    // Show upgrade modal
    const modal = document.getElementById('upgradePlanModal');
    modal.style.display = 'block';
    
    // Set default selected plan (Basic)
    document.querySelector('.plan-tab[data-plan="basic"]').click();
  });

  // Event listener for confirm upgrade button
  document.getElementById('confirmUpgradeBtn').addEventListener('click', function(e) {
    e.preventDefault();
    if (selectedPlan) {
      processPayment(selectedPlan);
    }
  });

  // Event listener for cancel button
  document.getElementById('cancelUpgradeBtn').addEventListener('click', function() {
    const modal = document.getElementById('upgradePlanModal');
    modal.style.display = 'none';
  });

  // Event listener for modal close button
  document.querySelector('#upgradePlanModal .close-modal').addEventListener('click', function() {
    const modal = document.getElementById('upgradePlanModal');
    modal.style.display = 'none';
  });
}

// Initialize Firebase
function initializeFirebase() {
  try {
    // Check if Firebase is already initialized
    if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
      console.log('Firebase already initialized');
      return firebase.app();
    }
    
    // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
    return app;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return null;
  }
}

// Initialize Firebase Functions with India region
function initFirebaseFunctions() {
  try {
    // Check if firebase is available
    if (typeof firebase !== 'undefined' && firebase.app) {
      // Set India region for Firebase Functions
      if (typeof firebase.functions === 'function') {
        firebaseFunctions = firebase.functions();
        // Set the region to asia-south1 (Mumbai) for India
        firebaseFunctions.useRegion('asia-south1');
        console.log('Firebase Functions initialized with India region');
      } else {
        console.error('Firebase Functions SDK is not loaded properly');
        // Try to load Firebase Functions SDK if it's not available
        loadFirebaseFunctionsSDK();
      }
    } else {
      console.error('Firebase is not initialized properly');
      // Try to initialize Firebase
      initializeFirebase();
    }
  } catch (error) {
    console.error('Error initializing Firebase Functions:', error);
  }
}

// Load Firebase Functions SDK dynamically if not available
function loadFirebaseFunctionsSDK() {
  try {
    // Check if the script is already loaded
    if (document.querySelector('script[src*="firebase-functions"]')) {
      return;
    }
    
    // Create script element
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/9.6.0/firebase-functions.js';
    script.onload = function() {
      console.log('Firebase Functions SDK loaded successfully');
      // Try to initialize Firebase Functions again
      initFirebaseFunctions();
    };
    script.onerror = function() {
      console.error('Failed to load Firebase Functions SDK');
    };
    
    // Append to head
    document.head.appendChild(script);
  } catch (error) {
    console.error('Error loading Firebase Functions SDK:', error);
  }
}

// Update plan display in the UI
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
  const currentPlanDetails = SUBSCRIPTION_PLANS[currentPlan.toLowerCase()] || SUBSCRIPTION_PLANS.lite;
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

// Process payment through Razorpay
async function processPayment(planType) {
  try {
    // Show loading state
    showPaymentProgress('Processing your request...');
    
    // Get plan details
    const planDetails = SUBSCRIPTION_PLANS[planType];
    if (!planDetails) {
      throw new Error('Invalid plan selected');
    }
    
    // Check if Firebase Functions is available
    if (!firebaseFunctions) {
      // Try to initialize Firebase Functions again
      initFirebaseFunctions();
      
      // If still not available, throw error
      if (!firebaseFunctions) {
        throw new Error('Payment service is not available at the moment. Please try again later.');
      }
    }
    
    // Create payment order via Firebase function
    const createPaymentOrder = firebaseFunctions.httpsCallable('createPaymentOrder');
    const result = await createPaymentOrder({
      planType: planType,
      amount: planDetails.price,
      currency: 'INR', // Explicitly set currency to INR for India
      timezone: 'Asia/Kolkata' // Set timezone for India
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
        email: localStorage.getItem('userEmail') || ''
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

// Verify payment with Firebase function
async function verifyPayment(orderId, paymentId, signature) {
  try {
    showPaymentProgress('Verifying payment...');
    
    // Check if Firebase Functions is available
    if (!firebaseFunctions) {
      // Try to initialize Firebase Functions again
      initFirebaseFunctions();
      
      // If still not available, throw error
      if (!firebaseFunctions) {
        throw new Error('Verification service is not available at the moment. Please contact support.');
      }
    }
    
    const verifyPaymentFunc = firebaseFunctions.httpsCallable('verifyPayment');
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
        document.getElementById('upgradePlanModal').style.display = 'none';
        // Refresh user subscription data
        refreshSubscriptionData();
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

// Refresh subscription data from Firestore
async function refreshSubscriptionData() {
  try {
    // Get user ID
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    // Get subscription data
    const db = firebase.firestore();
    const subscriptionDoc = await db.collection('subscriptions').doc(user.uid).get();
    
    if (subscriptionDoc.exists) {
      const subData = subscriptionDoc.data();
      
      // Update UI with new plan data
      document.getElementById('currentPlanName').textContent = subData.planType || 'Free';
      document.getElementById('planBadge').textContent = SUBSCRIPTION_PLANS[subData.planType]?.name || 'Free';
      
      // Update storage usage
      updateStorageUsage(subData.storageLimit || 1);
      
      // Update gallery usage
      updateGalleryUsage(subData.galleryLimit || 3);
      
      // Format date in Indian format (DD/MM/YYYY)
      if (subData.expiryDate) {
        const expiryDate = subData.expiryDate.toDate ? subData.expiryDate.toDate() : new Date(subData.expiryDate);
        const formattedDate = formatDateInIndianFormat(expiryDate);
        document.getElementById('subscriptionExpiryDate').textContent = formattedDate;
      }
    }
  } catch (error) {
    console.error('Error refreshing subscription data:', error);
  }
}

// Format date in Indian format (DD/MM/YYYY)
function formatDateInIndianFormat(date) {
  if (!date || !(date instanceof Date)) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

// Show payment progress message
function showPaymentProgress(message) {
  document.querySelector('.payment-success').style.display = 'none';
  document.querySelector('.payment-error').style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
}

// Show payment success message
function showPaymentSuccess(message) {
  const successEl = document.querySelector('.payment-success');
  successEl.textContent = message;
  successEl.style.display = 'block';
  
  document.querySelector('.payment-error').style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = false;
  confirmBtn.innerHTML = 'Upgrade Complete!';
}

// Show payment error message
function showPaymentError(message) {
  const errorEl = document.querySelector('.payment-error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  
  document.querySelector('.payment-success').style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = false;
  confirmBtn.innerHTML = 'Try Again';
}

// Hide payment progress
function hidePaymentProgress() {
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  confirmBtn.disabled = false;
  confirmBtn.innerHTML = 'Upgrade Now';
}

// Update storage usage display
function updateStorageUsage(limit) {
  const storage = parseFloat(document.getElementById('storageUsed').textContent);
  const usagePercent = Math.min((storage / (limit * 1000)) * 100, 100);
  
  document.getElementById('storageUsageBar').style.width = `${usagePercent}%`;
  document.getElementById('storageUsageText').textContent = `${storage}/${limit} GB`;
}

// Update gallery usage display
function updateGalleryUsage(limit) {
  const galleries = parseInt(document.getElementById('activeGalleriesCount').textContent);
  const usagePercent = Math.min((galleries / limit) * 100, 100);
  
  document.getElementById('galleryUsageBar').style.width = `${usagePercent}%`;
  document.getElementById('galleryUsageText').textContent = `${galleries}/${limit}`;
}

// Subscription plans data (matching the server-side data)
const SUBSCRIPTION_PLANS = {
  lite: {
    name: 'Lite',
    price: 79,
    priceType: 'per client',
    storageLimit: 2, // GB
    galleryLimit: 1,
    photosPerGallery: 100,
    features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature']
  },
  mini: {
    name: 'Mini',
    price: 149,
    priceType: 'per client',
    storageLimit: 5, // GB
    galleryLimit: 1,
    photosPerGallery: 200,
    features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Basic Gallery Customization']
  },
  basic: {
    name: 'Basic',
    price: 399,
    priceType: 'per client',
    storageLimit: 15, // GB
    galleryLimit: 1,
    photosPerGallery: 500,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Custom branding', 'Basic Analytics']
  },
  pro: {
    name: 'Pro',
    price: 799,
    priceType: 'per client',
    storageLimit: 25, // GB
    galleryLimit: 1,
    photosPerGallery: 800,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Advanced Gallery Customization', 'Client Comments', 'Detailed Analytics']
  },
  premium: {
    name: 'Premium',
    price: 1499,
    priceType: 'per client',
    storageLimit: 50, // GB
    galleryLimit: 1,
    photosPerGallery: 1200,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Complete Gallery Customization', 'Client Comments', 'Detailed Analytics', 'Priority Support']
  },
  ultimate: {
    name: 'Ultimate',
    price: 2999,
    priceType: 'per client',
    storageLimit: 100, // GB
    galleryLimit: 2,
    photosPerGallery: 1250,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'White-label Gallery Customization', 'Client Comments', 'Advanced Analytics', 'Priority Phone Support']
  }
};

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
  initRazorpayIntegration();
});
