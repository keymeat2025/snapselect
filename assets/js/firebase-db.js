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
        const clientRef = await db.collection('clients').add({
          photographerId,
          ...clientData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
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
