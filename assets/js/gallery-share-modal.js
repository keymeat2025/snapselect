/**
 * gallery-share-modal.js - Handles the gallery sharing modal functionality
 * This script manages the share modal UI and interactions
 */

class GalleryShareModal {
  constructor() {
    // DOM Elements
    this.modal = document.getElementById('shareGalleryModal');
    this.closeModalBtns = document.querySelectorAll('#shareGalleryModal .close-modal');
    this.shareGalleryBtn = document.getElementById('shareGalleryBtn');
    
    // State
    this.currentGallery = null;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.open = this.open.bind(this);
    this.close = this.close.bind(this);
    
    // Initialize
    this.init();
  }
  
  // Initialize the modal
  init() {
    console.log('Initializing GalleryShareModal...');
    
    // Add event listeners for close buttons
    if (this.closeModalBtns) {
      this.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', this.close);
      });
    }
    
    // Add event listener for share gallery button
    if (this.shareGalleryBtn) {
      this.shareGalleryBtn.addEventListener('click', () => {
        // When the share button is clicked, we need the gallery data
        if (window.galleryView && window.galleryView.loadGalleryData) {
          // Use the existing galleryData from galleryView
          const galleryData = window.galleryData;
          if (galleryData) {
            this.open(galleryData);
          } else {
            console.error('Gallery data is not available');
            alert('Gallery information is not available. Please try again.');
          }
        }
      });
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
    if (!this.modal || !galleryData) {
      console.error('Modal or gallery data not available', { modal: !!this.modal, galleryData: !!galleryData });
      return;
    }
    
    console.log('Opening share modal for gallery:', galleryData.id);
    
    this.currentGallery = galleryData;
    
    // Display the modal
    this.modal.style.display = 'block';
    
    // Make sure GallerySharing has the latest gallery data
    if (window.GallerySharing) {
      // Force a refresh of the sharing UI
      window.GallerySharing.currentGallery = galleryData;
      window.GallerySharing.loadSharingUI();
    } else {
      console.error('GallerySharing module not found');
      // Display a warning in the modal
      const shareUrlDisplay = document.getElementById('shareUrlDisplay');
      if (shareUrlDisplay) {
        shareUrlDisplay.value = '';
        shareUrlDisplay.placeholder = 'Sharing module not loaded properly';
      }
    }
  }
  
  // Close the share modal
  close() {
    if (!this.modal) return;
    
    console.log('Closing share modal');
    this.modal.style.display = 'none';
  }
}

// Initialize the share modal when document is ready
document.addEventListener('DOMContentLoaded', function() {
  window.GalleryShareModal = new GalleryShareModal();
});
