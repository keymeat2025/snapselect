 /**
 * gallery-view.js - Handles displaying and interacting with a photo gallery
 * Updated with pagination, synchronization, plan enforcement, and upload reliability
 * Enhanced with improved file rejection handling and visualization
 */

// Global variables
let currentUser = null;
let galleryId = null;
let clientId = null;
let galleryData = null;
let photosList = [];
let lastVisiblePhoto = null; // Track last document for pagination
let isLoadingMore = false; // Flag to prevent duplicate loading
let allPhotosLoaded = false; // Flag to indicate when all photos are loaded
let selectedStatus = 'active'; // Track selected status filter
let planLimits = null; // Store plan limits

// Upload management variables
let uploadQueue = [];
let isUploading = false;
let uploadPaused = false;
let currentUploadIndex = 0;

// MVP Upload Enhancement Variables
let activeUploadTasks = new Map(); // Store active Firebase upload tasks
let uploadStateManager = null; // Upload state persistence manager
let progressUpdateThrottler = null; // Progress update throttler
let concurrentUploadLimit = 5; // Number of concurrent uploads
let uploadRetryAttempts = new Map(); // Track retry attempts per file
let uploadSessionId = null; // Unique session ID for this upload batch



// New file selection variables
window.allSelectedFiles = []; // All files selected for upload (includes rejected ones)
window.filesToUpload = []; // Files that passed validation
window.rejectedFiles = []; // Files that were rejected with reasons

// Constants
const THUMBNAIL_SIZE = 'md'; // Thumbnail size to use (options: sm, md, lg)
const PHOTOS_PER_PAGE = 30; // Number of photos to load per page
const DEFAULT_PLAN = 'basic'; // Default plan if no plan is found

// Upload state persistence keys
const UPLOAD_STATE_KEY = 'snapselect_upload_state';
const UPLOAD_QUEUE_KEY = 'snapselect_upload_queue';
const UPLOAD_PROGRESS_KEY = 'snapselect_upload_progress';

// Plan limits based on subscription
const PLAN_LIMITS = {
  lite: { photos: 100, storageGB: 2, maxSize: 5 },
  mini: { photos: 200, storageGB: 5, maxSize: 8 },
  basic: { photos: 500, storageGB: 15, maxSize: 12 },
  pro: { photos: 800, storageGB: 25, maxSize: 15 },
  premium: { photos: 1200, storageGB: 50, maxSize: 20 },
  ultimate: { photos: 2500, storageGB: 100, maxSize: 25 }
};

// Functions for loading overlay
function showLoadingOverlay(message) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (!loadingOverlay) return;
  
  const loadingText = loadingOverlay.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = message || 'Loading...';
  
  loadingOverlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// MVP Upload State Manager
class UploadStateManager {
  constructor() {
    this.sessionId = Date.now().toString();
    this.state = this.loadState();
  }

  saveState() {
    try {
      const stateData = {
        sessionId: this.sessionId,
        galleryId: galleryId,
        uploadQueue: uploadQueue.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        })),
        currentIndex: currentUploadIndex,
        isUploading: isUploading,
        isPaused: uploadPaused,
        timestamp: Date.now()
      };
      
      localStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify(stateData));
    } catch (error) {
      console.error('Failed to save upload state:', error);
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(UPLOAD_STATE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        // Only restore if it's recent (within 1 hour) and same gallery
        if (Date.now() - state.timestamp < 3600000 && state.galleryId === galleryId) {
          return state;
        }
      }
    } catch (error) {
      console.error('Failed to load upload state:', error);
    }
    return null;
  }

  clearState() {
    localStorage.removeItem(UPLOAD_STATE_KEY);
    localStorage.removeItem(UPLOAD_QUEUE_KEY);
    localStorage.removeItem(UPLOAD_PROGRESS_KEY);
  }

  hasResumableUpload() {
    return this.state && this.state.uploadQueue && this.state.uploadQueue.length > 0;
  }
}


// Initialize gallery view
function initGalleryView() {
  try {
    // Show loading overlay
    showLoadingOverlay('Loading gallery...');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    galleryId = urlParams.get('id');
    clientId = urlParams.get('client');
    
    if (!galleryId) {
      showErrorMessage('No gallery specified');
      hideLoadingOverlay();
      return;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Check authentication state
    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        currentUser = user;
        
        try {
          // Initialize additional components if needed
          if (window.SecurityManager && typeof window.SecurityManager.init === 'function') {
            window.SecurityManager.init();
          }
          
          // Load gallery data
          await loadGalleryData();
          
          // Update user info in header
          updateUserInfo();
          
          // Hide loading overlay
          hideLoadingOverlay();
        } catch (error) {
          console.error('Error initializing gallery view:', error);
          showErrorMessage('Failed to load gallery. Please try again.');
          hideLoadingOverlay();
        }
      } else {
        // Not logged in, redirect to login page
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
      }
    });
  } catch (error) {
    console.error('Error initializing gallery view:', error);
    hideLoadingOverlay();
  }
}

// Set up event listeners - with new listeners for pagination, sync and upload management
function setupEventListeners() {
  // Original event listeners
  const uploadPhotosBtn = document.getElementById('uploadPhotosBtn');
  if (uploadPhotosBtn) uploadPhotosBtn.addEventListener('click', showUploadPhotosModal);
  
  const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
  if (emptyStateUploadBtn) emptyStateUploadBtn.addEventListener('click', showUploadPhotosModal);
  
  const shareGalleryBtn = document.getElementById('shareGalleryBtn');
  if (shareGalleryBtn) shareGalleryBtn.addEventListener('click', showShareGalleryModal);
  
  const gallerySettingsBtn = document.getElementById('gallerySettingsBtn');
  if (gallerySettingsBtn) gallerySettingsBtn.addEventListener('click', showGallerySettingsModal);
  
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) sortFilter.addEventListener('change', handleSortChange);
  
  // View toggle buttons
  const gridViewBtn = document.getElementById('gridViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  if (gridViewBtn) gridViewBtn.addEventListener('click', () => setViewMode('grid'));
  if (listViewBtn) listViewBtn.addEventListener('click', () => setViewMode('list'));
  
  // Upload modal close button
  const closeUploadModalBtn = document.querySelector('#uploadPhotosModal .close-modal');
  if (closeUploadModalBtn) closeUploadModalBtn.addEventListener('click', hideUploadPhotosModal);
  
  // Upload area click handler
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('click', () => {
      document.getElementById('photoFileInput').click();
    });
    
    // Drag and drop handlers
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
  }
  
  // File input change handler
  const photoFileInput = document.getElementById('photoFileInput');
  if (photoFileInput) {
    // Remove any existing listener to prevent duplicates
    photoFileInput.removeEventListener('change', handleFileSelect);
    photoFileInput.addEventListener('change', handleFileSelect);
  }
  
  // Upload buttons
  const startUploadBtn = document.getElementById('startUploadBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  
  if (startUploadBtn) startUploadBtn.addEventListener('click', startPhotoUpload);
  if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', cancelUpload);
  if (pauseUploadBtn) pauseUploadBtn.addEventListener('click', togglePauseUpload);
  
  // --- NEW EVENT LISTENERS ---
  
  // Load more button
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMorePhotos);
  
  // Status filter
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) statusFilter.addEventListener('change', handleStatusChange);
  
  // Sync button (only for gallery owner)
  const syncPhotosBtn = document.getElementById('syncPhotosBtn');
  if (syncPhotosBtn) syncPhotosBtn.addEventListener('click', syncStorageWithFirestore);
  
  // Back to select files button (when all files are rejected)
  const backToSelectBtn = document.getElementById('backToSelectBtn');
  if (backToSelectBtn) backToSelectBtn.addEventListener('click', () => {
    const uploadStep1 = document.getElementById('uploadStep1');
    const uploadStep2 = document.getElementById('uploadStep2');
    
    if (uploadStep1) uploadStep1.style.display = 'block';
    if (uploadStep2) uploadStep2.style.display = 'none';
    
    // Update steps indicator if it exists
    const uploadSteps = document.querySelectorAll('.upload-step');
    if (uploadSteps.length >= 2) {
      uploadSteps[0].classList.add('active');
      uploadSteps[0].classList.remove('completed');
      uploadSteps[1].classList.remove('active');
    }
  });
}

// Handle drag over event
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Add a visual indicator when files are dragged over
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.classList.add('dragging');
  }
}

// Handle drag leave event
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Remove visual indicator when files are dragged out
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.classList.remove('dragging');
  }
}

// Handle file drop event
function handleFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Remove visual indicator
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.classList.remove('dragging');
  }
  
  // Get the files from the drop event
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFiles(files);
  }
}

// Helper function to get photo ID from clicked element
function getPhotoIdFromElement(element) {
  // Find the closest parent with data-photo-id attribute
  let current = element;
  
  while (current && !current.getAttribute('data-photo-id')) {
    current = current.parentElement;
  }
  
  return current ? current.getAttribute('data-photo-id') : null;
}

// Update sync progress display
function updateSyncProgress(current, total) {
  const percent = Math.round((current / total) * 100);
  const loadingText = document.querySelector('#loadingOverlay .loading-text');
  
  if (loadingText) {
    loadingText.textContent = `Synchronizing photos: ${percent}% (${current}/${total})`;
  }
}

// Load gallery data from Firestore
async function loadGalleryData() {
  try {
    if (!galleryId || !currentUser) {
      throw new Error('Missing gallery ID or user is not logged in');
    }
    
    const db = firebase.firestore();
    const galleryDoc = await db.collection('galleries').doc(galleryId).get();
    
    if (!galleryDoc.exists) {
      throw new Error('Gallery not found');
    }
    
    galleryData = { id: galleryDoc.id, ...galleryDoc.data() };
    
    // Add human-readable fields for admin searching
    galleryData.ownerEmail = currentUser.email;
    galleryData.searchLabel = `Gallery: ${galleryData.name || 'Untitled'} - ${currentUser.email}`;
    
    // Check permissions - owner or client access only
    const isOwner = galleryData.photographerId === currentUser.uid;
    const hasClientAccess = galleryData.clientId === clientId && clientId;
    
    if (!isOwner && !hasClientAccess) {
      throw new Error('You do not have permission to view this gallery');
    }
    
    // Show sync button only for the gallery owner
    const syncPhotosBtn = document.getElementById('syncPhotosBtn');
    if (syncPhotosBtn) {
      syncPhotosBtn.style.display = isOwner ? 'block' : 'none';
    }
    
    // Show owner controls panel only for the owner
    const ownerControlsPanel = document.getElementById('ownerControlsPanel');
    if (ownerControlsPanel) {
      ownerControlsPanel.style.display = isOwner ? 'block' : 'none';
    }
    
    // Get plan limits
    if (galleryData.planType && PLAN_LIMITS[galleryData.planType]) {
      planLimits = PLAN_LIMITS[galleryData.planType];
    } else {
      // Use default plan if none specified
      planLimits = PLAN_LIMITS[DEFAULT_PLAN];
      console.log('No plan type found, using default plan limits');
    }
    
    // Update UI with gallery data
    updateGalleryInfo();
    
    // Load photos with pagination
    await loadGalleryPhotos(true);
    
    // Load client data if needed
    if (clientId && !galleryData.clientName) {
      try {
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (clientDoc.exists) {
          galleryData.clientName = clientDoc.data().name || clientDoc.data().email || 'Unknown Client';
          updateGalleryInfo();
        }
      } catch (clientError) {
        console.error('Error loading client data:', clientError);
        // Non-critical error, continue
      }
    }
    
    // Show plan limits notification if close to limit
    if (planLimits && galleryData.photosCount) {
      const percentUsed = (galleryData.photosCount / planLimits.photos) * 100;
      if (percentUsed >= 90) {
        showWarningMessage(`This gallery is at ${percentUsed.toFixed(0)}% of its photo limit (${galleryData.photosCount}/${planLimits.photos})`);
      } else if (percentUsed >= 80) {
        showInfoMessage(`This gallery is at ${percentUsed.toFixed(0)}% of its photo limit (${galleryData.photosCount}/${planLimits.photos})`);
      }
    }
    
    // Update max file size in upload modal if it exists
    const maxFileSizeEl = document.getElementById('maxFileSize');
    if (maxFileSizeEl && planLimits) {
      maxFileSizeEl.textContent = planLimits.maxSize;
    }

// Check if gallery is shared
    const isGalleryShared = await checkIfGalleryIsShared();
    galleryData.isShared = isGalleryShared; // Store in galleryData object

    // Disable upload buttons if gallery is shared
    if (isGalleryShared) {
      // Hide or disable upload buttons
      const uploadPhotosBtn = document.getElementById('uploadPhotosBtn');
      if (uploadPhotosBtn) {
        uploadPhotosBtn.style.display = 'none';
      }
      
      // Also hide the "empty state" upload button 
      const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
      if (emptyStateUploadBtn) {
        emptyStateUploadBtn.style.display = 'none';
      }
      
      // Show a message to inform the photographer
      showInfoMessage('This gallery is shared with clients. Uploads are disabled.');
    }
    
    return galleryData;
  } catch (error) {
    console.error('Error loading gallery data:', error);
    showErrorMessage(`Failed to load gallery: ${error.message}`);
    throw error;
  }
}

