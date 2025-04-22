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
// Enhanced signOut function for firebase-auth.js
// Add or update this in your existing firebase-auth.js file

/**
 * Enhanced sign out functionality with additional cleanup
 * @param {Object} options - Logout options
 * @param {boolean} options.redirect - Whether to redirect after logout
 * @param {string} options.redirectUrl - URL to redirect to after logout
 * @param {Function} options.onSuccess - Callback for successful logout
 * @param {Function} options.onError - Callback for logout errors
 * @param {boolean} options.clearCache - Whether to clear cache data
 * @returns {Promise<void>}
 */
async function signOut(options = {}) {
  if (!auth) {
    throw new Error("Auth not initialized yet");
  }
  
  // Default options
  const defaultOptions = {
    redirect: true,
    redirectUrl: '/index.html',
    clearCache: true,
    onSuccess: null,
    onError: null
  };
  
  // Merge with defaults
  const settings = { ...defaultOptions, ...options };
  
  try {
    console.log("Starting logout process...");
    
    // 1. Clear any pending operations
    await cancelPendingUploads();
    
    // 2. Sign out from Firebase Auth
    await auth.signOut();
    console.log("Firebase Auth sign-out successful");
    
    // 3. Clear application cache if requested
    if (settings.clearCache) {
      clearApplicationCache();
    }
    
    // 4. Clear any persistent session data
    clearSessionData();
    
    // 5. Update analytics if available
    logUserSignOut();
    
    // 6. Call success callback if provided
    if (typeof settings.onSuccess === 'function') {
      settings.onSuccess();
    }
    
    // 7. Redirect if requested
    if (settings.redirect) {
      console.log(`Redirecting to ${settings.redirectUrl}`);
      window.location.href = settings.redirectUrl;
    }
  } catch (error) {
    console.error("Sign out error:", error.message);
    
    // Call error callback if provided
    if (typeof settings.onError === 'function') {
      settings.onError(error);
    }
    
    throw error;
  }
}

/**
 * Cancel any pending uploads or operations
 * @returns {Promise<void>}
 */
async function cancelPendingUploads() {
  try {
    // Check if we have active uploads
    const pendingUploads = sessionStorage.getItem('snapselect_active_uploads');
    
    if (pendingUploads) {
      const uploads = JSON.parse(pendingUploads);
      console.log(`Found ${uploads.length} pending uploads to cancel`);
      
      // In a real implementation, you would cancel each upload task
      // For now, we'll just clear the stored data
      sessionStorage.removeItem('snapselect_active_uploads');
    }
    
    return true;
  } catch (error) {
    console.warn("Error canceling pending uploads:", error);
    // Non-critical error, continue with logout
    return false;
  }
}

/**
 * Clear application cache
 */
function clearApplicationCache() {
  try {
    // Clear application storage
    const keysToRemove = [
      'snapselect_preferences',
      'snapselect_recent_galleries',
      'snapselect_draft_uploads',
      'snapselect_cached_galleries',
      'snapselect_ui_state'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    console.log("Application cache cleared");
  } catch (error) {
    console.warn("Error clearing application cache:", error);
    // Non-critical error, continue with logout
  }
}

/**
 * Clear session data
 */
function clearSessionData() {
  try {
    // Clear any IndexedDB data if used
    const dbsToClose = ['snapselect-offline-db', 'snapselect-cache'];
    
    dbsToClose.forEach(dbName => {
      const request = indexedDB.deleteDatabase(dbName);
      
      request.onsuccess = function() {
        console.log(`Database ${dbName} deleted successfully`);
      };
      
      request.onerror = function() {
        console.warn(`Couldn't delete database ${dbName}`);
      };
    });
    
    console.log("Session data cleared");
  } catch (error) {
    console.warn("Error clearing session data:", error);
    // Non-critical error, continue with logout
  }
}

/**
 * Log user sign out to analytics
 */
function logUserSignOut() {
  try {
    // If Firebase Analytics is available
    if (window.firebaseServices && window.firebaseServices.analytics) {
      window.firebaseServices.analytics.logEvent('user_logout', {
        timestamp: new Date().toISOString()
      });
      console.log("Logout event logged to analytics");
    }
  } catch (error) {
    console.warn("Error logging to analytics:", error);
    // Non-critical error, continue with logout
  }
}
// Update the signOut function in firebase-auth.js
async function signOut() {
  if (!auth) {
    throw new Error("Auth not initialized yet");
  }
  
  try {
    // Sign out from Firebase
    await auth.signOut();
    
    // Clear all storage
    clearAllStorage();
    
    // Clear browser history state
    clearHistoryState();
    
    // Force redirect to prevent back navigation
    window.location.replace('index.html');
    
  } catch (error) {
    console.error("Sign out error:", error.message);
    throw error;
  }
}

function clearAllStorage() {
  // Clear localStorage
  localStorage.clear();
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear cookies (if any)
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  
  // Clear IndexedDB if used
  if (window.indexedDB) {
    try {
      indexedDB.deleteDatabase('snapselect-db');
    } catch (e) {
      console.log("Error clearing IndexedDB:", e);
    }
  }
}

function clearHistoryState() {
  // Replace current page in history
  window.history.replaceState(null, '', window.location.href);
  
  // Try to prevent back navigation to protected pages
  window.history.pushState(null, '', window.location.href);
  window.onpopstate = function () {
    window.history.go(1);
  };
}
