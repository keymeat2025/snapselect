// assets/js/shared-gallery-view.js
document.addEventListener('DOMContentLoaded', function() {
    // Make sure Firebase is initialized before using it
    setTimeout(() => {
        // This timeout ensures Firebase has time to initialize
        initSharedGallery();
    }, 500);
    
    function initSharedGallery() {
        // Check if Firebase is initialized
        if (!firebase.apps.length) {
            console.error("Firebase not initialized!");
            showToast('Error: Firebase not initialized. Please try again later.', 'error');
            return;
        }
        
        // Get shared gallery ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('id');
        
        if (!shareId) {
            showToast('Invalid gallery link.', 'error');
            return;
        }
        
        // Check if gallery exists and if it requires a password
        const db = firebase.firestore();
        db.collection('sharedGalleries').where('shareId', '==', shareId)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                    showToast('Gallery not found or access has been revoked.', 'error');
                    return;
                }
                
                const sharedGallery = snapshot.docs[0].data();
                
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
    
    function loadGallery(galleryId) {
        // Hide password screen
        document.getElementById('passwordScreen').style.display = 'none';
        
        // Show gallery container
        document.getElementById('galleryContainer').style.display = 'block';
        
        // Get gallery details
        const db = firebase.firestore();
        db.collection('galleries').doc(galleryId)
            .get()
            .then(doc => {
                if (doc.exists) {
                    const gallery = doc.data();
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