// Load photos from the gallery with pagination support
async function loadGalleryPhotos(resetList = false) {
  try {
    if (isLoadingMore) return; // Prevent duplicate loading
    isLoadingMore = true;
    
    if (!galleryId || !currentUser) {
      throw new Error('Missing gallery ID or user is not logged in');
    }
    
    // If resetting the list, clear the last visible photo
    if (resetList) {
      lastVisiblePhoto = null;
      photosList = [];
      allPhotosLoaded = false;
    }
    
    // Show loading state for photos
    const photosContainer = document.getElementById('photosContainer');
    const loadingIndicator = document.getElementById('photosLoadingIndicator');
    
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) loadMoreBtn.disabled = true;
    
    const db = firebase.firestore();
    
    // Start with a base query
    let photosQuery = db.collection('photos')
      .where('galleryId', '==', galleryId);
    
    // Apply status filter - show deleted photos only to the owner
    if (galleryData.photographerId === currentUser.uid) {
      // Owner can see any status based on filter
      photosQuery = photosQuery.where('status', '==', selectedStatus);
    } else {
      // Non-owners can only see active photos
      photosQuery = photosQuery.where('status', '==', 'active');
    }
    
    // Add sorting
    photosQuery = photosQuery.orderBy('createdAt', 'desc');
    
    // Add pagination using the last document
    if (lastVisiblePhoto) {
      photosQuery = photosQuery.startAfter(lastVisiblePhoto);
    }
    
    // Limit the number of photos per page
    photosQuery = photosQuery.limit(PHOTOS_PER_PAGE);
    
    // Execute the query
    const photosSnapshot = await photosQuery.get();
    
    // Check if we've reached the end
    if (photosSnapshot.empty) {
      allPhotosLoaded = true;
      
      if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
        loadMoreBtn.disabled = true;
      }
      
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      
      // If no photos and this is the initial load, show empty state
      if (photosList.length === 0) {
        renderPhotos(); // This will show the empty state
      }
      
      isLoadingMore = false;
      return;
    }
    
    // Store the last visible document for pagination
    lastVisiblePhoto = photosSnapshot.docs[photosSnapshot.docs.length - 1];
    
    // Add photos to the list
    photosSnapshot.forEach(doc => {
      photosList.push({ id: doc.id, ...doc.data() });
    });
    
    // Update photo count in gallery info
    const photoCountElement = document.getElementById('photoCount');
    if (photoCountElement) {
      const visibleCount = photosList.length;
      const totalCount = galleryData.photosCount || visibleCount;
      photoCountElement.textContent = `Photos: ${visibleCount}/${totalCount}`;
    }
    
    // Update UI with photos
    renderPhotos();
    
    // Update load more button visibility
    if (loadMoreBtn) {
      if (photosSnapshot.size < PHOTOS_PER_PAGE) {
        // We received fewer photos than the limit, so there are no more
        loadMoreBtn.style.display = 'none';
        allPhotosLoaded = true;
      } else {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.disabled = false;
      }
    }
    
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    isLoadingMore = false;
  } catch (error) {
    console.error('Error loading gallery photos:', error);
    showErrorMessage('Failed to load photos');
    
    const loadingIndicator = document.getElementById('photosLoadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) loadMoreBtn.disabled = false;
    
    isLoadingMore = false;
    throw error;
  }
}

// Load more photos (pagination)
function loadMorePhotos() {
  if (isLoadingMore || allPhotosLoaded) return;
  loadGalleryPhotos(false); // Don't reset the list
}

// Handle status filter change
function handleStatusChange(e) {
  selectedStatus = e.target.value;
  
  // Reset photos and reload with new status
  photosList = [];
  lastVisiblePhoto = null;
  allPhotosLoaded = false;
  loadGalleryPhotos(true);
}

// Render photos in the container with pagination support
function renderPhotos() {
  const photosContainer = document.getElementById('photosContainer');
  if (!photosContainer) return;
  
  // Check if we have photos
  if (photosList.length === 0) {
    // Show empty state
    photosContainer.innerHTML = `
      <div id="emptyStateContainer" class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-images"></i></div>
        <h3>No photos yet</h3>
        <p>Upload photos to get started with this gallery</p>
        <button id="emptyStateUploadBtn" class="btn primary-btn">Upload Photos</button>
      </div>
    `;
    
    // Re-attach event listener
    const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
    if (emptyStateUploadBtn) emptyStateUploadBtn.addEventListener('click', showUploadPhotosModal);
    
    return;
  }
  
  // For pagination: only clear container on first load
  if (photosContainer.classList.contains('photos-grid') && !photosContainer.querySelector('.photo-item')) {
    photosContainer.innerHTML = '';
  } else if (photosContainer.classList.contains('photos-list') && !photosContainer.querySelector('.photo-list-item')) {
    photosContainer.innerHTML = '';
  }
  
  // Get current view mode
  const isGridView = photosContainer.classList.contains('photos-grid');
  
  // Create photo elements for new photos
  photosList.forEach((photo, index) => {
    // Skip already rendered photos by checking if the element exists
    const existingElement = document.querySelector(`[data-photo-id="${photo.id}"]`);
    if (existingElement) return;
    
    const photoElement = document.createElement('div');
    photoElement.className = isGridView ? 'photo-item' : 'photo-list-item';
    photoElement.setAttribute('data-photo-id', photo.id);
    
    // Add status class for visual indication
    if (photo.status !== 'active') {
      photoElement.classList.add(`status-${photo.status}`);
    }
    
    // Get thumbnail URL
    const thumbnailUrl = photo.thumbnails?.[THUMBNAIL_SIZE] || photo.url || '';
    
    if (isGridView) {
      // Grid view
      photoElement.innerHTML = `
        <div class="photo-container" style="background-image: url('${thumbnailUrl}')">
          <div class="photo-overlay">
            <div class="photo-actions">
              <button class="photo-action-btn view-btn"><i class="fas fa-eye"></i></button>
              <button class="photo-action-btn info-btn"><i class="fas fa-info-circle"></i></button>
              <button class="photo-action-btn delete-btn"><i class="fas fa-trash"></i></button>
            </div>
            ${photo.status !== 'active' ? `<div class="photo-status">${photo.status}</div>` : ''}
          </div>
        </div>
        <div class="photo-details">
          <div class="photo-name">${photo.name || 'Untitled Photo'}</div>
          <div class="photo-date">${photo.createdAt?.toDate().toLocaleDateString() || 'Unknown date'}</div>
        </div>
      `;
    } else {
      // List view
      photoElement.innerHTML = `
        <div class="photo-list-thumbnail" style="background-image: url('${thumbnailUrl}')"></div>
        <div class="photo-list-details">
          <div class="photo-list-name">${photo.name || 'Untitled Photo'}</div>
          <div class="photo-list-meta">
            <span class="photo-list-date">${photo.createdAt?.toDate().toLocaleDateString() || 'Unknown date'}</span>
            <span class="photo-list-size">${formatFileSize(photo.size || 0)}</span>
            ${photo.status !== 'active' ? `<span class="photo-status-badge">${photo.status}</span>` : ''}
          </div>
        </div>
        <div class="photo-list-actions">
          <button class="photo-action-btn view-btn"><i class="fas fa-eye"></i></button>
          <button class="photo-action-btn info-btn"><i class="fas fa-info-circle"></i></button>
          <button class="photo-action-btn delete-btn"><i class="fas fa-trash"></i></button>
        </div>
      `;
    }
    
    photosContainer.appendChild(photoElement);
  });
  
  // Add click handlers for photo actions
  document.querySelectorAll('.photo-action-btn.view-btn').forEach(btn => {
    if (btn.getAttribute('data-handler-attached')) return; // Skip if handler already attached
    
    btn.setAttribute('data-handler-attached', 'true');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoId = getPhotoIdFromElement(e.target);
      viewPhoto(photoId);
    });
  });
  
  document.querySelectorAll('.photo-action-btn.info-btn').forEach(btn => {
    if (btn.getAttribute('data-handler-attached')) return; // Skip if handler already attached
    
    btn.setAttribute('data-handler-attached', 'true');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoId = getPhotoIdFromElement(e.target);
      showPhotoInfo(photoId);
    });
  });
  
  document.querySelectorAll('.photo-action-btn.delete-btn').forEach(btn => {
    if (btn.getAttribute('data-handler-attached')) return; // Skip if handler already attached
    
    btn.setAttribute('data-handler-attached', 'true');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoId = getPhotoIdFromElement(e.target);
      confirmDeletePhoto(photoId);
    });
  });
  
  // Add click handler for photo containers
  document.querySelectorAll('.photo-container, .photo-list-thumbnail').forEach(container => {
    if (container.getAttribute('data-handler-attached')) return; // Skip if handler already attached
    
    container.setAttribute('data-handler-attached', 'true');
    container.addEventListener('click', (e) => {
      const photoId = getPhotoIdFromElement(e.target);
      viewPhoto(photoId);
    });
  });
  
  // After rendering, check if load more button should be shown
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  if (loadMoreContainer) {
    loadMoreContainer.style.display = allPhotosLoaded ? 'none' : 'block';
  }
}

// Update gallery info in UI
function updateGalleryInfo() {
  if (!galleryData) return;
  
  // Update page title
  document.title = `${galleryData.name || 'Gallery'} - SnapSelect`;
  
  // Update gallery title
  const galleryTitleElement = document.getElementById('galleryTitle');
  if (galleryTitleElement) {
    galleryTitleElement.textContent = 'Gallery: ' + (galleryData.name || 'Untitled Gallery');
  }
  
  // Update gallery name
  const galleryNameElement = document.getElementById('galleryName');
  if (galleryNameElement) {
    galleryNameElement.textContent = galleryData.name || 'Untitled Gallery';
  }
  
  // Update client name
  const clientNameElement = document.getElementById('clientName');
  if (clientNameElement) {
    clientNameElement.textContent = 'Client: ' + (galleryData.clientName || 'Unknown Client');
  }
  
  // Update gallery description
  const galleryDescriptionElement = document.getElementById('galleryDescription');
  if (galleryDescriptionElement) {
    galleryDescriptionElement.textContent = galleryData.description || 'No description provided.';
  }
  
  // Update photo count
  const photoCountElement = document.getElementById('photoCount');
  if (photoCountElement) {
    photoCountElement.textContent = `Photos: ${galleryData.photosCount || 0}`;
  }
}

