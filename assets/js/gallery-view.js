/**
 * gallery-view.js - Handles displaying and interacting with a photo gallery
 */

// Global variables
let currentUser = null;
let galleryId = null;
let clientId = null;
let galleryData = null;
let photosList = [];

// Constants
const THUMBNAIL_SIZE = 'md'; // Thumbnail size to use (options: sm, md, lg)
const PHOTOS_PER_PAGE = 30; // Number of photos to load per page

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

// Set up event listeners
function setupEventListeners() {
  // Upload photos button
  const uploadPhotosBtn = document.getElementById('uploadPhotosBtn');
  if (uploadPhotosBtn) uploadPhotosBtn.addEventListener('click', showUploadPhotosModal);
  
  // Empty state upload button
  const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
  if (emptyStateUploadBtn) emptyStateUploadBtn.addEventListener('click', showUploadPhotosModal);
  
  // Share gallery button
  const shareGalleryBtn = document.getElementById('shareGalleryBtn');
  if (shareGalleryBtn) shareGalleryBtn.addEventListener('click', showShareGalleryModal);
  
  // Gallery settings button
  const gallerySettingsBtn = document.getElementById('gallerySettingsBtn');
  if (gallerySettingsBtn) gallerySettingsBtn.addEventListener('click', showGallerySettingsModal);
  
  // Sort filter
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
    
    // Verify that the current user is the owner of the gallery
    if (galleryData.photographerId !== currentUser.uid) {
      throw new Error('You do not have permission to view this gallery');
    }
    
    // Update UI with gallery data
    updateGalleryInfo();
    
    // Load photos
    await loadGalleryPhotos();
    
    // Load client data if needed
    if (clientId && !galleryData.clientName) {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        galleryData.clientName = clientDoc.data().name || clientDoc.data().email || 'Unknown Client';
        updateGalleryInfo();
      }
    }
  } catch (error) {
    console.error('Error loading gallery data:', error);
    showErrorMessage(`Failed to load gallery: ${error.message}`);
    throw error;
  }
}

// Load photos from the gallery
async function loadGalleryPhotos() {
  try {
    if (!galleryId || !currentUser) {
      throw new Error('Missing gallery ID or user is not logged in');
    }
    
    // Show loading state for photos
    const photosContainer = document.getElementById('photosContainer');
    if (photosContainer) {
      photosContainer.innerHTML = '<div class="loading-photos">Loading photos...</div>';
    }
    
    const db = firebase.firestore();
    const photosQuery = db.collection('photos')
      .where('galleryId', '==', galleryId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(PHOTOS_PER_PAGE);
    
    const photosSnapshot = await photosQuery.get();
    photosList = [];
    
    photosSnapshot.forEach(doc => {
      photosList.push({ id: doc.id, ...doc.data() });
    });
    
    // Update photo count in gallery info
    const photoCountElement = document.getElementById('photoCount');
    if (photoCountElement) {
      photoCountElement.textContent = `Photos: ${photosList.length}`;
    }
    
    // Update UI with photos
    renderPhotos();
  } catch (error) {
    console.error('Error loading gallery photos:', error);
    showErrorMessage('Failed to load photos');
    throw error;
  }
}

// Render photos in the container
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
  
  // Clear container
  photosContainer.innerHTML = '';
  
  // Get current view mode
  const isGridView = photosContainer.classList.contains('photos-grid');
  
  // Create photo elements
  photosList.forEach(photo => {
    const photoElement = document.createElement('div');
    photoElement.className = isGridView ? 'photo-item' : 'photo-list-item';
    photoElement.setAttribute('data-photo-id', photo.id);
    
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
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoId = getPhotoIdFromElement(e.target);
      viewPhoto(photoId);
    });
  });
  
  document.querySelectorAll('.photo-action-btn.info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoId = getPhotoIdFromElement(e.target);
      showPhotoInfo(photoId);
    });
  });
  
  document.querySelectorAll('.photo-action-btn.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const photoId = getPhotoIdFromElement(e.target);
      confirmDeletePhoto(photoId);
    });
  });
  
  // Add click handler for photo containers
  document.querySelectorAll('.photo-container, .photo-list-thumbnail').forEach(container => {
    container.addEventListener('click', (e) => {
      const photoId = getPhotoIdFromElement(e.target);
      viewPhoto(photoId);
    });
  });
}

