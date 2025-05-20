// firebase-db.js - Database interactions for SnapSelect application

// Initialize database functionality when Firebase is ready
function initDatabaseFunctions() {
  // Check if Firestore is available
  if (!firebase.firestore) {
    console.error('Firebase Firestore is not available');
    return;
  }

  // Firestore settings
  const db = firebase.firestore();
  db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
  });
  
  // Enable offline persistence if supported
  db.enablePersistence({ synchronizeTabs: true })
    .catch(error => {
      if (error.code === 'failed-precondition') {
        console.warn('Persistence failed: Multiple tabs open');
      } else if (error.code === 'unimplemented') {
        console.warn('Persistence not available in this browser');
      }
    });

  // Database utility functions
  window.dbUtils = {
    // Get photographer document
    getPhotographerDoc: async function(uid) {
      try {
        const doc = await db.collection('photographer').doc(uid).get();
        return doc.exists ? doc.data() : null;
      } catch (error) {
        console.error('Error fetching photographer:', error);
        return null;
      }
    },

    // Get clients for a photographer
    getPhotographerClients: async function(photographerId) {
      try {
        const snapshot = await db.collection('clients')
          .where('photographerId', '==', photographerId)
          .get();
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error fetching clients:', error);
        return [];
      }
    },

    // Create a new client
    createClient: async function(photographerId, clientData) {
      try {
        // Add default fields to ensure consistency
        const completeClientData = {
          photographerId,
          planActive: false, // Default to no active plan
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          ...clientData
        };
        
        const clientRef = await db.collection('clients').add(completeClientData);
        
        return clientRef.id;
      } catch (error) {
        console.error('Error creating client:', error);
        throw error;
      }
    },

    // Get galleries for a photographer
    getPhotographerGalleries: async function(photographerId) {
      try {
        const snapshot = await db.collection('galleries')
          .where('photographerId', '==', photographerId)
          .orderBy('createdAt', 'desc')
          .get();
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error fetching galleries:', error);
        return [];
      }
    },

    // Listen for realtime updates to a client's galleries
    listenToClientGalleries: function(clientId, callback) {
      return db.collection('galleries')
        .where('clientId', '==', clientId)
        .onSnapshot(snapshot => {
          const galleries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          callback(galleries);
        }, error => {
          console.error('Error listening to galleries:', error);
          callback([]);
        });
    },

    // Listen for subscription changes
    listenToSubscriptions: function(photographerId, callback) {
      return db.collection('subscriptions')
        .where('photographerId', '==', photographerId)
        .onSnapshot(snapshot => {
          const subscriptions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          callback(subscriptions);
        }, error => {
          console.error('Error listening to subscriptions:', error);
          callback([]);
        });
    },

    // Get active plans for a photographer
    getActivePlans: async function(photographerId) {
      try {
        const now = new Date();
        
        const snapshot = await db.collection('subscriptions')
          .where('photographerId', '==', photographerId)
          .where('expiryDate', '>', now)
          .get();
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error fetching active plans:', error);
        return [];
      }
    },
    
    // NEW: Get client plans with consistent structure
    getClientPlans: async function(photographerId) {
      try {
        const snapshot = await db.collection('client-plans')
          .where('photographerId', '==', photographerId)
          .get();
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error fetching client plans:', error);
        return [];
      }
    },

    // NEW: Update client plan with normalized data
    updateClientPlan: async function(planId, updateData) {
      try {
        // Ensure the timestamp is set for any updates
        const data = {
          ...updateData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('client-plans').doc(planId).update(data);
        return true;
      } catch (error) {
        console.error('Error updating client plan:', error);
        throw error;
      }
    },
    
    // NEW: Create gallery with consistent data structure
    createGallery: async function(photographerId, clientId, galleryData) {
      try {
        // Add required fields for consistency
        const completeGalleryData = {
          photographerId,
          clientId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          photosCount: 0,
          status: 'active',

          clientInteractionStarted: false,
          clientInteractionStartedAt: null,
          freezeStatus: "editable",
          ...galleryData
        };
        
        const galleryRef = await db.collection('galleries').add(completeGalleryData);
        
        // If this gallery is associated with a plan, update the plan
        if (galleryData.planId) {
          await db.collection('client-plans').doc(galleryData.planId).update({
            galleryId: galleryRef.id,
            galleryCreated: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        
        return galleryRef.id;
      } catch (error) {
        console.error('Error creating gallery:', error);
        throw error;
      }
    },

        // LOCATION: In firebase-db.js, at the end of window.dbUtils object
    
    // Check gallery freeze status
    checkGalleryFreezeStatus: async function(galleryId) {
      try {
        const doc = await db.collection('galleries').doc(galleryId).get();
        if (!doc.exists) return "editable"; // Default if gallery not found
        return doc.data().freezeStatus || "editable";
      } catch (error) {
        console.error('Error checking gallery freeze status:', error);
        return "editable"; // Default to editable on error
      }
    },
    
    // Start client interaction (freeze gallery)
    freezeGallery: async function(galleryId, clientId) {
      try {
        await db.collection('galleries').doc(galleryId).update({
          clientInteractionStarted: true,
          clientInteractionStartedAt: firebase.firestore.FieldValue.serverTimestamp(),
          freezeStatus: "frozen",
          interactingClientId: clientId || null
        });
        return true;
      } catch (error) {
        console.error('Error freezing gallery:', error);
        return false;
      }
    },
    
    // Admin unfreeze gallery temporarily
    unfreezeGallery: async function(galleryId, adminId) {
      try {
        // First log the unfreeze action for accountability
        await db.collection('gallery_admin_actions').add({
          action: "unfreeze",
          galleryId: galleryId,
          adminId: adminId,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Then unfreeze the gallery
        await db.collection('galleries').doc(galleryId).update({
          freezeStatus: "editable",
          unfrozenBy: adminId,
          unfrozenAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
      } catch (error) {
        console.error('Error unfreezing gallery:', error);
        return false;
      }
    }

    
  };

  console.log('Database functions initialized successfully');
}

// Check if Firebase is ready and register initialization
if (window.firebaseServices && window.firebaseServices.db) {
  // Firebase already initialized
  console.log('Firebase DB already available, initializing database functions');
  initDatabaseFunctions();
} else if (typeof window.onFirebaseReady === 'function') {
  // Firebase ready but we missed the initialization event
  console.log('Firebase initialized with callback function, registering database init');
  window.onFirebaseReady(initDatabaseFunctions);
} else if (Array.isArray(window.onFirebaseReady)) {
  // Firebase not ready yet
  console.log('Firebase not ready, queuing database initialization');
  window.onFirebaseReady.push(initDatabaseFunctions);
} else {
  // Create the queue if it doesn't exist
  console.log('Creating Firebase ready queue with database initialization');
  window.onFirebaseReady = [initDatabaseFunctions];
}
