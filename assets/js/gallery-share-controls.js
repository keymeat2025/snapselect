/**
 * gallery-share-controls.js Gallery Share Controls - SnapSelect
 * 
 * This script enhances the gallery sharing functionality by preventing upload re-enabling
 * after a gallery has been shared at least once.
 * 
 * It intercepts the revoke access event and enforces security controls without modifying
 * the original gallery-share-modal.js file.
 */

// Create a self-executing function to avoid polluting the global namespace
(function() {
  // Configuration options - can be adjusted as needed
  const CONFIG = {
    // Database collection to store sharing history
    sharingHistoryCollection: 'galleryShareHistory',
    
    // Messages shown to users
    messages: {
      revokeWarning: "⚠️ Warning: Revoking access will delete all client selections, comments, and interaction data. For quality assurance, uploads will remain disabled after revocation.",
      successMessage: "Gallery access revoked successfully. Uploads remain disabled to maintain the integrity of previously shared content.",
      errorMessage: "Error updating gallery status. Please try again or contact support."
    },
    
    // Log level (0=none, 1=errors, 2=warnings, 3=info, 4=debug)
    logLevel: 3
  };

  // Initialize the controls when DOM is fully loaded
  document.addEventListener('DOMContentLoaded', initializeControls);

  /**
   * Initialize the gallery share controls
   */
  function initializeControls() {
    logInfo("Initializing Gallery Share Controls...");
    
    // Wait for Firestore to be available
    if (!firebase?.firestore) {
      logError("Firestore not available. Waiting...");
      setTimeout(initializeControls, 500);
      return;
    }
    
    // Setup the revoke button interception
    setupRevokeButtonInterception();
    
    // Enhance tooltips
    enhanceRevokeButtonTooltips();
    
    logInfo("Gallery Share Controls initialized successfully");
  }
  
  /**
   * Intercept the revoke button click
   */
  function setupRevokeButtonInterception() {
    // Track original click handlers to avoid losing them
    const originalHandlers = new WeakMap();
    
    // Find revoke buttons in document or wait for them to appear
    function findAndInterceptButtons() {
      const revokeBtn = document.getElementById('revokeAccessBtn');
      
      if (revokeBtn) {
        interceptRevokeButton(revokeBtn);
      }
      
      // Keep checking for dynamically added buttons
      setTimeout(findAndInterceptButtons, 2000);
    }
    
    findAndInterceptButtons();
    
    /**
     * Intercept a specific revoke button
     * @param {HTMLElement} revokeBtn - The revoke button element
     */
    function interceptRevokeButton(revokeBtn) {
      // Skip if we've already intercepted this button
      if (originalHandlers.has(revokeBtn)) return;
      
      logInfo("Intercepting revoke button:", revokeBtn);
      
      // Clone the button to remove event listeners
      const newRevokeBtn = revokeBtn.cloneNode(true);
      revokeBtn.parentNode.replaceChild(newRevokeBtn, revokeBtn);
      
      // Add our enhanced click handler
      newRevokeBtn.addEventListener('click', function(event) {
        // Store reference to GalleryShareModal
        const modal = window.GalleryShareModal;
        
        if (!modal || !modal.currentGalleryId) {
          logError("Gallery data not available");
          return;
        }
        
        // Show enhanced confirmation dialog
        const confirmRevoke = confirm(CONFIG.messages.revokeWarning);
        
        if (confirmRevoke) {
          // Add permanent share flag before revoking
          addPermanentShareFlag(modal.currentGalleryId)
            .then(() => {
              // Call the original revoke method
              modal.revokeAccess();
              
              // Override the success message with our custom message
              setTimeout(() => {
                // Find any success messages about re-enabling uploads and replace them
                document.querySelectorAll('.toast').forEach(toast => {
                  if (toast.textContent.includes("re-enabled") || 
                      toast.textContent.includes("revoked successfully")) {
                    toast.textContent = CONFIG.messages.successMessage;
                  }
                });
                
                // Ensure upload buttons stay hidden
                keepUploadButtonsDisabled();
              }, 100);
            })
            .catch(error => {
              logError("Error setting permanent share flag:", error);
              alert(CONFIG.messages.errorMessage);
            });
        }
      });
    }
  }
  
  /**
   * Add a permanent share flag to the gallery
   * @param {string} galleryId - The gallery ID
   * @returns {Promise} - Promise that resolves when the flag is set
   */
  function addPermanentShareFlag(galleryId) {
    if (!galleryId) {
      return Promise.reject(new Error("Gallery ID is required"));
    }
    
    const db = firebase.firestore();
    const currentUser = firebase.auth().currentUser;
    
    if (!currentUser) {
      return Promise.reject(new Error("No authenticated user found"));
    }
    
    logInfo("Setting permanent share flag for gallery:", galleryId);
    
    // Add record to share history collection
    const historyRecord = {
      galleryId: galleryId,
      photographerId: currentUser.uid,
      firstSharedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastRevokedAt: firebase.firestore.FieldValue.serverTimestamp(),
      sharingCount: 1, // Increment this in future shares
      revocationCount: 1
    };
    
    // Update the gallery document with a permanent flag
    const galleryUpdate = {
      previouslyShared: true,
      lastShareRevoked: firebase.firestore.FieldValue.serverTimestamp(),
      uploadRestricted: true // This is our key flag to prevent re-enabling uploads
    };
    
    // Use a batch operation for consistency
    const batch = db.batch();
    
    // Check if history document already exists
    return db.collection(CONFIG.sharingHistoryCollection)
      .where('galleryId', '==', galleryId)
      .where('photographerId', '==', currentUser.uid)
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          // Create new history record
          const historyRef = db.collection(CONFIG.sharingHistoryCollection).doc();
          batch.set(historyRef, historyRecord);
        } else {
          // Update existing history record
          const historyDoc = snapshot.docs[0];
          const currentData = historyDoc.data();
          
          batch.update(historyDoc.ref, {
            lastRevokedAt: firebase.firestore.FieldValue.serverTimestamp(),
            revocationCount: (currentData.revocationCount || 0) + 1
          });
        }
        
        // Update the gallery document
        const galleryRef = db.collection('galleries').doc(galleryId);
        batch.update(galleryRef, galleryUpdate);
        
        // Commit the batch
        return batch.commit();
      })
      .then(() => {
        logInfo("Permanent share flag set successfully");
        // Track analytics event
        trackSharingEvent('gallery_revoke_with_restrictions', galleryId);
        return Promise.resolve();
      });
  }
  
  /**
   * Ensure upload buttons remain disabled after revocation
   */
  function keepUploadButtonsDisabled() {
    const uploadBtns = [
      document.getElementById('uploadPhotosBtn'),
      document.getElementById('emptyStateUploadBtn')
    ];
    
    uploadBtns.forEach(btn => {
      if (btn) {
        btn.style.display = 'none';
        
        // Add a helper message near the button
        const parent = btn.parentNode;
        
        // Only add message if it doesn't exist already
        if (parent && !parent.querySelector('.upload-restricted-message')) {
          const messageEl = document.createElement('div');
          messageEl.className = 'upload-restricted-message';
          messageEl.style.color = '#e67e22';
          messageEl.style.margin = '10px 0';
          messageEl.style.fontSize = '14px';
          messageEl.innerHTML = '<i class="fas fa-lock"></i> Uploads disabled - This gallery has been shared with clients';
          
          parent.appendChild(messageEl);
        }
      }
    });
  }
  
  /**
   * Enhance revoke button tooltips
   */
  function enhanceRevokeButtonTooltips() {
    // Check for existing tooltips or tooltip containers
    const tooltipContainers = document.querySelectorAll('.tooltip-container');
    
    if (tooltipContainers.length > 0) {
      // Update existing tooltips
      tooltipContainers.forEach(container => {
        const tooltipText = container.querySelector('.tooltip-text');
        if (tooltipText) {
          tooltipText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: Revoking access will delete all client selections and comments. Uploads will remain disabled after revocation.';
        }
      });
    } else {
      // Wait for the revoke button to appear and then add tooltip
      function addTooltipToRevokeButton() {
        const revokeBtn = document.getElementById('revokeAccessBtn');
        if (!revokeBtn) {
          setTimeout(addTooltipToRevokeButton, 1000);
          return;
        }
        
        // Skip if button already has tooltip container as parent
        if (revokeBtn.parentNode.classList.contains('tooltip-container')) {
          return;
        }
        
        // Create tooltip container
        const container = document.createElement('div');
        container.className = 'tooltip-container';
        
        // Wrap button in the container
        revokeBtn.parentNode.insertBefore(container, revokeBtn);
        container.appendChild(revokeBtn);
        
        // Add tooltip text
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-text tooltip-warning';
        tooltip.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: Revoking access will delete all client selections and comments. Uploads will remain disabled after revocation.';
        
        container.appendChild(tooltip);
      }
      
      addTooltipToRevokeButton();
    }
  }
  
  /**
   * Track sharing events for analytics
   * @param {string} eventName - The event name
   * @param {string} galleryId - The gallery ID
   */
  function trackSharingEvent(eventName, galleryId) {
    logInfo("Tracking event:", eventName, "for gallery:", galleryId);
    
    // Check if analytics available
    if (typeof firebase !== 'undefined' && firebase.analytics) {
      firebase.analytics().logEvent(eventName, {
        gallery_id: galleryId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Also log to share history for admin review
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      if (db && currentUser) {
        // Add event to admin log collection
        db.collection('admin_logs').add({
          event: eventName,
          galleryId: galleryId,
          photographerId: currentUser.uid,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => {
          logError("Error logging admin event:", err);
        });
      }
    } catch (error) {
      logError("Error tracking sharing event:", error);
    }
  }
  
  /**
   * Logging utility functions
   */
  function logError(...args) {
    if (CONFIG.logLevel >= 1) console.error("[GalleryShareControls]", ...args);
  }
  
  function logWarning(...args) {
    if (CONFIG.logLevel >= 2) console.warn("[GalleryShareControls]", ...args);
  }
  
  function logInfo(...args) {
    if (CONFIG.logLevel >= 3) console.info("[GalleryShareControls]", ...args);
  }
  
  function logDebug(...args) {
    if (CONFIG.logLevel >= 4) console.debug("[GalleryShareControls]", ...args);
  }
  
})();
