// account-status-bar.js
/**
 * Account status bar component
 * Displays plan details and usage indicators
 */

class AccountStatusBar {
  constructor() {
    this.statusBarElement = null;
    this.initialized = false;
    this.userData = null;
    this.planData = null;
  }
  
  /**
   * Initialize the account status bar
   */
  init() {
    if (this.initialized) return;
    
    // Create the status bar if it doesn't exist
    this.createStatusBar();
    
    // Load user data
    this.loadUserData();
    
    // Refresh every 5 minutes
    setInterval(() => {
      this.loadUserData();
    }, 5 * 60 * 1000);
    
    this.initialized = true;
    console.log("Account status bar initialized");
  }
  
  /**
   * Create the account status bar DOM element
   */
  createStatusBar() {
    // Check if status bar already exists
    this.statusBarElement = document.getElementById('accountStatusBar');
    if (this.statusBarElement) return;
    
    // Create status bar element
    this.statusBarElement = document.createElement('div');
    this.statusBarElement.id = 'accountStatusBar';
    this.statusBarElement.className = 'account-status-bar';
    
    // Create status bar content
    this.statusBarElement.innerHTML = `
      <div class="status-bar-container">
        <div class="status-bar-section plan-info">
          <span class="plan-label">Plan:</span>
          <span class="plan-name" id="planName">Loading...</span>
          <span class="plan-status" id="planStatus"></span>
        </div>
        <div class="status-bar-section storage-info">
          <span class="storage-label">Storage:</span>
          <div class="storage-bar">
            <div class="storage-progress" id="storageProgress"></div>
          </div>
          <span class="storage-text" id="storageText">Loading...</span>
        </div>
        <div class="status-bar-section usage-info">
          <span class="usage-label">Active clients:</span>
          <span class="usage-text" id="clientCount">Loading...</span>
        </div>
        <div class="status-bar-actions">
          <button id="viewPlansBtn" class="btn btn-sm">View Plans</button>
        </div>
      </div>
    `;
    
    // Add click event for view plans button
    const viewPlansBtn = this.statusBarElement.querySelector('#viewPlansBtn');
    if (viewPlansBtn) {
      viewPlansBtn.addEventListener('click', () => {
        this.showPlansModal();
      });
    }
    
    // Insert after header if it exists, otherwise at top of body
    const header = document.querySelector('header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(this.statusBarElement, header.nextSibling);
    } else {
      document.body.insertBefore(this.statusBarElement, document.body.firstChild);
    }
  }
  
