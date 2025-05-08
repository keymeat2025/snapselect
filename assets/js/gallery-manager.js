/**
 * gallery-manager.js - Manages client galleries with plan-based controls
 * Complements subscription-manager.js for the SnapSelect application
 */

// Use window object to prevent redeclaration issues when script is loaded multiple times
window.GALLERY_STATUS = window.GALLERY_STATUS || {
  ACTIVE: 'active',
  PROCESSING: 'processing',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  LOCKED: 'locked',
  ARCHIVED: 'archived'
};

// Global variables stored on window to prevent redeclaration issues
window.galleryManagerVars = window.galleryManagerVars || {
  currentUser: null,
  userGalleries: [],
  loadedGalleries: false
};

/**
 * Initialize gallery manager
 */
async function initGalleryManager() {
  try {
    // Show loading overlay at the start
    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay('Loading galleries...');
    }
    
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        window.galleryManagerVars.currentUser = user;
        try {
          // If PerformanceManager exists, check for cached galleries
          const cachedGalleries = window.PerformanceManager && typeof window.PerformanceManager.getCachedData === 'function' 
            ? window.PerformanceManager.getCachedData('user_galleries') 
            : null;
            
          if (cachedGalleries) {
            window.galleryManagerVars.userGalleries = cachedGalleries;
            updateGalleriesDisplay();
          } else {
            // Set default empty array if no cached galleries
            window.galleryManagerVars.userGalleries = [];
          }
          
          // Load fresh gallery data
          await loadGalleries();
          
          // Cache the new gallery data if PerformanceManager exists
          if (window.PerformanceManager && typeof window.PerformanceManager.cacheData === 'function') {
            window.PerformanceManager.cacheData('user_galleries', window.galleryManagerVars.userGalleries);
          }
          
          // Hide loading overlay
          if (typeof hideLoadingOverlay === 'function') {
            hideLoadingOverlay();
          }
          
          window.galleryManagerVars.loadedGalleries = true;
        } catch (error) {
          console.error('Error initializing gallery manager:', error);
          
          // Hide loading overlay if there's an error
          if (typeof hideLoadingOverlay === 'function') {
            hideLoadingOverlay();
          }
          
          // Show error message if NotificationSystem exists
          if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
            window.NotificationSystem.showNotification('error', 'Error', 'Failed to load your galleries. Please refresh the page.');
          } else if (typeof showErrorMessage === 'function') {
            showErrorMessage('Failed to load your galleries. Please refresh the page.');
          }
        }
      } else {
        // Hide loading overlay if user is not logged in
        if (typeof hideLoadingOverlay === 'function') {
          hideLoadingOverlay();
        }
      }
    });
    
    // Setup event listeners
    setupGalleryEventListeners();
    
  } catch (error) {
    console.error('Error in gallery manager initialization:', error);
    
    // Hide loading overlay if there's an error
    if (typeof hideLoadingOverlay === 'function') {
      hideLoadingOverlay();
    }
  }
}

/**
 * Set up gallery-related event listeners
 */
