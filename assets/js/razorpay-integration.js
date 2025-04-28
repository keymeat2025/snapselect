/**
 * razorpay-integration.js
 * Handles Razorpay payment gateway integration for SnapSelect
 */

// Initialize module
document.addEventListener('DOMContentLoaded', function() {
    initRazorpayIntegration();
});

/**
 * Initialize Razorpay integration
 */
function initRazorpayIntegration() {
    // Check if Razorpay script is loaded
    if (typeof Razorpay === 'undefined') {
        // Load Razorpay script
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = setupRazorpayEventListeners;
        document.body.appendChild(script);
    } else {
        setupRazorpayEventListeners();
    }
}

/**
 * Setup event listeners for Razorpay integration
 */
function setupRazorpayEventListeners() {
    // Override the payment form submission
    const paymentForm = document.getElementById('paymentForm');
    const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
    
    if (paymentForm) {
        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Validate the form
            if (window.securityManager && window.securityManager.validatePaymentForm) {
                const isValid = window.securityManager.validatePaymentForm();
                if (!isValid) {
                    return;
                }
            }
            
            // Show loading state
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
            
            const planType = activeTab.getAttribute('data-plan');
            const planPrice = SUBSCRIPTION_PLANS[planType].price;
            
            // Create Razorpay order
            createRazorpayOrder(planType, planPrice);
        });
    }
    
    console.log('Razorpay integration initialized');
}

/**
 * Create a Razorpay order
 */
async function createRazorpayOrder(planType, amount) {
    try {
        // Check if Firebase functions are available
        if (!firebase.functions) {
            throw new Error('Firebase functions not available. Please try again later.');
        }
        
        // Reference to Firebase function
        const createPaymentOrderFn = firebase.app().functions('asia-south1').httpsCallable('createPaymentOrder');
        
        // Call the function
        const result = await createPaymentOrderFn({
            planType: planType,
            amount: amount
        });
        
        // Get order data from result
        const orderData = result.data;
        
        if (!orderData || !orderData.orderId) {
            throw new Error('Failed to create order. Please try again.');
        }
        
        // Open Razorpay checkout
        openRazorpayCheckout(orderData.orderId, amount, planType);
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        showPaymentError(`Failed to create order: ${error.message}`);
        resetButton();
    }
}

/**
 * Open Razorpay checkout
 */
function openRazorpayCheckout(orderId, amount, planType) {
    try {
        // Get user information
        const userName = document.getElementById('userName') ? document.getElementById('userName').textContent : '';
        const userEmail = getUserEmail();
        
        // Configure Razorpay options
        const options = {
            key: 'rzp_test_EF3W5mVXB1Q3li', // Replace with environment variable in production
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            name: 'SnapSelect',
            description: `Upgrade to ${SUBSCRIPTION_PLANS[planType].name} Plan`,
            order_id: orderId,
            handler: function(response) {
                // Handle successful payment
                handleRazorpaySuccess(response, planType, amount);
            },
            prefill: {
                name: userName,
                email: userEmail
            },
            notes: {
                planType: planType
            },
            theme: {
                color: '#6366f1' // Match your site's primary color
            },
            modal: {
                ondismiss: function() {
                    // Handle dismissal
                    console.log('Checkout form closed');
                    resetButton();
                }
            }
        };
        
        // Initialize Razorpay checkout
        const razorpayCheckout = new Razorpay(options);
        
        // Open checkout
        razorpayCheckout.open();
        
        // Track analytics event
        if (window.analyticsManager && window.analyticsManager.trackEvent) {
            window.analyticsManager.trackEvent('checkout_started', {
                planType: planType,
                amount: amount
            });
        }
    } catch (error) {
        console.error('Error opening Razorpay checkout:', error);
        showPaymentError(`Failed to open checkout: ${error.message}`);
        resetButton();
    }
}

/**
 * Handle successful Razorpay payment
 */
async function handleRazorpaySuccess(response, planType, amount) {
    try {
        // Show processing state
        const confirmButton = document.getElementById('confirmUpgradeBtn');
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying payment...';
        }
        
        // Verify payment signature
        const verifyPaymentFn = firebase.app().functions('asia-south1').httpsCallable('verifyPayment');
        
        const verificationResult = await verifyPaymentFn({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature
        });
        
        const verificationData = verificationResult.data;
        
        if (!verificationData || !verificationData.success) {
            throw new Error('Payment verification failed. Please contact support.');
        }
        
        // Track analytics event
        if (window.analyticsManager && window.analyticsManager.trackEvent) {
            window.analyticsManager.trackEvent('payment_success', {
                planType: planType,
                amount: amount,
                paymentId: response.razorpay_payment_id
            });
        }
        
        // Show success message
        showPaymentSuccess(planType);
        
        // Close modal after delay
        setTimeout(() => {
            closeUpgradePlanModal();
            
            // Reload subscription data
            if (window.subscriptionManager && window.subscriptionManager.loadSubscriptionData) {
                window.subscriptionManager.loadSubscriptionData();
            } else {
                // Fallback: reload page after delay
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        }, 2000);
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        showPaymentError(`Failed to verify payment: ${error.message}`);
        resetButton();
    }
}

/**
 * Reset payment button
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
 */
function showPaymentError(message) {
    // Check if error element exists, create if not
    let errorElement = document.querySelector('.payment-error');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'payment-error alert-danger';
        
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            paymentSection.insertBefore(errorElement, paymentSection.firstChild);
        } else {
            // Fallback - use alert
            alert(`Error: ${message}`);
            return;
        }
    }
    
    // Set error message and show
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

/**
 * Show payment success message
 */
function showPaymentSuccess(planType) {
    // Create success element if not exists
    let successElement = document.querySelector('.payment-success');
    
    if (!successElement) {
        successElement = document.createElement('div');
        successElement.className = 'payment-success alert-success';
        
        const paymentSection = document.querySelector('.payment-section');
        if (paymentSection) {
            paymentSection.insertBefore(successElement, paymentSection.firstChild);
        } else {
            // Fallback - use alert
            alert(`Payment successful! Your account has been upgraded to ${SUBSCRIPTION_PLANS[planType].name} plan.`);
            return;
        }
    }
    
    // Set success message and show
    successElement.innerHTML = `
        <i class="fas fa-check-circle"></i> 
        Payment successful! Your account has been upgraded to 
        <strong>${SUBSCRIPTION_PLANS[planType].name}</strong> plan.
    `;
    successElement.style.display = 'block';
}

/**
 * Get user email from various sources
 */
function getUserEmail() {
    // Try to get from auth
    if (firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser.email || '';
    }
    
    // Fallback to localStorage
    return localStorage.getItem('userEmail') || '';
}

// Make Razorpay integration available globally
window.razorpayIntegration = {
    createRazorpayOrder,
    openRazorpayCheckout,
    handleRazorpaySuccess
};
