// firebase-db.js
// Firestore database functions for SnapSelect

// Initialize module with proper error handling
let db;

function initializeModule() {
  if (typeof window.firebaseServices === 'undefined' || !window.firebaseServices.db) {
    console.log("Firebase Firestore not available yet, retrying...");
    setTimeout(initializeModule, 100);
    return;
  }
  
  // Now you can safely use window.firebaseServices
  db = window.firebaseServices.db;
  
  // Initialize the exported object after db is available
  window.firebaseDb = {
    getUserProfile,
    updateUserProfile,
    createClientGallery,
    getUserGalleries,
    getGallery,
    addPhotoToGallery,
    getGalleryPhotos,
    updatePhotoSelections
  };
  
  console.log("Firebase DB module initialized successfully");
}

// Start initialization
initializeModule();

// Get user profile data
async function getUserProfile(userId) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    const docRef = await db.collection('users').doc(userId).get();
    if (docRef.exists) {
      return docRef.data();
    } else {
      console.log('No user profile found for ID:', userId);
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

// Update user profile data
async function updateUserProfile(userId, profileData) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    await db.collection('users').doc(userId).update({
      ...profileData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Create a new gallery/collection for a client
async function createClientGallery(userId, galleryData) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    const result = await db.collection('users').doc(userId)
      .collection('galleries').add({
        ...galleryData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    return result.id;
  } catch (error) {
    console.error('Error creating client gallery:', error);
    throw error;
  }
}

// Get a list of all galleries for a user
async function getUserGalleries(userId) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('galleries')
      .orderBy('createdAt', 'desc')
      .get();
    
    const galleries = [];
    snapshot.forEach(doc => {
      galleries.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return galleries;
  } catch (error) {
    console.error('Error getting user galleries:', error);
    throw error;
  }
}

// Get a specific gallery by ID
async function getGallery(userId, galleryId) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    const doc = await db.collection('users').doc(userId)
      .collection('galleries').doc(galleryId).get();
    
    if (doc.exists) {
      return {
        id: doc.id,
        ...doc.data()
      };
    } else {
      console.log('No gallery found with ID:', galleryId);
      return null;
    }
  } catch (error) {
    console.error('Error getting gallery:', error);
    throw error;
  }
}

// Store photo metadata in a gallery
async function addPhotoToGallery(userId, galleryId, photoData) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    const result = await db.collection('users').doc(userId)
      .collection('galleries').doc(galleryId)
      .collection('photos').add({
        ...photoData,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    // Also update the gallery's updatedAt time
    await db.collection('users').doc(userId)
      .collection('galleries').doc(galleryId).update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        photoCount: firebase.firestore.FieldValue.increment(1)
      });
    
    return result.id;
  } catch (error) {
    console.error('Error adding photo to gallery:', error);
    throw error;
  }
}

// Get all photos in a gallery
async function getGalleryPhotos(userId, galleryId) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    const snapshot = await db.collection('users').doc(userId)
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
    console.error('Error getting gallery photos:', error);
    throw error;
  }
}

// Mark photos as selected by client
async function updatePhotoSelections(userId, galleryId, photoId, isSelected) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    await db.collection('users').doc(userId)
      .collection('galleries').doc(galleryId)
      .collection('photos').doc(photoId)
      .update({
        isSelected: isSelected,
        selectedAt: isSelected ? firebase.firestore.FieldValue.serverTimestamp() : null
      });
    
    // Update selection count in gallery document
    if (isSelected) {
      await db.collection('users').doc(userId)
        .collection('galleries').doc(galleryId)
        .update({
          selectedCount: firebase.firestore.FieldValue.increment(1)
        });
    } else {
      await db.collection('users').doc(userId)
        .collection('galleries').doc(galleryId)
        .update({
          selectedCount: firebase.firestore.FieldValue.increment(-1)
        });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating photo selection:', error);
    throw error;
  }
}
