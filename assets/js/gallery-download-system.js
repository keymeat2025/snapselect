/*
gallery-download-system.js
*/
// gallery-download-system.js - Secure Gallery Download System
console.log('🔧 Gallery Download System Loading...');

class GalleryDownloadSystem {
  static init() {
    console.log('✅ Gallery Download System Initialized');
    this.setupEventListeners();
  }
  
  static setupEventListeners() {
    // We'll add modal listeners here later
    console.log('📡 Event listeners setup complete');
  }
  
  static async initiateSecureDownload(clientId, galleryId, planId) {
    console.log('🚀 Initiating secure download:', { clientId, galleryId, planId });
    
    try {
      // Step 1: Test authorization first (we know this works!)
      const functions = firebase.app().functions('asia-south1');
      const authorizeDownload = functions.httpsCallable('authorizeGalleryDownload');
      
      console.log('🔍 Requesting authorization...');
      const authResult = await authorizeDownload({
        clientId: clientId,
        galleryId: galleryId,
        planId: planId
      });
      
      console.log('✅ Authorization successful:', authResult.data);
      
      // Step 2: Show download modal with confirmation
      this.showDownloadModal(authResult.data, clientId, galleryId, planId);
      
    } catch (error) {
      console.error('❌ Authorization failed:', error);
      
      if (window.NotificationSystem) {
        window.NotificationSystem.showNotification('error', 'Download Failed', error.message);
      } else {
        alert('Download failed: ' + error.message);
      }
    }
  }
  
