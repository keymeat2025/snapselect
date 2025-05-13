/*----------------------------------------------
 * PART 1: Core Structure and Authentication
 *----------------------------------------------*/

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
    
    // DOM elements (defined in init to ensure DOM is ready)
    this.loadingOverlay = null;
    this.loadingText = null;
    this.passwordOverlay = null;
    this.passwordForm = null;
    this.galleryExpiredMsg = null;
    this.errorContainer = null;
    this.errorMessage = null;
    this.galleryInfo = null;
    this.galleryContainer = null;
    this.photoContainer = null;
    this.noPhotosMsg = null;
    this.searchInput = null;
    this.sortFilter = null;
    this.gridViewBtn = null;
    this.listViewBtn = null;
    this.loadMoreBtn = null;
    this.currentSelections = null;
    this.maxSelectionsElement = null;
    this.submitSelectionsBtn = null;
    this.photoLightbox = null;
    this.lightboxImage = null;
    this.lightboxTitle = null;
    this.photoNumber = null;
    this.photoWatermark = null;
    this.prevPhotoBtn = null;
    this.nextPhotoBtn = null;
    this.closeLightboxBtn = null;
    this.selectPhotoBtn = null;
    this.deselectPhotoBtn = null;
    this.submissionModal = null;
    this.submissionSelectionCount = null;
    this.submissionForm = null;
    this.closeSubmissionModalBtn = null;
    this.cancelSubmissionBtn = null;
    this.confirmSubmissionBtn = null;
    this.successMessage = null;
    this.toastContainer = null;
    
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
    this.checkGalleryExpiry = this.checkGalleryExpiry.bind(this);
    this.showExpiryMessage = this.showExpiryMessage.bind(this);
    this.applyDownloadProtection = this.applyDownloadProtection.bind(this);
    this.applyWatermarking = this.applyWatermarking.bind(this);
    this.updateGalleryViewCount = this.updateGalleryViewCount.bind(this);
    this.showPurchaseInfo = this.showPurchaseInfo.bind(this);
    this.enhanceClientExperience = this.enhanceClientExperience.bind(this);
    
    // Initialize once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', this.init);
    } else {
      this.init();
    }
  }
  
  // Initialize the gallery viewer
  init() {
    console.log('Initializing ClientGalleryViewer...');
    
    // Initialize DOM elements
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
      
      // Prevent download keyboard shortcuts if download protection is enabled
      if (this.galleryData && this.galleryData.preventDownload) {
        if ((e.ctrlKey || e.metaKey) && 
            (e.key === 's' || e.key === 'p' || e.key === 'a')) {
          e.preventDefault();
          this.showToast('info', 'Downloads are not allowed for this gallery');
          return false;
        }
      }
    });
  }
  
  // Load a shared gallery from shareId
  loadSharedGallery(shareId) {
    if (!shareId) {
      this.showError('Invalid gallery link');
      return;
    }
    
    console.log('Loading shared gallery:', shareId);
    
    this.db.collection('galleryShares')
      .where('shareId', '==', shareId)
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          this.showError('Gallery not found or has been removed');
          return;
        }
        
        const doc = snapshot.docs[0];
        this.sharedGallery = {
          id: doc.id,
          ...doc.data()
        };
        
        console.log('Shared gallery loaded:', this.sharedGallery);
        
        // Check if gallery is expired
        if (this.checkGalleryExpiry(this.sharedGallery)) {
          return;
        }
        
        // Check if password protection is enabled
        if (this.sharedGallery.passwordProtected && !this.passwordVerified) {
          console.log('Gallery is password protected');
          this.requiresPassword = true;
          this.showElement(this.passwordOverlay);
          this.hideLoading();
          return;
        }
        
        // Apply protection settings
        if (this.sharedGallery.preventDownload) {
          this.applyDownloadProtection();
        }
        
        if (this.sharedGallery.watermarkEnabled) {
          this.applyWatermarking(this.sharedGallery.photographerId);
        }
        
        // Track gallery view
        this.updateGalleryViewCount(doc.id);
        
        // Update access statistics
        this.db.collection('galleryShares')
          .doc(doc.id)
          .update({
            lastAccessed: firebase.firestore.FieldValue.serverTimestamp(),
            accessCount: firebase.firestore.FieldValue.increment(1)
          })
          .catch(error => {
            console.error('Error updating access stats:', error);
          });
          
        // Load the gallery data
        this.loadGalleryInfo();
      })
      .catch(error => {
        console.error('Error loading shared gallery:', error);
        this.showError('An error occurred while loading the gallery. Please try again later.');
      });
  }
  
  // Check if the gallery has expired based on expiryDate
  checkGalleryExpiry(shareData) {
    if (shareData.expiryDate) {
      const expiryDate = shareData.expiryDate.toDate ? 
                        shareData.expiryDate.toDate() : 
                        new Date(shareData.expiryDate);
      
      const currentDate = new Date();
      
      if (currentDate > expiryDate) {
        // Gallery has expired, show message
        this.showExpiryMessage();
        return true;
      }
    }
    
    if (shareData.status && shareData.status !== 'active') {
      this.showExpiryMessage();
      return true;
    }
    
    return false;
  }
  
  // Show gallery expiry message
  showExpiryMessage() {
    // Hide gallery content
    if (this.galleryContainer) {
      this.hideElement(this.galleryContainer);
    }
    
    // Show expiry message
    if (this.galleryExpiredMsg) {
      this.showElement(this.galleryExpiredMsg);
    } else {
      // Create and show expiry message if element doesn't exist
      const expiryMessage = document.createElement('div');
      expiryMessage.className = 'expiry-message';
      expiryMessage.innerHTML = `
        <div class="expiry-content">
          <h2>This gallery link has expired</h2>
          <p>The photographer has set an expiration date for this gallery, and it is no longer available.</p>
          <p>Please contact the photographer for access.</p>
        </div>
      `;
      
      // Add to document
      document.querySelector('main').appendChild(expiryMessage);
    }
    
    this.hideLoading();
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
      
      // Apply protection settings now that password is verified
      if (this.sharedGallery.preventDownload) {
        this.applyDownloadProtection();
      }
      
      if (this.sharedGallery.watermarkEnabled) {
        this.applyWatermarking(this.sharedGallery.photographerId);
      }
      
      this.loadGalleryInfo();
    } else {
      this.hideLoading();
      this.showElement(passwordError);
      passwordInput.value = '';
      passwordInput.focus();
    }
  }
  
  // Update gallery view count
  updateGalleryViewCount(shareDocId) {
    const db = firebase.firestore();
    
    // Update view count and last viewed timestamp
    db.collection('galleryShares').doc(shareDocId).update({
      views: firebase.firestore.FieldValue.increment(1),
      lastViewed: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => {
      console.error("Error updating view count:", err);
    });
  }
  
  // Show toast notification
  showToast(type, message) {
    if (!this.toastContainer) {
      // Create toast container if it doesn't exist
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = 'toast-container';
      document.body.appendChild(this.toastContainer);
    }
    
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
  
  // Helper function to add CSS rules dynamically
  addCSS(cssText) {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);
  }
  
  // Show loading overlay
  showLoading(message) {
    if (this.loadingOverlay) {
      if (this.loadingText) {
        this.loadingText.textContent = message || 'Loading...';
      }
      this.showElement(this.loadingOverlay);
    } else {
      // Create loading overlay if it doesn't exist
      const overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">${message || 'Loading...'}</div>
      `;
      document.body.appendChild(overlay);
      this.loadingOverlay = overlay;
      this.loadingText = overlay.querySelector('.loading-text');
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
    } else {
      // Create error container if it doesn't exist
      const container = document.createElement('div');
      container.className = 'error-container';
      container.innerHTML = `
        <div class="error-icon"><i class="fas fa-exclamation-circle"></i></div>
        <div class="error-message">${message}</div>
        <button class="btn primary-btn error-dismiss">Dismiss</button>
      `;
      
      document.body.appendChild(container);
      this.errorContainer = container;
      this.errorMessage = container.querySelector('.error-message');
      
      const dismissBtn = container.querySelector('.error-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          this.hideElement(container);
        });
      }
      
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

/*----------------------------------------------
 * PART 2: Gallery Loading and Photo Display
 *----------------------------------------------*/

  // Get photographer info from Firestore
  getPhotographerInfo(photographerId) {
    if (!photographerId) return Promise.resolve(null);
    
    return this.db.collection('users')
      .doc(photographerId)
      .get()
      .then(doc => {
        if (!doc.exists) {
          // Try photographer collection as fallback
          return this.db.collection('photographer')
            .where('uid', '==', photographerId)
            .limit(1)
            .get()
            .then(snapshot => {
              if (snapshot.empty) return null;
              return snapshot.docs[0].data();
            });
        }
        return doc.data();
      })
      .catch(err => {
        console.error("Error fetching photographer info:", err);
        return null;
      });
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
          ...doc.data(),
          ...this.sharedGallery // Merge shared gallery settings
        };
        
        console.log('Gallery data loaded:', this.galleryData);
        
        // Load photographer information
        const photographerId = this.galleryData.photographerId;
        
        return this.getPhotographerInfo(photographerId)
          .then(photographerData => {
            if (photographerData) {
              this.galleryData.photographerName = photographerData.displayName || 
                                               photographerData.businessName || 
                                               photographerData.studioName || 
                                               'Photographer';
            }
            
            // Update UI with gallery information
            this.updateGalleryInfo();
            
            // Load photos
            this.loadPhotos();
            
            // Setup client experience enhancements
            this.enhanceClientExperience();
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
    document.title = `${this.galleryData.name || 'Gallery'} - Photo Gallery`;
    
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
    
    if (expiryInfo && expiryDate && this.galleryData.expiryDate) {
      const date = this.galleryData.expiryDate.toDate ? 
                  this.galleryData.expiryDate.toDate() : 
                  new Date(this.galleryData.expiryDate);
      
      const formattedDate = date.toLocaleDateString();
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
          this.hideElement(this.photoContainer);
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
    
    // Apply watermarking and download protection
    if (this.galleryData) {
      if (this.galleryData.watermarkEnabled) {
        this.applyWatermarking(this.galleryData.photographerId);
      }
      
      if (this.galleryData.preventDownload) {
        this.applyDownloadProtection();
      }
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

/*----------------------------------------------
 * PART 3: Photo Interaction and Selection
 *----------------------------------------------*/

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
                                         'Photography Studio';
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
  
  // Apply download protection measures
  applyDownloadProtection() {
    // Add CSS class to mark the gallery as protected
    const galleryContainer = document.querySelector('.gallery-container');
    if (galleryContainer) {
      galleryContainer.classList.add('protected-gallery');
      
      // Add a friendly notice about image protection
      const notice = document.createElement('div');
      notice.className = 'download-notice';
      notice.innerHTML = '<p>Images in this gallery are protected. Please contact the photographer for purchase options.</p>';
      galleryContainer.prepend(notice);
    }
    
    // 1. Process all images to prevent downloads
    document.querySelectorAll('.photo-container img, .photo-item img, #lightboxImage').forEach(img => {
      // Store original source before replacing
      if (!img.getAttribute('data-original-src')) {
        img.setAttribute('data-original-src', img.src);
      }
      
      // Prevent right-click
      img.addEventListener('contextmenu', e => {
        e.preventDefault();
        this.showPurchaseInfo();
        return false;
      });
      
      // Prevent drag-and-drop
      img.addEventListener('dragstart', e => {
        e.preventDefault();
        return false;
      });
      
      // Add invisible overlay to prevent selection
      const parent = img.parentNode;
      if (parent && !parent.querySelector('.selection-prevention')) {
        const overlay = document.createElement('div');
        overlay.className = 'selection-prevention';
        parent.appendChild(overlay);
      }
    });
    
    // 2. Add global event listener for context menu
    document.addEventListener('contextmenu', this.disableRightClick);
    
    // 3. Add CSS to prevent downloading
    this.addCSS(`
      .protected-gallery img {
        pointer-events: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      
      .selection-prevention {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10;
      }
    `);
  }
  
  // Show purchase info modal
  showPurchaseInfo() {
    // Create modal if it doesn't exist
    if (!document.querySelector('.purchase-modal')) {
      const modal = document.createElement('div');
      modal.className = 'purchase-modal';
      modal.innerHTML = `
        <div class="purchase-modal-content">
          <h3>Interested in this photo?</h3>
          <p>Contact the photographer to purchase or request high-resolution copies.</p>
          <button class="btn primary-btn close-purchase-modal">Close</button>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Add event listener to close button
      modal.querySelector('.close-purchase-modal').addEventListener('click', () => {
        modal.remove();
      });
      
      // Close when clicking outside modal content
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    }
  }
  
  // Apply watermarking to images
  applyWatermarking(photographerId) {
    // Get photographer info for watermark
    this.getPhotographerInfo(photographerId).then(photographerData => {
      const studioName = photographerData?.studioName || 'Photography Studio';
      
      // Apply watermark to all images in grid view
      document.querySelectorAll('.photo-container, .photo-item').forEach(container => {
        // Add watermark overlay if it doesn't exist
        if (!container.querySelector('.watermark-overlay')) {
          const watermark = document.createElement('div');
          watermark.className = 'watermark-overlay';
          watermark.textContent = `© ${studioName}`;
          container.appendChild(watermark);
        }
        
        // Add diagonal watermark banner for stronger protection if it doesn't exist
        if (!container.querySelector('.watermark-banner')) {
          const watermarkBanner = document.createElement('div');
          watermarkBanner.className = 'watermark-banner';
          watermarkBanner.textContent = `© ${studioName} - Protected`;
          container.appendChild(watermarkBanner);
        }
      });
      
      // Also apply watermark to lightbox if it exists
      if (this.photoWatermark) {
        this.photoWatermark.textContent = `© ${studioName}`;
        this.showElement(this.photoWatermark);
      }
      
      // Add CSS for watermarks
      this.addCSS(`
        .watermark-overlay {
          position: absolute;
          bottom: 10px;
          right: 10px;
          background-color: rgba(0, 0, 0, 0.5);
          color: white;
          padding: 5px 10px;
          font-size: 12px;
          border-radius: 3px;
          z-index: 5;
        }
        
        .watermark-banner {
          position: absolute;
          top: 0;
          left: 0;
          width: 150%;
          background-color: rgba(0, 0, 0, 0.3);
          color: white;
          padding: 5px 10px;
          font-size: 14px;
          transform: rotate(-45deg) translateY(-20px) translateX(-60px);
          transform-origin: top left;
          text-align: center;
          z-index: 5;
        }
      `);
    });
  }
  
  // Disable right-click on photos
  disableRightClick(e) {
    // Only disable on images or photo containers
    const isPhoto = e.target.tagName === 'IMG' || 
                   e.target.classList.contains('photo-container') ||
                   e.target.classList.contains('photo-list-thumbnail') ||
                   e.target.id === 'lightboxImage';
    
    if (isPhoto) {
      e.preventDefault();
      this.showPurchaseInfo();
      return false;
    }
  }
  
  // Add client selection functionality
  enhanceClientExperience() {
    // Add a selection button to each photo
    document.querySelectorAll('.photo-container').forEach(container => {
      if (!container.querySelector('.selection-button')) {
        const selectionButton = document.createElement('button');
        selectionButton.className = 'selection-button';
        selectionButton.innerHTML = '<i class="far fa-heart"></i>';
        selectionButton.title = 'Select this photo';
        
        selectionButton.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent opening the photo when clicking the button
          
          const photoId = container.closest('[data-photo-id]').getAttribute('data-photo-id');
          if (!photoId) return;
          
          this.togglePhotoSelection(photoId);
          
          if (this.selectedPhotos[photoId]) {
            selectionButton.innerHTML = '<i class="fas fa-heart"></i>';
            selectionButton.title = 'Remove selection';
          } else {
            selectionButton.innerHTML = '<i class="far fa-heart"></i>';
            selectionButton.title = 'Select this photo';
          }
        });
        
        container.appendChild(selectionButton);
      }
    });
    
    // Add selection counter to gallery actions
    const galleryActions = document.querySelector('.gallery-actions');
    if (galleryActions && !document.getElementById('selectionCounter')) {
      const selectionCounter = document.createElement('div');
      selectionCounter.className = 'selection-counter';
      selectionCounter.id = 'selectionCounter';
      selectionCounter.textContent = `${this.selectedCount} photos selected`;
      
      galleryActions.appendChild(selectionCounter);
    }
  }

