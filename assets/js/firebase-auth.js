// firebase-auth.js
// Enhanced Authentication Module for SnapSelect

// Registration Stages
const REGISTRATION_STAGES = {
  INITIAL: 'initial',
  GOOGLE_AUTHENTICATED: 'google_auth',
  STUDIO_INFO_ENTERED: 'studio_info',
  PAYMENT_COMPLETE: 'payment_complete'
};

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
    createPhotographerProfile,
    getCurrentUser,
    recordPayment,
    updateRegistrationStage,
    getRegistrationStage
  };
  
  console.log("Firebase Auth module initialized successfully");
}

// Start initialization
initializeModule();

// Update registration stage in Firestore
async function updateRegistrationStage(userId, stage) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  try {
    await db.collection('users').doc(userId).set({
      registrationStage: stage,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`Registration stage updated to: ${stage}`);
  } catch (error) {
    console.error("Error updating registration stage:", error);
    throw error;
  }
}

// Get current registration stage
async function getRegistrationStage(userId) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data().registrationStage : REGISTRATION_STAGES.INITIAL;
  } catch (error) {
    console.error("Error fetching registration stage:", error);
    return REGISTRATION_STAGES.INITIAL;
  }
}

// Authentication state observer with stage checking
function setupAuthObserver(onUserLoggedIn, onUserLoggedOut, onPartialRegistration) {
  if (!auth || !db) {
    console.error("Auth or Firestore not initialized");
    return;
  }
  
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        // Check user's registration stage
        const stage = await getRegistrationStage(user.uid);
        
        switch (stage) {
          case REGISTRATION_STAGES.PAYMENT_COMPLETE:
            if (onUserLoggedIn) onUserLoggedIn(user);
            break;
          case REGISTRATION_STAGES.GOOGLE_AUTHENTICATED:
          case REGISTRATION_STAGES.STUDIO_INFO_ENTERED:
            if (onPartialRegistration) onPartialRegistration(user, stage);
            break;
          default:
            // Initial or unknown stage
            if (onPartialRegistration) onPartialRegistration(user, REGISTRATION_STAGES.INITIAL);
        }
      } catch (error) {
        console.error("Error checking registration status:", error);
        // Fallback to logged out state if there's an error
        if (onUserLoggedOut) onUserLoggedOut();
      }
    } else {
      // User is signed out
      if (onUserLoggedOut) onUserLoggedOut();
    }
  });
}

// Sign in with Google with stage tracking
async function signInWithGoogle() {
  if (!auth || !db) {
    throw new Error("Firebase services not initialized");
  }
  
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    // Create or update user document with initial stage
    await updateRegistrationStage(user.uid, REGISTRATION_STAGES.GOOGLE_AUTHENTICATED);
    
    return user;
  } catch (error) {
    console.error("Google sign in error:", error.message);
    throw error;
  }
}

// Complete registration with stage updates
async function completeRegistration(email, password, studioData, transactionID) {
  if (!auth || !db) {
    throw new Error("Firebase services not initialized");
  }
  
  try {
    // 1. Create the user account
    const user = await registerWithEmail(email, password);
    
    // 2. Create photographer profile in Firestore
    await createPhotographerProfile(user.uid, studioData);
    
    // 3. Record payment for registration
    await recordPayment(2, transactionID);
    
    // 4. Update registration stage to complete
    await updateRegistrationStage(user.uid, REGISTRATION_STAGES.PAYMENT_COMPLETE);
    
    return user;
  } catch (error) {
    console.error("Complete registration error:", error.message);
    throw error;
  }
}

// Rest of the existing authentication functions remain the same...
// (registerWithEmail, signInWithEmail, signOut, resetPassword, etc.)

// Modify createPhotographerProfile to track registration progress
async function createPhotographerProfile(userId, studioData) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  try {
    // Create main photographer document
    await db.collection('photographer').doc(userId).set({
      studioName: studioData.studioName,
      ownerName: studioData.ownerName,
      ownerEmail: studioData.ownerEmail,
      ownerNumber: studioData.ownerNumber,
      studioAddress: studioData.studioAddress,
      studioPincode: studioData.studioPincode,
      registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
      uid: userId
    });
    
    // Update registration stage
    await updateRegistrationStage(userId, REGISTRATION_STAGES.STUDIO_INFO_ENTERED);
    
    // Create initial subscription document
    await db.collection('subscription').doc(userId).set({
      planType: 'free',
      storageQuota: 1, // 1GB free storage
      startDate: firebase.firestore.FieldValue.serverTimestamp(),
      endDate: null, // No end date for free tier
      autoRenew: false,
      features: ['basic_uploads', 'limited_clients']
    });
    
    return true;
  } catch (error) {
    console.error("Profile creation error:", error.message);
    throw error;
  }
}
