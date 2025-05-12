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
    
    /* Copy link button
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
    }*/
    
    // Share via WhatsApp button
    const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
    if (shareWhatsAppBtn) {
      shareWhatsAppBtn.addEventListener('click', () => {
        this.shareViaWhatsApp();
      });
    }
    
    // Share via Email button
    const shareEmailBtn = document.getElementById('shareEmailBtn');
    if (shareEmailBtn) {
      shareEmailBtn.addEventListener('click', () => {
        this.shareViaEmail();
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
            // Use the shareId field for the URL
            this.displayShareLink(shareData.shareId);
            
            // Show revoke button
            const revokeBtn = document.getElementById('revokeAccessBtn');
            if (revokeBtn) {
              revokeBtn.classList.remove('hidden');
            }
            
            // Update form fields with saved settings if they exist
            this.updateFormWithSavedSettings(shareData);
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
  
  // Update form with saved settings
  updateFormWithSavedSettings: function(shareData) {
    // Update password protection checkbox
    const passwordProtection = document.getElementById('passwordProtection');
    if (passwordProtection) {
      passwordProtection.checked = shareData.passwordProtected || false;
      
      // Toggle password section visibility
      const passwordSection = document.getElementById('passwordSection');
      if (passwordSection) {
        if (passwordProtection.checked) {
          passwordSection.classList.remove('hidden');
        } else {
          passwordSection.classList.add('hidden');
        }
      }
    }
    
    // Update expiry date if it exists
    const expiryDate = document.getElementById('expiryDate');
    if (expiryDate && shareData.expiryDate) {
      const date = shareData.expiryDate.toDate ? 
                  shareData.expiryDate.toDate() : 
                  new Date(shareData.expiryDate);
      expiryDate.value = date.toISOString().substr(0, 10);
    }
    
    // Update other options if they exist
    const preventDownload = document.getElementById('preventDownload');
    if (preventDownload && shareData.preventDownload !== undefined) {
      preventDownload.checked = shareData.preventDownload;
    }
    
    const watermarkEnabled = document.getElementById('watermarkEnabled');
    if (watermarkEnabled && shareData.watermarkEnabled !== undefined) {
      watermarkEnabled.checked = shareData.watermarkEnabled;
    }
    
    // Update submit button text to indicate we're updating
    const submitBtn = document.getElementById('shareGallerySubmitBtn');
    if (submitBtn) {
      submitBtn.textContent = 'Update Settings';
    }
  },
  
  // Display share link for a gallery using the consistent format
  displayShareLink: function(shareId) {
    if (!shareId) {
      console.error("No shareId provided to displayShareLink");
      return;
    }
    
    // IMPORTANT: Always use the same consistent URL format
    const domain = window.location.origin;
    const shareUrl = `${domain}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
    
    console.log("Share link displayed:", shareUrl);
    
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
    
    // Store the URL for other sharing methods
    this.currentShareUrl = shareUrl;
    this.currentShareId = shareId;
    
    // Enable sharing buttons if they exist
    const shareButtons = document.querySelectorAll('.share-btn');
    shareButtons.forEach(btn => {
      btn.disabled = false;
    });
  },
  
  // Share a gallery - create or update share settings
  shareGallery: function() {
    try {
      // Get form values
      const passwordProtection = document.getElementById('passwordProtection');
      const password = document.getElementById('password');
      const expiryDate = document.getElementById('expiryDate');
      const preventDownload = document.getElementById('preventDownload');
      const watermarkEnabled = document.getElementById('watermarkEnabled');
      
      // Handle missing elements
      if (!passwordProtection) {
        console.error("Password protection element not found");
        return;
      }
      
      const passwordProtected = passwordProtection.checked;
      const passwordValue = passwordProtected && password ? password.value : '';
      
      // Validate password for protected galleries
      if (passwordProtected && !passwordValue) {
        this.showToast('Please enter a password for your protected gallery.', 'error');
        return;
      }
      
      // Get expiry date if provided
      let expiryDateValue = null;
      if (expiryDate && expiryDate.value) {
        expiryDateValue = firebase.firestore.Timestamp.fromDate(new Date(expiryDate.value));
      }
      
      // Get download and watermark settings
      const preventDownloadValue = preventDownload ? preventDownload.checked : false;
      const watermarkEnabledValue = watermarkEnabled ? watermarkEnabled.checked : false;
      
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
        submitButton.textContent = 'Processing...';
      }
      
      // First check if we're updating an existing share or creating a new one
      db.collection('galleryShares')
        .where('galleryId', '==', this.currentGalleryId)
        .where('photographerId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            // Update existing share
            const shareDoc = snapshot.docs[0];
            const shareId = shareDoc.data().shareId; // Use the existing shareId
            
            // Update the share document
            return db.collection('galleryShares').doc(shareDoc.id).update({
              passwordProtected: passwordProtected,
              password: passwordProtected ? passwordValue : '',
              expiryDate: expiryDateValue,
              preventDownload: preventDownloadValue,
              watermarkEnabled: watermarkEnabledValue,
              updated: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
              return shareId; // Return the shareId for the URL
            });
          } else {
            // Create a new share
            // Generate a random share ID - more readable format
            const shareId = Math.random().toString(36).substring(2, 10);
            
            // Create timestamp for share creation
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // CRITICAL CHANGE: Use the shareId as the document ID
            return db.collection('galleryShares').doc(shareId).set({
              galleryId: self.currentGalleryId,
              photographerId: currentUser.uid,
              shareId: shareId, // Store shareId as a field for compatibility
              passwordProtected: passwordProtected,
              password: passwordProtected ? passwordValue : '',
              expiryDate: expiryDateValue,
              preventDownload: preventDownloadValue,
              watermarkEnabled: watermarkEnabledValue,
              createdAt: timestamp,
              status: "active",
              views: 0,
              lastViewed: null
            }).then(() => {
              return shareId; // Return the shareId for the URL
            });
          }
        })
        .then(shareId => {
          console.log("Gallery shared successfully with ID:", shareId);
          
          // Display the share link with correct shareId
          self.displayShareLink(shareId);
          
          // Show revoke button
          const revokeBtn = document.getElementById('revokeAccessBtn');
          if (revokeBtn) {
            revokeBtn.classList.remove('hidden');
          }
          
          // Update submit button text
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Update Settings';
          }
          
          // Show success message
          self.showToast('Gallery shared successfully!', 'success');
          
          // Highlight the share URL
          const urlDisplay = document.getElementById('shareUrlDisplay');
          if (urlDisplay) {
            urlDisplay.select();
          }
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
      console.error("Error in shareGallery:", error);
      this.showToast('Error: Could not share gallery.', 'error');
    }
  },
  
  // Share via WhatsApp
  shareViaWhatsApp: function() {
    if (!this.currentShareUrl) {
      this.showToast('No share link available.', 'warning');
      return;
    }
    
    // Create WhatsApp message
    let message = `Check out this photo gallery: ${this.currentShareUrl}`;
    
    // Open WhatsApp with prefilled message
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  },
  
  // Share via Email
  shareViaEmail: function() {
    if (!this.currentShareUrl) {
      this.showToast('No share link available.', 'warning');
      return;
    }
    
    // Get gallery name if available
    const galleryTitle = document.querySelector('#shareGalleryModal .modal-title');
    const galleryName = galleryTitle ? galleryTitle.textContent.replace('Share Gallery - ', '') : 'Photo Gallery';
    
    // Create email subject and body
    const subject = `Check out my photo gallery: ${galleryName}`;
    const body = `I've shared a photo gallery with you. Click the link below to view:\n\n${this.currentShareUrl}\n\nRegards,\nYour photographer`;
    
    // Create mailto URL
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open default email client
    window.open(mailtoUrl);
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
            // Option 1: Delete document completely
            batch.delete(doc.ref);
            
            // Option 2: Update status to 'revoked' (if you want to keep history)
            // batch.update(doc.ref, {
            //   status: 'revoked',
            //   revokedAt: firebase.firestore.FieldValue.serverTimestamp()
            // });
          });
          
          return batch.commit();
        })
        .then(() => {
          // Clear current share URL
          self.currentShareUrl = null;
          self.currentShareId = null;
          
          // Hide share link section
          const shareLinkSection = document.getElementById('shareLinkSection');
          if (shareLinkSection) {
            shareLinkSection.classList.add('hidden');
          }
          
          // Hide revoke button
          if (revokeBtn) {
            revokeBtn.classList.add('hidden');
          }
          
          // Reset form fields
          const passwordProtection = document.getElementById('passwordProtection');
          if (passwordProtection) {
            passwordProtection.checked = false;
          }
          
          const passwordSection = document.getElementById('passwordSection');
          if (passwordSection) {
            passwordSection.classList.add('hidden');
          }
          
          const password = document.getElementById('password');
          if (password) {
            password.value = '';
          }
          
          // Update submit button text
          const submitBtn = document.getElementById('shareGallerySubmitBtn');
          if (submitBtn) {
            submitBtn.textContent = 'Create Share Link';
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
