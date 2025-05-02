/**
 * subscription-manager.js - Manages client-based plan purchases for photographers
 * 
 * This script handles:
 * - Displaying available plans
 * - Client selection during plan purchase
 * - Razorpay integration for payments
 * - Plan status tracking and management
 */

// Plan status constants - match backend constants
const PLAN_STATUS = {
  CREATED: 'created',           // Initial order creation
  PENDING: 'pending',           // Payment initiated but not confirmed
  ACTIVE: 'active',             // Successfully paid and within validity period
  FAILED: 'failed',             // Payment verification failed
  EXPIRED: 'expired',           // Past validity period
  CANCELED: 'canceled',         // Photographer canceled plan
  REFUNDED: 'refunded',         // Payment refunded
  EXPIRING_SOON: 'expiring_soon' // Approaching end of validity period
};

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
let selectedClient = null;
let currentUser = null;
let userClients = [];
let activePlans = [];

/**
 * Initialize subscription manager
 */
function initSubscriptionManager() {
  // Check if user is logged in
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      loadUserData();
      loadClientData();
      loadActivePlans();
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

  // Client select dropdown
  const clientSelect = document.getElementById('clientSelect');
  if (clientSelect) {
    clientSelect.addEventListener('change', function() {
      selectedClient = this.value;
    });
  }

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

  // Client modal buttons
  const createClientBtn = document.getElementById('createClientBtn');
  if (createClientBtn) {
    createClientBtn.addEventListener('click', showCreateClientModal);
  }

  // Add listeners for plan action buttons (cancel, extend, etc.)
  document.addEventListener('click', function(e) {
    // Cancel plan button
    if (e.target.classList.contains('cancel-plan-btn')) {
      const planId = e.target.getAttribute('data-plan-id');
      const clientId = e.target.getAttribute('data-client-id');
      if (planId && clientId) {
        confirmCancelPlan(planId, clientId);
      }
    }
    
    // Extend plan button
    if (e.target.classList.contains('extend-plan-btn')) {
      const planId = e.target.getAttribute('data-plan-id');
      const clientId = e.target.getAttribute('data-client-id');
      if (planId && clientId) {
        showExtendPlanModal(planId, clientId);
      }
    }
  });
}

/**
 * Load user data from Firestore
 */