  static showDownloadModal(authData, clientId, galleryId, planId) {
    console.log('📋 Showing download modal with data:', authData);
    
    // Create modal HTML
    const modalHTML = `
      <div id="galleryDownloadModal" class="modal" style="display: block;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>🔒 Secure Gallery Download</h2>
            <button class="close-modal" id="closeDownloadModal">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Gallery Summary -->
            <div class="download-summary">
              <h3>📊 Download Summary</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <strong>Client:</strong> ${authData.clientData.name}
                </div>
                <div class="summary-item">
                  <strong>Gallery:</strong> ${authData.galleryData.name}
                </div>
                <div class="summary-item">
                  <strong>Total Photos:</strong> ${authData.galleryData.photosCount}
                </div>
                <div class="summary-item">
                  <strong>Plan Type:</strong> ${authData.planType.toUpperCase()}
                </div>
              </div>
              
              <!-- Photo Breakdown -->
              <div class="photo-breakdown">
                <h4>📸 Client Ratings Breakdown:</h4>
                <div class="rating-stats">
                  <span class="rating-item">❤️ Heart: ${authData.galleryData.clientRatings?.heart || 0}</span>
                  <span class="rating-item">👍 Thumbs Up: ${authData.galleryData.clientRatings?.thumbsUp || 0}</span>
                  <span class="rating-item">🤔 Thinking: ${authData.galleryData.clientRatings?.thinking || 0}</span>
                  <span class="rating-item">👎 Thumbs Down: ${authData.galleryData.clientRatings?.thumbsDown || 0}</span>
                </div>
              </div>
              
              <!-- Download Limits Warning -->
              <div class="download-limits ${authData.maxDownloads === 'unlimited' ? 'unlimited' : 'limited'}">
                <h4>⚠️ Download Limitations:</h4>
                ${authData.maxDownloads === 'unlimited' 
                  ? `<p class="unlimited-text">✨ <strong>Unlimited Downloads</strong> - You can download this gallery multiple times</p>`
                  : `<p class="limited-text">📊 <strong>Downloads:</strong> ${authData.currentDownloads}/${authData.maxDownloads} used</p>
                     <p class="warning-text">⚠️ After this download: <strong>${authData.maxDownloads - authData.currentDownloads - 1} downloads remaining</strong></p>`
                }
                <p class="cooldown-text">⏰ <strong>Cooldown:</strong> 1 hour between downloads</p>
              </div>
            </div>
            
            <!-- Password Verification -->
            <div class="password-section">
              <h3>🔐 Security Verification</h3>
              <p>Please enter your current password to confirm this download:</p>
              <div class="form-group">
                <input type="password" id="downloadPassword" placeholder="Enter your password" class="password-input">
                <div id="passwordError" class="error-message" style="display: none;"></div>
              </div>
            </div>
            
            <!-- Final Confirmation -->
            <div class="confirmation-section">
              <div class="confirmation-checkbox">
                <label>
                  <input type="checkbox" id="confirmDownload"> 
                  I understand this download will be organized by client ratings and ${authData.maxDownloads === 'unlimited' ? 'this action will be logged' : 'will count towards my download limit'}
                </label>
              </div>
            </div>
            
            <!-- Progress Section (Hidden initially) -->
            <div id="downloadProgress" class="download-progress" style="display: none;">
              <h3>📦 Download Progress</h3>
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
              <div class="progress-text" id="progressText">Preparing download...</div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn secondary" id="cancelDownloadBtn">Cancel</button>
            <button type="button" class="btn primary" id="confirmDownloadBtn" disabled>
              🚀 Start Secure Download
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('galleryDownloadModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Setup modal event listeners
    this.setupModalListeners(authData, clientId, galleryId, planId);
  }
  
  static setupModalListeners(authData, clientId, galleryId, planId) {
    const modal = document.getElementById('galleryDownloadModal');
    const closeBtn = document.getElementById('closeDownloadModal');
    const cancelBtn = document.getElementById('cancelDownloadBtn');
    const confirmBtn = document.getElementById('confirmDownloadBtn');
    const passwordInput = document.getElementById('downloadPassword');
    const confirmCheckbox = document.getElementById('confirmDownload');
    
    // Close modal handlers
    [closeBtn, cancelBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          modal.remove();
          console.log('📝 Download modal closed');
        });
      }
    });
    
    // Enable/disable confirm button based on inputs
    const checkFormValidity = () => {
      const hasPassword = passwordInput.value.length > 0;
      const isConfirmed = confirmCheckbox.checked;
      
      confirmBtn.disabled = !(hasPassword && isConfirmed);
      
      if (hasPassword && isConfirmed) {
        confirmBtn.textContent = '🚀 Start Secure Download';
        confirmBtn.classList.remove('disabled');
      } else {
        confirmBtn.textContent = '🔒 Complete form to enable';
        confirmBtn.classList.add('disabled');
      }
    };
    
    passwordInput.addEventListener('input', checkFormValidity);
    confirmCheckbox.addEventListener('change', checkFormValidity);
    
    // Confirm download handler
    confirmBtn.addEventListener('click', async () => {
      console.log('🎯 Download confirmation clicked');
      
      try {
        // Verify password first
        const password = passwordInput.value;
        await this.verifyPassword(password);
        
        // Start the download process
        await this.executeSecureDownload(authData, clientId, galleryId, planId);
        
      } catch (error) {
        console.error('❌ Download failed:', error);
        const errorDiv = document.getElementById('passwordError');
        if (errorDiv) {
          errorDiv.textContent = error.message;
          errorDiv.style.display = 'block';
        }
      }
    });
  }
  
  static async verifyPassword(password) {
    console.log('🔐 Verifying password...');
    
    try {
      // Re-authenticate user with current password
      const user = firebase.auth().currentUser;
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
      
      await user.reauthenticateWithCredential(credential);
      console.log('✅ Password verified successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Password verification failed:', error);
      throw new Error('Invalid password. Please try again.');
    }
  }
  
  static async executeSecureDownload(authData, clientId, galleryId, planId) {
    console.log('🚀 Executing secure download...');
    
    const progressSection = document.getElementById('downloadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const confirmBtn = document.getElementById('confirmDownloadBtn');
    
    // Show progress section
    progressSection.style.display = 'block';
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Downloading...';
    
    try {
      // For now, just test the download with our working organized function
      progressText.textContent = 'Starting organized download...';
      progressFill.style.width = '10%';
      
      // Call our tested download function
      await this.downloadGalleryByRating(galleryId, authData.clientData.name);
      
      // Success!
      progressFill.style.width = '100%';
      progressText.textContent = '✅ Download completed successfully!';
      
      // Close modal after 2 seconds
      setTimeout(() => {
        document.getElementById('galleryDownloadModal').remove();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Download execution failed:', error);
      progressText.textContent = '❌ Download failed: ' + error.message;
      
      // Re-enable button
      confirmBtn.disabled = false;
      confirmBtn.textContent = '🔄 Retry Download';
    }
  }
  
  // Use our tested download function
  static async downloadGalleryByRating(galleryId, clientName) {
    console.log('📁 Starting organized download...');
    
    // This is our tested function from before - it works!
    const db = firebase.firestore();
    
    // Get all photos
    const photosSnapshot = await db.collection('photos')
      .where('galleryId', '==', galleryId)
      .where('status', '==', 'active')
      .get();
    
    const photosByUrl = {};
    photosSnapshot.forEach(doc => {
      const photoData = { id: doc.id, ...doc.data() };
      photosByUrl[photoData.url] = photoData;
    });
    
    // Get ratings
    const ratingsSnapshot = await db.collection('photoRatings')
      .where('galleryId', '==', galleryId)
      .get();
    
    // Organize by rating
    const photosByRating = {
      heart: [],
      thumbsUp: [],
      thinking: [],
      thumbsDown: [],
      unrated: []
    };
    
    // Process ratings
    const photoRatings = {};
    ratingsSnapshot.forEach(doc => {
      const data = doc.data();
      const photoUrl = data.photoId;
      
      if (!photoRatings[photoUrl]) {
        photoRatings[photoUrl] = [];
      }
      
      photoRatings[photoUrl].push({
        rating: data.rating,
        timestamp: data.timestamp
      });
    });
    
    // Get latest rating for each photo
    for (const photoUrl in photoRatings) {
      const ratings = photoRatings[photoUrl];
      
      const latestRating = ratings.sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      })[0];
      
      const photoData = photosByUrl[photoUrl];
      if (photoData && photosByRating[latestRating.rating]) {
        photosByRating[latestRating.rating].push(photoData);
      }
    }
    
    // Add unrated photos
    for (const photoUrl in photosByUrl) {
      if (!photoRatings[photoUrl]) {
        photosByRating.unrated.push(photosByUrl[photoUrl]);
      }
    }
    
    // Create ZIP
    const zip = new JSZip();
    const mainFolder = zip.folder(`${clientName}_Gallery_Organized_${new Date().toISOString().split('T')[0]}`);
    
    const folderNames = {
      heart: '❤️_Heart_Selected',
      thumbsUp: '👍_Thumbs_Up',
      thinking: '🤔_Thinking',
      thumbsDown: '👎_Thumbs_Down',
      unrated: '❓_Unrated'
    };
    
    let totalPhotos = 0;
    Object.values(photosByRating).forEach(photos => {
      totalPhotos += photos.length;
    });
    
    let currentPhoto = 0;
    
    for (const [rating, photos] of Object.entries(photosByRating)) {
      if (photos.length === 0) continue;
      
      const ratingFolder = mainFolder.folder(folderNames[rating]);
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        currentPhoto++;
        
        const progressText = document.getElementById('progressText');
        if (progressText) {
          progressText.textContent = `Downloading photo ${currentPhoto}/${totalPhotos} (${rating})...`;
        }
        
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
          const progress = Math.round((currentPhoto / totalPhotos) * 90); // 90% for photos, 10% for ZIP
          progressFill.style.width = progress + '%';
        }
        
        try {
          const response = await fetch(photo.url);
          if (!response.ok) continue;
          
          const blob = await response.blob();
          const originalName = photo.filename || photo.originalName || `photo_${i + 1}.jpg`;
          
          const ratingPrefix = {
            heart: 'HEART_',
            thumbsUp: 'LIKED_',
            thinking: 'MAYBE_',
            thumbsDown: 'REJECTED_',
            unrated: 'UNRATED_'
          };
          
          const filename = ratingPrefix[rating] + originalName;
          ratingFolder.file(filename, blob);
          
        } catch (error) {
          console.error(`Error downloading photo:`, error);
        }
      }
    }
    
    // Generate ZIP
   
       // ADD SUMMARY FILES BEFORE GENERATING ZIP
    const progressText = document.getElementById('progressText');
    if (progressText) {
      progressText.textContent = 'Adding summary files...';
    }
    
    // Create comprehensive summary
    const summaryText = `SNAPSELECT GALLERY DOWNLOAD REPORT
    =====================================
    
    Client: ${clientName}
    Download Date: ${new Date().toLocaleString()}
    Download Type: Organized by Client Ratings
    
    PHOTO DISTRIBUTION:
    ❤️  Heart (TOP SELECTIONS): ${photosByRating.heart.length} photos
    👍 Thumbs Up (LIKED): ${photosByRating.thumbsUp.length} photos  
    🤔 Thinking (MAYBE): ${photosByRating.thinking.length} photos
    👎 Thumbs Down (REJECTED): ${photosByRating.thumbsDown.length} photos
    ❓ Unrated: ${photosByRating.unrated.length} photos
    
    Total Photos: ${totalPhotos}
    <!--
    FOLDER STRUCTURE:
    📁 ❤️_Heart_Selected/ - Client's absolute favorites (${photosByRating.heart.length} photos)
    📁 👍_Thumbs_Up/ - Photos client liked (${photosByRating.thumbsUp.length} photos)
    📁 🤔_Thinking/ - Photos client is unsure about (${photosByRating.thinking.length} photos)
    📁 👎_Thumbs_Down/ - Photos client rejected (${photosByRating.thumbsDown.length} photos)
    📁 ❓_Unrated/ - Photos client didn't rate (${photosByRating.unrated.length} photos)
    
    WORKFLOW RECOMMENDATIONS:
    1. ⭐ START HERE: Heart folder contains client's top picks
    2. 🎯 PRIORITY: Thumbs Up folder for additional strong choices
    3. 🤔 REVIEW: Thinking folder for borderline selections
    4. ❌ AVOID: Thumbs Down folder shows definite rejections
    5. 📋 CHECK: Unrated folder for photos client might have missed
    
    FILE NAMING CONVENTION:
    - HEART_[filename] = Client's top selections
    - LIKED_[filename] = Client approved these
    - MAYBE_[filename] = Client undecided
    - REJECTED_[filename] = Client doesn't want these
    - UNRATED_[filename] = Client didn't rate
    -->
    SUMMARY STATISTICS:
    Client Engagement: ${Math.round((Object.keys(photoRatings).length / Object.keys(photosByUrl).length) * 100)}% of photos rated
    Top Choice Rate: ${Math.round((photosByRating.heart.length / totalPhotos) * 100)}% heart selections
    Approval Rate: ${Math.round(((photosByRating.heart.length + photosByRating.thumbsUp.length) / totalPhotos) * 100)}% positive ratings
    
    This organized download makes post-processing workflow efficient!
    Generated by SnapSelect - Professional Photo Selection Platform`;
    
    // Create detailed metadata
    const downloadMetadata = {
      downloadInfo: {
        clientName: clientName,
        galleryId: galleryId,
        downloadDate: new Date().toISOString(),
        downloadType: "organized_by_ratings",
        totalPhotos: totalPhotos
      },
      ratingBreakdown: {
        heart: photosByRating.heart.length,
        thumbsUp: photosByRating.thumbsUp.length,
        thinking: photosByRating.thinking.length,
        thumbsDown: photosByRating.thumbsDown.length,
        unrated: photosByRating.unrated.length
      },
      folderStructure: {
        "❤️_Heart_Selected": `${photosByRating.heart.length} files`,
        "👍_Thumbs_Up": `${photosByRating.thumbsUp.length} files`,
        "🤔_Thinking": `${photosByRating.thinking.length} files`,
        "👎_Thumbs_Down": `${photosByRating.thumbsDown.length} files`,
        "❓_Unrated": `${photosByRating.unrated.length} files`
      },
      statistics: {
        engagementRate: Math.round((Object.keys(photoRatings).length / Object.keys(photosByUrl).length) * 100),
        topChoiceRate: Math.round((photosByRating.heart.length / totalPhotos) * 100),
        approvalRate: Math.round(((photosByRating.heart.length + photosByRating.thumbsUp.length) / totalPhotos) * 100)
      },
      workflowRecommendations: [
        "Start with Heart folder - client's absolute favorites",
        "Review Thumbs Up folder for additional strong choices", 
        "Consider Thinking folder for borderline selections",
        "Thumbs Down folder shows client's definite rejections",
        "Unrated folder contains photos client didn't rate"
      ]
    };
    
    // Add files to ZIP
    mainFolder.file('📋_DOWNLOAD_SUMMARY.txt', summaryText);
    mainFolder.file('📊_download_metadata.json', JSON.stringify(downloadMetadata, null, 2));
    
    // Add a quick reference guide
    const quickGuide = `📋 QUICK REFERENCE GUIDE
    
    🎯 PRIORITY ORDER FOR PROCESSING:
    1. ❤️ Heart folder (${photosByRating.heart.length} photos) - START HERE
    2. 👍 Thumbs Up folder (${photosByRating.thumbsUp.length} photos) - HIGH PRIORITY  
    3. 🤔 Thinking folder (${photosByRating.thinking.length} photos) - REVIEW THESE
    4. 👎 Thumbs Down folder (${photosByRating.thumbsDown.length} photos) - SKIP THESE
    5. ❓ Unrated folder (${photosByRating.unrated.length} photos) - CHECK IF NEEDED
    
    📸 CLIENT PREFERENCES:
    - Client loved: ${photosByRating.heart.length + photosByRating.thumbsUp.length} photos
    - Client unsure: ${photosByRating.thinking.length} photos  
    - Client rejected: ${photosByRating.thumbsDown.length} photos
    - Not rated: ${photosByRating.unrated.length} photos
    
    💡 PRO TIP: Focus your editing time on Heart + Thumbs Up folders for maximum client satisfaction!
    
    Generated: ${new Date().toLocaleString()}`;
    
    mainFolder.file('🚀_QUICK_GUIDE.txt', quickGuide);
    
    // Now generate ZIP
    if (progressText) {
      progressText.textContent = 'Generating ZIP file...';
    }
    
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    // Download
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(zipBlob);
    downloadLink.download = `${clientName}_Gallery_Organized_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);
    
    console.log('✅ Organized download completed!');
  }
}

// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  GalleryDownloadSystem.init();
});

// Make available globally
window.GalleryDownloadSystem = GalleryDownloadSystem;

console.log('✅ Gallery Download System Ready');