/*----------------------------------------------
 * PART 4: Enhanced User Experience Features
 *----------------------------------------------*/

}

// Additional features and enhancements for the ClientGalleryViewer class

// Add social sharing functionality
ClientGalleryViewer.prototype.setupSocialSharing = function() {
  const shareButtons = document.querySelectorAll('.social-share-btn');
  
  if (!shareButtons.length) {
    // Create share buttons if they don't exist
    const shareContainer = document.createElement('div');
    shareContainer.className = 'social-share-container';
    shareContainer.innerHTML = `
      <p>Share this gallery:</p>
      <div class="social-buttons">
        <button class="social-share-btn facebook" title="Share on Facebook"><i class="fab fa-facebook-f"></i></button>
        <button class="social-share-btn twitter" title="Share on Twitter"><i class="fab fa-twitter"></i></button>
        <button class="social-share-btn email" title="Share via Email"><i class="fas fa-envelope"></i></button>
        <button class="social-share-btn copy" title="Copy Link"><i class="fas fa-link"></i></button>
      </div>
    `;
    
    const galleryHeader = document.querySelector('.gallery-header');
    if (galleryHeader) {
      galleryHeader.appendChild(shareContainer);
    } else {
      const galleryContainer = document.querySelector('.gallery-container');
      if (galleryContainer) {
        galleryContainer.prepend(shareContainer);
      }
    }
    
    // Add event listeners to new buttons
    this.addSocialShareEvents();
  } else {
    // Add event listeners to existing buttons
    this.addSocialShareEvents();
  }
};

