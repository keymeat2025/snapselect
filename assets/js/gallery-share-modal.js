// assets/js/gallery-share-modal.js
const GalleryShareModal = {
  currentGalleryId: null,
  
  open: function(galleryData) {
    this.currentGalleryId = galleryData.id;
    const modal = document.getElementById('shareGalleryModal');
    modal.style.display = 'block';
    
    // Check if gallery is already shared
    this.checkSharingStatus();
  },
  
  checkSharingStatus: function() {
    // Check Firestore to see if gallery is already shared
    const db = firebase.firestore();
    db.collection('sharedGalleries').where('galleryId', '==', this.currentGalleryId)
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          // Gallery is already shared, show the URL
          const shareData = snapshot.docs[0].data();
          this.displayShareLink(shareData.shareId);
          // Show revoke button
          document.getElementById('revokeAccessBtn').classList.remove('hidden');
        }
      });
  },
  
  displayShareLink: function(shareId) {
    const shareUrl = `${window.location.origin}/pages/html/shared-gallery-view.html?id=${shareId}`;
    const urlDisplay = document.getElementById('shareUrlDisplay');
    urlDisplay.value = shareUrl;
    document.getElementById('shareLinkSection').classList.remove('hidden');
  },
  
  shareGallery: function() {
    const password = document.getElementById('password').value;
    const passwordProtected = document.getElementById('passwordProtection').checked;
    
    // Generate a random shareId
    const shareId = Math.random().toString(36).substring(2, 15);
    
    // Save sharing info to Firestore
    const db = firebase.firestore();
    db.collection('sharedGalleries').add({
      galleryId: this.currentGalleryId,
      shareId: shareId,
      passwordProtected: passwordProtected,
      password: passwordProtected ? password : '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      this.displayShareLink(shareId);
      document.getElementById('revokeAccessBtn').classList.remove('hidden');
      
      // Show success message
      showToast('Gallery shared successfully!', 'success');
    })
    .catch(error => {
      console.error('Error sharing gallery:', error);
      showToast('Error sharing gallery. Please try again.', 'error');
    });
  },
  
  revokeAccess: function() {
    const db = firebase.firestore();
    db.collection('sharedGalleries').where('galleryId', '==', this.currentGalleryId)
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          // Delete all sharing records for this gallery
          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          return batch.commit();
        }
      })
      .then(() => {
        document.getElementById('shareLinkSection').classList.add('hidden');
        document.getElementById('revokeAccessBtn').classList.add('hidden');
        showToast('Gallery access revoked.', 'success');
      })
      .catch(error => {
        console.error('Error revoking access:', error);
        showToast('Error revoking access. Please try again.', 'error');
      });
  }
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
  const shareForm = document.getElementById('shareSettingsForm');
  const passwordToggle = document.getElementById('passwordProtection');
  const passwordSection = document.getElementById('passwordSection');
  const revokeBtn = document.getElementById('revokeAccessBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  
  if (shareForm) {
    shareForm.addEventListener('submit', function(e) {
      e.preventDefault();
      GalleryShareModal.shareGallery();
    });
  }
  
  if (passwordToggle) {
    passwordToggle.addEventListener('change', function() {
      if (this.checked) {
        passwordSection.classList.remove('hidden');
      } else {
        passwordSection.classList.add('hidden');
      }
    });
  }
  
  if (revokeBtn) {
    revokeBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to revoke access to this gallery?')) {
        GalleryShareModal.revokeAccess();
      }
    });
  }
  
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', function() {
      const urlInput = document.getElementById('shareUrlDisplay');
      urlInput.select();
      document.execCommand('copy');
      showToast('Link copied to clipboard!', 'success');
    });
  }
});

// Helper function to show toast notifications
function showToast(message, type = 'info') {
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

// Export the module
window.GalleryShareModal = GalleryShareModal;
