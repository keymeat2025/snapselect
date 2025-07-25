/**
 * gallery-template-manager.js
 * Manages gallery templates and customization options
 */

// Gallery template presets
const GALLERY_TEMPLATES = {
    classic: {
        name: 'Classic',
        description: 'Clean, minimal design with focus on the photos',
        thumbnailSize: 'medium',
        layout: 'grid',
        colorScheme: {
            background: '#ffffff',
            text: '#333333',
            accent: '#4a90e2'
        },
        headerStyle: 'simple',
        features: ['slideshow', 'zoom', 'download'],
        previewImage: '../assets/images/templates/classic.jpg'
    },
    modern: {
        name: 'Modern',
        description: 'Contemporary design with large images and minimal UI',
        thumbnailSize: 'large',
        layout: 'masonry',
        colorScheme: {
            background: '#f5f5f5',
            text: '#222222',
            accent: '#2c3e50'
        },
        headerStyle: 'overlay',
        features: ['slideshow', 'zoom', 'download', 'social'],
        previewImage: '../assets/images/templates/modern.jpg'
    },
    elegant: {
        name: 'Elegant',
        description: 'Sophisticated design with refined details',
        thumbnailSize: 'medium',
        layout: 'grid',
        colorScheme: {
            background: '#fafafa',
            text: '#2c2c2c',
            accent: '#a67c52'
        },
        headerStyle: 'centered',
        features: ['slideshow', 'zoom', 'download', 'favorites'],
        previewImage: '../assets/images/templates/elegant.jpg'
    },
    dark: {
        name: 'Dark',
        description: 'Bold dark theme that makes photos pop',
        thumbnailSize: 'medium',
        layout: 'grid',
        colorScheme: {
            background: '#1a1a1a',
            text: '#ffffff',
            accent: '#e74c3c'
        },
        headerStyle: 'minimal',
        features: ['slideshow', 'zoom', 'download', 'fullscreen'],
        previewImage: '../assets/images/templates/dark.jpg'
    },
    wedding: {
        name: 'Wedding',
        description: 'Romantic design perfect for wedding photography',
        thumbnailSize: 'medium',
        layout: 'masonry',
        colorScheme: {
            background: '#f9f7f7',
            text: '#555555',
            accent: '#d8b5b5'
        },
        headerStyle: 'romantic',
        features: ['slideshow', 'zoom', 'download', 'favorites', 'share'],
        previewImage: '../assets/images/templates/wedding.jpg'
    },
    portfolio: {
        name: 'Portfolio',
        description: 'Professional layout for showcasing your best work',
        thumbnailSize: 'large',
        layout: 'justified',
        colorScheme: {
            background: '#ffffff',
            text: '#333333',
            accent: '#3498db'
        },
        headerStyle: 'professional',
        features: ['slideshow', 'zoom', 'fullscreen', 'info'],
        previewImage: '../assets/images/templates/portfolio.jpg'
    }
};

// Initialize module
document.addEventListener('DOMContentLoaded', function() {
    initTemplateManager();
});

/**
 * Initialize template manager
 */
function initTemplateManager() {
    // Create template selector in gallery creation form
    createTemplateSelector();
    
    // Add template customization options
    addTemplateCustomizationOptions();
    
    console.log('Gallery template manager initialized');
}

/**
 * Create template selector in gallery creation form
 */
function createTemplateSelector() {
    const galleryForm = document.getElementById('createGalleryForm');
    if (!galleryForm) return;
    
    // Find position to insert template selector (after password protection)
    const galleryPasswordField = document.getElementById('galleryPassword');
    if (!galleryPasswordField) return;
    
    const passwordFormGroup = galleryPasswordField.closest('.form-group');
    if (!passwordFormGroup) return;
    
    // Create template selector form group
    const templateFormGroup = document.createElement('div');
    templateFormGroup.className = 'form-group';
    templateFormGroup.innerHTML = `
        <label for="galleryTemplate">Gallery Template</label>
        <div class="template-selector">
            <div class="templates-grid" id="templatesGrid">
                ${Object.keys(GALLERY_TEMPLATES).map(key => createTemplateCard(key)).join('')}
            </div>
        </div>
        <input type="hidden" id="selectedTemplate" name="selectedTemplate" value="classic">
    `;
    
    // Insert after password field
    passwordFormGroup.parentNode.insertBefore(templateFormGroup, passwordFormGroup.nextSibling);
    
    // Add event listeners to template cards
    setupTemplateCardListeners();
}

/**
 * Create a template card HTML
 */