// Add event listeners to social share buttons
ClientGalleryViewer.prototype.addSocialShareEvents = function() {
  const shareButtons = document.querySelectorAll('.social-share-btn');
  const galleryUrl = window.location.href;
  const galleryTitle = this.galleryData ? this.galleryData.name : 'Photo Gallery';
  
  shareButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (button.classList.contains('facebook')) {
        const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(galleryUrl)}`;
        window.open(fbShareUrl, 'facebook-share', 'width=580,height=296');
      }
      
      else if (button.classList.contains('twitter')) {
        const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this photo gallery: ' + galleryTitle)}&url=${encodeURIComponent(galleryUrl)}`;
        window.open(twitterShareUrl, 'twitter-share', 'width=550,height=235');
      }
      
      else if (button.classList.contains('email')) {
        const emailSubject = encodeURIComponent(galleryTitle);
        const emailBody = encodeURIComponent(`Check out this photo gallery: ${galleryUrl}`);
        window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
      }
      
      else if (button.classList.contains('copy')) {
        this.copyToClipboard(galleryUrl);
        this.showToast('success', 'Gallery link copied to clipboard!');
      }
    });
  });
};

// Helper method to copy text to clipboard
ClientGalleryViewer.prototype.copyToClipboard = function(text) {
  // Create temporary input element
  const input = document.createElement('input');
  input.style.position = 'fixed';
  input.style.opacity = 0;
  input.value = text;
  document.body.appendChild(input);
  input.select();
  
  // Copy text
  document.execCommand('copy');
  
  // Remove temporary element
  document.body.removeChild(input);
};

// Add commenting functionality for clients
ClientGalleryViewer.prototype.setupCommentingSystem = function() {
  if (!this.galleryData || !this.galleryData.allowComments) return;
  
  // Find or create comments container
  let commentsContainer = document.getElementById('photoCommentsContainer');
  
  if (!commentsContainer && this.photoLightbox) {
    commentsContainer = document.createElement('div');
    commentsContainer.id = 'photoCommentsContainer';
    commentsContainer.className = 'photo-comments-container';
    
    // Create comments interface
    commentsContainer.innerHTML = `
      <div class="comments-header">
        <h3>Comments</h3>
      </div>
      <div class="comments-list" id="photoCommentsList"></div>
      <div class="comment-form">
        <textarea id="commentText" placeholder="Add a comment or feedback about this photo..."></textarea>
        <button id="submitCommentBtn" class="btn primary-btn">Add Comment</button>
      </div>
    `;
    
    // Add to lightbox
    const lightboxContent = this.photoLightbox.querySelector('.lightbox-content');
    if (lightboxContent) {
      lightboxContent.appendChild(commentsContainer);
    } else {
      this.photoLightbox.appendChild(commentsContainer);
    }
    
    // Add event listener to comment button
    const submitBtn = document.getElementById('submitCommentBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.submitPhotoComment();
      });
    }
  }
};

// Load comments for the current photo
ClientGalleryViewer.prototype.loadPhotoComments = function() {
  if (!this.galleryData || !this.galleryData.allowComments) return;
  
  const photoId = this.photos[this.currentPhotoIndex]?.id;
  if (!photoId) return;
  
  const commentsList = document.getElementById('photoCommentsList');
  if (!commentsList) return;
  
  // Show loading indicator
  commentsList.innerHTML = '<div class="comments-loading">Loading comments...</div>';
  
  // Query comments for this photo
  this.db.collection('photo_comments')
    .where('photoId', '==', photoId)
    .where('galleryId', '==', this.galleryData.id)
    .orderBy('createdAt', 'desc')
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
        return;
      }
      
      // Clear loading indicator
      commentsList.innerHTML = '';
      
      // Add comments to the list
      snapshot.forEach(doc => {
        const comment = doc.data();
        const commentElement = document.createElement('div');
        commentElement.className = 'comment-item';
        
        const timestamp = comment.createdAt?.toDate 
          ? comment.createdAt.toDate().toLocaleString() 
          : 'Just now';
        
        commentElement.innerHTML = `
          <div class="comment-header">
            <span class="comment-author">${comment.author || 'Anonymous'}</span>
            <span class="comment-time">${timestamp}</span>
          </div>
          <div class="comment-content">${comment.text}</div>
        `;
        
        commentsList.appendChild(commentElement);
      });
    })
    .catch(error => {
      console.error('Error loading comments:', error);
      commentsList.innerHTML = '<div class="comments-error">Failed to load comments. Please try again.</div>';
    });
};

