/**
 * firebase-config.js - Firebase configuration for SnapSelect
 * Properly sets up firebase with region information for cloud functions
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBXvkPw3b1jtzr0aOl0uGETt-FjqNt9xJA",
    authDomain: "snapselect01-eb74c.firebaseapp.com",
    projectId: "snapselect01-eb74c",
    storageBucket: "snapselect01-eb74c.appspot.com",
    messagingSenderId: "893267642215",
    appId: "1:893267642215:web:45a71e59b263e3f8dc1935",
    measurementId: "G-VBNK5N3XZD",
    // Specifying region for functions
    functionRegion: "asia-south1"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    
    // Configure Functions with the asia-south1 region explicitly
    firebase.functions().useEmulator('localhost', 5001);
} else {
    firebase.app(); // If already initialized, use that one
}

// Set default region for all cloud functions calls
try {
    firebase.app().functions('asia-south1');
    console.log('Firebase initialized with asia-south1 region for functions');
} catch (error) {
    console.error('Error setting region for functions:', error);
}

// Export for use in other files
window.firebaseConfig = firebaseConfig;
