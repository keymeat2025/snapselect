/**
 * Razorpay Integration for SnapSelect
 * This file handles the client-side integration with Razorpay payment gateway
 * and communicates with Firebase Cloud Functions for payment processing.
 */

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get references to the upgrade plan button and modal
    const upgradePlanBtn = document.getElementById('upgradePlanBtn');
    const upgradePlanModal = document.getElementById('upgradePlanModal');
    const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
    const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    // Plan selection tabs
    const planTabs = document.querySelectorAll('.plan-tab');
    
    // Payment success/error message containers
    const paymentSuccessDiv = document.querySelector('.payment-success');
    const paymentErrorDiv = document.querySelector('.payment-error');
    
    // Current selected plan data
    let selectedPlan = {
        type: 'basic',
        name: 'Basic',
        price: 399,
        features: []
    };
    
    // Plan data - should match the plans in your Firebase function
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
            galleryLimit: 11,
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

    // Open upgrade plan modal when upgrade button is clicked
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', function() {
            // Initialize with the current plan from user data
            initializeUpgradeModal();
            upgradePlanModal.style.display = 'flex';
        });
    }

    // Close modal when cancel button is clicked
    if (cancelUpgradeBtn) {
        cancelUpgradeBtn.addEventListener('click', function() {
            upgradePlanModal.style.display = 'none';
            // Clear any payment messages
            clearPaymentMessages();
        });
    }

    // Close modal when X button is clicked
    closeModalBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                // Clear any payment messages
                clearPaymentMessages();
            }
        });
    });

    // Plan tab selection
    if (planTabs) {
        planTabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                planTabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Update selected plan
                const planType = tab.getAttribute('data-plan');
                updateSelectedPlan(planType);
            });
        });
    }

    // Initialize upgrade modal with user data and current plan
    function initializeUpgradeModal() {
        // Get current user data from Firebase Auth
        const user = firebase.auth().currentUser;
        if (!user) {
            console.error('User not authenticated');
            return;
        }

        // Get user's current plan from Firestore
        firebase.firestore().collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const currentPlanType = userData.currentPlan || 'lite';
                    
                    // Set current plan display
                    const currentPlan = SUBSCRIPTION_PLANS[currentPlanType] || SUBSCRIPTION_PLANS.lite;
                    document.getElementById('currentPlanDisplay').textContent = currentPlan.name;
                    document.getElementById('currentPlanPrice').textContent = `₹${currentPlan.price}/${currentPlan.priceType}`;
                    
                    // Populate current plan features
                    const currentPlanFeaturesList = document.getElementById('currentPlanFeatures');
                    if (currentPlanFeaturesList) {
                        currentPlanFeaturesList.innerHTML = '';
                        currentPlan.features.forEach(feature => {
                            const li = document.createElement('li');
                            li.textContent = feature;
                            currentPlanFeaturesList.appendChild(li);
                        });
                    }
                    
                    // Find the right tab to activate (default to basic if coming from free)
                    const initialPlanType = currentPlanType === 'lite' ? 'basic' : getNextPlanType(currentPlanType);
                    
                    // Reset all tabs
                    planTabs.forEach(t => t.classList.remove('active'));
                    
                    // Set the active tab
                    const activeTab = document.querySelector(`.plan-tab[data-plan="${initialPlanType}"]`);
                    if (activeTab) {
                        activeTab.classList.add('active');
                    }
                    
                    // Update selected plan display
                    updateSelectedPlan(initialPlanType);
                } else {
                    console.error('User document not found');
                    // Default to showing the basic plan
                    updateSelectedPlan('basic');
                }
            })
            .catch(error => {
                console.error('Error getting user data:', error);
                // Default to showing the basic plan
                updateSelectedPlan('basic');
            });
    }

    // Update the selected plan display
    function updateSelectedPlan(planType) {
        const plan = SUBSCRIPTION_PLANS[planType];
        if (!plan) {
            console.error('Invalid plan type:', planType);
            return;
        }
        
        // Update selected plan data
        selectedPlan = {
            type: planType,
            name: plan.name,
            price: plan.price,
            features: plan.features
        };
        
        // Update UI with selected plan details
        document.getElementById('selectedPlanDisplay').textContent = plan.name;
        document.getElementById('selectedPlanPrice').textContent = `₹${plan.price}/${plan.priceType}`;
        
        // Update features list
        const selectedPlanFeaturesList = document.getElementById('selectedPlanFeatures');
        if (selectedPlanFeaturesList) {
            selectedPlanFeaturesList.innerHTML = '';
            plan.features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                selectedPlanFeaturesList.appendChild(li);
            });
        }
    }

    // Get the next higher plan type
    function getNextPlanType(currentPlanType) {
        const planOrder = ['lite', 'mini', 'basic', 'pro', 'premium', 'ultimate'];
        const currentIndex = planOrder.indexOf(currentPlanType);
        
        if (currentIndex === -1 || currentIndex === planOrder.length - 1) {
            return 'basic'; // Default to basic if current plan not found or already at highest
        }
        
        return planOrder[currentIndex + 1];
    }

    // Clear payment success/error messages
    function clearPaymentMessages() {
        if (paymentSuccessDiv) paymentSuccessDiv.style.display = 'none';
        if (paymentErrorDiv) paymentErrorDiv.style.display = 'none';
    }

    // Show payment success message
    function showPaymentSuccess(message) {
        if (paymentSuccessDiv) {
            paymentSuccessDiv.textContent = message;
            paymentSuccessDiv.style.display = 'block';
            
            // Scroll to message if needed
            paymentSuccessDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Show payment error message
    function showPaymentError(message) {
        if (paymentErrorDiv) {
            paymentErrorDiv.textContent = message;
            paymentErrorDiv.style.display = 'block';
            
            // Scroll to message if needed
            paymentErrorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Process payment when confirm upgrade button is clicked
    if (confirmUpgradeBtn) {
        confirmUpgradeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Clear any previous messages
            clearPaymentMessages();
            
            // Get current user
            const user = firebase.auth().currentUser;
            if (!user) {
                showPaymentError('You must be logged in to upgrade your plan.');
                return;
            }
            
            // Disable button to prevent multiple clicks
            confirmUpgradeBtn.disabled = true;
            confirmUpgradeBtn.textContent = 'Processing...';
            
            // Create order using Firebase function
            createRazorpayOrder(selectedPlan.type, selectedPlan.price, user)
                .then(orderData => {
                    // If order created successfully, open Razorpay checkout
                    openRazorpayCheckout(orderData, user);
                })
                .catch(error => {
                    console.error('Error creating order:', error);
                    showPaymentError('Failed to create payment order. Please try again.');
                    
                    // Re-enable button
                    confirmUpgradeBtn.disabled = false;
                    confirmUpgradeBtn.textContent = 'Upgrade Now';
                });
        });
    }

    // Create Razorpay order using Firebase function
    function createRazorpayOrder(planType, amount, user) {
        // Get Firebase functions instance
        const createPaymentOrderFn = firebase.functions().httpsCallable('createPaymentOrder');
        
        // Call the function with plan details
        return createPaymentOrderFn({
            planType: planType,
            amount: amount
        })
        .then(result => {
            // Return order data from function result
            return result.data;
        });
    }

    // Open Razorpay checkout with order details
    function openRazorpayCheckout(orderData, user) {
        // Configure Razorpay options
        const options = {
            key: 'rzp_test_EF3W5mVXB1Q3li', // Your Razorpay Key ID
            amount: orderData.amount * 100, // Amount in smallest currency unit (paise)
            currency: orderData.currency || 'INR',
            name: 'SnapSelect',
            description: `Upgrade to ${selectedPlan.name} Plan`,
            order_id: orderData.orderId,
            image: '../assets/images/snapselect-logo.png', // Your logo
            prefill: {
                name: user.displayName || '',
                email: user.email || '',
                contact: '' // You can fetch this from user profile if available
            },
            notes: {
                userId: user.uid,
                planType: selectedPlan.type
            },
            theme: {
                color: '#6366f1' // Your brand color
            },
            modal: {
                ondismiss: function() {
                    // Handle modal dismiss
                    console.log('Checkout form closed');
                    confirmUpgradeBtn.disabled = false;
                    confirmUpgradeBtn.textContent = 'Upgrade Now';
                }
            },
            handler: function(response) {
                // This function executes when payment is successful
                handlePaymentSuccess(response, orderData);
            }
        };

        // Initialize Razorpay checkout
        const rzp = new Razorpay(options);
        
        // Open checkout modal
        rzp.open();
        
        // Handle checkout errors
        rzp.on('payment.failed', function(response) {
            console.error('Payment failed:', response.error);
            handlePaymentFailure(response.error);
        });
    }

    // Handle successful payment
    function handlePaymentSuccess(response, orderData) {
        console.log('Payment successful:', response);
        
        // Show processing message
        showPaymentSuccess('Payment successful! Verifying your payment...');
        
        // Call Firebase function to verify payment
        const verifyPaymentFn = firebase.functions().httpsCallable('verifyPayment');
        
        verifyPaymentFn({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature
        })
        .then(result => {
            if (result.data && result.data.success) {
                // Payment verified successfully
                handleVerificationSuccess(result.data);
            } else {
                // Verification failed
                throw new Error('Payment verification failed');
            }
        })
        .catch(error => {
            console.error('Verification error:', error);
            showPaymentError('Payment verification failed. Please contact support if your account was charged.');
            
            // Re-enable button
            confirmUpgradeBtn.disabled = false;
            confirmUpgradeBtn.textContent = 'Upgrade Now';
        });
    }

    // Handle payment verification success
    function handleVerificationSuccess(data) {
        console.log('Verification successful:', data);
        
        // Show success message
        showPaymentSuccess(`Payment verified successfully! Your account has been upgraded to ${data.planType || selectedPlan.name} plan.`);
        
        // Disable upgrade button
        confirmUpgradeBtn.disabled = true;
        confirmUpgradeBtn.textContent = 'Upgraded!';
        
        // Reload user data after short delay
        setTimeout(() => {
            // Refresh page to reflect new plan (or update UI without refresh)
            window.location.reload();
        }, 3000);
    }

    // Handle payment failure
    function handlePaymentFailure(error) {
        // Show error message
        showPaymentError(`Payment failed: ${error.description || error.reason || 'Unknown error'}`);
        
        // Re-enable button
        confirmUpgradeBtn.disabled = false;
        confirmUpgradeBtn.textContent = 'Upgrade Now';
    }

    // Helper function to format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    }
});