// Submit a comment for the current photo
ClientGalleryViewer.prototype.submitPhotoComment = function() {
  if (!this.galleryData || !this.galleryData.allowComments) return;
  
  const photoId = this.photos[this.currentPhotoIndex]?.id;
  if (!photoId) return;
  
  const commentText = document.getElementById('commentText');
  if (!commentText || !commentText.value.trim()) {
    this.showToast('error', 'Please enter a comment');
    return;
  }
  
  // Get author name
  let authorName = 'Guest';
  
  // If user is authenticated, use their name
  if (this.currentUser) {
    authorName = this.currentUser.displayName || 'User';
  } else {
    // Try to get name from selections form
    const nameInput = document.getElementById('submissionName');
    if (nameInput && nameInput.value.trim()) {
      authorName = nameInput.value.trim();
    }
  }
  
  // Create comment document
  this.db.collection('photo_comments').add({
    photoId: photoId,
    galleryId: this.galleryData.id,
    author: authorName,
    text: commentText.value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'pending' // Require approval if configured
  })
  .then(() => {
    this.showToast('success', 'Comment submitted successfully!');
    commentText.value = '';
    
    // Create notification for photographer
    this.db.collection('user_notifications')
      .doc(this.galleryData.photographerId)
      .collection('notifications')
      .add({
        type: 'new_comment',
        title: 'New Comment Received',
        message: `${authorName} commented on a photo in "${this.galleryData.name}"`,
        galleryId: this.galleryData.id,
        photoId: photoId,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
    // Reload comments
    this.loadPhotoComments();
  })
  .catch(error => {
    console.error('Error submitting comment:', error);
    this.showToast('error', 'Failed to submit comment. Please try again.');
  });
};

// Add favorites/bookmarking functionality
ClientGalleryViewer.prototype.setupFavoritesSystem = function() {
  // Load favorites from localStorage if available
  this.loadFavorites();
  
  // Add favorites button to lightbox if it doesn't exist
  if (this.photoLightbox && !this.photoLightbox.querySelector('.favorite-btn')) {
    const favBtn = document.createElement('button');
    favBtn.className = 'favorite-btn';
    favBtn.innerHTML = '<i class="far fa-star"></i>';
    favBtn.title = 'Add to favorites';
    
    // Add event listener
    favBtn.addEventListener('click', () => {
      const photoId = this.photos[this.currentPhotoIndex]?.id;
      if (!photoId) return;
      
      this.toggleFavorite(photoId);
    });
    
    // Add to lightbox controls
    const lightboxControls = this.photoLightbox.querySelector('.lightbox-controls');
    if (lightboxControls) {
      lightboxControls.appendChild(favBtn);
    }
  }
  
  // Add favorites list button to gallery actions
  const galleryActions = document.querySelector('.gallery-actions');
  if (galleryActions && !document.getElementById('favoritesBtn')) {
    const favoritesBtn = document.createElement('button');
    favoritesBtn.id = 'favoritesBtn';
    favoritesBtn.className = 'btn outline-btn';
    favoritesBtn.innerHTML = '<i class="fas fa-star"></i> My Favorites';
    
    favoritesBtn.addEventListener('click', () => {
      this.showFavoritesList();
    });
    
    galleryActions.appendChild(favoritesBtn);
  }
};

// Load favorites from localStorage
ClientGalleryViewer.prototype.loadFavorites = function() {
  const galleryId = this.galleryData?.id;
  if (!galleryId) return;
  
  // Initialize favorites object if it doesn't exist
  if (!this.favorites) {
    this.favorites = {};
  }
  
  // Load from localStorage
  try {
    const storedFavorites = localStorage.getItem(`gallery_favorites_${galleryId}`);
    if (storedFavorites) {
      this.favorites = JSON.parse(storedFavorites);
    }
  } catch (error) {
    console.error('Error loading favorites from localStorage:', error);
  }
};

// Save favorites to localStorage
ClientGalleryViewer.prototype.saveFavorites = function() {
  const galleryId = this.galleryData?.id;
  if (!galleryId) return;
  
  try {
    localStorage.setItem(
      `gallery_favorites_${galleryId}`, 
      JSON.stringify(this.favorites)
    );
  } catch (error) {
    console.error('Error saving favorites to localStorage:', error);
  }
};

// Toggle favorite status for a photo
ClientGalleryViewer.prototype.toggleFavorite = function(photoId) {
  if (!this.favorites) {
    this.favorites = {};
  }
  
  if (this.favorites[photoId]) {
    // Remove from favorites
    delete this.favorites[photoId];
    this.showToast('info', 'Removed from favorites');
  } else {
    // Add to favorites
    this.favorites[photoId] = true;
    this.showToast('success', 'Added to favorites');
  }
  
  // Save to localStorage
  this.saveFavorites();
  
  // Update UI
  this.updateFavoriteUI(photoId);
};
// Update favorite button UI
ClientGalleryViewer.prototype.updateFavoriteUI = function(photoId) {
  // Update lightbox favorite button
  const favoriteBtn = this.photoLightbox.querySelector('.favorite-btn');
  if (favoriteBtn) {
    if (this.favorites[photoId]) {
      favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
      favoriteBtn.title = 'Remove from favorites';
    } else {
      favoriteBtn.innerHTML = '<i class="far fa-star"></i>';
      favoriteBtn.title = 'Add to favorites';
    }
  }
  
  // Update grid/list view favorite indicators
  const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
  if (photoElement) {
    let favoriteIndicator = photoElement.querySelector('.favorite-indicator');
    
    if (this.favorites[photoId]) {
      if (!favoriteIndicator) {
        favoriteIndicator = document.createElement('div');
        favoriteIndicator.className = 'favorite-indicator';
        favoriteIndicator.innerHTML = '<i class="fas fa-star"></i>';
        
        const container = photoElement.querySelector('.photo-container') || 
                         photoElement.querySelector('.photo-list-thumbnail');
        
        if (container) {
          container.appendChild(favoriteIndicator);
        }
      }
    } else {
      if (favoriteIndicator) {
        favoriteIndicator.remove();
      }
    }
  }
};

// Show the favorites list
ClientGalleryViewer.prototype.showFavoritesList = function() {
  // Check if there are any favorites
  const favoriteIds = Object.keys(this.favorites || {});
  
  if (!favoriteIds.length) {
    this.showToast('info', 'You have no favorite photos yet');
    return;
  }
  
  // Create favorites modal if it doesn't exist
  let favoritesModal = document.getElementById('favoritesModal');
  
  if (!favoritesModal) {
    favoritesModal = document.createElement('div');
    favoritesModal.id = 'favoritesModal';
    favoritesModal.className = 'modal favorites-modal';
    
    favoritesModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>My Favorites</h2>
          <button class="close-modal-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div id="favoritesList" class="favorites-grid"></div>
        </div>
        <div class="modal-footer">
          <button id="clearFavoritesBtn" class="btn outline-btn">Clear All Favorites</button>
          <button id="closeFavoritesBtn" class="btn primary-btn">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(favoritesModal);
    
    // Add event listeners
    const closeBtn = favoritesModal.querySelector('.close-modal-btn');
    const closeModalBtn = document.getElementById('closeFavoritesBtn');
    const clearFavoritesBtn = document.getElementById('clearFavoritesBtn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideElement(favoritesModal);
      });
    }
    
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        this.hideElement(favoritesModal);
      });
    }
    
    if (clearFavoritesBtn) {
      clearFavoritesBtn.addEventListener('click', () => {
        this.clearAllFavorites();
      });
    }
  }
  
  // Populate favorites list
  this.populateFavoritesList();
  
  // Show modal
  this.showElement(favoritesModal);
};

