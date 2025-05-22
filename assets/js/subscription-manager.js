 /**
 * subscription-manager.js - Manages client-based plan purchases for photographers
 */
// Global variables for filtered plans
let allPlans = [];
let activeFilter = 'all';
let searchTerm = '';
let currentSortOption = 'recent';


// Plan status constants
const PLAN_STATUS = {
  CREATED: 'created', PENDING: 'pending', ACTIVE: 'active', FAILED: 'failed',
  EXPIRED: 'expired', CANCELED: 'canceled', REFUNDED: 'refunded', EXPIRING_SOON: 'expiring_soon'
};

const SHARING_STATUS = {
  NOTSHARED: 'not shared',
  SHARED: 'shared',
  DISABLED: 'disabled'
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
// Add tracking variables for dashboard stats
let totalStorageLimit = 0;
let activeGalleriesCount = 0;
let totalGalleriesCount = 0;
let isUpdatingGalleryDropdown = false; // Flag to prevent duplicate execution

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
    // In the setupEventListeners() function, add this:
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('view-gallery-btn')) {
      const clientId = e.target.getAttribute('data-client-id');
      if (clientId) viewGallery(clientId);
    }
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
/**
 * Navigate to the gallery view page for a specific client's gallery
 * @param {string} clientId - The ID of the client whose gallery to view
 */



function viewGallery(clientId) {
  if (!clientId) {
    showErrorMessage('Could not find gallery details');
    return;
  }
  
  // Show loading overlay while we get the gallery info
  showLoadingOverlay('Fetching gallery details...');
  
  // Find the client
  const client = userClients.find(c => c.id === clientId);
  if (!client) {
    hideLoadingOverlay();
    showErrorMessage('Client not found');
    return;
  }
  
  // Find the client's plan
  const plan = activePlans.find(p => p.clientId === clientId);
  if (!plan) {
    hideLoadingOverlay();
    showErrorMessage('No active plan found for this client');
    return;
  }
  
  // Check if plan has a gallery
  if (!plan.galleryId) {
    // Try to fetch gallery by client ID
    findGalleryByClientId(clientId)
      .then(galleryId => {
        if (galleryId) {
          // Navigate to gallery view page with correct absolute path
          window.location.href = `/snapselect/pages/gallery-view.html?id=${galleryId}&client=${clientId}`;
        } else {
          showErrorMessage('No gallery found for this client. Create a gallery first.');
          hideLoadingOverlay();
        }
      })
      .catch(error => {
        console.error('Error finding gallery:', error);
        showErrorMessage('Error finding gallery details');
        hideLoadingOverlay();
      });
  } else {
    // Navigate directly to gallery view page with correct absolute path
    window.location.href = `/snapselect/pages/gallery-view.html?id=${plan.galleryId}&client=${clientId}`;
    hideLoadingOverlay();
  }
}

/**
 * Find a gallery by client ID
 * @param {string} clientId - The client ID to search for
 * @returns {Promise<string|null>} - Returns gallery ID if found, null otherwise
 */

async function findGalleryByClientId(clientId) {
  try {
    if (!currentUser || !clientId) return null;
    
    const db = firebase.firestore();
    const gallerySnapshot = await db.collection('galleries')
      .where('clientId', '==', clientId)
      .where('photographerId', '==', currentUser.uid)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (gallerySnapshot.empty) {
      console.log('No gallery found for client:', clientId);
      return null;
    }
    
    // Return the first gallery ID found
    return gallerySnapshot.docs[0].id;
  } catch (error) {
    console.error('Error finding gallery by client ID:', error);
    throw error;
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
    
    // Get active and expiring soon plans
    const activePlansSnapshot = await db.collection('client-plans')
      .where('photographerId', '==', currentUser.uid)
      .where('status', 'in', [PLAN_STATUS.ACTIVE, PLAN_STATUS.EXPIRING_SOON])
      .get();
    
    // Get expired plans (separate query)
    const expiredPlansSnapshot = await db.collection('client-plans')
      .where('photographerId', '==', currentUser.uid)
      .where('status', '==', PLAN_STATUS.EXPIRED)
      .get();
    
    // Reset plans arrays
    activePlans = []; // Keep this for compatibility
    allPlans = [];
    totalStorageLimit = 0;
    
    if (activePlansSnapshot.empty && expiredPlansSnapshot.empty) {
      console.log('No plans found for this user');
      updateActivePlansDisplay(); // Keep this for compatibility
      updateStorageUsage();
      filterAndDisplayPlans(); // Add this for the new UI
      return;
    }
    
    // Process active plans and check for sharing data
    for (const doc of activePlansSnapshot.docs) {
      const planData = { id: doc.id, ...doc.data() };
      
      // Ensure storageUsed exists (default to 0 if not present)
      if (typeof planData.storageUsed === 'undefined') {
        planData.storageUsed = 0;
      }
      
      // CHECK FOR REAL SHARING DATA FROM DATABASE
      if (planData.sharingEnabled === true && planData.shareId) {
        try {
          // Verify the share actually exists in galleryShares collection
          const shareQuery = await db.collection('galleryShares')
            .doc(planData.shareId)
            .get();
          
          if (shareQuery.exists) {
            // Real share exists - keep the sharing data
            console.log("Found real sharing data for plan:", planData.id, "ShareID:", planData.shareId);
            planData.shareUrl = `${window.location.origin}/snapselect/pages/client-gallery-view.html?share=${planData.shareId}`;
          } else {
            // Share document doesn't exist - disable sharing
            console.log("Share document not found for plan:", planData.id, "- disabling sharing");
            planData.sharingEnabled = false;
            planData.shareId = null;
            planData.shareUrl = null;
          }
        } catch (error) {
          console.error("Error checking share data for plan:", planData.id, error);
          planData.sharingEnabled = false;
          planData.shareId = null;
          planData.shareUrl = null;
        }
      }
      
      // Add to arrays
      activePlans.push(planData);
      allPlans.push(planData);
      
      // Add to total storage limit
      if (planData.planType && SUBSCRIPTION_PLANS[planData.planType]) {
        totalStorageLimit += SUBSCRIPTION_PLANS[planData.planType].storageLimit || 0;
      }
      
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
    }
    
    // Process expired plans
    expiredPlansSnapshot.forEach(doc => {
      const planData = { id: doc.id, ...doc.data() };
      
      // Ensure storageUsed exists
      if (typeof planData.storageUsed === 'undefined') {
        planData.storageUsed = 0;
      }
      
      allPlans.push(planData);
    });

    // Update UI
    updateStorageUsage();
    filterAndDisplayPlans(); // Only use this for the updated UI
    updateDashboardStats();
    
  } catch (error) {
    console.error('Error loading plans:', error);
    // Even in case of error, try to update UI with whatever data we have
    updateActivePlansDisplay();
    updateStorageUsage();
    filterAndDisplayPlans();
  }
}

