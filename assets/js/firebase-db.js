// firebase-db.js
// Database operations for SnapSelect

// Access Firebase services from firebase-config.js
const { db } = window.firebaseServices;

// Get user profile
async function getUserProfile(userId) {
  try {
    const doc = await db.collection('users').doc(userId).get();
    if (doc.exists) {
      return doc.data();
    } else {
      console.error("No user profile found");
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error.message);
    throw error;
  }
}

// Update user profile
async function updateUserProfile(userId, userData) {
  try {
    await db.collection('users').doc(userId).update({
      ...userData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating profile:", error.message);
    throw error;
  }
}

// Update subscription tier
async function updateSubscriptionTier(userId, tierName) {
  try {
    await db.collection('users').doc(userId).update({
      subscriptionTier: tierName,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating subscription:", error.message);
    throw error;
  }
}

// Create new client
async function createClient(userId, clientData) {
  try {
    const clientRef = await db.collection('users').doc(userId).collection('clients').add({
      ...clientData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return clientRef.id;
  } catch (error) {
    console.error("Error creating client:", error.message);
    throw error;
  }
}

// Get user's clients
async function getUserClients(userId) {
  try {
    const snapshot = await db.collection('users').doc(userId).collection('clients').get();
    const clients = [];
    snapshot.forEach(doc => {
      clients.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return clients;
  } catch (error) {
    console.error("Error getting clients:", error.message);
    throw error;
  }
}

// Create gallery for client
async function createGallery(userId, clientId, galleryData) {
  try {
    // Calculate expiration based on subscription tier
    let expirationDays = 14; // default for Mini tier
    
    // Set expirations based on tier
    switch(galleryData.tier.toLowerCase()) {
      case 'mini':
        expirationDays = 14;
        break;
      case 'basic':
        expirationDays = 30;
        break;
      case 'medium':
        expirationDays = 45;
        break;
      case 'mega':
        expirationDays = 90;
        break;
    }
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    
    const galleryRef = await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').add({
        ...galleryData,
        expiresAt: expiresAt,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
    return galleryRef.id;
  } catch (error) {
    console.error("Error creating gallery:", error.message);
    throw error;
  }
}

// Get client galleries
async function getClientGalleries(userId, clientId) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').get();
      
    const galleries = [];
    snapshot.forEach(doc => {
      galleries.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return galleries;
  } catch (error) {
    console.error("Error getting galleries:", error.message);
    throw error;
  }
}

// Get gallery details
async function getGalleryDetails(userId, clientId, galleryId) {
  try {
    const doc = await db.collection('users').doc(userId)
      .collection('clients').doc(clientId)
      .collection('galleries').doc(galleryId).get();
      
    if (doc.exists) {
      return {
        id: doc.id,
        ...doc.data()
      };
    } else {
      console.error("Gallery not found");
      return null;
    }
  } catch (error) {
    console.error("Error getting gallery:", error.message);
    throw error;
  }
}

// Expose functions for use in other files
window.firebaseDb = {
  getUserProfile,
  updateUserProfile,
  updateSubscriptionTier,
  createClient,
  getUserClients,
  createGallery,
  getClientGalleries,
  getGalleryDetails
};
