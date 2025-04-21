// firebase-auth.js
// Authentication functions for SnapSelect

// Access Firebase services from firebase-config.js
const { auth, db } = window.firebaseServices;

// Authentication state observer
function setupAuthObserver(onUserLoggedIn, onUserLoggedOut) {
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
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error.message);
    throw error;
  }
}

// Reset password
async function resetPassword(email) {
  try {
    await auth.sendPasswordResetEmail(email);
  } catch (error) {
    console.error("Password reset error:", error.message);
    throw error;
  }
}

// Complete registration (create auth + profile)
async function completeRegistration(email, password, studioData, subscriptionTier) {
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
  try {
    await db.collection('users').doc(userId).set(userData);
  } catch (error) {
    console.error("Profile creation error:", error.message);
    throw error;
  }
}

// Get current user
function getCurrentUser() {
  return auth.currentUser;
}

// Expose functions for use in other files
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
