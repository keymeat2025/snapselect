/**
 * gallery-shre-controls.js Gallery Share Controls - SnapSelect
 * 
 * This script enhances the gallery sharing functionality by implementing smart upload restrictions
 * after a gallery has been shared and revoked, balancing user needs with system integrity.
 * 
 * Features:
 * - 3-hour grace period for accidental shares
 * - Escalating cooling periods for multiple revocations
 * - Limited modifications after revocation (5% of plan limit)
 * - Analytics for monitoring potential abuse
 */

// Create a self-executing function to avoid polluting the global namespace
(function() {
  console.log("🔒 Gallery Share Controls script loaded");
  
  // Configuration options - can be adjusted as needed
  const CONFIG = {
    // Database collection to store sharing history
    sharingHistoryCollection: 'galleryShareHistory',
    
    // Grace period in milliseconds (3 hours)
    gracePeriod: 3 * 60 * 60 * 1000,
    
    // Cooling periods in milliseconds
    coolingPeriods: {
      first: 24 * 60 * 60 * 1000,    // 24 hours
      second: 72 * 60 * 60 * 1000,   // 72 hours
      subsequent: 7 * 24 * 60 * 60 * 1000  // 7 days
    },
    
    // Additional upload allowance (5% of plan limit)
    additionalUploadPercentage: 5,
    
    // Messages shown to users
    messages: {
      initialShareInfo: "Once shared, this gallery will have sharing restrictions to ensure client experience consistency. You'll have 3 hours to revoke without restrictions if needed.",
      
      revokeWarningGracePeriod: "⚠️ Warning: Revoking access will delete all client selections and comments. Since you're within the 3-hour grace period, you can still upload photos normally after revocation.",
      
      revokeWarningFirstRevoke: "⚠️ Warning: Revoking access will delete all client selections and comments. You'll be able to add up to 5% more photos, with full uploads available again after 24 hours.",
      
      revokeWarningSecondRevoke: "⚠️ Warning: Revoking access will delete all client selections and comments. Due to multiple revocations, uploads will be restricted for 72 hours after revocation.",
      
      revokeWarningSubsequentRevoke: "⚠️ Warning: Revoking access will delete all client selections and comments. Due to multiple revocations, uploads will be restricted for 7 days after revocation.",
      
      successMessageGracePeriod: "Gallery access revoked successfully. Since you're within the 3-hour grace period, you can continue to upload photos normally.",
      
      successMessageFirstRevoke: "Gallery access revoked successfully. You can add up to {additionalPhotos} more photos (5% of your plan). Full uploads will be available again on {date}.",
      
      successMessageSecondRevoke: "Gallery access revoked successfully. Due to multiple revocations, uploads will be restricted for 72 hours. Uploads will be available again on {date}.",
      
      successMessageSubsequentRevoke: "Gallery access revoked successfully. To maintain client experience quality, uploads will be restricted for 7 days. Uploads will be available again on {date}.",
      
      errorMessage: "Error updating gallery status. Please try again or contact support."
    },
    
    // Log level (0=none, 1=errors, 2=warnings, 3=info, 4=debug)
    logLevel: 4  // Set to maximum for testing
  };

  // Initialize the controls when DOM is fully loaded
  document.addEventListener('DOMContentLoaded', initializeControls);

  /**
   * Initialize the gallery share controls
   */
  function initializeControls() {
    logInfo("🚀 Initializing Gallery Share Controls...");
    
    // Wait for Firestore to be available
    if (!firebase?.firestore) {
      logError("❌ Firestore not available. Waiting...");
      setTimeout(initializeControls, 500);
      return;
    }
    
    // Check if Gallery Share Modal is loaded
    if (!window.GalleryShareModal) {
      logWarning("⚠️ GalleryShareModal not found yet, waiting...");
      setTimeout(initializeControls, 500);
      return;
    }
    
    logInfo("✅ Dependencies confirmed - Firebase and GalleryShareModal are available");
    
    // Setup the revoke button interception
    setupRevokeButtonInterception();
    
    // Enhance share button with additional info
    enhanceShareButton();
    
    // Enhance tooltips
    enhanceRevokeButtonTooltips();
    
    // Check gallery status for upload restrictions
    checkGalleryStatusForRestrictions();
    
    logInfo("✅ Gallery Share Controls initialized successfully");
  }
  
  /**
   * Add info message to the share button
   */
  function enhanceShareButton() {
    logDebug("Enhancing share button with info message");
    
    // Find the share gallery button
    const shareGalleryBtn = document.getElementById('shareGalleryBtn');
    
    if (shareGalleryBtn) {
      logDebug("Share button found, adding tooltip");
      // Create a tooltip for the share button
      shareGalleryBtn.setAttribute('title', CONFIG.messages.initialShareInfo);
      
      // Also try to add a proper tooltip if we have Bootstrap or similar
      if (typeof $ !== 'undefined' && typeof $.fn.tooltip === 'function') {
        $(shareGalleryBtn).tooltip({
          title: CONFIG.messages.initialShareInfo,
          placement: 'bottom'
        });
      }
    } else {
      logWarning("⚠️ Share gallery button not found");
    }
  }
  
  /**
   * Check gallery status for any upload restrictions
   */
  function checkGalleryStatusForRestrictions() {
    try {
      logDebug("Checking gallery status for upload restrictions");
      
      // Get gallery ID from the URL or available data
      const galleryId = getGalleryIdFromUrl() || 
                        (window.galleryData && window.galleryData.id) || 
                        (window.GalleryShareModal && window.GalleryShareModal.currentGalleryId);
      
      if (!galleryId) {
        logInfo("📋 No gallery ID found, skipping restriction check");
        return;
      }
      
      logInfo(`📋 Checking restrictions for gallery: ${galleryId}`);
      
      const db = firebase.firestore();
      
      // Get the gallery document
      db.collection('galleries').doc(galleryId).get()
        .then(doc => {
          if (!doc.exists) {
            logWarning(`⚠️ Gallery not found: ${galleryId}`);
            return;
          }
          
          const galleryData = doc.data();
          logDebug("Gallery data retrieved:", galleryData);
          
          // Check if the gallery has an active cooling period
          if (galleryData.uploadRestrictedUntil) {
            const restrictedUntil = galleryData.uploadRestrictedUntil.toDate ? 
                                   galleryData.uploadRestrictedUntil.toDate() : 
                                   new Date(galleryData.uploadRestrictedUntil);
            
            const now = new Date();
            
            if (restrictedUntil > now) {
              // Still in cooling period, disable uploads
              logInfo(`🔒 Gallery has active cooling period until ${restrictedUntil.toLocaleString()}`);
              disableUploads(restrictedUntil);
              
              // Add message about restricted uploads
              showUploadRestrictedMessage(restrictedUntil);
            } else {
              // Cooling period expired, make sure uploads are enabled
              logInfo("✅ Cooling period expired, enabling uploads");
              enableUploads();
              
              // Update the database to clear the restriction
              db.collection('galleries').doc(galleryId).update({
                uploadRestricted: false,
                uploadRestrictedUntil: null
              }).then(() => {
                logInfo("✅ Restriction cleared in database");
              }).catch(error => {
                logError("❌ Error clearing upload restriction:", error);
              });
            }
          } else if (galleryData.uploadRestricted) {
            // Legacy flag without expiry, check for share history
            logInfo("🔍 Gallery has legacy restriction flag, checking share history");
            checkShareHistoryForRestrictions(galleryId);
          } else {
            logInfo("✅ No upload restrictions found for this gallery");
          }
        })
        .catch(error => {
          logError("❌ Error checking gallery status:", error);
        });
    } catch (error) {
      logError("❌ Error in checkGalleryStatusForRestrictions:", error);
    }
  }
  
  /**
   * Check share history to determine appropriate restrictions
   */
  function checkShareHistoryForRestrictions(galleryId) {
    logDebug(`Checking share history for gallery: ${galleryId}`);
    
    const db = firebase.firestore();
    const currentUser = firebase.auth().currentUser;
    
    if (!currentUser) {
      logError("❌ No authenticated user found");
      return;
    }
    
    // Get share history for this gallery
    db.collection(CONFIG.sharingHistoryCollection)
      .where('galleryId', '==', galleryId)
      .where('photographerId', '==', currentUser.uid)
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          // No history found, no restrictions needed
          logInfo("📋 No share history found, no restrictions needed");
          enableUploads();
          return;
        }
        
        const historyData = snapshot.docs[0].data();
        logDebug("Share history found:", historyData);
        
        // Check for last revocation time
        if (historyData.lastRevokedAt) {
          const lastRevokedAt = historyData.lastRevokedAt.toDate ? 
                               historyData.lastRevokedAt.toDate() : 
                               new Date(historyData.lastRevokedAt);
          
          const now = new Date();
          const timeSinceRevocation = now - lastRevokedAt;
          
          logInfo(`📅 Last revoked at: ${lastRevokedAt.toLocaleString()}, time since: ${Math.round(timeSinceRevocation / (1000 * 60 * 60))} hours`);
          
          // Check if within grace period
          if (timeSinceRevocation <= CONFIG.gracePeriod) {
            // Within grace period, enable uploads
            logInfo("✅ Within grace period, enabling uploads");
            enableUploads();
          } else {
            // Determine cooling period based on revocation count
            let coolingPeriodEnd;
            
            if (historyData.revocationCount === 1) {
              coolingPeriodEnd = new Date(lastRevokedAt.getTime() + CONFIG.coolingPeriods.first);
              logInfo(`📅 First revocation cooling period ends: ${coolingPeriodEnd.toLocaleString()}`);
            } else if (historyData.revocationCount === 2) {
              coolingPeriodEnd = new Date(lastRevokedAt.getTime() + CONFIG.coolingPeriods.second);
              logInfo(`📅 Second revocation cooling period ends: ${coolingPeriodEnd.toLocaleString()}`);
            } else {
              coolingPeriodEnd = new Date(lastRevokedAt.getTime() + CONFIG.coolingPeriods.subsequent);
              logInfo(`📅 Subsequent revocation cooling period ends: ${coolingPeriodEnd.toLocaleString()}`);
            }
            
            // Check if cooling period has ended
            if (now >= coolingPeriodEnd) {
              // Cooling period over, enable uploads
              logInfo("✅ Cooling period has ended, enabling uploads");
              enableUploads();
              
              // Update database to reflect this
              db.collection('galleries').doc(galleryId).update({
                uploadRestricted: false,
                uploadRestrictedUntil: null
              }).then(() => {
                logInfo("✅ Restriction cleared in database");
              }).catch(error => {
                logError("❌ Error clearing upload restriction:", error);
              });
            } else {
              // Still in cooling period, maintain restrictions
              logInfo("🔒 Still in cooling period, maintaining restrictions");
              disableUploads(coolingPeriodEnd);
              
              // Show cooling period message
              showUploadRestrictedMessage(coolingPeriodEnd);
              
              // Ensure database has the right values
              db.collection('galleries').doc(galleryId).update({
                uploadRestricted: true,
                uploadRestrictedUntil: firebase.firestore.Timestamp.fromDate(coolingPeriodEnd)
              }).then(() => {
                logInfo("✅ Restriction updated in database");
              }).catch(error => {
                logError("❌ Error updating upload restriction:", error);
              });
            }
          }
        }
      })
      .catch(error => {
        logError("❌ Error checking share history:", error);
      });
  }
  
  /**
   * Setup revoke button interception
   */
  function setupRevokeButtonInterception() {
    logDebug("Setting up revoke button interception");
    
    // Track original click handlers to avoid losing them
    const originalHandlers = new WeakMap();
    
    // Find revoke buttons in document or wait for them to appear
    function findAndInterceptButtons() {
      const revokeBtn = document.getElementById('revokeAccessBtn');
      
      if (revokeBtn) {
        interceptRevokeButton(revokeBtn);
      } else {
        logDebug("Revoke button not found, will check again later");
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
      if (originalHandlers.has(revokeBtn)) {
        logDebug("Button already intercepted, skipping");
        return;
      }
      
      logInfo("🎯 Intercepting revoke button:", revokeBtn);
      
      // Clone the button to remove event listeners
      const newRevokeBtn = revokeBtn.cloneNode(true);
      revokeBtn.parentNode.replaceChild(newRevokeBtn, revokeBtn);
      
      // Add our enhanced click handler
      newRevokeBtn.addEventListener('click', function(event) {
        logInfo("🖱️ Revoke button clicked");
        
        // Store reference to GalleryShareModal
        const modal = window.GalleryShareModal;
        
        if (!modal || !modal.currentGalleryId) {
          logError("❌ Gallery data not available");
          return;
        }
        
        logInfo(`📋 Processing revocation for gallery: ${modal.currentGalleryId}`);
        
        // Get share history to determine appropriate message and restrictions
        getShareHistory(modal.currentGalleryId)
          .then(historyData => {
            logDebug("Share history retrieved:", historyData);
            
            // Determine warning message based on sharing history
            let warningMessage = getAppropriateRevokeWarning(historyData);
            logInfo(`⚠️ Selected warning message: ${warningMessage.substring(0, 50)}...`);
            
            // Show enhanced confirmation dialog
            const confirmRevoke = confirm(warningMessage);
            
            if (confirmRevoke) {
              // Set the button to loading state
              newRevokeBtn.textContent = 'Revoking...';
              newRevokeBtn.disabled = true;
              
              // Process the revocation with appropriate restrictions
              processRevocation(modal.currentGalleryId, historyData)
                .then(result => {
                  logInfo("✅ Revocation processed successfully, result:", result);
                  
                  // Call the original revoke method
                  logDebug("Calling original revokeAccess method");
                  modal.revokeAccess();
                  
                  // Override the success message with our custom message
                  setTimeout(() => {
                    // Find any success messages about re-enabling uploads and replace them
                    document.querySelectorAll('.toast').forEach(toast => {
                      if (toast.textContent.includes("re-enabled") || 
                          toast.textContent.includes("revoked successfully")) {
                        logDebug(`Replacing toast message: "${toast.textContent}" with "${result.message}"`);
                        toast.textContent = result.message;
                      }
                    });
                    
                    // Update UI based on restriction type
                    if (result.restrictionType !== 'none') {
                      // Apply restrictions
                      if (result.restrictionType === 'cooling_period') {
                        logInfo("🔒 Applying cooling period restrictions");
                        disableUploads(result.restrictedUntil);
                        showUploadRestrictedMessage(result.restrictedUntil);
                      } else if (result.restrictionType === 'partial') {
                        // Allow limited uploads
                        logInfo(`🔓 Allowing limited uploads (${result.additionalPhotos} photos)`);
                        enableUploadsWithLimit(result.additionalPhotos);
                      }
                    } else {
                      // No restrictions, ensure uploads are enabled
                      logInfo("✅ No restrictions needed, ensuring uploads are enabled");
                      enableUploads();
                    }
                  }, 100);
                })
                .catch(error => {
                  logError("❌ Error processing revocation:", error);
                  alert(CONFIG.messages.errorMessage);
                  
                  // Reset button state
                  newRevokeBtn.textContent = 'Revoke Access';
                  newRevokeBtn.disabled = false;
                });
            } else {
              logInfo("User cancelled revocation");
            }
          })
          .catch(error => {
            logError("❌ Error getting share history:", error);
            
            // Fallback to default warning
            const confirmRevoke = confirm(CONFIG.messages.revokeWarningFirstRevoke);
            
            if (confirmRevoke) {
              // Call the original revoke method
              modal.revokeAccess();
            }
          });
      });
      
      logInfo("✅ Revoke button successfully intercepted");
    }
  }
  
  /**
   * Get appropriate revoke warning based on sharing history
   * @param {Object} historyData - The sharing history data
   * @returns {string} The appropriate warning message
   */
  function getAppropriateRevokeWarning(historyData) {
    logDebug("Determining appropriate revoke warning based on history:", historyData);
    
    // Default message if no history
    if (!historyData) {
      logDebug("No history data, using first revoke warning");
      return CONFIG.messages.revokeWarningFirstRevoke;
    }
    
    // Check if within grace period
    if (historyData.lastSharedAt) {
      const lastSharedAt = historyData.lastSharedAt.toDate ? 
                         historyData.lastSharedAt.toDate() : 
                         new Date(historyData.lastSharedAt);
      
      const now = new Date();
      const timeSinceSharing = now - lastSharedAt;
      
      logDebug(`Time since sharing: ${Math.round(timeSinceSharing / 1000 / 60)} minutes, grace period: ${Math.round(CONFIG.gracePeriod / 1000 / 60)} minutes`);
      
      if (timeSinceSharing <= CONFIG.gracePeriod) {
        logDebug("Within grace period, using grace period warning");
        return CONFIG.messages.revokeWarningGracePeriod;
      }
    }
    
    // Determine message based on revocation count
    const revocationCount = historyData.revocationCount || 0;
    logDebug(`Revocation count: ${revocationCount}`);
    
    if (revocationCount === 0) {
      return CONFIG.messages.revokeWarningFirstRevoke;
    } else if (revocationCount === 1) {
      return CONFIG.messages.revokeWarningSecondRevoke;
    } else {
      return CONFIG.messages.revokeWarningSubsequentRevoke;
    }
  }
  
  /**
   * Get share history for a gallery
   * @param {string} galleryId - The gallery ID
   * @returns {Promise<Object>} Promise resolving to share history data
   */
  async function getShareHistory(galleryId) {
    logDebug(`Getting share history for gallery: ${galleryId}`);
    
    if (!galleryId) {
      return Promise.reject(new Error("Gallery ID is required"));
    }
    
    const db = firebase.firestore();
    const currentUser = firebase.auth().currentUser;
    
    if (!currentUser) {
      return Promise.reject(new Error("No authenticated user found"));
    }
    
    // Get share history for this gallery
    const snapshot = await db.collection(CONFIG.sharingHistoryCollection)
      .where('galleryId', '==', galleryId)
      .where('photographerId', '==', currentUser.uid)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      // Check if the gallery has been shared before
      const galleryDoc = await db.collection('galleries').doc(galleryId).get();
      
      if (galleryDoc.exists && galleryDoc.data().previouslyShared) {
        // Gallery was shared before but no history record found
        // This is a legacy case, create an estimated history
        logInfo("📋 Gallery previously shared but no history record, creating legacy record");
        return {
          galleryId: galleryId,
          photographerId: currentUser.uid,
          estimatedFromLegacy: true,
          sharingCount: 1,
          revocationCount: 0
        };
      }
      
      // No history found
      logInfo("📋 No share history found for gallery");
      return null;
    }
    
    // Return the history data
    const historyData = snapshot.docs[0].data();
    logInfo("📋 Share history retrieved:", historyData);
    return historyData;
  }
  
  /**
   * Process revocation with appropriate restrictions
   * @param {string} galleryId - The gallery ID 
   * @param {Object} historyData - The sharing history data
   * @returns {Promise<Object>} Promise resolving to result object
   */
  async function processRevocation(galleryId, historyData) {
    logDebug(`Processing revocation for gallery: ${galleryId}`);
    
    if (!galleryId) {
      return Promise.reject(new Error("Gallery ID is required"));
    }
    
    const db = firebase.firestore();
    const currentUser = firebase.auth().currentUser;
    
    if (!currentUser) {
      return Promise.reject(new Error("No authenticated user found"));
    }
    
    // Get the gallery document to determine plan limits
    const galleryDoc = await db.collection('galleries').doc(galleryId).get();
    if (!galleryDoc.exists) {
      return Promise.reject(new Error("Gallery not found"));
    }
    
    const galleryData = galleryDoc.data();
    const photosCount = galleryData.photosCount || 0;
    
    logDebug(`Gallery has ${photosCount} photos`);
    
    // Get photographer's plan to determine photo limits
    let planLimit = 100; // Default limit if not found
    
    try {
      // Try to get the plan info - this depends on your database structure
      // Modify this section based on your actual plan storage
      if (galleryData.planId) {
        const planDoc = await db.collection('client-plans').doc(galleryData.planId).get();
        if (planDoc.exists) {
          const planData = planDoc.data();
          planLimit = planData.photoLimit || 100;
          logDebug(`Found plan with limit: ${planLimit} photos`);
        }
      }
    } catch (error) {
      logWarning("⚠️ Error getting plan limit, using default:", error);
    }
    
    // Calculate additional photos allowed (5% of plan limit)
    const additionalPhotos = Math.ceil(planLimit * (CONFIG.additionalUploadPercentage / 100));
    logDebug(`Calculated additional photos allowed: ${additionalPhotos}`);
    
    // Determine restriction type and duration
    let restrictionType = 'none';
    let restrictedUntil = null;
    let revocationCount = (historyData?.revocationCount || 0) + 1;
    let successMessage = '';
    
    // Check if within grace period
    let withinGracePeriod = false;
    
    if (historyData?.lastSharedAt) {
      const lastSharedAt = historyData.lastSharedAt.toDate ? 
                          historyData.lastSharedAt.toDate() : 
                          new Date(historyData.lastSharedAt);
      
      const now = new Date();
      const timeSinceSharing = now - lastSharedAt;
      
      withinGracePeriod = (timeSinceSharing <= CONFIG.gracePeriod);
      logDebug(`Within grace period: ${withinGracePeriod}`);
    }
    
    if (withinGracePeriod) {
      // Within grace period - no restrictions
      restrictionType = 'none';
      successMessage = CONFIG.messages.successMessageGracePeriod;
      logInfo("📋 Within grace period - no restrictions will be applied");
    } else if (revocationCount === 1) {
      // First revocation outside grace period - partial restriction
      restrictionType = 'partial';
      restrictedUntil = new Date(Date.now() + CONFIG.coolingPeriods.first);
      successMessage = CONFIG.messages.successMessageFirstRevoke
        .replace('{additionalPhotos}', additionalPhotos)
        .replace('{date}', formatDate(restrictedUntil));
      logInfo(`📋 First revocation - partial restriction until ${restrictedUntil.toLocaleString()}`);
    } else if (revocationCount === 2) {
      // Second revocation - cooling period
      restrictionType = 'cooling_period';
      restrictedUntil = new Date(Date.now() + CONFIG.coolingPeriods.second);
      successMessage = CONFIG.messages.successMessageSecondRevoke
        .replace('{date}', formatDate(restrictedUntil));
      logInfo(`📋 Second revocation - cooling period until ${restrictedUntil.toLocaleString()}`);
    } else {
      // Third or subsequent revocation - longer cooling period
      restrictionType = 'cooling_period';
      restrictedUntil = new Date(Date.now() + CONFIG.coolingPeriods.subsequent);
      successMessage = CONFIG.messages.successMessageSubsequentRevoke
        .replace('{date}', formatDate(restrictedUntil));
      logInfo(`📋 Subsequent revocation - extended cooling period until ${restrictedUntil.toLocaleString()}`);
    }
    
    // Prepare history record for new entry or update
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    
    let historyRecord = {
      galleryId: galleryId,
      photographerId: currentUser.uid,
      lastRevokedAt: timestamp,
      revocationCount: revocationCount
    };
    
    if (!historyData) {
      // First time sharing this gallery
      historyRecord.firstSharedAt = timestamp;
      historyRecord.lastSharedAt = timestamp;
      historyRecord.sharingCount = 1;
    }
    
    // Prepare gallery update data
    const galleryUpdate = {
      previouslyShared: true,
      lastShareRevoked: timestamp
    };
    
    // Set upload restrictions based on type
    if (restrictionType === 'cooling_period') {
      galleryUpdate.uploadRestricted = true;
      galleryUpdate.uploadRestrictedUntil = firebase.firestore.Timestamp.fromDate(restrictedUntil);
      galleryUpdate.additionalPhotosAllowed = 0;
    } else if (restrictionType === 'partial') {
      galleryUpdate.uploadRestricted = true;
      galleryUpdate.uploadRestrictedUntil = firebase.firestore.Timestamp.fromDate(restrictedUntil);
      galleryUpdate.additionalPhotosAllowed = additionalPhotos;
    } else {
      galleryUpdate.uploadRestricted = false;
      galleryUpdate.uploadRestrictedUntil = null;
      galleryUpdate.additionalPhotosAllowed = null;
    }
    
    logDebug("Updates to be applied:", {
      historyRecord: historyRecord,
      galleryUpdate: galleryUpdate
    });
    
    // Use a batch operation for consistency
    const batch = db.batch();
    
    // Check if history document already exists
    const historySnapshot = await db.collection(CONFIG.sharingHistoryCollection)
      .where('galleryId', '==', galleryId)
      .where('photographerId', '==', currentUser.uid)
      .limit(1)
      .get();
    
    if (historySnapshot.empty) {
      // Create new history record
      const historyRef = db.collection(CONFIG.sharingHistoryCollection).doc();
      batch.set(historyRef, historyRecord);
      logDebug("Creating new history record");
    } else {
      // Update existing history record
      const historyDoc = historySnapshot.docs[0];
      batch.update(historyDoc.ref, historyRecord);
      logDebug("Updating existing history record");
    }
    
    // Update the gallery document
    const galleryRef = db.collection('galleries').doc(galleryId);
    batch.update(galleryRef, galleryUpdate);
    
    // Commit the batch
    await batch.commit();
    logInfo("✅ Batch update committed successfully");
    
    // Log for analytics
    trackSharingEvent('gallery_revoke_with_restrictions', galleryId, {
      restrictionType,
      revocationCount,
      withinGracePeriod
    });
    
    // Return the result
    return {
      restrictionType,
      restrictedUntil,
      additionalPhotos,
      message: successMessage
    };
  }
  
  /**
   * Get gallery ID from URL
   * @returns {string|null} Gallery ID if found, null otherwise
   */
  function getGalleryIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  }
  
  /**
   * Enable uploads for the gallery
   */
  function enableUploads() {
    logDebug("Enabling uploads");
    
    const uploadBtns = [
      document.getElementById('uploadPhotosBtn'),
      document.getElementById('emptyStateUploadBtn')
    ];
    
    uploadBtns.forEach(btn => {
      if (btn) {
        btn.style.display = 'block';
        btn.disabled = false;
        
        // Remove any limit badges
        const limitBadge = btn.querySelector('.upload-limit-badge');
        if (limitBadge) {
          limitBadge.remove();
        }
        
        // Restore original text if it was saved
        if (btn.hasAttribute('data-original-text')) {
          btn.textContent = btn.getAttribute('data-original-text');
        }
      }
    });
    
    // Remove any restriction messages
    const restrictionMessages = document.querySelectorAll('.upload-restricted-message');
    restrictionMessages.forEach(msg => msg.remove());
    
    logInfo("✅ Uploads enabled successfully");
  }
  
  /**
   * Disable uploads for the gallery
   * @param {Date} restrictedUntil - Date when uploads will be re-enabled
   */
  function disableUploads(restrictedUntil) {
    logDebug(`Disabling uploads until ${restrictedUntil.toLocaleString()}`);
    
    const uploadBtns = [
      document.getElementById('uploadPhotosBtn'),
      document.getElementById('emptyStateUploadBtn')
    ];
    
    uploadBtns.forEach(btn => {
      if (btn) {
        btn.style.display = 'none';
        btn.disabled = true;
      }
    });
    
    logInfo("🔒 Uploads disabled successfully");
  }
  
  /**
   * Enable uploads with a limit
   * @param {number} limit - The number of additional photos allowed
   */
  function enableUploadsWithLimit(limit) {
    logDebug(`Enabling uploads with limit of ${limit} photos`);
    
    const uploadBtns = [
      document.getElementById('uploadPhotosBtn'),
      document.getElementById('emptyStateUploadBtn')
    ];
    
    uploadBtns.forEach(btn => {
      if (btn) {
        btn.style.display = 'block';
        btn.disabled = false;
        
        // Update button text to show limit
        const originalText = btn.textContent || btn.innerText;
        if (!originalText.includes('(')) {
          btn.setAttribute('data-original-text', originalText);
          btn.innerHTML = `${originalText} <span class="upload-limit-badge">(${limit} left)</span>`;
        }
      }
    });
    
    // Add a helper message
    const container = document.querySelector('.gallery-actions') || 
                     document.querySelector('.gallery-info-container');
    
    if (container) {
      // Remove existing messages first
      const existingMessages = document.querySelectorAll('.upload-restricted-message');
      existingMessages.forEach(msg => msg.remove());
      
      // Create the message element
      const messageEl = document.createElement('div');
      messageEl.className = 'upload-restricted-message upload-limit-message';
      messageEl.style.color = '#3498db';
      messageEl.style.margin = '10px 0';
      messageEl.style.fontSize = '14px';
      messageEl.style.padding = '10px';
      messageEl.style.backgroundColor = '#edf7fd';
      messageEl.style.border = '1px solid #d4e9f7';
      messageEl.style.borderRadius = '4px';
      
      messageEl.innerHTML = `
        <i class="fas fa-info-circle"></i> Limited uploads - You can upload up to ${limit} more photos to this gallery.
      `;
      
      container.appendChild(messageEl);
    }
    
    logInfo(`✅ Uploads enabled with limit of ${limit} photos`);
  }
  
  /**
   * Show message about upload restrictions
   * @param {Date} restrictedUntil - Date when uploads will be re-enabled
   */
  function showUploadRestrictedMessage(restrictedUntil) {
    logDebug(`Showing upload restriction message until ${restrictedUntil.toLocaleString()}`);
    
    // Format the date nicely
    const formattedDate = formatDate(restrictedUntil);
    
    // Find a suitable container for the message
    const container = document.querySelector('.gallery-actions') || 
                     document.querySelector('.gallery-info-container') ||
                     document.querySelector('.gallery-content-section');
    
    if (!container) {
      logWarning("⚠️ Could not find suitable container for restriction message");
      return;
    }
    
    // Remove existing messages first
    const existingMessages = document.querySelectorAll('.upload-restricted-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create the message element
    const messageEl = document.createElement('div');
    messageEl.className = 'upload-restricted-message';
    messageEl.style.color = '#e67e22';
    messageEl.style.margin = '10px 0';
    messageEl.style.fontSize = '14px';
    messageEl.style.padding = '10px';
    messageEl.style.backgroundColor = '#fef9e7';
    messageEl.style.border = '1px solid #fbe5c1';
    messageEl.style.borderRadius = '4px';
    
    messageEl.innerHTML = `
      <i class="fas fa-lock"></i> Uploads restricted - This gallery has been shared and revoked. 
      Uploads will be available again on ${formattedDate}.
    `;
    
    // Add the message to the container
    container.appendChild(messageEl);
    
    logInfo("✅ Upload restriction message shown successfully");
  }
  
  /**
   * Enhance revoke button tooltips
   */
  function enhanceRevokeButtonTooltips() {
    logDebug("Enhancing revoke button tooltips");
    
    // Check for existing tooltips or tooltip containers
    const tooltipContainers = document.querySelectorAll('.tooltip-container');
    
    if (tooltipContainers.length > 0) {
      // Update existing tooltips - content will be set dynamically before use
      logDebug("Updating existing tooltips");
      tooltipContainers.forEach(container => {
        const tooltipText = container.querySelector('.tooltip-text');
        if (tooltipText) {
          tooltipText.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: Revoking access will delete all client selections and comments.';
        }
      });
    } else {
      // Wait for the revoke button to appear and then add tooltip
      function addTooltipToRevokeButton() {
        const revokeBtn = document.getElementById('revokeAccessBtn');
        if (!revokeBtn) {
          logDebug("Revoke button not found, will check again later");
          setTimeout(addTooltipToRevokeButton, 1000);
          return;
        }
        
        // Skip if button already has tooltip container as parent
        if (revokeBtn.parentNode.classList.contains('tooltip-container')) {
          logDebug("Button already has tooltip, skipping");
          return;
        }
        
        logDebug("Adding tooltip to revoke button");
        // Create tooltip container
        const container = document.createElement('div');
        container.className = 'tooltip-container';
        
        // Wrap button in the container
        revokeBtn.parentNode.insertBefore(container, revokeBtn);
        container.appendChild(revokeBtn);
        
        // Add tooltip text
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-text tooltip-warning';
        tooltip.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Warning: Revoking access will delete all client selections and comments.';
        
        container.appendChild(tooltip);
        
        logInfo("✅ Tooltip added to revoke button");
      }
      
      addTooltipToRevokeButton();
    }
  }
  
  /**
   * Track sharing events for analytics
   * @param {string} eventName - The event name
   * @param {string} galleryId - The gallery ID
   * @param {Object} extraData - Additional data to log
   */
  function trackSharingEvent(eventName, galleryId, extraData = {}) {
    logInfo(`📊 Tracking event: ${eventName} for gallery: ${galleryId}`, extraData);
    
    // Check if analytics available
    if (typeof firebase !== 'undefined' && firebase.analytics) {
      firebase.analytics().logEvent(eventName, {
        gallery_id: galleryId,
        timestamp: new Date().toISOString(),
        ...extraData
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
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          details: extraData
        }).then(() => {
          logDebug("Event logged to admin_logs");
        }).catch(err => {
          logError("❌ Error logging admin event:", err);
        });
      }
    } catch (error) {
      logError("❌ Error tracking sharing event:", error);
    }
  }
  
  /**
   * Format a date for display
   * @param {Date} date - The date to format
   * @returns {string} Formatted date string
   */
  function formatDate(date) {
    if (!date) return '';
    
    return date.toLocaleString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  /**
   * Logging utility functions
   */
  function logError(...args) {
    if (CONFIG.logLevel >= 1) console.error("❌ [GalleryShareControls]", ...args);
  }
  
  function logWarning(...args) {
    if (CONFIG.logLevel >= 2) console.warn("⚠️ [GalleryShareControls]", ...args);
  }
  
  function logInfo(...args) {
    if (CONFIG.logLevel >= 3) console.info("ℹ️ [GalleryShareControls]", ...args);
  }
  
  function logDebug(...args) {
    if (CONFIG.logLevel >= 4) console.debug("🔍 [GalleryShareControls]", ...args);
  }
  
})();