// Helper function to get photo ID from clicked element
function getPhotoIdFromElement(element) {
  const photoItem = element.closest('[data-photo-id]');
  return photoItem ? photoItem.getAttribute('data-photo-id') : null;
}

// Update gallery information in the UI
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

// Update user info in the header
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

// Toggle between grid and list view
function setViewMode(mode) {
  const photosContainer = document.getElementById('photosContainer');
  const gridBtn = document.getElementById('gridViewBtn');
  const listBtn = document.getElementById('listViewBtn');
  
  if (!photosContainer || !gridBtn || !listBtn) return;
  
  if (mode === 'grid') {
    photosContainer.classList.add('photos-grid');
    photosContainer.classList.remove('photos-list');
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
  } else {
    photosContainer.classList.remove('photos-grid');
    photosContainer.classList.add('photos-list');
    gridBtn.classList.remove('active');
    listBtn.classList.add('active');
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

// Photo upload related functions

// Show upload photos modal
function showUploadPhotosModal() {
  const modal = document.getElementById('uploadPhotosModal');
  if (!modal) return;
  
  // Reset upload UI
  resetUploadUI();
  
  // Show modal
  modal.style.display = 'block';
}

// Hide upload photos modal
function hideUploadPhotosModal() {
  const modal = document.getElementById('uploadPhotosModal');
  if (!modal) return;
  
  // Hide modal
  modal.style.display = 'none';
  
  // Reset upload UI
  resetUploadUI();
}

// Reset upload UI to initial state
function resetUploadUI() {
  // Clear file input
  const fileInput = document.getElementById('photoFileInput');
  if (fileInput) fileInput.value = '';
  
  // Show upload area, hide progress
  const uploadArea = document.getElementById('uploadArea');
  const progressContainer = document.getElementById('uploadProgressContainer');
  if (uploadArea) uploadArea.style.display = 'block';
  if (progressContainer) progressContainer.style.display = 'none';
  
  // Reset progress bar
  const progressBar = document.getElementById('uploadProgressBar');
  if (progressBar) progressBar.style.width = '0%';
  
  // Clear file list
  const fileList = document.getElementById('uploadFileList');
  if (fileList) fileList.innerHTML = '';
  
  // Reset upload count
  const uploadCount = document.getElementById('uploadCount');
  if (uploadCount) uploadCount.textContent = '0';
  
  // Reset percentage
  const uploadPercentage = document.getElementById('uploadPercentage');
  if (uploadPercentage) uploadPercentage.textContent = '0%';
}

// Handle file selection from input
function handleFileSelect(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  prepareFilesForUpload(files);
}

// Handle drag over for upload area
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.add('drag-over');
}

// Handle drag leave for upload area
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove('drag-over');
}

// Handle file drop on upload area
function handleFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;
  
  prepareFilesForUpload(files);
}

// Prepare files for upload (validate and show in UI)
function prepareFilesForUpload(files) {
  // Filter for only image files
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
  
  if (imageFiles.length === 0) {
    showErrorMessage('No valid image files selected');
    return;
  }
  
  // Show progress container, hide upload area
  const uploadArea = document.getElementById('uploadArea');
  const progressContainer = document.getElementById('uploadProgressContainer');
  if (uploadArea) uploadArea.style.display = 'none';
  if (progressContainer) progressContainer.style.display = 'block';
  
  // Update upload count
  const uploadCount = document.getElementById('uploadCount');
  if (uploadCount) uploadCount.textContent = imageFiles.length.toString();
  
  // Populate file list
  const fileList = document.getElementById('uploadFileList');
  if (fileList) {
    fileList.innerHTML = '';
    
    imageFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'upload-file-item';
      fileItem.setAttribute('data-file-index', index.toString());
      
      fileItem.innerHTML = `
        <div class="upload-file-info">
          <div class="upload-file-name">${file.name}</div>
          <div class="upload-file-size">${formatFileSize(file.size)}</div>
        </div>
        <div class="upload-file-status">Waiting</div>
      `;
      
      fileList.appendChild(fileItem);
    });
  }
  
  // Store files in a global variable for access during upload
  window.filesToUpload = imageFiles;
}