function createTemplateCard(templateKey) {
    const template = GALLERY_TEMPLATES[templateKey];
    return `
        <div class="template-card ${templateKey === 'classic' ? 'selected' : ''}" data-template="${templateKey}">
            <div class="template-preview">
                <img src="${template.previewImage}" alt="${template.name} template">
            </div>
            <div class="template-info">
                <h4>${template.name}</h4>
                <p>${template.description}</p>
            </div>
        </div>
    `;
}

/**
 * Setup event listeners for template cards
 */
function setupTemplateCardListeners() {
    const templateCards = document.querySelectorAll('.template-card');
    const selectedTemplateInput = document.getElementById('selectedTemplate');
    
    templateCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove selected class from all cards
            templateCards.forEach(c => c.classList.remove('selected'));
            
            // Add selected class to clicked card
            this.classList.add('selected');
            
            // Update hidden input value
            if (selectedTemplateInput) {
                selectedTemplateInput.value = this.getAttribute('data-template');
            }
            
            // Update customization options
            updateCustomizationOptions(this.getAttribute('data-template'));
            
            // Show customization panel
            showCustomizationPanel();
        });
    });
}

/**
 * Add template customization options
 */
function addTemplateCustomizationOptions() {
    const galleryForm = document.getElementById('createGalleryForm');
    if (!galleryForm) return;
    
    // Find position to insert customization options
    const templateFormGroup = document.querySelector('.form-group .template-selector');
    if (!templateFormGroup) return;
    
    const templateFormGroupParent = templateFormGroup.closest('.form-group');
    if (!templateFormGroupParent) return;
    
    // Create customization panel
    const customizationPanel = document.createElement('div');
    customizationPanel.className = 'template-customization';
    customizationPanel.id = 'templateCustomization';
    customizationPanel.style.display = 'none';
    customizationPanel.innerHTML = `
        <div class="customization-header">
            <h4>Customize Template</h4>
            <button type="button" class="btn-link" id="resetCustomizationBtn">Reset to Default</button>
        </div>
        <div class="customization-options">
            <div class="option-group">
                <label>Layout</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="layout" value="grid" checked>
                        <span>Grid</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="layout" value="masonry">
                        <span>Masonry</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="layout" value="justified">
                        <span>Justified</span>
                    </label>
                </div>
            </div>
            
            <div class="option-group">
                <label>Thumbnail Size</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="thumbnailSize" value="small">
                        <span>Small</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="thumbnailSize" value="medium" checked>
                        <span>Medium</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="thumbnailSize" value="large">
                        <span>Large</span>
                    </label>
                </div>
            </div>
            
            <div class="option-group">
                <label>Color Scheme</label>
                <div class="color-picker">
                    <div class="color-option">
                        <label>Background</label>
                        <input type="color" id="backgroundColor" value="#ffffff">
                    </div>
                    <div class="color-option">
                        <label>Text</label>
                        <input type="color" id="textColor" value="#333333">
                    </div>
                    <div class="color-option">
                        <label>Accent</label>
                        <input type="color" id="accentColor" value="#4a90e2">
                    </div>
                </div>
            </div>
            
            <div class="option-group">
                <label>Features</label>
                <div class="checkbox-group">
                    <label class="checkbox-option">
                        <input type="checkbox" name="features" value="slideshow" checked>
                        <span>Slideshow</span>
                    </label>
                    <label class="checkbox-option">
                        <input type="checkbox" name="features" value="zoom" checked>
                        <span>Image Zoom</span>
                    </label>
                    <label class="checkbox-option">
                        <input type="checkbox" name="features" value="download" checked>
                        <span>Download</span>
                    </label>
                    <label class="checkbox-option">
                        <input type="checkbox" name="features" value="favorites">
                        <span>Favorites</span>
                    </label>
                    <label class="checkbox-option">
                        <input type="checkbox" name="features" value="social">
                        <span>Social Sharing</span>
                    </label>
                    <label class="checkbox-option">
                        <input type="checkbox" name="features" value="fullscreen">
                        <span>Fullscreen</span>
                    </label>
                </div>
            </div>
            
            <div class="option-group">
                <label>Header Style</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="headerStyle" value="simple" checked>
                        <span>Simple</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="headerStyle" value="centered">
                        <span>Centered</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="headerStyle" value="minimal">
                        <span>Minimal</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="headerStyle" value="overlay">
                        <span>Overlay</span>
                    </label>
                </div>
            </div>
        </div>
        
        <div class="customization-preview">
            <h4>Preview</h4>
            <div class="template-preview-container" id="templatePreview">
                <!-- Preview will be generated dynamically -->
            </div>
        </div>
    `;
    
    // Insert after template selector
    templateFormGroupParent.parentNode.insertBefore(customizationPanel, templateFormGroupParent.nextSibling);
    
    // Setup customization listeners
    setupCustomizationListeners();
    
    // Initialize with classic template
    updateCustomizationOptions('classic');
}

