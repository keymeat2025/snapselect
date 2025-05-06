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

// Error handling function
function handleError(error, context) {
  console.error(`Error in ${context}:`, error);
  
  // Show user-friendly error
  let userMessage = 'An error occurred. Please try again.';
  
  if (error.code === 'permission-denied') {
    userMessage = 'You don\'t have permission to perform this action.';
  } else if (error.code === 'network-error' || (error.message && error.message.includes('network'))) {
    userMessage = 'Network error. Please check your connection.';
  } else if (error.code === 'quota-exceeded') {
    userMessage = 'You\'ve reached your plan limit. Please upgrade.';
  }
  
  // Use NotificationSystem if available, otherwise use showErrorMessage
  if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
    window.NotificationSystem.showNotification('error', 'Error', userMessage);
  } else {
    showErrorMessage(userMessage);
  }
  
  // Log error for debugging
  if (firebase && firebase.auth && firebase.auth().currentUser) {
    firebase.firestore().collection('error_logs').add({
      userId: firebase.auth().currentUser.uid,
      error: error.toString(),
      context: context,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.error('Error logging error:', err));
  }
}

// Initialize subscription manager with enhanced error handling
async function initSubscriptionManager() {
  try {
    // Show loading overlay at the start
    showLoadingOverlay('Initializing...');
    
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        currentUser = user;
        
        try {
          // Check if SecurityManager exists before calling methods
          if (window.SecurityManager && typeof window.SecurityManager.init === 'function') {
            window.SecurityManager.init();
          }
          
          // Check if PerformanceManager exists before calling methods
          const cachedClients = window.PerformanceManager && typeof window.PerformanceManager.getCachedData === 'function' 
            ? window.PerformanceManager.getCachedData('user_clients') 
            : null;
            
          const cachedPlans = window.PerformanceManager && typeof window.PerformanceManager.getCachedData === 'function'
            ? window.PerformanceManager.getCachedData('active_plans')
            : null;
          
          if (cachedClients) {
            userClients = cachedClients;
            updateClientDropdown();
            updateClientList();
          }
          
          if (cachedPlans) {
            activePlans = cachedPlans;
            updateActivePlansDisplay();
            updateStorageUsage();
          } else {
            // Set default empty array if no cached plans
            activePlans = [];
          }
          
          // Load fresh data
          try {
            await Promise.all([
              loadUserData(),
              loadClientData(),
              loadActivePlans()
            ]);
          } catch (loadError) {
            console.error('Error loading data:', loadError);
            // Try to update UI elements even if some data loading failed
            updateClientDropdown();
            updateClientList();
            updateActivePlansDisplay();
            updateStorageUsage();
          }
          
          // Update dashboard stats after loading data
          updateDashboardStats();
          
          // Cache the new data if PerformanceManager exists
          if (window.PerformanceManager && typeof window.PerformanceManager.cacheData === 'function') {
            window.PerformanceManager.cacheData('user_clients', userClients);
            window.PerformanceManager.cacheData('active_plans', activePlans);
          }
          
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
  
  // Gallery buttons
  const createGalleryBtn = document.getElementById('createGalleryBtn');
  if (createGalleryBtn) createGalleryBtn.addEventListener('click', showCreateGalleryModal);
  
  const emptyStateCreateGalleryBtn = document.getElementById('emptyStateCreateGalleryBtn');
  if (emptyStateCreateGalleryBtn) emptyStateCreateGalleryBtn.addEventListener('click', showCreateGalleryModal);
  
  // Gallery form submission
  const createGalleryForm = document.getElementById('createGalleryForm');
  if (createGalleryForm) {
    createGalleryForm.addEventListener('submit', handleGalleryFormSubmit);
  }
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
    updateDashboardStats(); // Add this call to update dashboard stats
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
    
    if (plansSnapshot.empty) {
      console.log('No active plans found for this user');
      updateActivePlansDisplay();
      updateStorageUsage();
      return;
    }
    
    plansSnapshot.forEach(doc => {
      const planData = { id: doc.id, ...doc.data() };
      
      // Ensure storageUsed exists (default to 0 if not present)
      if (typeof planData.storageUsed === 'undefined') {
        planData.storageUsed = 0;
        
        // Consider updating in Firestore to ensure persistence
        // Only if the plan should have storage data
        if (planData.status === PLAN_STATUS.ACTIVE) {
          console.log(`Adding missing storageUsed field to plan ${planData.id}`);
          db.collection('client-plans').doc(doc.id).update({
            storageUsed: 0
          }).catch(err => console.error('Error updating plan with storage field:', err));
        }
      }
      
      activePlans.push(planData);
      
      // Create notification for expiring plans
      if (planData.status === PLAN_STATUS.EXPIRING_SOON && 
          planData.daysLeftBeforeExpiration <= 7 &&
          !localStorage.getItem(`plan_expiry_notified_${planData.id}`)) {
        
        if (window.NotificationSystem) {
          const client = userClients.find(c => c.id === planData.clientId);
          window.NotificationSystem.createNotificationFromEvent({
            type: 'plan_expiring',
            planName: SUBSCRIPTION_PLANS[planData.planType]?.name || planData.planType,
            clientName: client?.name || planData.clientName || 'your client',
            daysLeft: planData.daysLeftBeforeExpiration
          });
        }
        
        localStorage.setItem(`plan_expiry_notified_${planData.id}`, 'true');
      }
    });
    
    updateActivePlansDisplay();
    updateStorageUsage();
    updateDashboardStats(); // Add this call to update dashboard stats
  } catch (error) {
    console.error('Error loading active plans:', error);
    // Even in case of error, try to update UI with whatever data we have
    updateActivePlansDisplay();
    updateStorageUsage();
    throw error; // Re-throw to be caught by the Promise.all
  }
}

/**
 * Update dashboard statistics
 */
function updateDashboardStats() {
  try {
    // Update active clients count
    const activeClientsCount = document.getElementById('activeClientsCount');
    if (activeClientsCount) {
      // Count clients with active plans
      const activeClients = userClients.filter(client => client.planActive).length;
      activeClientsCount.textContent = activeClients;
    }
    
    // Update active galleries count
    const activeGalleriesCount = document.getElementById('activeGalleriesCount');
    if (activeGalleriesCount) {
      // Count active galleries from plans data
      const activeGalleries = activePlans.length; // Each plan typically has one gallery
      activeGalleriesCount.textContent = activeGalleries;
    }
    
    // Note: Storage usage is already handled in updateStorageUsage()
  } catch (error) {
    console.error('Error updating dashboard stats:', error);
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
    
    // Add notification for client creation
    if (window.NotificationSystem) {
      window.NotificationSystem.createNotificationFromEvent({
        type: 'client_created',
        clientName: name || email || 'New client'
      });
    }
    
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

  const planNameElement = document.getElementById('selectedPlanName');
  const planPriceElement = document.getElementById('selectedPlanPrice');
  
  if (planNameElement) planNameElement.textContent = planDetails.name;
  if (planPriceElement) planPriceElement.textContent = `₹${planDetails.price}/${planDetails.priceType}`;

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
    
    // Fix: Ensure selectedClient is properly handled
    if (!selectedClient || selectedClient === 'undefined' || selectedClient === '') {
      selectedClient = null;
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
    } else if (clientId) {
      const client = userClients.find(c => c.id === clientId);
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
    
    // Fix: Ensure clientId is properly passed
    const orderResponse = await createPaymentOrder({
      planType,
      amount: plan.price,
      clientId: clientId || null, // Explicitly set to null if not provided
      clientName: clientName || ''
    });
    
    const orderData = orderResponse.data;
    if (!orderData || !orderData.orderId) throw new Error('Invalid response from payment order creation');
    
    // Configure Razorpay
    const options = {
      key: 'rzp_test_k2If7sWFzrbatR',
      amount: orderData.amount * 100,
      currency: orderData.currency || 'INR',
      name: 'SnapSelect',
      description: `${plan.name} Plan for ${clientName || 'Default Plan'}`,
      order_id: orderData.orderId,
      handler: function(response) {
        verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
      },
      prefill: {
        name: document.getElementById('userName')?.textContent || '',
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
      
      // Add notification for successful payment
      if (window.NotificationSystem) {
        window.NotificationSystem.createNotificationFromEvent({
          type: 'payment_successful',
          amount: SUBSCRIPTION_PLANS[responseData.planType]?.price || 0,
          planName: SUBSCRIPTION_PLANS[responseData.planType]?.name || responseData.planType,
          clientName: document.getElementById('clientSelect')?.options[document.getElementById('clientSelect')?.selectedIndex]?.text || 'your client'
        });
        
        window.NotificationSystem.createNotificationFromEvent({
          type: 'plan_purchased',
          planName: SUBSCRIPTION_PLANS[responseData.planType]?.name || responseData.planType,
          clientName: document.getElementById('clientSelect')?.options[document.getElementById('clientSelect')?.selectedIndex]?.text || 'your client'
        });
      }
      
      setTimeout(() => {
        hideUpgradeModal();
        loadClientData();
        loadActivePlans();
        updateDashboardStats(); // Add this call to update dashboard stats after plan purchase
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
      
      // Add notification for plan cancellation
      if (window.NotificationSystem) {
        const plan = activePlans.find(p => p.id === planId);
        const client = userClients.find(c => c.id === clientId);
        if (plan && client) {
          window.NotificationSystem.createNotificationFromEvent({
            type: 'info',
            title: 'Plan Canceled',
            message: `The ${SUBSCRIPTION_PLANS[plan.planType]?.name || plan.planType} plan for ${client.name || 'your client'} has been canceled.`
          });
        }
      }
      
      loadClientData();
      loadActivePlans();
      updateDashboardStats(); // Add this call to update dashboard stats after cancellation
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
  // Try to use NotificationSystem if available
  if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
    window.NotificationSystem.showNotification('success', 'Success', message);
    return;
  }
  
  // Fallback to custom toast
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
  // Try to use NotificationSystem if available
  if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
    window.NotificationSystem.showNotification('error', 'Error', message);
    return;
  }
  
  // Fallback to custom toast
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
    updateDashboardStats(); // Add this call to update dashboard stats after refresh
    hideLoadingOverlay();
    showSuccessMessage('Data refreshed successfully');
  })
  .catch(error => {
    console.error('Error refreshing data:', error);
    showErrorMessage('Failed to refresh your data.');
    hideLoadingOverlay();
  });
}

/**
 * Update storage usage display
 * Fixed to handle empty state and ensure proper display of small values
 */
function updateStorageUsage() {
  try {
    // Check if storage element exists
    const storageUsedElement = document.getElementById('storageUsed');
    const storageBarElement = document.getElementById('storageUsageBar');
    const storageUsageTextElement = document.getElementById('storageUsageText');
    
    if (!storageUsedElement || !storageBarElement) return;
    
    // Get storage from all sources
    let storageUsed = 0;
    let totalLimit = 0;
    
    // Calculate used storage and limits from active plans
    if (activePlans && activePlans.length > 0) {
      storageUsed = activePlans.reduce((total, plan) => 
        total + (plan.storageUsed || 0), 0
      );
      
      totalLimit = activePlans.reduce((total, plan) => 
        total + (SUBSCRIPTION_PLANS[plan.planType]?.storageLimit || 0), 0
      );
    }
    
    // Ensure we have at least a minimum limit to avoid division by zero
    totalLimit = totalLimit || 1; // Default to 1 GB if no plans exist
    
    // Convert storage to GB for display (from MB)
    const storageGB = (storageUsed / 1024).toFixed(2);
    
    // Always show at least 0.01 GB if any storage is used but less than 0.01 GB
    const displayStorageGB = storageUsed > 0 && storageGB === "0.00" ? "0.01" : storageGB;
    
    // Update the storage text display
    storageUsedElement.textContent = `${displayStorageGB} GB`;
    
    // Set storage usage text if the element exists
    if (storageUsageTextElement) {
      storageUsageTextElement.textContent = `${displayStorageGB}/${totalLimit} GB`;
    }
    
    // Calculate percentage - ensure it's always at least 1% if there's any usage
    // This makes the bar visible even with minimal usage
    let usagePercent = (storageUsed / (totalLimit * 1024)) * 100;
    
    // Make sure small values show at least a tiny bar (minimum 1%)
    if (storageUsed > 0 && usagePercent < 1) {
      usagePercent = 1;
    }
    
    // Cap at 100% for safety
    usagePercent = Math.min(usagePercent, 100);
    
    // Update progress bar width
    storageBarElement.style.width = `${usagePercent}%`;
    
    // Add warning colors
    storageBarElement.classList.remove('warning', 'critical');
    if (usagePercent > 90) {
      storageBarElement.classList.add('critical');
    } else if (usagePercent > 75) {
      storageBarElement.classList.add('warning');
    }
    
    // Add notification for storage warning
    if (usagePercent > 80 && !localStorage.getItem('storageWarningShown')) {
      if (window.NotificationSystem) {
        window.NotificationSystem.createNotificationFromEvent({
          type: 'storage_warning',
          percentage: usagePercent.toFixed(0)
        });
      }
      localStorage.setItem('storageWarningShown', 'true');
    }
    
    // Log storage information for debugging
    console.log('Storage information:', {
      storageUsed: storageUsed,
      storageGB: storageGB,
      totalLimitGB: totalLimit,
      usagePercent: usagePercent,
      plans: activePlans.length
    });
    
  } catch (error) {
    console.error('Error updating storage usage:', error);
    
    // Fallback to show default values in case of error
    const storageUsedElement = document.getElementById('storageUsed');
    if (storageUsedElement) {
      storageUsedElement.textContent = '0.00 GB';
    }
    
    const storageBarElement = document.getElementById('storageUsageBar');
    if (storageBarElement) {
      storageBarElement.style.width = '0%';
    }
    
    const storageUsageTextElement = document.getElementById('storageUsageText');
    if (storageUsageTextElement) {
      storageUsageTextElement.textContent = '0/1 GB';
    }
  }
}

/**
 * Helper function to manually set storage for debugging or initial setup
 * Can be called from the console to simulate storage usage
 */
function setDebugStorageUsage(usedMB) {
  try {
    // Set a debug flag to indicate manual override
    window.debugStorageOverride = true;
    
    // Create a mock plan if no plans exist
    if (!activePlans || activePlans.length === 0) {
      activePlans = [{
        planType: 'basic',
        storageUsed: usedMB || 100, // Default to 100MB if no value provided
        status: PLAN_STATUS.ACTIVE
      }];
    } else {
      // Update the first plan's storage
      activePlans[0].storageUsed = usedMB || 100;
    }
    
    // Update the display
    updateStorageUsage();
    
    console.log(`Debug: Storage set to ${usedMB || 100}MB`);
    return true;
  } catch (error) {
    console.error('Error setting debug storage:', error);
    return false;
  }
}

// Define a viewClient function if needed
function viewClient(clientId) {
  if (!clientId) return;
  
  // This function would navigate to a client view page
  // For now, just show a message
  showSuccessMessage(`Viewing client ${clientId}`);
  
  // In the future, you could implement:
  // window.location.href = `/client-view.html?id=${clientId}`;
}

// Define a showExtendPlanModal function if needed
function showExtendPlanModal(planId, clientId) {
  if (!planId || !clientId) return;
  
  // This could show a modal for extending the plan
  // For now, just show a message
  showSuccessMessage(`Extend plan modal would show for plan ${planId}, client ${clientId}`);
}

/**
 * NEW FUNCTIONS FOR GALLERY MANAGEMENT
 */

/**
 * Updates the gallery client dropdown to only show clients with active plans
 * Called when the Create Gallery modal is opened
 */
function updateGalleryClientDropdown() {
  const galleryClientSelect = document.getElementById('galleryClient');
  if (!galleryClientSelect) return;
  
  // Clear existing options
  galleryClientSelect.innerHTML = '<option value="">Select a client</option>';
  
  // Check if we have clients data
  if (!userClients || userClients.length === 0) {
    const option = document.createElement('option');
    option.disabled = true;
    option.textContent = 'No clients available';
    galleryClientSelect.appendChild(option);
    return;
  }
  
  // Filter only clients with active plans
  const activeClients = userClients.filter(client => client.planActive === true);
  
  if (activeClients.length === 0) {
    const option = document.createElement('option');
    option.disabled = true;
    option.textContent = 'No clients with active plans';
    galleryClientSelect.appendChild(option);
    
    // Show helpful message
    showErrorMessage('You need clients with active plans to create galleries');
  } else {
    // Add active clients to the dropdown
    activeClients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = `${client.name || client.email || 'Client'} (${client.planType || 'Active'} Plan)`;
      galleryClientSelect.appendChild(option);
    });
  }
}

/**
 * Event handler to open the Create Gallery modal
 */
function showCreateGalleryModal() {
  // Get the modal element
  const createGalleryModal = document.getElementById('createGalleryModal');
  if (!createGalleryModal) return;
  
  // First update the client dropdown with active clients
  updateGalleryClientDropdown();
  
  // Then show the modal
  createGalleryModal.style.display = 'block';
}

/**
 * Handle gallery form submission
 */
function handleGalleryFormSubmit(e) {
  e.preventDefault();
  
  const galleryName = document.getElementById('galleryName').value;
  const clientId = document.getElementById('galleryClient').value;
  const galleryDescription = document.getElementById('galleryDescription').value;
  
  if (!galleryName) {
    showErrorMessage('Please enter a gallery name');
    return;
  }
  
  if (!clientId) {
    showErrorMessage('Please select a client');
    return;
  }
  
  // Show loading overlay
  showLoadingOverlay('Creating gallery...');
  
  // Get client info
  const client = userClients.find(c => c.id === clientId);
  
  // Create new gallery
  createGallery(galleryName, clientId, galleryDescription)
    .then(galleryId => {
      if (galleryId) {
        // Show success message
        showSuccessMessage(`Gallery "${galleryName}" created successfully`);
        
        // Add notification for gallery creation
        if (window.NotificationSystem) {
          window.NotificationSystem.createNotificationFromEvent({
            type: 'gallery_created',
            galleryName: galleryName,
            clientName: client?.name || 'your client'
          });
        }
        
        // Close the modal
        const createGalleryModal = document.getElementById('createGalleryModal');
        if (createGalleryModal) createGalleryModal.style.display = 'none';
        
        // Reset the form
        document.getElementById('createGalleryForm').reset();
        
        // Refresh data
        refreshAllData();
      }
    })
    .catch(error => {
      console.error('Error creating gallery:', error);
      showErrorMessage(`Error creating gallery: ${error.message}`);
    })
    .finally(() => {
      hideLoadingOverlay();
    });
}

/**
 * Create a new gallery for a client
 */
async function createGallery(name, clientId, description = '') {
  try {
    if (!currentUser) return null;
    
    // Validate client has active plan
    const client = userClients.find(c => c.id === clientId);
    if (!client) {
      throw new Error('Client not found');
    }
    
    if (!client.planActive) {
      throw new Error('Client does not have an active plan');
    }
    
    const plan = activePlans.find(p => p.clientId === clientId);
    if (!plan) {
      throw new Error('No active plan found for this client');
    }
    
    const db = firebase.firestore();
    const galleryRef = await db.collection('galleries').add({
      name,
      description,
      clientId,
      photographerId: currentUser.uid,
      planId: plan.id,
      planType: plan.planType,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      photosCount: 0,
      status: 'active'
    });
    
    // Update plan to reference the gallery
    await db.collection('client-plans').doc(plan.id).update({
      galleryId: galleryRef.id,
      galleryCreated: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return galleryRef.id;
  } catch (error) {
    console.error('Error creating gallery:', error);
    throw error;
  }
}

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Subscription manager initializing...');
  
  // Check if required JS libraries are loaded
  const requiredLibraries = {
    firebase: typeof firebase !== 'undefined',
    razorpay: typeof Razorpay !== 'undefined',
    performanceManager: typeof window.PerformanceManager !== 'undefined',
    securityManager: typeof window.SecurityManager !== 'undefined',
    notificationSystem: typeof window.NotificationSystem !== 'undefined'
  };
  
  console.log('Required libraries status:', requiredLibraries);
  
  // Try to initialize anyway
  initSubscriptionManager();
});

// Export global functions
window.subscriptionManager = {
  updatePlanDisplay,
  refreshSubscription: refreshAllData,
  getPlanDetails: (planType) => SUBSCRIPTION_PLANS[planType] || null,
  showUpgradeModal,
  hideUpgradeModal,
  createClient,
  cancelClientPlan,
  updateDashboardStats,
  // Add debug functions for testing
  setDebugStorageUsage,
  updateStorageUsage,
  // Add gallery functions
  updateGalleryClientDropdown,
  showCreateGalleryModal,
  createGallery
};

// Export subscription plans
window.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;
