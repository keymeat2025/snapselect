// razorpay-integration.js - Client-side integration for Razorpay

// Global variables
let selectedPlan = null;
let currentPlan = null;

// Initialize Razorpay integration
function initRazorpayIntegration() {
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

// Process payment through Razorpay
async function processPayment(planType) {
  try {
    // Show loading state
    showPaymentProgress('Processing your request...');
    
    // Get plan details using global SUBSCRIPTION_PLANS object
    const planDetails = window.SUBSCRIPTION_PLANS[planType];
    if (!planDetails) {
      throw new Error('Invalid plan selected');
    }
    
    // Get Firebase Functions from window.firebaseServices
    const functions = window.firebaseServices.functions;
    if (!functions) {
      throw new Error('Payment service is not available at the moment. Please try again later.');
    }
    
    // Create payment order via Firebase function
    const createPaymentOrder = functions.httpsCallable('createPaymentOrder');
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
    
    // Get Firebase Functions from window.firebaseServices
    const functions = window.firebaseServices.functions;
    if (!functions) {
      throw new Error('Verification service is not available at the moment. Please contact support.');
    }
    
    const verifyPaymentFunc = functions.httpsCallable('verifyPayment');
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

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
  initRazorpayIntegration();
});
