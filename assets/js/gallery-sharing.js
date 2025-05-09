/**
 * gallery-sharing.js - Implements gallery sharing functionality for SnapSelect
 * For photographers to create and manage shared gallery links
 */

class GallerySharing {
  constructor() {
    this.db = firebase.firestore();
    this.auth = firebase.auth();
    this.storage = firebase.storage();
    this.currentUser = null;
    this.currentGallery = null;
    
    // DOM Elements
    this.shareGalleryBtn = document.getElementById('shareGalleryBtn');
    this.shareSettingsForm = document.getElementById('shareSettingsForm');
    this.shareUrlDisplay = document.getElementById('shareUrlDisplay');
    this.copyLinkBtn = document.getElementById('copyLinkBtn');
    this.revokeAccessBtn = document.getElementById('revokeAccessBtn');
    
    // Bind methods
    this.initSharing = this.initSharing.bind(this);
    this.createShareLink = this.createShareLink.bind(this);
    this.updateShareSettings = this.updateShareSettings.bind(this);
    this.revokeAccess = this.revokeAccess.bind(this);
    this.copyShareLink = this.copyShareLink.bind(this);
    this.checkPlanLimits = this.checkPlanLimits.bind(this);
    
    // Initialize
    this.init();
  }
  
  // Initialize the sharing functionality
  init() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.currentUser = user;
        this.loadGalleryData();
        this.addEventListeners();
      } else {
        window.location.href = '/snapselect/pages/login.html';
      }
    });
  }
  
  // Load gallery data from URL params
  loadGalleryData() {
    const urlParams = new URLSearchParams(window.location.search);
    const galleryId = urlParams.get('id');
    
    if (!galleryId) {
      console.error('No gallery ID provided');
      return;
    }
    
    this.db.collection('galleries')
      .doc(galleryId)
      .get()
      .then(doc => {
        if (doc.exists && doc.data().photographerId === this.currentUser.uid) {
          this.currentGallery = {
            id: doc.id,
            ...doc.data()
          };
          this.loadSharingUI();
        } else {
          console.error('Gallery not found or unauthorized');
        }
      })
      .catch(error => {
        console.error('Error loading gallery:', error);
      });
  }
  
  // Load the sharing UI
  loadSharingUI() {
    // Update form with current settings
    if (this.currentGallery.isShared) {
      document.getElementById('passwordProtection').checked = this.currentGallery.passwordProtected;
      document.getElementById('expiryDate').value = this.currentGallery.expiryDate ? 
        new Date(this.currentGallery.expiryDate.toDate()).toISOString().substr(0, 10) : '';
      document.getElementById('maxSelections').value = this.currentGallery.maxSelections || '';
      document.getElementById('requireApproval').checked = this.currentGallery.requireApproval;
      document.getElementById('preventDownload').checked = this.currentGallery.preventDownload;
      document.getElementById('watermarkEnabled').checked = this.currentGallery.watermarkEnabled;
      
      // Show share link if available
      if (this.currentGallery.shareLink) {
        this.shareUrlDisplay.textContent = this.currentGallery.shareLink;
        this.shareUrlDisplay.parentElement.classList.remove('hidden');
      }
    }
  }
  
  // Add event listeners
  addEventListeners() {
    if (this.shareGalleryBtn) {
      this.shareGalleryBtn.addEventListener('click', this.createShareLink);
    }
    
    if (this.shareSettingsForm) {
      this.shareSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.updateShareSettings();
      });
    }
    
    if (this.copyLinkBtn) {
      this.copyLinkBtn.addEventListener('click', this.copyShareLink);
    }
    
    if (this.revokeAccessBtn) {
      this.revokeAccessBtn.addEventListener('click', this.revokeAccess);
    }
  }
  
  // Check if user's plan allows sharing
  checkPlanLimits() {
    return new Promise((resolve, reject) => {
      // Get client plan info
      this.db.collection('client-plans')
        .where('clientId', '==', this.currentGallery.clientId)
        .where('photographerId', '==', this.currentUser.uid)
        .orderBy('purchaseDate', 'desc')
        .limit(1)
        .get()
        .then(snapshot => {
          if (snapshot.empty) {
            reject(new Error('No active plan found for this client'));
            return;
          }
          
          const plan = snapshot.docs[0].data();
          const now = new Date();
          
          // Check if plan is expired
          if (plan.expiryDate && plan.expiryDate.toDate() < now) {
            reject(new Error('Client plan has expired. Please renew the plan to share this gallery.'));
            return;
          }
          
          // All checks passed
          resolve(plan);
        })
        .catch(error => {
          console.error('Error checking plan limits:', error);
          reject(error);
        });
    });
  }
  
  // Create a share link for the gallery
  createShareLink() {
    if (!this.currentGallery) return;
    
    this.checkPlanLimits()
      .then(plan => {
        // Generate a unique share ID
        const shareId = this.db.collection('client-shared-galleries').doc().id;
        
        // Get form values
        const passwordProtected = document.getElementById('passwordProtection').checked;
        const password = passwordProtected ? document.getElementById('password').value : null;
        const expiryDateStr = document.getElementById('expiryDate').value;
        const expiryDate = expiryDateStr ? firebase.firestore.Timestamp.fromDate(new Date(expiryDateStr)) : null;
        const maxSelections = parseInt(document.getElementById('maxSelections').value) || null;
        const requireApproval = document.getElementById('requireApproval').checked;
        const preventDownload = document.getElementById('preventDownload').checked;
        const watermarkEnabled = document.getElementById('watermarkEnabled').checked;
        
        // Construct share link
        const baseUrl = window.location.origin;
        const shareLink = `${baseUrl}/snapselect/pages/client-gallery-view.html?share=${shareId}`;
        
        // Create shared gallery document
        const sharedGalleryData = {
          id: shareId,
          galleryId: this.currentGallery.id,
          clientId: this.currentGallery.clientId,
          photographerId: this.currentUser.uid,
          shareLink: shareLink,
          passwordProtected: passwordProtected,
          password: password ? this.hashPassword(password) : null,
          expiryDate: expiryDate,
          created: firebase.firestore.FieldValue.serverTimestamp(),
          lastAccessed: null,
          accessCount: 0,
          status: 'active'
        };
        
        // Update gallery document
        const galleryUpdateData = {
          isShared: true,
          shareLink: shareLink,
          passwordProtected: passwordProtected,
          expiryDate: expiryDate,
          maxSelections: maxSelections,
          requireApproval: requireApproval,
          preventDownload: preventDownload,
          watermarkEnabled: watermarkEnabled,
          updated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Create a batch write
        const batch = this.db.batch();
        batch.set(this.db.collection('client-shared-galleries').doc(shareId), sharedGalleryData);
        batch.update(this.db.collection('galleries').doc(this.currentGallery.id), galleryUpdateData);
        
        return batch.commit();
      })
      .then(() => {
        // Reload gallery data
        return this.db.collection('galleries').doc(this.currentGallery.id).get();
      })
      .then(doc => {
        this.currentGallery = {
          id: doc.id,
          ...doc.data()
        };
        
        // Update UI
        this.loadSharingUI();
        
        // Show success notification
        if (window.NotificationSystem) {
          window.NotificationSystem.showNotification(
            'success',
            'Gallery Shared',
            `Gallery "${this.currentGallery.name}" has been shared successfully.`
          );
        }
      })
      .catch(error => {
        console.error('Error creating share link:', error);
        
        // Show error notification
        if (window.NotificationSystem) {
          window.NotificationSystem.showNotification(
            'error',
            'Sharing Failed',
            error.message || 'Failed to share gallery. Please try again.'
          );
        }
      });
  }
  
  // Simple password hashing (you might want to use a better method)
  hashPassword(password) {
    // In production, use a proper hashing library
    return btoa(password); // Base64 encoding for demo
  }
  
  // Update sharing settings
  updateShareSettings() {
    if (!this.currentGallery || !this.currentGallery.isShared) return;
    
    // Get form values
    const passwordProtected = document.getElementById('passwordProtection').checked;
    const password = passwordProtected ? document.getElementById('password').value : null;
    const expiryDateStr = document.getElementById('expiryDate').value;
    const expiryDate = expiryDateStr ? firebase.firestore.Timestamp.fromDate(new Date(expiryDateStr)) : null;
    const maxSelections = parseInt(document.getElementById('maxSelections').value) || null;
    const requireApproval = document.getElementById('requireApproval').checked;
    const preventDownload = document.getElementById('preventDownload').checked;
    const watermarkEnabled = document.getElementById('watermarkEnabled').checked;
    
    // Find the shared gallery document
    this.db.collection('client-shared-galleries')
      .where('galleryId', '==', this.currentGallery.id)
      .where('status', '==', 'active')
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.error('No active shared gallery found');
          return;
        }
        
        const sharedGalleryDoc = snapshot.docs[0];
        const sharedGalleryId = sharedGalleryDoc.id;
        
        // Update shared gallery document
        const sharedGalleryUpdateData = {
          passwordProtected: passwordProtected,
          password: passwordProtected && password ? this.hashPassword(password) : sharedGalleryDoc.data().password,
          expiryDate: expiryDate
        };
        
        // Update gallery document
        const galleryUpdateData = {
          passwordProtected: passwordProtected,
          expiryDate: expiryDate,
          maxSelections: maxSelections,
          requireApproval: requireApproval,
          preventDownload: preventDownload,
          watermarkEnabled: watermarkEnabled,
          updated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Create a batch write
        const batch = this.db.batch();
        batch.update(this.db.collection('client-shared-galleries').doc(sharedGalleryId), sharedGalleryUpdateData);
        batch.update(this.db.collection('galleries').doc(this.currentGallery.id), galleryUpdateData);
        
        return batch.commit();
      })
      .then(() => {
        // Show success notification
        if (window.NotificationSystem) {
          window.NotificationSystem.showNotification(
            'success',
            'Settings Updated',
            'Gallery sharing settings have been updated successfully.'
          );
        }
      })
      .catch(error => {
        console.error('Error updating share settings:', error);
        
        // Show error notification
        if (window.NotificationSystem) {
          window.NotificationSystem.showNotification(
            'error',
            'Update Failed',
            'Failed to update sharing settings. Please try again.'
          );
        }
      });
  }
  
  // Revoke gallery access
  revokeAccess() {
    if (!this.currentGallery || !this.currentGallery.isShared) return;
    
    if (!confirm('Are you sure you want to revoke access to this gallery? Clients will no longer be able to view or select photos.')) {
      return;
    }
    
    // Find the shared gallery document
    this.db.collection('client-shared-galleries')
      .where('galleryId', '==', this.currentGallery.id)
      .where('status', '==', 'active')
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.error('No active shared gallery found');
          return;
        }
        
        // Create a batch write
        const batch = this.db.batch();
        
        // Update all shared gallery documents to revoked
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            status: 'revoked',
            revokedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        
        // Update gallery document
        batch.update(this.db.collection('galleries').doc(this.currentGallery.id), {
          isShared: false,
          shareLink: null,
          updated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return batch.commit();
      })
      .then(() => {
        // Update current gallery object
        this.currentGallery.isShared = false;
        this.currentGallery.shareLink = null;
        
        // Update UI
        this.shareUrlDisplay.textContent = '';
        this.shareUrlDisplay.parentElement.classList.add('hidden');
        
        // Show success notification
        if (window.NotificationSystem) {
          window.NotificationSystem.showNotification(
            'success',
            'Access Revoked',
            'Gallery sharing has been revoked successfully.'
          );
        }
      })
      .catch(error => {
        console.error('Error revoking access:', error);
        
        // Show error notification
        if (window.NotificationSystem) {
          window.NotificationSystem.showNotification(
            'error',
            'Revoke Failed',
            'Failed to revoke gallery sharing. Please try again.'
          );
        }
      });
  }
  
  // Copy share link to clipboard
  copyShareLink() {
    if (!this.currentGallery || !this.currentGallery.shareLink) return;
    
    navigator.clipboard.writeText(this.currentGallery.shareLink)
      .then(() => {
        // Show success notification
        if (window.NotificationSystem) {
          window.NotificationSystem.showNotification(
            'success',
            'Link Copied',
            'Gallery link has been copied to clipboard.'
          );
        }
      })
      .catch(error => {
        console.error('Error copying link to clipboard:', error);
      });
  }
}

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
  window.GallerySharing = new GallerySharing();
});
