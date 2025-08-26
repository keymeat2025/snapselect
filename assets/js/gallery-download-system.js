/*
gallery-download-system.js
*/
// gallery-download-system.js - Secure Gallery Download System
console.log('🔧 Gallery Download System Loading...');

class GalleryDownloadSystem {
  static init() {
    console.log('✅ Gallery Download System Initialized');
    this.setupEventListeners();
    // Refresh button states on page load
    setTimeout(() => {
      this.refreshAllDownloadButtonStates();
    }, 2000); // Wait 2 seconds for page to fully load
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
            <!--
            <div class="password-section">
              <h3>🔐 Security Verification</h3>
              <p>Please enter your current password to confirm this download:</p>
              <div class="form-group">
                <input type="password" id="downloadPassword" placeholder="Enter your password" class="password-input">
                <div id="passwordError" class="error-message" style="display: none;"></div>
              </div>
            </div>
            -->
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
    //const passwordInput = document.getElementById('downloadPassword');
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
      //const hasPassword = passwordInput.value.length > 0;
      const isConfirmed = confirmCheckbox.checked;
      
      confirmBtn.disabled = !isConfirmed;
      
      if (hasPassword && isConfirmed) {
        confirmBtn.textContent = '🚀 Start Secure Download';
        confirmBtn.classList.remove('disabled');
      } else {
        confirmBtn.textContent = '🔒 Complete form to enable';
        confirmBtn.classList.add('disabled');
      }
    };
    
    //passwordInput.addEventListener('input', checkFormValidity);
    confirmCheckbox.addEventListener('change', checkFormValidity);
    
