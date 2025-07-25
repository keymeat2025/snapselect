// dashboard-security.js
// Critical security checks for studiopanel-dashboard.html

// Run immediately before page renders
(function() {
    // Block page rendering temporarily
    document.body.style.display = 'none';
    
    // Check if coming from authorized navigation
    const referrer = document.referrer;
    const isFromAuthorizedPage = referrer.includes('index.html') || 
                                 referrer.includes('studiopanel-login.html');
    
    // Check authentication
    const checkAuth = () => {
        if (typeof window.firebaseServices === 'undefined' || 
            typeof window.firebaseAuth === 'undefined') {
            // Firebase not loaded, wait
            setTimeout(checkAuth, 50);
            return;
        }
        
        const auth = window.firebaseServices.auth;
        const user = auth.currentUser;
        
        if (!user) {
            // Not authenticated - immediate redirect
            window.location.replace('../pages/studiopanel-login.html');
            return;
        }
        
        // Check navigation source
        if (!isFromAuthorizedPage && sessionStorage.getItem('authorizedAccess') !== 'true') {
            // Direct access detected - redirect
            window.location.replace('../index.html');
            return;
        }
        
        // Authorized - show page
        document.body.style.display = '';
        sessionStorage.setItem('authorizedAccess', 'true');
        
        // Clear flag after page load
        window.addEventListener('load', () => {
            sessionStorage.removeItem('authorizedAccess');
        });
        
        // Set up auth state listener
        auth.onAuthStateChanged((user) => {
            if (!user) {
                window.location.replace('../pages/studiopanel-login.html');
            }
        });
    };
    
    checkAuth();
})();

// Prevent browser navigation history manipulation
window.history.pushState(null, '', window.location.href);
window.onpopstate = function() {
    window.history.pushState(null, '', window.location.href);
};

// Clear sensitive data on page unload
window.addEventListener('unload', function() {
    sessionStorage.removeItem('authorizedAccess');
});
