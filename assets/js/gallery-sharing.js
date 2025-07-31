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
    this.shareSettingsForm = document.getElementById('shareSettingsForm');
    this.shareUrlDisplay = document.getElementById('shareUrlDisplay');
    this.copyLinkBtn = document.getElementById('copyLinkBtn');
    this.shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
    this.shareEmailBtn = document.getElementById('shareEmailBtn');
    this.revokeAccessBtn = document.getElementById('revokeAccessBtn');
    this.passwordProtection = document.getElementById('passwordProtection');
    this.passwordSection = document.getElementById('passwordSection');
    
    // Bind methods
    this.init = this.init.bind(this);
    this.createShareLink = this.createShareLink.bind(this);
    this.updateShareSettings = this.updateShareSettings.bind(this);
    this.revokeAccess = this.revokeAccess.bind(this);
    this.copyShareLink = this.copyShareLink.bind(this);
    this.shareViaWhatsApp = this.shareViaWhatsApp.bind(this);
    this.shareViaEmail = this.shareViaEmail.bind(this);
    this.loadGalleryData = this.loadGalleryData.bind(this);
    this.loadSharingUI = this.loadSharingUI.bind(this);
    this.addEventListeners = this.addEventListeners.bind(this);
    this.togglePasswordSection = this.togglePasswordSection.bind(this);
    this.showNotification = this.showNotification.bind(this);
    
    // Initialize
    this.init();
  }
  
  // Initialize the sharing functionality
  init() {
    console.log('Initializing GallerySharing...');
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.currentUser = user;
        this.loadGalleryData();
        this.addEventListeners();
      } else {
        console.log('User not authenticated');
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
    console.log('Loading sharing UI for gallery:', this.currentGallery);
    
    // Update form with current settings
    if (this.currentGallery.isShared) {
      // Update share link display
      if (this.shareUrlDisplay && this.currentGallery.shareLink) {
        this.shareUrlDisplay.value = this.currentGallery.shareLink;
      }
      
      // Update form controls
      if (this.passwordProtection) {
        this.passwordProtection.checked = this.currentGallery.passwordProtected || false;
        this.togglePasswordSection();
      }
      
      const expiryDate = document.getElementById('expiryDate');
      if (expiryDate && this.currentGallery.expiryDate) {
        const date = this.currentGallery.expiryDate.toDate ? 
                    this.currentGallery.expiryDate.toDate() : 
                    new Date(this.currentGallery.expiryDate);
        expiryDate.value = date.toISOString().substr(0, 10);
      }
      
      const preventDownload = document.getElementById('preventDownload');
      if (preventDownload) {
        preventDownload.checked = this.currentGallery.preventDownload !== false; // Default to true
      }
      
      const watermarkEnabled = document.getElementById('watermarkEnabled');
      if (watermarkEnabled) {
        watermarkEnabled.checked = this.currentGallery.watermarkEnabled !== false; // Default to true
      }
      
      // Show revoke access button
      if (this.revokeAccessBtn) {
        this.revokeAccessBtn.classList.remove('hidden');
      }
      
      // Update submit button text
      const submitBtn = document.getElementById('shareGallerySubmitBtn');
      if (submitBtn) {
        submitBtn.textContent = 'Update Settings';
      }
    } else {
      // Gallery not shared yet
      if (this.shareUrlDisplay) {
        this.shareUrlDisplay.value = '';
        this.shareUrlDisplay.placeholder = 'Create a share link first';
      }
      
      // Hide revoke access button
      if (this.revokeAccessBtn) {
        this.revokeAccessBtn.classList.add('hidden');
      }
      
      // Set submit button text
      const submitBtn = document.getElementById('shareGallerySubmitBtn');
      if (submitBtn) {
        submitBtn.textContent = 'Create Share Link';
      }
    }
  }
  
  // Add event listeners
  addEventListeners() {
    // Share settings form
    if (this.shareSettingsForm) {
      this.shareSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (this.currentGallery && this.currentGallery.isShared) {
          this.updateShareSettings();
        } else {
          this.createShareLink();
        }
      });
    }
    
    // Password toggle
    if (this.passwordProtection) {
      this.passwordProtection.addEventListener('change', this.togglePasswordSection);
    }
    
    // Copy link button
    if (this.copyLinkBtn) {
      this.copyLinkBtn.addEventListener('click', this.copyShareLink);
    }
    
    // WhatsApp share button
    if (this.shareWhatsAppBtn) {
      this.shareWhatsAppBtn.addEventListener('click', this.shareViaWhatsApp);
    }
    
    // Email share button
    if (this.shareEmailBtn) {
      this.shareEmailBtn.addEventListener('click', this.shareViaEmail);
    }
    
    // Revoke access button
    if (this.revokeAccessBtn) {
      this.revokeAccessBtn.addEventListener('click', this.revokeAccess);
    }
  }
  
  // Toggle password section visibility
  togglePasswordSection() {
    if (!this.passwordProtection || !this.passwordSection) return;
    
    if (this.passwordProtection.checked) {
      this.passwordSection.classList.remove('hidden');
    } else {
      this.passwordSection.classList.add('hidden');
    }
  }
  
  // Create a share link for the gallery
  createShareLink() {
    if (!this.currentGallery) {
      this.showNotification('error', 'Gallery Not Found', 'Could not find gallery information.');
      return;
    }
    
    console.log('Creating share link for gallery:', this.currentGallery.id);
    
    // Generate a unique share ID
    const shareId = this.db.collection('client-shared-galleries').doc().id;
    
    // Get form values
    const passwordProtection = document.getElementById('passwordProtection');
    const password = document.getElementById('password');
    const expiryDate = document.getElementById('expiryDate');
    const preventDownload = document.getElementById('preventDownload');
    const watermarkEnabled = document.getElementById('watermarkEnabled');
    
    if (!passwordProtection || !preventDownload || !watermarkEnabled) {
      console.error('Form elements not found');
      return;
    }
    
    const passwordProtected = passwordProtection.checked;
    const passwordValue = passwordProtected && password ? password.value : null;
    const expiryDateValue = expiryDate.value ? 
      firebase.firestore.Timestamp.fromDate(new Date(expiryDate.value)) : null;
      
    // Validate password if protection is enabled
    if (passwordProtected && (!passwordValue || passwordValue.length < 4)) {
      this.showNotification('warning', 'Invalid Password', 'Please enter a password with at least 4 characters.');
      return;
    }
    
    // Construct share link
    const baseUrl = window.location.origin;
    const shareLink = `${baseUrl}/pages/client-gallery-view.html?share=${shareId}`;
    
    // Create shared gallery document
    const sharedGalleryData = {
      id: shareId,
      galleryId: this.currentGallery.id,
      clientId: this.currentGallery.clientId,
      photographerId: this.currentUser.uid,
      shareLink: shareLink,
      passwordProtected: passwordProtected,
      password: passwordValue ? this.hashPassword(passwordValue) : null,
      expiryDate: expiryDateValue,
      preventDownload: preventDownload.checked,
      watermarkEnabled: watermarkEnabled.checked,
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
      expiryDate: expiryDateValue,
      preventDownload: preventDownload.checked,
      watermarkEnabled: watermarkEnabled.checked,
      updated: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Disable submit button
    const submitBtn = document.getElementById('shareGallerySubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
    }
    
    // Create a batch write
    const batch = this.db.batch();
    batch.set(this.db.collection('client-shared-galleries').doc(shareId), sharedGalleryData);
    batch.update(this.db.collection('galleries').doc(this.currentGallery.id), galleryUpdateData);
    
    batch.commit()
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
        
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Settings';
        }
        
        // Show success notification
        this.showNotification('success', 'Gallery Shared', 'Your gallery has been shared successfully. You can now copy the link and share it with your client.');
        
        // Highlight the share link
        if (this.shareUrlDisplay) {
          this.shareUrlDisplay.select();
          this.shareUrlDisplay.focus();
        }
      })
      .catch(error => {
        console.error('Error creating share link:', error);
        
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Share Link';
        }
        
        // Show error notification
        this.showNotification('error', 'Sharing Failed', 'Failed to create gallery share link. Please try again.');
      });
  }
  
  // Simple password hashing (you might want to use a better method)
  hashPassword(password) {
    // In production, use a proper hashing library
    return btoa(password); // Base64 encoding for demo
  }
  
  // Update sharing settings
  updateShareSettings() {
    if (!this.currentGallery || !this.currentGallery.isShared) {
      this.showNotification('error', 'Gallery Not Shared', 'Cannot update settings for a gallery that is not shared.');
      return;
    }
    
    console.log('Updating share settings for gallery:', this.currentGallery.id);
    
    // Get form values
    const passwordProtection = document.getElementById('passwordProtection');
    const password = document.getElementById('password');
    const expiryDate = document.getElementById('expiryDate');
    const preventDownload = document.getElementById('preventDownload');
    const watermarkEnabled = document.getElementById('watermarkEnabled');
    
    if (!passwordProtection || !preventDownload || !watermarkEnabled) {
      console.error('Form elements not found');
      return;
    }
    
    const passwordProtected = passwordProtection.checked;
    const passwordValue = passwordProtected && password && password.value ? password.value : null;
    const expiryDateValue = expiryDate.value ? 
      firebase.firestore.Timestamp.fromDate(new Date(expiryDate.value)) : null;
    
    // Validate password if protection is enabled and password is changed
    if (passwordProtected && passwordValue && passwordValue.length < 4) {
      this.showNotification('warning', 'Invalid Password', 'Please enter a password with at least 4 characters.');
      return;
    }
    
    // Disable submit button
    const submitBtn = document.getElementById('shareGallerySubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';
    }
    
    // Find the shared gallery document
    this.db.collection('client-shared-galleries')
      .where('galleryId', '==', this.currentGallery.id)
      .where('status', '==', 'active')
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.error('No active shared gallery found');
          throw new Error('No active shared gallery found');
        }
        
        const sharedGalleryDoc = snapshot.docs[0];
        const sharedGalleryId = sharedGalleryDoc.id;
        
        // Determine if password needs updating
        let newPassword = sharedGalleryDoc.data().password;
        if (passwordProtected && passwordValue) {
          newPassword = this.hashPassword(passwordValue);
        } else if (!passwordProtected) {
          newPassword = null;
        }
        
        // Update shared gallery document
        const sharedGalleryUpdateData = {
          passwordProtected: passwordProtected,
          password: newPassword,
          expiryDate: expiryDateValue,
          preventDownload: preventDownload.checked,
          watermarkEnabled: watermarkEnabled.checked,
          updated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Update gallery document
        const galleryUpdateData = {
          passwordProtected: passwordProtected,
          expiryDate: expiryDateValue,
          preventDownload: preventDownload.checked,
          watermarkEnabled: watermarkEnabled.checked,
          updated: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Create a batch write
        const batch = this.db.batch();
        batch.update(this.db.collection('client-shared-galleries').doc(sharedGalleryId), sharedGalleryUpdateData);
        batch.update(this.db.collection('galleries').doc(this.currentGallery.id), galleryUpdateData);
        
        return batch.commit();
      })
      .then(() => {
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Settings';
        }
        
        // Show success notification
        this.showNotification('success', 'Settings Updated', 'Gallery sharing settings have been updated successfully.');
      })
      .catch(error => {
        console.error('Error updating share settings:', error);
        
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Settings';
        }
        
        // Show error notification
        this.showNotification('error', 'Update Failed', 'Failed to update sharing settings. Please try again.');
      });
  }
  
  // Revoke gallery access
  revokeAccess() {
    if (!this.currentGallery || !this.currentGallery.isShared) {
      this.showNotification('error', 'Gallery Not Shared', 'Cannot revoke access for a gallery that is not shared.');
      return;
    }
    
    if (!confirm('Are you sure you want to revoke access to this gallery? Clients will no longer be able to view photos.')) {
      return;
    }
    
    console.log('Revoking access for gallery:', this.currentGallery.id);
    
    // Disable the button
    if (this.revokeAccessBtn) {
      this.revokeAccessBtn.disabled = true;
      this.revokeAccessBtn.textContent = 'Revoking...';
    }
    
    // Find the shared gallery document
    this.db.collection('client-shared-galleries')
      .where('galleryId', '==', this.currentGallery.id)
      .where('status', '==', 'active')
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          console.error('No active shared gallery found');
          throw new Error('No active shared gallery found');
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
        this.loadSharingUI();
        
        // Re-enable button
        if (this.revokeAccessBtn) {
          this.revokeAccessBtn.disabled = false;
          this.revokeAccessBtn.textContent = 'Revoke Access';
          this.revokeAccessBtn.classList.add('hidden');
        }
        
        // Show success notification
        this.showNotification('success', 'Access Revoked', 'Gallery sharing has been revoked successfully.');
      })
      
      .catch(error => {
        console.error('Error revoking access:', error);
        
        // Re-enable button
        if (this.revokeAccessBtn) {
          this.revokeAccessBtn.disabled = false;
          this.revokeAccessBtn.textContent = 'Revoke Access';
        }
        
        // Show error notification
        this.showNotification('error', 'Revoke Failed', 'Failed to revoke gallery sharing. Please try again.');
      });
  }
  
  // Copy share link to clipboard
  copyShareLink() {
    if (!this.currentGallery || !this.currentGallery.shareLink) {
      this.showNotification('warning', 'No Link Available', 'Create a share link first.');
      return;
    }
    
    const shareLink = this.currentGallery.shareLink;
    
    // Try to use the newer clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareLink)
        .then(() => {
          this.showNotification('success', 'Link Copied', 'Gallery link has been copied to clipboard.');
        })
        .catch(err => {
          console.error('Could not copy text:', err);
          // Fall back to the older method
          this.copyToClipboardFallback(shareLink);
        });
    } else {
      // Fall back to the older method for browsers that don't support clipboard API
      this.copyToClipboardFallback(shareLink);
    }
  }
  
  // Fallback method for copying to clipboard
  copyToClipboardFallback(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showNotification('success', 'Link Copied', 'Gallery link has been copied to clipboard.');
      } else {
        this.showNotification('error', 'Copy Failed', 'Could not copy to clipboard. Please select and copy the link manually.');
      }
    } catch (err) {
      console.error('Fallback: Could not copy text:', err);
      this.showNotification('error', 'Copy Failed', 'Could not copy to clipboard. Please select and copy the link manually.');
    }
    
    document.body.removeChild(textArea);
  }
  
  // Share via WhatsApp
  shareViaWhatsApp() {
    if (!this.currentGallery || !this.currentGallery.shareLink) {
      this.showNotification('warning', 'No Link Available', 'Create a share link first.');
      return;
    }
    
    const shareLink = this.currentGallery.shareLink;
    const galleryName = this.currentGallery.name || 'photo gallery';
    
    // Create WhatsApp message
    let message = `I've shared my ${galleryName} with you. Click the link to view: ${shareLink}`;
    
    // Add password info if protected
    if (this.currentGallery.passwordProtected) {
      message += "\n\nThis gallery is password protected. I will send you the password separately.";
    }
    
    // Add expiry info if set
    if (this.currentGallery.expiryDate) {
      const expiryDate = this.currentGallery.expiryDate.toDate ? 
                        this.currentGallery.expiryDate.toDate().toLocaleDateString() : 
                        new Date(this.currentGallery.expiryDate).toLocaleDateString();
      message += `\n\nThis link will expire on ${expiryDate}.`;
    }
    
    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
    
    // Log the share
    this.logShare('whatsapp');
  }
  
  // Share via Email
  shareViaEmail() {
    if (!this.currentGallery || !this.currentGallery.shareLink) {
      this.showNotification('warning', 'No Link Available', 'Create a share link first.');
      return;
    }
    
    const shareLink = this.currentGallery.shareLink;
    const galleryName = this.currentGallery.name || 'Photo Gallery';
    const photographerName = this.currentUser.displayName || this.currentUser.email || 'Your photographer';
    
    // Create email subject and body
    const subject = `Your photo gallery "${galleryName}" is ready`;
    let body = `Hello,\n\nI've shared my photo gallery "${galleryName}" with you. Click the link below to view your photos:\n\n${shareLink}\n\n`;
    
    // Add password info if protected
    if (this.currentGallery.passwordProtected) {
      body += "This gallery is password protected. I will send you the password separately.\n\n";
    }
    
    // Add expiry info if set
    if (this.currentGallery.expiryDate) {
      const expiryDate = this.currentGallery.expiryDate.toDate ? 
                        this.currentGallery.expiryDate.toDate().toLocaleDateString() : 
                        new Date(this.currentGallery.expiryDate).toLocaleDateString();
      body += `This link will expire on ${expiryDate}.\n\n`;
    }
    
    body += `Best regards,\n${photographerName}`;
    
    // Create mailto URL
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Try to open the default email client
    const emailWindow = window.open(mailtoUrl);
    
    // Check if email client opened successfully
    if (!emailWindow || emailWindow.closed || typeof emailWindow.closed === 'undefined') {
      // Email client didn't open, show instructions
      this.showNotification('info', 'Email Client Not Available', 'Your default email client could not be opened. The link has been copied to clipboard - paste it into your email manually.');
      // Copy the link to clipboard as fallback
      this.copyToClipboardFallback(shareLink);
    } else {
      // Log the share
      this.logShare('email');
    }
  }
  
  // Log share activity
  logShare(method) {
    if (!this.currentGallery || !this.currentUser) return;
    
    // Create a log entry in Firestore
    this.db.collection('gallery_share_logs').add({
      galleryId: this.currentGallery.id,
      photographerId: this.currentUser.uid,
      shareMethod: method,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .catch(error => {
      console.error('Error logging share:', error);
    });
  }
  
  // Helper method to show notifications
  showNotification(type, title, message = '') {
    if (window.NotificationSystem && typeof window.NotificationSystem.showNotification === 'function') {
      window.NotificationSystem.showNotification(type, title, message);
    } else {
      // Fallback if notification system is not available
      console.log(`${type.toUpperCase()}: ${title} - ${message}`);
      alert(`${title}: ${message}`);
    }
  }
}

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
  // Add FontAwesome if not already loaded
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
    document.head.appendChild(link);
  }
  
  window.GallerySharing = new GallerySharing();
});