/**
 * Update dashboard statistics with total counts
 */
function updateDashboardStats() {
  try {
    // Update active clients count
    const activeClientsCount = document.getElementById('activeClientsCount');
    if (activeClientsCount) {
      // Count clients with active plans
      const activeClients = userClients.filter(client => client.planActive).length;
      activeClientsCount.textContent = `${activeClients}/${userClients.length}`;
    }
    
    // Update active galleries count
    const activeGalleriesCount = document.getElementById('activeGalleriesCount');
    if (activeGalleriesCount) {
      // Count active galleries from plans data
      const galleryCount = activePlans.length; // Each active plan typically has one gallery
      
      // For total galleries, we would need to query all galleries, but for now
      // we can use a simple estimation based on plans and client counts
      // This could be replaced with an actual gallery count query in the future
      const estimatedTotalGalleries = Math.max(galleryCount, userClients.length);
      
      activeGalleriesCount.textContent = `${galleryCount}/${estimatedTotalGalleries}`;
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
           //<button class="btn cancel-plan-btn" data-plan-id="${plan.id}" data-client-id="${plan.clientId}">Cancel Plan</button>` : ''}
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


/**
 * Check if a client with the given name already exists
 * @param {string} clientName - The name to check for duplicates
 * @returns {Promise<boolean>} - True if a duplicate exists, false otherwise
 */

// Add this function to subscription-manager.js
/**
 * Check if a client with the given name already exists
 */


// Client management

async function createClient(name, email, additionalData = {}) {
  try {
    if (!currentUser) return null;
    
    const db = firebase.firestore();
    const clientRef = await db.collection('clients').add({
      name, 
      email,
      photographerId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      planActive: false,
      ...additionalData // This spreads the additional data into the client object
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


function showInfoMessage(message) {
  // Try to use NotificationSystem if available
  if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
    window.NotificationSystem.showNotification('info', 'Information', message);
    return;
  }
  
  // Fallback to custom toast
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-info';
  toast.innerHTML = `<i class="fas fa-info-circle"></i><span>${message}</span>`;
  
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
 * Updated to show total storage limit from all plans
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
    
    // Calculate used storage from active plans
    if (activePlans && activePlans.length > 0) {
      storageUsed = activePlans.reduce((total, plan) => 
        total + (plan.storageUsed || 0), 0
      );
    }
    
    // Ensure we have at least a minimum limit to avoid division by zero
    if (totalStorageLimit <= 0) {
      totalStorageLimit = 1; // Default to 1 GB if no plans exist
    }
    
    // Convert storage to GB for display (from MB)
    const storageGB = (storageUsed / 1024).toFixed(2);
    
    // Always show at least 0.01 GB if any storage is used but less than 0.01 GB
    const displayStorageGB = storageUsed > 0 && storageGB === "0.00" ? "0.01" : storageGB;
    
    // Update the storage text display with active/total format
    storageUsedElement.textContent = `${displayStorageGB}/${totalStorageLimit} GB`;
    
    // Set storage usage text if the element exists
    if (storageUsageTextElement) {
      storageUsageTextElement.textContent = `${displayStorageGB}/${totalStorageLimit} GB`;
    }
    
    // Calculate percentage - ensure it's always at least 1% if there's any usage
    // This makes the bar visible even with minimal usage
    let usagePercent = (storageUsed / (totalStorageLimit * 1024)) * 100;
    
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
      totalLimitGB: totalStorageLimit,
      usagePercent: usagePercent,
      plans: activePlans.length
    });
    
  } catch (error) {
    console.error('Error updating storage usage:', error);
    
    // Fallback to show default values in case of error
    const storageUsedElement = document.getElementById('storageUsed');
    if (storageUsedElement) {
      storageUsedElement.textContent = '0.00/1 GB';
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
  
  // Find the plan based on planId
  const plan = allPlans.find(p => p.id === planId);
  if (!plan) {
    showErrorMessage('Plan details not found.');
    return;
  }
  
  // Find the client name
  const client = userClients.find(c => c.id === clientId);
  const clientName = client?.name || plan.clientName || 'Unknown Client';
  
  // Get formatted expiry date
  const expiryDate = plan.planEndDate?.toDate().toLocaleDateString() || 'Unknown';
  
  // Check if plan is active and not in expiring_soon status
  if (plan.status === PLAN_STATUS.ACTIVE) {
    // Show notification that plan is active and cannot be extended yet
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'info',
        'Plan is Active',
        `This plan is currently active until ${expiryDate}. You can extend it when it's closer to expiration.`
      );
    } else {
      // Fallback to built-in alert if NotificationSystem is not available
      showSuccessMessage(`This plan is active until ${expiryDate}. You can extend it when it's closer to expiration.`);
    }
    return;
  }
  
  // If the plan is in EXPIRING_SOON status, show the extension modal
  if (plan.status === PLAN_STATUS.EXPIRING_SOON) {
    // TODO: Implement actual extension modal here
    showSuccessMessage(`Extension options for ${clientName}'s plan will be available here.`);
    return;
  }
  
  // If the plan is already expired, redirect to renewal
  if (plan.status === PLAN_STATUS.EXPIRED) {
    showUpgradeModal(clientId);
    return;
  }
}

/**
 * NEW FUNCTIONS FOR GALLERY MANAGEMENT
 */

/**
 * Updates the gallery client dropdown to only show clients with valid active plans
 * Called when the Create Gallery modal is opened
 * Fixed to prevent duplicate execution
 */
function updateGalleryClientDropdown() {
  // Check if update is already in progress
  if (isUpdatingGalleryDropdown) {
    console.log("Gallery dropdown update already in progress, skipping");
    return;
  }
  
  isUpdatingGalleryDropdown = true;
  
  try {
    const galleryClientSelect = document.getElementById('galleryClient');
    if (!galleryClientSelect) {
      isUpdatingGalleryDropdown = false;
      return;
    }
    
    // Clear existing options
    galleryClientSelect.innerHTML = '<option value="">Select a client</option>';
    
    console.log('Starting gallery client dropdown update');
    console.log('All clients:', userClients);
    console.log('All active plans:', activePlans);
    
    // First check - do we have any clients?
    if (!userClients || userClients.length === 0) {
      console.log('No clients found at all');
      const option = document.createElement('option');
      option.disabled = true;
      option.textContent = 'No clients available';
      galleryClientSelect.appendChild(option);
      
      showErrorMessage('Please create a client first');
      isUpdatingGalleryDropdown = false;
      return;
    }
    
    // Second check - check both client.planActive flag AND active plans array
    // This handles potential data inconsistencies
    let clientsForGallery = [];
    
    // First try clients with matching active plans in the activePlans array
    if (activePlans && activePlans.length > 0) {
      console.log('Found active plans, checking for matching clients');
      
      // Filter clients that have plans in the activePlans array
      const clientsWithActivePlans = userClients.filter(client => 
        activePlans.some(plan => 
          plan.clientId === client.id && 
          (plan.status === PLAN_STATUS.ACTIVE || plan.status === PLAN_STATUS.EXPIRING_SOON)
        )
      );
      
      if (clientsWithActivePlans.length > 0) {
        console.log(`Found ${clientsWithActivePlans.length} clients with matching active plans`);
        clientsForGallery = clientsWithActivePlans;
      }
    }
    
    // If no clients found with active plans array, fall back to client.planActive flag
    if (clientsForGallery.length === 0) {
      console.log('No clients with matching active plans found, checking planActive flag');
      
      // Check clients with planActive flag
      const clientsWithPlanActive = userClients.filter(client => client.planActive === true);
      
      if (clientsWithPlanActive.length > 0) {
        console.log(`Found ${clientsWithPlanActive.length} clients with planActive flag`);
        clientsForGallery = clientsWithPlanActive;
      }
    }
    
    // If we still have no clients, try one more fallback - clients with plan type
    if (clientsForGallery.length === 0) {
      console.log('No clients found with planActive flag, checking for planType');
      
      // Check clients with planType property
      const clientsWithPlanType = userClients.filter(client => client.planType && client.planType !== '');
      
      if (clientsWithPlanType.length > 0) {
        console.log(`Found ${clientsWithPlanType.length} clients with planType property`);
        clientsForGallery = clientsWithPlanType;
      }
    }
    
    // If we have found clients to show
    if (clientsForGallery.length > 0) {
      // Add them to the dropdown
      clientsForGallery.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        
        // Find the plan for this client to show its type
        let planType = client.planType || 'Active';
        
        // Try to get plan type from activePlans array if available
        const plan = activePlans && activePlans.length > 0 ? 
          activePlans.find(p => p.clientId === client.id) : null;
          
        if (plan && plan.planType) {
          planType = SUBSCRIPTION_PLANS[plan.planType]?.name || plan.planType;
        }
        
        option.textContent = `${client.name || client.email || 'Client'} (${planType} Plan)`;
        galleryClientSelect.appendChild(option);
      });
      
      console.log(`Added ${clientsForGallery.length} clients to gallery dropdown`);
    } else {
      // No clients with plans found
      const option = document.createElement('option');
      option.disabled = true;
      option.textContent = 'No clients with active plans';
      galleryClientSelect.appendChild(option);
      
      // Show helpful message
      showErrorMessage('You need clients with active plans to create galleries');
      console.log('No clients with any type of plan found');
    }
    
    // Log debug info to help troubleshoot
    console.log('Gallery clients dropdown updated');
    console.log('Total clients:', userClients.length);
  } catch (error) {
    console.error('Error updating gallery client dropdown:', error);
  } finally {
    // Always reset the flag when done
    isUpdatingGalleryDropdown = false;
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
    
    // Find active plan for this client
    const plan = activePlans.find(p => 
      p.clientId === clientId && 
      (p.status === PLAN_STATUS.ACTIVE || p.status === PLAN_STATUS.EXPIRING_SOON)
    );
    
    if (!plan) {
      // Fallback to client's planActive flag
      if (client.planActive) {
        // Create a dummy plan object using client's planType
        const dummyPlan = {
          id: `dummy_${Date.now()}`,
          clientId: clientId,
          planType: client.planType || 'basic',
          status: PLAN_STATUS.ACTIVE
        };
        
        // Use the dummy plan
        console.log('No active plan found in activePlans, using client.planActive fallback');
        
        const db = firebase.firestore();
        const galleryRef = await db.collection('galleries').add({
          name,
          description,
          clientId,
          photographerId: currentUser.uid,
          planId: dummyPlan.id,
          planType: dummyPlan.planType,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          photosCount: 0,
          status: 'active'
        });
        
        return galleryRef.id;
      } else {
        throw new Error('No active plan found for this client');
      }
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

   // Initialize plans UI (add this line)
  initPlansUI();
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
  createGallery,
  viewGallery  // Add this line
};


// Add this code AFTER window.subscriptionManager is defined
window.subscriptionManager.checkDuplicateClientName = async function(clientName) {
  try {
    if (!currentUser) return false;
    
    // Normalize the name for comparison (trim and convert to lowercase)
    const normalizedName = clientName.trim().toLowerCase();
    
    // Query Firestore for clients with this photographer ID
    const db = firebase.firestore();
    const clientsSnapshot = await db.collection('clients')
      .where('photographerId', '==', currentUser.uid)
      .get();
    
    // Check if any existing client has the same name (case insensitive)
    const duplicateExists = clientsSnapshot.docs.some(doc => {
      const existingClient = doc.data();
      return existingClient.name && existingClient.name.trim().toLowerCase() === normalizedName;
    });
    
    return duplicateExists;
  } catch (error) {
    console.error('Error checking for duplicate clients:', error);
    // In case of error, return false to allow creation
    return false;
  }
};


// Export subscription plans
window.SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS;




// Initialize tabs and search
function initPlansUI() {
  // Add tab click handlers
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // Update active tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Update filter
      activeFilter = this.getAttribute('data-filter');
      
      // Apply filters and update display
      filterAndDisplayPlans();
    });
  });
  
  // Add search input handler
  const searchInput = document.getElementById('searchPlansInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      searchTerm = this.value.toLowerCase().trim();
      filterAndDisplayPlans();
    });
  }
  
  // Add sort button handler
  const sortBtn = document.getElementById('sortPlansBtn');
  if (sortBtn) {
    sortBtn.addEventListener('click', function() {
      // Toggle between sort options
      if (currentSortOption === 'recent') {
        currentSortOption = 'expiring';
        this.querySelector('span').textContent = 'Sort: Expiring Soon';
      } else if (currentSortOption === 'expiring') {
        currentSortOption = 'alphabetical';
        this.querySelector('span').textContent = 'Sort: A-Z Client';
      } else {
        currentSortOption = 'recent';
        this.querySelector('span').textContent = 'Sort: Recent';
      }
      
      // Apply sort and update display
      filterAndDisplayPlans();
    });
  }
}