/**
 * Show customization panel
 */
function showCustomizationPanel() {
    const customizationPanel = document.getElementById('templateCustomization');
    if (customizationPanel) {
        customizationPanel.style.display = 'block';
    }
}

/**
 * Update customization options based on selected template
 */
function updateCustomizationOptions(templateKey) {
    const template = GALLERY_TEMPLATES[templateKey];
    if (!template) return;
    
    // Update layout radio buttons
    const layoutRadios = document.querySelectorAll('input[name="layout"]');
    layoutRadios.forEach(radio => {
        radio.checked = radio.value === template.layout;
    });
    
    // Update thumbnail size radio buttons
    const thumbnailSizeRadios = document.querySelectorAll('input[name="thumbnailSize"]');
    thumbnailSizeRadios.forEach(radio => {
        radio.checked = radio.value === template.thumbnailSize;
    });
    
    // Update color pickers
    document.getElementById('backgroundColor').value = template.colorScheme.background;
    document.getElementById('textColor').value = template.colorScheme.text;
    document.getElementById('accentColor').value = template.colorScheme.accent;
    
    // Update features checkboxes
    const featureCheckboxes = document.querySelectorAll('input[name="features"]');
    featureCheckboxes.forEach(checkbox => {
        checkbox.checked = template.features.includes(checkbox.value);
    });
    
    // Update header style radio buttons
    const headerStyleRadios = document.querySelectorAll('input[name="headerStyle"]');
    headerStyleRadios.forEach(radio => {
        radio.checked = radio.value === template.headerStyle;
    });
    
    // Update preview
    updatePreview(templateKey);
}

/**
 * Setup listeners for customization options
 */
function setupCustomizationListeners() {
    // Get current template key
    const getCurrentTemplateKey = () => {
        const selectedTemplateInput = document.getElementById('selectedTemplate');
        return selectedTemplateInput ? selectedTemplateInput.value : 'classic';
    };
    
    // Layout change
    const layoutRadios = document.querySelectorAll('input[name="layout"]');
    layoutRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            updatePreview(getCurrentTemplateKey());
        });
    });
    
    // Thumbnail size change
    const thumbnailSizeRadios = document.querySelectorAll('input[name="thumbnailSize"]');
    thumbnailSizeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            updatePreview(getCurrentTemplateKey());
        });
    });
    
    // Color scheme changes
    const colorInputs = document.querySelectorAll('#backgroundColor, #textColor, #accentColor');
    colorInputs.forEach(input => {
        input.addEventListener('input', function() {
            updatePreview(getCurrentTemplateKey());
        });
    });
    
    // Features changes
    const featureCheckboxes = document.querySelectorAll('input[name="features"]');
    featureCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updatePreview(getCurrentTemplateKey());
        });
    });
    
    // Header style change
    const headerStyleRadios = document.querySelectorAll('input[name="headerStyle"]');
    headerStyleRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            updatePreview(getCurrentTemplateKey());
        });
    });
    
    // Reset button
    const resetCustomizationBtn = document.getElementById('resetCustomizationBtn');
    if (resetCustomizationBtn) {
        resetCustomizationBtn.addEventListener('click', function() {
            const templateKey = getCurrentTemplateKey();
            updateCustomizationOptions(templateKey);
        });
    }
}

/**
 * Update the preview based on current customization options
 */
function updatePreview(templateKey) {
    const previewContainer = document.getElementById('templatePreview');
    if (!previewContainer) return;
    
    // Get current customization values
    const layout = document.querySelector('input[name="layout"]:checked')?.value || 'grid';
    const thumbnailSize = document.querySelector('input[name="thumbnailSize"]:checked')?.value || 'medium';
    const backgroundColor = document.getElementById('backgroundColor')?.value || '#ffffff';
    const textColor = document.getElementById('textColor')?.value || '#333333';
    const accentColor = document.getElementById('accentColor')?.value || '#4a90e2';
    const headerStyle = document.querySelector('input[name="headerStyle"]:checked')?.value || 'simple';
    
    // Get selected features
    const features = [];
    document.querySelectorAll('input[name="features"]:checked').forEach(checkbox => {
        features.push(checkbox.value);
    });
    
    // Generate preview HTML
    const previewHtml = generatePreviewHtml(templateKey, {
        layout,
        thumbnailSize,
        colorScheme: {
            background: backgroundColor,
            text: textColor,
            accent: accentColor
        },
        headerStyle,
        features
    });
    
    // Update preview
    previewContainer.innerHTML = previewHtml;
}

