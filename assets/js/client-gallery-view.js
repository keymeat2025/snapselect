/**
 * client-gallery-view.js - Client-side gallery viewing and photo selection functionality
 * For clients to view and select photos from shared galleries
 */

class ClientGalleryViewer {
  constructor() {
    // Firebase services
    this.db = firebase.firestore();
    this.auth = firebase.auth();
    this.storage = firebase.storage();
    
    // State
    this.currentUser = null;
    this.galleryData = null;
    this.sharedGallery = null;
    this.photos = [];
    this.selectedPhotos = {};
    this.maxSelections = 0;
    this.selectedCount = 0;
    this.isAuthenticated = false;
    this.requiresPassword = false;
    this.passwordVerified = false;
    this.currentPhotoIndex = 0;
    this.viewMode = 'grid';
    this.sortOrder = 'newest';
    this.searchQuery = '';
    this.photosPerPage = 30;
    this.currentPage = 1;
    this.hasMorePhotos = false;
    
    // DOM elements
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.loadingText = document.getElementById('loadingText');
    this.passwordOverlay = document.getElementById('passwordOverlay');
    this.passwordForm = document.getElementById('passwordForm');
    this.galleryExpiredMsg = document.getElementById('galleryExpiredMsg');
    this.errorContainer = document.getElementById('errorContainer');
    this.errorMessage = document.getElementById('errorMessage');
    this.galleryInfo = document.getElementById('galleryInfo');
    this.galleryContainer = document.getElementById('galleryContainer');
    this.photoContainer = document.getElementById('photoContainer');
    this.noPhotosMsg = document.getElementById('noPhotosMsg');
    this.searchInput = document.getElementById('searchInput');
    this.sortFilter = document.getElementById('sortFilter');
    this.gridViewBtn = document.getElementById('gridViewBtn');
    this.listViewBtn = document.getElementById('listViewBtn');
    this.loadMoreBtn = document.getElementById('loadMoreBtn');
    this.currentSelections = document.getElementById('currentSelections');
    this.maxSelectionsElement = document.getElementById('maxSelections');
    this.submitSelectionsBtn = document.getElementById('submitSelectionsBtn');
    this.photoLightbox = document.getElementById('photoLightbox');
    
    this.lightboxImage = document.getElementById('lightboxImage');
    this.lightboxTitle = document.getElementById('lightboxTitle');
    this.photoNumber = document.getElementById('photoNumber');
    this.photoWatermark = document.getElementById('photoWatermark');
    this.prevPhotoBtn = document.getElementById('prevPhotoBtn');
    this.nextPhotoBtn = document.getElementById('nextPhotoBtn');
    this.closeLightboxBtn = document.getElementById('closeLightboxBtn');
    this.selectPhotoBtn = document.getElementById('selectPhotoBtn');
    this.deselectPhotoBtn = document.getElementById('deselectPhotoBtn');
    this.submissionModal = document.getElementById('submissionModal');
    this.submissionSelectionCount = document.getElementById('submissionSelectionCount');
    this.submissionForm = document.getElementById('submissionForm');
    this.closeSubmissionModalBtn = document.getElementById('closeSubmissionModalBtn');
    this.cancelSubmissionBtn = document.getElementById('cancelSubmissionBtn');
    this.confirmSubmissionBtn = document.getElementById('confirmSubmissionBtn');
    this.successMessage = document.getElementById('successMessage');
    this.toastContainer = document.getElementById('toastContainer');
    
    // Bind methods
    this.init = this.init.bind(this);
    this.loadSharedGallery = this.loadSharedGallery.bind(this);
    this.verifyPassword = this.verifyPassword.bind(this);
    this.loadGalleryInfo = this.loadGalleryInfo.bind(this);
    this.loadPhotos = this.loadPhotos.bind(this);
    this.renderPhotos = this.renderPhotos.bind(this);
    this.togglePhotoSelection = this.togglePhotoSelection.bind(this);
    this.updateSelectionCount = this.updateSelectionCount.bind(this);
    this.openLightbox = this.openLightbox.bind(this);
    this.closeLightbox = this.closeLightbox.bind(this);
    this.showNextPhoto = this.showNextPhoto.bind(this);
    this.showPrevPhoto = this.showPrevPhoto.bind(this);
    this.updateLightbox = this.updateLightbox.bind(this);
    this.setViewMode = this.setViewMode.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.loadMorePhotos = this.loadMorePhotos.bind(this);
    this.showSubmissionModal = this.showSubmissionModal.bind(this);
    this.closeSubmissionModal = this.closeSubmissionModal.bind(this);
    this.submitSelections = this.submitSelections.bind(this);
    this.showToast = this.showToast.bind(this);
    this.disableRightClick = this.disableRightClick.bind(this);
    
    // Initialize
    this.init();
  }
  
