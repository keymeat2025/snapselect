// assets/js/gallery-share-modal.js

// Gallery Share Modal
const GalleryShareModal = {
  currentGalleryId: null,
  
  // Initialize the modal
  initialize: function() {
    this.setupEventListeners();
    console.log("Gallery Share Modal initialized");
  },
  
  // Set up event listeners
  setupEventListeners: function() {
    // Share form submission
    const shareForm = document.getElementById('shareSettingsForm');
    if (shareForm) {
      shareForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.shareGallery();
      });
    }
    
    // Password toggle
    const passwordToggle = document.getElementById('passwordProtection');
    const passwordSection = document.getElementById('passwordSection');
    if (passwordToggle && passwordSection) {
      passwordToggle.addEventListener('change', function() {
        if (this.checked) {
          passwordSection.classList.remove('hidden');
        } else {
          passwordSection.classList.add('hidden');
        }
      });
    }
    
    // Copy link button
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const urlInput = document.getElementById('shareUrlDisplay');
        if (urlInput) {
          urlInput.select();
          document.execCommand('copy');
          this.showToast('Link copied to clipboard!', 'success');
        }
      });
    }
    
    // Revoke access button
    const revokeBtn = document.getElementById('revokeAccessBtn');
    if (revokeBtn) {
      revokeBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to revoke access to this gallery?')) {
          this.revokeAccess();
        }
      });
    }
  },
  
  // Open the modal for a gallery
  open: function(galleryData) {
    console.log("Opening share modal for gallery:", galleryData);
    
    // Store the gallery ID
    this.currentGalleryId = galleryData.id;
    
    // Show the modal
    const modal = document.getElementById('shareGalleryModal');
    if (modal) {
      modal.style.display = 'block';
      
      // Check if gallery is already shared
      this.checkSharingStatus();
    }
  },
  
  // Check if gallery is already shared
  checkSharingStatus: function() {
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        console.error("No authenticated user found");
        this.showToast("Please log in to share galleries", "error");
        return;
      }
      
      // Use photographerId and galleryId combination for more secure sharing
      db.collection('galleryShares')
        .where('galleryId', '==', this.currentGalleryId)
        .where('photographerId', '==', currentUser.uid)
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
          this.showToast('Error checking share status.', 'error');
        });
    } catch (error) {
      console.error("Firebase not available:", error);
      this.showToast('Error: Firebase not initialized.', 'error');
    }
  },
  
  // Display share link for a gallery
  displayShareLink: function(shareId) {
    // Create the URL to the client gallery view page with share parameter
    const shareUrl = `${window.location.origin}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
    
    // Update the UI
    const urlDisplay = document.getElementById('shareUrlDisplay');
    if (urlDisplay) {
      urlDisplay.value = shareUrl;
      
      // Show the share link section
      const shareLinkSection = document.getElementById('shareLinkSection');
      if (shareLinkSection) {
        shareLinkSection.classList.remove('hidden');
      }
    }
  },
  
  // Share a gallery
  
  shareGallery: function() {
      try {
          // Get form values
          const passwordInput = document.getElementById('password');
          const passwordProtectionCheckbox = document.getElementById('passwordProtection');
          
          if (!passwordInput || !passwordProtectionCheckbox) {
              console.error("Password input elements not found");
              return;
          }
          
          const password = passwordInput.value;
          const passwordProtected = passwordProtectionCheckbox.checked;
          
          // Validation for password protected galleries
          if (passwordProtected && !password) {
              this.showToast('Please enter a password for your protected gallery.', 'error');
              return;
          }
          
          // Generate a random share ID
          const shareId = Math.random().toString(36).substring(2, 15);
          
          // Save to Firestore - use the collection name that matches your database
          const db = firebase.firestore();
          const self = this; // Store reference to 'this' for use in promise callbacks
          
          // Make sure to log the gallery ID and share ID
          console.log("Sharing gallery ID:", this.currentGalleryId);
          console.log("Generated share ID:", shareId);
          
          db.collection('galleryShares').add({  // Use the same collection name as in your database
              galleryId: this.currentGalleryId,
              shareId: shareId,
              passwordProtected: passwordProtected,
              password: passwordProtected ? password : '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              status: "active"
          })
          .then(() => {
              console.log("Gallery shared successfully with ID:", shareId);
              
              // Display the share link - using the shareId from outer scope
              self.displayShareLink(shareId);
              
              // Show revoke button
              const revokeBtn = document.getElementById('revokeAccessBtn');
              if (revokeBtn) {
                  revokeBtn.classList.remove('hidden');
              }
              
              // Show success message
              self.showToast('Gallery shared successfully!', 'success');
          })
          .catch(error => {
              console.error("Error sharing gallery:", error);
              self.showToast('Error sharing gallery: ' + error.message, 'error');
          });
      } catch (error) {
          console.error("Firebase not available:", error);
          this.showToast('Error: Firebase not initialized.', 'error');
      }
  },
  
  // Revoke access to a shared gallery
  revokeAccess: function() {
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      const self = this; // Store reference to 'this' for use in promise callbacks
      
      if (!currentUser) {
        this.showToast('Please log in to manage gallery access.', 'error');
        return;
      }
      
      // Look for shares by this photographer for this gallery
      db.collection('galleryShares')
        .where('galleryId', '==', this.currentGalleryId)
        .where('photographerId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            self.showToast('No active shares found for this gallery.', 'info');
            return;
          }
          
          // Delete all sharing records
          const batch = db.batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          return batch.commit();
        })
        .then(() => {
          // Hide share link section
          const shareLinkSection = document.getElementById('shareLinkSection');
          if (shareLinkSection) {
            shareLinkSection.classList.add('hidden');
          }
          
          // Hide revoke button
          const revokeBtn = document.getElementById('revokeAccessBtn');
          if (revokeBtn) {
            revokeBtn.classList.add('hidden');
          }
          
          // Show success message
          self.showToast('Gallery access revoked successfully.', 'success');
        })
        .catch(error => {
          console.error("Error revoking access:", error);
          self.showToast('Error revoking access: ' + error.message, 'error');
        });
    } catch (error) {
      console.error("Firebase not available:", error);
      this.showToast('Error: Firebase not initialized.', 'error');
    }
  },
  
  // Show a toast notification
  showToast: function(message, type = 'info') {
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
};

// Initialize the modal when the document is ready
document.addEventListener('DOMContentLoaded', function() {
  try {
    GalleryShareModal.initialize();
    
    // Export the module globally
    window.GalleryShareModal = GalleryShareModal;
    console.log("Gallery Share Modal exported to window");
  } catch (error) {
    console.error("Error initializing Gallery Share Modal:", error);
  }
});
