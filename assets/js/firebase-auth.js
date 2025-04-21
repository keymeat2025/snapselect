// firebase-auth.js
// Authentication functions for SnapSelect

// Initialize module with proper error handling
let auth;
let db;

function initializeModule() {
  if (typeof window.firebaseServices === 'undefined') {
    console.log("Firebase services not available yet, retrying...");
    setTimeout(initializeModule, 100);
    return;
  }
  
  // Now you can safely use window.firebaseServices
  auth = window.firebaseServices.auth;
  db = window.firebaseServices.db;
  
  // Initialize the exported object after auth and db are available
  window.firebaseAuth = {
    setupAuthObserver,
    registerWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
    completeRegistration,
    createUserProfile,
    getCurrentUser
  };
  
  console.log("Firebase Auth module initialized successfully");
}

// Start initialization
initializeModule();

// Authentication state observer
function setupAuthObserver(onUserLoggedIn, onUserLoggedOut) {
  if (!auth) {
    console.error("Auth not initialized yet");
    return;
  }
  
  auth.onAuthStateChanged(user => {
    if (user) {
      // User is signed in
      if (onUserLoggedIn) onUserLoggedIn(user);
    } else {
      // User is signed out
      if (onUserLoggedOut) onUserLoggedOut();
    }
  });
}

// Register with email and password
async function registerWithEmail(email, password) {
  if (!auth) {
    throw new Error("Auth not initialized yet");
  }
  
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Registration error:", error.message);
    throw error;
  }
}

// Sign in with email and password
async function signInWithEmail(email, password) {
  if (!auth) {
    throw new Error("Auth not initialized yet");
  }
  
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Sign in error:", error.message);
    throw error;
  }
}

// Sign in with Google
async function signInWithGoogle() {
  if (!auth) {
    throw new Error("Auth not initialized yet");
  }
  
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error) {
    console.error("Google sign in error:", error.message);
    throw error;
  }
}

// Sign out
async function signOut() {
  if (!auth) {
    throw new Error("Auth not initialized yet");
  }
  
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error.message);
    throw error;
  }
}

// Reset password
async function resetPassword(email) {
  if (!auth) {
    throw new Error("Auth not initialized yet");
  }
  
  try {
    await auth.sendPasswordResetEmail(email);
  } catch (error) {
    console.error("Password reset error:", error.message);
    throw error;
  }
}

// Complete registration (create auth + profile)
async function completeRegistration(email, password, studioData, subscriptionTier) {
  if (!auth || !db) {
    throw new Error("Firebase services not initialized yet");
  }
  
  try {
    // 1. Create the user account
    const user = await registerWithEmail(email, password);
    
    // 2. Create user profile in Firestore
    await createUserProfile(user.uid, {
      email: email,
      studioName: studioData.studioName,
      ownerName: studioData.ownerName,
      ownerEmail: studioData.ownerEmail,
      ownerNumber: studioData.ownerNumber,
      subscriptionTier: subscriptionTier,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return user;
  } catch (error) {
    console.error("Complete registration error:", error.message);
    throw error;
  }
}

// Create user profile in Firestore
async function createUserProfile(userId, userData) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    await db.collection('users').doc(userId).set(userData);
  } catch (error) {
    console.error("Profile creation error:", error.message);
    throw error;
  }
}

// Get current user
function getCurrentUser() {
  if (!auth) {
    console.error("Auth not initialized yet");
    return null;
  }
  
  return auth.currentUser;
}
