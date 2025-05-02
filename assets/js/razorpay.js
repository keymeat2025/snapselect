//  razorpay.js file
document.addEventListener('DOMContentLoaded', function() {
    // Subscription plans
    const SUBSCRIPTION_PLANS = {
        basic: {
            name: 'Basic',
            price: 499,
            features: ['15 GB Storage', '10 Galleries', '500 Photos per gallery', '30-day client selection window', 'Advanced uploads', 'Password protection']
        },
        pro: {
            name: 'Pro',
            price: 999,
            features: ['50 GB Storage', 'Unlimited Galleries', '1000 Photos per gallery', '60-day client selection window', 'Advanced uploads', 'Password protection', 'Priority support']
        },
        premium: {
            name: 'Premium',
            price: 1999,
            features: ['100 GB Storage', 'Unlimited Galleries', 'Unlimited Photos', '90-day client selection window', 'Advanced uploads', 'Password protection', 'Priority support', 'Advanced analytics']
        }
    };

    // Global variables
    let selectedPlan = 'basic'; // Default selected plan
    let currentPlan = 'Free';

    // DOM elements
    const upgradePlanBtn = document.getElementById('upgradePlanBtn');
    const upgradePlanModal = document.getElementById('upgradePlanModal');
    const closeModalBtn = document.querySelector('#upgradePlanModal .close-modal');
    const planTabs = document.querySelectorAll('.plan-tab');
    const selectedPlanNameEl = document.getElementById('selectedPlanName');
    const selectedPlanPriceEl = document.getElementById('selectedPlanPrice');
    const planFeaturesListEl = document.getElementById('planFeaturesList');
    const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
    const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
    const currentPlanNameEl = document.getElementById('currentPlanName');
    const paymentSuccessEl = document.querySelector('.payment-success');
    const paymentErrorEl = document.querySelector('.payment-error');
    const currentPlanDisplayEl = document.getElementById('currentPlanDisplay');
    const currentPlanPriceEl = document.getElementById('currentPlanPrice');
    const currentPlanFeaturesEl = document.getElementById('currentPlanFeatures');
    const planBadgeEl = document.getElementById('planBadge');

    // Initialize firebase app if needed
    if (!firebase.apps.length) {
        // Your firebase initialization code
        console.log('Firebase app not initialized. Please initialize it in firebase-config.js');
    }

    // Initialize user data and plan
    function initializeDashboard() {
        // Check authentication
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                // User is signed in
                // Get user info and show in UI
                if (document.getElementById('userName')) {
                    document.getElementById('userName').textContent = user.displayName || user.email || 'User';
                    
                    // Update avatar placeholder
                    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
                    if (avatarPlaceholder) {
                        avatarPlaceholder.textContent = (user.displayName || user.email || 'User').charAt(0).toUpperCase();
                    }
                }
                
                // Get user's plan from Firestore
                const db = firebase.firestore();
                db.collection('users').doc(user.uid).get()
                    .then(doc => {
                        if (doc.exists && doc.data().plan) {
                            const plan = doc.data().plan;
                            
                            // Update UI with plan info
                            updateCurrentPlanUI(plan);
                        } else {
                            // User exists but no plan data (new user)
                            updateCurrentPlanUI('free');
                        }
                    })
                    .catch(error => {
                        console.error('Error getting user plan:', error);
                        updateCurrentPlanUI('free');
                    });
            } else {
                // No user is signed in, show auth overlay
                if (document.getElementById('authCheckOverlay')) {
                    document.getElementById('authCheckOverlay').style.display = 'flex';
                }
            }
        });
    }

    // Update UI with current plan information
    function updateCurrentPlanUI(planType) {
        currentPlan = planType;
        
        // Default free plan
        let planName = 'Free';
        let planPrice = '₹0/month';
        let planFeatures = [
            '1 GB Storage',
            '3 Galleries',
            '50 Photos per gallery',
            '3-day client selection window'
        ];
        
        // Override with subscription plan if it exists
        if (planType !== 'free' && SUBSCRIPTION_PLANS[planType]) {
            const plan = SUBSCRIPTION_PLANS[planType];
            planName = plan.name;
            planPrice = `₹${plan.price}`;
            planFeatures = plan.features;
        }
        
        // Update UI elements
        if (currentPlanNameEl) currentPlanNameEl.textContent = planName;
        if (planBadgeEl) planBadgeEl.textContent = planName;
        if (currentPlanDisplayEl) currentPlanDisplayEl.textContent = planName;
        if (currentPlanPriceEl) currentPlanPriceEl.textContent = planPrice;
        
        // Update features list
        if (currentPlanFeaturesEl) {
            currentPlanFeaturesEl.innerHTML = '';
            planFeatures.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                currentPlanFeaturesEl.appendChild(li);
            });
        }
        
        // Update storage usage based on plan
        updateStorageUI(planType);
        
        // Update gallery usage based on plan
        updateGalleryUI(planType);
    }

    // Update storage UI based on plan
    function updateStorageUI(planType) {
        let maxStorage = 1; // Default 1GB for free
        
        if (planType !== 'free' && SUBSCRIPTION_PLANS[planType]) {
            // Extract the storage value from the first feature
            const storageFeature = SUBSCRIPTION_PLANS[planType].features.find(f => f.includes('GB Storage'));
            
            if (storageFeature) {
                maxStorage = parseInt(storageFeature.split(' ')[0]);
            }
        }
        
        // Simulate some storage usage (replace with actual usage from Firebase)
        const usedStorage = Math.random() * maxStorage * 0.7; // 0-70% usage for demo
        const usedStorageFormatted = usedStorage.toFixed(2);
        
        // Update storage UI elements
        if (document.getElementById('storageUsed')) {
            document.getElementById('storageUsed').textContent = `${usedStorageFormatted} GB`;
        }
        
        if (document.getElementById('storageUsageBar')) {
            const percentage = (usedStorage / maxStorage) * 100;
            document.getElementById('storageUsageBar').style.width = `${percentage}%`;
        }
        
        if (document.getElementById('storageUsageText')) {
            document.getElementById('storageUsageText').textContent = `${usedStorageFormatted}/${maxStorage} GB`;
        }
    }

    // Update gallery UI based on plan
    function updateGalleryUI(planType) {
        let maxGalleries = 3; // Default 3 for free
        
        if (planType !== 'free' && SUBSCRIPTION_PLANS[planType]) {
            // Extract the gallery value from the second feature
            const galleryFeature = SUBSCRIPTION_PLANS[planType].features.find(f => f.includes('Galleries'));
            
            if (galleryFeature) {
                if (galleryFeature.includes('Unlimited')) {
                    maxGalleries = '∞'; // Infinity symbol for unlimited
                } else {
                    maxGalleries = parseInt(galleryFeature.split(' ')[0]);
                }
            }
        }
        
        // Simulate some gallery usage (replace with actual usage from Firebase)
        let usedGalleries = Math.floor(Math.random() * 3); // 0-2 galleries for demo
        if (maxGalleries === '∞') {
            usedGalleries = Math.floor(Math.random() * 8) + 2; // 2-10 galleries for unlimited plans
        }
        
        // Update active galleries count
        if (document.getElementById('activeGalleriesCount')) {
            document.getElementById('activeGalleriesCount').textContent = usedGalleries;
        }
        
        // Update gallery usage bar
        if (document.getElementById('galleryUsageBar') && maxGalleries !== '∞') {
            const percentage = (usedGalleries / maxGalleries) * 100;
            document.getElementById('galleryUsageBar').style.width = `${percentage}%`;
        } else if (document.getElementById('galleryUsageBar')) {
            // For unlimited plans, show a minimal bar
            document.getElementById('galleryUsageBar').style.width = '10%';
        }
        
        // Update gallery usage text
        if (document.getElementById('galleryUsageText')) {
            document.getElementById('galleryUsageText').textContent = `${usedGalleries}/${maxGalleries}`;
        }
    }

    // Update selected plan display in the modal
    function updatePlanDisplay(planType) {
        const plan = SUBSCRIPTION_PLANS[planType];
        if (!plan) return;
        
        // Update plan name and price
        if (selectedPlanNameEl) selectedPlanNameEl.textContent = plan.name;
        if (selectedPlanPriceEl) selectedPlanPriceEl.textContent = `₹${plan.price}`;
        
        // Update features list
        if (planFeaturesListEl) {
            planFeaturesListEl.innerHTML = '';
            plan.features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                planFeaturesListEl.appendChild(li);
            });
        }
    }

    // Show payment progress
    function showPaymentProgress(message) {
        if (paymentSuccessEl) paymentSuccessEl.style.display = 'none';
        if (paymentErrorEl) paymentErrorEl.style.display = 'none';
        
        if (confirmUpgradeBtn) {
            confirmUpgradeBtn.disabled = true;
            confirmUpgradeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }
    }

    // Show payment success
    function showPaymentSuccess(message) {
        if (paymentSuccessEl) {
            paymentSuccessEl.textContent = message || 'Payment successful!';
            paymentSuccessEl.style.display = 'block';
        }
        
        if (paymentErrorEl) {
            paymentErrorEl.style.display = 'none';
        }
        
        if (confirmUpgradeBtn) {
            confirmUpgradeBtn.disabled = false;
            confirmUpgradeBtn.innerHTML = 'Upgrade Complete!';
        }
    }

    // Show payment error
    function showPaymentError(message) {
        if (paymentErrorEl) {
            paymentErrorEl.textContent = message || 'Payment failed. Please try again.';
            paymentErrorEl.style.display = 'block';
        }
        
        if (paymentSuccessEl) {
            paymentSuccessEl.style.display = 'none';
        }
        
        if (confirmUpgradeBtn) {
            confirmUpgradeBtn.disabled = false;
            confirmUpgradeBtn.innerHTML = 'Try Again';
        }
    }

    // Reset payment buttons
    function resetPaymentButtons() {
        if (confirmUpgradeBtn) {
            confirmUpgradeBtn.disabled = false;
            confirmUpgradeBtn.innerHTML = 'Upgrade Now';
        }
        
        if (paymentSuccessEl) paymentSuccessEl.style.display = 'none';
        if (paymentErrorEl) paymentErrorEl.style.display = 'none';
    }

    // Process one-time payment
    async function processPayment(planType) {
        try {
            // Show loading state
            showPaymentProgress('Processing your request...');
            
            // Check if user is authenticated
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) {
                showPaymentError("You must be logged in to make a payment");
                setTimeout(resetPaymentButtons, 3000);
                return;
            }
            
            // Check if plan type exists
            if (!SUBSCRIPTION_PLANS || !SUBSCRIPTION_PLANS[planType]) {
                throw new Error(`Invalid plan selected: ${planType}`);
            }
            
            // Get plan details
            const plan = SUBSCRIPTION_PLANS[planType];
            
            // Get Firebase function with specific region
            const functions = firebase.functions();
            functions.useEmulator('localhost', 5001); // Remove this in production
            
            // Specify region for non-emulator environment
            // const functions = firebase.app().functions("asia-south1");
            
            // Log for debugging
            console.log("Calling createPaymentOrder with:", { planType, amount: plan.price });
            
            // Call the Firebase function
            const createPaymentOrder = functions.httpsCallable('createPaymentOrder');
            const orderResponse = await createPaymentOrder({
                planType: planType,
                amount: plan.price
            });
            
            // Log the response for debugging
            console.log("CreatePaymentOrder response:", orderResponse.data);
            
            // Get order data from response
            const orderData = orderResponse.data;
            
            if (!orderData || !orderData.orderId) {
                throw new Error('Invalid response from payment order creation');
            }
            
            // Configure Razorpay options
            const options = {
                key: 'rzp_test_k2If7sWFzrbatR', // Your Razorpay Key ID
                amount: plan.price * 100, // in paise
                currency: 'INR',
                name: 'SnapSelect',
                description: `${plan.name} Plan - One-time Payment`,
                order_id: orderData.orderId,
                handler: function(response) {
                    // Payment successful, verify it
                    verifyPayment(orderData.orderId, response.razorpay_payment_id, response.razorpay_signature);
                },
                prefill: {
                    name: currentUser.displayName || '',
                    email: currentUser.email || '',
                    contact: '' // Add phone if available
                },
                notes: {
                    userId: currentUser.uid,
                    planType: planType
                },
                theme: {
                    color: '#4A90E2'
                },
                modal: {
                    ondismiss: function() {
                        resetPaymentButtons();
                    }
                }
            };
            
            // Open Razorpay checkout
            const razorpay = new Razorpay(options);
            razorpay.on('payment.failed', function(response) {
                showPaymentError(`Payment failed: ${response.error.description}`);
                console.error('Payment failed:', response.error);
                setTimeout(resetPaymentButtons, 3000);
            });
            
            razorpay.open();
            
        } catch (error) {
            console.error('Payment process error:', error);
            showPaymentError(`Payment failed: ${error.message}`);
            setTimeout(resetPaymentButtons, 3000);
        }
    }

    // Verify payment after completion
    async function verifyPayment(orderId, paymentId, signature) {
        try {
            showPaymentProgress('Verifying payment...');
            
            // Call the Firebase function to verify payment
            const functions = firebase.functions();
            // Use emulator for local testing - remove in production
            functions.useEmulator('localhost', 5001);
            
            // Specify region for non-emulator environment
            // const functions = firebase.app().functions("asia-south1");
            
            const verifyPaymentFunction = functions.httpsCallable('verifyPayment');
            const verifyResponse = await verifyPaymentFunction({
                orderId: orderId,
                paymentId: paymentId,
                signature: signature
            });
            
            // Check response
            const responseData = verifyResponse.data;
            
            if (responseData && responseData.success) {
                // Payment successful
                showPaymentSuccess(`Payment successful! Your account has been upgraded to ${SUBSCRIPTION_PLANS[selectedPlan].name} plan.`);
                
                // Update UI after a short delay
                setTimeout(() => {
                    // Hide the modal
                    if (upgradePlanModal) upgradePlanModal.style.display = 'none';
                    
                    // Update current plan UI
                    updateCurrentPlanUI(selectedPlan);
                    
                    // Optional: reload the page to reflect all changes
                    // window.location.reload();
                }, 2000);
            } else {
                throw new Error('Payment verification failed');
            }
            
        } catch (error) {
            console.error('Payment verification error:', error);
            showPaymentError(`Payment verification failed: ${error.message}`);
            setTimeout(resetPaymentButtons, 3000);
        }
    }

    // Event listener for plan tabs
    planTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            planTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Update selected plan
            selectedPlan = this.getAttribute('data-plan');
            updatePlanDisplay(selectedPlan);
        });
    });

    // Event listener for upgrade button
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', function() {
            if (upgradePlanModal) {
                upgradePlanModal.style.display = 'block';
                
                // Set default selected plan (Basic)
                const basicPlanTab = document.querySelector('.plan-tab[data-plan="basic"]');
                if (basicPlanTab) {
                    basicPlanTab.click();
                }
            }
        });
    }

    // Event listener for close modal button
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function() {
            if (upgradePlanModal) {
                upgradePlanModal.style.display = 'none';
                resetPaymentButtons();
            }
        });
    }

    // Event listener for cancel button
    if (cancelUpgradeBtn) {
        cancelUpgradeBtn.addEventListener('click', function() {
            if (upgradePlanModal) {
                upgradePlanModal.style.display = 'none';
                resetPaymentButtons();
            }
        });
    }

    // Event listener for confirm upgrade button
    if (confirmUpgradeBtn) {
        confirmUpgradeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (selectedPlan) {
                processPayment(selectedPlan);
            }
        });
    }

    // Event listener for create gallery button (empty state)
    const emptyStateCreateBtn = document.getElementById('emptyStateCreateBtn');
    if (emptyStateCreateBtn) {
        emptyStateCreateBtn.addEventListener('click', function() {
            // Trigger the regular create gallery button
            const createGalleryBtn = document.getElementById('createGalleryBtn');
            if (createGalleryBtn) {
                createGalleryBtn.click();
            }
        });
    }

    // Initialize dashboard
    initializeDashboard();
    
    // Set default selected plan on load
    if (document.querySelector('.plan-tab[data-plan="basic"]')) {
        document.querySelector('.plan-tab[data-plan="basic"]').click();
    }
});
