// Helper functions for file upload UI
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

// Update gallery info in UI
function updateGalleryInfo() {
  if (!galleryData) return;
  
  const galleryNameElement = document.getElementById('galleryName');
  const photoCountElement = document.getElementById('photoCount');
  const clientNameElement = document.getElementById('clientName');
  const createdDateElement = document.getElementById('createdDate');
  
  if (galleryNameElement) galleryNameElement.textContent = galleryData.name || 'Untitled Gallery';
  if (photoCountElement) photoCountElement.textContent = `Photos: ${galleryData.photosCount || 0}`;
  if (clientNameElement) clientNameElement.textContent = `Client: ${galleryData.clientName || 'Unknown'}`;
  
  if (createdDateElement && galleryData.createdAt) {
    const date = galleryData.createdAt.toDate();
    createdDateElement.textContent = `Created: ${date.toLocaleDateString()}`;
  }
  
  // Update document title
  document.title = `${galleryData.name || 'Gallery'} - Photo Gallery`;
}

// Update user info in header
function updateUserInfo() {
  if (!currentUser) return;
  
  const userNameElement = document.getElementById('userName');
  const userAvatarElement = document.getElementById('userAvatar');
  
  if (userNameElement) {
    userNameElement.textContent = currentUser.displayName || currentUser.email || 'User';
  }
  
  if (userAvatarElement && currentUser.photoURL) {
    userAvatarElement.style.backgroundImage = `url('${currentUser.photoURL}')`;
  }
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

// Handle file select for upload
function handleFileSelect(event) {
  if (event.target && event.target.files) {
    handleFiles(event.target.files);
  }
}

// Handle files for upload preview
function handleFiles(files) {
  if (!files || files.length === 0) return;
  
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

// Update upload preview
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

// Show upload photos modal
function showUploadPhotosModal() {
  const uploadPhotosModal = document.getElementById('uploadPhotosModal');
  if (!uploadPhotosModal) return;
  
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
  if (photoFileInput) photoFileInput.value = '';
  
  // Clear stored files
  window.filesToUpload = [];
  
  // Show modal
  uploadPhotosModal.style.display = 'block';
}

// Hide upload photos modal
function hideUploadPhotosModal() {
  const uploadPhotosModal = document.getElementById('uploadPhotosModal');
  if (uploadPhotosModal) uploadPhotosModal.style.display = 'none';
}

// Set view mode (grid or list)
function setViewMode(mode) {
  const photosContainer = document.getElementById('photosContainer');
  if (!photosContainer) return;
  
  const gridViewBtn = document.getElementById('gridViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  
  if (mode === 'grid') {
    photosContainer.classList.remove('photos-list');
    photosContainer.classList.add('photos-grid');
    
    if (gridViewBtn) gridViewBtn.classList.add('active');
    if (listViewBtn) listViewBtn.classList.remove('active');
    
    // Store preference
    localStorage.setItem('galleryViewMode', 'grid');
  } else {
    photosContainer.classList.remove('photos-grid');
    photosContainer.classList.add('photos-list');
    
    if (gridViewBtn) gridViewBtn.classList.remove('active');
    if (listViewBtn) listViewBtn.classList.add('active');
    
    // Store preference
    localStorage.setItem('galleryViewMode', 'list');
  }
  
  // Re-render photos for the new view
  renderPhotos();
}

// Handle sort change
function handleSortChange(e) {
  const sortBy = e.target.value;
  
  // Reload photos with new sort
  photosList = [];
  lastVisiblePhoto = null;
  allPhotosLoaded = false;
  
  // Update query options
  // Note: In a real implementation, we would update the query
  // For now, we'll just reload and simulate sorting in memory
  
  loadGalleryPhotos(true);
}

// Show share gallery modal (placeholder - would be implemented in a real app)
function showShareGalleryModal() {
  alert('Share gallery functionality would be implemented here');
}

// Show gallery settings modal (placeholder - would be implemented in a real app)
function showGallerySettingsModal() {
  alert('Gallery settings functionality would be implemented here');
}

// Initialize gallery view when document is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Gallery view initializing...');
  initGalleryView();
});

// Export gallery view functions to window object for debugging
window.galleryView = {
  loadGalleryData,
  loadGalleryPhotos,
  renderPhotos,
  viewPhoto,
  showPhotoInfo,
  deletePhoto,
  setViewMode,
  showUploadPhotosModal,
  // New exported functions
  syncStorageWithFirestore,
  loadMorePhotos
};// Update sync progress in the UI
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

// Enhanced startPhotoUpload with plan validation
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
    
    // Plan limit validations
    if (planLimits) {
      // Check photo count limit
      const currentPhotoCount = galleryData.photosCount || 0;
      const maxPhotos = planLimits.photos;
      const photosToUpload = window.filesToUpload.length;
      
      if ((currentPhotoCount + photosToUpload) > maxPhotos) {
        const remainingSlots = Math.max(0, maxPhotos - currentPhotoCount);
        
        if (remainingSlots === 0) {
          showErrorMessage(`You've reached your plan limit of ${maxPhotos} photos. Upgrade your plan to upload more.`);
          return;
        } else {
          showWarningMessage(`Your plan allows ${maxPhotos} photos total. You can upload ${remainingSlots} more photos.`);
          
          // Limit uploads to available slots
          window.filesToUpload = window.filesToUpload.slice(0, remainingSlots);
        }
      }
      
      // Check file size limit (in MB)
      const maxFileSizeMB = planLimits.maxSize;
      const oversizedFiles = window.filesToUpload.filter(file => file.size > (maxFileSizeMB * 1024 * 1024));
      
      if (oversizedFiles.length > 0) {
        if (oversizedFiles.length === window.filesToUpload.length) {
          showErrorMessage(`All selected files exceed the ${maxFileSizeMB}MB limit for your plan.`);
          return;
        } else {
          // Filter out oversized files
          const originalCount = window.filesToUpload.length;
          window.filesToUpload = window.filesToUpload.filter(file => file.size <= (maxFileSizeMB * 1024 * 1024));
          showWarningMessage(`${oversizedFiles.length} files exceeded the ${maxFileSizeMB}MB limit and were removed from upload.`);
          
          // If no valid files remain, exit
          if (window.filesToUpload.length === 0) {
            return;
          }
        }
      }
    }
    
    // Disable upload buttons
    const startUploadBtn = document.getElementById('startUploadBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    if (startUploadBtn) startUploadBtn.disabled = true;
    if (cancelUploadBtn) cancelUploadBtn.disabled = true;
    
    const files = window.filesToUpload;
    const totalFiles = files.length;
    let uploadedFiles = 0;
    let totalProgress = 0;
    
    // Initialize Firebase Storage
    const storage = firebase.storage();
    const storageRef = storage.ref();
    
    // Create a batch for Firestore updates
    const db = firebase.firestore();
  
    let batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500; // Maximum operations per batch
    
    // Update upload status for all files to "Waiting"
    for (let i = 0; i < totalFiles; i++) {
      updateFileStatus(i, 'Waiting');
    }
    
    // Process each file
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      try {
        // Update file status to "Uploading"
        updateFileStatus(i, 'Uploading');
        
        // Create a unique file name with improved readability for admin search
        const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const fileName = `${timestamp}_${random}_${safeOriginalName}`;
        
        // Create reference to the file location
        const fileRef = storageRef.child(`galleries/${galleryId}/photos/${fileName}`);
        
        // Create upload task with human-readable metadata
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
        
        // Create promise that tracks both upload and metadata handling
        const fileUploadPromise = new Promise((resolve, reject) => {
          // Monitor upload progress
          uploadTask.on('state_changed', 
            // Progress handler
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes);
              updateFileProgress(i, progress);
              
              // Update total progress
              updateTotalProgress();
            },
            // Error handler
            (error) => {
              console.error('Upload error:', error);
              updateFileStatus(i, 'Failed');
              reject(error);
            },
            // Success handler
            async () => {
              try {
                // Get download URL
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                
                // Create thumbnails (in a real app, this would be done by a cloud function)
                // We'll fake it here by just using the same URL
                const thumbnails = {
                  sm: downloadURL,
                  md: downloadURL,
                  lg: downloadURL
                };
                
                // Create document in Firestore
                const photoDoc = db.collection('photos').doc();
                
                // Add human-readable search information
                const searchableInfo = {
                  galleryName: galleryData.name || 'Untitled Gallery',
                  clientName: galleryData.clientName || 'Unknown Client',
                  photoName: file.name,
                  photoNameLower: file.name.toLowerCase(),
                  searchLabel: `Photo: ${file.name} in ${galleryData.name}`,
                  photographerEmail: currentUser.email
                };
                
                batch.set(photoDoc, {
                  galleryId: galleryId,
                  photographerId: currentUser.uid,
                  name: file.name,
                  fileName: fileName,
                  storageRef: fileRef.fullPath,
                  url: downloadURL,
                  thumbnails: thumbnails,
                  size: file.size,
                  type: file.type,
                  width: 0, // Would be populated by cloud function
                  height: 0, // Would be populated by cloud function
                  status: 'active',
                  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                  // Add the searchable info
                  ...searchableInfo
                });
                
                // Increment batch count
                batchCount++;
                
                // Commit batch if it's reached the max size
                if (batchCount >= MAX_BATCH_SIZE) {
                  await batch.commit();
                  batch = db.batch(); // Create a new batch
                  batchCount = 0;
                }
                
                // Update file status to "Complete"
                updateFileStatus(i, 'Complete');
                
                // Increment completed count
                uploadedFiles++;
                
                // Update gallery if all files uploaded
                if (uploadedFiles === totalFiles) {
                  // Commit any remaining batch operations
                  if (batchCount > 0) {
                    await batch.commit();
                  }
                  
                  // Update gallery document with new photo count
                  await db.collection('galleries').doc(galleryId).update({
                    photosCount: firebase.firestore.FieldValue.increment(totalFiles),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                  
                  // Also update plan with storage usage
                  if (galleryData.planId) {
                    const totalUploadSize = files.reduce((sum, file) => sum + file.size, 0);
                    await db.collection('client-plans').doc(galleryData.planId).update({
                      storageUsed: firebase.firestore.FieldValue.increment(totalUploadSize / (1024 * 1024)), // Convert to MB
                      photosUploaded: firebase.firestore.FieldValue.increment(totalFiles),
                      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                  }
                  
                  // Add notification for upload completion
                  if (window.NotificationSystem) {
                    window.NotificationSystem.createNotificationFromEvent({
                      type: 'upload_complete',
                      count: totalFiles,
                      galleryName: galleryData.name || 'gallery'
                    });
                  }
                  
                  // Show success message
                  showSuccessMessage(`Successfully uploaded ${totalFiles} photos`);
                  
                  // Reload gallery photos after short delay
                  setTimeout(() => {
                    photosList = [];
                    lastVisiblePhoto = null;
                    allPhotosLoaded = false;
                    loadGalleryPhotos(true);
                    hideUploadPhotosModal();
                  }, 1500);
                }
                
                resolve();
              } catch (error) {
                console.error('Error processing uploaded file:', error);
                updateFileStatus(i, 'Failed');
                reject(error);
              }
            }
          );
        });
        
        // We don't await here, as we want uploads to run in parallel
        fileUploadPromise.catch(err => {
          console.error('File upload promise error:', err);
        });
        
      } catch (error) {
        console.error('Error uploading file:', error);
        updateFileStatus(i, 'Failed');
      }
    }
  } catch (error) {
    console.error('Error starting upload:', error);
    showErrorMessage(`Upload failed: ${error.message}`);
    
    // Re-enable upload buttons
    const startUploadBtn = document.getElementById('startUploadBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    if (startUploadBtn) startUploadBtn.disabled = false;
    if (cancelUploadBtn) cancelUploadBtn.disabled = false;
  }
}/**
 * gallery-view.js - Handles displaying and interacting with a photo gallery
 * Updated with pagination, synchronization, and plan enforcement
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

// Set up event listeners - with new listeners for pagination and sync
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
  if (photoFileInput) photoFileInput.addEventListener('change', handleFileSelect);
  
  // Upload buttons
  const startUploadBtn = document.getElementById('startUploadBtn');
  const cancelUploadBtn = document.getElementById('cancelUploadBtn');
  if (startUploadBtn) startUploadBtn.addEventListener('click', startPhotoUpload);
  if (cancelUploadBtn) cancelUploadBtn.addEventListener('click', hideUploadPhotosModal);
  
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

// Load gallery data from Firestore with enhanced error handling and human-readable fields
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

// Get photo ID from a clicked element
function getPhotoIdFromElement(element) {
  // Traverse up the DOM tree to find the closest element with photo ID
  let currentElement = element;
  while (currentElement && !currentElement.getAttribute('data-photo-id')) {
    currentElement = currentElement.parentElement;
  }
  
  return currentElement ? currentElement.getAttribute('data-photo-id') : null;
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
    const storage = firebase.storage();
    
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

// Format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Synchronize Storage with Firestore to ensure all photos are properly tracked
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