// Update user info in header
function updateUserInfo() {
  if (!currentUser) return;
  
  const userNameElement = document.getElementById('userName');
  if (userNameElement) {
    userNameElement.textContent = currentUser.displayName || currentUser.email || 'User';
  }
  
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  if (avatarPlaceholder) {
    avatarPlaceholder.textContent = (currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase();
  }
}

// Improved showUploadPhotosModal to prevent double opening
function showUploadPhotosModal() {
  const uploadPhotosModal = document.getElementById('uploadPhotosModal');
  if (!uploadPhotosModal) return;
  
  // Check if the modal is already visible - prevent double openings
  if (uploadPhotosModal.style.display === 'block') return;
  
  // Reset the upload form
  const uploadStep1 = document.getElementById('uploadStep1');
  const uploadStep2 = document.getElementById('uploadStep2');
  
  if (uploadStep1) uploadStep1.style.display = 'block';
  if (uploadStep2) uploadStep2.style.display = 'none';
  
  const uploadPreview = document.getElementById('uploadPreview');
  if (uploadPreview) uploadPreview.innerHTML = '';
  
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) uploadArea.classList.remove('dragging');
  
  // Reset file input
  const photoFileInput = document.getElementById('photoFileInput');
  if (photoFileInput) {
    photoFileInput.value = '';
    // Remove and reattach event listener to prevent duplicates
    photoFileInput.removeEventListener('change', handleFileSelect);
    photoFileInput.addEventListener('change', handleFileSelect);
  }
  
  // Make sure the pause button is hidden
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  if (pauseUploadBtn) pauseUploadBtn.style.display = 'none';
  
  // Hide rejection summary if it exists
  const rejectionSummary = document.getElementById('rejectionSummary');
  if (rejectionSummary) rejectionSummary.style.display = 'none';
  
  // Reset upload steps if they exist
  const uploadSteps = document.querySelectorAll('.upload-step');
  if (uploadSteps.length >= 2) {
    uploadSteps[0].classList.add('active');
    uploadSteps[0].classList.remove('completed');
    uploadSteps[1].classList.remove('active');
  }
  
  // Clear stored files
  window.allSelectedFiles = [];
  window.filesToUpload = [];
  window.rejectedFiles = [];
  
  // Reset upload state
  uploadQueue = [];
  isUploading = false;
  uploadPaused = false;
  currentUploadIndex = 0;
  
  // Show modal
  uploadPhotosModal.style.display = 'block';
}

// Hide upload photos modal
function hideUploadPhotosModal() {
  const uploadPhotosModal = document.getElementById('uploadPhotosModal');
  if (!uploadPhotosModal) return;
  
  // If uploads are in progress, confirm cancel
  if (isUploading && !confirm('Upload in progress. Are you sure you want to cancel?')) {
    return;
  }
  
  // Cancel any ongoing uploads
  cancelUpload(false); // Silent cancel
  
  // Hide modal
  uploadPhotosModal.style.display = 'none';
}

// Cancel current uploads
function cancelUpload(showMessage = true) {
  isUploading = false;
  uploadPaused = false;
  uploadQueue = [];
  currentUploadIndex = 0;
  
  // Reset UI
// Reset UI
  const uploadPreview = document.getElementById('uploadPreview');
  if (uploadPreview) uploadPreview.innerHTML = '';
  
  // Reset progress bar
  const totalProgressBar = document.getElementById('totalProgressBar');
  if (totalProgressBar) {
    totalProgressBar.style.width = '0%';
    totalProgressBar.setAttribute('aria-valuenow', 0);
  }
  
  // Hide progress container
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  if (uploadProgressContainer) uploadProgressContainer.style.display = 'none';
  
  // Reset buttons
  const startUploadBtn = document.getElementById('startUploadBtn');
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  
  if (startUploadBtn) startUploadBtn.disabled = false;
  if (pauseUploadBtn) pauseUploadBtn.style.display = 'none';
  
  if (showMessage) {
    showInfoMessage('Upload cancelled');
  }
}

// Toggle pause/resume for uploads

// Enhanced Pause/Resume with Real Upload Task Control
function togglePauseUpload() {
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  
  if (uploadPaused) {
    // Resume upload
    uploadPaused = false;
    
    // Resume all active upload tasks
    activeUploadTasks.forEach((uploadTask, fileIndex) => {
      try {
        uploadTask.resume();
        updateFileStatus(fileIndex, 'Uploading');
      } catch (error) {
        console.error(`Failed to resume upload for file ${fileIndex}:`, error);
      }
    });
    
    if (pauseUploadBtn) {
      pauseUploadBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Upload';
    }
    
    // Show notification
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification('info', 'Upload Resumed', 'Upload process has been resumed');
    }
    
    // Continue processing queue
    processUploadQueue();
    
  } else {
    // Pause upload
    uploadPaused = true;
    
    // Pause all active upload tasks
    activeUploadTasks.forEach((uploadTask, fileIndex) => {
      try {
        uploadTask.pause();
        updateFileStatus(fileIndex, 'Paused');
      } catch (error) {
        console.error(`Failed to pause upload for file ${fileIndex}:`, error);
      }
    });
    
    if (pauseUploadBtn) {
      pauseUploadBtn.innerHTML = '<i class="fas fa-play"></i> Resume Upload';
    }
    
    // Show notification
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification('info', 'Upload Paused', 'Upload process has been paused');
    }
  }
  
  // Save state
  if (uploadStateManager) {
    uploadStateManager.saveState();
  }
}


// Initialize Upload Session with Resume Capability
function initializeUploadSession() {
  uploadSessionId = Date.now().toString();
  uploadStateManager = new UploadStateManager();
  
  // Check for resumable uploads
  if (uploadStateManager.hasResumableUpload()) {
    const resumeConfirm = confirm('Found incomplete upload from previous session. Would you like to resume?');
    if (resumeConfirm) {
      resumeUploadSession();
      return true;
    } else {
      uploadStateManager.clearState();
    }
  }
  
  return false;
}

function resumeUploadSession() {
  const state = uploadStateManager.state;
  if (!state || !state.uploadQueue) return;
  
  // Show notification
  if (window.NotificationSystem) {
    window.NotificationSystem.showNotification('info', 'Resuming Upload', 
      `Resuming upload of ${state.uploadQueue.length} files from previous session`);
  }
  
  // Restore upload state
  currentUploadIndex = state.currentIndex || 0;
  uploadPaused = state.isPaused || false;
  
  // Update UI to show resumed state
  const uploadStatusText = document.getElementById('uploadStatusText');
  if (uploadStatusText) {
    uploadStatusText.innerHTML = `
      <div class="upload-resumed">
        🔄 Resuming upload session: ${state.uploadQueue.length} files
      </div>
    `;
  }
  
  // Show upload step 2
  showUploadStatus();
}

// Function to apply plan limits to uploads but preserves the files for display
function applyPlanLimits(files) {
  if (!planLimits) {
    planLimits = PLAN_LIMITS[DEFAULT_PLAN];
  }
  
  // This function only filters the queue but doesn't show messages
  // Messages are shown in handleFiles which is more comprehensive
  
  // Clean arrays
  window.filesToUpload = [];
  window.rejectedFiles = [];
  
  // Check photo count limit
  const currentPhotoCount = galleryData.photosCount || 0;
  const maxPhotos = planLimits.photos;
  const maxFileSizeMB = planLimits.maxSize;
  
  // Available slots
  const availableSlots = Math.max(0, maxPhotos - currentPhotoCount);
  
  // Process each file
  files.forEach((file, index) => {
    // Check count limit
    if (index >= availableSlots) {
      window.rejectedFiles.push({
        file: file,
        reason: `Exceeds gallery limit of ${maxPhotos} photos`
      });
    }
    // Check file size limit
    else if (file.size > (maxFileSizeMB * 1024 * 1024)) {
      window.rejectedFiles.push({
        file: file,
        reason: `Exceeds size limit of ${maxFileSizeMB}MB`
      });
    }
    // File is good
    else {
      window.filesToUpload.push(file);
    }
  });
  
  return window.filesToUpload;
}

/**
 * SAFE DUPLICATE DETECTION - Add this to gallery-view.js
 * This code adds duplicate detection WITHOUT breaking existing features
 * Insert this code BEFORE the existing handleFiles() function
 */

// Add this new function for checking duplicates

// REPLACE THE ENTIRE checkForDuplicates() function with this improved version

async function checkForDuplicates(files, galleryId) {
  try {
    if (!files || files.length === 0 || !galleryId) {
      return [];
    }

    console.log(`🔍 IMPROVED: Checking ${files.length} files for duplicates in gallery ${galleryId}`);

    // Get existing photos from Firestore for this gallery
    const db = firebase.firestore();
    const existingPhotosSnapshot = await db.collection('photos')
      .where('galleryId', '==', galleryId)
      .where('status', '==', 'active')
      .get();

    console.log(`📁 Found ${existingPhotosSnapshot.size} existing photos in gallery`);

    if (existingPhotosSnapshot.empty) {
      console.log(`✅ No existing photos found, no duplicates possible`);
      return [];
    }

    // Create a comprehensive set of existing file signatures
    const existingSignatures = new Set();
    
    existingPhotosSnapshot.forEach(doc => {
      const data = doc.data();
      
      if (data.name && data.size !== undefined) {
        // Multiple ways to identify the same file
        const signatures = [
          `${data.name.toLowerCase()}_${data.size}`,
          `${data.name.toLowerCase()}_${data.size}_${data.type || ''}`,
          // Handle sanitized names
          `${data.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()}_${data.size}`,
        ];
        
        signatures.forEach(sig => existingSignatures.add(sig));
        
        console.log(`📝 Added signatures for existing photo: ${data.name} (${data.size} bytes)`);
      }
    });

    // Check each file against all existing signatures
    const duplicates = [];
    
    files.forEach(file => {
      const fileSignatures = [
        `${file.name.toLowerCase()}_${file.size}`,
        `${file.name.toLowerCase()}_${file.size}_${file.type || ''}`,
        `${file.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase()}_${file.size}`,
      ];
      
      let isDuplicate = false;
      let matchedSignature = '';
      
      for (const signature of fileSignatures) {
        if (existingSignatures.has(signature)) {
          isDuplicate = true;
          matchedSignature = signature;
          break;
        }
      }
      
      if (isDuplicate) {
        console.log(`🚫 DUPLICATE FOUND: ${file.name} (matched: ${matchedSignature})`);
        duplicates.push({
          file: file,
          existingPhoto: { name: file.name, size: file.size }, // Simplified
          detectionMethod: 'comprehensive'
        });
      } else {
        console.log(`✅ No duplicate found for: ${file.name}`);
      }
    });

    console.log(`📊 Duplicate check complete: ${duplicates.length} duplicates found out of ${files.length} files`);
    return duplicates;

  } catch (error) {
    console.error('❌ Error in duplicate check:', error);
    return []; // Return empty array on error to not block uploads
  }
}


