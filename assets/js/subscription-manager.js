/**
 * subscription-manager.js - Manages client-based plan purchases for photographers
 */

// Plan status constants
const PLAN_STATUS = {
  CREATED: 'created', PENDING: 'pending', ACTIVE: 'active', FAILED: 'failed',
  EXPIRED: 'expired', CANCELED: 'canceled', REFUNDED: 'refunded', EXPIRING_SOON: 'expiring_soon'
};

// Subscription plans data
const SUBSCRIPTION_PLANS = {
  lite: {
    name: 'Lite', price: 79, priceType: 'per client', storageLimit: 2, galleryLimit: 1,
    photosPerGallery: 100, maxClients: 1, expiryDays: 7,
    features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature']
  },
  mini: {
    name: 'Mini', price: 149, priceType: 'per client', storageLimit: 5, galleryLimit: 1,
    photosPerGallery: 200, maxClients: 1, expiryDays: 14,
    features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Basic Gallery Customization']
  },
  basic: {
    name: 'Basic', price: 399, priceType: 'per client', storageLimit: 15, galleryLimit: 1,
    photosPerGallery: 500, maxClients: 1, expiryDays: 30,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Custom branding', 'Basic Analytics']
  },
  pro: {
    name: 'Pro', price: 799, priceType: 'per client', storageLimit: 25, galleryLimit: 1,
    photosPerGallery: 800, maxClients: 1, expiryDays: 45,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Advanced Gallery Customization', 'Client Comments', 'Detailed Analytics']
  },
  premium: {
    name: 'Premium', price: 1499, priceType: 'per client', storageLimit: 50, galleryLimit: 1,
    photosPerGallery: 1200, maxClients: 1, expiryDays: 60,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Complete Gallery Customization', 'Client Comments', 'Detailed Analytics', 'Priority Support']
  },
  ultimate: {
    name: 'Ultimate', price: 2999, priceType: 'per client', storageLimit: 100, galleryLimit: 2,
    photosPerGallery: 1250, maxClients: 1, expiryDays: 90,
    features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'White-label Gallery Customization', 'Client Comments', 'Advanced Analytics', 'Priority Phone Support']
  }
};

// Global variables
let selectedPlan = null, selectedClient = null, currentUser = null, userClients = [], activePlans = [];

// Initialize subscription manager
async function initSubscriptionManager() {
  try {
    // Show loading overlay at the start
    showLoadingOverlay('Initializing...');
    
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        currentUser = user;
        
        try {
          // Use Promise.all to handle all data loading in parallel
          await Promise.all([
            loadUserData(),
            loadClientData(),
            loadActivePlans()
          ]);
          
          // Hide loading overlay when all data is loaded
          hideLoadingOverlay();
        } catch (error) {
          console.error('Error loading data:', error);
          showErrorMessage('Failed to load your data. Please refresh the page.');
          hideLoadingOverlay();
        }
      } else {
        // Hide loading overlay if user is not logged in
        hideLoadingOverlay();
      }
    });
    
    setupEventListeners();
  } catch (error) {
    console.error('Error initializing subscription manager:', error);
    hideLoadingOverlay(); // Make sure loading overlay is hidden even if there's an error
  }
}

