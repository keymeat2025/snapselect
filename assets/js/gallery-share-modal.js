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
  
  // Check if photographer has a studio name
  checkStudioName: function(callback) {
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        this.showToast("Please log in to share galleries", "error");
        return;
      }
      
      db.collection('photographers')
        .doc(currentUser.uid)
        .get()
        .then(doc => {
          if (!doc.exists || !doc.data().studioName) {
            // No studio name set, show prompt to set one
            this.promptForStudioName();
            return;
          }
          
          // Studio name exists, proceed with callback
          if (typeof callback === 'function') {
            callback(doc.data().studioName);
          }
        })
        .catch(error => {
          console.error("Error checking studio name:", error);
          this.showToast("Error checking profile", "error");
        });
    } catch (error) {
      console.error("Firebase not available:", error);
      this.showToast("Error: Firebase not initialized.", "error");
    }
  },

  // Prompt user to set studio name
  promptForStudioName: function() {
    // Hide any existing modal first
    const existingModal = document.getElementById('shareGalleryModal');
    if (existingModal) {
      existingModal.style.display = 'none';
    }
    
    // Create studio name prompt if it doesn't exist
    let promptModal = document.getElementById('studioNamePrompt');
    if (!promptModal) {
      promptModal = document.createElement('div');
      promptModal.id = 'studioNamePrompt';
      promptModal.className = 'modal';
      promptModal.innerHTML = `
        <div class="modal-content">
          <span class="close">&times;</span>
          <h2>Set Your Studio Name</h2>
          <p>Before sharing galleries, please set your studio name. This will be used in your gallery URLs.</p>
          <form id="quickStudioNameForm">
            <div class="form-group">
              <label for="quickStudioName">Studio Name</label>
              <input type="text" id="quickStudioName" placeholder="e.g. jane-smith-photography" required>
              <small>Use lowercase letters, numbers, and hyphens only (3-30 characters)</small>
              <div id="quickStudioNameError" class="error-message"></div>
            </div>
            <button type="submit" class="btn">Save and Continue</button>
          </form>
        </div>
      `;
      document.body.appendChild(promptModal);
      
      // Add event listeners
      const closeBtn = promptModal.querySelector('.close');
      closeBtn.addEventListener('click', () => {
        promptModal.style.display = 'none';
      });
      
      const form = promptModal.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveStudioName();
      });
    }
    
    // Show the prompt
    promptModal.style.display = 'block';
  },

  // Save studio name from quick form
  saveStudioName: function() {
    try {
      const studioNameInput = document.getElementById('quickStudioName');
      const errorElement = document.getElementById('quickStudioNameError');
      
      if (!studioNameInput || !errorElement) return;
      
      const studioName = studioNameInput.value.trim();
      
      // Simple validation
      if (studioName.length < 3 || studioName.length > 30) {
        errorElement.textContent = 'Studio name must be between 3 and 30 characters';
        return;
      }
      
      // Validate characters (lowercase letters, numbers, hyphens)
      if (!/^[a-z0-9-]+$/.test(studioName)) {
        errorElement.textContent = 'Only lowercase letters, numbers, and hyphens are allowed';
        return;
      }
      
      // Save to database
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        errorElement.textContent = "You must be logged in to save settings";
        return;
      }
      
      // Check if the document exists first
      db.collection('photographers')
        .doc(currentUser.uid)
        .get()
        .then(doc => {
          if (doc.exists) {
            // Update existing document
            return db.collection('photographers')
              .doc(currentUser.uid)
              .update({
                studioName: studioName,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
          } else {
            // Create new document
            return db.collection('photographers')
              .doc(currentUser.uid)
              .set({
                studioName: studioName,
                displayName: currentUser.displayName || 'Photographer',
                email: currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
          }
        })
        .then(() => {
          // Hide the prompt
          const promptModal = document.getElementById('studioNamePrompt');
          if (promptModal) {
            promptModal.style.display = 'none';
          }
          
          // Show the share modal
          this.open({ id: this.currentGalleryId });
          
          // Show success message
          this.showToast("Studio name saved successfully!", "success");
        })
        .catch(error => {
          console.error("Error saving studio name:", error);
          errorElement.textContent = "Error saving studio name. Please try again.";
        });
    } catch (error) {
      console.error("Error in saveStudioName:", error);
      const errorElement = document.getElementById('quickStudioNameError');
      if (errorElement) {
        errorElement.textContent = "An unexpected error occurred. Please try again.";
      }
    }
  },
  
  // Open the modal for a gallery
  open: function(galleryData) {
    console.log("Opening share modal for gallery:", galleryData);
    
    // Store the gallery ID
    this.currentGalleryId = galleryData.id;
    
    // Check if studio name is set before opening modal
    this.checkStudioName(() => {
      // Studio name exists, show the modal
      const modal = document.getElementById('shareGalleryModal');
      if (modal) {
        modal.style.display = 'block';
        
        // Check if gallery is already shared
        this.checkSharingStatus();
      }
    });
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
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        console.error("No authenticated user found");
        return;
      }
      
      db.collection('photographers')
        .doc(currentUser.uid)
        .get()
        .then(doc => {
          if (!doc.exists) {
            throw new Error("Photographer profile not found");
          }
          
          const studioName = doc.data().studioName;
          
          // Create the URL with studio name
          const shareUrl = `${window.location.origin}/${studioName}/gallery/${shareId}`;
          
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
        })
        .catch(error => {
          console.error("Error getting studio name:", error);
          
          // Fallback to original URL format
          const shareUrl = `${window.location.origin}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
          
          const urlDisplay = document.getElementById('shareUrlDisplay');
          if (urlDisplay) {
            urlDisplay.value = shareUrl;
            const shareLinkSection = document.getElementById('shareLinkSection');
            if (shareLinkSection) {
              shareLinkSection.classList.remove('hidden');
            }
          }
        });
    } catch (error) {
      console.error("Error in displayShareLink:", error);
      this.showToast('Error generating share link.', 'error');
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
      const currentUser = firebase.auth().currentUser;
      const self = this; // Store reference to 'this' for use in promise callbacks
      
      if (!currentUser) {
        this.showToast("Please log in to share galleries", "error");
        return;
      }
      
      // Make sure to log the gallery ID and share ID
      console.log("Sharing gallery ID:", this.currentGalleryId);
      console.log("Generated share ID:", shareId);
      
      db.collection('galleryShares').add({  // Use the same collection name as in your database
        galleryId: this.currentGalleryId,
        photographerId: currentUser.uid,
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
