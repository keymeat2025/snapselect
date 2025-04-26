/**
 * subscription-manager.js
 * Handles subscription plan management for SnapSelect
 */

// Plan details and limits
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        storageLimit: 1, // GB
        galleryLimit: 3,
        photosPerGallery: 100,
        maxClients: 5,
        expiryDays: 30,
        features: ['Basic uploads', 'Client selection', 'Basic sharing']
    },
    mini: {
        name: 'Mini',
        price: 9.99,
        storageLimit: 3, // GB
        galleryLimit: 10,
        photosPerGallery: 150,
        maxClients: 15,
        expiryDays: 60,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Download originals']
    },
    basic: {
        name: 'Basic',
        price: 19.99,
        storageLimit: 8, // GB
        galleryLimit: 20,
        photosPerGallery: 500,
        maxClients: 30,
        expiryDays: 90,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Download originals', 'Gallery customization']
    },
    medium: {
        name: 'Medium',
        price: 39.99,
        storageLimit: 25, // GB
        galleryLimit: 50,
        photosPerGallery: 1000,
        maxClients: 75,
        expiryDays: 180,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Download originals', 'Gallery customization', 'Priority support']
    },
    mega: {
        name: 'Mega',
        price: 69.99,
        storageLimit: 100, // GB
        galleryLimit: Infinity,
        photosPerGallery: Infinity,
        maxClients: Infinity,
        expiryDays: 365,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Download originals', 'Gallery customization', 'Priority support', 'White labeling', 'API access']
    }
};

// Initialize module
document.addEventListener('DOMContentLoaded', function() {
    initSubscriptionManager();
});

/**
 * Initialize subscription manager
 */
function initSubscriptionManager() {
    // Setup event listeners for subscription elements
    setupSubscriptionEvents();
    
    // Load user's subscription data
    loadSubscriptionData();
    
    console.log('Subscription manager initialized');
}

/**
 * Setup subscription-related event listeners
 */
function setupSubscriptionEvents() {
    // Upgrade plan button
    const upgradePlanBtn = document.getElementById('upgradePlanBtn');
    if (upgradePlanBtn) {
        upgradePlanBtn.addEventListener('click', openUpgradePlanModal);
    }
    
    // Cancel upgrade button
    const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
    if (cancelUpgradeBtn) {
        cancelUpgradeBtn.addEventListener('click', closeUpgradePlanModal);
    }
    
    // Plan tabs in upgrade modal
    const planTabs = document.querySelectorAll('.plan-tab');
    planTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            planTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Update selected plan
            const planName = this.getAttribute('data-plan');
            updateSelectedPlan(planName);
        });
    });
    
    // Payment form submission
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            processSubscriptionUpgrade();
        });
    }
}

/**
 * Load user's subscription data from Firebase
 */
async function loadSubscriptionData() {
    try {
        const user = window.firebaseServices.auth.currentUser;
        if (!user) {
            console.error('User not authenticated');
            return;
        }
        
        // Get subscription data
        const db = window.firebaseServices.db;
        const subscriptionDoc = await db.collection('subscription').doc('subscription_current').get();
        
        if (subscriptionDoc.exists) {
            const subscriptionData = subscriptionDoc.data();
            updateSubscriptionUI(subscriptionData);
        } else {
            // Default to free plan if no subscription data exists
            updateSubscriptionUI({ planType: 'free' });
        }
    } catch (error) {
        console.error('Error loading subscription data:', error);
        // Default to free plan on error
        updateSubscriptionUI({ planType: 'free' });
    }
}

/**
 * Update subscription UI based on subscription data
 */