// Set up event listeners
function setupEventListeners() {
  // Plan upgrade button
  const upgradePlanBtn = document.getElementById('upgradePlanBtn');
  if (upgradePlanBtn) upgradePlanBtn.addEventListener('click', showUpgradeModal);

  // Plan tabs in upgrade modal
  document.querySelectorAll('.plan-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      selectedPlan = this.getAttribute('data-plan');
      updatePlanDisplay(selectedPlan);
    });
  });

  // Client selection and buttons
  const clientSelect = document.getElementById('clientSelect');
  if (clientSelect) clientSelect.addEventListener('change', function() { selectedClient = this.value; });
  
  const confirmUpgradeBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmUpgradeBtn) {
    confirmUpgradeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Basic validation before processing
      if (!selectedPlan || !selectedClient) {
        showPaymentError('Please select both a plan and a client');
        return;
      }
      
      processPayment(selectedPlan);
    });
  }
  
  const cancelUpgradeBtn = document.getElementById('cancelUpgradeBtn');
  if (cancelUpgradeBtn) cancelUpgradeBtn.addEventListener('click', hideUpgradeModal);
  
  const closeModalBtn = document.querySelector('#upgradePlanModal .close-modal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', hideUpgradeModal);
  
  const createClientBtn = document.getElementById('createClientBtn');
  if (createClientBtn) createClientBtn.addEventListener('click', showCreateClientModal);

  // Plan action buttons
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('cancel-plan-btn')) {
      const planId = e.target.getAttribute('data-plan-id');
      const clientId = e.target.getAttribute('data-client-id');
      if (planId && clientId) confirmCancelPlan(planId, clientId);
    }
    
    if (e.target.classList.contains('extend-plan-btn')) {
      const planId = e.target.getAttribute('data-plan-id');
      const clientId = e.target.getAttribute('data-client-id');
      if (planId && clientId) showExtendPlanModal(planId, clientId);
    }
  });
}

// Modified loadUserData function to return a Promise
async function loadUserData() {
  try {
    if (!currentUser) return;
    const db = firebase.firestore();
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    
    if (!userDoc.exists) {
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
    
    updateUserInfo(userDoc.data());
  } catch (error) {
    console.error('Error loading user data:', error);
    throw error; // Re-throw to be caught by the Promise.all
  }
}

// Modified loadClientData function to return a Promise
async function loadClientData() {
  try {
    if (!currentUser) return;
    const db = firebase.firestore();
    const clientsSnapshot = await db.collection('clients')
      .where('photographerId', '==', currentUser.uid)
      .get();
    
    userClients = [];
    clientsSnapshot.forEach(doc => {
      userClients.push({ id: doc.id, ...doc.data() });
    });
    
    updateClientDropdown();
    updateClientList();
  } catch (error) {
    console.error('Error loading client data:', error);
    throw error; // Re-throw to be caught by the Promise.all
  }
}

// Modified loadActivePlans function to return a Promise
async function loadActivePlans() {
  try {
    if (!currentUser) return;
    const db = firebase.firestore();
    const plansSnapshot = await db.collection('client-plans')
      .where('photographerId', '==', currentUser.uid)
      .where('status', 'in', [PLAN_STATUS.ACTIVE, PLAN_STATUS.EXPIRING_SOON])
      .get();
    
    activePlans = [];
    plansSnapshot.forEach(doc => {
      activePlans.push({ id: doc.id, ...doc.data() });
    });
    
    updateActivePlansDisplay();
    updateStorageUsage();
  } catch (error) {
    console.error('Error loading active plans:', error);
    throw error; // Re-throw to be caught by the Promise.all
  }
}

// Update user info in UI
function updateUserInfo(userData) {
  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.textContent = userData.displayName || currentUser.email || 'User';
  
  const avatarPlaceholder = document.querySelector('.avatar-placeholder');
  if (avatarPlaceholder) {
    avatarPlaceholder.textContent = (userData.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
  }
}

// Update client dropdown
function updateClientDropdown() {
  const clientSelect = document.getElementById('clientSelect');
  if (!clientSelect) return;
  
  clientSelect.innerHTML = '<option value="">Select a client</option><option value="new">+ Create New Client</option>';
  
  userClients.forEach(client => {
    const option = document.createElement('option');
    option.value = client.id;
    option.textContent = client.name || client.email;
    if (client.planActive) option.textContent += ` (${client.planType} Plan)`;
    clientSelect.appendChild(option);
  });
}

// Update client list
function updateClientList() {
  const clientListEl = document.getElementById('clientList');
  if (!clientListEl) return;
  
  clientListEl.innerHTML = '';
  
  if (userClients.length === 0) {
    clientListEl.innerHTML = '<div class="empty-state">No clients yet. Add your first client to get started.</div>';
    return;
  }
  
  userClients.forEach(client => {
    const clientCard = document.createElement('div');
    clientCard.className = 'client-card';
    
    let planBadge = '';
    if (client.planActive) {
      planBadge = `<span class="plan-badge ${client.planType}">${SUBSCRIPTION_PLANS[client.planType]?.name || client.planType}</span>`;
    } else {
      planBadge = '<span class="plan-badge no-plan">No Plan</span>';
    }
    
    let endDateDisplay = '';
    if (client.planEndDate) {
      endDateDisplay = client.planEndDate.toDate().toLocaleDateString();
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
  
  // Add event listeners
  document.querySelectorAll('.view-client-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      viewClient(this.getAttribute('data-client-id'));
    });
  });
  
  document.querySelectorAll('.add-plan-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      showUpgradeModal(this.getAttribute('data-client-id'));
    });
  });
}

