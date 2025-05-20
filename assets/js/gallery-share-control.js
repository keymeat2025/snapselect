/**
 * gallery-share-control.js
 * 
 * Handles the gallery freezing mechanism in SnapSelect.
 * This module manages the state changes when clients interact with shared galleries,
 * ensuring photos can't be added, removed, or modified once a client begins their selection process.
 */

// Gallery Share Control Module
const GalleryShareControl = (function() {
  // Private variables
  let _currentUser = null;
  let _galleryData = null;
  let _db = null;
  let _notificationSystem = null;

  // Initialize the module
  function init(userData, galleryData) {
    try {
      if (!firebase || !firebase.firestore) {
        console.error('Firebase is not initialized');
        return false;
      }

      _db = firebase.firestore();
      _currentUser = userData || firebase.auth().currentUser;
      _galleryData = galleryData;

      // Try to get NotificationSystem if available
      _notificationSystem = window.NotificationSystem || null;

      console.log('Gallery Share Control initialized');
      return true;
    } catch (error) {
      console.error('Error initializing Gallery Share Control:', error);
      return false;
    }
  }

  /**
   * Check if a gallery is frozen (client interaction started)
   * @param {string} galleryId - The gallery ID to check
   * @returns {Promise<object>} Freeze status object { isFrozen, freezeStatus, clientName, timestamp }
   */
  async function checkGalleryFreezeStatus(galleryId) {
    try {
      if (!galleryId) {
        throw new Error('Gallery ID is required');
      }

      // Use the utility function if available
      if (window.dbUtils && typeof window.dbUtils.checkGalleryFreezeStatus === 'function') {
        const freezeStatus = await window.dbUtils.checkGalleryFreezeStatus(galleryId);
        return {
          isFrozen: freezeStatus === "frozen" || freezeStatus === "locked",
          freezeStatus: freezeStatus,
          clientName: _galleryData?.clientName || 'Client',
          timestamp: _galleryData?.clientInteractionStartedAt || null
        };
      }

      // Fallback to direct DB query
      const galleryDoc = await _db.collection('galleries').doc(galleryId).get();
      
      if (!galleryDoc.exists) {
        throw new Error('Gallery not found');
      }
      
      const galleryData = galleryDoc.data();
      const freezeStatus = galleryData.freezeStatus || "editable";
      
      return {
        isFrozen: freezeStatus === "frozen" || freezeStatus === "locked",
        freezeStatus: freezeStatus,
        clientName: galleryData.clientName || 'Client',
        timestamp: galleryData.clientInteractionStartedAt || null
      };
    } catch (error) {
      console.error('Error checking gallery freeze status:', error);
      // Default to editable if there's an error, so we don't block functionality unnecessarily
      return { 
        isFrozen: false, 
        freezeStatus: "editable",
        clientName: null,
        timestamp: null
      };
    }
  }

  /**
   * Freeze a gallery when client interaction starts
   * @param {string} galleryId - The gallery ID to freeze
   * @param {string} clientId - The client ID who started interaction
   * @returns {Promise<boolean>} Success status
   */
  async function freezeGalleryOnClientInteraction(galleryId, clientId) {
    try {
      if (!galleryId) {
        throw new Error('Gallery ID is required');
      }

      // Use the utility function if available
      if (window.dbUtils && typeof window.dbUtils.freezeGallery === 'function') {
        return await window.dbUtils.freezeGallery(galleryId, clientId);
      }

      // Fallback to direct DB update
      await _db.collection('galleries').doc(galleryId).update({
        clientInteractionStarted: true,
        clientInteractionStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
        freezeStatus: "frozen",
        interactingClientId: clientId || null
      });

      // Create notification for the photographer
      if (_galleryData && _galleryData.photographerId) {
        createGalleryFrozenNotification(galleryId, _galleryData);
      }

      return true;
    } catch (error) {
      console.error('Error freezing gallery:', error);
      return false;
    }
  }

  /**
   * Create a notification for the photographer when gallery is frozen
   * @param {string} galleryId - The frozen gallery ID
   * @param {object} galleryData - The gallery data
   */
  function createGalleryFrozenNotification(galleryId, galleryData) {
    try {
      if (!galleryData || !galleryData.photographerId) return;

      // Use NotificationSystem if available
      if (_notificationSystem && typeof _notificationSystem.createNotification === 'function') {
        _notificationSystem.createNotification(
          galleryData.photographerId,
          {
            type: 'gallery_frozen',
            title: 'Gallery Frozen',
            message: `${galleryData.clientName || 'A client'} has started interacting with "${galleryData.name || 'your gallery'}". The gallery is now frozen for content stability.`,
            galleryId: galleryId,
            timestamp: new Date(),
            read: false,
            priority: 'medium'
          }
        );
        return;
      }

      // Fallback to direct DB notification creation
      _db.collection('user_notifications')
        .doc(galleryData.photographerId)
        .collection('notifications')
        .add({
          type: 'gallery_frozen',
          title: 'Gallery Frozen',
          message: `${galleryData.clientName || 'A client'} has started interacting with "${galleryData.name || 'your gallery'}". The gallery is now frozen for content stability.`,
          galleryId: galleryId,
          read: false,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error creating gallery frozen notification:', error);
    }
  }

  /**
   * Update UI to reflect frozen gallery state
   * @param {object} freezeStatus - The freeze status object from checkGalleryFreezeStatus
   */
  function updateUIForFrozenGallery(freezeStatus) {
    if (!freezeStatus || !freezeStatus.isFrozen) return;

    // Get UI elements
    const uploadPhotosBtn = document.getElementById('uploadPhotosBtn');
    const emptyStateUploadBtn = document.getElementById('emptyStateUploadBtn');
    const syncPhotosBtn = document.getElementById('syncPhotosBtn');
    const galleryActionButtons = document.querySelectorAll('.photo-action-btn.delete-btn');
    
    // Create formatted timestamp if available
    let formattedTime = '';
    if (freezeStatus.timestamp) {
      const timestamp = freezeStatus.timestamp.toDate ? 
        freezeStatus.timestamp.toDate() : new Date(freezeStatus.timestamp);
      formattedTime = timestamp.toLocaleString();
    }
    
    // Create freeze notification banner if it doesn't exist yet
    if (!document.getElementById('galleryFrozenBanner')) {
      const banner = document.createElement('div');
      banner.id = 'galleryFrozenBanner';
      banner.className = 'alert alert-warning';
      banner.innerHTML = `
        <i class="fas fa-lock"></i>
        <span>This gallery is currently frozen because ${freezeStatus.clientName || 'a client'} 
        is in the process of making selections${formattedTime ? ` (started on ${formattedTime})` : ''}. 
        Photos cannot be added, removed, or modified during this time to ensure content stability.</span>
      `;
      
      // Insert banner at the top of gallery content
      const galleryContentSection = document.querySelector('.gallery-content-section');
      if (galleryContentSection) {
        galleryContentSection.insertBefore(banner, galleryContentSection.firstChild);
      } else {
        // Fallback to generic insertion
        const container = document.querySelector('.container');
        if (container) {
          container.insertBefore(banner, container.firstChild);
        }
      }
    }
    
    // Disable upload buttons
    if (uploadPhotosBtn) {
      uploadPhotosBtn.disabled = true;
      uploadPhotosBtn.title = 'Gallery is frozen while client is making selections';
      uploadPhotosBtn.classList.add('disabled');
    }
    
    if (emptyStateUploadBtn) {
      emptyStateUploadBtn.disabled = true;
      emptyStateUploadBtn.title = 'Gallery is frozen while client is making selections';
      emptyStateUploadBtn.classList.add('disabled');
    }
    
    // Disable sync button
    if (syncPhotosBtn) {
      syncPhotosBtn.disabled = true;
      syncPhotosBtn.title = 'Gallery is frozen while client is making selections';
      syncPhotosBtn.classList.add('disabled');
    }
    
    // Disable delete buttons on photos
    galleryActionButtons.forEach(button => {
      button.disabled = true;
      button.title = 'Cannot delete photos while gallery is frozen';
      button.classList.add('disabled');
    });
    
    // Add CSS to highlight frozen state
    addFrozenGalleryStyles();
  }
  
  /**
   * Add CSS styles for frozen gallery state
   */
  function addFrozenGalleryStyles() {
    if (document.getElementById('frozenGalleryStyles')) return;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'frozenGalleryStyles';
    styleSheet.textContent = `
      #galleryFrozenBanner {
        display: flex;
        align-items: center;
        padding: 15px;
        margin-bottom: 20px;
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        border-left: 4px solid #ffc107;
        border-radius: 4px;
        color: #856404;
      }
      
      #galleryFrozenBanner i {
        font-size: 18px;
        margin-right: 10px;
      }
      
      .button.disabled, .btn.disabled {
        opacity: 0.65;
        cursor: not-allowed;
        pointer-events: none;
      }
      
      .photo-action-btn.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .frozen-gallery-badge {
        background-color: #ffc107;
        color: #212529;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        margin-left: 10px;
      }
    `;
    
    document.head.appendChild(styleSheet);
  }

  /**
   * Check and apply gallery freeze state
   * @param {string} galleryId - The gallery ID to check
   */
  async function checkAndApplyFreezeState(galleryId) {
    if (!galleryId) return;
    
    const freezeStatus = await checkGalleryFreezeStatus(galleryId);
    
    if (freezeStatus.isFrozen) {
      // Update UI to show frozen state
      updateUIForFrozenGallery(freezeStatus);
      
      // Add frozen badge to gallery title if not already present
      const galleryName = document.getElementById('galleryName');
      if (galleryName && !galleryName.querySelector('.frozen-gallery-badge')) {
        const badge = document.createElement('span');
        badge.className = 'frozen-gallery-badge';
        badge.innerHTML = '<i class="fas fa-lock"></i> Frozen';
        galleryName.appendChild(badge);
      }
      
      // Return freeze status for other modules to use
      return freezeStatus;
    }
    
    return freezeStatus;
  }

  /**
   * For client side - freeze gallery when first interaction happens
   * @param {string} galleryId - The gallery ID
   * @param {string} clientId - The client ID
   * @param {string} actionType - The type of interaction (selection, comment, rating)
   */
  async function registerClientInteraction(galleryId, clientId, actionType = 'selection') {
    if (!galleryId || !clientId) return false;
    
    try {
      // First check if the gallery is already frozen
      const freezeStatus = await checkGalleryFreezeStatus(galleryId);
      
      // If not frozen, trigger freeze
      if (!freezeStatus.isFrozen) {
        console.log(`Freezing gallery ${galleryId} due to client ${clientId} ${actionType}`);
        return await freezeGalleryOnClientInteraction(galleryId, clientId);
      }
      
      // Already frozen, no need to freeze again
      return true;
    } catch (error) {
      console.error('Error registering client interaction:', error);
      return false;
    }
  }

  /**
   * For admin use - temporarily unfreeze a gallery (with proper logging)
   * @param {string} galleryId - The gallery ID to unfreeze
   * @param {string} adminId - The admin or photographer ID authorizing the unfreeze
   * @returns {Promise<boolean>} Success status
   */
  async function adminUnfreezeGallery(galleryId, adminId) {
    try {
      if (!galleryId || !adminId) {
        throw new Error('Gallery ID and Admin ID are required');
      }

      // Use the utility function if available
      if (window.dbUtils && typeof window.dbUtils.unfreezeGallery === 'function') {
        return await window.dbUtils.unfreezeGallery(galleryId, adminId);
      }

      // First log the action for accountability
      await _db.collection('gallery_admin_actions').add({
        action: "unfreeze",
        galleryId: galleryId,
        adminId: adminId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Then unfreeze the gallery
      await _db.collection('galleries').doc(galleryId).update({
        freezeStatus: "editable",
        unfrozenBy: adminId,
        unfrozenAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Remove frozen UI elements
      const frozenBanner = document.getElementById('galleryFrozenBanner');
      if (frozenBanner) frozenBanner.remove();

      // Re-enable buttons
      const buttons = document.querySelectorAll('.disabled');
      buttons.forEach(button => {
        button.disabled = false;
        button.classList.remove('disabled');
      });

      // Remove frozen badge
      const frozenBadge = document.querySelector('.frozen-gallery-badge');
      if (frozenBadge) frozenBadge.remove();

      return true;
    } catch (error) {
      console.error('Error unfreezing gallery:', error);
      return false;
    }
  }

  // Public API
  return {
    init,
    checkGalleryFreezeStatus,
    freezeGalleryOnClientInteraction,
    updateUIForFrozenGallery,
    checkAndApplyFreezeState,
    registerClientInteraction,
    adminUnfreezeGallery
  };
})();

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
  // Get gallery ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const galleryId = urlParams.get('id');
  
  // Check if we're in a gallery view context
  if (galleryId && document.getElementById('galleryName')) {
    // Wait for firebase to be ready
    if (firebase.apps.length > 0) {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          // Wait for gallery data to be available from gallery-view.js
          const checkGalleryDataInterval = setInterval(() => {
            if (window.galleryData) {
              clearInterval(checkGalleryDataInterval);
              
              // Initialize with available data
              GalleryShareControl.init(user, window.galleryData);
              
              // Check and apply freeze state
              GalleryShareControl.checkAndApplyFreezeState(galleryId);
            }
          }, 500);
          
          // Clear interval after 10 seconds to prevent infinite checking
          setTimeout(() => {
            clearInterval(checkGalleryDataInterval);
            
            // If gallery data isn't available, try to initialize anyway
            if (!window.galleryData) {
              GalleryShareControl.init(user);
              GalleryShareControl.checkAndApplyFreezeState(galleryId);
            }
          }, 10000);
        }
      });
    }
  }
});

// Make available globally
window.GalleryShareControl = GalleryShareControl;
