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
    }
    
    // Make Firebase services available to other scripts
    window.firebaseServices = {
      auth,
      db,
      storage,
      functions
    };
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}