// Update active plans display
function updateActivePlansDisplay() {
  const activePlansEl = document.getElementById('activePlans');
  if (!activePlansEl) return;
  
  activePlansEl.innerHTML = '';
  
  if (activePlans.length === 0) {
    activePlansEl.innerHTML = '<div class="empty-state">No active plans. Purchase a plan for a client to get started.</div>';
    return;
  }
  
  activePlans.forEach(plan => {
    const planCard = document.createElement('div');
    planCard.className = 'plan-card';
    planCard.classList.add(plan.status);
    
    const startDate = plan.planStartDate?.toDate().toLocaleDateString() || 'Unknown';
    const endDate = plan.planEndDate?.toDate().toLocaleDateString() || 'Unknown';
    
    const client = userClients.find(c => c.id === plan.clientId);
    const clientName = client?.name || plan.clientName || 'Unknown Client';
    
    planCard.innerHTML = `
      <div class="plan-header">
        <h3 class="plan-type">${SUBSCRIPTION_PLANS[plan.planType]?.name || plan.planType} Plan</h3>
        <span class="plan-status ${plan.status}">${formatPlanStatus(plan.status)}</span>
      </div>
      <div class="plan-details">
        <div class="plan-client"><strong>Client:</strong> ${clientName}</div>
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

// Helper functions for formatting
function formatPlanStatus(status) {
  const statusMap = {
    [PLAN_STATUS.ACTIVE]: 'Active',
    [PLAN_STATUS.EXPIRING_SOON]: 'Expiring Soon',
    [PLAN_STATUS.EXPIRED]: 'Expired',
    [PLAN_STATUS.CANCELED]: 'Canceled',
    [PLAN_STATUS.PENDING]: 'Pending'
  };
  return statusMap[status] || status;
}

function formatStorageUsage(used, limit) {
  return `${(used / 1024).toFixed(2)}/${limit} GB`;
}

function formatPhotoUsage(used, limit) {
  return `${used}/${limit} photos`;
}

function calculateUsagePercent(used, limit) {
  return Math.min((used / limit) * 100, 100);
}

// Modal functions
function showUpgradeModal(clientId = null) {
  const modal = document.getElementById('upgradePlanModal');
  if (!modal) return;
  
  if (clientId) {
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) {
      clientSelect.value = clientId;
      selectedClient = clientId;
    }
  }
  
  modal.style.display = 'block';
  document.querySelector('.plan-tab[data-plan="basic"]')?.click();
}

function hideUpgradeModal() {
  const modal = document.getElementById('upgradePlanModal');
  if (modal) modal.style.display = 'none';
}

function showCreateClientModal() {
  const upgradeModal = document.getElementById('upgradePlanModal');
  if (upgradeModal) upgradeModal.style.display = 'none';
  
  const createClientModal = document.getElementById('createClientModal');
  if (createClientModal) createClientModal.style.display = 'block';
}

// Client management
async function createClient(name, email) {
  try {
    if (!currentUser) return null;
    
    const db = firebase.firestore();
    const clientRef = await db.collection('clients').add({
      name, email,
      photographerId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      planActive: false
    });
    
    await loadClientData();
    return clientRef.id;
  } catch (error) {
    console.error('Error creating client:', error);
    return null;
  }
}

// Plan display and payment
function updatePlanDisplay(planType) {
  const planDetails = SUBSCRIPTION_PLANS[planType];
  if (!planDetails) return;

  document.getElementById('selectedPlanName').textContent = planDetails.name;
  document.getElementById('selectedPlanPrice').textContent = `₹${planDetails.price}/${planDetails.priceType}`;

  const featuresList = document.getElementById('planFeaturesList');
  if (featuresList) {
    featuresList.innerHTML = '';
    planDetails.features.forEach(feature => {
      const li = document.createElement('li');
      li.textContent = feature;
      featuresList.appendChild(li);
    });
  }
  
  const validityInfo = document.getElementById('validityInfo');
  if (validityInfo) validityInfo.textContent = `Valid for ${planDetails.expiryDays} days`;
}

async function processPayment(planType) {
  try {
    showPaymentProgress('Processing your request...');
    
    if (!selectedClient && selectedClient !== 'new') {
      showPaymentError('Please select a client for this plan');
      setTimeout(resetPaymentButtons, 3000);
      return;
    }
    
    // Handle client selection
    let clientId = selectedClient;
    let clientName = '';
    
    if (selectedClient === 'new') {
      const clientNameInput = document.getElementById('newClientName');
      const clientEmailInput = document.getElementById('newClientEmail');
      
      if (!clientNameInput || !clientNameInput.value) {
        showPaymentError('Please enter a client name');
        setTimeout(resetPaymentButtons, 3000);
        return;
      }
      
      clientName = clientNameInput.value;
      const clientEmail = clientEmailInput ? clientEmailInput.value : '';
      clientId = await createClient(clientName, clientEmail);
      
      if (!clientId) throw new Error('Failed to create client');
    } else {
      const client = userClients.find(c => c.id === selectedClient);
      clientName = client?.name || 'Selected Client';
    }
    
    if (!firebase.auth().currentUser) {
      showPaymentError('You must be logged in to make a payment');
      setTimeout(resetPaymentButtons, 3000);
      return;
    }
    
    if (!SUBSCRIPTION_PLANS[planType]) throw new Error(`Invalid plan selected: ${planType}`);
    
    const plan = SUBSCRIPTION_PLANS[planType];
    const functions = firebase.app().functions('asia-south1');
    
    // Create payment order
    const createPaymentOrder = functions.httpsCallable('createPaymentOrder');
    const orderResponse = await createPaymentOrder({
      planType,
      amount: plan.price,
      clientId,
      clientName
    });
    
    const orderData = orderResponse.data;
    if (!orderData || !orderData.orderId) throw new Error('Invalid response from payment order creation');
    
    // Configure Razorpay
    const options = {
      key: 'rzp_test_k2If7sWFzrbatR',
      amount: orderData.amount * 100,
      currency: orderData.currency || 'INR',
      name: 'SnapSelect',
      description: `${plan.name} Plan for ${clientName}`,
      order_id: orderData.orderId,
      handler: function(response) {
        verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
      },
      prefill: {
        name: document.getElementById('userName').textContent,
        email: currentUser.email || '',
      },
      theme: { color: '#4A90E2' },
      modal: {
        ondismiss: function() {
          resetPaymentButtons();
        }
      }
    };
    
    const razorpay = new Razorpay(options);
    razorpay.open();
    
  } catch (error) {
    console.error('Payment process error:', error);
    showPaymentError(`Payment failed: ${error.message}`);
    setTimeout(resetPaymentButtons, 3000);
  }
}

async function verifyPayment(orderId, paymentId, signature) {
  try {
    showPaymentProgress('Verifying payment...');
    
    const functions = firebase.app().functions('asia-south1');
    const verifyPaymentFunc = functions.httpsCallable('verifyPayment');
    const result = await verifyPaymentFunc({
      orderId,
      paymentId,
      signature
    });
    
    const responseData = result.data;
    
    if (responseData && responseData.success) {
      showPaymentSuccess(`Payment successful! The ${SUBSCRIPTION_PLANS[responseData.planType]?.name || responseData.planType} plan has been activated for your client.`);
      
      setTimeout(() => {
        hideUpgradeModal();
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

// UI feedback functions
function showPaymentProgress(message) {
  const progressEl = document.querySelector('.payment-progress');
  if (progressEl) {
    progressEl.textContent = message;
    progressEl.style.display = 'block';
  }
  
  const successEl = document.querySelector('.payment-success');
  if (successEl) successEl.style.display = 'none';
  
  const errorEl = document.querySelector('.payment-error');
  if (errorEl) errorEl.style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }
}

function showPaymentSuccess(message) {
  const successEl = document.querySelector('.payment-success');
  if (successEl) {
    successEl.textContent = message;
    successEl.style.display = 'block';
  }
  
  const progressEl = document.querySelector('.payment-progress');
  if (progressEl) progressEl.style.display = 'none';
  
  const errorEl = document.querySelector('.payment-error');
  if (errorEl) errorEl.style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Upgrade Complete!';
  }
}

function showPaymentError(message) {
  const errorEl = document.querySelector('.payment-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  
  const progressEl = document.querySelector('.payment-progress');
  if (progressEl) progressEl.style.display = 'none';
  
  const successEl = document.querySelector('.payment-success');
  if (successEl) successEl.style.display = 'none';
  
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Try Again';
  }
}

function resetPaymentButtons() {
  const confirmBtn = document.getElementById('confirmUpgradeBtn');
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Upgrade Now';
  }
}

// Plan management
function confirmCancelPlan(planId, clientId) {
  if (confirm('Are you sure you want to cancel this plan? This action cannot be undone.')) {
    cancelClientPlan(planId, clientId);
  }
}

async function cancelClientPlan(planId, clientId) {
  try {
    showLoadingOverlay('Canceling plan...');
    
    const functions = firebase.app().functions('asia-south1');
    const cancelPlanFunc = functions.httpsCallable('cancelClientPlan');
    const result = await cancelPlanFunc({
      clientId,
      reason: 'User requested cancellation'
    });
    
    if (result.data && result.data.success) {
      showSuccessMessage('Plan canceled successfully');
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

// Loading and notification utilities

// Improved loading overlay with timeout protection
function showLoadingOverlay(message) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (!loadingOverlay) return;
  
  const loadingText = loadingOverlay.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = message || 'Loading...';
  
  loadingOverlay.style.display = 'flex';
  
  // Add safety timeout to hide loading overlay after 10 seconds
  // This prevents the UI from being stuck in loading state forever
  clearTimeout(window.loadingTimeout);
  window.loadingTimeout = setTimeout(() => {
    hideLoadingOverlay();
    showErrorMessage('Operation timed out. Please try again.');
  }, 10000);
}

function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
  
  // Clear the safety timeout
  clearTimeout(window.loadingTimeout);
}

function showSuccessMessage(message) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.innerHTML = `<i class="fas fa-check-circle"></i><span>${message}</span>`;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => { toast.remove(); }, 300);
  }, 3000);
}

function showErrorMessage(message) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>${message}</span>`;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => { toast.remove(); }, 300);
  }, 3000);
}