// Start photo upload process
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
        
        // Create a unique file name
        const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        // Create reference to the file location
        const fileRef = storageRef.child(`galleries/${galleryId}/photos/${fileName}`);
        
        // Create upload task
        const uploadTask = fileRef.put(file, {
          contentType: file.type,
          customMetadata: {
            'uploadedBy': currentUser.uid,
            'galleryId': galleryId,
            'originalName': file.name
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
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
                    loadGalleryPhotos();
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
}

// Update file status in the UI
function updateFileStatus(index, status) {
  const fileItem = document.querySelector(`.upload-file-item[data-file-index="${index}"]`);
  if (!fileItem) return;
  
  const statusElement = fileItem.querySelector('.upload-file-status');
  if (statusElement) {
    statusElement.textContent = status;
    
    // Add status class
    fileItem.classList.remove('waiting', 'uploading', 'complete', 'failed');
    fileItem.classList.add(status.toLowerCase());
  }
}

// Update file progress
function updateFileProgress(index, progress) {
  const fileItem = document.querySelector(`.upload-file-item[data-file-index="${index}"]`);
  if (!fileItem) return;
  
  // Store progress in data attribute
  fileItem.setAttribute('data-progress', progress.toString());
}

// Update total progress across all files
function updateTotalProgress() {
  if (!window.filesToUpload || window.filesToUpload.length === 0) return;
  
  // Calculate total progress
  let totalProgress = 0;
  const fileItems = document.querySelectorAll('.upload-file-item');
  
  fileItems.forEach(item => {
    const progress = parseFloat(item.getAttribute('data-progress') || '0');
    totalProgress += progress;
  });
  
  // Calculate average progress
  const averageProgress = totalProgress / window.filesToUpload.length;
  const progressPercent = Math.floor(averageProgress * 100);
  
  // Update progress bar
  const progressBar = document.getElementById('uploadProgressBar');
  if (progressBar) progressBar.style.width = `${progressPercent}%`;
  
  // Update percentage text
  const uploadPercentage = document.getElementById('uploadPercentage');
  if (uploadPercentage) uploadPercentage.textContent = `${progressPercent}%`;
}

// Photo viewing functions

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
    
    // Note: In a real app, you might not delete the file immediately from storage
    // Instead, you might have a cleanup function that runs periodically
    // For simplicity, we'll do it here
    if (photo.storageRef) {
      try {
        await storage.ref(photo.storageRef).delete();
      } catch (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue anyway, as the photo is marked deleted in the database
      }
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

// Share gallery (placeholder)
function showShareGalleryModal() {
  alert('Gallery sharing functionality would go here');
  // In a real implementation, this would show a modal with options to:
  // - Generate a share link
  // - Set password protection
  // - Set expiration date
  // - Send email invites
}

// Gallery settings (placeholder)
function showGallerySettingsModal() {
  alert('Gallery settings functionality would go here');
  // In a real implementation, this would show a modal with options to:
  // - Rename gallery
  // - Update description
  // - Change thumbnail
  // - Manage access settings
}

// Utility functions

// Format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show loading overlay
function showLoadingOverlay(message) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (!loadingOverlay) return;
  
  const loadingText = loadingOverlay.querySelector('.loading-text');
  if (loadingText) loadingText.textContent = message || 'Loading...';
  
  loadingOverlay.style.display = 'flex';
}

// Hide loading overlay
function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// Show success message
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
  }, 3000);
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
  showUploadPhotosModal
};
