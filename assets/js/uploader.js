/**
 * Uploader.js
 * Handles file uploading functionality for the photographer dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeUploader();
});

/**
 * Initialize the file uploader
 */
function initializeUploader() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    const uploadPreview = document.getElementById('uploadPreview');
    
    if (!uploadZone || !fileInput || !browseFilesBtn || !uploadPreview) {
        console.error('Upload elements not found');
        return;
    }
    
    // Open file browser when browse button is clicked
    browseFilesBtn.addEventListener('click', function() {
        fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    // Setup drag and drop
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    // Upload zone click should also open file browser
    uploadZone.addEventListener('click', function(e) {
        // Don't trigger if clicking on the browse button
        if (e.target !== browseFilesBtn && !browseFilesBtn.contains(e.target)) {
            fileInput.click();
        }
    });
    
    console.log('Uploader initialized');
}

/**
 * Handle selected files
 */
function handleFiles(files) {
    const uploadPreview = document.getElementById('uploadPreview');
    if (!uploadPreview) return;
    
    // Clear previous preview if needed
    // uploadPreview.innerHTML = '';
    
    // Max number of files to process (to prevent browser slowdown)
    const maxFiles = 50;
    const filesToProcess = Array.from(files).slice(0, maxFiles);
    
    filesToProcess.forEach(file => {
        // Check if it's an image
        if (!file.type.match('image.*')) {
            console.warn('Skipping non-image file:', file.name);
            return;
        }
        
        // Create preview item
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        // Create remove button
        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-preview';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            previewItem.remove();
        });
        
        // Create image element
        const img = document.createElement('img');
        
        // Read file and set as image source
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        // Append elements
        previewItem.appendChild(img);
        previewItem.appendChild(removeBtn);
        uploadPreview.appendChild(previewItem);
    });
    
    // Show a message if more files were selected than the maximum
    if (files.length > maxFiles) {
        const message = document.createElement('div');
        message.textContent = `Showing ${maxFiles} of ${files.length} files. The rest will still be uploaded.`;
        message.style.gridColumn = '1 / -1';
        message.style.padding = '0.5rem';
        message.style.color = 'var(--text-muted)';
        message.style.fontSize = '0.85rem';
        message.style.textAlign = 'center';
        uploadPreview.appendChild(message);
    }
}

/**
 * Upload files to server
 * In a real implementation, this would use Firebase Storage
 */
function uploadFiles(files, galleryId) {
    // For demo purposes, we'll simulate upload

    return new Promise((resolve, reject) => {
        const uploadProgress = document.getElementById('uploadProgress');
        const uploadProgressBar = document.getElementById('uploadProgressBar');
        const uploadStatus = document.getElementById('uploadStatus');
        
        if (!uploadProgress || !uploadProgressBar || !uploadStatus) {
            reject('Upload elements not found');
            return;
        }
        
        // Show progress UI
        uploadProgress.style.display = 'block';
        uploadProgressBar.style.width = '0%';
        uploadStatus.textContent = 'Preparing to upload...';
        
        // Simulate upload progress
        let progress = 0;
        const totalFiles = files.length;
        const interval = setInterval(() => {
            // Increment progress
            progress += 1 + Math.floor(Math.random() * 3); // Random increment between 1-3%
            if (progress > 100) progress = 100;
            
            // Update UI
            uploadProgressBar.style.width = progress + '%';
            
            // Update status text
            if (progress < 100) {
                const filesProcessed = Math.floor((progress / 100) * totalFiles);
                uploadStatus.textContent = `Uploading ${filesProcessed} of ${totalFiles} photos...`;
            } else {
                uploadStatus.textContent = 'Upload complete!';
                clearInterval(interval);
                
                // Simulate processing delay
                setTimeout(() => {
                    resolve({
                        success: true,
                        message: 'Files uploaded successfully',
                        galleryId: galleryId || 'new-gallery-id'
                    });
                }, 800);
            }
        }, 200);
    });
}

/**
 * Get all selected files from the upload zone
 */
function getSelectedFiles() {
    const fileInput = document.getElementById('fileInput');
    return fileInput ? fileInput.files : [];
}
