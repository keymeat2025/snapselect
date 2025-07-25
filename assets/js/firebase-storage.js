// firebase-storage.js
// Storage operations for photo uploads in SnapSelect

// Access Firebase services from firebase-config.js
const { storage, db } = window.firebaseServices;

// Storage quotas based on subscription tier (in GB)
const STORAGE_QUOTAS = {
  mini: 3,
  basic: 8,
  medium: 25,
  mega: 100
};

// Photo upload limits per gallery
const UPLOAD_LIMITS = {
  mini: 150,
  basic: 500,
  medium: 1000,
  mega: Infinity // Unlimited for Mega plan
};

// Check if user has available storage quota
async function checkStorageQuota(userId, fileSize, userTier) {
  try {
    // Get user's current usage
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Default to 0 if not set yet
    const currentUsage = userData.storageUsed || 0;
    
    // Convert fileSize from bytes to GB for comparison
    const fileSizeGB = fileSize / (1024 * 1024 * 1024);
    
    // Get quota for user's tier
    const tierName = userTier.toLowerCase();
    const quota = STORAGE_QUOTAS[tierName] || STORAGE_QUOTAS.mini;
    
    // Check if upload would exceed quota
    if (currentUsage + fileSizeGB > quota) {
      return {
        canUpload: false,
        currentUsage,
        quota,
        remaining: quota - currentUsage
      };
    }
    
    return {
      canUpload: true,
      currentUsage,
      quota,
      remaining: quota - currentUsage
    };
  } catch (error) {
    console.error("Error checking quota:", error.message);
    throw error;
  }
}

// Check photo count limit for gallery
async function checkPhotoCountLimit(userId, clientId, galleryId, userTier) {
  try {
    // Get gallery info
    const galleryDoc = await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId).get();
    
    const galleryData = galleryDoc.data();
    const currentCount = galleryData.photoCount || 0;
    
    // Get limit for user's tier
    const tierName = userTier.toLowerCase();
    const limit = UPLOAD_LIMITS[tierName] || UPLOAD_LIMITS.mini;
    
    return {
      canUpload: currentCount < limit,
      currentCount,
      limit,
      remaining: limit - currentCount
    };
  } catch (error) {
    console.error("Error checking photo limit:", error.message);
    throw error;
  }
}

// Upload a single photo
async function uploadPhoto(userId, clientId, galleryId, file, metadata = {}) {
  try {
    // Create a storage reference
    const fileName = `${Date.now()}_${file.name}`;
    const photoRef = storage.ref(`users/${userId}/clients/${clientId}/galleries/${galleryId}/${fileName}`);
    
    // Start the upload
    const snapshot = await photoRef.put(file, {
      customMetadata: {
        ...metadata,
        originalName: file.name
      }
    });
    
    // Get the download URL
    const downloadURL = await snapshot.ref.getDownloadURL();
    
    // Add photo record to Firestore
    const photoDoc = await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId)
      .collection('photos').add({
        fileName: fileName,
        originalName: file.name,
        downloadURL: downloadURL,
        size: file.size,
        type: file.type,
        metadata: metadata,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        selected: false // Client hasn't selected this photo yet
      });
    
    // Update photo count in gallery
    await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId)
      .update({
        photoCount: firebase.firestore.FieldValue.increment(1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    // Update user's storage usage
    const fileSizeGB = file.size / (1024 * 1024 * 1024);
    await db.collection('users').doc(userId).update({
      storageUsed: firebase.firestore.FieldValue.increment(fileSizeGB),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      id: photoDoc.id,
      downloadURL: downloadURL,
      fileName: fileName
    };
  } catch (error) {
    console.error("Error uploading photo:", error.message);
    throw error;
  }
}

// Upload multiple photos with progress tracking
async function uploadMultiplePhotos(userId, clientId, galleryId, files, progressCallback, metadata = {}) {
  const results = [];
  let completed = 0;
  
  try {
    // Get user profile to check tier
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userTier = userData.subscriptionTier || 'mini';
    
    // Check limits before starting uploads
    const quotaCheck = await checkStorageQuota(
      userId, 
      Array.from(files).reduce((total, file) => total + file.size, 0),
      userTier
    );
    
    const countCheck = await checkPhotoCountLimit(
      userId, 
      clientId, 
      galleryId,
      userTier
    );
    
    // If can't upload due to quota or count, return early
    if (!quotaCheck.canUpload) {
      throw new Error(`Storage quota exceeded. You have ${quotaCheck.remaining.toFixed(2)} GB remaining.`);
    }
    
    if (!countCheck.canUpload) {
      throw new Error(`Photo limit exceeded. Your plan allows ${countCheck.limit} photos per gallery.`);
    }
    
    // Check if adding these files would exceed the count limit
    if (countCheck.currentCount + files.length > countCheck.limit) {
      throw new Error(`Adding these ${files.length} photos would exceed your limit of ${countCheck.limit} photos.`);
    }
    
    // Process uploads sequentially
    for (const file of Array.from(files)) {
      const result = await uploadPhoto(userId, clientId, galleryId, file, metadata);
      results.push(result);
      
      completed++;
      if (progressCallback) {
        progressCallback(completed, files.length, result);
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error in batch upload:", error.message);
    throw error;
  }
}

// Get photos for a gallery
async function getGalleryPhotos(userId, clientId, galleryId) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId)
      .collection('photos')
      .orderBy('uploadedAt', 'desc')
      .get();
      
    const photos = [];
    snapshot.forEach(doc => {
      photos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return photos;
  } catch (error) {
    console.error("Error getting photos:", error.message);
    throw error;
  }
}

// Delete a photo
async function deletePhoto(userId, clientId, galleryId, photoId, fileName) {
  try {
    // First get the photo to know its size
    const photoDoc = await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId)
      .collection('photos').doc(photoId).get();
    
    const photoData = photoDoc.data();
    
    // Delete from storage
    const photoRef = storage.ref(`users/${userId}/clients/${clientId}/galleries/${galleryId}/${fileName}`);
    await photoRef.delete();
    
    // Delete from Firestore
    await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId)
      .collection('photos').doc(photoId).delete();
    
    // Update photo count in gallery
    await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId)
      .update({
        photoCount: firebase.firestore.FieldValue.increment(-1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    // Update user's storage usage (subtract file size)
    if (photoData && photoData.size) {
      const fileSizeGB = photoData.size / (1024 * 1024 * 1024);
      await db.collection('users').doc(userId).update({
        storageUsed: firebase.firestore.FieldValue.increment(-fileSizeGB),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error deleting photo:", error.message);
    throw error;
  }
}

// Expose functions for use in other files
window.firebaseStorage = {
  checkStorageQuota,
  checkPhotoCountLimit,
  uploadPhoto,
  uploadMultiplePhotos,
  getGalleryPhotos,
  deletePhoto,
  STORAGE_QUOTAS,
  UPLOAD_LIMITS
};
