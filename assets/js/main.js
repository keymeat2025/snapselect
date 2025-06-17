/**
 * SnapSelect Main JavaScript
 * Controls mobile menu toggle and other interactive elements
 */

// Global variables for hero slides (MUST be outside DOMContentLoaded for HTML onclick to work)
let heroCurrentSlide = 0;
const heroTotalSlides = 3;

// Global functions for hero slides (MUST be global for HTML onclick attributes)
function heroUpdateSlidePosition() {
    const wrapper = document.getElementById('heroSlidesWrapper');
    const dots = document.querySelectorAll('.hero-nav-dot');
    
    if (wrapper) {
        wrapper.style.transform = `translateX(-${heroCurrentSlide * 33.333}%)`;
        console.log(`🎯 Moved to slide ${heroCurrentSlide + 1}`);
    }
    
    // Update dots
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === heroCurrentSlide);
    });
}

function heroSlideMoveNext() {
    heroCurrentSlide = (heroCurrentSlide + 1) % heroTotalSlides;
    heroUpdateSlidePosition();
    console.log('➡️ Next slide');
}

function heroSlideMovePrev() {
    heroCurrentSlide = (heroCurrentSlide - 1 + heroTotalSlides) % heroTotalSlides;
    heroUpdateSlidePosition();
    console.log('⬅️ Previous slide');
}

function heroSlideMoveTo(slideIndex) {
    heroCurrentSlide = slideIndex;
    heroUpdateSlidePosition();
    console.log(`🎯 Jumped to slide ${slideIndex + 1}`);
}

// Test function to verify slides work
function testSlides() {
    console.log('🧪 Testing slide functions...');
    setTimeout(() => heroSlideMoveNext(), 1000);
    setTimeout(() => heroSlideMovePrev(), 2000);
    setTimeout(() => heroSlideMoveTo(0), 3000);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 SnapSelect JavaScript loaded');
    
    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    // Performance Manager
    const PerformanceManager = {
      initLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          });
        });
        
        images.forEach(img => imageObserver.observe(img));
      },
      
      cacheData(key, data, ttl = 300000) {
        const cacheItem = {
          data: data,
          timestamp: Date.now(),
          ttl: ttl
        };
        localStorage.setItem(key, JSON.stringify(cacheItem));
      },
      
      getCachedData(key) {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const item = JSON.parse(cached);
        if (Date.now() - item.timestamp > item.ttl) {
          localStorage.removeItem(key);
          return null;
        }
        
        return item.data;
      }
    };
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (navLinks && navLinks.classList.contains('active') && !navLinks.contains(event.target) && !hamburger.contains(event.target)) {
            navLinks.classList.remove('active');
        }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Adjust for header height
                    behavior: 'smooth'
                });
                
                // Close mobile menu after clicking
                if (navLinks && navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                }
            }
        });
    });

    // Initialize hero slides functionality (NO nested DOMContentLoaded!)
    function initHeroSlides() {
        console.log('🎬 Initializing hero slides...');
        
        const container = document.getElementById('heroIntegratedSlides');
        if (!container) {
            console.log('❌ Hero slides container not found');
            return;
        }
        
        console.log('✅ Hero slides container found');
        
        // Auto-advance functionality
        let heroAutoSlide = setInterval(() => {
            heroSlideMoveNext();
        }, 5000);
        
        console.log('⏰ Auto-advance started (5 seconds)');
        
        // Pause on hover
        container.addEventListener('mouseenter', () => {
            clearInterval(heroAutoSlide);
            console.log('⏸️ Auto-slide paused (hover)');
        });
        
        container.addEventListener('mouseleave', () => {
            clearInterval(heroAutoSlide);
            heroAutoSlide = setInterval(() => {
                heroSlideMoveNext();
            }, 5000);
            console.log('▶️ Auto-slide resumed');
        });
        
        // Touch/swipe support for mobile
        let startX = 0;
        let endX = 0;
        
        container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        
        container.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 50) { // Minimum swipe distance
                if (diff > 0) {
                    heroSlideMoveNext(); // Swipe left
                    console.log('👈 Swiped left - next slide');
                } else {
                    heroSlideMovePrev(); // Swipe right
                    console.log('👉 Swiped right - previous slide');
                }
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                heroSlideMovePrev();
            } else if (e.key === 'ArrowRight') {
                heroSlideMoveNext();
            }
        });
        
        console.log('🎮 Hero slides fully initialized with controls');
    }
    
    // Initialize slides
    initHeroSlides();
    
    // Verify functions are accessible
    setTimeout(() => {
        console.log('🔍 Verifying slide functions...');
        console.log('heroSlideMoveNext available:', typeof window.heroSlideMoveNext !== 'undefined');
        console.log('heroSlideMovePrev available:', typeof window.heroSlideMovePrev !== 'undefined');
        console.log('heroSlideMoveTo available:', typeof window.heroSlideMoveTo !== 'undefined');
        
        // Test if we can access the functions
        if (typeof heroSlideMoveNext === 'function') {
            console.log('✅ Slide functions are working');
        } else {
            console.log('❌ Slide functions not accessible');
        }
    }, 1000);
});

// Make functions available globally (for console testing)
window.heroSlideMoveNext = heroSlideMoveNext;
window.heroSlideMovePrev = heroSlideMovePrev;
window.heroSlideMoveTo = heroSlideMoveTo;
window.testSlides = testSlides;
