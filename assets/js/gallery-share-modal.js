/**
 * gallery-share-modal.js - Updated with countdown-based revocation system
 * SIMPLIFIED: Only uses galleryShares as master, ignores galleries sharing fields
 */

// Gallery Share Modal
const GalleryShareModal = {
  currentGalleryId: null,
  currentShareId: null,     // Store the shareId
  currentShareUrl: null,    // Store the complete URL
  maxRevocations: 3,        // Maximum number of allowed revocations
  
  // Initialize the modal
  initialize: function() {
    this.setupEventListeners();
    console.log("Gallery Share Modal initialized with countdown revocation system - SIMPLIFIED MODE");
    
    // Initialize tooltip functionality
    this.initializeTooltips();
  },
  
  // Initialize tooltips
  initializeTooltips: function() {
    // Add tooltip functionality if not already present in the HTML
    const revokeBtn = document.getElementById('revokeAccessBtn');
    
    if (revokeBtn && !revokeBtn.closest('.tooltip-container')) {
      // If the button doesn't have a tooltip wrapper, add one
      const tooltipContainer = document.createElement('div');
      tooltipContainer.className = 'tooltip-container';
      
      // Create tooltip text
      const tooltipText = document.createElement('div');
      tooltipText.className = 'tooltip-text tooltip-warning';
      tooltipText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: You have a limited number of revocation attempts. Use them wisely.';
      
      // Replace the button with the tooltip container
      const parentElement = revokeBtn.parentNode;
      parentElement.replaceChild(tooltipContainer, revokeBtn);
      
      // Add the button and tooltip text to the container
      tooltipContainer.appendChild(revokeBtn);
      tooltipContainer.appendChild(tooltipText);
    }
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
        this.promptRevocation();
      });
    }
    
    // Share Gallery Button (additional listener to ensure proper operation)
    const shareGalleryBtn = document.getElementById('shareGalleryBtn');
    if (shareGalleryBtn) {
      shareGalleryBtn.addEventListener('click', () => {
        // Get gallery ID from URL if not already set
        if (!this.currentGalleryId) {
          const urlParams = new URLSearchParams(window.location.search);
          const galleryId = urlParams.get('id');
          
          if (galleryId) {
            this.fetchGalleryData(galleryId);
          } else {
            this.showToast('Gallery ID not found. Please reload the page.', 'error');
          }
        }
      });
    }
  },
  
  // Fetch gallery data from Firestore
  fetchGalleryData: function(galleryId) {
    try {
      firebase.firestore().collection('galleries').doc(galleryId).get()
        .then(doc => {
          if (doc.exists) {
            const galleryData = doc.data();
            galleryData.id = galleryId;
            
            // Store in global scope for future use
            window.galleryData = galleryData;
            
            // Open share modal
            this.open(galleryData);
          } else {
            console.error('Gallery not found');
            this.showToast('Gallery not found. Please reload the page.', 'error');
          }
        })
        .catch(error => {
          console.error('Error fetching gallery:', error);
          this.showToast('Error loading gallery data: ' + error.message, 'error');
        });
    } catch (error) {
      console.error('Firebase error:', error);
      this.showToast('Error: Firebase is not initialized properly.', 'error');
    }
  },
  
  // Prompt user for revocation with count information
  promptRevocation: function() {
    // Check the user's remaining revocations first
    this.checkRemainingRevocations((remainingRevocations) => {
      if (remainingRevocations <= 0) {
        this.showToast('You have used all your revocation attempts for this gallery.', 'warning');
        return;
      }
      
      // Show confirmation with remaining count information
      const confirmMessage = `Are you sure you want to revoke access to this gallery? This is revocation ${this.maxRevocations - remainingRevocations + 1} of ${this.maxRevocations}.`;
      
      if (confirm(confirmMessage)) {
        this.revokeAccess();
      }
    });
  },
  
  // Check remaining revocations for the current user
  checkRemainingRevocations: function(callback) {
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        this.showToast('Please log in to manage gallery access.', 'error');
        return;
      }
      
      // Get the user's revocation data from Firestore
      db.collection('photographerSettings')
        .doc(currentUser.uid)
        .get()
        .then(doc => {
          if (doc.exists) {
            const data = doc.data();
            // Get the gallery-specific revocation count or default
            const galleryRevocations = data.galleryRevocations || {};
            const usedRevocations = galleryRevocations[this.currentGalleryId] || 0;
            const remainingRevocations = this.maxRevocations - usedRevocations;
            
            // Update the revoke button text to show remaining attempts
            this.updateRevokeButtonText(remainingRevocations);
            
            // Update tooltip text based on remaining revocations
            this.updateTooltipText(remainingRevocations);
            
            // Execute callback with remaining count
            if (callback) callback(remainingRevocations);
          } else {
            // No document exists yet, so all revocations are available
            this.updateRevokeButtonText(this.maxRevocations);
            this.updateTooltipText(this.maxRevocations);
            if (callback) callback(this.maxRevocations);
          }
        })
        .catch(error => {
          console.error("Error checking revocation count:", error);
          // Assume max revocations if there's an error
          if (callback) callback(this.maxRevocations);
        });
    } catch (error) {
      console.error("Error in checkRemainingRevocations:", error);
      if (callback) callback(this.maxRevocations);
    }
  },
  
  // Update tooltip text based on remaining revocations
  updateTooltipText: function(remainingRevocations) {
    const tooltipText = document.querySelector('#revokeAccessBtn + .tooltip-text');
    if (tooltipText) {
      if (remainingRevocations <= 1) {
        tooltipText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: This is your LAST revocation attempt! Once used, you cannot revoke access again.';
      } else if (remainingRevocations === this.maxRevocations) {
        tooltipText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: You have ' + remainingRevocations + ' revocation attempts available. Use them wisely.';
      } else {
        tooltipText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: You have ' + remainingRevocations + ' revocation attempts remaining out of ' + this.maxRevocations + '.';
      }
    }
  },
  
  // Update the revoke button text to show remaining attempts
  updateRevokeButtonText: function(remainingRevocations) {
    const revokeBtn = document.getElementById('revokeAccessBtn');
    if (revokeBtn) {
      if (remainingRevocations <= 0) {
        revokeBtn.textContent = 'No Revocations Left';
        revokeBtn.disabled = true;
        revokeBtn.classList.add('disabled');
      } else {
        // Simpler "Revoke (3)" format as requested
        revokeBtn.textContent = `Revoke (${remainingRevocations})`;
        revokeBtn.disabled = false;
        revokeBtn.classList.remove('disabled');
      }
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
          
          // Check remaining revocations to update button text
          this.checkRemainingRevocations();
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
  
  // SIMPLIFIED: Check if gallery is already shared - ONLY check galleryShares
  checkSharingStatus: function() {
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        console.error("No authenticated user found");
        this.showToast("Please log in to share galleries", "error");
        return;
      }
      
      // SIMPLIFIED: Only check galleryShares collection
      db.collection('galleryShares')
        .where('galleryId', '==', this.currentGalleryId)
        .where('photographerId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            // Gallery is shared - show the link
            const shareData = snapshot.docs[0].data();
            
            console.log("SIMPLIFIED: Gallery is shared, using galleryShares as single source");
            this.displayShareLink(shareData.shareId);
            
            const revokeBtn = document.getElementById('revokeAccessBtn');
            if (revokeBtn) {
              revokeBtn.classList.remove('hidden');
              this.checkRemainingRevocations();
            }
            
            this.updateFormWithSavedSettings(shareData);
          } else {
            // Gallery is not shared
            console.log("SIMPLIFIED: Gallery is not shared");
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
    
    // Update max selections if it exists
    const maxSelections = document.getElementById('maxSelections');
    if (maxSelections && shareData.maxSelections !== undefined) {
      maxSelections.value = shareData.maxSelections;
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
    
    // Store the URL and shareId for other sharing methods
    this.currentShareUrl = shareUrl;
    this.currentShareId = shareId;
    
    // Enable sharing buttons if they exist
    const shareButtons = document.querySelectorAll('.share-btn');
    shareButtons.forEach(btn => {
      btn.disabled = false;
    });
  },
  
  // SIMPLIFIED: Share a gallery - ONLY update galleryShares collection
  shareGallery: function() {
    try {
      // Get form values
      const passwordProtection = document.getElementById('passwordProtection');
      const password = document.getElementById('password');
      const expiryDate = document.getElementById('expiryDate');
      const maxSelections = document.getElementById('maxSelections');
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
      
      // Get expiry date if provided or set default 7 days expiry
      let expiryDateValue = null;
      if (expiryDate && expiryDate.value) {
        expiryDateValue = firebase.firestore.Timestamp.fromDate(new Date(expiryDate.value));
      } else {
        // Set default expiry date to 7 days from now
        const defaultExpiryDate = new Date();
        defaultExpiryDate.setDate(defaultExpiryDate.getDate() + 7);
        expiryDateValue = firebase.firestore.Timestamp.fromDate(defaultExpiryDate);
        
        // Update the expiry date input field with the default value
        if (expiryDate) {
          expiryDate.value = defaultExpiryDate.toISOString().substr(0, 10);
        }
      }
      
      // Get max selections value
      const maxSelectionsValue = maxSelections && maxSelections.value !== '' ? parseInt(maxSelections.value) : 0;
      
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
      
      // SIMPLIFIED: Only work with galleryShares collection
      db.collection('galleryShares')
        .where('galleryId', '==', this.currentGalleryId)
        .where('photographerId', '==', currentUser.uid)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            // Update existing share - ONLY galleryShares
            const shareDoc = snapshot.docs[0];
            const shareId = shareDoc.data().shareId;
            
            const domain = window.location.origin;
            const shareUrl = `${domain}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
            
            return db.collection('galleryShares').doc(shareDoc.id).update({
              shareUrl: shareUrl,
              passwordProtected: passwordProtected,
              password: passwordProtected ? passwordValue : '',
              expiryDate: expiryDateValue,
              maxSelections: maxSelectionsValue,
              preventDownload: preventDownloadValue,
              watermarkEnabled: watermarkEnabledValue,
              updated: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
              return shareId;
            });
          } else {
            // Create new share - ONLY galleryShares
            const shareId = Math.random().toString(36).substring(2, 10);
            const domain = window.location.origin;
            const shareUrl = `${domain}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            return db.collection('galleryShares').doc(shareId).set({
              galleryId: self.currentGalleryId,
              photographerId: currentUser.uid,
              shareId: shareId,
              shareUrl: shareUrl,
              passwordProtected: passwordProtected,
              password: passwordProtected ? passwordValue : '',
              expiryDate: expiryDateValue,
              maxSelections: maxSelectionsValue,
              preventDownload: preventDownloadValue,
              watermarkEnabled: watermarkEnabledValue,
              createdAt: timestamp,
              status: "active",
              views: 0,
              lastViewed: null
            }).then(() => {
              return shareId;
            });
          }
        })
        .then(shareId => {
          console.log("Gallery shared successfully with ID:", shareId);
          console.log("SIMPLIFIED: Only galleryShares updated, galleries ignored");
          
          // Display the share link with correct shareId
          self.displayShareLink(shareId);
          
          // Show revoke button and check remaining revocations
          const revokeBtn = document.getElementById('revokeAccessBtn');
          if (revokeBtn) {
            revokeBtn.classList.remove('hidden');
            self.checkRemainingRevocations();
          }
          
          // Update submit button text
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Update Settings';
          }
          
          // Show success message
          self.showToast('Gallery shared successfully!', 'success');

          // Disable upload buttons after successful sharing
          const uploadPhotosBtn = document.getElementById('uploadPhotosBtn');
          if (uploadPhotosBtn) {
            uploadPhotosBtn.style.display = 'none';
          }
          
          const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
          if (emptyStateUploadBtn) {
            emptyStateUploadBtn.style.display = 'none';
          }
          
          // Show message about disabled uploads
          self.showToast('This gallery is now shared. Uploads have been disabled.', 'info');
          
          // Highlight the share URL
          const urlDisplay = document.getElementById('shareUrlDisplay');
          if (urlDisplay) {
            urlDisplay.select();
          }
          
          // Add copy link button if it doesn't exist
          if (!document.getElementById('copyLinkBtn')) {
            const shareLinkContainer = document.querySelector('.share-link-container');
            if (shareLinkContainer) {
              const copyBtn = document.createElement('button');
              copyBtn.id = 'copyLinkBtn';
              copyBtn.className = 'btn secondary-btn';
              copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
              copyBtn.style.marginLeft = '10px';
              
              copyBtn.addEventListener('click', function() {
                const urlInput = document.getElementById('shareUrlDisplay');
                if (urlInput) {
                  urlInput.select();
                  document.execCommand('copy');
                  self.showToast('Link copied to clipboard!', 'success');
                }
              });
              
              shareLinkContainer.appendChild(copyBtn);
            }
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
  
  // SIMPLIFIED: Revoke access - ONLY delete from galleryShares
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
      
      // First check and update the revocation count
      db.collection('photographerSettings')
        .doc(currentUser.uid)
        .get()
        .then(doc => {
          // Get current revocation data or create a new object
          let userData = doc.exists ? doc.data() : {};
          let galleryRevocations = userData.galleryRevocations || {};
          let currentCount = galleryRevocations[this.currentGalleryId] || 0;
          
          // Increment the revocation count for this gallery
          galleryRevocations[this.currentGalleryId] = currentCount + 1;
          
          // Check if we've reached the maximum
          if (galleryRevocations[this.currentGalleryId] > this.maxRevocations) {
            throw new Error('Maximum revocation limit reached');
          }
          
          // Update the revocation count in Firestore
          return db.collection('photographerSettings')
            .doc(currentUser.uid)
            .set({
              galleryRevocations: galleryRevocations,
              lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        })
        .then(() => {
          // SIMPLIFIED: Only delete from galleryShares
          return db.collection('galleryShares')
            .where('galleryId', '==', this.currentGalleryId)
            .where('photographerId', '==', currentUser.uid)
            .get();
        })
        .then(snapshot => {
          if (snapshot.empty) {
            self.showToast('No active shares found for this gallery.', 'info');
            
            // Reset button state and check remaining revocations
            if (revokeBtn) {
              revokeBtn.disabled = false;
              self.checkRemainingRevocations();
            }
            return;
          }
          
          // SIMPLIFIED: Only delete galleryShares documents
          const batch = db.batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          // NO galleries collection updates - completely ignored
          return batch.commit();
        })
        .then(() => {
          console.log("Gallery access revoked - ONLY from galleryShares collection");
          console.log("SIMPLIFIED: galleries collection completely ignored");
          
          // Clear current share URL
          self.currentShareUrl = null;
          self.currentShareId = null;
          
          // Hide share link section
          const shareLinkSection = document.getElementById('shareLinkSection');
          if (shareLinkSection) {
            shareLinkSection.classList.add('hidden');
          }
          
          // Update revoke button with remaining count
          self.checkRemainingRevocations();
          
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
          
          // Get revocation count
          db.collection('photographerSettings')
            .doc(currentUser.uid)
            .get()
            .then(doc => {
              if (doc.exists) {
                const userData = doc.data();
                const galleryRevocations = userData.galleryRevocations || {};
                const usedRevocations = galleryRevocations[self.currentGalleryId] || 0;
                const remainingRevocations = self.maxRevocations - usedRevocations;
                
                // Show success message with revocation info
                self.showToast(`Gallery access revoked successfully. You have ${remainingRevocations} revocation${remainingRevocations === 1 ? '' : 's'} remaining.`, 'success');
              } else {
                self.showToast('Gallery access revoked successfully.', 'success');
              }
            });
          
          // Re-enable upload buttons after revoking access
          const uploadPhotosBtn = document.getElementById('uploadPhotosBtn');
          if (uploadPhotosBtn) {
            uploadPhotosBtn.style.display = 'block';
          }
          
          const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
          if (emptyStateUploadBtn) {
            emptyStateUploadBtn.style.display = 'block';
          }
          
          // Show message about re-enabled uploads
          self.showToast('Gallery sharing has been revoked. Uploads are now enabled.', 'info');
        })
        .catch(error => {
          console.error("Error revoking access:", error);
          
          // Show specific message for max revocation limit
          if (error.message === 'Maximum revocation limit reached') {
            self.showToast('You have used all your revocation attempts for this gallery.', 'warning');
          } else {
            self.showToast('Error revoking access: ' + error.message, 'error');
          }
          
          // Reset button state and check remaining revocations
          if (revokeBtn) {
            revokeBtn.disabled = false;
            self.checkRemainingRevocations();
          }
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
    console.log("Gallery Share Modal exported to window - SIMPLIFIED MODE");
    
    // Add CSS styles for disabled button if not already present
    if (!document.querySelector('style#galleryShareStyles')) {
      const style = document.createElement('style');
      style.id = 'galleryShareStyles';
      style.textContent = `
        .disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        /* Enhance tooltip styling */
        .tooltip-container {
          position: relative;
          display: inline-block;
        }
        
        .tooltip-text {
          visibility: hidden;
          width: 250px;
          background-color: rgba(0, 0, 0, 0.8);
          color: #fff;
          text-align: center;
          border-radius: 6px;
          padding: 10px;
          position: absolute;
          z-index: 1000;
          bottom: 125%;
          left: 50%;
          margin-left: -125px;
          opacity: 0;
          transition: opacity 0.3s;
        }
        
        .tooltip-text::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -5px;
          border-width: 5px;
          border-style: solid;
          border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
        }
        
        .tooltip-container:hover .tooltip-text {
          visibility: visible;
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error("Error initializing Gallery Share Modal:", error);
  }
});
