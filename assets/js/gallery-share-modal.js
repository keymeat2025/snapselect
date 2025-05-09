/**
 * gallery-share-modal.js - Handles the gallery sharing modal functionality
 * This script manages the share modal UI and interactions
 */

class GalleryShareModal {
  constructor() {
    // DOM Elements
    this.modal = document.getElementById('shareGalleryModal');
    this.closeModalBtns = document.querySelectorAll('#shareGalleryModal .close-modal');
    this.shareSettingsForm = document.getElementById('shareSettingsForm');
    this.passwordProtectionToggle = document.getElementById('passwordProtection');
    this.passwordSection = document.getElementById('passwordSection');
    this.shareLinkSection = document.getElementById('shareLinkSection');
    this.shareUrlDisplay = document.getElementById('shareUrlDisplay');
    this.copyLinkBtn = document.getElementById('copyLinkBtn');
    this.revokeAccessBtn = document.getElementById('revokeAccessBtn');
    this.shareGallerySubmitBtn = document.getElementById('shareGallerySubmitBtn');
    
    // State
    this.currentGallery = null;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.togglePasswordSection = this.togglePasswordSection.bind(this);
    this.updateFromGalleryData = this.updateFromGalleryData.bind(this);
    
    // Initialize
    this.init();
  }
  
  // Initialize the modal
  init() {
    // Add event listeners for close buttons
    if (this.closeModalBtns) {
      this.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', this.close);
      });
    }
    
    // Add event listener for form submission
    if (this.shareSettingsForm) {
      this.shareSettingsForm.addEventListener('submit', this.handleSubmit);
    }
    
    // Add event listener for password protection toggle
    if (this.passwordProtectionToggle) {
      this.passwordProtectionToggle.addEventListener('change', this.togglePasswordSection);
    }
    
    // Close when clicking outside modal content
    window.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
    
    // Escape key to close modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.style.display === 'block') {
        this.close();
      }
    });
  }
  
  // Open the share modal with gallery data
  open(galleryData) {
    if (!this.modal || !galleryData) return;
    
    this.currentGallery = galleryData;
    
    // Update form with current gallery settings
    this.updateFromGalleryData();
    
    // Display the modal
    this.modal.style.display = 'block';
  }
  
  // Close the share modal
  close() {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
  }
  
  // Update form fields from gallery data
  updateFromGalleryData() {
    if (!this.currentGallery) return;
    
    // Set form values based on gallery data
    const passwordProtection = document.getElementById('passwordProtection');
    const expiryDate = document.getElementById('expiryDate');
    const maxSelections = document.getElementById('maxSelections');
    const requireApproval = document.getElementById('requireApproval');
    const preventDownload = document.getElementById('preventDownload');
    const watermarkEnabled = document.getElementById('watermarkEnabled');
    
    if (passwordProtection) {
      passwordProtection.checked = this.currentGallery.passwordProtected || false;
      this.togglePasswordSection();
    }
    
    if (expiryDate && this.currentGallery.expiryDate) {
      // Format date to YYYY-MM-DD for input[type=date]
      const date = this.currentGallery.expiryDate.toDate ? 
                  this.currentGallery.expiryDate.toDate() : 
                  new Date(this.currentGallery.expiryDate);
                  
      expiryDate.value = date.toISOString().substr(0, 10);
    }
    
    if (maxSelections) {
      maxSelections.value = this.currentGallery.maxSelections || '';
    }
    
    if (requireApproval) {
      requireApproval.checked = this.currentGallery.requireApproval || false;
    }
    
    if (preventDownload) {
      preventDownload.checked = this.currentGallery.preventDownload || false;
    }
    
    if (watermarkEnabled) {
      watermarkEnabled.checked = this.currentGallery.watermarkEnabled || false;
    }
    
    // Update UI based on whether gallery is already shared
    if (this.currentGallery.isShared) {
      // Show share link
      if (this.shareLinkSection && this.shareUrlDisplay) {
        this.shareUrlDisplay.value = this.currentGallery.shareLink || '';
        this.shareLinkSection.classList.remove('hidden');
      }
      
      // Show revoke access button
      if (this.revokeAccessBtn) {
        this.revokeAccessBtn.classList.remove('hidden');
      }
      
      // Update submit button text
      if (this.shareGallerySubmitBtn) {
        this.shareGallerySubmitBtn.textContent = 'Update Settings';
      }
    } else {
      // Hide share link
      if (this.shareLinkSection) {
        this.shareLinkSection.classList.add('hidden');
      }
      
      // Hide revoke access button
      if (this.revokeAccessBtn) {
        this.revokeAccessBtn.classList.add('hidden');
      }
      
      // Update submit button text
      if (this.shareGallerySubmitBtn) {
        this.shareGallerySubmitBtn.textContent = 'Share Gallery';
      }
    }
  }
  
  // Toggle password section visibility
  togglePasswordSection() {
    if (!this.passwordProtectionToggle || !this.passwordSection) return;
    
    if (this.passwordProtectionToggle.checked) {
      this.passwordSection.classList.remove('hidden');
    } else {
      this.passwordSection.classList.add('hidden');
    }
  }
  
  // Handle form submission
  handleSubmit(e) {
    e.preventDefault();
    
    if (!this.currentGallery || !window.GallerySharing) return;
    
    // Call the appropriate method on GallerySharing class
    if (this.currentGallery.isShared) {
      window.GallerySharing.updateShareSettings();
    } else {
      window.GallerySharing.createShareLink();
    }
    
    // Close the modal
    this.close();
  }
}

// Initialize the share modal when document is ready
document.addEventListener('DOMContentLoaded', function() {
  window.GalleryShareModal = new GalleryShareModal();
});
