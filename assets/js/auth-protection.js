// auth-protection.js
// Add this script to all protected pages (dashboard, settings, etc.)

document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing authentication protection...");
    
    // Check authentication immediately before page renders
    checkAuthAndProtect();
    
    // Prevent browser caching of sensitive pages
    preventCaching();
});

function checkAuthAndProtect() {
    // Wait for Firebase to initialize
    if (typeof window.firebaseServices === 'undefined' || 
        typeof window.firebaseAuth === 'undefined') {
        console.log("Waiting for Firebase to initialize...");
        setTimeout(checkAuthAndProtect, 100);
        return;
    }
    
    // Check current auth state
    const auth = window.firebaseServices.auth;
    
    auth.onAuthStateChanged((user) => {
        if (!user) {
            // User is not authenticated, redirect to login
            console.log("User not authenticated, redirecting to login...");
            
            // Store the attempted URL for redirect after login
            sessionStorage.setItem('redirectAfterLogin', window.location.href);
            
            // Redirect to login page based on current location
            const currentPath = window.location.pathname;
            if (currentPath.includes('/pages/')) {
                window.location.replace('studiopanel-login.html');
            } else {
                window.location.replace('pages/studiopanel-login.html');
            }
        } else {
            // User is authenticated, allow access
            console.log("User authenticated:", user.email);
            
            // Optionally check if user has proper role/permissions here
            checkUserPermissions(user);
        }
    });
}

function checkUserPermissions(user) {
    // Optional: Add role-based access control
    // You can fetch user role from Firestore and validate
    const db = window.firebaseServices.db;
    
    db.collection('photographer')
        .where('uid', '==', user.uid)
        .limit(1)
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                console.log("No photographer profile found");
                // Redirect if user doesn't have proper profile
                window.firebaseAuth.signOut();
                window.location.replace('pages/studiopanel-login.html');
            }
        })
        .catch((error) => {
            console.error("Error checking permissions:", error);
        });
}

function preventCaching() {
    // Add meta tags to prevent caching
    const metaNoCache = document.createElement('meta');
    metaNoCache.httpEquiv = 'Cache-Control';
    metaNoCache.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(metaNoCache);
    
    const metaPragma = document.createElement('meta');
    metaPragma.httpEquiv = 'Pragma';
    metaPragma.content = 'no-cache';
    document.head.appendChild(metaPragma);
    
    const metaExpires = document.createElement('meta');
    metaExpires.httpEquiv = 'Expires';
    metaExpires.content = '0';
    document.head.appendChild(metaExpires);
    
    // Disable back button access to this page
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function() {
        window.history.pushState(null, "", window.location.href);
    };
}