// Filter and sort plans
function filterAndDisplayPlans() {
  let filteredPlans = [...allPlans]; // Create a copy to avoid modifying the original
  
  // Apply status filter
  if (activeFilter !== 'all') {
    filteredPlans = filteredPlans.filter(plan => {
      if (activeFilter === 'active') {
        return plan.status === PLAN_STATUS.ACTIVE;
      } else if (activeFilter === 'expiring') {
        return plan.status === PLAN_STATUS.EXPIRING_SOON;
      } else if (activeFilter === 'expired') {
        return plan.status === PLAN_STATUS.EXPIRED;
      }
      return true;
    });
  }
  
  // Apply search filter if needed
  if (searchTerm) {
    filteredPlans = filteredPlans.filter(plan => {
      const client = userClients.find(c => c.id === plan.clientId);
      const clientName = (client?.name || plan.clientName || '').toLowerCase();
      const planType = (SUBSCRIPTION_PLANS[plan.planType]?.name || plan.planType || '').toLowerCase();
      
      return (
        clientName.includes(searchTerm) ||
        planType.includes(searchTerm)
      );
    });
  }
  
  // Sort the filtered plans
  filteredPlans = sortPlans(filteredPlans, currentSortOption);
  
  // Update display
  updatePlansDisplay(filteredPlans);
  
  // Update tab counts
  updateTabCounts();
}