function setupGalleryEventListeners() {
  // Gallery cards click events
  document.addEventListener('click', function(e) {
    // Gallery view button click
    if (e.target.classList.contains('view-gallery-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) viewGallery(galleryId);
    }
    
    // Gallery upload button click
    if (e.target.classList.contains('upload-photos-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) showUploadPhotosModal(galleryId);
    }
    
    // Gallery share button click
    if (e.target.classList.contains('share-gallery-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) showShareGalleryModal(galleryId);
    }
    
    // Gallery settings button click
    if (e.target.classList.contains('gallery-settings-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) showGallerySettingsModal(galleryId);
    }
  });
  
  // View all galleries button
  const viewAllGalleriesBtn = document.getElementById('viewAllGalleriesBtn');
  if (viewAllGalleriesBtn) {
    viewAllGalleriesBtn.addEventListener('click', navigateToGalleriesPage);
  }
  
  // Filter buttons if they exist
  const galleryFilters = document.querySelectorAll('.gallery-filter-btn');
  if (galleryFilters.length > 0) {
    galleryFilters.forEach(btn => {
      btn.addEventListener('click', function() {
        const filter = this.getAttribute('data-filter');
        filterGalleries(filter);
      });
    });
  }
}

/**
 * Load user galleries from Firestore
 * This fetches both recent and all galleries depending on the display context
 */
async function loadGalleries() {
  try {
    if (!window.galleryManagerVars.currentUser) return;
    
    const db = firebase.firestore();
    
    // Create a query for all galleries by this photographer
    const galleryQuery = db.collection('galleries')
      .where('photographerId', '==', window.galleryManagerVars.currentUser.uid)
      .orderBy('createdAt', 'desc');
    
    // If we're on the dashboard, limit to recent galleries only
    const isDashboard = window.location.href.includes('photographer-dashboard.html');
    const finalQuery = isDashboard ? galleryQuery.limit(4) : galleryQuery;
    
    const galleriesSnapshot = await finalQuery.get();
    
    // Clear existing galleries and load new ones
    window.galleryManagerVars.userGalleries = [];
    
    if (galleriesSnapshot.empty) {
      console.log('No galleries found for this user');
      updateGalleriesDisplay();
      return;
    }
    
    // Create an array of promises to get client info for each gallery
    const promises = [];
    
    galleriesSnapshot.forEach(doc => {
      const galleryData = { id: doc.id, ...doc.data() };
      
      // Add this gallery to our array
      window.galleryManagerVars.userGalleries.push(galleryData);
      
      // Create a promise to get client info and plan details
      if (galleryData.clientId) {
        const clientPromise = db.collection('clients').doc(galleryData.clientId).get()
          .then(clientDoc => {
            if (clientDoc.exists) {
              const clientData = clientDoc.data();
              
              // Find the gallery we just added and update its client information
              const galleryIndex = window.galleryManagerVars.userGalleries.findIndex(g => g.id === doc.id);
              if (galleryIndex !== -1) {
                window.galleryManagerVars.userGalleries[galleryIndex].clientName = clientData.name || clientData.email || 'Unknown Client';
                window.galleryManagerVars.userGalleries[galleryIndex].clientEmail = clientData.email || '';
              }
            }
          })
          .catch(err => console.error(`Error loading client data for gallery ${doc.id}:`, err));
          
        promises.push(clientPromise);
      }
      
      // Create a promise to get plan details if planId exists
      if (galleryData.planId) {
        const planPromise = db.collection('client-plans').doc(galleryData.planId).get()
          .then(planDoc => {
            if (planDoc.exists) {
              const planData = planDoc.data();
              
              // Find the gallery we just added and update its plan information
              const galleryIndex = window.galleryManagerVars.userGalleries.findIndex(g => g.id === doc.id);
              if (galleryIndex !== -1) {
                window.galleryManagerVars.userGalleries[galleryIndex].planStatus = planData.status || 'unknown';
                window.galleryManagerVars.userGalleries[galleryIndex].planEndDate = planData.planEndDate || null;
                
                // Update gallery status based on plan status if needed
                if (planData.status === 'expired' && window.galleryManagerVars.userGalleries[galleryIndex].status === 'active') {
                  window.galleryManagerVars.userGalleries[galleryIndex].status = 'expired';
                } else if (planData.status === 'expiring_soon' && window.galleryManagerVars.userGalleries[galleryIndex].status === 'active') {
                  window.galleryManagerVars.userGalleries[galleryIndex].status = 'expiring_soon';
                }
              }
            }
          })
          .catch(err => console.error(`Error loading plan data for gallery ${doc.id}:`, err));
          
        promises.push(planPromise);
      }
    });
    
    // Wait for all promises to resolve
    await Promise.all(promises);
    
    // Update the galleries display
    updateGalleriesDisplay();
    
    // Notify subscribers that galleries have been loaded
    document.dispatchEvent(new CustomEvent('galleries-loaded', { detail: { galleries: window.galleryManagerVars.userGalleries } }));
    
  } catch (error) {
    console.error('Error loading galleries:', error);
    throw error;
  }
}

/**
 * Update the display of galleries in the UI
 * This handles both recent galleries on dashboard and all galleries on gallery page
 */
function updateGalleriesDisplay() {
  // First, check if we're on the dashboard or galleries page
  const isDashboard = window.location.href.includes('photographer-dashboard.html');
  
  // Get the container element
  const galleryContainer = isDashboard 
    ? document.getElementById('recentGalleries') 
    : document.getElementById('allGalleries');
    
  if (!galleryContainer) return;
  
  // Clear existing content
  galleryContainer.innerHTML = '';
  
  // Show empty state if no galleries
  if (window.galleryManagerVars.userGalleries.length === 0) {
    galleryContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-images empty-icon"></i>
        <h3>No galleries yet</h3>
        <p>Create your first gallery to get started</p>
        <button class="btn" id="emptyStateCreateGalleryBtn">Create Gallery</button>
      </div>
    `;
    
    // Add event listener to the empty state button
    const emptyStateBtn = document.getElementById('emptyStateCreateGalleryBtn');
    if (emptyStateBtn) {
      emptyStateBtn.addEventListener('click', () => {
        if (window.subscriptionManager && window.subscriptionManager.showCreateGalleryModal) {
          window.subscriptionManager.showCreateGalleryModal();
        }
      });
    }
    
    return;
  }
  
  // Create and append gallery cards
  window.galleryManagerVars.userGalleries.forEach(gallery => {
    const galleryCard = createGalleryCard(gallery, isDashboard);
    galleryContainer.appendChild(galleryCard);
  });
  
  // Add event listener to the empty state create gallery button if it exists
  const emptyStateCreateGalleryBtn = document.getElementById('emptyStateCreateGalleryBtn');
  if (emptyStateCreateGalleryBtn) {
    emptyStateCreateGalleryBtn.addEventListener('click', () => {
      if (window.subscriptionManager && window.subscriptionManager.showCreateGalleryModal) {
        window.subscriptionManager.showCreateGalleryModal();
      }
    });
  }
}

/**
 * Create a gallery card element
 * @param {Object} gallery - The gallery data object
 * @param {boolean} isCompact - Whether to show a compact version (for dashboard)
 * @returns {HTMLElement} The gallery card element
 */
function createGalleryCard(gallery, isCompact = false) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.classList.add(gallery.status || 'active');
  
  // Calculate expiry information if available
  let expiryInfo = '';
  if (gallery.planEndDate) {
    const endDate = gallery.planEndDate.toDate ? gallery.planEndDate.toDate() : new Date(gallery.planEndDate);
    const today = new Date();
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) {
      expiryInfo = `<div class="gallery-expiry expired">Expired</div>`;
    } else if (daysLeft <= 7) {
      expiryInfo = `<div class="gallery-expiry expiring">Expires in ${daysLeft} days</div>`;
    } else {
      expiryInfo = `<div class="gallery-expiry">Expires in ${daysLeft} days</div>`;
    }
  }
  
  // Get plan info if available
  const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
    window.SUBSCRIPTION_PLANS[gallery.planType] : null;
  
  // Calculate photo count and limit info
  const photoCountInfo = planInfo ? 
    `<div class="photo-count">${gallery.photosCount || 0}/${planInfo.photosPerGallery} photos</div>` : 
    `<div class="photo-count">${gallery.photosCount || 0} photos</div>`;
  
  // Calculate status badge
  let statusBadge = '';
  switch (gallery.status) {
    case window.GALLERY_STATUS.PROCESSING:
      statusBadge = '<span class="status-badge processing">Processing</span>';
      break;
    case window.GALLERY_STATUS.EXPIRING_SOON:
      statusBadge = '<span class="status-badge expiring">Expiring Soon</span>';
      break;
    case window.GALLERY_STATUS.EXPIRED:
      statusBadge = '<span class="status-badge expired">Expired</span>';
      break;
    case window.GALLERY_STATUS.LOCKED:
      statusBadge = '<span class="status-badge locked">Locked</span>';
      break;
    case window.GALLERY_STATUS.ARCHIVED:
      statusBadge = '<span class="status-badge archived">Archived</span>';
      break;
    default:
      statusBadge = '<span class="status-badge active">Active</span>';
  }
  
  // Create gallery preview image or placeholder
  const galleryPreview = gallery.coverImage ? 
    `<img src="${gallery.coverImage}" alt="${gallery.name}" class="gallery-preview">` : 
    `<div class="gallery-preview-placeholder">
       <i class="fas fa-images"></i>
     </div>`;
  
  // Create different HTML based on compact mode (dashboard) or full (galleries page)
  if (isCompact) {
    // Compact version for dashboard
    card.innerHTML = `
      <div class="gallery-header">
        <h3 class="gallery-name">${gallery.name || 'Unnamed Gallery'}</h3>
        ${statusBadge}
      </div>
      <div class="gallery-preview-container">
        ${galleryPreview}
      </div>
      <div class="gallery-details">
        <div class="gallery-client">Client: ${gallery.clientName || 'Unknown Client'}</div>
        ${photoCountInfo}
        ${expiryInfo}
      </div>
      <div class="gallery-actions">
        <button class="btn view-gallery-btn" data-gallery-id="${gallery.id}">View Gallery</button>
      </div>
    `;
  } else {
    // Full version for galleries page
    const createdDate = gallery.createdAt?.toDate ? 
      gallery.createdAt.toDate().toLocaleDateString() : 
      'Unknown date';
      
    card.innerHTML = `
      <div class="gallery-header">
        <h3 class="gallery-name">${gallery.name || 'Unnamed Gallery'}</h3>
        ${statusBadge}
      </div>
      <div class="gallery-preview-container">
        ${galleryPreview}
      </div>
      <div class="gallery-details">
        <div class="gallery-client">Client: ${gallery.clientName || 'Unknown Client'}</div>
        <div class="gallery-date">Created: ${createdDate}</div>
        ${photoCountInfo}
        ${expiryInfo}
        <div class="gallery-plan">${planInfo?.name || gallery.planType || 'Unknown'} Plan</div>
      </div>
      <div class="gallery-actions">
        <button class="btn view-gallery-btn" data-gallery-id="${gallery.id}">View Gallery</button>
        <button class="btn upload-photos-btn" data-gallery-id="${gallery.id}">Upload Photos</button>
        <button class="btn share-gallery-btn" data-gallery-id="${gallery.id}">Share</button>
        <button class="btn gallery-settings-btn" data-gallery-id="${gallery.id}">
          <i class="fas fa-cog"></i>
        </button>
      </div>
    `;
  }
  
  return card;
}

/**
 * Filter galleries by status
 * Used on the galleries page
 * @param {string} filterStatus - The status to filter by, or 'all'
 */
function filterGalleries(filterStatus = 'all') {
  // Add active class to the clicked filter button
  const filterButtons = document.querySelectorAll('.gallery-filter-btn');
  filterButtons.forEach(btn => {
    if (btn.getAttribute('data-filter') === filterStatus) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Apply filter
  const galleryCards = document.querySelectorAll('.gallery-card');
  galleryCards.forEach(card => {
    if (filterStatus === 'all') {
      card.style.display = 'block';
    } else {
      if (card.classList.contains(filterStatus)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    }
  });
}

/**
 * Navigate to the Galleries page
 */
function navigateToGalleriesPage() {
  window.location.href = 'galleries.html';
}

/**
 * View a specific gallery
 * @param {string} galleryId - The ID of the gallery to view
 */
function viewGallery(galleryId) {
  if (!galleryId) return;
  
  // This would navigate to a gallery detail page
  window.location.href = `gallery-detail.html?id=${galleryId}`;
}

/**
 * Show the Upload Photos modal for a gallery
 * @param {string} galleryId - The ID of the gallery for uploading photos
 */
function showUploadPhotosModal(galleryId) {
  if (!galleryId) return;
  
  // Find the gallery
  const gallery = window.galleryManagerVars.userGalleries.find(g => g.id === galleryId);
  if (!gallery) {
    console.error(`Gallery with ID ${galleryId} not found`);
    return;
  }
  
  // Get plan info
  const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
    window.SUBSCRIPTION_PLANS[gallery.planType] : null;
  
  // Check if gallery has reached its photo limit
  if (planInfo && gallery.photosCount >= planInfo.photosPerGallery) {
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'warning',
        'Photo Limit Reached',
        `This gallery has reached its limit of ${planInfo.photosPerGallery} photos. Please upgrade the plan to add more photos.`
      );
    }
    return;
  }
  
  // Check if gallery is expired or locked
  if (gallery.status === window.GALLERY_STATUS.EXPIRED || gallery.status === window.GALLERY_STATUS.LOCKED) {
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'warning',
        'Gallery Unavailable',
        `This gallery is ${gallery.status}. Please extend or upgrade the plan to continue using it.`
      );
    }
    return;
  }
  
  // Get the upload modal
  const uploadModal = document.getElementById('uploadPhotosModal');
  if (!uploadModal) {
    console.error('Upload photos modal not found in the DOM');
    return;
  }
  
  // Update modal with gallery info
  const galleryNameEl = uploadModal.querySelector('#uploadGalleryName');
  if (galleryNameEl) galleryNameEl.textContent = gallery.name || 'Gallery';
  
  const photoLimitEl = uploadModal.querySelector('#photoLimit');
  if (photoLimitEl && planInfo) {
    const remainingPhotos = planInfo.photosPerGallery - (gallery.photosCount || 0);
    photoLimitEl.textContent = `${remainingPhotos} of ${planInfo.photosPerGallery} photos remaining`;
  }
  
  // Set the gallery ID as a data attribute on the form
  const uploadForm = uploadModal.querySelector('#uploadPhotosForm');
  if (uploadForm) {
    uploadForm.setAttribute('data-gallery-id', galleryId);
  }
  
  // Show the modal
  uploadModal.style.display = 'block';
}

/**
 * Show the Share Gallery modal
 * @param {string} galleryId - The ID of the gallery to share
 */
function showShareGalleryModal(galleryId) {
  if (!galleryId) return;
  
  // Find the gallery
  const gallery = window.galleryManagerVars.userGalleries.find(g => g.id === galleryId);
  if (!gallery) {
    console.error(`Gallery with ID ${galleryId} not found`);
    return;
  }
  
  // Get the share modal
  const shareModal = document.getElementById('shareGalleryModal');
  if (!shareModal) {
    console.error('Share gallery modal not found in the DOM');
    return;
  }
  
  // Update modal with gallery info
  const galleryNameEl = shareModal.querySelector('#shareGalleryName');
  if (galleryNameEl) galleryNameEl.textContent = gallery.name || 'Gallery';
  
  // Generate share link if it doesn't exist
  let shareLink = gallery.shareLink || '';
  if (!shareLink) {
    // Create a share link using the gallery ID
    const baseUrl = window.location.origin;
    shareLink = `${baseUrl}/gallery/share/${galleryId}`;
    
    // Generate a unique code for the link
    const uniqueCode = Math.random().toString(36).substring(2, 10);
    shareLink = `${baseUrl}/gallery/share/${uniqueCode}`;
    
    // Save this share link to the gallery
    updateGalleryShareLink(galleryId, shareLink);
  }
  
  // Update the share link input
  const shareLinkInput = shareModal.querySelector('#shareLinkInput');
  if (shareLinkInput) shareLinkInput.value = shareLink;
  
  // Update gallery ID on the form
  const galleryIdInput = shareModal.querySelector('#shareGalleryId');
  if (galleryIdInput) galleryIdInput.value = galleryId;
  
  // Show the modal
  shareModal.style.display = 'block';
}

/**
 * Show the Gallery Settings modal
 * @param {string} galleryId - The ID of the gallery to configure
 */
function showGallerySettingsModal(galleryId) {
  if (!galleryId) return;
  
  // Find the gallery
  const gallery = window.galleryManagerVars.userGalleries.find(g => g.id === galleryId);
  if (!gallery) {
    console.error(`Gallery with ID ${galleryId} not found`);
    return;
  }
  
  // Get the settings modal
  const settingsModal = document.getElementById('gallerySettingsModal');
  if (!settingsModal) {
    console.error('Gallery settings modal not found in the DOM');
    return;
  }
  
  // Update modal with gallery info
  const galleryNameInput = settingsModal.querySelector('#gallerySettingsName');
  if (galleryNameInput) galleryNameInput.value = gallery.name || '';
  
  const galleryDescriptionInput = settingsModal.querySelector('#gallerySettingsDescription');
  if (galleryDescriptionInput) galleryDescriptionInput.value = gallery.description || '';
  
  // Set password protection if available in the plan
  const passwordProtectionSection = settingsModal.querySelector('#passwordProtectionSection');
  if (passwordProtectionSection) {
    // Get plan info
    const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
      window.SUBSCRIPTION_PLANS[gallery.planType] : null;
      
    // Check if password protection is available in this plan
    const hasPasswordProtection = planInfo && planInfo.features && 
      planInfo.features.includes('Password protection');
      
    if (hasPasswordProtection) {
      passwordProtectionSection.style.display = 'block';
      
      // Set existing password if any
      const passwordInput = settingsModal.querySelector('#galleryPassword');
      if (passwordInput) passwordInput.value = gallery.password || '';
      
      // Set password toggle
      const passwordToggle = settingsModal.querySelector('#passwordProtectionToggle');
      if (passwordToggle) passwordToggle.checked = !!gallery.password;
    } else {
      passwordProtectionSection.style.display = 'none';
    }
  }
  
  // Set gallery customization options if available in the plan
  const customizationSection = settingsModal.querySelector('#galleryCustomizationSection');
  if (customizationSection) {
    // Get plan info
    const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
      window.SUBSCRIPTION_PLANS[gallery.planType] : null;
      
    // Check if any customization is available in this plan
    const hasBasicCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('Basic Gallery Customization');
    const hasAdvancedCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('Advanced Gallery Customization');
    const hasCompleteCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('Complete Gallery Customization');
    const hasWhiteLabelCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('White-label Gallery Customization');
      
    if (hasBasicCustomization || hasAdvancedCustomization || 
        hasCompleteCustomization || hasWhiteLabelCustomization) {
      
      customizationSection.style.display = 'block';
      
      // Show/hide advanced options based on plan level
      const advancedCustomizationOptions = customizationSection.querySelector('.advanced-customization-options');
      if (advancedCustomizationOptions) {
        if (hasAdvancedCustomization || hasCompleteCustomization || hasWhiteLabelCustomization) {
          advancedCustomizationOptions.style.display = 'block';
        } else {
          advancedCustomizationOptions.style.display = 'none';
        }
      }
      
      // Show/hide complete customization options
      const completeCustomizationOptions = customizationSection.querySelector('.complete-customization-options');
      if (completeCustomizationOptions) {
        if (hasCompleteCustomization || hasWhiteLabelCustomization) {
          completeCustomizationOptions.style.display = 'block';
        } else {
          completeCustomizationOptions.style.display = 'none';
        }
      }
      
      // Show/hide white label options
      const whiteLabelOptions = customizationSection.querySelector('.white-label-options');
      if (whiteLabelOptions) {
        if (hasWhiteLabelCustomization) {
          whiteLabelOptions.style.display = 'block';
        } else {
          whiteLabelOptions.style.display = 'none';
        }
      }
      
      // Set existing customization values if any
      if (gallery.customization) {
        // Basic customization
        const themeSelect = settingsModal.querySelector('#galleryTheme');
        if (themeSelect) themeSelect.value = gallery.customization.theme || 'default';
        
        const logoUrlInput = settingsModal.querySelector('#logoUrl');
        if (logoUrlInput) logoUrlInput.value = gallery.customization.logoUrl || '';
        
        // Advanced customization
        const headerTextInput = settingsModal.querySelector('#headerText');
        if (headerTextInput) headerTextInput.value = gallery.customization.headerText || '';
        
        const accentColorInput = settingsModal.querySelector('#accentColor');
        if (accentColorInput) accentColorInput.value = gallery.customization.accentColor || '#4A90E2';
        
        // Complete customization
        const customCssInput = settingsModal.querySelector('#customCss');
        if (customCssInput) customCssInput.value = gallery.customization.customCss || '';
        
        // White label options
        const hidePromoInput = settingsModal.querySelector('#hidePromo');
        if (hidePromoInput) hidePromoInput.checked = gallery.customization.hidePromo || false;
        
        const customDomainInput = settingsModal.querySelector('#customDomain');
        if (customDomainInput) customDomainInput.value = gallery.customization.customDomain || '';
      }
    } else {
      customizationSection.style.display = 'none';
    }
  }
  
  // Update gallery ID on the form
  const galleryIdInput = settingsModal.querySelector('#settingsGalleryId');
  if (galleryIdInput) galleryIdInput.value = galleryId;
  
  // Show the modal
  settingsModal.style.display = 'block';
}

/**
 * Updates a gallery's share link in Firestore
 * @param {string} galleryId - The ID of the gallery to update
 * @param {string} shareLink - The new share link
 */
async function updateGalleryShareLink(galleryId, shareLink) {
  try {
    if (!window.galleryManagerVars.currentUser || !galleryId) return;
    
    const db = firebase.firestore();
    await db.collection('galleries').doc(galleryId).update({
      shareLink: shareLink,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update local gallery data
    const galleryIndex = window.galleryManagerVars.userGalleries.findIndex(g => g.id === galleryId);
    if (galleryIndex !== -1) {
      window.galleryManagerVars.userGalleries[galleryIndex].photosCount = updatedPhotosCount;
      if (!window.galleryManagerVars.userGalleries[galleryIndex].coverImage && uploadedFiles.length > 0) {
        window.galleryManagerVars.userGalleries[galleryIndex].coverImage = uploadedFiles[0].url;
      }
    }
    
    // Update the UI
    updateGalleriesDisplay();
    
    // Hide loading overlay
    if (typeof hideLoadingOverlay === 'function') {
      hideLoadingOverlay();
    }
    
    // Show success notification
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'success',
        'Upload Complete',
        `Successfully uploaded ${uploadedFiles.length} photos to the gallery.`
      );
    }
    
    // Dispatch event for upload completion
    document.dispatchEvent(new CustomEvent('gallery-photos-uploaded', {
      detail: {
        galleryId,
        count: uploadedFiles.length,
        totalCount: updatedPhotosCount
      }
    }));
    
    return {
      success: true,
      uploadedCount: uploadedFiles.length,
      totalCount: updatedPhotosCount
    };
    
  } catch (error) {
    console.error('Error uploading photos:', error);
    
    // Hide loading overlay
    if (typeof hideLoadingOverlay === 'function') {
      hideLoadingOverlay();
    }
    
    // Show error notification
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'error',
        'Upload Failed',
        error.message || 'Failed to upload photos. Please try again.'
      );
    } else if (typeof showErrorMessage === 'function') {
      showErrorMessage(error.message || 'Failed to upload photos. Please try again.');
    }
    
    throw error;
  }
}

/**
 * Save gallery settings to Firestore
 * @param {string} galleryId - The ID of the gallery to update
 * @param {Object} settings - The gallery settings to save
 */
async function saveGallerySettings(galleryId, settings) {
  try {
    if (!window.galleryManagerVars.currentUser || !galleryId) return;
    
    // Show loading overlay
    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay('Saving gallery settings...');
    }
    
    // Find the gallery
    const gallery = window.galleryManagerVars.userGalleries.find(g => g.id === galleryId);
    if (!gallery) {
      throw new Error(`Gallery with ID ${galleryId} not found`);
    }
    
    // Get plan info
    const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
      window.SUBSCRIPTION_PLANS[gallery.planType] : null;
      
    if (!planInfo) {
      throw new Error('Plan information not found for this gallery');
    }
    
    // Validate settings based on plan features
    const hasPasswordProtection = planInfo.features && 
      planInfo.features.includes('Password protection');
      
    const hasBasicCustomization = planInfo.features && 
      planInfo.features.includes('Basic Gallery Customization');
      
    const hasAdvancedCustomization = planInfo.features && 
      planInfo.features.includes('Advanced Gallery Customization');
      
    const hasCompleteCustomization = planInfo.features && 
      planInfo.features.includes('Complete Gallery Customization');
      
    const hasWhiteLabelCustomization = planInfo.features && 
      planInfo.features.includes('White-label Gallery Customization');
    
    // Build update object
    const updateData = {
      name: settings.name || gallery.name,
      description: settings.description || gallery.description,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Add password protection if feature is available
    if (hasPasswordProtection && settings.enablePassword) {
      updateData.password = settings.password || '';
      updateData.passwordProtected = !!settings.password;
    } else if (!hasPasswordProtection && settings.enablePassword) {
      // If user is trying to set password but it's not in their plan
      throw new Error('Password protection is not available in your current plan.');
    }
    
    // Add customization settings if available
    if (hasBasicCustomization || hasAdvancedCustomization || 
        hasCompleteCustomization || hasWhiteLabelCustomization) {
      
      // Initialize customization object if it doesn't exist
      if (!updateData.customization) {
        updateData.customization = {};
      }
      
      // Basic customization (available in all customization plans)
      updateData.customization.theme = settings.theme || 'default';
      updateData.customization.logoUrl = settings.logoUrl || '';
      
      // Advanced customization
      if (hasAdvancedCustomization || hasCompleteCustomization || hasWhiteLabelCustomization) {
        updateData.customization.headerText = settings.headerText || '';
        updateData.customization.accentColor = settings.accentColor || '#4A90E2';
      }
      
      // Complete customization
      if (hasCompleteCustomization || hasWhiteLabelCustomization) {
        updateData.customization.customCss = settings.customCss || '';
      }
      
      // White label customization
      if (hasWhiteLabelCustomization) {
        updateData.customization.hidePromo = !!settings.hidePromo;
        updateData.customization.customDomain = settings.customDomain || '';
      }
    }
    
    // Update in Firestore
    const db = firebase.firestore();
    await db.collection('galleries').doc(galleryId).update(updateData);
    
    // Update local gallery data
    const galleryIndex = window.galleryManagerVars.userGalleries.findIndex(g => g.id === galleryId);
    if (galleryIndex !== -1) {
      Object.assign(window.galleryManagerVars.userGalleries[galleryIndex], updateData);
    }
    
    // Update the UI
    updateGalleriesDisplay();
    
    // Hide loading overlay
    if (typeof hideLoadingOverlay === 'function') {
      hideLoadingOverlay();
    }
    
    // Show success notification
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'success',
        'Settings Saved',
        'Gallery settings have been updated successfully.'
      );
    } else if (typeof showSuccessMessage === 'function') {
      showSuccessMessage('Gallery settings have been updated successfully.');
    }
    
    return {
      success: true,
      gallery: window.galleryManagerVars.userGalleries.find(g => g.id === galleryId)
    };
    
  } catch (error) {
    console.error('Error saving gallery settings:', error);
    
    // Hide loading overlay
    if (typeof hideLoadingOverlay === 'function') {
      hideLoadingOverlay();
    }
    
    // Show error notification
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'error',
        'Settings Error',
        error.message || 'Failed to save gallery settings. Please try again.'
      );
    } else if (typeof showErrorMessage === 'function') {
      showErrorMessage(error.message || 'Failed to save gallery settings. Please try again.');
    }
    
    throw error;
  }
}/**
 * gallery-manager.js - Manages client galleries with plan-based controls
 * Complements subscription-manager.js for the SnapSelect application
 */

// Use window object to prevent redeclaration issues when script is loaded multiple times
window.GALLERY_STATUS = window.GALLERY_STATUS || {
  ACTIVE: 'active',
  PROCESSING: 'processing',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  LOCKED: 'locked',
  ARCHIVED: 'archived'
};

// Global variables stored on window to prevent redeclaration issues
window.galleryManagerVars = window.galleryManagerVars || {
  currentUser: null,
  userGalleries: [],
  loadedGalleries: false
};

/**
 * Initialize gallery manager
 */
async function initGalleryManager() {
  try {
    // Show loading overlay at the start
    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay('Loading galleries...');
    }
    
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        window.galleryManagerVars.currentUser = user;
        try {
          // If PerformanceManager exists, check for cached galleries
          const cachedGalleries = window.PerformanceManager && typeof window.PerformanceManager.getCachedData === 'function' 
            ? window.PerformanceManager.getCachedData('user_galleries') 
            : null;
            
          if (cachedGalleries) {
            window.galleryManagerVars.userGalleries = cachedGalleries;
            updateGalleriesDisplay();
          } else {
            // Set default empty array if no cached galleries
            window.galleryManagerVars.userGalleries = [];
          }
          
          // Load fresh gallery data
          await loadGalleries();
          
          // Cache the new gallery data if PerformanceManager exists
          if (window.PerformanceManager && typeof window.PerformanceManager.cacheData === 'function') {
            window.PerformanceManager.cacheData('user_galleries', window.galleryManagerVars.userGalleries);
          }
          
          // Hide loading overlay
          if (typeof hideLoadingOverlay === 'function') {
            hideLoadingOverlay();
          }
          
          window.galleryManagerVars.loadedGalleries = true;
        } catch (error) {
          console.error('Error initializing gallery manager:', error);
          
          // Hide loading overlay if there's an error
          if (typeof hideLoadingOverlay === 'function') {
            hideLoadingOverlay();
          }
          
          // Show error message if NotificationSystem exists
          if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
            window.NotificationSystem.showNotification('error', 'Error', 'Failed to load your galleries. Please refresh the page.');
          } else if (typeof showErrorMessage === 'function') {
            showErrorMessage('Failed to load your galleries. Please refresh the page.');
          }
        }
      } else {
        // Hide loading overlay if user is not logged in
        if (typeof hideLoadingOverlay === 'function') {
          hideLoadingOverlay();
        }
      }
    });
    
    // Setup event listeners
    setupGalleryEventListeners();
    
  } catch (error) {
    console.error('Error in gallery manager initialization:', error);
    
    // Hide loading overlay if there's an error
    if (typeof hideLoadingOverlay === 'function') {
      hideLoadingOverlay();
    }
  }
}

/**
 * Set up gallery-related event listeners
 */
function setupGalleryEventListeners() {
  // Gallery cards click events
  document.addEventListener('click', function(e) {
    // Gallery view button click
    if (e.target.classList.contains('view-gallery-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) viewGallery(galleryId);
    }
    
    // Gallery upload button click
    if (e.target.classList.contains('upload-photos-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) showUploadPhotosModal(galleryId);
    }
    
    // Gallery share button click
    if (e.target.classList.contains('share-gallery-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) showShareGalleryModal(galleryId);
    }
    
    // Gallery settings button click
    if (e.target.classList.contains('gallery-settings-btn')) {
      const galleryId = e.target.getAttribute('data-gallery-id');
      if (galleryId) showGallerySettingsModal(galleryId);
    }
  });
  
  // View all galleries button
  const viewAllGalleriesBtn = document.getElementById('viewAllGalleriesBtn');
  if (viewAllGalleriesBtn) {
    viewAllGalleriesBtn.addEventListener('click', navigateToGalleriesPage);
  }
  
  // Filter buttons if they exist
  const galleryFilters = document.querySelectorAll('.gallery-filter-btn');
  if (galleryFilters.length > 0) {
    galleryFilters.forEach(btn => {
      btn.addEventListener('click', function() {
        const filter = this.getAttribute('data-filter');
        filterGalleries(filter);
      });
    });
  }
}

/**
 * Load user galleries from Firestore
 * This fetches both recent and all galleries depending on the display context
 */
async function loadGalleries() {
  try {
    if (!window.galleryManagerVars.currentUser) return;
    
    const db = firebase.firestore();
    
    // Create a query for all galleries by this photographer
    const galleryQuery = db.collection('galleries')
      .where('photographerId', '==', window.galleryManagerVars.currentUser.uid)
      .orderBy('createdAt', 'desc');
    
    // If we're on the dashboard, limit to recent galleries only
    const isDashboard = window.location.href.includes('photographer-dashboard.html');
    const finalQuery = isDashboard ? galleryQuery.limit(4) : galleryQuery;
    
    const galleriesSnapshot = await finalQuery.get();
    
    // Clear existing galleries and load new ones
    window.galleryManagerVars.userGalleries = [];
    
    if (galleriesSnapshot.empty) {
      console.log('No galleries found for this user');
      updateGalleriesDisplay();
      return;
    }
    
    // Create an array of promises to get client info for each gallery
    const promises = [];
    
    galleriesSnapshot.forEach(doc => {
      const galleryData = { id: doc.id, ...doc.data() };
      
      // Add this gallery to our array
      window.galleryManagerVars.userGalleries.push(galleryData);
      
      // Create a promise to get client info and plan details
      if (galleryData.clientId) {
        const clientPromise = db.collection('clients').doc(galleryData.clientId).get()
          .then(clientDoc => {
            if (clientDoc.exists) {
              const clientData = clientDoc.data();
              
              // Find the gallery we just added and update its client information
              const galleryIndex = window.galleryManagerVars.userGalleries.findIndex(g => g.id === doc.id);
              if (galleryIndex !== -1) {
                window.galleryManagerVars.userGalleries[galleryIndex].clientName = clientData.name || clientData.email || 'Unknown Client';
                window.galleryManagerVars.userGalleries[galleryIndex].clientEmail = clientData.email || '';
              }
            }
          })
          .catch(err => console.error(`Error loading client data for gallery ${doc.id}:`, err));
          
        promises.push(clientPromise);
      }
      
      // Create a promise to get plan details if planId exists
      if (galleryData.planId) {
        const planPromise = db.collection('client-plans').doc(galleryData.planId).get()
          .then(planDoc => {
            if (planDoc.exists) {
              const planData = planDoc.data();
              
              // Find the gallery we just added and update its plan information
              const galleryIndex = window.galleryManagerVars.userGalleries.findIndex(g => g.id === doc.id);
              if (galleryIndex !== -1) {
                window.galleryManagerVars.userGalleries[galleryIndex].planStatus = planData.status || 'unknown';
                window.galleryManagerVars.userGalleries[galleryIndex].planEndDate = planData.planEndDate || null;
                
                // Update gallery status based on plan status if needed
                if (planData.status === 'expired' && window.galleryManagerVars.userGalleries[galleryIndex].status === 'active') {
                  window.galleryManagerVars.userGalleries[galleryIndex].status = 'expired';
                } else if (planData.status === 'expiring_soon' && window.galleryManagerVars.userGalleries[galleryIndex].status === 'active') {
                  window.galleryManagerVars.userGalleries[galleryIndex].status = 'expiring_soon';
                }
              }
            }
          })
          .catch(err => console.error(`Error loading plan data for gallery ${doc.id}:`, err));
          
        promises.push(planPromise);
      }
    });
    
    // Wait for all promises to resolve
    await Promise.all(promises);
    
    // Update the galleries display
    updateGalleriesDisplay();
    
    // Notify subscribers that galleries have been loaded
    document.dispatchEvent(new CustomEvent('galleries-loaded', { detail: { galleries: window.galleryManagerVars.userGalleries } }));
    
  } catch (error) {
    console.error('Error loading galleries:', error);
    throw error;
  }
}

/**
 * Update the display of galleries in the UI
 * This handles both recent galleries on dashboard and all galleries on gallery page
 */
function updateGalleriesDisplay() {
  // First, check if we're on the dashboard or galleries page
  const isDashboard = window.location.href.includes('photographer-dashboard.html');
  
  // Get the container element
  const galleryContainer = isDashboard 
    ? document.getElementById('recentGalleries') 
    : document.getElementById('allGalleries');
    
  if (!galleryContainer) return;
  
  // Clear existing content
  galleryContainer.innerHTML = '';
  
  // Show empty state if no galleries
  if (window.galleryManagerVars.userGalleries.length === 0) {
    galleryContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-images empty-icon"></i>
        <h3>No galleries yet</h3>
        <p>Create your first gallery to get started</p>
        <button class="btn" id="emptyStateCreateGalleryBtn">Create Gallery</button>
      </div>
    `;
    
    // Add event listener to the empty state button
    const emptyStateBtn = document.getElementById('emptyStateCreateGalleryBtn');
    if (emptyStateBtn) {
      emptyStateBtn.addEventListener('click', () => {
        if (window.subscriptionManager && window.subscriptionManager.showCreateGalleryModal) {
          window.subscriptionManager.showCreateGalleryModal();
        }
      });
    }
    
    return;
  }
  
  // Create and append gallery cards
  window.galleryManagerVars.userGalleries.forEach(gallery => {
    const galleryCard = createGalleryCard(gallery, isDashboard);
    galleryContainer.appendChild(galleryCard);
  });
  
  // Add event listener to the empty state create gallery button if it exists
  const emptyStateCreateGalleryBtn = document.getElementById('emptyStateCreateGalleryBtn');
  if (emptyStateCreateGalleryBtn) {
    emptyStateCreateGalleryBtn.addEventListener('click', () => {
      if (window.subscriptionManager && window.subscriptionManager.showCreateGalleryModal) {
        window.subscriptionManager.showCreateGalleryModal();
      }
    });
  }
}

/**
 * Create a gallery card element
 * @param {Object} gallery - The gallery data object
 * @param {boolean} isCompact - Whether to show a compact version (for dashboard)
 * @returns {HTMLElement} The gallery card element
 */
function createGalleryCard(gallery, isCompact = false) {
  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.classList.add(gallery.status || 'active');
  
  // Calculate expiry information if available
  let expiryInfo = '';
  if (gallery.planEndDate) {
    const endDate = gallery.planEndDate.toDate ? gallery.planEndDate.toDate() : new Date(gallery.planEndDate);
    const today = new Date();
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) {
      expiryInfo = `<div class="gallery-expiry expired">Expired</div>`;
    } else if (daysLeft <= 7) {
      expiryInfo = `<div class="gallery-expiry expiring">Expires in ${daysLeft} days</div>`;
    } else {
      expiryInfo = `<div class="gallery-expiry">Expires in ${daysLeft} days</div>`;
    }
  }
  
  // Get plan info if available
  const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
    window.SUBSCRIPTION_PLANS[gallery.planType] : null;
  
  // Calculate photo count and limit info
  const photoCountInfo = planInfo ? 
    `<div class="photo-count">${gallery.photosCount || 0}/${planInfo.photosPerGallery} photos</div>` : 
    `<div class="photo-count">${gallery.photosCount || 0} photos</div>`;
  
  // Calculate status badge
  let statusBadge = '';
  switch (gallery.status) {
    case window.GALLERY_STATUS.PROCESSING:
      statusBadge = '<span class="status-badge processing">Processing</span>';
      break;
    case window.GALLERY_STATUS.EXPIRING_SOON:
      statusBadge = '<span class="status-badge expiring">Expiring Soon</span>';
      break;
    case window.GALLERY_STATUS.EXPIRED:
      statusBadge = '<span class="status-badge expired">Expired</span>';
      break;
    case window.GALLERY_STATUS.LOCKED:
      statusBadge = '<span class="status-badge locked">Locked</span>';
      break;
    case window.GALLERY_STATUS.ARCHIVED:
      statusBadge = '<span class="status-badge archived">Archived</span>';
      break;
    default:
      statusBadge = '<span class="status-badge active">Active</span>';
  }
  
  // Create gallery preview image or placeholder
  const galleryPreview = gallery.coverImage ? 
    `<img src="${gallery.coverImage}" alt="${gallery.name}" class="gallery-preview">` : 
    `<div class="gallery-preview-placeholder">
       <i class="fas fa-images"></i>
     </div>`;
  
  // Create different HTML based on compact mode (dashboard) or full (galleries page)
  if (isCompact) {
    // Compact version for dashboard
    card.innerHTML = `
      <div class="gallery-header">
        <h3 class="gallery-name">${gallery.name || 'Unnamed Gallery'}</h3>
        ${statusBadge}
      </div>
      <div class="gallery-preview-container">
        ${galleryPreview}
      </div>
      <div class="gallery-details">
        <div class="gallery-client">Client: ${gallery.clientName || 'Unknown Client'}</div>
        ${photoCountInfo}
        ${expiryInfo}
      </div>
      <div class="gallery-actions">
        <button class="btn view-gallery-btn" data-gallery-id="${gallery.id}">View Gallery</button>
      </div>
    `;
  } else {
    // Full version for galleries page
    const createdDate = gallery.createdAt?.toDate ? 
      gallery.createdAt.toDate().toLocaleDateString() : 
      'Unknown date';
      
    card.innerHTML = `
      <div class="gallery-header">
        <h3 class="gallery-name">${gallery.name || 'Unnamed Gallery'}</h3>
        ${statusBadge}
      </div>
      <div class="gallery-preview-container">
        ${galleryPreview}
      </div>
      <div class="gallery-details">
        <div class="gallery-client">Client: ${gallery.clientName || 'Unknown Client'}</div>
        <div class="gallery-date">Created: ${createdDate}</div>
        ${photoCountInfo}
        ${expiryInfo}
        <div class="gallery-plan">${planInfo?.name || gallery.planType || 'Unknown'} Plan</div>
      </div>
      <div class="gallery-actions">
        <button class="btn view-gallery-btn" data-gallery-id="${gallery.id}">View Gallery</button>
        <button class="btn upload-photos-btn" data-gallery-id="${gallery.id}">Upload Photos</button>
        <button class="btn share-gallery-btn" data-gallery-id="${gallery.id}">Share</button>
        <button class="btn gallery-settings-btn" data-gallery-id="${gallery.id}">
          <i class="fas fa-cog"></i>
        </button>
      </div>
    `;
  }
  
  return card;
}

/**
 * Filter galleries by status
 * Used on the galleries page
 * @param {string} filterStatus - The status to filter by, or 'all'
 */
function filterGalleries(filterStatus = 'all') {
  // Add active class to the clicked filter button
  const filterButtons = document.querySelectorAll('.gallery-filter-btn');
  filterButtons.forEach(btn => {
    if (btn.getAttribute('data-filter') === filterStatus) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Apply filter
  const galleryCards = document.querySelectorAll('.gallery-card');
  galleryCards.forEach(card => {
    if (filterStatus === 'all') {
      card.style.display = 'block';
    } else {
      if (card.classList.contains(filterStatus)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    }
  });
}

/**
 * Navigate to the Galleries page
 */
function navigateToGalleriesPage() {
  window.location.href = 'galleries.html';
}

/**
 * View a specific gallery
 * @param {string} galleryId - The ID of the gallery to view
 */
function viewGallery(galleryId) {
  if (!galleryId) return;
  
  // This would navigate to a gallery detail page
  window.location.href = `gallery-detail.html?id=${galleryId}`;
}

/**
 * Show the Upload Photos modal for a gallery
 * @param {string} galleryId - The ID of the gallery for uploading photos
 */
function showUploadPhotosModal(galleryId) {
  if (!galleryId) return;
  
  // Find the gallery
  const gallery = window.galleryManagerVars.userGalleries.find(g => g.id === galleryId);
  if (!gallery) {
    console.error(`Gallery with ID ${galleryId} not found`);
    return;
  }
  
  // Get plan info
  const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
    window.SUBSCRIPTION_PLANS[gallery.planType] : null;
  
  // Check if gallery has reached its photo limit
  if (planInfo && gallery.photosCount >= planInfo.photosPerGallery) {
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'warning',
        'Photo Limit Reached',
        `This gallery has reached its limit of ${planInfo.photosPerGallery} photos. Please upgrade the plan to add more photos.`
      );
    }
    return;
  }
  
  // Check if gallery is expired or locked
  if (gallery.status === window.GALLERY_STATUS.EXPIRED || gallery.status === window.GALLERY_STATUS.LOCKED) {
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'warning',
        'Gallery Unavailable',
        `This gallery is ${gallery.status}. Please extend or upgrade the plan to continue using it.`
      );
    }
    return;
  }
  
  // Get the upload modal
  const uploadModal = document.getElementById('uploadPhotosModal');
  if (!uploadModal) {
    console.error('Upload photos modal not found in the DOM');
    return;
  }
  
  // Update modal with gallery info
  const galleryNameEl = uploadModal.querySelector('#uploadGalleryName');
  if (galleryNameEl) galleryNameEl.textContent = gallery.name || 'Gallery';
  
  const photoLimitEl = uploadModal.querySelector('#photoLimit');
  if (photoLimitEl && planInfo) {
    const remainingPhotos = planInfo.photosPerGallery - (gallery.photosCount || 0);
    photoLimitEl.textContent = `${remainingPhotos} of ${planInfo.photosPerGallery} photos remaining`;
  }
  
  // Set the gallery ID as a data attribute on the form
  const uploadForm = uploadModal.querySelector('#uploadPhotosForm');
  if (uploadForm) {
    uploadForm.setAttribute('data-gallery-id', galleryId);
  }
  
  // Show the modal
  uploadModal.style.display = 'block';
}

/**
 * Show the Share Gallery modal
 * @param {string} galleryId - The ID of the gallery to share
 */
function showShareGalleryModal(galleryId) {
  if (!galleryId) return;
  
  // Find the gallery
  const gallery = window.galleryManagerVars.userGalleries.find(g => g.id === galleryId);
  if (!gallery) {
    console.error(`Gallery with ID ${galleryId} not found`);
    return;
  }
  
  // Get the share modal
  const shareModal = document.getElementById('shareGalleryModal');
  if (!shareModal) {
    console.error('Share gallery modal not found in the DOM');
    return;
  }
  
  // Update modal with gallery info
  const galleryNameEl = shareModal.querySelector('#shareGalleryName');
  if (galleryNameEl) galleryNameEl.textContent = gallery.name || 'Gallery';
  
  // Generate share link if it doesn't exist
  let shareLink = gallery.shareLink || '';
  if (!shareLink) {
    // Create a share link using the gallery ID
    const baseUrl = window.location.origin;
    shareLink = `${baseUrl}/gallery/share/${galleryId}`;
    
    // Generate a unique code for the link
    const uniqueCode = Math.random().toString(36).substring(2, 10);
    shareLink = `${baseUrl}/gallery/share/${uniqueCode}`;
    
    // Save this share link to the gallery
    updateGalleryShareLink(galleryId, shareLink);
  }
  
  // Update the share link input
  const shareLinkInput = shareModal.querySelector('#shareLinkInput');
  if (shareLinkInput) shareLinkInput.value = shareLink;
  
  // Update gallery ID on the form
  const galleryIdInput = shareModal.querySelector('#shareGalleryId');
  if (galleryIdInput) galleryIdInput.value = galleryId;
  
  // Show the modal
  shareModal.style.display = 'block';
}

/**
 * Show the Gallery Settings modal
 * @param {string} galleryId - The ID of the gallery to configure
 */
function showGallerySettingsModal(galleryId) {
  if (!galleryId) return;
  
  // Find the gallery
  const gallery = window.galleryManagerVars.userGalleries.find(g => g.id === galleryId);
  if (!gallery) {
    console.error(`Gallery with ID ${galleryId} not found`);
    return;
  }
  
  // Get the settings modal
  const settingsModal = document.getElementById('gallerySettingsModal');
  if (!settingsModal) {
    console.error('Gallery settings modal not found in the DOM');
    return;
  }
  
  // Update modal with gallery info
  const galleryNameInput = settingsModal.querySelector('#gallerySettingsName');
  if (galleryNameInput) galleryNameInput.value = gallery.name || '';
  
  const galleryDescriptionInput = settingsModal.querySelector('#gallerySettingsDescription');
  if (galleryDescriptionInput) galleryDescriptionInput.value = gallery.description || '';
  
  // Set password protection if available in the plan
  const passwordProtectionSection = settingsModal.querySelector('#passwordProtectionSection');
  if (passwordProtectionSection) {
    // Get plan info
    const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
      window.SUBSCRIPTION_PLANS[gallery.planType] : null;
      
    // Check if password protection is available in this plan
    const hasPasswordProtection = planInfo && planInfo.features && 
      planInfo.features.includes('Password protection');
      
    if (hasPasswordProtection) {
      passwordProtectionSection.style.display = 'block';
      
      // Set existing password if any
      const passwordInput = settingsModal.querySelector('#galleryPassword');
      if (passwordInput) passwordInput.value = gallery.password || '';
      
      // Set password toggle
      const passwordToggle = settingsModal.querySelector('#passwordProtectionToggle');
      if (passwordToggle) passwordToggle.checked = !!gallery.password;
    } else {
      passwordProtectionSection.style.display = 'none';
    }
  }
  
  // Set gallery customization options if available in the plan
  const customizationSection = settingsModal.querySelector('#galleryCustomizationSection');
  if (customizationSection) {
    // Get plan info
    const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
      window.SUBSCRIPTION_PLANS[gallery.planType] : null;
      
    // Check if any customization is available in this plan
    const hasBasicCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('Basic Gallery Customization');
    const hasAdvancedCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('Advanced Gallery Customization');
    const hasCompleteCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('Complete Gallery Customization');
    const hasWhiteLabelCustomization = planInfo && planInfo.features && 
      planInfo.features.includes('White-label Gallery Customization');
      
    if (hasBasicCustomization || hasAdvancedCustomization || 
        hasCompleteCustomization || hasWhiteLabelCustomization) {
      
      customizationSection.style.display = 'block';
      
      // Show/hide advanced options based on plan level
      const advancedCustomizationOptions = customizationSection.querySelector('.advanced-customization-options');
      if (advancedCustomizationOptions) {
        if (hasAdvancedCustomization || hasCompleteCustomization || hasWhiteLabelCustomization) {
          advancedCustomizationOptions.style.display = 'block';
        } else {
          advancedCustomizationOptions.style.display = 'none';
        }
      }
      
      // Show/hide complete customization options
      const completeCustomizationOptions = customizationSection.querySelector('.complete-customization-options');
      if (completeCustomizationOptions) {
        if (hasCompleteCustomization || hasWhiteLabelCustomization) {
          completeCustomizationOptions.style.display = 'block';
        } else {
          completeCustomizationOptions.style.display = 'none';
        }
      }
      
      // Show/hide white label options
      const whiteLabelOptions = customizationSection.querySelector('.white-label-options');
      if (whiteLabelOptions) {
        if (hasWhiteLabelCustomization) {
          whiteLabelOptions.style.display = 'block';
        } else {
          whiteLabelOptions.style.display = 'none';
        }
      }
      
      // Set existing customization values if any
      if (gallery.customization) {
        // Basic customization
        const themeSelect = settingsModal.querySelector('#galleryTheme');
        if (themeSelect) themeSelect.value = gallery.customization.theme || 'default';
        
        const logoUrlInput = settingsModal.querySelector('#logoUrl');
        if (logoUrlInput) logoUrlInput.value = gallery.customization.logoUrl || '';
        
        // Advanced customization
        const headerTextInput = settingsModal.querySelector('#headerText');
        if (headerTextInput) headerTextInput.value = gallery.customization.headerText || '';
        
        const accentColorInput = settingsModal.querySelector('#accentColor');
        if (accentColorInput) accentColorInput.value = gallery.customization.accentColor || '#4A90E2';
        
        // Complete customization
        const customCssInput = settingsModal.querySelector('#customCss');
        if (customCssInput) customCssInput.value = gallery.customization.customCss || '';
        
        // White label options
        const hidePromoInput = settingsModal.querySelector('#hidePromo');
        if (hidePromoInput) hidePromoInput.checked = gallery.customization.hidePromo || false;
        
        const customDomainInput = settingsModal.querySelector('#customDomain');
        if (customDomainInput) customDomainInput.value = gallery.customization.customDomain || '';
      }
    } else {
      customizationSection.style.display = 'none';
    }
  }
  
  // Update gallery ID on the form
  const galleryIdInput = settingsModal.querySelector('#settingsGalleryId');
  if (galleryIdInput) galleryIdInput.value = galleryId;
  
  // Show the modal
  settingsModal.style.display = 'block';
}

/**
 * Updates a gallery's share link in Firestore
 * @param {string} galleryId - The ID of the gallery to update
 * @param {string} shareLink - The new share link
 */
async function updateGalleryShareLink(galleryId, shareLink) {
  try {
    if (!window.galleryManagerVars.currentUser || !galleryId) return;
    
    const db = firebase.firestore();
    await db.collection('galleries').doc(galleryId).update({
      shareLink: shareLink,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update local gallery data
    const galleryIndex = window.galleryManagerVars.userGalleries.findIndex(g => g.id === galleryId);
    if (galleryIndex !== -1) {
      window.galleryManagerVars.userGalleries[galleryIndex].shareLink = shareLink;
    }
    
  } catch (error) {
    console.error('Error updating gallery share link:', error);
    throw error;
  }
}
