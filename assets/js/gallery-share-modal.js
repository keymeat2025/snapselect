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
    
    // First validate photographer details
    this.validatePhotographerDetails((isValid, photographerData) => {
      if (isValid) {
        // Show photographer details in the modal header or relevant location
        this.displayPhotographerName(photographerData);
        
        // Show the modal
        const modal = document.getElementById('shareGalleryModal');
        if (modal) {
          modal.style.display = 'block';
          
          // Check if gallery is already shared
          this.checkSharingStatus();
        }
      }
    });
  },
  
  // Validate photographer details before sharing
  validatePhotographerDetails: function(callback) {
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        this.showToast("Please log in to share galleries", "error");
        return;
      }
      
      console.log("Validating photographer details for UID:", currentUser.uid);
      
      // Find photographer by UID - CORRECT: Using singular collection name
      db.collection('photographer')
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            console.log("No photographers found in collection");
            this.showToast("Please complete your profile before sharing", "warning");
            this.promptToUpdateProfile(null);
            if (callback) callback(false, null);
            return;
          }
          
          // Find the photographer with matching UID
          let photographerData = null;
          
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid === currentUser.uid) {
              console.log("Found matching photographer:", data);
              photographerData = data;
              photographerData.id = doc.id; // Store document ID for updates
            }
          });
          
          if (!photographerData) {
            console.log("No photographer found with UID:", currentUser.uid);
            this.showToast("Please complete your profile before sharing", "warning");
            this.promptToUpdateProfile(null);
            if (callback) callback(false, null);
            return;
          }
          
          // Check required fields
          const requiredFields = ['studioName', 'ownerName', 'ownerEmail', 'ownerNumber'];
          const missingFields = [];
          
          requiredFields.forEach(field => {
            if (!photographerData[field] || photographerData[field].trim() === '') {
              missingFields.push(field);
            }
          });
          
          if (missingFields.length > 0) {
            // Missing required fields
            const fieldsStr = missingFields.join(', ');
            console.log("Missing fields in photographer profile:", fieldsStr);
            this.showToast(`Please update your profile (missing: ${fieldsStr})`, "warning");
            this.promptToUpdateProfile(photographerData);
            if (callback) callback(false, photographerData);
            return;
          }
          
          // All required fields present
          console.log("Photographer profile is complete:", photographerData);
          if (callback) callback(true, photographerData);
        })
        .catch(error => {
          console.error("Error validating photographer details:", error);
          this.showToast("Error checking your profile", "error");
          if (callback) callback(false, null);
        });
    } catch (error) {
      console.error("Error in validatePhotographerDetails:", error);
      this.showToast("Error: Could not validate profile", "error");
      if (callback) callback(false, null);
    }
  },
  
  // Display photographer name in the modal
  displayPhotographerName: function(photographerData) {
    if (!photographerData) return;
    
    console.log("Displaying photographer data:", photographerData);
    
    // Try to find the modal title or header to add the name
    const modalTitle = document.querySelector('#shareGalleryModal .modal-title');
    if (modalTitle) {
      // Add photographer name to modal title
      modalTitle.textContent = `Share Gallery - ${photographerData.studioName || 'No Studio Name'}`;
    }
    
    // Add a simple profile info section if not present
    let infoElement = document.getElementById('photographerInfo');
    if (!infoElement) {
      infoElement = document.createElement('div');
      infoElement.id = 'photographerInfo';
      infoElement.style.marginBottom = '15px';
      
      // Find where to add it
      const modalBody = document.querySelector('#shareGalleryModal .modal-body');
      if (modalBody) {
        if (modalBody.firstChild) {
          modalBody.insertBefore(infoElement, modalBody.firstChild);
        } else {
          modalBody.appendChild(infoElement);
        }
      }
    }
    
    // Update profile info content
    if (infoElement) {
      infoElement.innerHTML = `
        <div>
          <p><strong>Studio:</strong> ${photographerData.studioName || 'Not set'}</p>
          <p><strong>Owner:</strong> ${photographerData.ownerName || 'Not set'} 
            (${photographerData.ownerEmail || 'No email'}, ${photographerData.ownerNumber || 'No phone'})</p>
          <p><strong>Address:</strong> ${photographerData.studioAddress || 'Not set'}, 
            ${photographerData.studioPincode || 'No pincode'}</p>
        </div>
      `;
    }
    
    console.log("Displayed photographer info for:", photographerData.studioName);
  },
  
  // Prompt to update photographer profile - Updated to redirect to settings page
  promptToUpdateProfile: function(existingData) {
    const userConfirmed = confirm("You need to complete your profile before sharing galleries. Update profile now?");
    
    if (userConfirmed) {
      // Get current URL to use as return URL after profile update
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const returnUrl = encodeURIComponent(currentPath + currentSearch);
      
      // Store the current gallery ID in sessionStorage to restore state when returning
      if (this.currentGalleryId) {
        sessionStorage.setItem('pendingShareGalleryId', this.currentGalleryId);
      }
      
      // Redirect to settings page with return parameter
      window.location.href = '/snapselect/pages/settings.html?return=' + returnUrl;
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
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        console.error("No authenticated user found");
        return;
      }
      
      console.log("Getting studio name for share link, UID:", currentUser.uid);
      
      // Get the photographer's studio name from their profile
      db.collection('photographer')
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            throw new Error("No photographers found in collection");
          }
          
          // Find the photographer with matching UID
          let photographerData = null;
          
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid === currentUser.uid) {
              photographerData = data;
            }
          });
          
          if (!photographerData) {
            throw new Error("Photographer profile not found");
          }
          
          const studioName = photographerData.studioName;
          
          if (!studioName) {
            throw new Error("Studio name not found in profile");
          }
          
          console.log("Found studio name for share link:", studioName);
          
          // Create the URL with studio name - using the FULL DOMAIN
          // This ensures the URL works even when accessed from a different page
          const domain = window.location.origin;
          const shareUrl = `${domain}/${studioName}/gallery/${shareId}`;
          
          // Update the UI
          const urlDisplay = document.getElementById('shareUrlDisplay');
          if (urlDisplay) {
            urlDisplay.value = shareUrl;
            
            // Show the share link section
            const shareLinkSection = document.getElementById('shareLinkSection');
            if (shareLinkSection) {
              shareLinkSection.classList.remove('hidden');
            }
            
            console.log("Share link displayed:", shareUrl);
          }
        })
        .catch(error => {
          console.error("Error getting studio name:", error);
          
          // Fallback to original URL format
          const domain = window.location.origin;
          const shareUrl = `${domain}/pages/client-gallery-view.html?share=${shareId}`;
          
          const urlDisplay = document.getElementById('shareUrlDisplay');
          if (urlDisplay) {
            urlDisplay.value = shareUrl;
            const shareLinkSection = document.getElementById('shareLinkSection');
            if (shareLinkSection) {
              shareLinkSection.classList.remove('hidden');
            }
            console.log("Using fallback share link:", shareUrl);
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
      
      // Generate a random share ID - more readable format
      const shareId = Math.random().toString(36).substring(2, 10);
      
      // Save to Firestore
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      const self = this; // Store reference to 'this' for use in promise callbacks
      
      if (!currentUser) {
        this.showToast("Please log in to share galleries", "error");
        return;
      }
      
      // Show loading state by disabling the submit button if it exists
      const submitButton = document.querySelector('#shareSettingsForm button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sharing...';
      }
      
      // Make sure to log the gallery ID and share ID
      console.log("Sharing gallery ID:", this.currentGalleryId);
      console.log("Generated share ID:", shareId);
      
      // Create a timestamp for share creation
      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      
      // Add share document to Firestore
      db.collection('galleryShares').add({
        galleryId: this.currentGalleryId,
        photographerId: currentUser.uid,
        shareId: shareId,
        passwordProtected: passwordProtected,
        password: passwordProtected ? password : '',
        createdAt: timestamp,
        status: "active",
        views: 0,
        lastViewed: null
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
        
        // Reset form if needed
        if (passwordProtectionCheckbox) {
          passwordProtectionCheckbox.checked = false;
        }
        if (passwordSection) {
          passwordSection.classList.add('hidden');
        }
        if (passwordInput) {
          passwordInput.value = '';
        }
        
        // Re-enable submit button
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Share Gallery';
        }
        
        // Show success message
        self.showToast('Gallery shared successfully!', 'success');
      })
      .catch(error => {
        console.error("Error sharing gallery:", error);
        
        // Re-enable submit button
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Share Gallery';
        }
        
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
      
      // Show loading state on revoke button if it exists
      const revokeBtn = document.getElementById('revokeAccessBtn');
      if (revokeBtn) {
        revokeBtn.disabled = true;
        revokeBtn.textContent = 'Revoking...';
      }
      
      // Look for shares by this photographer for this gallery
      db.collection('galleryShares')
        .where('galleryId', '==', this.currentGalleryId)
        .where('photographerId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            self.showToast('No active shares found for this gallery.', 'info');
            
            // Reset button state
            if (revokeBtn) {
              revokeBtn.disabled = false;
              revokeBtn.textContent = 'Revoke Access';
            }
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
          if (revokeBtn) {
            revokeBtn.classList.add('hidden');
          }
          
          // Show success message
          self.showToast('Gallery access revoked successfully.', 'success');
        })
        .catch(error => {
          console.error("Error revoking access:", error);
          
          // Reset button state
          if (revokeBtn) {
            revokeBtn.disabled = false;
            revokeBtn.textContent = 'Revoke Access';
          }
          
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
    
    // Check for pending gallery share
    const pendingGalleryId = sessionStorage.getItem('pendingShareGalleryId');
    if (pendingGalleryId) {
      // Clear the stored ID to prevent repeat shares
      sessionStorage.removeItem('pendingShareGalleryId');
      
      // Fetch the gallery data
      firebase.firestore().collection('galleries').doc(pendingGalleryId).get()
        .then(doc => {
          if (doc.exists) {
            const galleryData = doc.data();
            galleryData.id = pendingGalleryId;
            
            // Open the share modal for this gallery
            setTimeout(() => {
              if (window.GalleryShareModal) {
                window.GalleryShareModal.open(galleryData);
              }
            }, 500);
          }
        })
        .catch(error => {
          console.error("Error retrieving pending gallery:", error);
        });
    }
    
    // Export the module globally
    window.GalleryShareModal = GalleryShareModal;
    console.log("Gallery Share Modal exported to window");
  } catch (error) {
    console.error("Error initializing Gallery Share Modal:", error);
  }
});