async function debugDuplicateDetection(fileName, fileSize) {
  try {
    console.log(`🔧 DEBUG: Checking for duplicates of ${fileName} (${fileSize} bytes)`);
    
    const db = firebase.firestore();
    const existingPhotosSnapshot = await db.collection('photos')
      .where('galleryId', '==', galleryId)
      .where('status', '==', 'active')
      .get();

    console.log(`📁 Found ${existingPhotosSnapshot.size} existing photos in gallery`);

    existingPhotosSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📝 Existing photo: ${data.name} (${data.size} bytes) - ${data.type || 'unknown type'}`);
      
      if (data.name.toLowerCase() === fileName.toLowerCase() && data.size === fileSize) {
        console.log(`🚫 EXACT MATCH FOUND: ${data.name}`);
      }
    });

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}
/**
 * REPLACE the existing handleFiles() function with this enhanced version
 * This preserves ALL existing functionality and adds duplicate detection
 */
async function handleFiles(files) {
  if (!files || files.length === 0) return;
  
  // Filter image files only (EXISTING LOGIC - UNCHANGED)
  const imageFiles = Array.from(files).filter(file => {
    return file.type.startsWith('image/');
  });
  
  if (imageFiles.length === 0) {
    showErrorMessage('Please select image files only');
    return;
  }
  
  // Store all image files for display (EXISTING LOGIC - UNCHANGED)
  window.allSelectedFiles = imageFiles;
  
  // PRE-CHECK PLAN LIMITS (EXISTING LOGIC - UNCHANGED)
  if (!planLimits) {
    planLimits = PLAN_LIMITS[DEFAULT_PLAN];
    console.log('No plan type found, using default plan limits');
  }
  
  // Check photo count limit (EXISTING LOGIC - UNCHANGED)
  const currentPhotoCount = galleryData.photosCount || 0;
  const maxPhotos = planLimits.photos;
  const maxFileSizeMB = planLimits.maxSize;
  
  // *** NEW: Check for duplicates first ***
 // *** ENHANCED: Check for duplicates with better detection ***
  let duplicateFiles = [];
  try {
    console.log('🔍 Starting duplicate detection...');
    duplicateFiles = await checkForDuplicates(imageFiles, galleryId);
    
    if (duplicateFiles.length > 0) {
      console.log(`🚫 Found ${duplicateFiles.length} duplicate files:`);
      duplicateFiles.forEach(dup => {
        console.log(`  - ${dup.file.name} (detected via ${dup.detectionMethod})`);
      });
    }
  } catch (error) {
    console.error('❌ Duplicate check failed, continuing with upload:', error);
    // If duplicate check fails, continue without blocking uploads
  }

  // Separate valid files from rejected ones (ENHANCED LOGIC)
  window.filesToUpload = [];
  window.rejectedFiles = [];
  
  // Check total count first (EXISTING LOGIC - UNCHANGED)
  let availableSlots = Math.max(0, maxPhotos - currentPhotoCount);
  let countLimited = false;
  
  if (imageFiles.length > availableSlots) {
    countLimited = true;
    if (availableSlots === 0) {
      showErrorMessage(`You've reached your plan limit of ${maxPhotos} photos. Upgrade your plan to upload more.`);
    } else {
      showWarningMessage(`Your plan allows ${maxPhotos} photos total. Only the first ${availableSlots} photos will be uploaded.`);
    }
  }
  
  // Process each file (ENHANCED WITH DUPLICATE CHECK)
  imageFiles.forEach((file, index) => {
    let rejected = false;
    let rejectionReason = '';
    
    // *** NEW: Check if file is a duplicate first ***
    // *** ENHANCED: Check if file is a duplicate first ***
    const duplicateInfo = duplicateFiles.find(dup => dup.file === file);
    if (duplicateInfo) {
      rejected = true;
      rejectionReason = `Already uploaded as "${duplicateInfo.existingPhoto.name}" (${duplicateInfo.detectionMethod} match)`;
    }
    // Check if we've exceeded count limit (EXISTING LOGIC - UNCHANGED)
    else if (countLimited && index >= availableSlots) {
      rejected = true;
      rejectionReason = `Exceeds gallery limit of ${maxPhotos} photos`;
    } 
    // Check file size limit (EXISTING LOGIC - UNCHANGED)
    else if (file.size > (maxFileSizeMB * 1024 * 1024)) {
      rejected = true;
      rejectionReason = `Exceeds size limit of ${maxFileSizeMB}MB`;
    }
    
    if (rejected) {
      window.rejectedFiles.push({
        file: file,
        reason: rejectionReason
      });
    } else {
      window.filesToUpload.push(file);
    }
  });
  
  // Show count summary (ENHANCED WITH DUPLICATE INFO)
  if (window.rejectedFiles.length > 0) {
    const duplicateCount = duplicateFiles.length;
    if (window.filesToUpload.length === 0) {
      // All files rejected
      if (duplicateCount > 0 && duplicateCount === window.rejectedFiles.length) {
        showErrorMessage(`All ${duplicateCount} files are already uploaded to this gallery.`);
      }
      // Keep existing error messages for other cases
    } else {
      // Some files rejected - display message about rejected count
      let message = `${window.rejectedFiles.length} of ${imageFiles.length} files cannot be uploaded`;
      if (duplicateCount > 0) {
        message += ` (${duplicateCount} already exist, ${window.rejectedFiles.length - duplicateCount} other issues)`;
      } else {
        message += ` due to plan limitations`;
      }
      message += `.`;
      showWarningMessage(message);
    }
  }
  
  // Update upload preview (EXISTING LOGIC - UNCHANGED)
  updateUploadPreview(window.allSelectedFiles);
  
  // Show next step if we have at least one valid file (EXISTING LOGIC - UNCHANGED)
  if (window.filesToUpload.length > 0) {
    showUploadStatus();
  } else {
    // Keep on first step if all files are rejected (EXISTING LOGIC - UNCHANGED)
    const uploadStep1 = document.getElementById('uploadStep1');
    const uploadStep2 = document.getElementById('uploadStep2');
    
    if (uploadStep1) uploadStep1.style.display = 'block';
    if (uploadStep2) uploadStep2.style.display = 'none';
    
    // If we have a back button, show it (EXISTING LOGIC - UNCHANGED)
    const backToSelectBtn = document.getElementById('backToSelectBtn');
    if (backToSelectBtn) backToSelectBtn.style.display = 'inline-block';
  }
}

/**
 * INSTALLATION INSTRUCTIONS:
 * 
 * 1. In gallery-view.js, find the existing handleFiles() function
 * 2. Replace it completely with the enhanced version above
 * 3. Add the checkForDuplicates() function before handleFiles()
 * 
 * WHAT THIS DOES:
 * ✅ Checks for duplicate files before upload
 * ✅ Preserves ALL existing functionality 
 * ✅ Shows clear "already uploaded" messages
 * ✅ Counts duplicates separately in summary
 * ✅ Handles errors gracefully (won't break uploads)
 * ✅ Works with existing plan limits and file validation
 * 
 * WHAT WON'T CHANGE:
 * ✅ All existing upload features work the same
 * ✅ Plan limit checking unchanged
 * ✅ File size validation unchanged  
 * ✅ UI and progress tracking unchanged
 * ✅ Error handling unchanged
 */


// Handle file select for upload
function handleFileSelect(event) {
  if (event.target && event.target.files) {
    handleFiles(event.target.files);
  }
}

// Enhanced startPhotoUpload with queue processing

// Enhanced startPhotoUpload with backend validation

// Enhanced Upload Start with Session Management