// Sort plans based on selected option
function sortPlans(plans, sortOption) {
  if (sortOption === 'recent') {
    // Sort by start date (newest first)
    return plans.sort((a, b) => {
      const dateA = a.planStartDate ? a.planStartDate.toDate().getTime() : 0;
      const dateB = b.planStartDate ? b.planStartDate.toDate().getTime() : 0;
      return dateB - dateA; // Descending (newest first)
    });
  } else if (sortOption === 'expiring') {
    // Sort by days left before expiration (soonest first)
    return plans.sort((a, b) => {
      // Expired plans go to the bottom
      if (a.status === PLAN_STATUS.EXPIRED && b.status !== PLAN_STATUS.EXPIRED) return 1;
      if (a.status !== PLAN_STATUS.EXPIRED && b.status === PLAN_STATUS.EXPIRED) return -1;
      
      // Compare expiration dates for non-expired plans
      const dateA = a.planEndDate ? a.planEndDate.toDate().getTime() : Infinity;
      const dateB = b.planEndDate ? b.planEndDate.toDate().getTime() : Infinity;
      return dateA - dateB; // Ascending (soonest first)
    });
  } else if (sortOption === 'alphabetical') {
    // Sort by client name (A-Z)
    return plans.sort((a, b) => {
      const clientA = userClients.find(c => c.id === a.clientId);
      const clientB = userClients.find(c => c.id === b.clientId);
      
      const nameA = (clientA?.name || a.clientName || '').toLowerCase();
      const nameB = (clientB?.name || b.clientName || '').toLowerCase();
      
      return nameA.localeCompare(nameB);
    });
  }
  
  return plans;
}