/**
 * Generate preview HTML based on customization options
 */
function generatePreviewHtml(templateKey, options) {
    // Create a style block for custom CSS
    const customStyle = `
        <style>
            .preview-gallery-container {
                background-color: ${options.colorScheme.background};
                color: ${options.colorScheme.text};
                border-radius: 8px;
                overflow: hidden;
                font-family: Arial, sans-serif;
                width: 100%;
                position: relative;
            }
            .preview-gallery-header {
                padding: ${options.headerStyle === 'minimal' ? '10px' : '20px'};
                text-align: ${options.headerStyle === 'centered' ? 'center' : 'left'};
                border-bottom: ${options.headerStyle === 'minimal' ? 'none' : '1px solid #eee'};
                ${options.headerStyle === 'overlay' ? 'position: absolute; width: 100%; z-index: 10; background: rgba(0,0,0,0.5); color: white;' : ''}
            }
            .preview-gallery-title {
                margin: 0;
                font-size: ${options.headerStyle === 'minimal' ? '16px' : '20px'};
            }
            .preview-gallery-toolbar {
                display: flex;
                padding: 10px;
                background-color: ${options.colorScheme.background === '#ffffff' ? '#f5f5f5' : 'rgba(255,255,255,0.1)'};
                justify-content: ${options.headerStyle === 'centered' ? 'center' : 'flex-end'};
            }
            .preview-toolbar-button {
                margin-left: 10px;
                background-color: ${options.colorScheme.accent};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                font-size: 12px;
                cursor: pointer;
            }
            .preview-photos {
                display: ${options.layout === 'grid' ? 'grid' : 'flex'};
                ${options.layout === 'grid' ? `grid-template-columns: repeat(auto-fill, minmax(${thumbnailSizeToPixels(options.thumbnailSize)}, 1fr)); gap: 10px;` : ''}
                ${options.layout === 'masonry' ? 'flex-wrap: wrap;' : ''}
                ${options.layout === 'justified' ? 'flex-wrap: wrap; justify-content: space-between;' : ''}
                padding: 15px;
            }
            .preview-photo {
                ${options.layout === 'masonry' ? `width: ${thumbnailSizeToPixels(options.thumbnailSize)}; margin: 5px;` : ''}
                ${options.layout === 'justified' ? 'height: 100px; flex-grow: 1; margin: 5px;' : ''}
                position: relative;
                overflow: hidden;
                border-radius: 4px;
                cursor: pointer;
            }
            .preview-photo img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .preview-photo-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.3);
                opacity: 0;
                transition: opacity 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .preview-photo:hover .preview-photo-overlay {
                opacity: 1;
            }
            .preview-select-button {
                background-color: ${options.colorScheme.accent};
                color: white;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                font-size: 12px;
            }
        </style>
    `;
    
    // Create toolbar with enabled features
    let toolbarButtons = '';
    if (options.features.includes('slideshow')) {
        toolbarButtons += '<button class="preview-toolbar-button">Slideshow</button>';
    }
    if (options.features.includes('download')) {
        toolbarButtons += '<button class="preview-toolbar-button">Download</button>';
    }
    if (options.features.includes('social')) {
        toolbarButtons += '<button class="preview-toolbar-button">Share</button>';
    }
    if (options.features.includes('fullscreen')) {
        toolbarButtons += '<button class="preview-toolbar-button">Fullscreen</button>';
    }
    
    // Sample photos for the preview
    const samplePhotos = [
        'placeholder-1.jpg',
        'placeholder-2.jpg',
        'placeholder-3.jpg',
        'placeholder-4.jpg',
        'placeholder-5.jpg',
        'placeholder-6.jpg'
    ];
    
    // Generate photos HTML
    let photosHtml = '';
    samplePhotos.forEach(photo => {
        photosHtml += `
            <div class="preview-photo">
                <img src="../assets/images/${photo}" alt="Sample photo">
                <div class="preview-photo-overlay">
                    <button class="preview-select-button">Select</button>
                </div>
            </div>
        `;
    });
    
    // Combine all elements
    return `
        ${customStyle}
        <div class="preview-gallery-container">
            <div class="preview-gallery-header">
                <h3 class="preview-gallery-title">Sample Gallery</h3>
            </div>
            <div class="preview-gallery-toolbar">
                ${toolbarButtons}
            </div>
            <div class="preview-photos">
                ${photosHtml}
            </div>
        </div>
    `;
}

/**
 * Convert thumbnail size to pixel value
 */