function updateSubscriptionUI(subscriptionData) {
    const planType = subscriptionData.planType || 'free';
    const planDetails = SUBSCRIPTION_PLANS[planType];
    
    if (!planDetails) {
        console.error('Invalid plan type:', planType);
        return;
    }
    
    // Update plan name display
    const planNameElements = document.querySelectorAll('#currentPlanName, #planBadge, #currentPlanDisplay');
    planNameElements.forEach(el => {
        if (el) el.textContent = planDetails.name;
    });
    
    // Update plan price
    const currentPlanPrice = document.getElementById('currentPlanPrice');
    if (currentPlanPrice) {
        currentPlanPrice.textContent = planDetails.price > 0 ? `$${planDetails.price}/month` : 'Free';
    }
    
    // Update current plan features
    const currentPlanFeatures = document.getElementById('currentPlanFeatures');
    if (currentPlanFeatures) {
        currentPlanFeatures.innerHTML = '';
        
        // Add storage limit
        const storageItem = document.createElement('li');
        storageItem.textContent = `${planDetails.storageLimit} GB Storage`;
        currentPlanFeatures.appendChild(storageItem);
        
        // Add gallery limit
        const galleryItem = document.createElement('li');
        galleryItem.textContent = planDetails.galleryLimit === Infinity ? 
            'Unlimited Galleries' : `${planDetails.galleryLimit} Galleries`;
        currentPlanFeatures.appendChild(galleryItem);
        
        // Add photos per gallery limit
        const photosItem = document.createElement('li');
        photosItem.textContent = planDetails.photosPerGallery === Infinity ? 
            'Unlimited Photos per gallery' : `${planDetails.photosPerGallery} Photos per gallery`;
        currentPlanFeatures.appendChild(photosItem);
        
        // Add expiry days
        const expiryItem = document.createElement('li');
        expiryItem.textContent = `${planDetails.expiryDays}-day expiration`;
        currentPlanFeatures.appendChild(expiryItem);
        
        // Add other features
        planDetails.features.forEach(feature => {
            if (feature !== 'Basic uploads' && feature !== 'Client selection') {
                const featureItem = document.createElement('li');
                featureItem.textContent = feature;
                currentPlanFeatures.appendChild(featureItem);
            }
        });
    }
    
    // Update usage bars
    updateStorageUsage(subscriptionData.storageUsed || 0, planDetails.storageLimit);
    updateGalleryUsage();
}

/**
 * Update storage usage bar and text
 */
function updateStorageUsage(used, limit) {
    const storageUsageBar = document.getElementById('storageUsageBar');
    const storageUsageText = document.getElementById('storageUsageText');
    
    if (storageUsageBar && storageUsageText) {
        // Calculate percentage
        const percentage = Math.min((used / limit) * 100, 100);
        
        // Update bar width
        storageUsageBar.style.width = `${percentage}%`;
        
        // Update color based on usage
        if (percentage > 90) {
            storageUsageBar.style.backgroundColor = 'var(--color-danger)';
        } else if (percentage > 70) {
            storageUsageBar.style.backgroundColor = 'var(--color-warning)';
        } else {
            storageUsageBar.style.backgroundColor = 'var(--color-primary)';
        }
        
        // Update text
        storageUsageText.textContent = `${used.toFixed(2)}/${limit} GB`;
    }
}

/**
 * Update gallery usage bar and text
 */
function updateGalleryUsage() {
    // For demo purposes, we'll get the count from the UI directly
    // In a real implementation, this would come from the database
    const galleryCards = document.querySelectorAll('.gallery-card:not(.sample-card)');
    const count = galleryCards.length;
    
    const galleryUsageBar = document.getElementById('galleryUsageBar');
    const galleryUsageText = document.getElementById('galleryUsageText');
    const currentPlanName = document.getElementById('currentPlanName');
    
    if (galleryUsageBar && galleryUsageText && currentPlanName) {
        const planType = currentPlanName.textContent.toLowerCase();
        const planDetails = SUBSCRIPTION_PLANS[planType === 'free' ? 'free' : planType.toLowerCase()];
        
        if (!planDetails) return;
        
        const limit = planDetails.galleryLimit;
        const percentage = limit === Infinity ? 0 : Math.min((count / limit) * 100, 100);
        
        // Update bar width
        galleryUsageBar.style.width = `${percentage}%`;
        
        // Update color based on usage
        if (percentage > 90) {
            galleryUsageBar.style.backgroundColor = 'var(--color-danger)';
        } else if (percentage > 70) {
            galleryUsageBar.style.backgroundColor = 'var(--color-warning)';
        } else {
            galleryUsageBar.style.backgroundColor = 'var(--color-primary)';
        }
        
        // Update text
        galleryUsageText.textContent = limit === Infinity ? 
            `${count}/∞` : `${count}/${limit}`;
    }
}

/**
 * Open the upgrade plan modal
 */