async function loadUserData() {
  try {
    if (!currentUser) return;

    const db = firebase.firestore();
    
    // Get user document
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (!userDoc.exists) {
      // Create user document if it doesn't exist
      await db.collection('users').doc(currentUser.uid).set({
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        defaultPlan: 'free',
        planActive: false,
        totalPlans: 0,
        totalSpent: 0
      });
      return;
    }
    
    const userData = userDoc.data();
    
    // Update UI with user data
    updateUserInfo(userData);
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

/**
 * Load client data from Firestore
 */
async function loadClientData() {
  try {
    if (!currentUser) return;

    const db = firebase.firestore();
    
    // Get clients for this photographer
    const clientsSnapshot = await db.collection('clients')
      .where('photographerId', '==', currentUser.uid)
      .get();
    
    userClients = [];
    clientsSnapshot.forEach(doc => {
      userClients.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Update client select dropdown
    updateClientDropdown();
    
    // Update client list in dashboard
    updateClientList();
  } catch (error) {
    console.error('Error loading client data:', error);
  }
}

/**
 * Load active plans from Firestore
 */
async function loadActivePlans() {
  try {
    if (!currentUser) return;

    const db = firebase.firestore();
    
    // Get active plans for this photographer
    const plansSnapshot = await db.collection('client-plans')
      .where('photographerId', '==', currentUser.uid)
      .where('status', 'in', [PLAN_STATUS.ACTIVE, PLAN_STATUS.EXPIRING_SOON])
      .get();
    
    activePlans = [];
    plansSnapshot.forEach(doc => {
      activePlans.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Update active plans display
    updateActivePlansDisplay();
    
    // Update storage usage
    updateStorageUsage();
  } catch (error) {
    console.error('Error loading active plans:', error);
  }
}

/**
 * Update user info display
 */
function updateUserInfo(userData) {
  // Update user name
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = userData.displayName || currentUser.email || 'User';
  }
  
  // Update avatar placeholder with first letter
  const avatarPlaceholder = document.querySelector('.avatar-placeholder');
  if (avatarPlaceholder) {
    const firstLetter = (userData.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
    avatarPlaceholder.textContent = firstLetter;
  }
}

/**
 * Update client dropdown for plan selection
 */
function updateClientDropdown() {
  const clientSelect = document.getElementById('clientSelect');
  if (!clientSelect) return;
  
  // Clear existing options
  clientSelect.innerHTML = '<option value="">Select a client</option>';
  
  // Add option to create new client
  clientSelect.innerHTML += '<option value="new">+ Create New Client</option>';
  
  // Add existing clients
  userClients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name || client.email;
    
    // If client already has an active plan, show it
    if (client.planActive) {
      option.textContent += ` (${client.planType} Plan)`;
    }
    
    clientSelect.appendChild(option);
  });
}

/**
 * Update client list in dashboard
 */
function updateClientList() {
  const clientListEl = document.getElementById('clientList');
  if (!clientListEl) return;
  
  // Clear existing list
  clientListEl.innerHTML = '';
  
  // Check if we have clients
  if (userClients.length === 0) {
    clientListEl.innerHTML = '<div class="empty-state">No clients yet. Add your first client to get started.</div>';
    return;
  }
  
  // Add clients to list
  userClients.forEach(client => {
    const clientCard = document.createElement('div');
    clientCard.className = 'client-card';
    
    // Add active plan badge if client has one
    let planBadge = '';
    if (client.planActive) {
      planBadge = `<span class="plan-badge ${client.planType}">${SUBSCRIPTION_PLANS[client.planType]?.name || client.planType}</span>`;
    } else {
      planBadge = '<span class="plan-badge no-plan">No Plan</span>';
    }
    
    // Format end date if exists
    let endDateDisplay = '';
    if (client.planEndDate) {
      const endDate = client.planEndDate.toDate();
      endDateDisplay = endDate.toLocaleDateString();
    }
    
    clientCard.innerHTML = `
      <div class="client-info">
        <h3 class="client-name">${client.name || 'Unknown Client'}</h3>
        <div class="client-email">${client.email || ''}</div>
        <div class="client-plan">
          ${planBadge}
          ${endDateDisplay ? `<span class="plan-expiry">Expires: ${endDateDisplay}</span>` : ''}
        </div>
      </div>
      <div class="client-actions">
        <button class="btn view-client-btn" data-client-id="${client.id}">View Client</button>
        ${!client.planActive ? `<button class="btn add-plan-btn" data-client-id="${client.id}">Add Plan</button>` : ''}
      </div>
    `;
    
    clientListEl.appendChild(clientCard);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.view-client-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const clientId = this.getAttribute('data-client-id');
      viewClient(clientId);
    });
  });
  
  document.querySelectorAll('.add-plan-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const clientId = this.getAttribute('data-client-id');
      showUpgradeModal(clientId);
    });
  });
}

/**
 * Update active plans display
 */
function updateActivePlansDisplay() {
  const activePlansEl = document.getElementById('activePlans');
  if (!activePlansEl) return;
  
  // Clear existing list
  activePlansEl.innerHTML = '';
  
  // Check if we have active plans
  if (activePlans.length === 0) {
    activePlansEl.innerHTML = '<div class="empty-state">No active plans. Purchase a plan for a client to get started.</div>';
    return;
  }
  
  // Add plans to list
  activePlans.forEach(plan => {
    const planCard = document.createElement('div');
    planCard.className = 'plan-card';
    
    // Add status class
    planCard.classList.add(plan.status);
    
    // Format dates
    const startDate = plan.planStartDate?.toDate().toLocaleDateString() || 'Unknown';
    const endDate = plan.planEndDate?.toDate().toLocaleDateString() || 'Unknown';
    
    // Find client name
    const client = userClients.find(c => c.id === plan.clientId);
    const clientName = client?.name || plan.clientName || 'Unknown Client';
    
    planCard.innerHTML = `
      <div class="plan-header">
        <h3 class="plan-type">${SUBSCRIPTION_PLANS[plan.planType]?.name || plan.planType} Plan</h3>
        <span class="plan-status ${plan.status}">${formatPlanStatus(plan.status)}</span>
      </div>
      <div class="plan-details">
        <div class="plan-client">
          <strong>Client:</strong> ${clientName}
        </div>
        <div class="plan-dates">
          <div><strong>Started:</strong> ${startDate}</div>
          <div><strong>Expires:</strong> ${endDate}</div>
        </div>
        ${plan.daysLeftBeforeExpiration ? `<div class="plan-expiry-warning">Expires in ${plan.daysLeftBeforeExpiration} days</div>` : ''}
        <div class="plan-usage">
          <div class="usage-item">
            <span>Storage: ${formatStorageUsage(plan.storageUsed || 0, SUBSCRIPTION_PLANS[plan.planType]?.storageLimit || 1)}</span>
            <div class="usage-bar">
              <div class="usage-progress" style="width: ${calculateUsagePercent(plan.storageUsed || 0, SUBSCRIPTION_PLANS[plan.planType]?.storageLimit || 1)}%"></div>
            </div>
          </div>
          <div class="usage-item">
            <span>Photos: ${formatPhotoUsage(plan.photosUploaded || 0, SUBSCRIPTION_PLANS[plan.planType]?.photosPerGallery || 50)}</span>
            <div class="usage-bar">
              <div class="usage-progress" style="width: ${calculateUsagePercent(plan.photosUploaded || 0, SUBSCRIPTION_PLANS[plan.planType]?.photosPerGallery || 50)}%"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="plan-actions">
        <button class="btn view-gallery-btn" data-client-id="${plan.clientId}">View Gallery</button>
        ${plan.status === PLAN_STATUS.ACTIVE || plan.status === PLAN_STATUS.EXPIRING_SOON ?
          `<button class="btn extend-plan-btn" data-plan-id="${plan.id}" data-client-id="${plan.clientId}">Extend Plan</button>
           <button class="btn cancel-plan-btn" data-plan-id="${plan.id}" data-client-id="${plan.clientId}">Cancel Plan</button>` : ''}
      </div>
    `;
    
    activePlansEl.appendChild(planCard);
  });
}

