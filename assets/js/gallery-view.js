/**
 * gallery-view.js - Handles displaying and interacting with a photo gallery
 * Updated with pagination, synchronization, plan enforcement, and upload reliability
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

// Constants
const THUMBNAIL_SIZE = 'md'; // Thumbnail size to use (options: sm, md, lg)
const PHOTOS_PER_PAGE = 30; // Number of photos to load per page
const DEFAULT_PLAN = 'basic'; // Default plan if no plan is found

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
  
  // Clear stored files
  window.filesToUpload = [];
  
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
  const fileList = document.getElementById('uploadFileList');
  if (fileList) fileList.innerHTML = '';
  
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
function togglePauseUpload() {
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  
  if (uploadPaused) {
    // Resume upload
    uploadPaused = false;
    if (pauseUploadBtn) {
      pauseUploadBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Upload';
    }
    showInfoMessage('Upload resumed');
    processUploadQueue(); // Resume processing
  } else {
    // Pause upload
    uploadPaused = true;
    if (pauseUploadBtn) {
      pauseUploadBtn.innerHTML = '<i class="fas fa-play"></i> Resume Upload';
    }
    showInfoMessage('Upload paused');
  }
}

// Function to apply plan limits to uploads
function applyPlanLimits(files) {
  if (!planLimits) return files;
  
  // Check photo count limit
  const currentPhotoCount = galleryData.photosCount || 0;
  const maxPhotos = planLimits.photos;
  let allowedFiles = [...files];
  
  if ((currentPhotoCount + files.length) > maxPhotos) {
    const remainingSlots = Math.max(0, maxPhotos - currentPhotoCount);
    
    if (remainingSlots === 0) {
      showErrorMessage(`You've reached your plan limit of ${maxPhotos} photos. Upgrade your plan to upload more.`);
      return [];
    } else {
      showWarningMessage(`Your plan allows ${maxPhotos} photos total. Only the first ${remainingSlots} photos will be uploaded.`);
      allowedFiles = files.slice(0, remainingSlots);
    }
  }
  
  // Check file size limit (in MB)
  const maxFileSizeMB = planLimits.maxSize;
  const oversizedFiles = allowedFiles.filter(file => file.size > (maxFileSizeMB * 1024 * 1024));
  
  if (oversizedFiles.length > 0) {
    if (oversizedFiles.length === allowedFiles.length) {
      showErrorMessage(`All selected files exceed the ${maxFileSizeMB}MB limit for your plan.`);
      return [];
    } else {
      // Filter out oversized files
      const originalCount = allowedFiles.length;
      allowedFiles = allowedFiles.filter(file => file.size <= (maxFileSizeMB * 1024 * 1024));
      showWarningMessage(`${oversizedFiles.length} files exceeded the ${maxFileSizeMB}MB limit and were removed from upload.`);
      
      // If no valid files remain, exit
      if (allowedFiles.length === 0) {
        return [];
      }
    }
  }
  
  return allowedFiles;
}

// Handle files with early plan validation
function handleFiles(files) {
  if (!files || files.length === 0) return;
  
  // PRE-CHECK PLAN LIMITS BEFORE DOING ANYTHING ELSE
  if (planLimits) {
    // Check photo count limit
    const currentPhotoCount = galleryData.photosCount || 0;
    const maxPhotos = planLimits.photos;
    const photosToUpload = files.length;
    
    if ((currentPhotoCount + photosToUpload) > maxPhotos) {
      const remainingSlots = Math.max(0, maxPhotos - currentPhotoCount);
      
      if (remainingSlots === 0) {
        showErrorMessage(`You've reached your plan limit of ${maxPhotos} photos. Upgrade your plan to upload more.`);
        return; // Stop processing completely
      } else {
        showWarningMessage(`Your plan allows ${maxPhotos} photos total. Only the first ${remainingSlots} photos will be processed.`);
        // Continue with limited number of files
      }
    }
  }
  
  // Filter image files only
  const imageFiles = Array.from(files).filter(file => {
    return file.type.startsWith('image/');
  });
  
  if (imageFiles.length === 0) {
    showErrorMessage('Please select image files only');
    return;
  }
  
  // Store files for upload
  window.filesToUpload = imageFiles;
  
  // Update upload preview
  updateUploadPreview(imageFiles);
  
  // Show next step
  showUploadStatus();
}

// Handle file select for upload
function handleFileSelect(event) {
  if (event.target && event.target.files) {
    handleFiles(event.target.files);
  }
}

// Enhanced startPhotoUpload with queue processing
async function startPhotoUpload() {
  try {
    if (!window.filesToUpload || window.filesToUpload.length === 0) {
      showErrorMessage('No files selected for upload');
      return;
    }
    
    if (!galleryId || !currentUser) {
      showErrorMessage('Gallery information missing');
      return;
    }
    
    // Prevent starting if already uploading
    if (isUploading) {
      showWarningMessage('Upload already in progress');
      return;
    }
    
    // Clear existing queue
    uploadQueue = [];
    currentUploadIndex = 0;
    isUploading = true;
    uploadPaused = false;
    
    // Apply plan limits and add to queue
    const files = applyPlanLimits(window.filesToUpload);
    if (files.length === 0) return; // All files filtered out by limits
    
    // Add files to upload queue
    uploadQueue = files;
    
    // Disable upload buttons
    const startUploadBtn = document.getElementById('startUploadBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    const pauseUploadBtn = document.getElementById('pauseUploadBtn');
    
    if (startUploadBtn) startUploadBtn.disabled = true;
    if (cancelUploadBtn) cancelUploadBtn.disabled = false;
    if (pauseUploadBtn) {
      pauseUploadBtn.disabled = false;
      pauseUploadBtn.style.display = 'inline-block';
    }
    
    // Set initial statuses
    for (let i = 0; i < uploadQueue.length; i++) {
      updateFileStatus(i, 'Waiting');
    }
    
    // Start processing queue
    processUploadQueue();
    
  } catch (error) {
    console.error('Error starting upload:', error);
    showErrorMessage(`Upload failed: ${error.message}`);
    isUploading = false;
    
    // Re-enable buttons
    const startUploadBtn = document.getElementById('startUploadBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    if (startUploadBtn) startUploadBtn.disabled = false;
    if (cancelUploadBtn) cancelUploadBtn.disabled = false;
  }
}

// Process upload queue with pause/resume support
async function processUploadQueue() {
  if (!isUploading || uploadPaused) return;
  
  if (currentUploadIndex >= uploadQueue.length) {
    // Upload complete
    isUploading = false;
    uploadComplete();
    return;
  }
  
  const file = uploadQueue[currentUploadIndex];
  try {
    // Update file status to "Uploading"
    updateFileStatus(currentUploadIndex, 'Uploading');
    
    // Create a unique file name
    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const fileName = `${timestamp}_${random}_${safeOriginalName}`;
    
    // Initialize storage
    const storage = firebase.storage();
    const storageRef = storage.ref();
    const fileRef = storageRef.child(`galleries/${galleryId}/photos/${fileName}`);
    
    // Upload with metadata
    const uploadTask = fileRef.put(file, {
      contentType: file.type,
      customMetadata: {
        'uploadedBy': currentUser.uid,
        'uploaderEmail': currentUser.email,
        'galleryId': galleryId,
        'galleryName': galleryData.name || 'Untitled Gallery',
        'originalName': file.name,
        'clientId': clientId || '',
        'clientName': galleryData.clientName || ''
      }
    });
    
    // Set up progress tracking and state management
    uploadTask.on('state_changed', 
      // Progress handler
      (snapshot) => {
        if (!isUploading) return; // Check if upload was cancelled
        
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
        updateFileProgress(currentUploadIndex, progress);
        updateTotalProgress();
      },
      // Error handler
      (error) => {
        console.error('Upload error:', error);
        updateFileStatus(currentUploadIndex, 'Failed');
        
        // Continue with next file
        currentUploadIndex++;
        processUploadQueue();
      },
      // Completion handler
      async () => {
        try {
          // Get download URL
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          
          // Create thumbnails
          const thumbnails = {
            sm: downloadURL,
            md: downloadURL,
            lg: downloadURL
          };
          
          // Add searchable info
          const searchableInfo = {
            galleryName: galleryData.name || 'Untitled Gallery',
            clientName: galleryData.clientName || 'Unknown Client',
            photoName: file.name,
            photoNameLower: file.name.toLowerCase(),
            searchLabel: `Photo: ${file.name} in ${galleryData.name}`,
            photographerEmail: currentUser.email
          };
          
          // Add to Firestore
          const db = firebase.firestore();
          const photoDoc = db.collection('photos').doc();
          
          await photoDoc.set({
            galleryId: galleryId,
            photographerId: currentUser.uid,
            name: file.name,
            fileName: fileName,
            storageRef: fileRef.fullPath,
            url: downloadURL,
            thumbnails: thumbnails,
            size: file.size,
            type: file.type,
            width: 0,
            height: 0,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ...searchableInfo
          });
          
          // Update file status to "Complete"
          updateFileStatus(currentUploadIndex, 'Complete');
          
          // Update gallery count
          await db.collection('galleries').doc(galleryId).update({
            photosCount: firebase.firestore.FieldValue.increment(1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          // Update plan storage usage if needed
          if (galleryData.planId) {
            await db.collection('client-plans').doc(galleryData.planId).update({
              storageUsed: firebase.firestore.FieldValue.increment(file.size / (1024 * 1024)), // Convert to MB
              photosUploaded: firebase.firestore.FieldValue.increment(1),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
          
          // Move to next file
          currentUploadIndex++;
          processUploadQueue();
          
        } catch (error) {
          console.error('Error processing uploaded file:', error);
          updateFileStatus(currentUploadIndex, 'Failed');
          
          // Continue with next file
          currentUploadIndex++;
          processUploadQueue();
        }
      }
    );
    
  } catch (error) {
    console.error('Error uploading file:', error);
    updateFileStatus(currentUploadIndex, 'Failed');
    
    // Continue with next file
    currentUploadIndex++;
    processUploadQueue();
  }
}

// Upload completion handler
function uploadComplete() {
  const uploadedFiles = uploadQueue.length;
  
  // Show success message
  showSuccessMessage(`Successfully uploaded ${uploadedFiles} photos`);
  
  // Add notification
  if (window.NotificationSystem) {
    window.NotificationSystem.createNotificationFromEvent({
      type: 'upload_complete',
      count: uploadedFiles,
      galleryName: galleryData.name || 'gallery'
    });
  }
  
  // Reset buttons
  const startUploadBtn = document.getElementById('startUploadBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');
  const pauseUploadBtn = document.getElementById('pauseUploadBtn');
  
  if (startUploadBtn) startUploadBtn.disabled = false;
  if (cancelUploadBtn) cancelUploadBtn.disabled = true;
  if (pauseUploadBtn) pauseUploadBtn.style.display = 'none';
  
  // Reload gallery after delay
  setTimeout(() => {
    photosList = [];
    lastVisiblePhoto = null;
    allPhotosLoaded = false;
    loadGalleryPhotos(true);
    hideUploadPhotosModal();
  }, 1500);
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

// Update file status in the UI
function updateFileStatus(index, status) {
  const fileItem = document.querySelector(`.upload-file-item[data-index="${index}"]`);
  if (!fileItem) return;
  
  const statusElement = fileItem.querySelector('.upload-file-status');
  if (statusElement) {
    statusElement.textContent = status;
    
    // Clear existing status classes
    statusElement.classList.remove('status-waiting', 'status-uploading', 'status-complete', 'status-failed');
    
    // Add appropriate status class
    statusElement.classList.add(`status-${status.toLowerCase()}`);
  }
}

// Update file progress in the UI
function updateFileProgress(index, progress) {
  const fileItem = document.querySelector(`.upload-file-item[data-index="${index}"]`);
  if (!fileItem) return;
  
  const progressBar = fileItem.querySelector('.upload-progress-bar');
  if (progressBar) {
    const percent = Math.round(progress * 100);
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent);
  }
}

// Update total progress in the UI
function updateTotalProgress() {
  const progressBars = document.querySelectorAll('.upload-progress-bar');
  const totalProgressBar = document.getElementById('totalProgressBar');
  
  if (!totalProgressBar || progressBars.length === 0) return;
  
  let totalProgress = 0;
  
  progressBars.forEach(bar => {
    const value = parseInt(bar.getAttribute('aria-valuenow') || '0', 10);
    totalProgress += value;
  });
  
  const averageProgress = Math.round(totalProgress / progressBars.length);
  totalProgressBar.style.width = `${averageProgress}%`;
  totalProgressBar.setAttribute('aria-valuenow', averageProgress);
  
  const progressText = document.getElementById('totalProgressText');
  if (progressText) {
    progressText.textContent = `${averageProgress}% Complete`;
  }
}

// Update upload preview in the UI
function updateUploadPreview(files) {
  const uploadPreview = document.getElementById('uploadPreview');
  if (!uploadPreview) return;
  
  uploadPreview.innerHTML = '';
  
  files.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'upload-file-item';
    fileItem.setAttribute('data-index', index);
    
    const reader = new FileReader();
    reader.onload = function(e) {
      fileItem.innerHTML = `
        <div class="upload-file-thumbnail" style="background-image: url('${e.target.result}')"></div>
        <div class="upload-file-info">
          <div class="upload-file-name">${file.name}</div>
          <div class="upload-file-meta">
            <span class="upload-file-size">${formatFileSize(file.size)}</span>
            <span class="upload-file-status">Waiting</span>
          </div>
        </div>
        <div class="upload-progress">
          <div class="upload-progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      `;
    };
    
    reader.readAsDataURL(file);
    uploadPreview.appendChild(fileItem);
  });
  
  // Update total count
  const totalCountElement = document.getElementById('uploadTotalCount');
  if (totalCountElement) {
    totalCountElement.textContent = `${files.length} files selected`;
  }
}

// Show upload status area
function showUploadStatus() {
  const uploadStep1 = document.getElementById('uploadStep1');
  const uploadStep2 = document.getElementById('uploadStep2');
  
  if (uploadStep1) uploadStep1.style.display = 'none';
  if (uploadStep2) uploadStep2.style.display = 'block';
}

// Handle drag over for file drop
function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) uploadArea.classList.add('dragging');
}

// Handle drag leave for file drop
function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) uploadArea.classList.remove('dragging');
}

// Handle file drop for upload
function handleFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) uploadArea.classList.remove('dragging');
  
  if (event.dataTransfer && event.dataTransfer.files) {
    handleFiles(event.dataTransfer.files);
  }
}

// Get photo ID from a clicked element
function getPhotoIdFromElement(element) {
  // Traverse up the DOM tree to find the closest element with photo ID
  let currentElement = element;
  while (currentElement && !currentElement.getAttribute('data-photo-id')) {
    currentElement = currentElement.parentElement;
  }
  
  return currentElement ? currentElement.getAttribute('data-photo-id') : null;
}

// Update sync progress in the UI
function updateSyncProgress(current, total) {
  const syncProgressBar = document.getElementById('syncProgressBar');
  const syncProgressText = document.getElementById('syncProgressText');
  
  if (syncProgressBar) {
    const percent = Math.floor((current / total) * 100);
    syncProgressBar.style.width = `${percent}%`;
    syncProgressBar.setAttribute('aria-valuenow', percent);
  }
  
  if (syncProgressText) {
    syncProgressText.textContent = `${current}/${total} files processed`;
  }
}

// Initialize gallery view when document is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Gallery view initializing with enhanced upload reliability...');
  initGalleryView();
});

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
  loadMorePhotos
};
