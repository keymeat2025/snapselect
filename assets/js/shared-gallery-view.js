// assets/js/shared-gallery-view.js
// Function to load the shared gallery
function initSharedGalleryView() {
  console.log("Initializing shared gallery view");
  
  // Hide loading indicator
  document.getElementById('loadingIndicator').style.display = 'none';
  
  // Get shared gallery ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get('id');
  
  if (!shareId) {
    showToast('Invalid gallery link. No gallery ID provided.', 'error');
    return;
  }
  
  console.log("Looking for shared gallery with ID:", shareId);
  
  // Get Firestore instance from firebaseServices
  const db = window.firebaseServices.db;
  
  // Check if gallery exists and if it requires a password
  db.collection('sharedGalleries').where('shareId', '==', shareId)
    .get()
    .then(snapshot => {
      console.log("Firestore query complete, found documents:", snapshot.size);
      
      if (snapshot.empty) {
        showToast('Gallery not found or access has been revoked.', 'error');
        return;
      }
      
      const sharedGallery = snapshot.docs[0].data();
      console.log("Found shared gallery:", sharedGallery);
      
      if (sharedGallery.passwordProtected) {
        // Show password screen
        document.getElementById('passwordScreen').style.display = 'block';
        
        // Set up password form
        const submitBtn = document.getElementById('submitPasswordBtn');
        submitBtn.addEventListener('click', function() {
          const password = document.getElementById('galleryPassword').value;
          
          if (password === sharedGallery.password) {
            // Password correct, show gallery
            loadGallery(sharedGallery.galleryId);
          } else {
            // Show error
            document.getElementById('passwordError').style.display = 'block';
          }
        });
      } else {
        // No password required, load gallery directly
        loadGallery(sharedGallery.galleryId);
      }
    })
    .catch(error => {
      console.error('Error checking gallery:', error);
      showToast('Error loading gallery. Please try again.', 'error');
    });
}

// Load gallery photos and details
function loadGallery(galleryId) {
  console.log("Loading gallery with ID:", galleryId);
  
  // Hide password screen
  document.getElementById('passwordScreen').style.display = 'none';
  
  // Show gallery container
  document.getElementById('galleryContainer').style.display = 'block';
  
  // Get gallery details
  const db = window.firebaseServices.db;
  db.collection('galleries').doc(galleryId)
    .get()
    .then(doc => {
      if (doc.exists) {
        const gallery = doc.data();
        console.log("Gallery details:", gallery);
        document.getElementById('galleryTitle').textContent = gallery.name || 'Shared Gallery';
        
        // Load photos
        db.collection('photos')
          .where('galleryId', '==', galleryId)
          .where('status', '==', 'active')
          .limit(20)
          .get()
          .then(snapshot => {
            const photosGrid = document.getElementById('photosGrid');
            photosGrid.innerHTML = '';
            
            console.log("Photos query complete, found:", snapshot.size);
            
            if (snapshot.empty) {
              photosGrid.innerHTML = '<p>No photos in this gallery yet.</p>';
              return;
            }
            
            snapshot.forEach(doc => {
              const photo = doc.data();
              const photoElement = createPhotoElement(photo, doc.id);
              photosGrid.appendChild(photoElement);
            });
          })
          .catch(error => {
            console.error('Error loading photos:', error);
            showToast('Error loading photos. Please try again.', 'error');
          });
      } else {
        showToast('Gallery not found.', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading gallery:', error);
      showToast('Error loading gallery. Please try again.', 'error');
    });
}

// Create photo element for display
function createPhotoElement(photo, photoId) {
  const photoItem = document.createElement('div');
  photoItem.className = 'photo-item';
  
  const photoContainer = document.createElement('div');
  photoContainer.className = 'photo-container';
  photoContainer.style.backgroundImage = `url(${photo.thumbnailUrl || photo.url})`;
  
  const photoDetails = document.createElement('div');
  photoDetails.className = 'photo-details';
  
  const photoName = document.createElement('div');
  photoName.className = 'photo-name';
  photoName.textContent = photo.name || 'Photo';
  
  const photoDate = document.createElement('div');
  photoDate.className = 'photo-date';
  if (photo.uploadedAt) {
    const date = photo.uploadedAt.toDate ? photo.uploadedAt.toDate() : new Date(photo.uploadedAt);
    photoDate.textContent = date.toLocaleDateString();
  }
  
  photoDetails.appendChild(photoName);
  photoDetails.appendChild(photoDate);
  
  photoItem.appendChild(photoContainer);
  photoItem.appendChild(photoDetails);
  
  // Make photo clickable to view larger version
  photoContainer.addEventListener('click', function() {
    window.open(photo.url, '_blank');
  });
  
  return photoItem;
}

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

// Register the initialization function with Firebase ready system
// This follows the pattern used in your firebase-db.js
if (window.firebaseServices && window.firebaseServices.db) {
  // Firebase already initialized
  console.log('Firebase services available, initializing shared gallery view');
  initSharedGalleryView();
} else if (typeof window.onFirebaseReady === 'function') {
  // Firebase ready with callback function
  window.onFirebaseReady(initSharedGalleryView);
} else if (Array.isArray(window.onFirebaseReady)) {
  // Firebase not ready yet, register with queue
  window.onFirebaseReady.push(initSharedGalleryView);
} else {
  // Create the queue if it doesn't exist
  window.onFirebaseReady = [initSharedGalleryView];
  console.log('Created Firebase ready queue with shared gallery initialization');
}
