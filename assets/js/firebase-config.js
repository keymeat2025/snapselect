// firebase-config.js
// Initialize Firebase for SnapSelect application
// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCAl15Yq8Y727PKknJNs0Q8UZbRRbcWkMo",
  authDomain: "snapselect01-eb74c.firebaseapp.com",
  projectId: "snapselect01-eb74c",
  storageBucket: "snapselect01-eb74c.firebasestorage.app",
  messagingSenderId: "749450852067",
  appId: "1:749450852067:web:8b1887075d607b3e91f7d6",
  measurementId: "G-J5XGE71VF6"
};

// Setup initialization queue if not already created
if (!window.onFirebaseReady) {
  window.onFirebaseReady = [];
}

// Initialize Firebase app if not already initialized
if (!window.firebaseServices) {
  try {
    // Initialize Firebase app
    firebase.initializeApp(firebaseConfig);
    
    // Get references to Firebase services
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage ? firebase.storage() : null;
    
    // Initialize Functions with region if available
    let functions = null;
    if (typeof firebase.functions === 'function') {
      functions = firebase.functions();
      // Set India region
      if (typeof functions.useRegion === 'function') {
        functions = functions.useRegion('asia-south1');
      }
      // Set the region for Firebase functions
      if (typeof firebase.functions === 'function') {
        functions = firebase.app().functions("asia-south1");
        console.log("Firebase Functions initialized with region asia-south1");
      }
    }
    
    // Make Firebase services available to other scripts
    window.firebaseServices = {
      auth,
      db,
      storage,
      functions
    };
    
    // Create a global SUBSCRIPTION_PLANS object to be shared across files
    window.SUBSCRIPTION_PLANS = {
      lite: {
        name: 'Lite',
        price: 79,
        priceType: 'per client',
        storageLimit: 2, // GB
        galleryLimit: 1,
        photosPerGallery: 100,
        maxClients: 1,
        expiryDays: 7,
        features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature']
      },
      mini: {
        name: 'Mini',
        price: 149,
        priceType: 'per client',
        storageLimit: 5, // GB
        galleryLimit: 1,
        photosPerGallery: 200,
        maxClients: 1,
        expiryDays: 14,
        features: ['Basic uploads', 'Client selection', 'Basic sharing', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Basic Gallery Customization']
      },
      basic: {
        name: 'Basic',
        price: 399,
        priceType: 'per client',
        storageLimit: 15, // GB
        galleryLimit: 1,
        photosPerGallery: 500,
        maxClients: 1,
        expiryDays: 30,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Custom branding', 'Basic Analytics']
      },
      pro: {
        name: 'Pro',
        price: 799,
        priceType: 'per client',
        storageLimit: 25, // GB
        galleryLimit: 1,
        photosPerGallery: 800,
        maxClients: 1,
        expiryDays: 45,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Advanced Gallery Customization', 'Client Comments', 'Detailed Analytics']
      },
      premium: {
        name: 'Premium',
        price: 1499,
        priceType: 'per client',
        storageLimit: 50, // GB
        galleryLimit: 1,
        photosPerGallery: 1200,
        maxClients: 1,
        expiryDays: 60,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'Complete Gallery Customization', 'Client Comments', 'Detailed Analytics', 'Priority Support']
      },
      ultimate: {
        name: 'Ultimate',
        price: 2999,
        priceType: 'per client',
        storageLimit: 100, // GB
        galleryLimit: 2,
        photosPerGallery: 1250,
        maxClients: 1,
        expiryDays: 90,
        features: ['Advanced uploads', 'Client selection', 'Password protection', 'Mobile-friendly Galleries', 'Client Favorites Feature', 'White-label Gallery Customization', 'Client Comments', 'Advanced Analytics', 'Priority Phone Support']
      }
    };
    
    // Storage quotas and upload limits for firebase-storage.js
    window.STORAGE_QUOTAS = {
      mini: 3,
      basic: 8,
      medium: 25,
      mega: 100
    };
    
    window.UPLOAD_LIMITS = {
      mini: 150,
      basic: 500,
      medium: 1000,
      mega: Infinity // Unlimited for Mega plan
    };
    
    console.log('Firebase initialized successfully');
    
    // Call any queued ready functions
    if (window.onFirebaseReady && Array.isArray(window.onFirebaseReady)) {
      console.log(`Executing ${window.onFirebaseReady.length} queued Firebase callbacks`);
      const callbacks = [...window.onFirebaseReady]; // Create a copy to avoid issues if callbacks register more callbacks
      
      callbacks.forEach(fn => {
        if (typeof fn === 'function') {
          try {
            fn();
          } catch (e) {
            console.error('Error in Firebase ready callback:', e);
          }
        }
      });
      
      // Replace the array with a function that immediately executes new callbacks
      window.onFirebaseReady = function(fn) {
        if (typeof fn === 'function') {
          setTimeout(fn, 0); // Execute asynchronously to avoid potential issues
        }
      };
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}