function openUpgradePlanModal() {
    const modal = document.getElementById('upgradePlanModal');
    if (modal) {
        // Set default selected plan to Basic
        updateSelectedPlan('basic');
        
        // Show modal
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
}

/**
 * Close the upgrade plan modal
 */
function closeUpgradePlanModal() {
    const modal = document.getElementById('upgradePlanModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
        
        // Reset form
        const form = document.getElementById('paymentForm');
        if (form) {
            form.reset();
        }
    }
}

/**
 * Update selected plan in upgrade modal
 */
function updateSelectedPlan(planName) {
    const planDetails = SUBSCRIPTION_PLANS[planName];
    
    if (!planDetails) {
        console.error('Invalid plan name:', planName);
        return;
    }
    
    // Update plan name and price
    const selectedPlanDisplay = document.getElementById('selectedPlanDisplay');
    const selectedPlanPrice = document.getElementById('selectedPlanPrice');
    
    if (selectedPlanDisplay) {
        selectedPlanDisplay.textContent = planDetails.name;
    }
    
    if (selectedPlanPrice) {
        selectedPlanPrice.textContent = `$${planDetails.price}/month`;
    }
    
    // Update plan features
    const selectedPlanFeatures = document.getElementById('selectedPlanFeatures');
    if (selectedPlanFeatures) {
        selectedPlanFeatures.innerHTML = '';
        
        // Add storage limit
        const storageItem = document.createElement('li');
        storageItem.textContent = `${planDetails.storageLimit} GB Storage`;
        selectedPlanFeatures.appendChild(storageItem);
        
        // Add gallery limit
        const galleryItem = document.createElement('li');
        galleryItem.textContent = planDetails.galleryLimit === Infinity ? 
            'Unlimited Galleries' : `${planDetails.galleryLimit} Galleries`;
        selectedPlanFeatures.appendChild(galleryItem);
        
        // Add photos per gallery limit
        const photosItem = document.createElement('li');
        photosItem.textContent = planDetails.photosPerGallery === Infinity ? 
            'Unlimited Photos per gallery' : `${planDetails.photosPerGallery} Photos per gallery`;
        selectedPlanFeatures.appendChild(photosItem);
        
        // Add expiry days
        const expiryItem = document.createElement('li');
        expiryItem.textContent = `${planDetails.expiryDays}-day expiration`;
        selectedPlanFeatures.appendChild(expiryItem);
        
        // Add other features
        planDetails.features.forEach(feature => {
            if (feature !== 'Basic uploads' && feature !== 'Client selection') {
                const featureItem = document.createElement('li');
                featureItem.textContent = feature;
                selectedPlanFeatures.appendChild(featureItem);
            }
        });
    }
}

/**
 * Process subscription upgrade
 */
async function processSubscriptionUpgrade() {
    // Show loading state
    const confirmButton = document.getElementById('confirmUpgradeBtn');
    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Processing...';
    }
    
    try {
        // Get selected plan
        const activeTab = document.querySelector('.plan-tab.active');
        if (!activeTab) {
            throw new Error('No plan selected');
        }
        
        const planType = activeTab.getAttribute('data-plan');
        
        // Get user
        const user = window.firebaseServices.auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }
        
        // In a real implementation, this would process payment through a payment processor
        // For demo purposes, we'll simulate a successful payment
        
        // Update subscription in database
        const db = window.firebaseServices.db;
        await db.collection('subscription').doc('subscription_current').update({
            planType: planType,
            storageQuota: SUBSCRIPTION_PLANS[planType].storageLimit,
            startDate: firebase.firestore.FieldValue.serverTimestamp(),
            endDate: null, // Would be calculated in real implementation
            autoRenew: true,
            features: SUBSCRIPTION_PLANS[planType].features
        });
        
        // Show success message
        alert(`Successfully upgraded to ${SUBSCRIPTION_PLANS[planType].name} plan!`);
        
        // Close modal
        closeUpgradePlanModal();
        
        // Reload subscription data
        loadSubscriptionData();
    } catch (error) {
        console.error('Error upgrading subscription:', error);
        alert(`Error upgrading plan: ${error.message}`);
    } finally {
        // Reset button state
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Upgrade Now';
        }
    }
}

// Expose functions for use in other files
window.subscriptionManager = {
    loadSubscriptionData,
    updateSubscriptionUI,
    updateStorageUsage,
    updateGalleryUsage,
    SUBSCRIPTION_PLANS
};
