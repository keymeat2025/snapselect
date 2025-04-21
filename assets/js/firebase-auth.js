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
    createPhotographerProfile,
    getCurrentUser,
    recordPayment
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
async function completeRegistration(email, password, studioData, transactionID) {
  if (!auth || !db) {
    throw new Error("Firebase services not initialized yet");
  }
  
  try {
    // 1. Create the user account
    const user = await registerWithEmail(email, password);
    
    // 2. Create photographer profile in Firestore
    await createPhotographerProfile(user.uid, studioData);
    
    // 3. Record payment for registration
    await recordPayment(2, transactionID);
    
    return user;
  } catch (error) {
    console.error("Complete registration error:", error.message);
    throw error;
  }
}

// Create photographer profile in Firestore
async function createPhotographerProfile(userId, studioData) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    // Create main photographer document
    await db.collection('photographer').doc('photographer_main').set({
      studioName: studioData.studioName,
      ownerName: studioData.ownerName,
      ownerEmail: studioData.ownerEmail,
      ownerNumber: studioData.ownerNumber,
      studioAddress: studioData.studioAddress,
      studioPincode: studioData.studioPincode,
      registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
      uid: userId
    });
    
    // Create initial subscription document
    await db.collection('subscription').doc('subscription_current').set({
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

// Record payment in Firestore
async function recordPayment(amount, transactionID) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
  }
  
  try {
    const timestamp = Date.now();
    const paymentID = `pay_${timestamp}_razorpay`;
    
    // Calculate GST (18% of amount)
    const gst = (amount * 0.18).toFixed(2);
    const totalAmount = (parseFloat(amount) + parseFloat(gst)).toFixed(2);
    
    // Create payment document
    await db.collection('payments').doc(paymentID).set({
      amount: amount,
      GST: gst,
      totalAmount: totalAmount,
      invoiceNumber: `INV-${timestamp}`,
      transactionID: transactionID,
      status: 'completed',
      date: firebase.firestore.FieldValue.serverTimestamp(),
      purpose: 'registration',
      paymentMethod: 'razorpay',
      receiptURL: null // Will be generated later
    });
    
    return paymentID;
  } catch (error) {
    console.error("Payment recording error:", error.message);
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