// Add a function to refresh all data
function refreshAllData() {
  showLoadingOverlay('Refreshing data...');
  
  Promise.all([
    loadUserData(),
    loadClientData(),
    loadActivePlans()
  ])
  .then(() => {
    hideLoadingOverlay();
  })
  .catch(error => {
    console.error('Error refreshing data:', error);
    showErrorMessage('Failed to refresh your data.');
    hideLoadingOverlay();
  });
}

/**
 * Update storage usage display
 */

function updateStorageUsage() {
  try {
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
    if (storageBarEl) {
      if (usagePercent > 90) {
        storageBarEl.classList.add('high-usage');
      } else {
        storageBarEl.classList.remove('high-usage');
      }
    }
  } catch (error) {
    console.error('Error updating storage usage:', error);
    // Don't throw error here to prevent breaking the UI
  }
}

// Initialize on document ready
document.addEventListener('DOMContentLoaded', initSubscriptionManager);

// Export global functions
window.subscriptionManager = {
  updatePlanDisplay,
  refreshSubscription: refreshAllData,
  getPlanDetails: (planType) => SUBSCRIPTION_PLANS[planType] || null,
  showUpgradeModal,
  hideUpgradeModal,
  createClient,
  cancelClientPlan
};

// Export subscription plans
window.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