    // Confirm download handler
    confirmBtn.addEventListener('click', async () => {
      console.log('🎯 Download confirmation clicked');
      
      try {
        // Verify password first
        //const password = passwordInput.value;
        //await this.verifyPassword(password);
        
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
      
   
     // Success! Now record the download and update button state
      progressFill.style.width = '100%';
      progressText.textContent = '✅ Download completed successfully!';
      
      // 🎯 ADD THESE LINES - Record download and update button
      console.log('🎯 About to record download history...');
      await this.recordDownloadHistory(authData, clientId, galleryId, planId);
      console.log('🎯 Download history recording completed');
      
      // Update button state immediately
      this.updateDownloadButtonState(clientId, authData);
      
      // Show completion message
      if (window.NotificationSystem) {
        window.NotificationSystem.showNotification(
          'success', 
          'Download Complete', 
          `Gallery downloaded and organized by ratings. Downloads used: ${authData.currentDownloads + 1}/${authData.maxDownloads}`
        );
      }
      
      // Close modal after 3 seconds
      setTimeout(() => {
        const modal = document.getElementById('galleryDownloadModal');
        if (modal) modal.remove();
      }, 3000);
      
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


  // Add this method to record download history

// Enhanced function to update both collections (HYBRID APPROACH)
  static async recordDownloadHistory(authData, clientId, galleryId, planId) {
    console.log('📝 Recording download history (hybrid approach)...');
    
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      const now = firebase.firestore.FieldValue.serverTimestamp();
      
      // 1. Create detailed record for downloadHistory collection
      const downloadRecord = {
        planId: planId,
        galleryId: galleryId,
        clientId: clientId,
        photographerId: currentUser.uid,
        downloadType: 'gallery_organized',
        planType: authData.planType,
        photoCount: authData.galleryData.photosCount,
        clientRatings: authData.galleryData.clientRatings,
        downloadMethod: 'secure_modal_system',
        downloadedAt: now,
        userAgent: navigator.userAgent,
        clientName: authData.clientData.name,
        galleryName: authData.galleryData.name,
        downloadToken: authData.downloadToken
      };
      
      // 2. Calculate new download status for gallery
      const newDownloadCount = authData.currentDownloads + 1;
      const isLimitReached = authData.maxDownloads !== 'unlimited' && newDownloadCount >= authData.maxDownloads;
      
      const galleryDownloadStatus = {
        totalDownloads: newDownloadCount,
        downloadLimit: authData.maxDownloads === 'unlimited' ? 999 : authData.maxDownloads,
        downloadLimitReached: isLimitReached,
        lastDownloadAt: now,
        planType: authData.planType
      };
      
      // Add firstDownloadAt if this is the first download
      if (authData.currentDownloads === 0) {
        galleryDownloadStatus.firstDownloadAt = now;
      }
      
      console.log('💾 Preparing hybrid update:', {
        downloadRecord: 'Will be added to downloadHistory collection',
        galleryUpdate: galleryDownloadStatus
      });
      
      // 3. Execute both updates in a transaction for consistency
      await db.runTransaction(async (transaction) => {
        // Add detailed record to downloadHistory collection
        const downloadRef = db.collection('downloadHistory').doc();
        transaction.set(downloadRef, downloadRecord);
        
        // Update gallery document with download status
        const galleryRef = db.collection('galleries').doc(galleryId);
        transaction.update(galleryRef, {
          downloadStatus: galleryDownloadStatus,
          lastDownloadUpdate: now
        });
        
        console.log('🔄 Transaction prepared for both collections');
      });
      
      console.log('✅ Hybrid download history recorded successfully');
      console.log(`📊 Gallery now shows: ${newDownloadCount}/${authData.maxDownloads} downloads`);
      
    } catch (error) {
      console.error('❌ Error recording hybrid download history:', error);
      throw error; // Re-throw to handle in calling function
    }
  }


// ===== ONE-TIME MIGRATION SCRIPT =====
// Add this function to migrate your existing gallery
  
  static async migrateExistingGalleryToHybrid(galleryId, planId) {
    console.log('🔄 Migrating existing gallery to hybrid approach...');
    
    try {
      const db = firebase.firestore();
      const currentUser = firebase.auth().currentUser;
      
      // Check if gallery already has downloadStatus
      const galleryDoc = await db.collection('galleries').doc(galleryId).get();
      
      if (galleryDoc.exists && galleryDoc.data().downloadStatus) {
        console.log('✅ Gallery already has download status');
        return galleryDoc.data().downloadStatus;
      }
      
      // Count existing downloads for this plan
      const downloadHistory = await db.collection('downloadHistory')
        .where('planId', '==', planId)
        .where('photographerId', '==', currentUser.uid)
        .get();
      
      const totalDownloads = downloadHistory.size;
      const downloadLimit = 1; // Lite plan
      const downloadLimitReached = totalDownloads >= downloadLimit;
      
      let lastDownloadAt = null;
      let firstDownloadAt = null;
      
      if (!downloadHistory.empty) {
        // Get timestamps from existing downloads
        const downloads = downloadHistory.docs.map(doc => doc.data());
        downloads.sort((a, b) => a.downloadedAt.toMillis() - b.downloadedAt.toMillis());
        
        firstDownloadAt = downloads[0].downloadedAt;
        lastDownloadAt = downloads[downloads.length - 1].downloadedAt;
      }
      
      const downloadStatus = {
        totalDownloads: totalDownloads,
        downloadLimit: downloadLimit,
        downloadLimitReached: downloadLimitReached,
        lastDownloadAt: lastDownloadAt,
        firstDownloadAt: firstDownloadAt,
        planType: 'lite',
        migratedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Update gallery with download status
      await db.collection('galleries').doc(galleryId).update({
        downloadStatus: downloadStatus,
        lastDownloadUpdate: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Gallery migration completed:', downloadStatus);
      return downloadStatus;
      
    } catch (error) {
      console.error('❌ Error migrating gallery:', error);
      throw error;
    }
  }


  

// Add this method to update button state
  static updateDownloadButtonState(clientId, authData) {
    console.log('🔄 Updating download button state...');
    
    try {
      const downloadBtn = document.querySelector(`[data-client-id="${clientId}"]`);
      if (!downloadBtn) {
        console.warn('Download button not found for client:', clientId);
        return;
      }
      
      const currentDownloads = authData.currentDownloads + 1; // Increment by 1
      const maxDownloads = authData.maxDownloads;
      
      if (maxDownloads === 'unlimited') {
        // For unlimited plans, just update subtitle
        const subtitle = downloadBtn.querySelector('.btn-subtitle');
        if (subtitle) {
          subtitle.textContent = `Downloaded ${currentDownloads} times`;
        }
      } else {
        // For limited plans, check if limit reached
        if (currentDownloads >= maxDownloads) {
          // Disable button - limit reached
          downloadBtn.disabled = true;
          downloadBtn.classList.add('download-limit-reached');
          
          const subtitle = downloadBtn.querySelector('.btn-subtitle');
          if (subtitle) {
            subtitle.textContent = 'Download limit reached';
          }
          
          // Change button text
          const buttonIcon = downloadBtn.querySelector('i');
          if (buttonIcon && buttonIcon.nextSibling) {
            buttonIcon.nextSibling.textContent = ' Downloaded';
          }
          
          console.log('🚫 Download button disabled - limit reached');
        } else {
          // Still has downloads remaining
          const remaining = maxDownloads - currentDownloads;
          const subtitle = downloadBtn.querySelector('.btn-subtitle');
          if (subtitle) {
            subtitle.textContent = `${remaining} downloads remaining`;
          }
          
          console.log(`📊 Downloads remaining: ${remaining}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error updating button state:', error);
    }
  }

  // ===== ADD THESE MISSING FUNCTIONS =====
  
  // Enhanced function for faster button state checking using gallery document
  static async checkDownloadStatusFromGallery(galleryId) {
    try {
      const db = firebase.firestore();
      const galleryDoc = await db.collection('galleries').doc(galleryId).get();
      
      if (galleryDoc.exists) {
        const galleryData = galleryDoc.data();
        const downloadStatus = galleryData.downloadStatus;
        
        if (downloadStatus) {
          console.log(`📊 Gallery ${galleryId} download status:`, downloadStatus);
          return {
            totalDownloads: downloadStatus.totalDownloads || 0,
            downloadLimit: downloadStatus.downloadLimit || 1,
            downloadLimitReached: downloadStatus.downloadLimitReached || false,
            lastDownloadAt: downloadStatus.lastDownloadAt,
            planType: downloadStatus.planType
          };
        }
      }
      
      // Default status if no download history exists
      return {
        totalDownloads: 0,
        downloadLimit: 1,
        downloadLimitReached: false,
        lastDownloadAt: null,
        planType: 'unknown'
      };
      
    } catch (error) {
      console.error('❌ Error checking gallery download status:', error);
      return null;
    }
  }
  
  // Enhanced button state refresh using hybrid approach
  static async refreshAllDownloadButtonStates() {
    console.log('🔄 Refreshing all download button states (hybrid approach)...');
    
    try {
      const downloadButtons = document.querySelectorAll('.download-gallery-btn:not(.disabled)');
      console.log(`Found ${downloadButtons.length} download buttons to check`);
      
      for (const button of downloadButtons) {
        const clientId = button.getAttribute('data-client-id');
        const galleryId = button.getAttribute('data-gallery-id');
        const planId = button.getAttribute('data-plan-id');
        
        if (!clientId || !galleryId) {
          console.warn('Button missing required attributes:', { clientId, galleryId });
          continue;
        }
        
        try {
          // NEW: Use gallery document for faster status checking
          const downloadStatus = await this.checkDownloadStatusFromGallery(galleryId);
          
          if (!downloadStatus) {
            console.warn(`Could not get download status for gallery: ${galleryId}`);
            continue;
          }
          
          console.log(`🔍 Button for client ${clientId}:`, downloadStatus);
          
          // Update button based on download status
          if (downloadStatus.downloadLimitReached) {
            // Disable button - limit reached
            button.disabled = true;
            button.classList.add('download-limit-reached');
            button.style.backgroundColor = '#6c757d';
            button.style.cursor = 'not-allowed';
            button.style.opacity = '0.6';
            
            const subtitle = button.querySelector('.btn-subtitle');
            if (subtitle) {
              subtitle.textContent = 'Download limit reached';
            }
            
            // Change button text
            const icon = button.querySelector('i');
            if (icon && icon.nextSibling) {
              icon.nextSibling.textContent = ' Downloaded';
            }
            
            console.log(`🚫 Button disabled for client ${clientId} - limit reached`);
            
          } else {
            // Button should be enabled
            const remaining = downloadStatus.downloadLimit === 999 ? 
              'Unlimited' : 
              `${downloadStatus.downloadLimit - downloadStatus.totalDownloads}`;
            
            const subtitle = button.querySelector('.btn-subtitle');
            if (subtitle) {
              subtitle.textContent = downloadStatus.downloadLimit === 999 ? 
                'Unlimited downloads available' : 
                `${remaining} downloads remaining`;
            }
            
            console.log(`✅ Button enabled for client ${clientId} - ${remaining} remaining`);
          }
          
        } catch (error) {
          console.error(`❌ Error checking button state for client ${clientId}:`, error);
        }
      }
      
      console.log('✅ Hybrid button state refresh completed');
      
    } catch (error) {
      console.error('❌ Error in hybrid button state refresh:', error);
    }
  }
}


// Auto-initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  GalleryDownloadSystem.init();
});

// Make available globally
window.GalleryDownloadSystem = GalleryDownloadSystem;

console.log('✅ Gallery Download System Ready');