async function startPhotoUpload() {
  try {
    if (!window.filesToUpload || window.filesToUpload.length === 0) {
      showErrorMessage('No files selected for upload');
      return;
    }
    
    // Reset upload state to ensure clean start
    uploadQueue = [...window.filesToUpload];
    currentUploadIndex = 0;
    isUploading = true;
    uploadPaused = false;
    activeUploadTasks.clear();
    uploadRetryAttempts.clear();
    
    console.log(`Starting Conveyor Belt upload of ${uploadQueue.length} files`);
    
    // Backend validation (keep existing validation)
    try {
      showLoadingOverlay('Validating upload permissions...');
      
      const functions = firebase.app().functions('asia-south1');
      const validateFunc = functions.httpsCallable('validatePhotoUpload');
      
      const totalSize = uploadQueue.reduce((sum, file) => sum + file.size, 0);
      
      await validateFunc({
        galleryId: galleryId,
        fileCount: uploadQueue.length,
        totalSize: totalSize
      });
      
      hideLoadingOverlay();
      
    } catch (validationError) {
      hideLoadingOverlay();
      console.error('Upload validation failed:', validationError);
      showErrorMessage('Upload validation failed: ' + validationError.message);
      return;
    }
    
    // Show progress UI (keep existing UI)
    const uploadProgressContainer = document.getElementById('uploadProgressContainer');
    if (uploadProgressContainer) {
      uploadProgressContainer.style.display = 'block';
    }
    
    // Update buttons
    const startUploadBtn = document.getElementById('startUploadBtn');
    const pauseUploadBtn = document.getElementById('pauseUploadBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    
    if (startUploadBtn) startUploadBtn.disabled = true;
    if (pauseUploadBtn) pauseUploadBtn.style.display = 'inline-block';
    if (cancelUploadBtn) cancelUploadBtn.disabled = false;
    
    // Start the conveyor belt (sequential processing)
    await processUploadQueue();
    
  } catch (error) {
    console.error('Error starting upload:', error);
    showErrorMessage(`Upload failed: ${error.message}`);
    isUploading = false;
  }
}

 

/**
 * Process upload queue with pause/resume support and improved progress tracking
 */

// Enhanced processUploadQueue with better error handling

// Enhanced Concurrent Upload Processing

// Enhanced Concurrent Upload Processing with Better UI Management

async function processUploadQueue() {
  console.log(`Conveyor Belt: Processing ${uploadQueue.length} files sequentially`);
  
  // Process files one by one
  for (let i = 0; i < uploadQueue.length; i++) {
    // Check if upload was cancelled or paused
    if (!isUploading) {
      console.log('Upload cancelled, stopping conveyor belt');
      break;
    }
    
    // Wait if paused
    while (uploadPaused && isUploading) {
      console.log('Upload paused, waiting...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!isUploading) break;
    
    currentUploadIndex = i;
    const file = uploadQueue[i];
    
    console.log(`Conveyor Belt: Processing file ${i + 1}/${uploadQueue.length}: ${file.name}`);
    
    // Update UI
    updateFileStatus(i, 'Uploading');
    
    try {
      // Upload this single file
      await uploadSingleFileSequential(file, i);
      
      // Update UI on success
      updateFileStatus(i, 'Complete');
      console.log(`✅ File ${i + 1} completed: ${file.name}`);
      
    } catch (error) {
      // Update UI on failure
      updateFileStatus(i, 'Failed');
      console.error(`❌ File ${i + 1} failed: ${file.name}`, error);
    }
    
    // Update progress after each file
    updateTotalProgressSequential();
    
    // Small delay between files to prevent overwhelming Firebase
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Mark upload as complete
  isUploading = false;
  uploadComplete();
}


function updateTotalProgressSequential() {
  const totalFiles = uploadQueue.length;
  const completedFiles = currentUploadIndex + 1; // +1 because we just completed current file
  const progress = Math.min(100, Math.round((completedFiles / totalFiles) * 100));
  
  // Update progress bar
  const totalProgressBar = document.getElementById('totalProgressBar');
  if (totalProgressBar) {
    totalProgressBar.style.width = `${progress}%`;
    totalProgressBar.setAttribute('aria-valuenow', progress);
  }
  
  // Update progress text
  const progressText = document.getElementById('totalProgressText');
  if (progressText) {
    progressText.textContent = `${progress}% Complete (${Math.min(completedFiles, totalFiles)}/${totalFiles})`;
  }
  
  console.log(`Progress: ${completedFiles}/${totalFiles} (${progress}%)`);
}


async function uploadSingleFileSequential(file, index) {
  return new Promise(async (resolve, reject) => {
    try {
      // *** CRITICAL: RE-CHECK FOR DUPLICATES BEFORE UPLOAD ***
      console.log(`🔍 Double-checking for duplicates before uploading: ${file.name}`);
      
      const duplicateCheck = await checkForDuplicates([file], galleryId);
      if (duplicateCheck.length > 0) {
        console.log(`🚫 DUPLICATE DETECTED during upload: ${file.name}`);
        reject(new Error(`Duplicate file detected: ${file.name} already exists`));
        return;
      }
      
      console.log(`✅ No duplicate found, proceeding with upload: ${file.name}`);
      
      // Create unique filename (same as before)
      const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const fileName = `${timestamp}_${random}_${safeOriginalName}`;
      
      // Initialize Firebase storage
      const storage = firebase.storage();
      const fileRef = storage.ref(`galleries/${galleryId}/photos/${fileName}`);
      
      // Create upload task
      const uploadTask = fileRef.put(file, {
        contentType: file.type,
        customMetadata: {
          'uploadedBy': currentUser.uid,
          'uploaderEmail': currentUser.email,
          'galleryId': galleryId,
          'originalName': file.name,
          'sessionId': uploadSessionId || Date.now().toString()
        }
      });
      
      // Store for pause/resume
      activeUploadTasks.set(index, uploadTask);
      
      // Progress tracking
      uploadTask.on('state_changed',
        (snapshot) => {
          if (!isUploading) return;
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
          updateFileProgress(index, progress);
        },
        (error) => {
          console.error(`Upload error for ${file.name}:`, error);
          activeUploadTasks.delete(index);
          reject(error);
        },
        async () => {
          try {
            // Get download URL
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            
            // *** CRITICAL: FINAL CHECK BEFORE SAVING TO FIRESTORE ***
            console.log(`🔍 Final duplicate check before saving to Firestore: ${file.name}`);
            
            const finalDuplicateCheck = await checkForDuplicates([file], galleryId);
            if (finalDuplicateCheck.length > 0) {
              console.log(`🚫 DUPLICATE DETECTED before Firestore save: ${file.name}`);
              
              // Delete the uploaded file from storage since it's a duplicate
              try {
                await fileRef.delete();
                console.log(`🗑️ Deleted duplicate file from storage: ${fileName}`);
              } catch (deleteError) {
                console.error('Error deleting duplicate file from storage:', deleteError);
              }
              
              reject(new Error(`Duplicate file detected during final check: ${file.name}`));
              return;
            }
            
            // Save to Firestore
            await savePhotoToFirestoreSequential(file, fileName, downloadURL);
            
            activeUploadTasks.delete(index);
            resolve({ success: true, fileName, downloadURL });
            
          } catch (firestoreError) {
            console.error(`Firestore save error for ${file.name}:`, firestoreError);
            activeUploadTasks.delete(index);
            reject(firestoreError);
          }
        }
      );
      
    } catch (error) {
      console.error(`Error in uploadSingleFileSequential for ${file.name}:`, error);
      reject(error);
    }
  });
}


async function savePhotoToFirestoreSequential(file, fileName, downloadURL) {
  const db = firebase.firestore();
  const photoDoc = db.collection('photos').doc();
  
  // Create photo document
  await photoDoc.set({
    galleryId: galleryId,
    photographerId: currentUser.uid,
    name: file.name,
    fileName: fileName,
    storageRef: `galleries/${galleryId}/photos/${fileName}`,
    url: downloadURL,
    thumbnails: {
      sm: downloadURL,
      md: downloadURL,
      lg: downloadURL
    },
    size: file.size,
    type: file.type,
    width: 0,
    height: 0,
    status: 'active',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    sessionId: uploadSessionId || Date.now().toString(),
    // Searchable info (keep existing structure)
    galleryName: galleryData.name || 'Untitled Gallery',
    clientName: galleryData.clientName || 'Unknown Client',
    photoName: file.name,
    photoNameLower: file.name.toLowerCase(),
    searchLabel: `Photo: ${file.name} in ${galleryData.name}`,
    photographerEmail: currentUser.email
  });
  
  // Update gallery count
  await db.collection('galleries').doc(galleryId).update({
    photosCount: firebase.firestore.FieldValue.increment(1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`✅ Saved to Firestore: ${file.name}`);
}



// Process individual upload with retry logic
async function processIndividualUpload(fileIndex) {
  const file = uploadQueue[fileIndex];
  const maxRetries = 3;
  let retryCount = uploadRetryAttempts.get(fileIndex) || 0;
  
  while (retryCount < maxRetries) {
    try {
      updateFileStatus(fileIndex, 'Uploading');
      
      // Create unique filename
      const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const fileName = `${timestamp}_${random}_${safeOriginalName}`;
      
      // Initialize storage
      const storage = firebase.storage();
      const storageRef = storage.ref();
      const fileRef = storageRef.child(`galleries/${galleryId}/photos/${fileName}`);
      
      // Create upload task
      const uploadTask = fileRef.put(file, {
        contentType: file.type,
        customMetadata: {
          'uploadedBy': currentUser.uid,
          'uploaderEmail': currentUser.email,
          'galleryId': galleryId,
          'originalName': file.name,
          'sessionId': uploadSessionId
        }
      });
      
      // Store upload task for pause/resume
      activeUploadTasks.set(fileIndex, uploadTask);
      
      // Set up progress tracking
      uploadTask.on('state_changed', 
        (snapshot) => {
          if (!isUploading) return;
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
          updateFileProgress(fileIndex, progress);
          updateTotalProgress();
        }
      );
      
      // Wait for upload completion
      await uploadTask;
      
      // Get download URL and save to Firestore
      const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
      await savePhotoToFirestore(fileIndex, file, fileName, downloadURL);
      
      updateFileStatus(fileIndex, 'Complete');
      activeUploadTasks.delete(fileIndex);
      uploadRetryAttempts.delete(fileIndex);
      
      return; // Success, exit retry loop
      
    } catch (error) {
      console.error(`Upload error for file ${fileIndex}:`, error);
      retryCount++;
      uploadRetryAttempts.set(fileIndex, retryCount);
      
      if (retryCount < maxRetries) {
        updateFileStatus(fileIndex, `Retrying (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      } else {
        updateFileStatus(fileIndex, 'Failed');
        activeUploadTasks.delete(fileIndex);
        break; // Max retries reached
      }
    }
  }
}

// Upload completion handler

// Enhanced uploadComplete with better notifications

// Enhanced Upload Complete with State Cleanup

// Add warning for large file uploads
function showUploadSizeWarning(fileCount) {
  if (fileCount > 100) {
    const warningMsg = `You're uploading ${fileCount} files. For best performance, consider uploading in smaller batches of 50-100 files.`;
    if (window.NotificationSystem) {
      window.NotificationSystem.showNotification('warning', 'Large Upload Warning', warningMsg);
    } else {
      alert(warningMsg);
    }
  }
}


// Enhanced Upload Complete with Clean UI

function uploadComplete() {
  console.log('Conveyor Belt: Upload sequence complete');
  
  // Count actual results by checking file status elements
  let successfulUploads = 0;
  let failedUploads = 0;
  
  for (let i = 0; i < uploadQueue.length; i++) {
    const fileItem = document.querySelector(`.upload-file-item[data-index="${i}"]`);
    if (fileItem) {
      if (fileItem.classList.contains('complete')) {
        successfulUploads++;
      } else if (fileItem.classList.contains('failed')) {
        failedUploads++;
      }
    }
  }
  
  const totalFiles = uploadQueue.length;
  console.log(`Upload Results: ${successfulUploads} success, ${failedUploads} failed, ${totalFiles} total`);
  
  // Clean up state
  activeUploadTasks.clear();
  uploadRetryAttempts.clear();
  isUploading = false;
  uploadPaused = false;
  
  // Show ONE accurate completion message
  if (successfulUploads === totalFiles) {
    showSuccessMessage(`✅ Upload Complete! Successfully uploaded all ${totalFiles} photos.`);
  } else if (successfulUploads > 0) {
    showWarningMessage(`⚠️ Upload Completed with Issues: ${successfulUploads} of ${totalFiles} photos uploaded successfully. ${failedUploads} failed.`);
  } else {
    showErrorMessage(`❌ Upload Failed: No photos were uploaded successfully.`);
  }
  
  // Reset UI
  const startUploadBtn = document.getElementById('startUploadBtn');
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');
  
  if (startUploadBtn) startUploadBtn.disabled = false;
  if (pauseUploadBtn) pauseUploadBtn.style.display = 'none';
  if (cancelUploadBtn) cancelUploadBtn.disabled = true;
  
  // Reload gallery to show new photos
  setTimeout(() => {
    photosList = [];
    lastVisiblePhoto = null;
    allPhotosLoaded = false;
    loadGalleryPhotos(true);
    hideUploadPhotosModal();
  }, 2000);
}

// Network monitoring
window.addEventListener('online', function() {
  if (isUploading && uploadPaused) {
    showInfoMessage('Network connection restored. You can resume the upload.');
  }
});

window.addEventListener('offline', function() {
  if (isUploading && !uploadPaused) {
    uploadPaused = true;
    showWarningMessage('Network connection lost. Upload paused until connection is restored.');
    
    const pauseUploadBtn = document.getElementById('pauseUploadBtn');
    if (pauseUploadBtn) {
      pauseUploadBtn.innerHTML = '<i class="fas fa-play"></i> Resume Upload';
    }
  }
});

// Format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Enhanced updateUploadPreview function to show both valid and rejected files
 * Displays each file with its status and rejection reason if applicable
 */
function updateUploadPreview(files) {
  const uploadPreview = document.getElementById('uploadPreview');
  if (!uploadPreview) return;
  
  uploadPreview.innerHTML = '';
  
  // Create file items for each file
  files.forEach((file, index) => {
    // Check if this file is in the rejected list
    const rejectedInfo = window.rejectedFiles?.find(r => r.file === file);
    const isRejected = !!rejectedInfo;
    
    // Create file item container
    const fileItem = document.createElement('div');
    fileItem.className = 'upload-file-item';
    fileItem.setAttribute('data-index', index);
    
    // Add rejected class if needed
    if (isRejected) {
      fileItem.classList.add('upload-file-rejected');
    }
    
    // Create elements using a file reader to generate thumbnail
    const reader = new FileReader();
    reader.onload = function(e) {
      // Build the HTML for the file item
      fileItem.innerHTML = `
        <div class="upload-file-thumbnail" style="background-image: url('${e.target.result}')">
          ${isRejected ? '<div class="rejection-overlay"><i class="fas fa-ban"></i></div>' : ''}
        </div>
        <div class="upload-file-info">
          <div class="upload-file-name">${file.name}</div>
          <div class="upload-file-meta">
            <span class="upload-file-size">${formatFileSize(file.size)}</span>
            <span class="upload-file-status ${isRejected ? 'status-rejected' : 'status-waiting'}">
              ${isRejected ? 'Rejected' : 'Waiting'}
            </span>
          </div>
          ${isRejected ? `<div class="rejection-reason">${rejectedInfo.reason}</div>` : ''}
        </div>
        <div class="upload-progress">
          <div class="upload-progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      `;
    };
    
    // Read the file to generate thumbnail
    reader.readAsDataURL(file);
    uploadPreview.appendChild(fileItem);
  });
  
  // Update the counts with more detail
  const totalCountElement = document.getElementById('uploadTotalCount');
  if (totalCountElement) {
    const validFiles = window.filesToUpload?.length || 0;
    const rejectedFiles = window.rejectedFiles?.length || 0;
    
    if (rejectedFiles > 0) {
      totalCountElement.innerHTML = `${files.length} files selected - <span class="valid-count">${validFiles} valid</span>, <span class="rejected-count">${rejectedFiles} rejected</span>`;
    } else {
      totalCountElement.textContent = `${files.length} files selected`;
    }
  }
  
  // Show a summary of reasons if there are rejected files
  const rejectionSummary = document.getElementById('rejectionSummary');
  if (rejectionSummary) {
    if (window.rejectedFiles && window.rejectedFiles.length > 0) {
      // Count occurrences of each reason
      const reasonCounts = {};
      window.rejectedFiles.forEach(item => {
        if (!reasonCounts[item.reason]) {
          reasonCounts[item.reason] = 0;
        }
        reasonCounts[item.reason]++;
      });
      
      // Create summary text
      let summaryHTML = '<div class="rejection-summary-header">Files rejected due to:</div><ul>';
      for (const reason in reasonCounts) {
        summaryHTML += `<li>${reasonCounts[reason]} files: ${reason}</li>`;
      }
      summaryHTML += '</ul>';
      
      rejectionSummary.innerHTML = summaryHTML;
      rejectionSummary.style.display = 'block';
    } else {
      rejectionSummary.style.display = 'none';
    }
  }
}

/**
 * Enhanced showUploadStatus function to display more detailed upload information
 * Shows steps and clear indicators for the upload process
 */
function showUploadStatus() {
  const uploadStep1 = document.getElementById('uploadStep1');
  const uploadStep2 = document.getElementById('uploadStep2');
  
  if (uploadStep1) uploadStep1.style.display = 'none';
  if (uploadStep2) uploadStep2.style.display = 'block';
  
  // Update upload steps indicator if it exists
  const uploadSteps = document.querySelectorAll('.upload-step');
  if (uploadSteps.length >= 2) {
    uploadSteps[0].classList.add('completed');
    uploadSteps[0].classList.remove('active');
    uploadSteps[1].classList.add('active');
  }
  
  // Update status text
  const uploadStatusText = document.getElementById('uploadStatusText');
  if (uploadStatusText) {
    const validCount = window.filesToUpload?.length || 0;
    uploadStatusText.textContent = `Ready to upload ${validCount} files`;
  }
  
  // Enable/disable buttons based on valid file count
  const startUploadBtn = document.getElementById('startUploadBtn');
  if (startUploadBtn) {
    const validCount = window.filesToUpload?.length || 0;
    startUploadBtn.disabled = validCount === 0;
  }
  
  // Show the back button if we have rejected files but no valid ones
  const backToSelectBtn = document.getElementById('backToSelectBtn');
  if (backToSelectBtn) {
    backToSelectBtn.style.display = 
      (window.rejectedFiles && window.rejectedFiles.length > 0 && 
       (!window.filesToUpload || window.filesToUpload.length === 0)) ? 'inline-block' : 'none';
  }
}

/**
 * Update file status in the UI with improved styling
 */

// Enhanced file status update with better UI management
function updateFileStatus(index, status) {
  const fileItem = document.querySelector(`.upload-file-item[data-index="${index}"]`);
  if (!fileItem) return;
  
  // Update status text
  const statusElement = fileItem.querySelector('.upload-file-status');
  if (statusElement) {
    statusElement.textContent = status;
    
    // Clear existing status classes
    statusElement.classList.remove('status-waiting', 'status-uploading', 'status-complete', 'status-failed', 'status-rejected', 'status-paused');
    
    // Add appropriate status class
    const statusClass = status.toLowerCase().replace(/[^a-z]/g, '');
    statusElement.classList.add(`status-${statusClass}`);
  }
  
  // Update the file item container class
  fileItem.classList.remove('waiting', 'uploading', 'complete', 'failed', 'rejected', 'paused');
  const containerClass = status.toLowerCase().replace(/[^a-z]/g, '');
  fileItem.classList.add(containerClass);
  
  // Add retry indicator if needed
  const retryCount = uploadRetryAttempts.get(index);
  if (retryCount && retryCount > 0) {
    let retryIndicator = fileItem.querySelector('.upload-retry-indicator');
    if (!retryIndicator) {
      retryIndicator = document.createElement('div');
      retryIndicator.className = 'upload-retry-indicator';
      fileItem.appendChild(retryIndicator);
    }
    retryIndicator.textContent = retryCount;
  }
  
  // Update queue visualization - DEBOUNCED
  if (!updateFileStatus.debounceTimer) {
    updateFileStatus.debounceTimer = setTimeout(() => {
      updateQueueVisualization();
      updateFileStatus.debounceTimer = null;
    }, 200);
  }
}

/**
 * Update file progress in the UI with improved visual feedback
 */
function updateFileProgress(index, progress) {
  const fileItem = document.querySelector(`.upload-file-item[data-index="${index}"]`);
  if (!fileItem) return;
  
  const progressBar = fileItem.querySelector('.upload-progress-bar');
  if (progressBar) {
    const percent = Math.round(progress * 100);
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent);
    
    // Add percentage text inside or next to progress bar for better visibility
    const progressText = fileItem.querySelector('.progress-text');
    if (!progressText && percent > 0) {
      const progressContainer = fileItem.querySelector('.upload-progress');
      const textElement = document.createElement('div');
      textElement.className = 'progress-text';
      textElement.textContent = `${percent}%`;
      progressContainer.appendChild(textElement);
    } else if (progressText) {
      progressText.textContent = `${percent}%`;
    }
  }
}
// Update total progress in the UI

// Enhanced Progress Update with Debouncing

// Enhanced Progress Update with Aggressive Debouncing
function updateTotalProgress() {
  // Clear existing throttler
  if (progressUpdateThrottler) {
    clearTimeout(progressUpdateThrottler);
  }

  // More aggressive throttling for large uploads
  const delay = uploadQueue.length > 50 ? 500 : 200; // Longer delay for large batches

  progressUpdateThrottler = setTimeout(() => {
    const progressBars = document.querySelectorAll('.upload-progress-bar');
    const totalProgressBar = document.getElementById('totalProgressBar');
    
    if (!totalProgressBar || progressBars.length === 0) return;
    
    let totalProgress = 0;
    let completedUploads = 0;
    
    progressBars.forEach(bar => {
      const value = parseInt(bar.getAttribute('aria-valuenow') || '0', 10);
      totalProgress += value;
      if (value === 100) completedUploads++;
    });
    
    const averageProgress = Math.round(totalProgress / progressBars.length);
    
    // Smooth progress bar animation
    totalProgressBar.style.width = `${averageProgress}%`;
    totalProgressBar.setAttribute('aria-valuenow', averageProgress);
    
    // Update progress text
    const progressText = document.getElementById('totalProgressText');
    if (progressText) {
      progressText.textContent = `${averageProgress}% Complete (${completedUploads}/${progressBars.length})`;
    }
    
    // Update batch status - also debounced
    if (!updateTotalProgress.batchUpdateTimer) {
      updateTotalProgress.batchUpdateTimer = setTimeout(() => {
        updateBatchStatus(completedUploads, progressBars.length, averageProgress);
        updateTotalProgress.batchUpdateTimer = null;
      }, 300);
    }
    
    // Save progress state - less frequently
    if (uploadStateManager && Math.random() < 0.1) { // Only 10% of the time
      uploadStateManager.saveState();
    }
  }, delay);
}

// New function to update batch status
function updateBatchStatus(completed, total, progress) {
  const batchStatus = document.getElementById('uploadBatchStatus');
  if (!batchStatus) return;
  
  let statusClass = 'uploading';
  let statusText = `Uploading ${completed}/${total} files...`;
  
  if (uploadPaused) {
    statusClass = 'paused';
    statusText = `Paused - ${completed}/${total} files completed`;
  } else if (completed === total) {
    statusClass = 'complete';
    statusText = `All ${total} files uploaded successfully!`;
  }
  
  batchStatus.className = `upload-batch-status ${statusClass}`;
  batchStatus.innerHTML = `
    <div class="upload-queue-status" id="uploadQueueStatus"></div>
    <div>${statusText}</div>
  `;
  
  // Update queue visualization
  updateQueueVisualization();
}

// Enhanced showSuccessMessage with NotificationSystem integration
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

// Show error message
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
  }, 5000); // Show errors a bit longer
}

// Show warning message
function showWarningMessage(message) {
  // Try to use NotificationSystem if available
  if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
    window.NotificationSystem.showNotification('warning', 'Warning', message);
    return;
  }
  
  // Fallback to custom toast
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast toast-warning';
  toast.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>${message}</span>`;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => { toast.remove(); }, 300);
  }, 5000); // Show warnings a bit longer
}

// Show info message
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

// View photo in full-screen modal
function viewPhoto(photoId) {
  if (!photoId) return;
  
  // Find photo in list
  const photo = photosList.find(p => p.id === photoId);
  if (!photo) {
    showErrorMessage('Photo not found');
    return;
  }
  
  // Create modal if it doesn't exist
  let photoViewModal = document.getElementById('photoViewModal');
  if (!photoViewModal) {
    photoViewModal = document.createElement('div');
    photoViewModal.id = 'photoViewModal';
    photoViewModal.className = 'photo-view-modal';
    
    photoViewModal.innerHTML = `
      <div class="photo-view-container">
        <button class="close-modal">&times;</button>
        <div class="photo-view-content">
          <img id="photoViewImage" src="" alt="Full size photo">
        </div>
        <div class="photo-view-info">
          <div class="photo-view-name" id="photoViewName"></div>
          <div class="photo-view-meta">
            <span id="photoViewSize"></span>
            <span id="photoViewDate"></span>
          </div>
        </div>
        <div class="photo-view-actions">
          <button id="photoViewDownloadBtn" class="btn outline-btn"><i class="fas fa-download"></i> Download</button>
          <button id="photoViewInfoBtn" class="btn outline-btn"><i class="fas fa-info-circle"></i> Info</button>
          <button id="photoViewDeleteBtn" class="btn outline-btn danger-btn"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(photoViewModal);
    
    // Add event listeners
    const closeModalBtn = photoViewModal.querySelector('.close-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        photoViewModal.style.display = 'none';
      });
    }
    
    // Download button
    const downloadBtn = document.getElementById('photoViewDownloadBtn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const photoImg = document.getElementById('photoViewImage');
        if (photoImg && photoImg.src) {
          // Create an anchor and trigger download
          const a = document.createElement('a');
          a.href = photoImg.src;
          a.download = photoImg.alt || 'photo.jpg';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
    }
    
    // Info button
    const infoBtn = document.getElementById('photoViewInfoBtn');
    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        const photoId = photoViewModal.getAttribute('data-photo-id');
        showPhotoInfo(photoId);
      });
    }
    
    // Delete button
    const deleteBtn = document.getElementById('photoViewDeleteBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const photoId = photoViewModal.getAttribute('data-photo-id');
        confirmDeletePhoto(photoId);
        photoViewModal.style.display = 'none';
      });
    }
  }
  
  // Update modal content
  const photoImage = document.getElementById('photoViewImage');
  const photoName = document.getElementById('photoViewName');
  const photoSize = document.getElementById('photoViewSize');
  const photoDate = document.getElementById('photoViewDate');
  
  if (photoImage) photoImage.src = photo.url || '';
  if (photoName) photoName.textContent = photo.name || 'Untitled Photo';
  if (photoSize) photoSize.textContent = formatFileSize(photo.size || 0);
  if (photoDate) photoDate.textContent = photo.createdAt?.toDate().toLocaleDateString() || 'Unknown date';
  
  // Store photo ID for action buttons
  photoViewModal.setAttribute('data-photo-id', photoId);
  
  // Show modal
  photoViewModal.style.display = 'block';
}