/**
 * Format plan status for display
 */
function formatPlanStatus(status) {
  switch (status) {
    case PLAN_STATUS.ACTIVE:
      return 'Active';
    case PLAN_STATUS.EXPIRING_SOON:
      return 'Expiring Soon';
    case PLAN_STATUS.EXPIRED:
      return 'Expired';
    case PLAN_STATUS.CANCELED:
      return 'Canceled';
    case PLAN_STATUS.PENDING:
      return 'Pending';
    default:
      return status;
  }
}

/**
 * Format storage usage
 */
function formatStorageUsage(used, limit) {
  const usedGB = (used / 1024).toFixed(2);
  return `${usedGB}/${limit} GB`;
}

/**
 * Format photo usage
 */
function formatPhotoUsage(used, limit) {
  return `${used}/${limit} photos`;
}

/**
 * Calculate usage percentage
 */
function calculateUsagePercent(used, limit) {
  return Math.min((used / limit) * 100, 100);
}

/**
 * Show the upgrade plan modal
 */
function showUpgradeModal(clientId = null) {
  const modal = document.getElementById('upgradePlanModal');
  if (!modal) return;
  
  // If client ID is provided, pre-select the client
  if (clientId) {
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) {
      clientSelect.value = clientId;
      selectedClient = clientId;
    }
  }
  
  modal.style.display = 'block';
  
  // Set default selected plan (Basic)
  document.querySelector('.plan-tab[data-plan="basic"]').click();
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
 * Show create client modal
 */
function showCreateClientModal() {
  // Hide upgrade modal temporarily
  const upgradeModal = document.getElementById('upgradePlanModal');
  if (upgradeModal) {
    upgradeModal.style.display = 'none';
  }
  
  // Show create client modal
  const createClientModal = document.getElementById('createClientModal');
  if (createClientModal) {
    createClientModal.style.display = 'block';
  }
}

/**
 * Create a new client
 */
async function createClient(name, email) {
  try {
    if (!currentUser) return null;
    
    const db = firebase.firestore();
    
    // Create client in Firestore
    const clientRef = await db.collection('clients').add({
      name,
      email,
      photographerId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      planActive: false
    });
    
    // Reload client data
    await loadClientData();
    
    return clientRef.id;
  } catch (error) {
    console.error('Error creating client:', error);
    return null;
  }
}

/**
 * Update plan display in the modal
 */
function updatePlanDisplay(planType) {
  const planDetails = SUBSCRIPTION_PLANS[planType];
  if (!planDetails) return;

  // Update plan name and price
  document.getElementById('selectedPlanName').textContent = planDetails.name;
  document.getElementById('selectedPlanPrice').textContent = `₹${planDetails.price}/${planDetails.priceType}`;

  // Update features list
  const featuresList = document.getElementById('planFeaturesList');
  featuresList.innerHTML = '';
  planDetails.features.forEach(feature => {
    const li = document.createElement('li');
    li.textContent = feature;
    featuresList.appendChild(li);
  });
  
  // Update validity info
  const validityInfo = document.getElementById('validityInfo');
  if (validityInfo) {
    validityInfo.textContent = `Valid for ${planDetails.expiryDays} days`;
  }
}

