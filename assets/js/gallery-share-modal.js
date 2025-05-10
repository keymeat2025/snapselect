// assets/js/gallery-share-modal.js
// Gallery Share Modal implementation
const GalleryShareModal = {
  currentGalleryId: null,
  
  initialize: function() {
    console.log("Initializing Gallery Share Modal");
    this.setupEventListeners();
  },
  
  setupEventListeners: function() {
    // Get form elements
    const shareForm = document.getElementById('shareSettingsForm');
    const passwordToggle = document.getElementById('passwordProtection');
    const passwordSection = document.getElementById('passwordSection');
    const revokeBtn = document.getElementById('revokeAccessBtn');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    
    // Setup form submission
    if (shareForm) {
      shareForm.addEventListener('submit', function(e) {
        e.preventDefault();
        GalleryShareModal.shareGallery();
      });
    }
    
    // Setup password toggle
    if (passwordToggle && passwordSection) {
      passwordToggle.addEventListener('change', function() {
        if (this.checked) {
          passwordSection.classList.remove('hidden');
        } else {
          passwordSection.classList.add('hidden');
        }
      });
    }
    
    // Setup revoke button
    if (revokeBtn) {
      revokeBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to revoke access to this gallery?')) {
          GalleryShareModal.revokeAccess();
        }
      });
    }
    
    // Setup copy link button
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', function() {
        const urlInput = document.getElementById('shareUrlDisplay');
        if (urlInput) {
          urlInput.select();
          document.execCommand('copy');
          showToast('Link copied to clipboard!', 'success');
        }
      });
    }
  },
  
  open: function(galleryData) {
    console.log("Opening share modal for gallery:", galleryData);
    this.currentGalleryId = galleryData.id;
    
    const modal = document.getElementById('shareGalleryModal');
    if (modal) {
      modal.style.display = 'block';
      this.checkSharingStatus();
    } else {
      console.error("Share gallery modal not found");
    }
  },
  
  checkSharingStatus: function() {
    console.log("Checking sharing status for gallery:", this.currentGalleryId);
    
    // Get Firestore instance from firebaseServices
    const db = window.firebaseServices.db;
    
    // Check if gallery is already shared
    db.collection('sharedGalleries').where('galleryId', '==', this.currentGalleryId)
      .get()
      .then(snapshot => {
        console.log("Found shared gallery entries:", snapshot.size);
        
        if (!snapshot.empty) {
          // Gallery is already shared, show the URL
          const shareData = snapshot.docs[0].data();
          this.displayShareLink(shareData.shareId);
          
          // Show revoke button
          const revokeBtn = document.getElementById('revokeAccessBtn');
          if (revokeBtn) {
            revokeBtn.classList.remove('hidden');
          }
        }
      })
      .catch(error => {
        console.error("Error checking sharing status:", error);
      });
  },
  
  displayShareLink: function(shareId) {
    console.log("Displaying share link for shareId:", shareId);
    
    const shareUrl = `${window.location.origin}/pages/html/shared-gallery-view.html?id=${shareId}`;
    const urlDisplay = document.getElementById('shareUrlDisplay');
    
    if (urlDisplay) {
      urlDisplay.value = shareUrl;
      const shareLinkSection = document.getElementById('shareLinkSection');
      if (shareLinkSection) {
        shareLinkSection.classList.remove('hidden');
      }
    }
  },
  
  shareGallery: function() {
    console.log("Sharing gallery:", this.currentGalleryId);
    
    // Get form values
    const passwordInput = document.getElementById('password');
    const passwordProtectionCheckbox = document.getElementById('passwordProtection');
    
    if (!passwordInput || !passwordProtectionCheckbox) {
      console.error("Password input elements not found");
      return;
    }
    
    const password = passwordInput.value;
    const passwordProtected = passwordProtectionCheckbox.checked;
    
    // Generate a random shareId
    const shareId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Get Firestore instance from firebaseServices
    const db = window.firebaseServices.db;
    
    // Save sharing info to Firestore
    db.collection('sharedGalleries').add({
      galleryId: this.currentGalleryId,
      shareId: shareId,
      passwordProtected: passwordProtected,
      password: passwordProtected ? password : '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      console.log("Gallery shared successfully with shareId:", shareId);
      this.displayShareLink(shareId);
      
      // Show revoke button
      const revokeBtn = document.getElementById('revokeAccessBtn');
      if (revokeBtn) {
        revokeBtn.classList.remove('hidden');
      }
      
      // Show success message
      showToast('Gallery shared successfully!', 'success');
    })
    .catch(error => {
      console.error('Error sharing gallery:', error);
      showToast('Error sharing gallery. Please try again.', 'error');
    });
  },
  
  revokeAccess: function() {
    console.log("Revoking access for gallery:", this.currentGalleryId);
    
    // Get Firestore instance from firebaseServices
    const db = window.firebaseServices.db;
    
    // Find and delete all sharing records for this gallery
    db.collection('sharedGalleries').where('galleryId', '==', this.currentGalleryId)
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          // Delete all sharing records for this gallery
          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          return batch.commit();
        }
      })
      .then(() => {
        // Hide share elements
        const shareLinkSection = document.getElementById('shareLinkSection');
        const revokeBtn = document.getElementById('revokeAccessBtn');
        if (shareLinkSection) shareLinkSection.classList.add('hidden');
        if (revokeBtn) revokeBtn.classList.add('hidden');
        
        // Show success message
        showToast('Gallery access revoked.', 'success');
      })
      .catch(error => {
        console.error('Error revoking access:', error);
        showToast('Error revoking access. Please try again.', 'error');
      });
  }
};

// Toast notification helper
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.add('fadeOut');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Initialize the module when Firebase is ready
function initGalleryShareModal() {
  GalleryShareModal.initialize();
  window.GalleryShareModal = GalleryShareModal;
  console.log("Gallery Share Modal initialized and exported to window");
}

// Register with Firebase ready system following your established pattern
if (window.firebaseServices && window.firebaseServices.db) {
  // Firebase already initialized
  console.log('Firebase services available, initializing gallery share modal');
  initGalleryShareModal();
} else if (typeof window.onFirebaseReady === 'function') {
  // Firebase ready with callback function
  window.onFirebaseReady(initGalleryShareModal);
} else if (Array.isArray(window.onFirebaseReady)) {
  // Firebase not ready yet, register with queue
  window.onFirebaseReady.push(initGalleryShareModal);
} else {
  // Create the queue if it doesn't exist
  window.onFirebaseReady = [initGalleryShareModal];
  console.log('Created Firebase ready queue with gallery share modal initialization');
}