// Show photo information in a modal
function showPhotoInfo(photoId) {
  if (!photoId) return;
  
  // Find photo in list
  const photo = photosList.find(p => p.id === photoId);
  if (!photo) {
    showErrorMessage('Photo not found');
    return;
  }
  
  // Create modal if it doesn't exist
  let photoInfoModal = document.getElementById('photoInfoModal');
  if (!photoInfoModal) {
    photoInfoModal = document.createElement('div');
    photoInfoModal.id = 'photoInfoModal';
    photoInfoModal.className = 'modal';
    
    photoInfoModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Photo Information</h2>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="photo-info-container">
            <div class="photo-info-thumbnail" id="photoInfoThumbnail"></div>
            <div class="photo-info-details">
              <div class="info-row">
                <label>File Name:</label>
                <span id="photoInfoName"></span>
              </div>
              <div class="info-row">
                <label>Uploaded:</label>
                <span id="photoInfoDate"></span>
              </div>
              <div class="info-row">
                <label>File Size:</label>
                <span id="photoInfoSize"></span>
              </div>
              <div class="info-row">
                <label>Dimensions:</label>
                <span id="photoInfoDimensions"></span>
              </div>
              <div class="info-row">
                <label>File Type:</label>
                <span id="photoInfoType"></span>
              </div>
              <div class="info-row">
                <label>Storage Path:</label>
                <span id="photoInfoPath"></span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="closePhotoInfoBtn" class="btn outline-btn">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(photoInfoModal);
    
    // Add event listeners
    const closeModalBtn = photoInfoModal.querySelector('.close-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        photoInfoModal.style.display = 'none';
      });
    }
    
    const closeBtn = document.getElementById('closePhotoInfoBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        photoInfoModal.style.display = 'none';
      });
    }
  }
  
  // Update modal content
  const thumbnail = document.getElementById('photoInfoThumbnail');
  const name = document.getElementById('photoInfoName');
  const date = document.getElementById('photoInfoDate');
  const size = document.getElementById('photoInfoSize');
  const dimensions = document.getElementById('photoInfoDimensions');
  const type = document.getElementById('photoInfoType');
  const path = document.getElementById('photoInfoPath');
  
  if (thumbnail) {
    thumbnail.style.backgroundImage = `url('${photo.thumbnails?.md || photo.url || ''}')`;
  }
  
  if (name) name.textContent = photo.name || 'Untitled Photo';
  if (date) date.textContent = photo.createdAt?.toDate().toLocaleString() || 'Unknown date';
  if (size) size.textContent = formatFileSize(photo.size || 0);
  if (dimensions) dimensions.textContent = photo.width && photo.height ? `${photo.width} × ${photo.height} px` : 'Unknown';
  if (type) type.textContent = photo.type || 'Unknown';
  if (path) path.textContent = photo.storageRef || 'Unknown';
  
  // Show modal
  photoInfoModal.style.display = 'block';
}

