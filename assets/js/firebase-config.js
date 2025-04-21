// firebase-config.js
// Firebase initialization and configuration

// Your Firebase configuration
// Replace these values with your actual Firebase project details

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCAl15Yq8Y727PKknJNs0Q8UZbRRbcWkMo",
  authDomain: "snapselect01-eb74c.firebaseapp.com",
  projectId: "snapselect01-eb74c",
  storageBucket: "snapselect01-eb74c.firebasestorage.app",
  messagingSenderId: "749450852067",
  appId: "1:749450852067:web:8b1887075d607b3e91f7d6",
  measurementId: "G-J5XGE71VF6"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services for use in other files
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// You can access these in other files through:
// const { auth, db, storage } = window.firebaseServices;
window.firebaseServices = { auth, db, storage };