// Populate the favorites list
ClientGalleryViewer.prototype.populateFavoritesList = function() {
  const favoritesList = document.getElementById('favoritesList');
  if (!favoritesList) return;
  
  // Clear list first
  favoritesList.innerHTML = '';
  
  // Get favorites IDs
  const favoriteIds = Object.keys(this.favorites || {});
  
  // Find favorite photos in the loaded photos
  const favoritePhotos = this.photos.filter(photo => favoriteIds.includes(photo.id));
  
  if (!favoritePhotos.length) {
    favoritesList.innerHTML = '<div class="no-favorites">No favorite photos found</div>';
    return;
  }
  
  // Create thumbnail for each favorite
  favoritePhotos.forEach(photo => {
    const thumbnailUrl = photo.thumbnails?.md || photo.url || '';
    
    const photoElement = document.createElement('div');
    photoElement.className = 'favorite-item';
    photoElement.setAttribute('data-photo-id', photo.id);
    photoElement.setAttribute('data-index', this.photos.indexOf(photo));
    
    photoElement.innerHTML = `
      <div class="favorite-thumbnail" style="background-image: url('${thumbnailUrl}')">
        <div class="favorite-actions">
          <button class="view-btn" title="View photo"><i class="fas fa-eye"></i></button>
          <button class="remove-favorite-btn" title="Remove from favorites"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
      <div class="favorite-name">${photo.name || 'Photo'}</div>
    `;
    
    // Add event listeners
    const viewBtn = photoElement.querySelector('.view-btn');
    const removeBtn = photoElement.querySelector('.remove-favorite-btn');
    
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        const index = parseInt(photoElement.getAttribute('data-index'));
        this.hideElement(document.getElementById('favoritesModal'));
        this.openLightbox(index);
      });
    }
    
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this.toggleFavorite(photo.id);
        photoElement.remove();
        
        // Check if there are any favorites left
        if (favoritesList.children.length === 0) {
          favoritesList.innerHTML = '<div class="no-favorites">No favorite photos found</div>';
        }
      });
    }
    
    // Add to favorites list
    favoritesList.appendChild(photoElement);
  });
};

// Clear all favorites
ClientGalleryViewer.prototype.clearAllFavorites = function() {
  // Ask for confirmation
  if (!confirm('Are you sure you want to clear all favorites?')) {
    return;
  }
  
  // Clear favorites
  this.favorites = {};
  this.saveFavorites();
  
  // Update UI
  const favoritesList = document.getElementById('favoritesList');
  if (favoritesList) {
    favoritesList.innerHTML = '<div class="no-favorites">No favorite photos found</div>';
  }
  
  // Remove all favorite indicators from the gallery
  document.querySelectorAll('.favorite-indicator').forEach(indicator => {
    indicator.remove();
  });
  
  this.showToast('info', 'All favorites have been cleared');
};

// Add slideshow functionality
ClientGalleryViewer.prototype.setupSlideshow = function() {
  // Add slideshow button to gallery actions
  const galleryActions = document.querySelector('.gallery-actions');
  if (galleryActions && !document.getElementById('slideshowBtn')) {
    const slideshowBtn = document.createElement('button');
    slideshowBtn.id = 'slideshowBtn';
    slideshowBtn.className = 'btn outline-btn';
    slideshowBtn.innerHTML = '<i class="fas fa-play"></i> Slideshow';
    
    slideshowBtn.addEventListener('click', () => {
      this.startSlideshow();
    });
    
    galleryActions.appendChild(slideshowBtn);
  }
  
  // Add slideshow controls to lightbox
  if (this.photoLightbox && !this.photoLightbox.querySelector('.slideshow-controls')) {
    const slideshowControls = document.createElement('div');
    slideshowControls.className = 'slideshow-controls hidden';
    
    slideshowControls.innerHTML = `
      <button id="slideshowPlayPauseBtn" class="btn icon-btn"><i class="fas fa-pause"></i></button>
      <div class="slideshow-speed">
        <label>Speed:</label>
        <select id="slideshowSpeed">
          <option value="2000">Fast (2s)</option>
          <option value="4000" selected>Normal (4s)</option>
          <option value="7000">Slow (7s)</option>
        </select>
      </div>
    `;
    
    // Add to lightbox
    const lightboxControls = this.photoLightbox.querySelector('.lightbox-controls');
    if (lightboxControls) {
      lightboxControls.appendChild(slideshowControls);
    }
    
    // Add event listener to play/pause button
    const playPauseBtn = document.getElementById('slideshowPlayPauseBtn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (this.slideshowActive) {
          this.pauseSlideshow();
        } else {
          this.resumeSlideshow();
        }
      });
    }
    
    // Add event listener to speed selector
    const speedSelector = document.getElementById('slideshowSpeed');
    if (speedSelector) {
      speedSelector.addEventListener('change', () => {
        this.slideshowSpeed = parseInt(speedSelector.value);
        
        if (this.slideshowActive) {
          // Restart timer with new speed
          this.pauseSlideshow();
          this.resumeSlideshow();
        }
      });
    }
  }
};

// Start slideshow
ClientGalleryViewer.prototype.startSlideshow = function() {
  // Open first photo in lightbox if not already open
  if (!this.photoLightbox || this.photoLightbox.classList.contains('hidden')) {
    this.openLightbox(0);
  }
  
  // Show slideshow controls
  const slideshowControls = this.photoLightbox.querySelector('.slideshow-controls');
  if (slideshowControls) {
    this.showElement(slideshowControls);
  }
  
  // Set slideshow speed from selector or default
  const speedSelector = document.getElementById('slideshowSpeed');
  this.slideshowSpeed = speedSelector ? parseInt(speedSelector.value) : 4000;
  
  // Start slideshow
  this.slideshowActive = true;
  
  // Update play/pause button
  const playPauseBtn = document.getElementById('slideshowPlayPauseBtn');
  if (playPauseBtn) {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  }
  
  // Start timer
  this.slideshowTimer = setTimeout(() => {
    this.slideshowNextPhoto();
  }, this.slideshowSpeed);
};

// Move to next photo in slideshow
ClientGalleryViewer.prototype.slideshowNextPhoto = function() {
  if (!this.slideshowActive) return;
  
  // Move to next photo
  if (this.currentPhotoIndex < this.photos.length - 1) {
    this.currentPhotoIndex++;
    this.updateLightbox();
    
    // Set timer for next photo
    this.slideshowTimer = setTimeout(() => {
      this.slideshowNextPhoto();
    }, this.slideshowSpeed);
  } else if (this.hasMorePhotos) {
    // Load more photos if available
    this.loadMorePhotos().then(() => {
      // Continue to next photo after loading
      if (this.currentPhotoIndex < this.photos.length - 1) {
        this.currentPhotoIndex++;
        this.updateLightbox();
        
        // Set timer for next photo
        this.slideshowTimer = setTimeout(() => {
          this.slideshowNextPhoto();
        }, this.slideshowSpeed);
      } else {
        // End of gallery, stop slideshow
        this.stopSlideshow();
      }
    });
  } else {
    // End of gallery, stop slideshow
    this.stopSlideshow();
  }
};