// Confirm and delete photo
function confirmDeletePhoto(photoId) {
  if (!photoId) return;
  
  // Find photo in list
  const photo = photosList.find(p => p.id === photoId);
  if (!photo) {
    showErrorMessage('Photo not found');
    return;
  }
  
  // Show confirmation dialog
  if (confirm(`Are you sure you want to delete "${photo.name || 'this photo'}"? This action cannot be undone.`)) {
    deletePhoto(photoId);
  }
}

// Delete photo from storage and database
async function deletePhoto(photoId) {
  try {
    if (!photoId || !currentUser) {
      throw new Error('Missing photo ID or user is not logged in');
    }
    
    showLoadingOverlay('Deleting photo...');
    
    // Find photo in list
    const photo = photosList.find(p => p.id === photoId);
    if (!photo) {
      throw new Error('Photo not found');
    }
    
    const db = firebase.firestore();
    
    // Delete from Firestore first
    await db.collection('photos').doc(photoId).update({
      status: 'deleted',
      deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update gallery photo count
    await db.collection('galleries').doc(galleryId).update({
      photosCount: firebase.firestore.FieldValue.increment(-1),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update plan storage usage if we have plan ID
    if (galleryData.planId && photo.size) {
      await db.collection('client-plans').doc(galleryData.planId).update({
        storageUsed: firebase.firestore.FieldValue.increment(-(photo.size / (1024 * 1024))), // Convert to MB
        photosUploaded: firebase.firestore.FieldValue.increment(-1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Remove photo from list
    photosList = photosList.filter(p => p.id !== photoId);
    
    // Re-render photos
    renderPhotos();
    
    hideLoadingOverlay();
    showSuccessMessage('Photo deleted successfully');
  } catch (error) {
    console.error('Error deleting photo:', error);
    hideLoadingOverlay();
    showErrorMessage(`Failed to delete photo: ${error.message}`);
  }
}

// Set view mode (grid or list)
function setViewMode(mode) {
  const photosContainer = document.getElementById('photosContainer');
  if (!photosContainer) return;
  
  const gridViewBtn = document.getElementById('gridViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  
  if (mode === 'grid') {
    photosContainer.classList.add('photos-grid');
    photosContainer.classList.remove('photos-list');
    gridViewBtn.classList.add('active');
    listViewBtn.classList.remove('active');
  } else {
    photosContainer.classList.remove('photos-grid');
    photosContainer.classList.add('photos-list');
    gridViewBtn.classList.remove('active');
    listViewBtn.classList.add('active');
  }
  
  // Re-render photos to update layout
  renderPhotos();
}

// Handle sort change
function handleSortChange(e) {
  const sortValue = e.target.value;
  
  // Sort photos based on selected option
  if (sortValue === 'newest') {
    photosList.sort((a, b) => {
      return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
    });
  } else if (sortValue === 'oldest') {
    photosList.sort((a, b) => {
      return (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0);
    });
  } else if (sortValue === 'name') {
    photosList.sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    });
  }
  
  // Re-render photos with new sort order
  renderPhotos();
}

// Show share gallery modal (placeholder)
function showShareGalleryModal() {
  alert('Gallery sharing functionality would be implemented here');
  // In a real implementation, this would show a modal with options to:
  // - Generate a share link
  // - Set password protection
  // - Set expiration date
  // - Send email invites
}

// Show gallery settings modal (placeholder)
function showGallerySettingsModal() {
  alert('Gallery settings functionality would be implemented here');
  // In a real implementation, this would show a modal with options to:
  // - Rename gallery
  // - Update description
  // - Change thumbnail
  // - Manage access settings
}

// Synchronize Storage with Firestore to ensure all photos are properly tracked
async function syncStorageWithFirestore() {
  try {
    // Security check: Only the gallery owner can sync
    if (!galleryData || galleryData.photographerId !== currentUser.uid) {
      showErrorMessage('Only the gallery owner can perform this operation');
      return;
    }
    
    showLoadingOverlay('Synchronizing photos...');
    
    // Get the Firebase storage reference for this gallery
    const storage = firebase.storage();
    const galleryPath = `galleries/${galleryId}/photos/`;
    const storageRef = storage.ref(galleryPath);
    
    // Get all files from Storage
    let storageFiles = [];
    try {
      const storageList = await storageRef.listAll();
      storageFiles = storageList.items;
    } catch (storageError) {
      console.error('Error listing files from Storage:', storageError);
      showErrorMessage('Unable to list files from Storage');
      hideLoadingOverlay();
      return;
    }
    
    // If no files in storage, show message and exit
    if (storageFiles.length === 0) {
      hideLoadingOverlay();
      showInfoMessage('No files found in Storage for this gallery');
      return;
    }
    
    // Get Firestore records for this gallery
    const db = firebase.firestore();
    const existingPhotosSnapshot = await db.collection('photos')
      .where('galleryId', '==', galleryId)
      .get();
    
    // Create a map of existing filenames for quick lookup
    const existingPhotos = new Map();
    existingPhotosSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fileName) {
        existingPhotos.set(data.fileName, { id: doc.id, ...data });
      }
    });
    
    // For tracking progress
    let totalFiles = storageFiles.length;
    let syncedFiles = 0;
    let newFilesAdded = 0;
    let skippedFiles = 0;
    
    // Plan limit check
    let totalPhotosAfterSync = existingPhotosSnapshot.size;
    const maxPhotos = planLimits ? planLimits.photos : PLAN_LIMITS[DEFAULT_PLAN].photos;
    
    // Update progress indicator
    updateSyncProgress(0, totalFiles);
    
    // Process files in batches to avoid overwhelming the database
    const BATCH_SIZE = 10;
    const batches = [];
    
    for (let i = 0; i < storageFiles.length; i += BATCH_SIZE) {
      const batch = storageFiles.slice(i, i + BATCH_SIZE);
      batches.push(batch);
    }
    
    // Process each batch sequentially
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchPromises = batch.map(async (fileRef) => {
        try {
          // Extract filename
          const fileName = fileRef.name;
          
          // Skip if already in Firestore
          if (existingPhotos.has(fileName)) {
            syncedFiles++;
            skippedFiles++;
            updateSyncProgress(syncedFiles, totalFiles);
            return { status: 'skipped', fileName };
          }
          
          // Check plan limits before proceeding
          if (totalPhotosAfterSync >= maxPhotos) {
            syncedFiles++;
            skippedFiles++;
            updateSyncProgress(syncedFiles, totalFiles);
            return { status: 'limit_exceeded', fileName };
          }
          
          // Get metadata and download URL
          const [metadata, url] = await Promise.all([
            fileRef.getMetadata(),
            fileRef.getDownloadURL()
          ]);
          
          // Create thumbnails 
          // In a real implementation, this would trigger a cloud function
          // Here we're just using the full image URL as thumbnail
          const thumbnails = {
            sm: url,
            md: url,
            lg: url
          };
          
          // Create a proper filename if missing
          const originalName = metadata.customMetadata?.originalName || fileName;
          
          // Create document in Firestore
          const photoDoc = db.collection('photos').doc();
          
          // Add human-readable search information for easy admin searching
          const searchableInfo = {
            galleryName: galleryData.name || 'Untitled Gallery',
            clientName: galleryData.clientName || 'Unknown Client',
            photoName: originalName,
            photoNameLower: originalName.toLowerCase(),
            searchLabel: `Photo: ${originalName} in ${galleryData.name}`,
            photographerEmail: currentUser.email
          };
          
          await photoDoc.set({
            galleryId: galleryId,
            photographerId: currentUser.uid,
            name: originalName,
            fileName: fileName,
            storageRef: fileRef.fullPath,
            url: url,
            thumbnails: thumbnails,
            size: metadata.size || 0,
            type: metadata.contentType || 'image/jpeg',
            width: 0, // Would be populated by cloud function
            height: 0, // Would be populated by cloud function
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            syncedAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Add the searchable info
            ...searchableInfo
          });
          
          syncedFiles++;
          newFilesAdded++;
          totalPhotosAfterSync++;
          updateSyncProgress(syncedFiles, totalFiles);
          
          return { status: 'added', fileName, photoId: photoDoc.id };
        } catch (error) {
          console.error(`Error processing file ${fileRef.name}:`, error);
          syncedFiles++;
          updateSyncProgress(syncedFiles, totalFiles);
          return { status: 'error', fileName: fileRef.name, error: error.message };
        }
      });
      
      // Wait for the current batch to complete before moving to the next
      await Promise.all(batchPromises);
      
      // Brief pause between batches to prevent overloading Firestore
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Update gallery document with new photo count
    if (newFilesAdded > 0) {
      await db.collection('galleries').doc(galleryId).update({
        photosCount: firebase.firestore.FieldValue.increment(newFilesAdded),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSyncAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Also update plan with storage usage if plan ID is available
      if (galleryData.planId) {
        const totalUploadSize = newFilesAdded * 5 * 1024 * 1024; // Estimate 5MB per photo
        await db.collection('client-plans').doc(galleryData.planId).update({
          storageUsed: firebase.firestore.FieldValue.increment(totalUploadSize / (1024 * 1024)), // Convert to MB
          photosUploaded: firebase.firestore.FieldValue.increment(newFilesAdded),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Reload gallery photos to show the newly added ones
      photosList = [];
      lastVisiblePhoto = null;
      allPhotosLoaded = false;
      await loadGalleryPhotos(true);
      
      // Show success message
      showSuccessMessage(`Sync complete: ${newFilesAdded} new photos added, ${skippedFiles} already synced.`);
      
      // Add notification
      if (window.NotificationSystem) {
        window.NotificationSystem.createNotificationFromEvent({
          type: 'success',
          title: 'Gallery Sync Complete',
          message: `${newFilesAdded} new photos added to ${galleryData.name || 'gallery'}`
        });
      }
    } else {
      // No new photos found
      showInfoMessage(`All ${skippedFiles} photos are already synced.`);
    }
    
    // Handle limit warnings
    if (totalPhotosAfterSync >= maxPhotos) {
      showWarningMessage(`Plan limit reached: ${maxPhotos} photos. Upgrade your plan to add more photos.`);
    } else if (totalPhotosAfterSync > (maxPhotos * 0.9)) {
      showWarningMessage(`Approaching plan limit: ${totalPhotosAfterSync}/${maxPhotos} photos.`);
    }
    
    hideLoadingOverlay();
  } catch (error) {
    console.error('Error synchronizing photos:', error);
    showErrorMessage(`Sync failed: ${error.message}`);
    hideLoadingOverlay();
  }
}

// Initialize gallery view when document is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Gallery view initializing with enhanced upload reliability and rejection handling...');
  initGalleryView();
});



/**
 * Utility function to fix photo count discrepancies between galleries and plans
 * This can be called from the console for maintenance or added as a button in the admin UI
 */
async function fixPhotoCountDiscrepancies() {
  try {
    // Security check: Only allow for gallery owner
    if (!galleryData || galleryData.photographerId !== currentUser.uid) {
      console.error('Only the gallery owner can perform this operation');
      return false;
    }
    
    console.log('Starting to fix photo count discrepancies...');
    
    const db = firebase.firestore();
    
    // Step 1: Get the actual photo count from the photos collection
    const photosSnapshot = await db.collection('photos')
      .where('galleryId', '==', galleryId)
      .where('status', '==', 'active')
      .get();
    
    const actualPhotoCount = photosSnapshot.size;
    console.log(`Actual active photos found: ${actualPhotoCount}`);
    
    // Step 2: Get the gallery document to compare its count
    const galleryDoc = await db.collection('galleries').doc(galleryId).get();
    if (!galleryDoc.exists) {
      console.error('Gallery document not found');
      return false;
    }
    
    const galleryData = galleryDoc.data();
    const galleryPhotoCount = galleryData.photosCount || 0;
    
    console.log(`Current gallery photo count: ${galleryPhotoCount}`);
    
    // Step 3: Find the associated plan
    let planDoc = null;
    let planId = galleryData.planId;
    
    if (planId) {
      // Try to get the plan directly if we have a planId
      const planSnapshot = await db.collection('client-plans').doc(planId).get();
      if (planSnapshot.exists) {
        planDoc = planSnapshot;
      }
    }
    
    // If we couldn't find the plan by planId or if planId doesn't exist,
    // try to find it by clientId
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
        console.log(`Found plan by clientId: ${planId}`);
      }
    }
    
    // If we still don't have a plan, we can't fix the count
    if (!planDoc) {
      console.error('No associated plan found for this gallery');
      return false;
    }
    
    const planData = planDoc.data();
    const planPhotoCount = planData.photosUploaded || 0;
    
    console.log(`Current plan photo count: ${planPhotoCount}`);
    
    // Step 4: Calculate size data (approximate if needed)
    const totalSize = photosSnapshot.docs.reduce((sum, doc) => {
      return sum + (doc.data().size || 0);
    }, 0);
    
    const averagePhotoSize = photosSnapshot.size > 0 ? 
      totalSize / photosSnapshot.size : 0;
    
    const totalSizeMB = totalSize / (1024 * 1024);
    console.log(`Total photo size: ${totalSizeMB.toFixed(2)} MB`);
    
    // Step 5: Fix discrepancies if needed
    const fixes = [];
    
    // Fix gallery count if needed
    if (galleryPhotoCount !== actualPhotoCount) {
      console.log(`Fixing gallery count: ${galleryPhotoCount} → ${actualPhotoCount}`);
      fixes.push(
        db.collection('galleries').doc(galleryId).update({
          photosCount: actualPhotoCount,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
      );
    }
    
    // Fix plan count if needed
    if (planPhotoCount !== actualPhotoCount) {
      console.log(`Fixing plan count: ${planPhotoCount} → ${actualPhotoCount}`);
      fixes.push(
        db.collection('client-plans').doc(planId).update({
          photosUploaded: actualPhotoCount,
          storageUsed: totalSizeMB,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
      );
    }
    
    // If the gallery doesn't have planId, update it
    if (galleryData.planId !== planId) {
      console.log(`Updating gallery with correct planId: ${planId}`);
      fixes.push(
        db.collection('galleries').doc(galleryId).update({
          planId: planId,
          planType: planData.planType,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
      );
    }
    
    // Apply all fixes
    if (fixes.length > 0) {
      await Promise.all(fixes);
      console.log('All fixes applied successfully');
      return true;
    } else {
      console.log('No fixes needed - counts are already correct');
      return true;
    }
    
  } catch (error) {
    console.error('Error fixing photo count discrepancies:', error);
    return false;
  }
}

// Make the function available globally so it can be called from the console
window.fixPhotoCountDiscrepancies = fixPhotoCountDiscrepancies;

/**
 * Check if the current gallery is shared with clients
 * @returns {Promise<boolean>} True if gallery is shared, false otherwise
 */
async function checkIfGalleryIsShared() {
  try {
    if (!galleryId || !currentUser) {
      return false;
    }
    
    const db = firebase.firestore();
    const sharesSnapshot = await db.collection('galleryShares')
      .where('galleryId', '==', galleryId)
      .where('photographerId', '==', currentUser.uid)
      .where('status', '==', 'active')
      .get();
      
    return !sharesSnapshot.empty; // True if gallery is shared
  } catch (error) {
    console.error("Error checking gallery share status:", error);
    return false;
  }
}

// Enhanced Upload UI Functions
function showEnhancedUploadUI() {
  const uploadProgressContainer = document.getElementById('uploadProgressContainer');
  if (!uploadProgressContainer) return;
  
  // Add batch status indicator
  const batchStatusHtml = `
    <div id="uploadBatchStatus" class="upload-batch-status uploading">
      <div class="upload-queue-status" id="uploadQueueStatus"></div>
      <div>Preparing to upload ${uploadQueue.length} files...</div>
    </div>
  `;
  
  uploadProgressContainer.insertAdjacentHTML('afterbegin', batchStatusHtml);
  uploadProgressContainer.style.display = 'block';
  
  // Initialize queue visualization
  updateQueueVisualization();
  
  // Update buttons
  const startUploadBtn = document.getElementById('startUploadBtn');
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');
  
  if (startUploadBtn) startUploadBtn.disabled = true;
  if (pauseUploadBtn) {
    pauseUploadBtn.disabled = false;
    pauseUploadBtn.style.display = 'inline-block';
  }
  if (cancelUploadBtn) cancelUploadBtn.disabled = false;
}

function updateQueueVisualization() {
  const queueStatus = document.getElementById('uploadQueueStatus');
  if (!queueStatus) return;
  
  queueStatus.innerHTML = '';
  
  uploadQueue.forEach((file, index) => {
    const queueItem = document.createElement('div');
    queueItem.className = 'upload-queue-item';
    
    if (index < currentUploadIndex) {
      queueItem.classList.add('complete');
    } else if (activeUploadTasks.has(index)) {
      queueItem.classList.add('uploading');
    } else if (uploadRetryAttempts.has(index)) {
      queueItem.classList.add('failed');
    } else if (uploadPaused) {
      queueItem.classList.add('paused');
    } else {
      queueItem.classList.add('waiting');
    }
    
    queueStatus.appendChild(queueItem);
  });
}

// Enhanced file status update with retry indicators
function updateFileStatus(index, status) {
  const fileItem = document.querySelector(`.upload-file-item[data-index="${index}"]`);
  if (!fileItem) return;
  
  // Update status text
  const statusElement = fileItem.querySelector('.upload-file-status');
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = `upload-file-status status-${status.toLowerCase().replace(/[^a-z]/g, '')}`;
  }
  
  // Update file item class
  fileItem.className = `upload-file-item ${status.toLowerCase().replace(/[^a-z]/g, '')}`;
  
  // Add retry indicator if needed
  const retryCount = uploadRetryAttempts.get(index);
  if (retryCount && retryCount > 0) {
    let retryIndicator = fileItem.querySelector('.upload-retry-indicator');
    if (!retryIndicator) {
      retryIndicator = document.createElement('div');
      retryIndicator.className = 'upload-retry-indicator';
      fileItem.appendChild(retryIndicator);
    }
    retryIndicator.textContent = retryCount;
  }
  
  // Update queue visualization
  updateQueueVisualization();
}

// Save photo to Firestore (extracted from processIndividualUpload)
async function savePhotoToFirestore(fileIndex, file, fileName, downloadURL) {
  const thumbnails = { sm: downloadURL, md: downloadURL, lg: downloadURL };
  
  const searchableInfo = {
    galleryName: galleryData.name || 'Untitled Gallery',
    clientName: galleryData.clientName || 'Unknown Client',
    photoName: file.name,
    photoNameLower: file.name.toLowerCase(),
    searchLabel: `Photo: ${file.name} in ${galleryData.name}`,
    photographerEmail: currentUser.email
  };
  
  const db = firebase.firestore();
  const photoDoc = db.collection('photos').doc();
  
  await photoDoc.set({
    galleryId: galleryId,
    photographerId: currentUser.uid,
    name: file.name,
    fileName: fileName,
    storageRef: `galleries/${galleryId}/photos/${fileName}`,
    url: downloadURL,
    thumbnails: thumbnails,
    size: file.size,
    type: file.type,
    width: 0,
    height: 0,
    status: 'active',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    sessionId: uploadSessionId,
    ...searchableInfo
  });
  
  // Update gallery count
  await db.collection('galleries').doc(galleryId).update({
    photosCount: firebase.firestore.FieldValue.increment(1),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Export gallery view functions to window object for debugging and external access
window.galleryView = {
  loadGalleryData,
  loadGalleryPhotos,
  renderPhotos,
  viewPhoto,
  showPhotoInfo,
  deletePhoto,
  setViewMode,
  showUploadPhotosModal,
  // Upload management
  startPhotoUpload,
  cancelUpload,
  togglePauseUpload,
  // New features
  syncStorageWithFirestore,
  loadMorePhotos,
  fixPhotoCountDiscrepancies,
  // Add the new function here
  checkIfGalleryIsShared
};
// Add this to your window object for debugging
window.debugDuplicateDetection = debugDuplicateDetection;
