/**
 * gallery-manager.js - Manages client galleries with plan-based controls
 * Complements subscription-manager.js for the SnapSelect application
 */

// Gallery status constants
const GALLERY_STATUS = {
  ACTIVE: 'active',
  PROCESSING: 'processing',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  LOCKED: 'locked',
  ARCHIVED: 'archived'
};

// Global variables
let currentUser = null, userGalleries = [], loadedGalleries = false;

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
        currentUser = user;
        try {
          // If PerformanceManager exists, check for cached galleries
          const cachedGalleries = window.PerformanceManager && typeof window.PerformanceManager.getCachedData === 'function' 
            ? window.PerformanceManager.getCachedData('user_galleries') 
            : null;
            
          if (cachedGalleries) {
            userGalleries = cachedGalleries;
            updateGalleriesDisplay();
          } else {
            // Set default empty array if no cached galleries
            userGalleries = [];
          }
          
          // Load fresh gallery data
          await loadGalleries();
          
          // Cache the new gallery data if PerformanceManager exists
          if (window.PerformanceManager && typeof window.PerformanceManager.cacheData === 'function') {
            window.PerformanceManager.cacheData('user_galleries', userGalleries);
          }
          
          // Hide loading overlay
          if (typeof hideLoadingOverlay === 'function') {
            hideLoadingOverlay();
          }
          
          loadedGalleries = true;
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
    if (!currentUser) return;
    
    const db = firebase.firestore();
    
    // Create a query for all galleries by this photographer
    const galleryQuery = db.collection('galleries')
      .where('photographerId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc');
    
    // If we're on the dashboard, limit to recent galleries only
    const isDashboard = window.location.href.includes('photographer-dashboard.html');
    const finalQuery = isDashboard ? galleryQuery.limit(4) : galleryQuery;
    
    const galleriesSnapshot = await finalQuery.get();
    
    // Clear existing galleries and load new ones
    userGalleries = [];
    
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
      userGalleries.push(galleryData);
      
      // Create a promise to get client info and plan details
      if (galleryData.clientId) {
        const clientPromise = db.collection('clients').doc(galleryData.clientId).get()
          .then(clientDoc => {
            if (clientDoc.exists) {
              const clientData = clientDoc.data();
              
              // Find the gallery we just added and update its client information
              const galleryIndex = userGalleries.findIndex(g => g.id === doc.id);
              if (galleryIndex !== -1) {
                userGalleries[galleryIndex].clientName = clientData.name || clientData.email || 'Unknown Client';
                userGalleries[galleryIndex].clientEmail = clientData.email || '';
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
              const galleryIndex = userGalleries.findIndex(g => g.id === doc.id);
              if (galleryIndex !== -1) {
                userGalleries[galleryIndex].planStatus = planData.status || 'unknown';
                userGalleries[galleryIndex].planEndDate = planData.planEndDate || null;
                
                // Update gallery status based on plan status if needed
                if (planData.status === 'expired' && userGalleries[galleryIndex].status === 'active') {
                  userGalleries[galleryIndex].status = 'expired';
                } else if (planData.status === 'expiring_soon' && userGalleries[galleryIndex].status === 'active') {
                  userGalleries[galleryIndex].status = 'expiring_soon';
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
    document.dispatchEvent(new CustomEvent('galleries-loaded', { detail: { galleries: userGalleries } }));
    
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
  if (userGalleries.length === 0) {
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
  userGalleries.forEach(gallery => {
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
    case GALLERY_STATUS.PROCESSING:
      statusBadge = '<span class="status-badge processing">Processing</span>';
      break;
    case GALLERY_STATUS.EXPIRING_SOON:
      statusBadge = '<span class="status-badge expiring">Expiring Soon</span>';
      break;
    case GALLERY_STATUS.EXPIRED:
      statusBadge = '<span class="status-badge expired">Expired</span>';
      break;
    case GALLERY_STATUS.LOCKED:
      statusBadge = '<span class="status-badge locked">Locked</span>';
      break;
    case GALLERY_STATUS.ARCHIVED:
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
  const gallery = userGalleries.find(g => g.id === galleryId);
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
  if (gallery.status === GALLERY_STATUS.EXPIRED || gallery.status === GALLERY_STATUS.LOCKED) {
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
  const gallery = userGalleries.find(g => g.id === galleryId);
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
  const gallery = userGalleries.find(g => g.id === galleryId);
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
    const galleryIndex = userGalleries.findIndex(g => g.id === galleryId);
    if (galleryIndex !== -1) {
      Object.assign(userGalleries[galleryIndex], updateData);
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
      gallery: userGalleries.find(g => g.id === galleryId)
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
}

/**
 * Handles photo upload process for a gallery
 * Includes plan limit validations
 * @param {string} galleryId - The ID of the gallery for uploads
 * @param {FileList} files - The files to upload
 */
async function handlePhotoUpload(galleryId, files) {
  try {
    if (!currentUser || !galleryId || !files || files.length === 0) {
      throw new Error('Missing required parameters');
    }
    
    // Show loading overlay
    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay('Preparing to upload photos...');
    }
    
    // Find gallery data
    const gallery = userGalleries.find(g => g.id === galleryId);
    if (!gallery) {
      throw new Error(`Gallery with ID ${galleryId} not found`);
    }
    
    // Get plan info
    const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ? 
      window.SUBSCRIPTION_PLANS[gallery.planType] : null;
      
    if (!planInfo) {
      throw new Error('Plan information not found for this gallery');
    }
    
    // Validate photo count limit
    const currentPhotos = gallery.photosCount || 0;
    const photoLimit = planInfo.photosPerGallery;
    const remainingSlots = photoLimit - currentPhotos;
    
    if (remainingSlots <= 0) {
      throw new Error(`This gallery has reached its limit of ${photoLimit} photos. Please upgrade the plan to add more photos.`);
    }
    
    // Limit upload to remaining slots
    const filesToUpload = files.length > remainingSlots ? Array.from(files).slice(0, remainingSlots) : files;
    
    if (files.length > remainingSlots) {
      console.warn(`Only uploading ${remainingSlots} of ${files.length} selected photos due to plan limits`);
      
      // Show warning notification
      if (window.NotificationSystem) {
        window.NotificationSystem.showNotification(
          'warning',
          'Photo Limit',
          `Only uploading ${remainingSlots} of ${files.length} photos due to plan limits.`
        );
      }
    }
    
    // Get plan's storage limit
    const storageLimit = planInfo.storageLimit * 1024 * 1024 * 1024; // Convert GB to bytes
    
    // Find the plan in activePlans if possible
    let activePlan = null;
    if (window.activePlans && Array.isArray(window.activePlans)) {
      activePlan = window.activePlans.find(p => p.id === gallery.planId);
    }
    
    // Get current storage usage
    const currentStorage = activePlan ? (activePlan.storageUsed || 0) : 0;
    const remainingStorage = storageLimit - currentStorage;
    
    if (remainingStorage <= 0) {
      throw new Error(`This plan has reached its storage limit of ${planInfo.storageLimit}GB. Please upgrade the plan for more storage.`);
    }
    
    // Validate file types and sizes
    const validFiles = [];
    const invalidFiles = [];
    const totalSize = Array.from(filesToUpload).reduce((total, file) => total + file.size, 0);
    
    // Check if total size exceeds remaining storage
    if (totalSize > remainingStorage) {
      throw new Error(`The selected files (${(totalSize / (1024 * 1024)).toFixed(2)}MB) exceed your remaining storage (${(remainingStorage / (1024 * 1024)).toFixed(2)}MB).`);
    }
    
    // Validate individual files
    for (const file of filesToUpload) {
      // Check file type (only allow images)
      const isImage = file.type.startsWith('image/');
      
      // Check file size (limit to 10MB per file)
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      
      if (isImage && isValidSize) {
        validFiles.push(file);
      } else {
        invalidFiles.push({
          name: file.name,
          reason: !isImage ? 'Not an image file' : 'Exceeds 10MB size limit'
        });
      }
    }
    
    // If there are invalid files, notify the user
    if (invalidFiles.length > 0) {
      console.warn('Some files were skipped:', invalidFiles);
      
      if (window.NotificationSystem) {
        window.NotificationSystem.showNotification(
          'warning',
          'Some files skipped',
          `${invalidFiles.length} files were skipped due to invalid type or size.`
        );
      }
      
      // If no valid files remain, throw error
      if (validFiles.length === 0) {
        throw new Error('No valid files to upload. Please select image files under 10MB each.');
      }
    }
    
    // Update loading message
    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay(`Uploading ${validFiles.length} photos...`);
    }
    
    // Initialize Firebase Storage if needed
    const storage = firebase.storage();
    const storageRef = storage.ref();
    const galleryStorageRef = storageRef.child(`galleries/${galleryId}`);
    
    // Upload each file
    const uploadPromises = [];
    const uploadedFiles = [];
    
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      
      // Create a unique filename using timestamp and original extension
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const uniqueName = `photo_${timestamp}_${i}.${fileExt}`;
      
      // Create a reference to the file location
      const fileRef = galleryStorageRef.child(uniqueName);
      
      // Create metadata including original filename
      const metadata = {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedBy: currentUser.uid,
          uploadedAt: new Date().toISOString()
        }
      };
      
      // Upload the file
      const uploadTask = fileRef.put(file, metadata);
      
      // Create a promise for this upload
      const uploadPromise = new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          // Progress function
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload ${i+1}/${validFiles.length}: ${progress.toFixed(0)}% complete`);
            
            // Update loading message with progress for the first file (to avoid too many updates)
            if (i === 0 && typeof showLoadingOverlay === 'function') {
              showLoadingOverlay(`Uploading photos... ${Math.floor(progress)}%`);
            }
          },
          // Error function
          (error) => {
            console.error(`Error uploading ${file.name}:`, error);
            reject(error);
          },
          // Complete function
          async () => {
            try {
              // Get the download URL
              const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
              
              // Record upload data
              uploadedFiles.push({
                name: file.name,
                size: file.size,
                type: file.type,
                url: downloadURL,
                path: fileRef.fullPath,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        );
      });
      
      uploadPromises.push(uploadPromise);
    }
    
    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    
    // Update loading message
    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay('Finalizing upload...');
    }
    
    // Update gallery data in Firestore
    const db = firebase.firestore();
    const galleryDocRef = db.collection('galleries').doc(galleryId);
    
    // Get the current gallery data first to ensure we have the latest
    const galleryDoc = await galleryDocRef.get();
    if (!galleryDoc.exists) {
      throw new Error('Gallery no longer exists');
    }
    
    const currentGalleryData = galleryDoc.data();
    const updatedPhotosCount = (currentGalleryData.photosCount || 0) + uploadedFiles.length;
    
    // Prepare photo data to save
    const photoData = uploadedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url,
      path: file.path,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      uploadedBy: currentUser.uid,
      status: 'active'
    }));
    
    // Update gallery document
    await galleryDocRef.update({
      photosCount: updatedPhotosCount,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastUploadAt: firebase.firestore.FieldValue.serverTimestamp(),
      coverImage: currentGalleryData.coverImage || (uploadedFiles.length > 0 ? uploadedFiles[0].url : null)
    });
    
    // Add photos to gallery_photos subcollection
    const batch = db.batch();
    
    photoData.forEach(photo => {
      const photoRef = galleryDocRef.collection('photos').doc();
      batch.set(photoRef, photo);
    });
    
    await batch.commit();
    
    // Update storage usage for the plan
    if (activePlan) {
      const totalUploadSize = uploadedFiles.reduce((total, file) => total + file.size, 0);
      const newStorageUsed = currentStorage + totalUploadSize;
      
      await db.collection('client-plans').doc(activePlan.id).update({
        storageUsed: newStorageUsed,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update local cache of active plans
      if (window.activePlans) {
        const planIndex = window.activePlans.findIndex(p => p.id === activePlan.id);
        if (planIndex !== -1) {
          window.activePlans[planIndex].storageUsed = newStorageUsed;
        }
      }
      
      // Update storage usage display if function exists
      if (window.subscriptionManager && window.subscriptionManager.updateStorageUsage) {
        window.subscriptionManager.updateStorageUsage();
      }
    }
    
    // Update local gallery data
    const galleryIndex = userGalleries.findIndex(g => g.id === galleryId);
    if (galleryIndex !== -1) {
      userGalleries[galleryIndex].photosCount = updatedPhotosCount;
      if (!userGalleries[galleryIndex].coverImage && uploadedFiles.length > 0) {
        userGalleries[galleryIndex].coverImage = uploadedFiles[0].url;
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
 * Handle file selection for upload
 * @param {Event} event - The file input change event
 */
function handleFileSelection(event) {
  const fileInput = event.target;
  const files = fileInput.files;
  
  if (!files || files.length === 0) return;
  
  // Get the gallery ID from the form's data attribute
  const uploadForm = fileInput.closest('form');
  if (!uploadForm) return;
  
  const galleryId = uploadForm.getAttribute('data-gallery-id');
  if (!galleryId) {
    console.error('No gallery ID found on the upload form');
    return;
  }
  
  // Update the file count display if it exists
  const fileCountEl = uploadForm.querySelector('.file-count');
  if (fileCountEl) {
    fileCountEl.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} selected`;
  }
  
  // Enable the upload button if it exists
  const uploadBtn = uploadForm.querySelector('button[type="submit"]');
  if (uploadBtn) {
    uploadBtn.disabled = false;
  }
}

/**
 * Handle upload form submission
 * @param {Event} event - The form submit event
 */
function handleUploadFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const galleryId = form.getAttribute('data-gallery-id');
  const fileInput = form.querySelector('input[type="file"]');
  
  if (!galleryId || !fileInput || !fileInput.files || fileInput.files.length === 0) {
    return;
  }
  
  // Process the upload
  handlePhotoUpload(galleryId, fileInput.files)
    .then(() => {
      // Reset the form
      form.reset();
      
      // Close the modal
      const modal = form.closest('.modal');
      if (modal) {
        modal.style.display = 'none';
      }
    })
    .catch(error => {
      console.error('Error in upload form submission:', error);
    });
}

/**
 * Handle gallery settings form submission
 * @param {Event} event - The form submit event
 */
function handleSettingsFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const galleryId = form.querySelector('#settingsGalleryId').value;
  
  if (!galleryId) {
    console.error('No gallery ID found in the settings form');
    return;
  }
  
  // Get form data
  const settings = {
    name: form.querySelector('#gallerySettingsName').value,
    description: form.querySelector('#gallerySettingsDescription').value,
    
    // Password protection settings
    enablePassword: form.querySelector('#passwordProtectionToggle')?.checked || false,
    password: form.querySelector('#galleryPassword')?.value || '',
    
    // Customization settings - basic
    theme: form.querySelector('#galleryTheme')?.value || 'default',
    logoUrl: form.querySelector('#logoUrl')?.value || '',
    
    // Customization settings - advanced
    headerText: form.querySelector('#headerText')?.value || '',
    accentColor: form.querySelector('#accentColor')?.value || '#4A90E2',
    
    // Customization settings - complete
    customCss: form.querySelector('#customCss')?.value || '',
    
    // Customization settings - white label
    hidePromo: form.querySelector('#hidePromo')?.checked || false,
    customDomain: form.querySelector('#customDomain')?.value || ''
  };
  
  // Save the settings
  saveGallerySettings(galleryId, settings)
    .then(() => {
      // Close the modal
      const modal = form.closest('.modal');
      if (modal) {
        modal.style.display = 'none';
      }
    })
    .catch(error => {
      console.error('Error in settings form submission:', error);
    });
}

/**
 * Create a copy button to copy link to clipboard
 * @param {string} targetId - The ID of the input element to copy from
 * @returns {HTMLElement} - The copy button element
 */
function createCopyButton(targetId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn copy-btn';
  button.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
  
  button.addEventListener('click', () => {
    const input = document.getElementById(targetId);
    if (!input) return;
    
    // Select the text
    input.select();
    input.setSelectionRange(0, 99999); // For mobile devices
    
    // Copy to clipboard
    document.execCommand('copy');
    
    // Change button text temporarily
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
    
    // Reset button text after a delay
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 2000);
    
    // Show notification if available
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification(
        'success',
        'Copied',
        'Link copied to clipboard!'
      );
    }
  });
  
  return button;
}

// Add event listeners for export
document.addEventListener('galleries-loaded', function(event) {
  const galleries = event.detail.galleries;
  console.log(`Galleries loaded event received: ${galleries.length} galleries`);
  
  // If there are dashboard stats, update them
  const galleryCountEl = document.getElementById('activeGalleriesCount');
  if (galleryCountEl) {
    const activeGalleries = galleries.filter(g => 
      g.status === GALLERY_STATUS.ACTIVE || 
      g.status === GALLERY_STATUS.PROCESSING ||
      g.status === GALLERY_STATUS.EXPIRING_SOON
    ).length;
    
    galleryCountEl.textContent = activeGalleries;
  }
});

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Gallery manager initializing...');
  
  // Check if required JS libraries are loaded
  const requiredLibraries = {
    firebase: typeof firebase !== 'undefined'
  };
  
  console.log('Required libraries status:', requiredLibraries);
  
  // Setup event listeners for forms
  
  // Upload photos form
  const uploadPhotosForm = document.getElementById('uploadPhotosForm');
  if (uploadPhotosForm) {
    // File input change event
    const fileInput = uploadPhotosForm.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileSelection);
    }
    
    // Form submit event
    uploadPhotosForm.addEventListener('submit', handleUploadFormSubmit);
  }
  
  // Gallery settings form
  const gallerySettingsForm = document.getElementById('gallerySettingsForm');
  if (gallerySettingsForm) {
    gallerySettingsForm.addEventListener('submit', handleSettingsFormSubmit);
  }
  
  // Share gallery form - add copy button
  const shareGalleryModal = document.getElementById('shareGalleryModal');
  if (shareGalleryModal) {
    const shareLinkInput = shareGalleryModal.querySelector('#shareLinkInput');
    const copyBtnContainer = shareGalleryModal.querySelector('.copy-btn-container');
    
    if (shareLinkInput && copyBtnContainer) {
      // Create and append the copy button
      const copyBtn = createCopyButton('shareLinkInput');
      copyBtnContainer.appendChild(copyBtn);
    }
  }
  
  // Initialize the gallery manager
  initGalleryManager();
});

// Export gallery manager functions to global scope
window.galleryManager = {
  loadGalleries,
  createGallery: window.subscriptionManager?.createGallery || null,
  handlePhotoUpload,
  saveGallerySettings,
  viewGallery,
  showUploadPhotosModal,
  showShareGalleryModal,
  showGallerySettingsModal,
  filterGalleries,
  GALLERY_STATUS
};
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
    if (!currentUser || !galleryId) return;
    
    const db = firebase.firestore();
    await db.collection('galleries').doc(galleryId).update({
      shareLink: shareLink,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update local gallery data
    const galleryIndex = userGalleries.findIndex(g => g.id === galleryId);
    if (galleryIndex !== -1) {
      userGalleries[galleryIndex].shareLink = shareLink;
    }
    
  } catch (error) {
    console.error('Error updating gallery share link:', error);
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
    if (!currentUser || !galleryId) return;
    
    // Show loading overlay
    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay('Saving gallery settings...');
    }
    
    // Find the gallery
    const gallery = userGalleries.find(g => g.id === galleryId);
    if (!gallery) {
      throw new Error(`Gallery with ID ${galleryId} not found`);
    }
    
    // Get plan info
    const planInfo = window.SUBSCRIPTION_PLANS && gallery.planType ?