// Pause slideshow
ClientGalleryViewer.prototype.pauseSlideshow = function() {
  if (!this.slideshowActive) return;
  
  this.slideshowActive = false;
  
  // Clear timer
  if (this.slideshowTimer) {
    clearTimeout(this.slideshowTimer);
  }
  
  // Update play/pause button
  const playPauseBtn = document.getElementById('slideshowPlayPauseBtn');
  if (playPauseBtn) {
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  }
};

// Resume slideshow
ClientGalleryViewer.prototype.resumeSlideshow = function() {
  if (this.slideshowActive) return;
  
  this.slideshowActive = true;
  
  // Update play/pause button
  const playPauseBtn = document.getElementById('slideshowPlayPauseBtn');
  if (playPauseBtn) {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  }
  
  // Start timer for next photo
  this.slideshowTimer = setTimeout(() => {
    this.slideshowNextPhoto();
  }, this.slideshowSpeed);
};

// Stop slideshow
ClientGalleryViewer.prototype.stopSlideshow = function() {
  this.slideshowActive = false;
  
  // Clear timer
  if (this.slideshowTimer) {
    clearTimeout(this.slideshowTimer);
  }
  
  // Hide slideshow controls
  const slideshowControls = this.photoLightbox.querySelector('.slideshow-controls');
  if (slideshowControls) {
    this.hideElement(slideshowControls);
  }
  
  // Show end of slideshow message
  this.showToast('info', 'Slideshow finished');
};

// Override the close lightbox method to stop slideshow
const originalCloseLightbox = ClientGalleryViewer.prototype.closeLightbox;
ClientGalleryViewer.prototype.closeLightbox = function() {
  // Stop slideshow if active
  if (this.slideshowActive) {
    this.stopSlideshow();
  }
  
  // Call original method
  originalCloseLightbox.call(this);
};