// Update the display with filtered plans - Row-based layout
function updatePlansDisplay(plans) {
  const plansContainer = document.getElementById('plansContainer');
  if (!plansContainer) return;
  
  // Clear existing content
  plansContainer.innerHTML = '';
  
  // If no plans
  if (!plans || plans.length === 0) {
    plansContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-ticket-alt empty-icon"></i>
        <h3>No plans found</h3>
        <p>No plans match your current filters</p>
        <button class="btn" id="resetFiltersBtn">Reset Filters</button>
      </div>
    `;
    
    // Add event listener to reset filters button
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', function() {
        // Reset active filter
        activeFilter = 'all';
        document.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('active');
          if (t.getAttribute('data-filter') === 'all') {
            t.classList.add('active');
          }
        });
        
        // Reset search
        const searchInput = document.getElementById('searchPlansInput');
        if (searchInput) {
          searchInput.value = '';
          searchTerm = '';
        }
        
        // Apply filters
        filterAndDisplayPlans();
      });
    }
    
    return;
  }
  
  // Create table for plans instead of cards
  const plansTable = document.createElement('table');
  plansTable.className = 'plans-table';
  
  // Add table header
  plansTable.innerHTML = `
    <thead>
      <tr>
        <th>Plan Type</th>
        <th>Client</th>
        <th>Dates</th>
        <th>Status</th>
        <!--<th>Storage</th>-->
       
        <th>Photos & Sharing</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  
  const tableBody = plansTable.querySelector('tbody');
  
  // Create rows for each plan
  plans.forEach(plan => {
    const planRow = document.createElement('tr');
    
    // Add status-based classes to the row
    if (plan.status === PLAN_STATUS.EXPIRED) {
      planRow.classList.add('is-expired');
    } else if (plan.status === PLAN_STATUS.EXPIRING_SOON) {
      planRow.classList.add('is-expiring');
    }
    
    // Format dates
    const startDate = plan.planStartDate?.toDate().toLocaleDateString() || 'Unknown';
    const endDate = plan.planEndDate?.toDate().toLocaleDateString() || 'Unknown';
    
    // Get client info
    const client = userClients.find(c => c.id === plan.clientId);
    const clientName = client?.name || plan.clientName || 'Unknown Client';
    
    // Create HTML for the plan row
    planRow.innerHTML = `
      <td class="plan-type">${SUBSCRIPTION_PLANS[plan.planType]?.name || plan.planType}</td>
      <td class="plan-client">${clientName}</td>
      <td class="plan-dates">
        <div><strong>Started:</strong> ${startDate}</div>
        <div><strong>Expires:</strong> ${endDate}</div>
      </td>
      <td class="plan-status-cell">
        <span class="plan-status ${plan.status}">${formatPlanStatus(plan.status)}</span>
        ${plan.status === PLAN_STATUS.EXPIRING_SOON ? 
          `<div class="expiry-warning"><i class="fas fa-exclamation-triangle"></i> Expires in ${plan.daysLeftBeforeExpiration} days</div>` : ''}
        ${plan.status === PLAN_STATUS.EXPIRED ? 
          `<div class="expired-badge"><i class="fas fa-calendar-times"></i> Expired on ${endDate}</div>` : ''}
      </td>
      <!--
      <td class="plan-storage">
        ${formatStorageUsage(plan.storageUsed || 0, SUBSCRIPTION_PLANS[plan.planType]?.storageLimit || 1)}
      </td> 
      -->
   

      <td class="plan-photos-sharing">
        ${formatPhotoUsage(plan.photosUploaded || 0, SUBSCRIPTION_PLANS[plan.planType]?.photosPerGallery || 50)}
        ${getSharingHTML(plan)}
      </td>
      <td class="plan-actions-cell">
        <button class="btn view-gallery-btn" data-client-id="${plan.clientId}">View Gallery</button>
        ${plan.status === PLAN_STATUS.EXPIRED ?
          `<button class="btn renew-plan-btn" data-plan-id="${plan.id}" data-client-id="${plan.clientId}">Renew Plan</button>` :
          `<button class="btn extend-plan-btn" data-plan-id="${plan.id}" data-client-id="${plan.clientId}">Extend Plan</button>`
        }
      </td>
    `;
    
    tableBody.appendChild(planRow);
  });
  
  plansContainer.appendChild(plansTable);
  
  // Add event listeners for buttons
  document.querySelectorAll('.view-gallery-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      viewGallery(this.getAttribute('data-client-id'));
    });
  });
  
  document.querySelectorAll('.extend-plan-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const planId = this.getAttribute('data-plan-id');
      const clientId = this.getAttribute('data-client-id');
      showExtendPlanModal(planId, clientId);
    });
  });
  
  document.querySelectorAll('.renew-plan-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const clientId = this.getAttribute('data-client-id');
      showUpgradeModal(clientId);
    });
  });


   // Add this after your existing event listeners in updatePlansDisplay function
  document.querySelectorAll('.share-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const planId = this.getAttribute('data-plan-id');
      const clientId = this.getAttribute('data-client-id');
      const currentStatus = this.getAttribute('data-current-status');
      
      toggleGallerySharing(planId, clientId, currentStatus === 'shared' ? SHARING_STATUS.SHARED : SHARING_STATUS.NOTSHARED);
    });
  });
}

