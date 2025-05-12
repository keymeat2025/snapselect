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
      
      // Find photographer by UID
      db.collection('photographers')
        .where('uid', '==', currentUser.uid)
        .limit(1)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            // No profile found, prompt to create
            this.showToast("Please complete your profile before sharing", "warning");
            this.promptToUpdateProfile(null);
            if (callback) callback(false, null);
            return;
          }
          
          const photographerData = snapshot.docs[0].data();
          console.log("Found photographer profile:", photographerData);
          
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
            this.showToast(`Please update your profile (missing: ${fieldsStr})`, "warning");
            this.promptToUpdateProfile(photographerData);
            if (callback) callback(false, photographerData);
            return;
          }
          
          // All required fields present
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
    
    // Try to find the modal title or header to add the name
    const modalTitle = document.querySelector('#shareGalleryModal .modal-title');
    if (modalTitle) {
      // Add photographer name to modal title
      modalTitle.textContent = `Share Gallery - ${photographerData.studioName}`;
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
        </div>
      `;
    }
    
    console.log("Displayed photographer info for:", photographerData.studioName);
  },
  
  // Prompt to update photographer profile
  promptToUpdateProfile: function(existingData) {
    const userConfirmed = confirm("You need to complete your profile before sharing galleries. Update profile now?");
    
    if (userConfirmed) {
      // Create simple data collection form
      const formHtml = `
        <div id="profileFormOverlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; display:flex; justify-content:center; align-items:center;">
          <div style="background:white; padding:20px; border-radius:5px; width:90%; max-width:500px;">
            <h3>Photographer Profile</h3>
            <p>Please complete all required fields (*)</p>
            
            <form id="photographerProfileForm">
              <div style="margin-bottom:10px;">
                <label for="profileStudioName">Studio Name* (lowercase letters, numbers, hyphens only):</label>
                <input type="text" id="profileStudioName" required style="width:100%; padding:5px;">
              </div>
              
              <div style="margin-bottom:10px;">
                <label for="profileOwnerName">Your Name*:</label>
                <input type="text" id="profileOwnerName" required style="width:100%; padding:5px;">
              </div>
              
              <div style="margin-bottom:10px;">
                <label for="profileOwnerEmail">Email*:</label>
                <input type="email" id="profileOwnerEmail" required style="width:100%; padding:5px;">
              </div>
              
              <div style="margin-bottom:10px;">
                <label for="profileOwnerNumber">Phone Number*:</label>
                <input type="tel" id="profileOwnerNumber" required style="width:100%; padding:5px;">
              </div>
              
              <div style="margin-bottom:10px;">
                <label for="profileStudioAddress">Studio Address:</label>
                <input type="text" id="profileStudioAddress" style="width:100%; padding:5px;">
              </div>
              
              <div style="margin-bottom:10px;">
                <label for="profileStudioPincode">Pincode:</label>
                <input type="text" id="profileStudioPincode" style="width:100%; padding:5px;">
              </div>
              
              <div id="profileFormError" style="color:red; margin:10px 0;"></div>
              
              <div style="text-align:right;">
                <button type="button" id="cancelProfileBtn">Cancel</button>
                <button type="submit">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      // Add form to document
      const formContainer = document.createElement('div');
      formContainer.innerHTML = formHtml;
      document.body.appendChild(formContainer);
      
      // Pre-fill with existing data if available
      if (existingData) {
        const studioNameInput = document.getElementById('profileStudioName');
        const ownerNameInput = document.getElementById('profileOwnerName');
        const ownerEmailInput = document.getElementById('profileOwnerEmail');
        const ownerNumberInput = document.getElementById('profileOwnerNumber');
        const studioAddressInput = document.getElementById('profileStudioAddress');
        const studioPincodeInput = document.getElementById('profileStudioPincode');
        
        if (studioNameInput && existingData.studioName) studioNameInput.value = existingData.studioName;
        if (ownerNameInput && existingData.ownerName) ownerNameInput.value = existingData.ownerName;
        if (ownerEmailInput && existingData.ownerEmail) ownerEmailInput.value = existingData.ownerEmail;
        if (ownerNumberInput && existingData.ownerNumber) ownerNumberInput.value = existingData.ownerNumber;
        if (studioAddressInput && existingData.studioAddress) studioAddressInput.value = existingData.studioAddress;
        if (studioPincodeInput && existingData.studioPincode) studioPincodeInput.value = existingData.studioPincode;
      } else {
        // Pre-fill with user data if available
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
          const ownerNameInput = document.getElementById('profileOwnerName');
          const ownerEmailInput = document.getElementById('profileOwnerEmail');
          
          if (ownerNameInput && currentUser.displayName) ownerNameInput.value = currentUser.displayName;
          if (ownerEmailInput && currentUser.email) ownerEmailInput.value = currentUser.email;
        }
      }
      
      // Set up event listeners
      const form = document.getElementById('photographerProfileForm');
      const cancelBtn = document.getElementById('cancelProfileBtn');
      
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.savePhotographerProfile(existingData);
        });
      }
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          const overlay = document.getElementById('profileFormOverlay');
          if (overlay) {
            overlay.parentNode.removeChild(overlay);
          }
        });
      }
    }
  },
  
  // Save photographer profile
  savePhotographerProfile: function(existingData) {
    try {
      const studioNameInput = document.getElementById('profileStudioName');
      const ownerNameInput = document.getElementById('profileOwnerName');
      const ownerEmailInput = document.getElementById('profileOwnerEmail');
      const ownerNumberInput = document.getElementById('profileOwnerNumber');
      const studioAddressInput = document.getElementById('profileStudioAddress');
      const studioPincodeInput = document.getElementById('profileStudioPincode');
      const errorElement = document.getElementById('profileFormError');
      
      if (!studioNameInput || !ownerNameInput || !ownerEmailInput || !ownerNumberInput || !errorElement) {
        alert("Form elements not found");
        return;
      }
      
      // Get values
      const studioName = studioNameInput.value.trim();
      const ownerName = ownerNameInput.value.trim();
      const ownerEmail = ownerEmailInput.value.trim();
      const ownerNumber = ownerNumberInput.value.trim();
      const studioAddress = studioAddressInput ? studioAddressInput.value.trim() : '';
      const studioPincode = studioPincodeInput ? studioPincodeInput.value.trim() : '';
      
      // Basic validation
      if (!studioName || !ownerName || !ownerEmail || !ownerNumber) {
        errorElement.textContent = "Please fill in all required fields";
        return;
      }
      
      // Validate studio name format
      if (!/^[a-z0-9-]+$/.test(studioName)) {
        errorElement.textContent = "Studio name can only contain lowercase letters, numbers, and hyphens";
        return;
      }
      
      // Validate email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        errorElement.textContent = "Please enter a valid email address";
        return;
      }
      
      // Prepare data object
      const profileData = {
        studioName: studioName,
        ownerName: ownerName,
        ownerEmail: ownerEmail,
        ownerNumber: ownerNumber,
        studioAddress: studioAddress,
        studioPincode: studioPincode,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        errorElement.textContent = "You must be logged in to update your profile";
        return;
      }
      
      // Show loading state
      errorElement.textContent = "Saving profile...";
      errorElement.style.color = "blue";
      
      // Update or create profile
      if (existingData) {
        // Update existing profile
        db.collection('photographers')
          .where('uid', '==', currentUser.uid)
          .limit(1)
          .get()
          .then(snapshot => {
            if (snapshot.empty) {
              throw new Error("Profile not found");
            }
            
            // Update existing document
            return snapshot.docs[0].ref.update(profileData);
          })
          .then(() => {
            console.log("Profile updated successfully");
            this.handleProfileUpdateSuccess();
          })
          .catch(error => {
            console.error("Error updating profile:", error);
            errorElement.textContent = "Error saving profile: " + error.message;
            errorElement.style.color = "red";
          });
      } else {
        // Create new profile
        // Add UID field to the data
        profileData.uid = currentUser.uid;
        profileData.registrationDate = firebase.firestore.FieldValue.serverTimestamp();
        
        // Add new document
        db.collection('photographers')
          .add(profileData)
          .then(() => {
            console.log("Profile created successfully");
            this.handleProfileUpdateSuccess();
          })
          .catch(error => {
            console.error("Error creating profile:", error);
            errorElement.textContent = "Error creating profile: " + error.message;
            errorElement.style.color = "red";
          });
      }
    } catch (error) {
      console.error("Error in savePhotographerProfile:", error);
      alert("An error occurred while saving your profile. Please try again.");
    }
  },
  
  // Handle successful profile update
  handleProfileUpdateSuccess: function() {
    // Remove the form overlay
    const overlay = document.getElementById('profileFormOverlay');
    if (overlay) {
      overlay.parentNode.removeChild(overlay);
    }
    
    // Show success message
    this.showToast("Profile updated successfully", "success");
    
    // Reopen the share modal with the updated profile
    setTimeout(() => {
      this.open({ id: this.currentGalleryId });
    }, 500);
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
      
      // Get the photographer's studio name from their profile
      db.collection('photographers')
        .where('uid', '==', currentUser.uid)
        .limit(1)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            throw new Error("Photographer profile not found");
          }
          
          const photographerData = snapshot.docs[0].data();
          const studioName = photographerData.studioName;
          
          if (!studioName) {
            throw new Error("Studio name not found in profile");
          }
          
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
      
      db.collection('galleryShares').add({  // Use the same collection name that matches your database
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
