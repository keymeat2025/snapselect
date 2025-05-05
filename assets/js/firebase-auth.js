// firebase-auth.js
// Authentication functions for SnapSelect

// Initialize module with proper error handling
let auth;
let db;

// Security Manager implementation
const SecurityManager = {
  validateInput(input) {
    // Sanitize all user inputs
    return input.replace(/[<>]/g, '');
  },
  
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  logSecurityEvent(event, details) {
    firebase.firestore().collection('security_logs').add({
      event: event,
      details: details,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      userId: firebase.auth().currentUser?.uid,
      ip: this.getUserIP()
    });
  },
  
  async getUserIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  },
  
  // Add authentication verification method
  checkAuthentication() {
    const currentUser = firebase.auth().currentUser;
    const isAuthenticated = !!currentUser;
    
    console.log("Security check - Current user:", isAuthenticated ? "Authenticated" : "Not authenticated");
    console.log("Security check - Authorization flag:", sessionStorage.getItem('authorizedAccess'));
    
    // Check if we're on a protected page
    const isProtectedPage = window.location.pathname.includes('/pages/') && 
                           !window.location.pathname.includes('login') &&
                           !window.location.pathname.includes('register');
    
    // Check for authorized access flag in addition to auth state
    const hasAuthorizationFlag = sessionStorage.getItem('authorizedAccess') === 'true';
    
    if (isProtectedPage && (!isAuthenticated || !hasAuthorizationFlag)) {
      // Log security event
      this.logSecurityEvent('unauthorized_access_attempt', {
        page: window.location.pathname,
        redirected: true,
        hasAuthFlag: hasAuthorizationFlag,
        isAuthenticated: isAuthenticated
      });
      
      // Clear authorization flag
      sessionStorage.removeItem('authorizedAccess');
      
      // Redirect to login
      console.log("Security check - redirecting to login page");
      window.location.href = window.location.pathname.includes('/pages/') ? 
                            'studiopanel-login.html' : 
                            'pages/studiopanel-login.html';
      return false;
    }
    
    return isAuthenticated;
  }
};

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
    createPhotographerProfile,
    getCurrentUser,
    SecurityManager
  };
  
  // Run security check for protected pages
  SecurityManager.checkAuthentication();
  
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
      console.log("Auth state changed: User is signed in", user.email);
      if (onUserLoggedIn) onUserLoggedIn(user);
    } else {
      // User is signed out
      console.log("Auth state changed: User is signed out");
      if (onUserLoggedOut) onUserLoggedOut();
      
      // Check if we're on a protected page and redirect if needed
      const isProtectedPage = window.location.pathname.includes('/pages/') && 
                             !window.location.pathname.includes('login') &&
                             !window.location.pathname.includes('register');
      
      if (isProtectedPage) {
        // Clear authorization flag
        sessionStorage.removeItem('authorizedAccess');
        sessionStorage.removeItem('authTimestamp');
        
        console.log("Auth state changed - redirecting to login page");
        // Redirect to login
        window.location.href = window.location.pathname.includes('/pages/') ? 
                              'studiopanel-login.html' : 
                              'pages/studiopanel-login.html';
      }
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
    // Set authorization flag on successful registration
    sessionStorage.setItem('authorizedAccess', 'true');
    sessionStorage.setItem('authTimestamp', Date.now().toString());
    console.log("Authorization flag set after registration:", sessionStorage.getItem('authorizedAccess'));
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
    console.log("Attempting to sign in with email:", email);
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    
    // Set authorization flag AFTER successful login
    sessionStorage.setItem('authorizedAccess', 'true');
    sessionStorage.setItem('authTimestamp', Date.now().toString());
    
    console.log("Authorization flag set after login:", sessionStorage.getItem('authorizedAccess'));
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
    console.log("Attempting to sign in with Google");
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    
    // Set authorization flag AFTER successful login
    sessionStorage.setItem('authorizedAccess', 'true');
    sessionStorage.setItem('authTimestamp', Date.now().toString());
    
    console.log("Authorization flag set after Google login:", sessionStorage.getItem('authorizedAccess'));
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
    // Clear authorization flag immediately
    console.log("Clearing authorization flags");
    sessionStorage.removeItem('authorizedAccess');
    sessionStorage.removeItem('authTimestamp');
    
    await auth.signOut();
    console.log("Firebase sign out completed");
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

// Create photographer profile in Firestore
async function createPhotographerProfile(userId, studioData) {
  if (!db) {
    throw new Error("Firestore not initialized yet");
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

// Get current user
function getCurrentUser() {
  if (!auth) {
    console.error("Auth not initialized yet");
    return null;
  }
  
  return auth.currentUser;
}

// Enhanced sign out functionality with additional cleanup
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
    
    // Clear authorization flag immediately
    console.log("Clearing authorization flags");
    sessionStorage.removeItem('authorizedAccess');
    sessionStorage.removeItem('authTimestamp');
    
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