/**
 * Process payment through Razorpay
 */
async function processPayment(planType) {
  try {
    // Show loading state
    showPaymentProgress('Processing your request...');
    
    // Validate client selection
    if (!selectedClient && selectedClient !== 'new') {
      showPaymentError('Please select a client for this plan');
      setTimeout(resetPaymentButtons, 3000);
      return;
    }
    
    // If creating a new client
    let clientId = selectedClient;
    let clientName = '';
    
    if (selectedClient === 'new') {
      // Get client details from form
      const clientNameInput = document.getElementById('newClientName');
      const clientEmailInput = document.getElementById('newClientEmail');
      
      if (!clientNameInput || !clientNameInput.value) {
        showPaymentError('Please enter a client name');
        setTimeout(resetPaymentButtons, 3000);
        return;
      }
      
      // Create new client
      clientName = clientNameInput.value;
      const clientEmail = clientEmailInput ? clientEmailInput.value : '';
      
      clientId = await createClient(clientName, clientEmail);
      
      if (!clientId) {
        throw new Error('Failed to create client');
      }
    } else {
      // Get selected client name
      const client = userClients.find(c => c.id === selectedClient);
      clientName = client?.name || 'Selected Client';
    }
    
    // Check if user is authenticated
    if (!firebase.auth().currentUser) {
      showPaymentError('You must be logged in to make a payment');
      setTimeout(resetPaymentButtons, 3000);
      return;
    }
    
    // Check if plan type exists
    if (!SUBSCRIPTION_PLANS || !SUBSCRIPTION_PLANS[planType]) {
      throw new Error(`Invalid plan selected: ${planType}`);
    }
    
    // Get plan details
    const plan = SUBSCRIPTION_PLANS[planType];
    
    // Initialize Firebase Functions
    const functions = firebase.app().functions('asia-south1');
    
    // Call the Firebase function to create payment order
    const createPaymentOrder = functions.httpsCallable('createPaymentOrder');
    const orderResponse = await createPaymentOrder({
      planType,
      amount: plan.price,
      clientId,
      clientName
    });
    
    // Get order data from response
    const orderData = orderResponse.data;
    
    if (!orderData || !orderData.orderId) {
      throw new Error('Invalid response from payment order creation');
    }
    
    // Configure Razorpay options
    const options = {
      key: 'rzp_test_k2If7sWFzrbatR',
      amount: orderData.amount * 100, // Amount in paise
      currency: orderData.currency || 'INR',
      name: 'SnapSelect',
      description: `${plan.name} Plan for ${clientName}`,
      order_id: orderData.orderId,
      handler: function(response) {
        // After payment is complete, verify the payment
        verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
      },
      prefill: {
        name: document.getElementById('userName').textContent,
        email: currentUser.email || '',
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
    razorpay.open();
    
  } catch (error) {
    console.error('Payment process error:', error);
    showPaymentError(`Payment failed: ${error.message}`);
    setTimeout(resetPaymentButtons, 3000);
  }
}

/**
 * Verify payment with Firebase function
 */
async function verifyPayment(orderId, paymentId, signature) {
  try {
    showPaymentProgress('Verifying payment...');
    
    // Initialize Firebase Functions
    const functions = firebase.app().functions('asia-south1');
    
    // Call the Firebase function to verify payment
    const verifyPaymentFunc = functions.httpsCallable('verifyPayment');
    const result = await verifyPaymentFunc({
      orderId,
      paymentId,
      signature
    });
    
    const responseData = result.data;
    
    if (responseData && responseData.success) {
      // Payment successful
      showPaymentSuccess(`Payment successful! The ${SUBSCRIPTION_PLANS[responseData.planType]?.name || responseData.planType} plan has been activated for your client.`);
      
      // Update UI after a short delay
      setTimeout(() => {
        hideUpgradeModal();
        
        // Reload data
        loadClientData();
        loadActivePlans();
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

/**
 * Show payment progress message
 */
function showPaymentProgress(message) {
  const progressEl = document.querySelector('.payment-progress');
  if (progressEl) {
    progressEl.textContent = message;
    progressEl.style.display = 'block';
  }
  
  document.querySelector('.payment-success')?.style.display = 'none';
  document.querySelector('.payment-error')?.style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }
}

/**
 * Show payment success message
 */
function showPaymentSuccess(message) {
  const successEl = document.querySelector('.payment-success');
  if (successEl) {
    successEl.textContent = message;
    successEl.style.display = 'block';
  }
  
  document.querySelector('.payment-progress')?.style.display = 'none';
  document.querySelector('.payment-error')?.style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Upgrade Complete!';
  }
}

/**
 * Show payment error message
 */
function showPaymentError(message) {
  const errorEl = document.querySelector('.payment-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  
  document.querySelector('.payment-progress')?.style.display = 'none';
  document.querySelector('.payment-success')?.style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Try Again';
  }
}

/**
 * Reset payment buttons
 */
function resetPaymentButtons() {
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Upgrade Now';
  }
}

/**
 * Confirm cancellation of a plan
 */
function confirmCancelPlan(planId, clientId) {
  if (confirm('Are you sure you want to cancel this plan? This action cannot be undone.')) {
    cancelClientPlan(planId, clientId);
  }
}

/**
 * Cancel a client plan
 */
async function cancelClientPlan(planId, clientId) {
  try {
    showLoadingOverlay('Canceling plan...');
    
    // Initialize Firebase Functions
    const functions = firebase.app().functions('asia-south1');
    
    // Call the Firebase function to cancel the plan
    const cancelPlanFunc = functions.httpsCallable('cancelClientPlan');
    const result = await cancelPlanFunc({
      clientId,
      reason: 'User requested cancellation'
    });
    
    const responseData = result.data;
    
    if (responseData && responseData.success) {
      // Plan canceled successfully
      showSuccessMessage('Plan canceled successfully');
      
      // Reload data
      loadClientData();
      loadActivePlans();
    } else {
      throw new Error('Failed to cancel plan');
    }
    
  } catch (error) {
    console.error('Error canceling plan:', error);
    showErrorMessage(`Error canceling plan: ${error.message}`);
  } finally {
    hideLoadingOverlay();
  }
}

/**
 * Show loading overlay
 */
function showLoadingOverlay(message) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (!loadingOverlay) return;
  
  const loadingText = loadingOverlay.querySelector('.loading-text');
  if (loadingText) {
    loadingText.textContent = message || 'Loading...';
  }
  
  loadingOverlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

/**
 * Show success message
 */
function showSuccessMessage(message) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.innerHTML = `
    <i class="fas fa-check-circle"></i>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

/**
 * Show error message
 */
function showErrorMessage(message) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.innerHTML = `
    <i class="fas fa-exclamation-circle"></i>
    <span>${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

/**
 * Update storage usage display
 */
function updateStorageUsage() {
  // Calculate total storage used across all active plans
  const totalStorage = activePlans.reduce((total, plan) => {
    return total + (plan.storageUsed || 0);
  }, 0);
  
  // Calculate total storage limit across all active plans
  const totalStorageLimit = activePlans.reduce((total, plan) => {
    return total + (SUBSCRIPTION_PLANS[plan.planType]?.storageLimit || 1);
  }, 1); // Default to 1GB if no active plans
  
  // Convert to GB for display
  const storageGB = (totalStorage / 1024).toFixed(2);
  
  // Update UI
  const storageEl = document.getElementById('storageUsed');
  if (storageEl) {
    storageEl.textContent = `${storageGB} GB`;
  }
  
  // Calculate percentage
  const usagePercent = Math.min((totalStorage / (totalStorageLimit * 1024)) * 100, 100);
  
  // Update UI
  const storageBarEl = document.getElementById('storageUsageBar');
  if (storageBarEl) {
    storageBarEl.style.width = `${usagePercent}%`;
  }
  
  const storageTextEl = document.getElementById('storageUsageText');
  if (storageTextEl) {
    storageTextEl.textContent = `${storageGB}/${totalStorageLimit} GB`;
  }
  
  // Add warning class if usage is high
  if (storageBarEl && usagePercent > 90) {
    storageBarEl.classList.add('high-usage');
  } else if (storageBarEl) {
    storageBarEl.classList.remove('high-usage');
  }
}

// Initialize the subscription manager when the document is ready
document.addEventListener('DOMContentLoaded', function() {
  initSubscriptionManager();
});

// Make functions available globally
window.subscriptionManager = {
  updatePlanDisplay,
  refreshSubscription: () => {
    loadClientData();
    loadActivePlans();
  },
  getPlanDetails: (planType) => SUBSCRIPTION_PLANS[planType] || null,
  showUpgradeModal,
  hideUpgradeModal,
  createClient,
  cancelClientPlan
};

// Make subscription plans available globally
window.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
