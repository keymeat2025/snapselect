// assets/js/gallery-share-modal.js

// Initialize when Firebase is ready
function initGalleryShareModal() {
  const GalleryShareModal = {
    currentGalleryId: null,
    
    open: function(galleryData) {
      this.currentGalleryId = galleryData.id;
      const modal = document.getElementById('shareGalleryModal');
      if (modal) {
        modal.style.display = 'block';
        
        // Check if gallery is already shared
        this.checkSharingStatus();
      } else {
        console.error("Share gallery modal not found in the DOM");
      }
    },
    
    checkSharingStatus: function() {
      // Check Firestore to see if gallery is already shared
      const db = window.firebaseServices.db;
      db.collection('sharedGalleries').where('galleryId', '==', this.currentGalleryId)
        .get()
        .then(snapshot => {
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
      const shareUrl = `${window.location.origin}/pages/html/shared-gallery-view.html?id=${shareId}`;
      const urlDisplay = document.getElementById('shareUrlDisplay');
      if (urlDisplay) {
        urlDisplay.value = shareUrl;
        const shareLinkSection = document.getElementById('shareLinkSection');
        if (shareLinkSection) {
          shareLinkSection.classList.remove('hidden');
        }
      } else {
        console.error("Share URL display element not found");
      }
    },
    
    shareGallery: function() {
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
      
      console.log("Sharing gallery with ID:", this.currentGalleryId);
      console.log("Password protected:", passwordProtected);
      
      // Save sharing info to Firestore
      const db = window.firebaseServices.db;
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
      const db = window.firebaseServices.db;
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
          const shareLinkSection = document.getElementById('shareLinkSection');
          const revokeBtn = document.getElementById('revokeAccessBtn');
          if (shareLinkSection) shareLinkSection.classList.add('hidden');
          if (revokeBtn) revokeBtn.classList.add('hidden');
          showToast('Gallery access revoked.', 'success');
        })
        .catch(error => {
          console.error('Error revoking access:', error);
          showToast('Error revoking access. Please try again.', 'error');
        });
    }
  };

  // Initialize event listeners
  const shareForm = document.getElementById('shareSettingsForm');
  const passwordToggle = document.getElementById('passwordProtection');
  const passwordSection = document.getElementById('passwordSection');
  const revokeBtn = document.getElementById('revokeAccessBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  
  if (shareForm) {
    shareForm.addEventListener('submit', function(e) {
      e.preventDefault();
      GalleryShareModal.shareGallery();
    });
  }
  
  if (passwordToggle) {
    passwordToggle.addEventListener('change', function() {
      if (this.checked && passwordSection) {
        passwordSection.classList.remove('hidden');
      } else if (passwordSection) {
        passwordSection.classList.add('hidden');
      }
    });
  }
  
  if (revokeBtn) {
    revokeBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to revoke access to this gallery?')) {
        GalleryShareModal.revokeAccess();
      }
    });
  }
  
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

  // Export the module
  window.GalleryShareModal = GalleryShareModal;
  console.log("Gallery Share Modal module initialized");
}

// Helper function to show toast notifications
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

// Register initialization with Firebase ready system
if (window.firebaseServices && window.firebaseServices.db) {
  // Firebase already initialized
  console.log('Firebase already available, initializing gallery share modal');
  initGalleryShareModal();
} else if (typeof window.onFirebaseReady === 'function') {
  // Firebase ready but we missed the initialization event
  console.log('Firebase initialized with callback function, registering gallery share modal init');
  window.onFirebaseReady(initGalleryShareModal);
} else if (Array.isArray(window.onFirebaseReady)) {
  // Firebase not ready yet
  console.log('Firebase not ready, queuing gallery share modal initialization');
  window.onFirebaseReady.push(initGalleryShareModal);
} else {
  // Create the queue if it doesn't exist
  console.log('Creating Firebase ready queue with gallery share modal initialization');
  window.onFirebaseReady = [initGalleryShareModal];
}