  // Initialize the gallery viewer
  init() {
    console.log('Initializing ClientGalleryViewer...');
    this.showLoading('Loading gallery...');
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (!shareId) {
      this.showError('Invalid gallery link. Please check the URL and try again.');
      return;
    }
    
    // Check for user authentication
    firebase.auth().onAuthStateChanged(user => {
      this.currentUser = user;
      this.isAuthenticated = user !== null;
      
      // Load the shared gallery
      this.loadSharedGallery(shareId);
      
      // Add event listeners
      this.addEventListeners();
    });
  }
  
  // Add event listeners
  addEventListeners() {
    // Password form submission
    if (this.passwordForm) {
      this.passwordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.verifyPassword();
      });
    }
    
    // Grid/List view toggle
    if (this.gridViewBtn) {
      this.gridViewBtn.addEventListener('click', () => this.setViewMode('grid'));
    }
    
    if (this.listViewBtn) {
      this.listViewBtn.addEventListener('click', () => this.setViewMode('list'));
    }
    
    // Sort filter
    if (this.sortFilter) {
      this.sortFilter.addEventListener('change', this.handleSort);
    }
    
    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', this.handleSearch);
    }
    
    // Load more photos
    if (this.loadMoreBtn) {
      this.loadMoreBtn.addEventListener('click', this.loadMorePhotos);
    }
    
    // Submit selections
    if (this.submitSelectionsBtn) {
      this.submitSelectionsBtn.addEventListener('click', this.showSubmissionModal);
    }
    
    // Lightbox controls
    if (this.closeLightboxBtn) {
      this.closeLightboxBtn.addEventListener('click', this.closeLightbox);
    }
    
    if (this.prevPhotoBtn) {
      this.prevPhotoBtn.addEventListener('click', this.showPrevPhoto);
    }
    
    if (this.nextPhotoBtn) {
      this.nextPhotoBtn.addEventListener('click', this.showNextPhoto);
    }
    
    if (this.selectPhotoBtn) {
      this.selectPhotoBtn.addEventListener('click', () => {
        const photoId = this.photos[this.currentPhotoIndex].id;
        this.togglePhotoSelection(photoId, true);
        this.updateLightbox();
      });
    }
    
    if (this.deselectPhotoBtn) {
      this.deselectPhotoBtn.addEventListener('click', () => {
        const photoId = this.photos[this.currentPhotoIndex].id;
        this.togglePhotoSelection(photoId, false);
        this.updateLightbox();
      });
    }
    
    // Submission modal controls
    if (this.closeSubmissionModalBtn) {
      this.closeSubmissionModalBtn.addEventListener('click', this.closeSubmissionModal);
    }
    
    if (this.cancelSubmissionBtn) {
      this.cancelSubmissionBtn.addEventListener('click', this.closeSubmissionModal);
    }
    
    if (this.confirmSubmissionBtn) {
      this.confirmSubmissionBtn.addEventListener('click', this.submitSelections);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.photoLightbox && !this.photoLightbox.classList.contains('hidden')) {
        if (e.key === 'ArrowRight') {
          this.showNextPhoto();
        } else if (e.key === 'ArrowLeft') {
          this.showPrevPhoto();
        } else if (e.key === 'Escape') {
          this.closeLightbox();
        } else if (e.key === ' ' || e.key === 'Enter') {
          // Toggle selection with spacebar or enter
          const photoId = this.photos[this.currentPhotoIndex].id;
          this.togglePhotoSelection(photoId);
          this.updateLightbox();
          e.preventDefault(); // Prevent page scrolling with spacebar
        }
      }
    });
    
    // Disable right-click on photos if preventDownload is enabled
    if (this.galleryData && this.galleryData.preventDownload) {
      document.addEventListener('contextmenu', this.disableRightClick);
    }
  }
  
  // Load a shared gallery from shareId
  loadSharedGallery(shareId) {
    if (!shareId) {
      this.showError('Invalid gallery link');
      return;
    }
    
    console.log('Loading shared gallery:', shareId);
    
    this.db.collection('client-shared-galleries')
      .doc(shareId)
      .get()
      .then(doc => {
        if (!doc.exists) {
          this.showError('Gallery not found or has been removed');
          return;
        }
        
        this.sharedGallery = {
          id: doc.id,
          ...doc.data()
        };
        
        console.log('Shared gallery loaded:', this.sharedGallery);
        
        // Check if gallery is expired or revoked
        if (this.sharedGallery.status !== 'active') {
          this.showElement(this.galleryExpiredMsg);
          this.hideLoading();
          return;
        }
        
        // Check for expiry date
        if (this.sharedGallery.expiryDate) {
          const now = new Date();
          const expiryDate = this.sharedGallery.expiryDate.toDate();
          
          if (expiryDate < now) {
            this.showElement(this.galleryExpiredMsg);
            this.hideLoading();
            return;
          }
        }
        
        // Update access statistics
        this.db.collection('client-shared-galleries')
          .doc(shareId)
          .update({
            lastAccessed: firebase.firestore.FieldValue.serverTimestamp(),
            accessCount: firebase.firestore.FieldValue.increment(1)
          })
          .catch(error => {
            console.error('Error updating access stats:', error);
          });
        
        // Check if password protection is enabled
        if (this.sharedGallery.passwordProtected && !this.passwordVerified) {
          console.log('Gallery is password protected');
          this.requiresPassword = true;
          this.showElement(this.passwordOverlay);
          this.hideLoading();
          return;
        }
        
        // Load the gallery data
        this.loadGalleryInfo();
      })
      .catch(error => {
        console.error('Error loading shared gallery:', error);
        this.showError('An error occurred while loading the gallery. Please try again later.');
      });
  }
  
  // Verify password for protected galleries
  verifyPassword() {
    const passwordInput = document.getElementById('galleryPassword');
    const passwordError = document.getElementById('passwordError');
    
    if (!passwordInput || !this.sharedGallery) return;
    
    const enteredPassword = passwordInput.value.trim();
    
    if (!enteredPassword) {
      this.showElement(passwordError);
      return;
    }
    
    this.showLoading('Verifying password...');
    
    // In a real implementation, you would verify the password against the hashed version
    // For demo purposes, we're using a simple Base64 encoding
    const hashedPassword = this.sharedGallery.password;
    const decodedPassword = atob(hashedPassword);
    
    if (enteredPassword === decodedPassword) {
      this.passwordVerified = true;
      this.hideElement(this.passwordOverlay);
      this.loadGalleryInfo();
    } else {
      this.hideLoading();
      this.showElement(passwordError);
      passwordInput.value = '';
      passwordInput.focus();
    }
  }
  
  // Load gallery information
  loadGalleryInfo() {
    if (!this.sharedGallery) {
      this.showError('Gallery information not available');
      return;
    }
    
    this.showLoading('Loading gallery information...');
    
    const galleryId = this.sharedGallery.galleryId;
    
    this.db.collection('galleries')
      .doc(galleryId)
      .get()
      .then(doc => {
        if (!doc.exists) {
          this.showError('Gallery not found or has been removed');
          return;
        }
        
        this.galleryData = {
          id: doc.id,
          ...doc.data()
        };
        
        console.log('Gallery data loaded:', this.galleryData);
        
        // Load photographer information
        const photographerId = this.galleryData.photographerId;
        
        return this.db.collection('users')
          .doc(photographerId)
          .get()
          .then(userDoc => {
            if (userDoc.exists) {
              this.galleryData.photographerName = userDoc.data().displayName || userDoc.data().businessName || 'Photographer';
            }
            
            // Update UI with gallery information
            this.updateGalleryInfo();
            
            // Load photos
            this.loadPhotos();
          });
      })
      .catch(error => {
        console.error('Error loading gallery information:', error);
        this.showError('An error occurred while loading gallery information. Please try again later.');
      });
  }
  
  // Update gallery information in the UI
  updateGalleryInfo() {
    if (!this.galleryData) return;
    
    // Update page title
    document.title = `${this.galleryData.name || 'Gallery'} - SnapSelect`;
    
    // Update gallery name and description
    const galleryName = document.getElementById('galleryName');
    const galleryDescription = document.getElementById('galleryDescription');
    
    if (galleryName) {
      galleryName.textContent = this.galleryData.name || 'Untitled Gallery';
    }
    
    if (galleryDescription) {
      galleryDescription.textContent = this.galleryData.description || '';
    }
    
    // Update photographer name
    const photographerName = document.getElementById('photographerName');
    if (photographerName) {
      photographerName.textContent = this.galleryData.photographerName || 'Photographer';
    }
    
    // Update expiry info if available
    const expiryInfo = document.getElementById('expiryInfo');
    const expiryDate = document.getElementById('expiryDate');
    
    if (expiryInfo && expiryDate && this.sharedGallery.expiryDate) {
      const formattedDate = this.sharedGallery.expiryDate.toDate().toLocaleDateString();
      expiryDate.textContent = formattedDate;
      this.showElement(expiryInfo);
    } else if (expiryInfo) {
      this.hideElement(expiryInfo);
    }
    
    // Update selection limit
    this.maxSelections = this.galleryData.maxSelections || 0;
    
    if (this.maxSelectionsElement) {
      this.maxSelectionsElement.textContent = this.maxSelections > 0 ? this.maxSelections : '∞';
    }
    
    // Show gallery info section
    this.showElement(this.galleryInfo);
    this.showElement(this.galleryContainer);
  }
  
  // Load photos from the gallery
  loadPhotos() {
    if (!this.galleryData) return;
    
    this.showLoading('Loading photos...');
    
    // Create query
    let query = this.db.collection('photos')
      .where('galleryId', '==', this.galleryData.id)
      .where('status', '==', 'active');
    
    // Apply sorting
    switch (this.sortOrder) {
      case 'newest':
        query = query.orderBy('createdAt', 'desc');
        break;
      case 'oldest':
        query = query.orderBy('createdAt', 'asc');
        break;
      case 'name-asc':
        query = query.orderBy('name', 'asc');
        break;
      case 'name-desc':
        query = query.orderBy('name', 'desc');
        break;
      default:
        query = query.orderBy('createdAt', 'desc');
    }
    
    // Apply pagination
    query = query.limit(this.photosPerPage);
    
    query.get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.log('No photos found');
          this.showElement(this.noPhotosMsg);
          this.hideElement(this.galleryContainer);
          this.hideLoading();
          return;
        }
        
        // Reset photos array if this is the first page
        if (this.currentPage === 1) {
          this.photos = [];
        }
        
        // Store photos
        snapshot.forEach(doc => {
          this.photos.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Check if there are more photos
        this.hasMorePhotos = snapshot.docs.length === this.photosPerPage;
        
        // Update photo count
        const photoCount = document.getElementById('photoCount');
        if (photoCount) {
          photoCount.textContent = `${this.photos.length} photos`;
        }
        
        // Load existing selections if any
        this.loadSelections()
          .then(() => {
            // Render photos
            this.renderPhotos();
            
            // Show load more button if needed
            if (this.hasMorePhotos) {
              this.showElement(this.loadMoreBtn);
            } else {
              this.hideElement(this.loadMoreBtn);
            }
            
            this.hideLoading();
          });
      })
      .catch(error => {
        console.error('Error loading photos:', error);
        this.showError('An error occurred while loading photos. Please try again later.');
      });
  }
  
  // Load more photos when scrolling or clicking "Load More"
  loadMorePhotos() {
    if (!this.hasMorePhotos || !this.galleryData) return;
    
    this.currentPage++;
    
    // Get the last document as the starting point
    const lastPhoto = this.photos[this.photos.length - 1];
    if (!lastPhoto) return;
    
    this.showLoading('Loading more photos...');
    
    // Create query
    let query = this.db.collection('photos')
      .where('galleryId', '==', this.galleryData.id)
      .where('status', '==', 'active');
    
    // Apply sorting with startAfter
    switch (this.sortOrder) {
      case 'newest':
        query = query.orderBy('createdAt', 'desc').startAfter(lastPhoto.createdAt);
        break;
      case 'oldest':
        query = query.orderBy('createdAt', 'asc').startAfter(lastPhoto.createdAt);
        break;
      case 'name-asc':
        query = query.orderBy('name', 'asc').startAfter(lastPhoto.name);
        break;
      case 'name-desc':
        query = query.orderBy('name', 'desc').startAfter(lastPhoto.name);
        break;
      default:
        query = query.orderBy('createdAt', 'desc').startAfter(lastPhoto.createdAt);
    }
    
    // Apply pagination
    query = query.limit(this.photosPerPage);
    
    query.get()
      .then(snapshot => {
        if (snapshot.empty) {
          this.hasMorePhotos = false;
          this.hideElement(this.loadMoreBtn);
          this.hideLoading();
          return;
        }
        
        // Add new photos to the array
        snapshot.forEach(doc => {
          this.photos.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Check if there are more photos
        this.hasMorePhotos = snapshot.docs.length === this.photosPerPage;
        
        // Update UI
        this.renderPhotos();
        
        // Show load more button if needed
        if (this.hasMorePhotos) {
          this.showElement(this.loadMoreBtn);
        } else {
          this.hideElement(this.loadMoreBtn);
        }
        
        // Update photo count
        const photoCount = document.getElementById('photoCount');
        if (photoCount) {
          photoCount.textContent = `${this.photos.length} photos`;
        }
        
        this.hideLoading();
      })
      .catch(error => {
        console.error('Error loading more photos:', error);
        this.showToast('error', 'Failed to load more photos. Please try again.');
        this.hideLoading();
      });
  }
  
  // Load existing selections
  loadSelections() {
    return new Promise((resolve) => {
      const shareId = this.sharedGallery ? this.sharedGallery.id : null;
      
      if (!shareId) {
        resolve();
        return;
      }
      
      this.db.collection('client-photo-selections')
        .where('shareId', '==', shareId)
        .where('status', '==', 'in_progress')
        .limit(1)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            resolve();
            return;
          }
          
          const selectionDoc = snapshot.docs[0];
          const selectionData = selectionDoc.data();
          
          if (selectionData.selectedPhotos && selectionData.selectedPhotos.length > 0) {
            selectionData.selectedPhotos.forEach(photoId => {
              this.selectedPhotos[photoId] = true;
              this.selectedCount++;
            });
            
            this.updateSelectionCount();
          }
          
          resolve();
        })
        .catch(error => {
          console.error('Error loading selections:', error);
          resolve();
        });
    });
  }
  
  // Render photos in the container
  renderPhotos() {
    const photoContainer = this.photoContainer;
    if (!photoContainer || !this.photos.length) return;
    
    // Apply search filter if needed
    let filteredPhotos = this.photos;
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredPhotos = this.photos.filter(photo => 
        (photo.name && photo.name.toLowerCase().includes(query)) ||
        (photo.description && photo.description.toLowerCase().includes(query))
      );
    }
    
    // Clear container if this is the first page
    if (this.currentPage === 1) {
      photoContainer.innerHTML = '';
    }
    
    // Set container class based on view mode
    photoContainer.className = this.viewMode === 'grid' ? 'photos-grid' : 'photos-list';
    
    // Create photo elements
    filteredPhotos.forEach((photo, index) => {
      // Skip photos that are already rendered
      const existingPhoto = document.querySelector(`[data-photo-id="${photo.id}"]`);
      if (existingPhoto) return;
      
      const photoElement = document.createElement('div');
      photoElement.className = this.viewMode === 'grid' ? 'photo-item' : 'photo-list-item';
      photoElement.setAttribute('data-photo-id', photo.id);
      photoElement.setAttribute('data-index', this.photos.indexOf(photo));
      
      // Get thumbnail URL
      const thumbnailUrl = photo.thumbnails?.md || photo.url || '';
      
      if (this.viewMode === 'grid') {
        // Grid view
        photoElement.innerHTML = `
          <div class="photo-container" style="background-image: url('${thumbnailUrl}')">
            <div class="photo-overlay">
              <div class="photo-info">
                <div class="photo-name">${photo.name || 'Photo ' + (index + 1)}</div>
              </div>
            </div>
            ${this.selectedPhotos[photo.id] ? '<div class="selection-badge"><i class="fas fa-check"></i></div>' : ''}
          </div>
        `;
      } else {
        // List view
        photoElement.innerHTML = `
          <div class="photo-list-thumbnail" style="background-image: url('${thumbnailUrl}')">
            ${this.selectedPhotos[photo.id] ? '<div class="selection-badge"><i class="fas fa-check"></i></div>' : ''}
          </div>
          <div class="photo-list-details">
            <div class="photo-list-name">${photo.name || 'Photo ' + (index + 1)}</div>
            <div class="photo-list-info">
              <span>${photo.createdAt?.toDate().toLocaleDateString() || 'Unknown date'}</span>
              ${photo.width && photo.height ? `<span>${photo.width} × ${photo.height}</span>` : ''}
            </div>
          </div>
          <div class="photo-list-actions">
            <button class="btn outline-btn select-btn ${this.selectedPhotos[photo.id] ? 'hidden' : ''}">Select</button>
            <button class="btn outline-btn deselect-btn ${this.selectedPhotos[photo.id] ? '' : 'hidden'}">Selected</button>
          </div>
        `;
      }
      
      // Add click event to open lightbox
      photoElement.addEventListener('click', (e) => {
        // Don't open lightbox if clicking on select/deselect button
        if (e.target.classList.contains('select-btn') || e.target.classList.contains('deselect-btn')) {
          e.stopPropagation();
          this.togglePhotoSelection(photo.id);
          return;
        }
        
        const index = parseInt(photoElement.getAttribute('data-index'));
        this.openLightbox(index);
      });
      
      // Add select/deselect button event for list view
      const selectBtn = photoElement.querySelector('.select-btn');
      const deselectBtn = photoElement.querySelector('.deselect-btn');
      
      if (selectBtn) {
        selectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePhotoSelection(photo.id, true);
        });
      }
      
      if (deselectBtn) {
        deselectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePhotoSelection(photo.id, false);
        });
      }
      
      photoContainer.appendChild(photoElement);
    });
    
    // Show message if no photos match search
    if (filteredPhotos.length === 0 && this.searchQuery) {
      photoContainer.innerHTML = `
        <div class="no-results">
          <p>No photos match your search for "${this.searchQuery}"</p>
          <button id="clearSearchBtn" class="btn outline-btn">Clear Search</button>
        </div>
      `;
      
      const clearSearchBtn = document.getElementById('clearSearchBtn');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
          this.searchInput.value = '';
          this.searchQuery = '';
          this.renderPhotos();
        });
      }
    }
  }
  
  // Toggle photo selection
  togglePhotoSelection(photoId, forceState) {
    // Check if max selections reached
    if (this.maxSelections > 0 && this.selectedCount >= this.maxSelections && !this.selectedPhotos[photoId]) {
      this.showToast('warning', `You can only select up to ${this.maxSelections} photos`);
      return;
    }
    
    const newState = forceState !== undefined ? forceState : !this.selectedPhotos[photoId];
    
    if (newState) {
      // Select photo
      this.selectedPhotos[photoId] = true;
      this.selectedCount++;
    } else {
      // Deselect photo
      delete this.selectedPhotos[photoId];
      this.selectedCount--;
    }
    
    // Update UI
    this.updateSelectionCount();
    
    // Update photo element
    const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
    if (photoElement) {
      // Update selection badge
      let selectionBadge = photoElement.querySelector('.selection-badge');
      
      if (newState) {
        if (!selectionBadge) {
          selectionBadge = document.createElement('div');
          selectionBadge.className = 'selection-badge';
          selectionBadge.innerHTML = '<i class="fas fa-check"></i>';
          
          const container = photoElement.querySelector('.photo-container') || 
                           photoElement.querySelector('.photo-list-thumbnail');
          
          if (container) {
            container.appendChild(selectionBadge);
          }
        }
      } else {
        if (selectionBadge) {
          selectionBadge.remove();
        }
      }
      
      // Update buttons in list view
      const selectBtn = photoElement.querySelector('.select-btn');
      const deselectBtn = photoElement.querySelector('.deselect-btn');
      
      if (selectBtn) {
        selectBtn.classList.toggle('hidden', newState);
      }
      
      if (deselectBtn) {
        deselectBtn.classList.toggle('hidden', !newState);
      }
    }
    
    // Update selection in database
    this.updateSelectionInDatabase();
  }
  
  // Update selection count in UI
  updateSelectionCount() {
    if (this.currentSelections) {
      this.currentSelections.textContent = this.selectedCount;
    }
    
    // Enable/disable submit button
    if (this.submitSelectionsBtn) {
      this.submitSelectionsBtn.disabled = this.selectedCount === 0;
    }
  }
  
  // Update selection in database
  updateSelectionInDatabase() {
    if (!this.sharedGallery) return;
    
    const shareId = this.sharedGallery.id;
    const selectedPhotoIds = Object.keys(this.selectedPhotos);
    
    this.db.collection('client-photo-selections')
      .where('shareId', '==', shareId)
      .where('status', '==', 'in_progress')
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          // Create new selection document
          this.db.collection('client-photo-selections').add({
            shareId: shareId,
            galleryId: this.galleryData.id,
            photographerId: this.galleryData.photographerId,
            selectedPhotos: selectedPhotoIds,
            status: 'in_progress',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Update existing selection document
          snapshot.docs[0].ref.update({
            selectedPhotos: selectedPhotoIds,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      })
      .catch(error => {
        console.error('Error updating selection in database:', error);
      });
  }
  
  // Open lightbox to view photo
  openLightbox(index) {
    if (!this.photos[index]) return;
    
    this.currentPhotoIndex = index;
    this.updateLightbox();
    this.showElement(this.photoLightbox);
    
    // Disable scrolling on body
    document.body.style.overflow = 'hidden';
  }
  
  // Close lightbox
  closeLightbox() {
    this.hideElement(this.photoLightbox);
    
    // Re-enable scrolling on body
    document.body.style.overflow = '';
  }
  
  // Show next photo in lightbox
  showNextPhoto() {
    if (this.currentPhotoIndex < this.photos.length - 1) {
      this.currentPhotoIndex++;
      this.updateLightbox();
    } else if (this.hasMorePhotos) {
      // Load more photos if available
      
      // Load more photos if available
      this.loadMorePhotos();
    }
  }
  
  // Show previous photo in lightbox
  showPrevPhoto() {
    if (this.currentPhotoIndex > 0) {
      this.currentPhotoIndex--;
      this.updateLightbox();
    }
  }
  
  // Update lightbox content
  updateLightbox() {
    const photo = this.photos[this.currentPhotoIndex];
    if (!photo) return;
    
    // Update image source
    if (this.lightboxImage) {
      this.lightboxImage.src = photo.url || '';
      this.lightboxImage.alt = photo.name || `Photo ${this.currentPhotoIndex + 1}`;
    }
    
    // Update title
    if (this.lightboxTitle) {
      this.lightboxTitle.textContent = photo.name || `Photo ${this.currentPhotoIndex + 1}`;
    }
    
    // Update photo number
    if (this.photoNumber) {
      this.photoNumber.textContent = `Photo ${this.currentPhotoIndex + 1} of ${this.photos.length}`;
    }
    
    // Update watermark if enabled
    if (this.photoWatermark) {
      if (this.galleryData && this.galleryData.watermarkEnabled) {
        this.photoWatermark.textContent = this.galleryData.watermarkText || 
                                         this.galleryData.photographerName || 
                                         'SnapSelect';
        this.showElement(this.photoWatermark);
      } else {
        this.hideElement(this.photoWatermark);
      }
    }
    
    // Update selection buttons
    const photoId = photo.id;
    const isSelected = this.selectedPhotos[photoId];
    
    if (this.selectPhotoBtn) {
      this.selectPhotoBtn.classList.toggle('hidden', isSelected);
    }
    
    if (this.deselectPhotoBtn) {
      this.deselectPhotoBtn.classList.toggle('hidden', !isSelected);
    }
    
    // Enable/disable navigation buttons
    if (this.prevPhotoBtn) {
      this.prevPhotoBtn.disabled = this.currentPhotoIndex === 0;
    }
    
    if (this.nextPhotoBtn) {
      this.nextPhotoBtn.disabled = this.currentPhotoIndex === this.photos.length - 1 && !this.hasMorePhotos;
    }
  }
  
  // Set view mode (grid or list)
  setViewMode(mode) {
    this.viewMode = mode;
    
    // Update active button
    if (this.gridViewBtn) {
      this.gridViewBtn.classList.toggle('active', mode === 'grid');
    }
    
    if (this.listViewBtn) {
      this.listViewBtn.classList.toggle('active', mode === 'list');
    }
    
    // Re-render photos
    this.renderPhotos();
  }
  
  // Handle sort filter change
  handleSort(e) {
    const newSortOrder = e.target.value;
    
    if (newSortOrder !== this.sortOrder) {
      this.sortOrder = newSortOrder;
      this.currentPage = 1;
      this.loadPhotos();
    }
  }
  
  // Handle search input
  handleSearch(e) {
    const query = e.target.value.trim();
    
    // Debounce search to avoid too many renders
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (query !== this.searchQuery) {
        this.searchQuery = query;
        this.renderPhotos();
      }
    }, 300);
  }
  
  // Show submission modal
  showSubmissionModal() {
    if (this.selectedCount === 0) {
      this.showToast('warning', 'Please select at least one photo first');
      return;
    }
    
    // Update selection count
    if (this.submissionSelectionCount) {
      this.submissionSelectionCount.textContent = this.selectedCount;
    }
    
    // Show/hide approval info based on gallery settings
    const requireApprovalInfo = document.getElementById('requireApprovalInfo');
    if (requireApprovalInfo) {
      if (this.galleryData && this.galleryData.requireApproval) {
        this.showElement(requireApprovalInfo);
      } else {
        this.hideElement(requireApprovalInfo);
      }
    }
    
    // Reset form and hide success message
    if (this.submissionForm) {
      this.submissionForm.reset();
    }
    
    this.hideElement(this.successMessage);
    this.showElement(this.submissionModal);
  }
  
  // Close submission modal
  closeSubmissionModal() {
    this.hideElement(this.submissionModal);
  }
  
  // Submit photo selections
  submitSelections(e) {
    if (e) e.preventDefault();
    
    if (this.selectedCount === 0) {
      this.showToast('warning', 'Please select at least one photo first');
      return;
    }
    
    // Get form values
    const nameInput = document.getElementById('submissionName');
    const emailInput = document.getElementById('submissionEmail');
    const commentsInput = document.getElementById('submissionComments');
    
    if (!nameInput || !emailInput) return;
    
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const comments = commentsInput ? commentsInput.value.trim() : '';
    
    if (!name || !email) {
      this.showToast('error', 'Please fill in all required fields');
      return;
    }
    
    // Disable submit button
    if (this.confirmSubmissionBtn) {
      this.confirmSubmissionBtn.disabled = true;
      this.confirmSubmissionBtn.textContent = 'Submitting...';
    }
    
    // Prepare selection data
    const selectedPhotoIds = Object.keys(this.selectedPhotos);
    const shareId = this.sharedGallery.id;
    const requireApproval = this.galleryData.requireApproval;
    
    // Find existing selection doc
    this.db.collection('client-photo-selections')
      .where('shareId', '==', shareId)
      .where('status', '==', 'in_progress')
      .limit(1)
      .get()
      .then(snapshot => {
        let selectionPromise;
        
        if (snapshot.empty) {
          // Create new selection document
          selectionPromise = this.db.collection('client-photo-selections').add({
            shareId: shareId,
            galleryId: this.galleryData.id,
            photographerId: this.galleryData.photographerId,
            clientName: name,
            clientEmail: email,
            comments: comments,
            selectedPhotos: selectedPhotoIds,
            selectedCount: selectedPhotoIds.length,
            status: requireApproval ? 'submitted' : 'approved',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedAt: requireApproval ? null : firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Update existing selection document
          const docRef = snapshot.docs[0].ref;
          selectionPromise = docRef.update({
            clientName: name,
            clientEmail: email,
            comments: comments,
            selectedPhotos: selectedPhotoIds,
            selectedCount: selectedPhotoIds.length,
            status: requireApproval ? 'submitted' : 'approved',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedAt: requireApproval ? null : firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        
        return selectionPromise;
      })
      .then(() => {
        // Create notification for the photographer
        return this.db.collection('user_notifications')
          .doc(this.galleryData.photographerId)
          .collection('notifications')
          .add({
            type: 'selection_submitted',
            title: 'Photo Selections Received',
            message: `${name} has selected ${selectedPhotoIds.length} photos from "${this.galleryData.name}"`,
            galleryId: this.galleryData.id,
            shareId: shareId,
            read: false,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
      })
      .then(() => {
        // Hide form and show success message
        this.hideElement(this.submissionForm);
        this.showElement(this.successMessage);
        
        // Enable submit button
        if (this.confirmSubmissionBtn) {
          this.confirmSubmissionBtn.disabled = false;
          this.confirmSubmissionBtn.textContent = 'Submit Selections';
        }
        
        // Change close button text
        if (this.cancelSubmissionBtn) {
          this.cancelSubmissionBtn.textContent = 'Close';
        }
        
        // Auto-close after delay
        setTimeout(() => {
          this.closeSubmissionModal();
        }, 3000);
      })
      .catch(error => {
        console.error('Error submitting selections:', error);
        this.showToast('error', 'Failed to submit selections. Please try again.');
        
        // Enable submit button
        if (this.confirmSubmissionBtn) {
          this.confirmSubmissionBtn.disabled = false;
          this.confirmSubmissionBtn.textContent = 'Submit Selections';
        }
      });
  }
  
  // Disable right-click on photos
  disableRightClick(e) {
    // Only disable on images or photo containers
    const isPhoto = e.target.tagName === 'IMG' || 
                   e.target.classList.contains('photo-container') ||
                   e.target.classList.contains('photo-list-thumbnail');
    
    if (isPhoto) {
      e.preventDefault();
      this.showToast('info', 'Right-click has been disabled for this gallery');
    }
  }
  
  // Show toast notification
  showToast(type, message) {
    if (!this.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        icon = '<i class="fas fa-exclamation-circle"></i>';
        break;
      case 'warning':
        icon = '<i class="fas fa-exclamation-triangle"></i>';
        break;
      case 'info':
      default:
        icon = '<i class="fas fa-info-circle"></i>';
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    this.toastContainer.appendChild(toast);
    
    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
  
  // Show loading overlay
  showLoading(message) {
    if (this.loadingOverlay) {
      if (this.loadingText) {
        this.loadingText.textContent = message || 'Loading...';
      }
      this.showElement(this.loadingOverlay);
    }
  }
  
  // Hide loading overlay
  hideLoading() {
    if (this.loadingOverlay) {
      this.hideElement(this.loadingOverlay);
    }
  }
  
  // Show error message
  showError(message) {
    if (this.errorContainer && this.errorMessage) {
      this.errorMessage.textContent = message;
      this.showElement(this.errorContainer);
      this.hideLoading();
    }
  }
  
  // Show element
  showElement(element) {
    if (element) {
      element.classList.remove('hidden');
    }
  }
  
  // Hide element
  hideElement(element) {
    if (element) {
      element.classList.add('hidden');
    }
  }
}

// Initialize gallery viewer on document ready
document.addEventListener('DOMContentLoaded', function() {
  window.ClientGalleryViewer = new ClientGalleryViewer();
});