// Update the tab counts based on plan counts
function updateTabCounts() {
  const activeCount = allPlans.filter(plan => plan.status === PLAN_STATUS.ACTIVE).length;
  const expiringCount = allPlans.filter(plan => plan.status === PLAN_STATUS.EXPIRING_SOON).length;
  const expiredCount = allPlans.filter(plan => plan.status === PLAN_STATUS.EXPIRED).length;
  
  // Update count elements
  const tabCounts = {
    'all': allPlans.length,
    'active': activeCount,
    'expiring': expiringCount,
    'expired': expiredCount
  };
  
  document.querySelectorAll('.tab').forEach(tab => {
    const filter = tab.getAttribute('data-filter');
    const countEl = tab.querySelector('.plan-count');
    if (countEl && tabCounts[filter] !== undefined) {
      countEl.textContent = tabCounts[filter];
    }
  });
}

/**
 * Utility function to fix all photo count discrepancies for all galleries
 * This will ensure dashboard displays show accurate counts
 */
async function fixAllPhotoCountDiscrepancies() {
  try {
    if (!currentUser) {
      console.error('User must be logged in');
      return false;
    }
    
    console.log('Starting to fix all photo count discrepancies...');
    showLoadingOverlay('Fixing photo counts...');
    
    const db = firebase.firestore();
    
    // Step 1: Get all galleries for this user
    const galleriesSnapshot = await db.collection('galleries')
      .where('photographerId', '==', currentUser.uid)
      .get();
    
    if (galleriesSnapshot.empty) {
      console.log('No galleries found');
      hideLoadingOverlay();
      return false;
    }
    
    console.log(`Found ${galleriesSnapshot.size} galleries to check`);
    
    // Step 2: Process each gallery
    const galleryFixes = [];
    
    for (const galleryDoc of galleriesSnapshot.docs) {
      const galleryData = galleryDoc.data();
      const galleryId = galleryDoc.id;
      
      // Get actual photo count
      const photosSnapshot = await db.collection('photos')
        .where('galleryId', '==', galleryId)
        .where('status', '==', 'active')
        .get();
      
      const actualPhotoCount = photosSnapshot.size;
      const galleryPhotoCount = galleryData.photosCount || 0;
      
      // Calculate total size
      const totalSize = photosSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().size || 0);
      }, 0);
      
      const totalSizeMB = totalSize / (1024 * 1024);
      
      // Find associated plan
      let planDoc = null;
      let planId = galleryData.planId;
      
      if (planId) {
        // Try to get the plan directly
        const planSnapshot = await db.collection('client-plans').doc(planId).get();
        if (planSnapshot.exists) {
          planDoc = planSnapshot;
        }
      }
      
      // Try to find by client ID if plan ID not available or not found
      if (!planDoc && galleryData.clientId) {
        const plansSnapshot = await db.collection('client-plans')
          .where('clientId', '==', galleryData.clientId)
          .where('status', 'in', ['active', 'expiring_soon', 'expired'])
          .get();
        
        if (!plansSnapshot.empty) {
          // Prefer active plans over expired ones
          const activePlans = plansSnapshot.docs.filter(doc => 
            doc.data().status === 'active' || doc.data().status === 'expiring_soon'
          );
          
          planDoc = activePlans.length > 0 ? 
            activePlans[0] : plansSnapshot.docs[0];
          
          planId = planDoc.id;
        }
      }
      
      // Apply fixes if needed
      if (galleryPhotoCount !== actualPhotoCount) {
        console.log(`Fixing gallery ${galleryId}: ${galleryPhotoCount} → ${actualPhotoCount} photos`);
        
        galleryFixes.push(
          db.collection('galleries').doc(galleryId).update({
            photosCount: actualPhotoCount,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          })
        );
      }
      
      // Fix plan count if we found a plan
      if (planDoc) {
        const planData = planDoc.data();
        const planPhotoCount = planData.photosUploaded || 0;
        
        if (planPhotoCount !== actualPhotoCount) {
          console.log(`Fixing plan ${planId}: ${planPhotoCount} → ${actualPhotoCount} photos`);
          
          galleryFixes.push(
            db.collection('client-plans').doc(planId).update({
              photosUploaded: actualPhotoCount,
              storageUsed: totalSizeMB,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            })
          );
        }
        
        // Update gallery with plan ID if needed
        if (galleryData.planId !== planId) {
          console.log(`Updating gallery ${galleryId} with correct planId: ${planId}`);
          
          galleryFixes.push(
            db.collection('galleries').doc(galleryId).update({
              planId: planId,
              planType: planData.planType,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            })
          );
        }
      }
    }
    
    // Apply all fixes
    if (galleryFixes.length > 0) {
      await Promise.all(galleryFixes);
      console.log(`Successfully applied ${galleryFixes.length} fixes`);
      
      // Refresh dashboard data
      await refreshAllData();
      
      showSuccessMessage(`Photo counts fixed successfully. ${galleryFixes.length} issues resolved.`);
    } else {
      console.log('No fixes needed - all counts are correct');
      showInfoMessage('All photo counts are already correct.');
    }
    
    hideLoadingOverlay();
    return true;
    
  } catch (error) {
    console.error('Error fixing photo counts:', error);
    hideLoadingOverlay();
    showErrorMessage(`Error fixing photo counts: ${error.message}`);
    return false;
  }
}