// Add these CSS styles for the new features
ClientGalleryViewer.prototype.addFeatureStyles = function() {
  this.addCSS(`
    /* Social Sharing Styles */
    .social-share-container {
      margin: 15px 0;
      text-align: center;
    }
    
    .social-buttons {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-top: 5px;
    }
    
    .social-share-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    
    .social-share-btn:hover {
      transform: scale(1.1);
    }
    
    .social-share-btn.facebook {
      background-color: #3b5998;
    }
    
    .social-share-btn.twitter {
      background-color: #1da1f2;
    }
    
    .social-share-btn.email {
      background-color: #db4437;
    }
    
    .social-share-btn.copy {
      background-color: #333;
    }
    
    /* Comments Styles */
    .photo-comments-container {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    
    .comments-header h3 {
      margin-top: 0;
      margin-bottom: 15px;
    }
    
    .comments-list {
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 15px;
    }
    
    .comment-item {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    
    .comment-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 0.85em;
      color: #666;
    }
    
    .comment-author {
      font-weight: bold;
    }
    
    .comment-time {
      font-style: italic;
    }
    
    .comment-form textarea {
      width: 100%;
      min-height: 80px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 10px;
      font-family: inherit;
    }
    
    .no-comments, .comments-loading, .comments-error {
      padding: 20px;
      text-align: center;
      color: #666;
    }
    
    /* Favorites Styles */
    .favorite-btn {
      background: none;
      border: none;
      color: #fff;
      font-size: 20px;
      padding: 5px;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    
    .favorite-btn:hover {
      opacity: 1;
    }
    
    .favorite-indicator {
      position: absolute;
      top: 10px;
      right: 10px;
      color: gold;
      background-color: rgba(0, 0, 0, 0.5);
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      font-size: 14px;
    }
    .favorites-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        
        .favorite-item {
          position: relative;
        }
        
        .favorite-thumbnail {
          height: 150px;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }
        
        .favorite-name {
          margin-top: 5px;
          font-size: 14px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .favorite-actions {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .favorite-thumbnail:hover .favorite-actions {
          opacity: 1;
        }
        
        .favorite-actions button {
          background-color: #fff;
          color: #333;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .favorite-actions button:hover {
          transform: scale(1.1);
        }
        
        .favorite-actions .remove-favorite-btn {
          background-color: #ff4d4d;
          color: white;
        }
        
        .no-favorites {
          grid-column: 1 / -1;
          text-align: center;
          padding: 20px;
          color: #666;
        }
        
        /* Slideshow Styles */
        .slideshow-controls {
          display: flex;
          align-items: center;
          margin-left: 15px;
        }
        
        .slideshow-speed {
          display: flex;
          align-items: center;
          margin-left: 10px;
        }
        
        .slideshow-speed label {
          margin-right: 5px;
          color: #fff;
        }
        
        .slideshow-speed select {
          background-color: rgba(255, 255, 255, 0.2);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 3px;
          padding: 5px;
        }
      `);
    };
    
    // Add accessibility enhancements
    ClientGalleryViewer.prototype.enhanceAccessibility = function() {
      // Add ARIA labels to interactive elements
      document.querySelectorAll('.photo-item, .photo-list-item').forEach(item => {
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', 'View photo ' + (item.querySelector('.photo-name')?.textContent || ''));
        item.setAttribute('tabindex', '0');
        
        // Add keyboard support
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const index = parseInt(item.getAttribute('data-index'));
            this.openLightbox(index);
          }
        });
      });
      
      // Make lightbox controls accessible
      if (this.photoLightbox) {
        const controls = this.photoLightbox.querySelectorAll('button');
        controls.forEach(button => {
          if (!button.getAttribute('aria-label')) {
            let label = '';
            
            if (button.classList.contains('close-lightbox-btn')) {
              label = 'Close lightbox';
            } else if (button.classList.contains('prev-photo-btn')) {
              label = 'Previous photo';
            } else if (button.classList.contains('next-photo-btn')) {
              label = 'Next photo';
            } else if (button.classList.contains('select-photo-btn')) {
              label = 'Select this photo';
            } else if (button.classList.contains('deselect-photo-btn')) {
              label = 'Deselect this photo';
            }
            
            if (label) {
              button.setAttribute('aria-label', label);
            }
          }
        });
        
        // Add trap focus within lightbox when open
        this.trapFocusInLightbox();
      }
      
      // Add high contrast mode option
      this.addHighContrastMode();
    };
    
    // Trap focus within lightbox
    ClientGalleryViewer.prototype.trapFocusInLightbox = function() {
      if (!this.photoLightbox) return;
      
      const focusableElements = this.photoLightbox.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // Handle tab key to trap focus
      this.photoLightbox.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        
        if (e.shiftKey) {
          // Shift + Tab: going backward
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: going forward
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      });
      
      // Auto-focus first element when lightbox opens
      const originalOpenLightbox = this.openLightbox;
      this.openLightbox = function(index) {
        originalOpenLightbox.call(this, index);
        
        // Focus first focusable element after a short delay
        setTimeout(() => {
          firstElement.focus();
        }, 100);
      };
    };
    
    // Add high contrast mode
    ClientGalleryViewer.prototype.addHighContrastMode = function() {
      // Add option to customize panel
      const customizeBody = document.querySelector('.customize-body');
      if (customizeBody && !document.getElementById('highContrastToggle')) {
        const highContrastOption = document.createElement('div');
        highContrastOption.className = 'customize-option';
        
        highContrastOption.innerHTML = `
          <label>High Contrast Mode:</label>
          <input type="checkbox" id="highContrastToggle">
        `;
        
        customizeBody.appendChild(highContrastOption);
        
        // Add event listener
        const highContrastToggle = document.getElementById('highContrastToggle');
        if (highContrastToggle) {
          // Load saved setting if available
          const savedHighContrast = localStorage.getItem('gallery_high_contrast');
          if (savedHighContrast !== null) {
            const highContrast = savedHighContrast === 'true';
            highContrastToggle.checked = highContrast;
            this.applyHighContrast(highContrast);
          }
          
          highContrastToggle.addEventListener('change', () => {
            const highContrast = highContrastToggle.checked;
            this.applyHighContrast(highContrast);
            localStorage.setItem('gallery_high_contrast', highContrast);
          });
        }
      }
    };
    
    // Apply high contrast mode
    ClientGalleryViewer.prototype.applyHighContrast = function(enabled) {
      if (enabled) {
        document.body.classList.add('high-contrast');
        
        this.addCSS(`
          body.high-contrast {
            --bg-color: #000000;
            --text-color: #ffffff;
            --accent-color: #ffff00;
            --border-color: #ffffff;
            --header-bg: #000000;
            --card-bg: #000000;
            --card-shadow: 0 0 0 1px #ffffff;
          }
          
          body.high-contrast .btn.primary-btn {
            background-color: #ffff00;
            color: #000000;
          }
          
          body.high-contrast .btn.outline-btn {
            border-color: #ffff00;
            color: #ffff00;
          }
          
          body.high-contrast .photo-overlay {
            background-color: rgba(0, 0, 0, 0.8);
          }
          
          body.high-contrast .photo-info {
            color: #ffffff;
          }
          
          body.high-contrast .lightbox-controls button {
            background-color: #000000;
            color: #ffffff;
            border: 1px solid #ffffff;
          }
        `);
      } else {
        document.body.classList.remove('high-contrast');
      }
    };
    
    // Initialize accessibility enhancements
    const originalRenderPhotos = ClientGalleryViewer.prototype.renderPhotos;
    ClientGalleryViewer.prototype.renderPhotos = function() {
      // Call original method
      originalRenderPhotos.call(this);
      
      // Add accessibility enhancements
      setTimeout(() => {
        this.enhanceAccessibility();
      }, 100);
    };
    
    // Add offline support
    ClientGalleryViewer.prototype.setupOfflineSupport = function() {
      // Check if browser supports Service Worker
      if ('serviceWorker' in navigator) {
        // Register service worker
        navigator.serviceWorker.register('/gallery-service-worker.js')
          .then(registration => {
            console.log('Gallery Service Worker registered with scope:', registration.scope);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
        
        // Listen for network status changes
        window.addEventListener('online', () => {
          this.showToast('success', 'You are back online');
          this.updateOfflineStatus(false);
        });
        
        window.addEventListener('offline', () => {
          this.showToast('warning', 'You are now offline. Some features may be limited.');
          this.updateOfflineStatus(true);
        });
        
        // Check initial status
        if (!navigator.onLine) {
          this.updateOfflineStatus(true);
        }
      }
    };
    
    // Update UI for offline status
    ClientGalleryViewer.prototype.updateOfflineStatus = function(isOffline) {
      // Add/remove offline indicator
      let offlineIndicator = document.getElementById('offlineIndicator');
      
      if (isOffline) {
        if (!offlineIndicator) {
          offlineIndicator = document.createElement('div');
          offlineIndicator.id = 'offlineIndicator';
          offlineIndicator.className = 'offline-indicator';
          offlineIndicator.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline Mode';
          
          document.body.appendChild(offlineIndicator);
        }
        
        // Disable features that require online
        this.disableOnlineFeatures();
      } else {
        if (offlineIndicator) {
          offlineIndicator.remove();
        }
        
        // Re-enable online features
        this.enableOnlineFeatures();
      }
      
      // Add CSS for offline indicator
      this.addCSS(`
        .offline-indicator {
          position: fixed;
          top: 10px;
          right: 10px;
          background-color: #f44336;
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 9999;
        }
      `);
    };
    
    // Disable features that require online connection
    ClientGalleryViewer.prototype.disableOnlineFeatures = function() {
      // Disable submission form
      const submitBtn = document.getElementById('submitSelectionsBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = 'You need to be online to submit selections';
      }
      
      // Disable commenting
      const commentForm = document.querySelector('.comment-form');
      if (commentForm) {
        const commentInput = commentForm.querySelector('textarea');
        const commentBtn = commentForm.querySelector('button');
        
        if (commentInput) commentInput.disabled = true;
        if (commentBtn) commentBtn.disabled = true;
        
        commentForm.title = 'You need to be online to add comments';
      }
      
      // Add offline notice to forms
      const forms = document.querySelectorAll('form');
      forms.forEach(form => {
        let offlineNotice = form.querySelector('.offline-notice');
        
        if (!offlineNotice) {
          offlineNotice = document.createElement('div');
          offlineNotice.className = 'offline-notice';
          offlineNotice.innerHTML = 'Some features are unavailable while offline';
          form.appendChild(offlineNotice);
        }
      });
    };
    
    // Re-enable online features
    ClientGalleryViewer.prototype.enableOnlineFeatures = function() {
      // Enable submission form
      const submitBtn = document.getElementById('submitSelectionsBtn');
      if (submitBtn) {
        submitBtn.disabled = this.selectedCount === 0;
        submitBtn.title = 'Submit your selections';
      }
      
      // Enable commenting
      const commentForm = document.querySelector('.comment-form');
      if (commentForm) {
        const commentInput = commentForm.querySelector('textarea');
        const commentBtn = commentForm.querySelector('button');
        
        if (commentInput) commentInput.disabled = false;
        if (commentBtn) commentBtn.disabled = false;
        
        commentForm.title = '';
      }
      
      // Remove offline notices
      document.querySelectorAll('.offline-notice').forEach(notice => {
        notice.remove();
      });
    };
    
    // Add analytics tracking
    ClientGalleryViewer.prototype.trackUserActivity = function() {
      // Only track if analytics is enabled in gallery settings
      if (!this.galleryData || !this.galleryData.enableAnalytics) {
        return;
      }
      
      const galleryId = this.galleryData.id;
      const shareId = this.sharedGallery ? this.sharedGallery.id : null;
      
      if (!galleryId || !shareId) {
        return;
      }
      
      // Create activity tracker
      this.activityTracker = {
        sessionStartTime: Date.now(),
        photoViews: {},
        totalTimeSpent: 0,
        selectionChanges: 0,
        lightboxOpens: 0,
        searches: 0,
        lastUpdateTime: Date.now()
      };
      
      // Setup periodic updates
      this.activityUpdateInterval = setInterval(() => {
        // Update total time spent
        const now = Date.now();
        const timeSinceLastUpdate = now - this.activityTracker.lastUpdateTime;
        
        this.activityTracker.totalTimeSpent += timeSinceLastUpdate;
        this.activityTracker.lastUpdateTime = now;
        
        // Send update to Firestore
        this.updateActivityData();
      }, 60000); // Update every minute
      
      // Track lightbox opens
      const originalOpenLightbox = this.openLightbox;
      this.openLightbox = function(index) {
        originalOpenLightbox.call(this, index);
        
        // Track activity
        this.activityTracker.lightboxOpens++;
        
        // Track photo view
        const photoId = this.photos[index] ? this.photos[index].id : null;
        if (photoId) {
          if (!this.activityTracker.photoViews[photoId]) {
            this.activityTracker.photoViews[photoId] = 0;
          }
          this.activityTracker.photoViews[photoId]++;
        }
      };
      
      // Track selections
      const originalTogglePhotoSelection = this.togglePhotoSelection;
      this.togglePhotoSelection = function(photoId, forceState) {
        originalTogglePhotoSelection.call(this, photoId, forceState);
        
        // Track activity
        this.activityTracker.selectionChanges++;
      };
      
      // Track searches
      const originalHandleSearch = this.handleSearch;
      this.handleSearch = function(e) {
        originalHandleSearch.call(this, e);
        
        // Track activity
        if (e.target.value.trim().length > 0) {
          this.activityTracker.searches++;
        }
      };
      
      // Send final update when leaving page
      window.addEventListener('beforeunload', () => {
        this.endActivityTracking();
      });
    };
    
    // Update activity data in Firestore
    ClientGalleryViewer.prototype.updateActivityData = function() {
      if (!this.activityTracker) return;
      
      const galleryId = this.galleryData.id;
      const shareId = this.sharedGallery.id;
      
      // Calculate session duration
      const sessionDuration = Math.floor((Date.now() - this.activityTracker.sessionStartTime) / 1000);
      
      // Prepare activity data
      const activityData = {
        galleryId: galleryId,
        shareId: shareId,
        sessionDuration: sessionDuration,
        photoViews: this.activityTracker.photoViews,
        totalTimeSpent: Math.floor(this.activityTracker.totalTimeSpent / 1000),
        selectionChanges: this.activityTracker.selectionChanges,
        lightboxOpens: this.activityTracker.lightboxOpens,
        searches: this.activityTracker.searches,
        clientInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        },
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Send to Firestore
      this.db.collection('gallery_analytics').add(activityData)
        .catch(error => {
          console.error('Error updating activity data:', error);
        });
    };
    
    // End activity tracking
    ClientGalleryViewer.prototype.endActivityTracking = function() {
      if (!this.activityTracker) return;
      
      // Clear update interval
      if (this.activityUpdateInterval) {
        clearInterval(this.activityUpdateInterval);
      }
      
      // Send final update
      this.updateActivityData();
    };
    
    // Initialize activity tracking when gallery data is loaded
    const originalLoadPhotos = ClientGalleryViewer.prototype.loadPhotos;
    ClientGalleryViewer.prototype.loadPhotos = function() {
      // Call original method
      originalLoadPhotos.call(this);
      
      // Initialize activity tracking
      this.trackUserActivity();
    };
    
    // Add keyboard shortcuts
    ClientGalleryViewer.prototype.setupKeyboardShortcuts = function() {
      // Add keyboard shortcuts button to gallery actions
      const galleryActions = document.querySelector('.gallery-actions');
      if (galleryActions && !document.getElementById('keyboardHintsBtn')) {
        const keyboardBtn = document.createElement('button');
        keyboardBtn.id = 'keyboardHintsBtn';
        keyboardBtn.className = 'btn outline-btn keyboard-hints-btn';
        keyboardBtn.innerHTML = '<i class="fas fa-keyboard"></i>';
        keyboardBtn.title = 'Keyboard Shortcuts';
        
        keyboardBtn.addEventListener('click', () => {
          this.showKeyboardShortcuts();
        });
        
        galleryActions.appendChild(keyboardBtn);
      }
      
      // Add global keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Don't activate shortcuts if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          return;
        }
        
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
          // Show keyboard shortcuts
          e.preventDefault();
          this.showKeyboardShortcuts();
        } else if (e.key === 'g') {
          // Toggle grid/list view
          e.preventDefault();
          this.setViewMode(this.viewMode === 'grid' ? 'list' : 'grid');
        } else if (e.key === 's') {
          // Start slideshow
          e.preventDefault();
          this.startSlideshow();
        } else if (e.key === 'f') {
          // Focus search
          e.preventDefault();
          if (this.searchInput) {
            this.searchInput.focus();
          }
        }
      });
    };
    
    // Show keyboard shortcuts modal
    ClientGalleryViewer.prototype.showKeyboardShortcuts = function() {
      // Create modal if it doesn't exist
      if (!document.querySelector('.keyboard-shortcuts-modal')) {
        const modal = document.createElement('div');
        modal.className = 'modal keyboard-shortcuts-modal';
        
        modal.innerHTML = `
          <div class="modal-content">
            <div class="modal-header">
              <h2>Keyboard Shortcuts</h2>
              <button class="close-modal-btn">&times;</button>
            </div>
            <div class="modal-body">
              <div class="shortcuts-list">
                <div class="shortcut-item">
                  <div class="shortcut-key">?</div>
                  <div class="shortcut-desc">Show keyboard shortcuts</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">G</div>
                  <div class="shortcut-desc">Toggle grid/list view</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">S</div>
                  <div class="shortcut-desc">Start slideshow</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">F</div>
                  <div class="shortcut-desc">Focus search</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">→</div>
                  <div class="shortcut-desc">Next photo (in lightbox)</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">←</div>
                  <div class="shortcut-desc">Previous photo (in lightbox)</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">Space</div>
                  <div class="shortcut-desc">Toggle selection (in lightbox)</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">Esc</div>
                  <div class="shortcut-desc">Close lightbox</div>
                </div>
                ${this.galleryData && this.galleryData.allowComments ? `
                <div class="shortcut-item">
                  <div class="shortcut-key">C</div>
                  <div class="shortcut-desc">Focus comment box</div>
                </div>` : ''}
                <div class="shortcut-item">
                  <div class="shortcut-key">P</div>
                  <div class="shortcut-desc">Print current photo</div>
                </div>
                <div class="shortcut-item">
                  <div class="shortcut-key">D</div>
                  <div class="shortcut-desc">Download current photo</div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn primary-btn close-shortcuts-btn">Got it</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal-btn');
        const closeModalBtn = modal.querySelector('.close-shortcuts-btn');
        
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            modal.remove();
          });
        }
        
        if (closeModalBtn) {
          closeModalBtn.addEventListener('click', () => {
            modal.remove();
          });
        }
        
        // Add CSS for keyboard shortcuts modal
        this.addCSS(`
          .keyboard-shortcuts-modal .modal-content {
            max-width: 500px;
          }
          
          .shortcuts-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
          }
          
          .shortcut-item {
            display: flex;
            align-items: center;
            padding: 8px 0;
          }
          
          .shortcut-key {
            background-color: #f1f1f1;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 5px 8px;
            margin-right: 10px;
            font-family: monospace;
            font-weight: bold;
            min-width: 30px;
            text-align: center;
          }
          
          body.theme-dark .shortcut-key {
            background-color: #333;
            border-color: #444;
          }
          
          .keyboard-hints-btn {
            margin-left: auto;
          }
        `);
      }
    };
    
    // Initialize features
    ClientGalleryViewer.prototype.initializeExtendedFeatures = function() {
      // Setup extended features
      this.setupSocialSharing();
      this.setupCommentingSystem();
      this.setupFavoritesSystem();
      this.setupSlideshow();
      this.setupKeyboardShortcuts();
      
      // Add styles for all features
      this.addFeatureStyles();
      
      // Initialize offline support
      this.setupOfflineSupport();
      
      // Initialize accessibility enhancements
      this.enhanceAccessibility();
    };
    
    // Override original loadGalleryInfo to add extended features
    const originalLoadGalleryInfo = ClientGalleryViewer.prototype.loadGalleryInfo;
    ClientGalleryViewer.prototype.loadGalleryInfo = function() {
      // Call original method
      originalLoadGalleryInfo.call(this);
      
      // Initialize extended features after gallery info is loaded
      setTimeout(() => {
        this.initializeExtendedFeatures();
      }, 500);
    };
    
    // Initialize gallery viewer on document ready
    document.addEventListener('DOMContentLoaded', function() {
      window.galleryViewer = new ClientGalleryViewer();
    });
    
    // Export ClientGalleryViewer if using modules
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = ClientGalleryViewer;
    }
