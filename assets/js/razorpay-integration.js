/**
 * razorpay-integration.js - Handles Razorpay payment gateway integration for SnapSelect
 */

// Wait for Firebase to be fully loaded and initialized
let firebaseReady = false;
let firebaseCheckInterval;

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

document.addEventListener('DOMContentLoaded', function() {
    // Load Razorpay script if not available
    if (typeof Razorpay === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = setupRazorpayEventListeners;
        document.body.appendChild(script);
    } else {
        setupRazorpayEventListeners();
    }
});

function setupRazorpayEventListeners() {
    const paymentForm = document.getElementById('paymentForm');
    const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
    
    if (paymentForm) {
        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (window.securityManager?.validatePaymentForm && !window.securityManager.validatePaymentForm()) {
                return;
            }
            
            if (confirmUpgradeBtn) {
                confirmUpgradeBtn.disabled = true;
                confirmUpgradeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }
            
            const activeTab = document.querySelector('.plan-tab.active');
            if (!activeTab) {
                showPaymentError('No plan selected. Please select a plan to continue.');
                resetButton();
                return;
            }
            
            const planType = activeTab.getAttribute('data-plan');
            const planPrice = SUBSCRIPTION_PLANS[planType].price;
            createRazorpayOrder(planType, planPrice);
        });
    }
    console.log('Razorpay integration initialized');
}

async function createRazorpayOrder(planType, amount) {
    try {
        // Ensure Firebase is ready before proceeding
        await ensureFirebaseIsReady();
    
        // Make sure user is authenticated
        if (!firebase.auth().currentUser) {
            throw new Error('Please log in to continue');
        }
        
        // Explicitly use the asia-south1 region
        const functionsInstance = firebase.app().functions('asia-south1');
        console.log('Using asia-south1 region for functions');
        
        console.log('Creating Razorpay order for plan:', planType, 'amount:', amount);
        
        // Call the function to create order
        const createPaymentOrderFn = functionsInstance.httpsCallable('createPaymentOrder');
        const result = await createPaymentOrderFn({
            planType: planType,
            amount: amount
        });
        
        console.log('Order creation result:', result);
        
        // Get order data from result
        const orderData = result.data;
        
        if (!orderData || !orderData.orderId) {
            throw new Error('Failed to create order. Please try again.');
        }
        
        // Open Razorpay checkout
        openRazorpayCheckout(orderData.orderId, amount, planType);
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        showPaymentError(error.code?.startsWith('functions/') 
            ? `Payment service error: ${error.message}. Please try again later.` 
            : `Failed to create order: ${error.message}`);
        resetButton();
    }
}

function openRazorpayCheckout(orderId, amount, planType) {
    try {
        const userName = document.getElementById('userName')?.textContent || '';
        const userEmail = getUserEmail();
        
        const options = {
            key: 'rzp_test_EF3W5mVXB1Q3li',
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            name: 'SnapSelect',
            description: `Upgrade to ${SUBSCRIPTION_PLANS[planType].name} Plan`,
            order_id: orderId,
            handler: response => handleRazorpaySuccess(response, planType, amount),
            prefill: { name: userName, email: userEmail },
            notes: { planType },
            theme: { color: '#6366f1' },
            modal: { ondismiss: resetButton }
        };
        
        new Razorpay(options).open();
        window.analyticsManager?.trackEvent?.('checkout_started', { planType, amount });
    } catch (error) {
        console.error('Error opening Razorpay checkout:', error);
        showPaymentError(`Failed to open checkout: ${error.message}`);
        resetButton();
    }
}

async function handleRazorpaySuccess(response, planType, amount) {
    try {
        // Ensure Firebase is ready
        await ensureFirebaseIsReady();
        
        // Update UI
        const confirmButton = document.getElementById('confirmUpgradeBtn');
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying payment...';
        }
        
        // Explicitly use the asia-south1 region
        const functionsInstance = firebase.app().functions('asia-south1');
        console.log('Using asia-south1 region for payment verification');
        
        console.log('Verifying payment:', {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id
        });
        
        // Verify payment signature
        const verifyPaymentFn = functionsInstance.httpsCallable('verifyPayment');
        const verificationResult = await verifyPaymentFn({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature
        });
        
        const verificationData = verificationResult.data;
        
        if (!verificationData || !verificationData.success) {
            throw new Error('Payment verification failed. Please contact support.');
        }
        
        console.log('Payment verified successfully:', verificationData);
        
        // Track analytics event
        window.analyticsManager?.trackEvent?.('payment_success', {
            planType, amount, paymentId: response.razorpay_payment_id
        });
        
        // Show success message
        showPaymentSuccess(planType);
        
        // Close modal after delay
        setTimeout(() => {
            closeUpgradePlanModal();
            if (window.subscriptionManager?.loadSubscriptionData) {
                window.subscriptionManager.loadSubscriptionData();
            } else {
                setTimeout(() => window.location.reload(), 1000);
            }
        }, 2000);
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        showPaymentError(error.code?.startsWith('functions/') 
            ? `Payment verification error: ${error.message}. Please contact support.` 
            : `Failed to verify payment: ${error.message}`);
        resetButton();
    }
}

function resetButton() {
    const confirmButton = document.getElementById('confirmUpgradeBtn');
    if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Upgrade Now';
    }
}

function showPaymentError(message) {
    let errorElement = document.querySelector('.payment-error');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'payment-error alert-danger';
        
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            paymentSection.insertBefore(errorElement, paymentSection.firstChild);
        } else {
            alert(`Error: ${message}`);
            return;
        }
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => errorElement.style.display = 'none', 5000);
}

function showPaymentSuccess(planType) {
    let successElement = document.querySelector('.payment-success');
    
    if (!successElement) {
        successElement = document.createElement('div');
        successElement.className = 'payment-success alert-success';
        
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            paymentSection.insertBefore(successElement, paymentSection.firstChild);
        } else {
            alert(`Payment successful! Your account has been upgraded to ${SUBSCRIPTION_PLANS[planType].name} plan.`);
            return;
        }
    }
    
    successElement.innerHTML = `
        <i class="fas fa-check-circle"></i> 
        Payment successful! Your account has been upgraded to 
        <strong>${SUBSCRIPTION_PLANS[planType].name}</strong> plan.
    `;
    successElement.style.display = 'block';
}

function getUserEmail() {
    return firebase.auth()?.currentUser?.email || localStorage.getItem('userEmail') || '';
}

// Make functions available globally
window.razorpayIntegration = {
    createRazorpayOrder,
    openRazorpayCheckout,
    handleRazorpaySuccess
};