async function toggleGallerySharing(planId, clientId, currentStatus) {
  try {
    if (!currentUser) {
      showErrorMessage('You must be logged in to manage sharing settings');
      return false;
    }

    const db = firebase.firestore();
    const plan = allPlans.find(p => p.id === planId);
    
    if (!plan) {
      showErrorMessage('Plan not found');
      return false;
    }

    if (currentStatus === SHARING_STATUS.SHARED) {
      // DISABLE sharing - remove from both collections
      await db.collection('client-plans').doc(planId).update({
        sharingEnabled: false,
        sharingStatus: SHARING_STATUS.NOTSHARED,
        shareId: firebase.firestore.FieldValue.delete(),
        shareUrl: firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Remove from galleryShares collection
      if (plan.shareId) {
        await db.collection('galleryShares').doc(plan.shareId).delete();
        console.log("Deleted share document:", plan.shareId);
      }

      showSuccessMessage('Gallery sharing disabled');
    } else {
      // ENABLE sharing - FIRST CHECK FOR EXISTING SHARE
      let shareId = null;
      let shareUrl = null;
      
      // 🔥 STEP 1: Check if there's already an existing share for this gallery
      const galleryId = plan.galleryId || planId;
      
      try {
        // Look for existing share by galleryId
        const existingSharesSnapshot = await db.collection('galleryShares')
          .where('galleryId', '==', galleryId)
          .where('photographerId', '==', currentUser.uid)
          .where('status', '==', 'active')
          .limit(1)
          .get();
        
        if (!existingSharesSnapshot.empty) {
          // 🎯 FOUND EXISTING SHARE - REUSE IT
          const existingShareDoc = existingSharesSnapshot.docs[0];
          shareId = existingShareDoc.id; // Use the document ID as shareId
          shareUrl = `${window.location.origin}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
          
          console.log("✅ REUSING existing share ID:", shareId);
          
          // Update the existing share document to ensure it's active
          await db.collection('galleryShares').doc(shareId).update({
            status: 'active',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
        } else {
          // 🆕 NO EXISTING SHARE FOUND - CREATE NEW ONE
          shareId = Math.random().toString(36).substring(2, 10);
          shareUrl = `${window.location.origin}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
          
          console.log("🆕 CREATING new share ID:", shareId);
          
          // Create new share document
          await db.collection('galleryShares').doc(shareId).set({
            galleryId: galleryId,
            photographerId: currentUser.uid,
            shareId: shareId,
            passwordProtected: false,
            password: '',
            expiryDate: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            maxSelections: 0,
            preventDownload: false,
            watermarkEnabled: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: "active",
            views: 0,
            lastViewed: null
          });
        }
        
        // 🔥 STEP 2: Update plan with the share data (existing or new)
        await db.collection('client-plans').doc(planId).update({
          sharingEnabled: true,
          sharingStatus: SHARING_STATUS.SHARED,
          shareId: shareId,
          shareUrl: shareUrl,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Gallery sharing enabled with share ID:", shareId);
        console.log("🔗 Share URL:", shareUrl);
        showSuccessMessage(`Gallery sharing enabled! Link: ${shareUrl}`);
        
      } catch (error) {
        console.error('Error finding/creating share:', error);
        throw error;
      }
    }

    // Reload data to show correct sharing status
    await loadActivePlans();
    filterAndDisplayPlans();
    return true;

  } catch (error) {
    console.error('Error toggling gallery sharing:', error);
    showErrorMessage(`Error updating sharing settings: ${error.message}`);
    return false;
  }
}

 

async function copyShareUrl(shareUrl, clientName) {
  try {
    await navigator.clipboard.writeText(`https://${shareUrl}`);
    showSuccessMessage(`Share link copied for ${clientName}!`);
  } catch (error) {
    const textArea = document.createElement('textarea');
    textArea.value = `https://${shareUrl}`;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showSuccessMessage(`Share link copied for ${clientName}!`);
  }
}

// Make function globally available
window.copyShareUrl = copyShareUrl; 



function getSharingHTML(plan) {
  const client = userClients.find(c => c.id === plan.clientId);
  const clientName = client?.name || plan.clientName || 'Unknown Client';
  
  const isShared = plan.sharingEnabled === true;
  const canShare = plan.status === PLAN_STATUS.ACTIVE || plan.status === PLAN_STATUS.EXPIRING_SOON;
  
  // Generate share URL in the same format as gallery-share-modal.js
  let shareUrl = '';
  if (isShared && plan.shareId) {
    const domain = window.location.origin;
    shareUrl = `${domain}/snapselect/pages/client-gallery-view.html?share=${plan.shareId}`;
    console.log("Share link displayed:", shareUrl); // This is what you wanted!
  }
  
  if (!canShare) {
    return `
      <div style="margin-top: 5px;">
        <span style="color: #999; font-size: 12px;">🔒 Not shared (Expired)</span>
      </div>
    `;
  } else if (isShared && shareUrl) {
    // Show the actual full URL instead of just the short version
    const displayUrl = shareUrl.length > 40 ? 
      shareUrl.substring(0, 37) + '...' : shareUrl;
    
    return `
      <div style="margin-top: 5px;">
        <span style="color: #4CAF50; font-size: 12px; cursor: pointer;" 
              onclick="copyFullShareUrl('${shareUrl}', '${clientName}')"
              title="${shareUrl}">
          🔗 ${displayUrl}
        </span>
        <button class="share-toggle-btn" 
                data-plan-id="${plan.id}" 
                data-client-id="${plan.clientId}" 
                data-current-status="shared"
                style="margin-left: 8px; padding: 2px 6px; font-size: 10px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">
          Disable
        </button>
      </div>
    `;
  } else {
    return `
      <div style="margin-top: 5px;">
        <span style="color: #999; font-size: 12px;">🔒 Not Shared</span>
        <button class="share-toggle-btn" 
                data-plan-id="${plan.id}" 
                data-client-id="${plan.clientId}" 
                data-current-status="not_shared"
                style="margin-left: 8px; padding: 2px 6px; font-size: 10px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">
          Share
        </button>
      </div>
    `;
  }
}


// New function to copy full share URL
async function copyFullShareUrl(fullUrl, clientName) {
  try {
    await navigator.clipboard.writeText(fullUrl);
    showSuccessMessage(`Full share link copied for ${clientName}!`);
    console.log("Share link copied:", fullUrl); // Additional logging
  } catch (error) {
    const textArea = document.createElement('textarea');
    textArea.value = fullUrl;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showSuccessMessage(`Full share link copied for ${clientName}!`);
    console.log("Share link copied (fallback):", fullUrl);
  }
}

// Make function globally available
window.copyFullShareUrl = copyFullShareUrl;

// Add to window.subscriptionManager
window.subscriptionManager.fixAllPhotoCountDiscrepancies = fixAllPhotoCountDiscrepancies;

// Add client name validation function
window.subscriptionManager.validateNewClientName = async function(clientName) {
  if (!clientName || clientName.trim() === '') {
    return { isValid: false, message: 'Client name cannot be empty' };
  }
  
  const isDuplicate = await this.checkDuplicateClientName(clientName);
  if (isDuplicate) {
    return { isValid: false, message: 'A client with this name already exists. Please use a different name.' };
  }
  
  return { isValid: true, message: '' };
};
