/**
 * gallery-share-controls.js Gallery Share Controls - SnapSelect
 * 
 * This script enhances the gallery sharing functionality by implementing smart upload restrictions
 * after a gallery has been shared and revoked, balancing user needs with system integrity.
 * 
 * Features:
 * - 3-hour grace period for accidental shares
 * - Permanent 5% upload limit after first share/revoke
 * - Escalating cooling periods for multiple revocations
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
      
      revokeWarningFirstRevoke: "⚠️ Warning: Revoking access will delete all client selections and comments. After revocation, you'll be permanently limited to adding 5% more photos to this gallery. Additionally, uploads will be temporarily disabled until {date}.",
      
      revokeWarningSecondRevoke: "⚠️ Warning: Revoking access will delete all client selections and comments. Your permanent 5% upload limit remains in effect. Additionally, due to multiple revocations, uploads will be completely disabled for 72 hours, until {date}.",
      
      revokeWarningSubsequentRevoke: "⚠️ Warning: Revoking access will delete all client selections and comments. Your permanent 5% upload limit remains in effect. Due to multiple revocations, uploads will be completely disabled for 7 days, until {date}.",
      
      successMessageGracePeriod: "Gallery access revoked successfully. Since you're within the 3-hour grace period, you can continue to upload photos normally.",
      
      successMessageFirstRevoke: "Gallery access revoked successfully. You now have a permanent limit of {additionalPhotos} additional photos (5% of your plan) for this gallery. Uploads will be available again on {date}.",
      
      successMessageSecondRevoke: "Gallery access revoked successfully. Your permanent 5% upload limit remains in effect. Due to multiple revocations, uploads will be completely restricted until {date}.",
      
      successMessageSubsequentRevoke: "Gallery access revoked successfully. Your permanent 5% upload limit remains in effect. Due to multiple revocations, uploads will be completely restricted until {date}.",
      
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
    
    // Intercept upload functions to enforce limits
    interceptUploadFunctions();
    
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
   * Intercept upload functions to enforce limits
   */
  function interceptUploadFunctions() {
    logDebug("Setting up upload function interception");
    
    // Find the start upload button
    const startUploadBtn = document.getElementById('startUploadBtn');
    if (startUploadBtn) {
      logDebug("Found start upload button, adding interceptor");
      
      // Clone the button to remove event listeners
      const newStartUploadBtn = startUploadBtn.cloneNode(true);
      startUploadBtn.parentNode.replaceChild(newStartUploadBtn, startUploadBtn);
      
      // Add our enhanced click handler
      newStartUploadBtn.addEventListener('click', function(event) {
        logInfo("🖱️ Start upload button clicked");
        
        // Get gallery ID
        const galleryId = getGalleryIdFromUrl() || 
                         (window.galleryData && window.galleryData.id) || 
                         (window.GalleryShareModal && window.GalleryShareModal.currentGalleryId);
        
        if (!galleryId) {
          logWarning("⚠️ No gallery ID found, skipping limit check");
          
          // Call original handler if it exists
          if (window.galleryView && window.galleryView.startPhotoUpload) {
            window.galleryView.startPhotoUpload();
          }
          return;
        }
        
        // Check if we're in a cooling period
        isGalleryInCoolingPeriod(galleryId).then(result => {
          if (result.inCoolingPeriod) {
            // In cooling period, block upload
            logInfo("🔒 Gallery in cooling period, blocking upload");
            alert(`Uploads are currently restricted until ${formatDate(result.restrictedUntil)}. Please try again later.`);
            return;
          }
          
          // Not in cooling period, check upload limits
          checkRemainingUploadAllowance(galleryId).then(allowance => {
            // Get selected files
            const fileInput = document.getElementById('photoFileInput');
            
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
              logWarning("⚠️ No files selected for upload");
              
              // Call original handler
              if (window.galleryView && window.galleryView.startPhotoUpload) {
                window.galleryView.startPhotoUpload();
              }
              return;
            }
            
            const filesCount = fileInput.files.length;
            logInfo(`📂 User trying to upload ${filesCount} files, remaining allowance: ${allowance.remainingAllowance}`);
            
            if (allowance.isLimited && filesCount > allowance.remainingAllowance) {
              // Exceeds limit, show error
              logWarning(`⚠️ Upload exceeds limit: ${filesCount} > ${allowance.remainingAllowance}`);
              alert(`You can only upload ${allowance.remainingAllowance} more photos to this gallery due to sharing restrictions. Please reduce your selection.`);
              return;
            }
            
            // Within limits, allow upload
            logInfo("✅ Upload within limits, proceeding");
            
            // Call original handler
            if (window.galleryView && window.galleryView.startPhotoUpload) {
              window.galleryView.startPhotoUpload();
              
              // Update remaining count after successful upload
              if (allowance.isLimited) {
                setTimeout(() => {
                  // Check if upload was successful by looking for progress indicators
                  const progressContainer = document.getElementById('uploadProgressContainer');
                  if (progressContainer && progressContainer.style.display !== 'none') {
                    // Upload in progress, update count after it completes
                    logDebug("Upload in progress, will update counts after completion");
                    
                    // Try to find the upload complete event
                    const updateCountAfterUpload = setInterval(() => {
                      const progressBar = document.getElementById('totalProgressBar');
                      if (progressBar && progressBar.style.width === '100%') {
                        clearInterval(updateCountAfterUpload);
                        
                        // Update the remaining count in database
                        updateRemainingUploadAllowance(galleryId, filesCount);
                      }
                    }, 1000);
                  }
                }, 500);
              }
            }
          }).catch(error => {
            logError("❌ Error checking upload allowance:", error);
            
            // Call original handler as fallback
            if (window.galleryView && window.galleryView.startPhotoUpload) {
              window.galleryView.startPhotoUpload();
            }
          });
        }).catch(error => {
          logError("❌ Error checking cooling period:", error);
          
          // Call original handler as fallback
          if (window.galleryView && window.galleryView.startPhotoUpload) {
            window.galleryView.startPhotoUpload();
          }
        });
      });
      
      logInfo("✅ Upload button successfully intercepted");
    } else {
      logWarning("⚠️ Start upload button not found, will check again later");
      setTimeout(interceptUploadFunctions, 2000);
    }
  }
  
  /**
   * Check if gallery is in a cooling period
   * @param {string} galleryId - The gallery ID
   * @returns {Promise<Object>} Promise resolving to cooling period status
   */
  async function isGalleryInCoolingPeriod(galleryId) {
    logDebug(`Checking if gallery ${galleryId} is in cooling period`);
    
    try {
      const db = firebase.firestore();
      const galleryDoc = await db.collection('galleries').doc(galleryId).get();
      
      if (!galleryDoc.exists) {
        return { inCoolingPeriod: false };
      }
      
      const galleryData = galleryDoc.data();
      
      // Check if gallery has an active cooling period
      if (galleryData.uploadRestrictedUntil) {
        const restrictedUntil = galleryData.uploadRestrictedUntil.toDate ? 
                              galleryData.uploadRestrictedUntil.toDate() : 
                              new Date(galleryData.uploadRestrictedUntil);
        
        const now = new Date();
        
        if (restrictedUntil > now) {
          logInfo(`🔒 Gallery in cooling period until ${restrictedUntil.toLocaleString()}`);
          return { 
            inCoolingPeriod: true, 
            restrictedUntil: restrictedUntil 
          };
        }
      }
      
      return { inCoolingPeriod: false };
    } catch (error) {
      logError("❌ Error checking cooling period:", error);
      return { inCoolingPeriod: false };
    }
  }
  
  /**
   * Check remaining upload allowance for a gallery
   * @param {string} galleryId - The gallery ID
   * @returns {Promise<Object>} Promise resolving to allowance status
   */
  async function checkRemainingUploadAllowance(galleryId) {
    logDebug(`Checking remaining upload allowance for gallery ${galleryId}`);
    
    try {
      const db = firebase.firestore();
      const galleryDoc = await db.collection('galleries').doc(galleryId).get();
      
      if (!galleryDoc.exists) {
        return { isLimited: false, remainingAllowance: Infinity };
      }
      
      const galleryData = galleryDoc.data();
      
      // Check if gallery has a limit
      if (galleryData.uploadLimit || galleryData.additionalPhotosAllowed) {
        const currentCount = galleryData.photosCount || 0;
        const uploadLimit = galleryData.uploadLimit || 0;
        const additionalAllowed = galleryData.additionalPhotosAllowed || 0;
        const initialCount = galleryData.initialPhotosCount || 0;
        
        // Calculate remaining allowance
        const totalAllowed = initialCount + additionalAllowed;
        const remainingAllowance = Math.max(0, totalAllowed - currentCount);
        
        logInfo(`📊 Gallery has upload limit: ${remainingAllowance} remaining out of ${additionalAllowed} additional allowed`);
        
        return { 
          isLimited: true, 
          remainingAllowance: remainingAllowance,
          totalAllowance: additionalAllowed,
          currentCount: currentCount,
          initialCount: initialCount
        };
      }
      
      // Check if gallery has been shared before
      if (galleryData.previouslyShared) {
        // Gallery previously shared but no explicit limit set
        // Calculate default limit based on current count and plan
        let planLimit = 100; // Default limit
        
        // Get plan limit if available
        if (galleryData.planId) {
          try {
            const planDoc = await db.collection('client-plans').doc(galleryData.planId).get();
            if (planDoc.exists) {
              planLimit = planDoc.data().photoLimit || 100;
            }
          } catch (error) {
            logWarning("⚠️ Error getting plan limit:", error);
          }
        }
        
        const currentCount = galleryData.photosCount || 0;
        const additionalAllowed = Math.ceil(planLimit * (CONFIG.additionalUploadPercentage / 100));
        
        // Store these values for future reference
        await db.collection('galleries').doc(galleryId).update({
          initialPhotosCount: currentCount,
          additionalPhotosAllowed: additionalAllowed,
          uploadLimit: currentCount + additionalAllowed
        });
        
        logInfo(`📊 First time setting limit: ${additionalAllowed} additional allowed`);
        
        return { 
          isLimited: true, 
          remainingAllowance: additionalAllowed,
          totalAllowance: additionalAllowed,
          currentCount: currentCount,
          initialCount: currentCount
        };
      }
      
      return { isLimited: false, remainingAllowance: Infinity };
    } catch (error) {
      logError("❌ Error checking upload allowance:", error);
      return { isLimited: false, remainingAllowance: Infinity };
    }
  }
  
  /**
   * Update remaining upload allowance after an upload
   * @param {string} galleryId - The gallery ID
   * @param {number} uploadedCount - Number of photos uploaded
   */
  async function updateRemainingUploadAllowance(galleryId, uploadedCount) {
    logDebug(`Updating allowance after uploading ${uploadedCount} photos`);
    
    try {
      const db = firebase.firestore();
      const galleryDoc = await db.collection('galleries').doc(galleryId).get();
      
      if (!galleryDoc.exists) {
        return;
      }
      
      const galleryData = galleryDoc.data();
      const currentCount = galleryData.photosCount || 0;
      
      // Only need to update if we have initial count set
      if (galleryData.initialPhotosCount !== undefined) {
        logInfo(`📊 Updating photo count: ${currentCount} (was ${currentCount - uploadedCount})`);
        
        // Calculate and display remaining allowance
        const initialCount = galleryData.initialPhotosCount || 0;
        const additionalAllowed = galleryData.additionalPhotosAllowed || 0;
        const totalAllowed = initialCount + additionalAllowed;
        const remainingAllowance = Math.max(0, totalAllowed - currentCount);
        
        // Update UI to show new remaining count
        updateRemainingCountDisplay(remainingAllowance);
      }
    } catch (error) {
      logError("❌ Error updating allowance:", error);
    }
  }
  
  /**
   * Update the UI to show remaining upload count
   * @param {number} remainingCount - Number of remaining uploads allowed
   */
  function updateRemainingCountDisplay(remainingCount) {
    logDebug(`Updating UI to show remaining count: ${remainingCount}`);
    
    // Update button text to show limit
    const uploadBtns = [
      document.getElementById('uploadPhotosBtn'),
      document.getElementById('emptyStateUploadBtn')
    ];
    
    uploadBtns.forEach(btn => {
      if (btn) {
        // Find or create the badge
        let limitBadge = btn.querySelector('.upload-limit-badge');
        
        if (!limitBadge) {
          // Save original text
          if (!btn.hasAttribute('data-original-text')) {
            btn.setAttribute('data-original-text', btn.textContent);
          }
          
          // Create new badge
          const originalText = btn.getAttribute('data-original-text');
          btn.innerHTML = `${originalText} <span class="upload-limit-badge">(${remainingCount} left)</span>`;
        } else {
          // Update existing badge
          limitBadge.textContent = `(${remainingCount} left)`;
        }
      }
    });
    
    // Update any message displays
    const limitMessages = document.querySelectorAll('.upload-limit-message');
    limitMessages.forEach(msg => {
      msg.innerHTML = `
        <i class="fas fa-info-circle"></i> Limited uploads - You can upload up to ${remainingCount} more photos to this gallery.
      `;
    });
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
          
          // Check if the gallery has been previously shared
          if (galleryData.previouslyShared) {
            logInfo("📋 Gallery has been previously shared");
            
            // Check if gallery has an active cooling period
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
                // Cooling period expired, but still has upload limit
                logInfo("📋 Cooling period expired, but upload limit remains");
                
                // Clear the restriction in database
                db.collection('galleries').doc(galleryId).update({
                  uploadRestricted: false,
                  uploadRestrictedUntil: null
                }).then(() => {
                  logInfo("✅ Cooling period flag cleared in database");
                }).catch(error => {
                  logError("❌ Error clearing upload restriction:", error);
                });
                
                // Check remaining allowance to enable uploads with limit
                checkRemainingUploadAllowance(galleryId).then(allowance => {
                  if (allowance.isLimited) {
                    enableUploadsWithLimit(allowance.remainingAllowance);
                  } else {
                    enableUploads();
                  }
                }).catch(error => {
                  logError("❌ Error checking allowance:", error);
                  enableUploads(); // Fallback to enable
                });
              }
            } else {
              // No active cooling period, but still previously shared
              logInfo("📋 No active cooling period, checking upload limits");
              
              // Check remaining allowance to enable uploads with limit
              checkRemainingUploadAllowance(galleryId).then(allowance => {
                if (allowance.isLimited) {
                  enableUploadsWithLimit(allowance.remainingAllowance);
                } else {
                  enableUploads();
                }
              }).catch(error => {
                logError("❌ Error checking allowance:", error);
                enableUploads(); // Fallback to enable
              });
            }
          } else {
            logInfo("✅ Gallery has never been shared, no restrictions needed");
            enableUploads();
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
                    if (result.restrictionType === 'cooling_period') {
                      // In cooling period, disable uploads completely
                      logInfo("🔒 Applying cooling period restrictions");
                      disableUploads(result.restrictedUntil);
                      showUploadRestrictedMessage(result.restrictedUntil);
                    } else {
                      // Always apply the 5% limit after any revocation (outside grace period)
                      if (result.restrictionType !== 'none') {
                        logInfo(`🔓 Allowing limited uploads (${result.additionalPhotos} photos)`);
                        enableUploadsWithLimit(result.additionalPhotos);
                      } else {
                        // Within grace period, no restrictions
                        logInfo("✅ Within grace period, ensuring uploads are enabled");
                        enableUploads();
                      }
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
            const confirmRevoke = confirm(CONFIG.messages.revokeWarningFirstRevoke.replace('{date}', 'tomorrow'));
            
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
    
    // Calculate expiry date based on revocation count
    let revocationCount = historyData ? (historyData.revocationCount || 0) : 0;
    let expiryDate;
    
    if (revocationCount === 0) {
      expiryDate = new Date(Date.now() + CONFIG.coolingPeriods.first);
    } else if (revocationCount === 1) {
      expiryDate = new Date(Date.now() + CONFIG.coolingPeriods.second);
    } else {
      expiryDate = new Date(Date.now() + CONFIG.coolingPeriods.subsequent);
    }
    
    const formattedDate = formatDate(expiryDate);
    
    // Default message if no history
    if (!historyData) {
      logDebug("No history data, using first revoke warning");
      return CONFIG.messages.revokeWarningFirstRevoke.replace('{date}', formattedDate);
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
    logDebug(`Revocation count: ${revocationCount}`);
    
    if (revocationCount === 0) {
      return CONFIG.messages.revokeWarningFirstRevoke.replace('{date}', formattedDate);
    } else if (revocationCount === 1) {
      return CONFIG.messages.revokeWarningSecondRevoke.replace('{date}', formattedDate);
    } else {
      return CONFIG.messages.revokeWarningSubsequentRevoke.replace('{date}', formattedDate);
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
      // First revocation outside grace period - partial restriction with cooling period
      restrictionType = 'partial_with_cooling';
      restrictedUntil = new Date(Date.now() + CONFIG.coolingPeriods.first);
      successMessage = CONFIG.messages.successMessageFirstRevoke
        .replace('{additionalPhotos}', additionalPhotos)
        .replace('{date}', formatDate(restrictedUntil));
      logInfo(`📋 First revocation - 5% limit and cooling period until ${restrictedUntil.toLocaleString()}`);
    } else if (revocationCount === 2) {
      // Second revocation - cooling period, but maintain 5% limit for later
      restrictionType = 'cooling_period';
      restrictedUntil = new Date(Date.now() + CONFIG.coolingPeriods.second);
      successMessage = CONFIG.messages.successMessageSecondRevoke
        .replace('{date}', formatDate(restrictedUntil));
      logInfo(`📋 Second revocation - cooling period until ${restrictedUntil.toLocaleString()}`);
    } else {
      // Third or subsequent revocation - longer cooling period, maintain 5% limit
      restrictionType = 'cooling_period';
      restrictedUntil = new Date(Date.now() + CONFIG.coolingPeriods.subsequent);
      successMessage = CONFIG.messages.successMessageSubsequentRevoke
        .replace('{date}', formatDate(restrictedUntil));
      logInfo(`📋 Subsequent revocation - extended cooling period until ${restrictedUntil.toLocaleString()}`);
    }
    
    // Prepare history record for new entry or update
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const clientTimestamp = new Date(); // Use client timestamp for immediate calculations
    
    let historyRecord = {
      galleryId: galleryId,
      photographerId: currentUser.uid,
      lastRevokedAt: timestamp,
      lastRevokedAtClient: clientTimestamp, // Store client timestamp for immediate calculations
      revocationCount: revocationCount
    };
    
    if (!historyData) {
      // First time sharing this gallery
      historyRecord.firstSharedAt = timestamp;
      historyRecord.lastSharedAt = timestamp;
      historyRecord.lastSharedAtClient = clientTimestamp; // Store client timestamp
      historyRecord.sharingCount = 1;
    }
    
    // Prepare gallery update data
    const galleryUpdate = {
      previouslyShared: true,
      lastShareRevoked: timestamp,
      initialPhotosCount: photosCount, // Store current photo count for 5% calculation
      additionalPhotosAllowed: additionalPhotos // Always set the 5% limit
    };
    
    // Set upload restrictions based on type
    if (restrictionType === 'cooling_period' || restrictionType === 'partial_with_cooling') {
      galleryUpdate.uploadRestricted = true;
      galleryUpdate.uploadRestrictedUntil = firebase.firestore.Timestamp.fromDate(restrictedUntil);
    } else {
      galleryUpdate.uploadRestricted = false;
      galleryUpdate.uploadRestrictedUntil = null;
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
      withinGracePeriod,
      additionalPhotos
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