  /**
   * Load user and plan data
   */
  async loadUserData() {
    try {
      // Check if user is authenticated
      const user = firebase.auth().currentUser;
      if (!user) {
        this.hideStatusBar();
        return;
      }
      
      // Show loading state
      this.showLoadingState();
      
      // Get user data from Firestore
      const db = firebase.firestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      
      if (!userDoc.exists) {
        this.showErrorState('User profile not found');
        return;
      }
      
      this.userData = userDoc.data();
      
      // Get active plans count
      const activePlansQuery = await db.collection('client-plans')
        .where('userId', '==', user.uid)
        .where('status', 'in', ['active', 'expiring_soon'])
        .get();
      
      const activePlansCount = activePlansQuery.size;
      
      // Get total storage used
      let totalStorageUsed = 0;
      let totalStorageLimit = 0;
      
      activePlansQuery.forEach(doc => {
        const planData = doc.data();
        totalStorageUsed += planData.storageUsed || 0;
        
        // Get storage limit based on plan type
        const planType = planData.planType;
        const planLimits = this.getPlanLimits(planType);
        totalStorageLimit += planLimits.storage || 0;
      });
      
      // If user has a default plan, add its storage
      if (this.userData.planActive) {
        const planLimits = this.getPlanLimits(this.userData.defaultPlan);
        totalStorageLimit += planLimits.storage || 0;
      }
      
      // Set minimum storage limit to avoid division by zero
      totalStorageLimit = Math.max(totalStorageLimit, 1);
      
      // Update UI with user data
      this.updateStatusBar({
        planName: this.userData.defaultPlan || 'Free',
        planStatus: this.userData.planActive ? 'Active' : 'Inactive',
        storageUsed: totalStorageUsed,
        storageLimit: totalStorageLimit,
        clientCount: activePlansCount
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      this.showErrorState('Failed to load account data');
    }
  }
  
  /**
   * Update the status bar UI
   * @param {Object} data - Data to display
   */
  updateStatusBar(data) {
    if (!this.statusBarElement) return;
    
    // Update plan name and status
    const planNameElement = document.getElementById('planName');
    const planStatusElement = document.getElementById('planStatus');
    
    if (planNameElement) {
      planNameElement.textContent = data.planName;
    }
    
    if (planStatusElement) {
      planStatusElement.textContent = data.planStatus;
      planStatusElement.className = 'plan-status ' + data.planStatus.toLowerCase();
    }
    
    // Update storage usage
    const storageProgressElement = document.getElementById('storageProgress');
    const storageTextElement = document.getElementById('storageText');
    
    if (storageProgressElement && storageTextElement) {
      // Calculate storage percentage
      const storagePercentage = Math.min((data.storageUsed / (data.storageLimit * 1024)) * 100, 100);
      
      // Update progress bar
      storageProgressElement.style.width = `${storagePercentage}%`;
      
      // Add warning colors
      storageProgressElement.className = 'storage-progress';
      if (storagePercentage > 90) {
        storageProgressElement.classList.add('critical');
      } else if (storagePercentage > 75) {
        storageProgressElement.classList.add('warning');
      }
      
      // Update storage text
      const usedGB = (data.storageUsed / 1024).toFixed(2);
      storageTextElement.textContent = `${usedGB}/${data.storageLimit} GB`;
    }
    
    // Update client count
    const clientCountElement = document.getElementById('clientCount');
    if (clientCountElement) {
      clientCountElement.textContent = data.clientCount;
    }
    
    // Show the status bar
    this.showStatusBar();
  }
  
  /**
   * Show loading state in the status bar
   */
  showLoadingState() {
    if (!this.statusBarElement) return;
    
    const planNameElement = document.getElementById('planName');
    const storageTextElement = document.getElementById('storageText');
    const clientCountElement = document.getElementById('clientCount');
    
    if (planNameElement) planNameElement.textContent = 'Loading...';
    if (storageTextElement) storageTextElement.textContent = 'Loading...';
    if (clientCountElement) clientCountElement.textContent = 'Loading...';
  }
  
  /**
   * Show error state in the status bar
   * @param {string} message - Error message
   */
  showErrorState(message) {
    if (!this.statusBarElement) return;
    
    const planNameElement = document.getElementById('planName');
    const storageTextElement = document.getElementById('storageText');
    const clientCountElement = document.getElementById('clientCount');
    
    if (planNameElement) planNameElement.textContent = 'Error';
    if (storageTextElement) storageTextElement.textContent = message || 'Failed to load data';
    if (clientCountElement) clientCountElement.textContent = 'N/A';
  }
  
  /**
   * Show the status bar
   */
  showStatusBar() {
    if (this.statusBarElement) {
      this.statusBarElement.style.display = 'block';
    }
  }
  
  /**
   * Hide the status bar
   */
  hideStatusBar() {
    if (this.statusBarElement) {
      this.statusBarElement.style.display = 'none';
    }
  }
  
  /**
   * Show plans modal
   */
  showPlansModal() {
    // Check if upgradePlanModal exists
    const modal = document.getElementById('upgradePlanModal');
    if (modal) {
      modal.style.display = 'block';
    } else {
      // Redirect to plans page if modal doesn't exist
      window.location.href = 'plans.html';
    }
  }
  
  /**
   * Get plan limits based on plan type
   * @param {string} planType - Plan type
   * @returns {Object} - Plan limits
   */
  getPlanLimits(planType) {
    // Default limits
    const defaultLimits = {
      storage: 1, // GB
      galleries: 1,
      photosPerGallery: 50,
      maxClients: 1,
      selectionWindow: 7 // days
    };
    
    // Check if global SUBSCRIPTION_PLANS is available
    if (window.SUBSCRIPTION_PLANS && window.SUBSCRIPTION_PLANS[planType]) {
      return {
        storage: window.SUBSCRIPTION_PLANS[planType].storageLimit || defaultLimits.storage,
        galleries: window.SUBSCRIPTION_PLANS[planType].galleryLimit || defaultLimits.galleries,
        photosPerGallery: window.SUBSCRIPTION_PLANS[planType].photosPerGallery || defaultLimits.photosPerGallery,
        maxClients: window.SUBSCRIPTION_PLANS[planType].maxClients || defaultLimits.maxClients,
        selectionWindow: window.SUBSCRIPTION_PLANS[planType].expiryDays || defaultLimits.selectionWindow
      };
    }
    
    // Fallback to hardcoded values
    switch (planType) {
      case 'lite':
        return {
          storage: 2,
          galleries: 1,
          photosPerGallery: 100,
          maxClients: 1,
          selectionWindow: 7
        };
      case 'mini':
        return {
          storage: 5,
          galleries: 1,
          photosPerGallery: 200,
          maxClients: 1,
          selectionWindow: 14
        };
      case 'basic':
        return {
          storage: 15,
          galleries: 1,
          photosPerGallery: 500,
          maxClients: 1,
          selectionWindow: 30
        };
      case 'pro':
        return {
          storage: 25,
          galleries: 1,
          photosPerGallery: 800,
          maxClients: 1,
          selectionWindow: 45
        };
      case 'premium':
        return {
          storage: 50,
          galleries: 1,
          photosPerGallery: 1200,
          maxClients: 1,
          selectionWindow: 60
        };
      case 'ultimate':
        return {
          storage: 100,
          galleries: 2,
          photosPerGallery: 1250,
          maxClients: 1,
          selectionWindow: 90
        };
      default:
        return defaultLimits;
    }
  }
}

// Create global instance
window.AccountStatusBar = new AccountStatusBar();

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
  if (window.AccountStatusBar) {
    window.AccountStatusBar.init();
  }
});
