// firestore.rules  firebase-security-rules.js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions for common security checks
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/admin/$(request.auth.uid));
    }
    
    function isPhotographer() {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/photographer/$(request.auth.uid));
    }
    
    function isClient() {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/clients).where('uid', '==', request.auth.uid).limit(1);
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function hasPlanAccess(photographerId, clientId) {
      let clientPlanId = photographerId + '_' + clientId;
      let plan = get(/databases/$(database)/documents/client-plans/$(clientPlanId));
      return plan != null && 
             (plan.data.status == 'active' || plan.data.status == 'expiring_soon') &&
             plan.data.planEndDate > request.time;
    }
    
    // Default deny all
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Users collection - Basic user profiles
    match /users/{userId} {
      allow read: if isSignedIn() && (isOwner(userId) || isAdmin());
      allow create: if isSignedIn() && isOwner(userId);
      allow update: if isSignedIn() && (isOwner(userId) || isAdmin());
      allow delete: if isAdmin();
    }
    
    // Admin collection - Admin users
    match /admin/{userId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
    
    // Photographer collection - Photographer profiles
    match /photographer/{userId} {
      allow read: if isSignedIn() && (isOwner(userId) || isAdmin());
      allow create: if isSignedIn() && isOwner(userId);
      allow update: if isSignedIn() && (isOwner(userId) || isAdmin());
      allow delete: if isAdmin();
    }
    
    // Clients collection - Client profiles
    match /clients/{clientId} {
      // Photographers can read and manage their own clients
      function isClientOwner() {
        return isPhotographer() && resource.data.photographerId == request.auth.uid;
      }
      
      allow read: if isSignedIn() && (isClientOwner() || isAdmin() || 
                  (isClient() && resource.data.uid == request.auth.uid));
      allow create: if isPhotographer();
      allow update: if isSignedIn() && (isClientOwner() || isAdmin());
      allow delete: if isSignedIn() && (isClientOwner() || isAdmin());
    }
    
    // Client-plans collection - Plan data for clients
    match /client-plans/{planId} {
      function isPlanOwner() {
        return isPhotographer() && resource.data.userId == request.auth.uid;
      }
      
      // Allow read for photographer who owns the plan or admin
      allow read: if isSignedIn() && (isPlanOwner() || isAdmin());
      
      // Only cloud functions can write to client-plans
      allow write: if false;
    }
    
    // Orders collection - Payment orders
    match /orders/{orderId} {
      function isOrderOwner() {
        return isSignedIn() && resource.data.userId == request.auth.uid;
      }
      
      // Allow read for user who created the order or admin
      allow read: if isSignedIn() && (isOrderOwner() || isAdmin());
      
      // Only cloud functions can write to orders
      allow write: if false;
    }
    
    // Galleries collection - Image galleries for clients
    match /galleries/{galleryId} {
      function isGalleryOwner() {
        return isPhotographer() && resource.data.photographerId == request.auth.uid;
      }
      
      function hasGalleryAccess() {
        return isClient() && 
               resource.data.clientId == request.auth.uid && 
               hasPlanAccess(resource.data.photographerId, resource.data.clientId);
      }
      
      allow read: if isSignedIn() && (isGalleryOwner() || isAdmin() || hasGalleryAccess());
      allow create: if isPhotographer();
      allow update: if isSignedIn() && (isGalleryOwner() || isAdmin());
      allow delete: if isSignedIn() && (isGalleryOwner() || isAdmin());
      
      // Photos subcollection
      match /photos/{photoId} {
        allow read: if isSignedIn() && (isGalleryOwner() || isAdmin() || hasGalleryAccess());
        allow create: if isPhotographer() && isGalleryOwner();
        allow update: if isSignedIn() && (isGalleryOwner() || isAdmin() || 
                     (hasGalleryAccess() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isSelected', 'selectedAt'])));
        allow delete: if isSignedIn() && (isGalleryOwner() || isAdmin());
      }
      
      // Comments subcollection
      match /comments/{commentId} {
        allow read: if isSignedIn() && (isGalleryOwner() || isAdmin() || hasGalleryAccess());
        allow create: if isSignedIn() && (isGalleryOwner() || hasGalleryAccess());
        allow update, delete: if isSignedIn() && (
          isAdmin() || 
          (isGalleryOwner() && resource.data.photographerId == request.auth.uid) || 
          (hasGalleryAccess() && resource.data.authorId == request.auth.uid)
        );
      }
    }
    
    // Security logs collection
    match /security_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
      allow update, delete: if false;
    }
    
    // API usage logs
    match /api_usage/{logId} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
      allow update, delete: if false;
    }
    
    // Rate limits collection
    match /rate_limits/{limitId} {
      allow read: if isAdmin();
      allow write: if false; // Only cloud functions can modify
    }
    
    // Plan access logs
    match /plan_access_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
      allow update, delete: if false;
    }
    
    // Error logs collection
    match /error_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
      allow update, delete: if false;
    }
  }
}