function thumbnailSizeToPixels(size) {
    switch (size) {
        case 'small': return '100px';
        case 'large': return '200px';
        case 'medium':
        default: return '150px';
    }
}

/**
 * Get current customization settings as an object
 */
function getCurrentCustomizationSettings() {
    return {
        layout: document.querySelector('input[name="layout"]:checked')?.value || 'grid',
        thumbnailSize: document.querySelector('input[name="thumbnailSize"]:checked')?.value || 'medium',
        colorScheme: {
            background: document.getElementById('backgroundColor')?.value || '#ffffff',
            text: document.getElementById('textColor')?.value || '#333333',
            accent: document.getElementById('accentColor')?.value || '#4a90e2'
        },
        headerStyle: document.querySelector('input[name="headerStyle"]:checked')?.value || 'simple',
        features: Array.from(document.querySelectorAll('input[name="features"]:checked')).map(cb => cb.value)
    };
}

/**
 * Apply template to an existing gallery
 */
function applyTemplateToGallery(galleryId, templateSettings) {
    // In a real implementation, this would update the template settings in the database
    // and regenerate the client-facing gallery view
    return new Promise(async (resolve, reject) => {
        try {
            const user = window.firebaseServices.auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            const db = window.firebaseServices.db;
            
            // Update gallery document with template settings
            await db.collection('users').doc(user.uid)
                .collection('galleries').doc(galleryId)
                .update({
                    template: templateSettings,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            resolve(true);
        } catch (error) {
            console.error('Error applying template:', error);
            reject(error);
        }
    });
}

/**
 * Save the current template as a custom template
 */
function saveCustomTemplate(name, description) {
    // Get current settings
    const settings = getCurrentCustomizationSettings();
    
    // Add to custom templates
    const customTemplateKey = 'custom_' + Date.now();
    
    GALLERY_TEMPLATES[customTemplateKey] = {
        name: name,
        description: description,
        thumbnailSize: settings.thumbnailSize,
        layout: settings.layout,
        colorScheme: settings.colorScheme,
        headerStyle: settings.headerStyle,
        features: settings.features,
        previewImage: '../assets/images/templates/custom.jpg', // Default image for custom templates
        isCustom: true
    };
    
    // Save to user's profile in database (in a real implementation)
    saveCustomTemplateToDatabase(customTemplateKey, GALLERY_TEMPLATES[customTemplateKey]);
    
    // Add template to selector
    addCustomTemplateToSelector(customTemplateKey);
    
    return customTemplateKey;
}

/**
 * Save custom template to database
 */
function saveCustomTemplateToDatabase(templateKey, templateData) {
    return new Promise(async (resolve, reject) => {
        try {
            const user = window.firebaseServices.auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            const db = window.firebaseServices.db;
            
            // Save template to user's custom templates collection
            await db.collection('users').doc(user.uid)
                .collection('customTemplates').doc(templateKey)
                .set({
                    ...templateData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            
            resolve(true);
        } catch (error) {
            console.error('Error saving custom template:', error);
            reject(error);
        }
    });
}

/**
 * Add custom template to the selector UI
 */
function addCustomTemplateToSelector(templateKey) {
    const templatesGrid = document.getElementById('templatesGrid');
    if (!templatesGrid) return;
    
    const template = GALLERY_TEMPLATES[templateKey];
    
    // Create template card
    const card = document.createElement('div');
    card.className = 'template-card';
    card.setAttribute('data-template', templateKey);
    card.innerHTML = `
        <div class="template-preview">
            <img src="${template.previewImage}" alt="${template.name} template">
        </div>
        <div class="template-info">
            <h4>${template.name}</h4>
            <p>${template.description}</p>
        </div>
    `;
    
    // Add event listener
    card.addEventListener('click', function() {
        // Remove selected class from all cards
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        
        // Add selected class to this card
        this.classList.add('selected');
        
        // Update hidden input value
        const selectedTemplateInput = document.getElementById('selectedTemplate');
        if (selectedTemplateInput) {
            selectedTemplateInput.value = this.getAttribute('data-template');
        }
        
        // Update customization options
        updateCustomizationOptions(this.getAttribute('data-template'));
        
        // Show customization panel
        showCustomizationPanel();
    });
    
    // Add to grid
    templatesGrid.appendChild(card);
}

// Expose template manager functions for use in other files
window.templateManager = {
    getTemplates: () => GALLERY_TEMPLATES,
    getTemplate: (key) => GALLERY_TEMPLATES[key],
    getCurrentSettings: getCurrentCustomizationSettings,
    applyTemplateToGallery,
    saveCustomTemplate
};
