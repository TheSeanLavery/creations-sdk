// R1 CAD Creator - Main Application Logic
let currentPage = 'welcome';
let pageModules = {};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeHardwareListeners();
    initializeStorage();
    
    // Check if running as R1 plugin
    if (typeof PluginMessageHandler !== 'undefined') {
        console.log('Running as R1 Creation');
        initializeR1Features();
    } else {
        console.log('Running in browser mode');
        showBrowserModeNotice();
    }
    
    // Close menu on outside click
    document.addEventListener('click', function(e) {
        const menuNav = document.getElementById('menuNav');
        const menuBtn = document.getElementById('menuBtn');
        
        if (menuNav && menuNav.classList.contains('open') && 
            !menuNav.contains(e.target) && !menuBtn.contains(e.target)) {
            menuNav.classList.remove('open');
        }
    });
});

// Navigation system
function initializeNavigation() {
    const menuBtn = document.getElementById('menuBtn');
    const closeMenu = document.getElementById('closeMenu');
    const menuNav = document.getElementById('menuNav');
    const menuLinks = document.querySelectorAll('.menu-nav a');
    
    // Toggle menu
    menuBtn.addEventListener('click', () => {
        menuNav.classList.add('open');
    });
    
    closeMenu.addEventListener('click', () => {
        menuNav.classList.remove('open');
    });
    
    // Handle menu navigation
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            loadPage(page);
            menuNav.classList.remove('open');
            
            // Update active state
            menuLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// Load page content
async function loadPage(pageName) {
    const content = document.getElementById('content');
    currentPage = pageName;
    
    // Clear current content
    content.innerHTML = '';
    
    // Load page-specific content
    switch(pageName) {
        case 'create':
            loadCreatePage(content);
            break;
        case 'files':
            loadFilesPage(content);
            break;
        case 'print':
            loadPrintPage(content);
            break;
        case 'settings':
            loadSettingsPage(content);
            break;
        default:
            content.innerHTML = `
                <div class="welcome">
                    <h2>Welcome to CAD Creator</h2>
                    <p>Create 3D models with AI, manage STL files, and print wirelessly.</p>
                </div>
            `;
    }
}

// Hardware button listeners for R1
function initializeHardwareListeners() {
    // Scroll wheel events
    window.addEventListener('scrollUp', () => {
        if (currentPage === 'create' && pageModules.create) {
            pageModules.create.handleScrollUp();
        } else if (currentPage === 'files' && pageModules.files) {
            pageModules.files.handleScrollUp();
        } else if (currentPage === 'print' && pageModules.print) {
            pageModules.print.handleScrollUp();
        }
    });
    
    window.addEventListener('scrollDown', () => {
        if (currentPage === 'create' && pageModules.create) {
            pageModules.create.handleScrollDown();
        } else if (currentPage === 'files' && pageModules.files) {
            pageModules.files.handleScrollDown();
        } else if (currentPage === 'print' && pageModules.print) {
            pageModules.print.handleScrollDown();
        }
    });
    
    // PTT button events
    window.addEventListener('sideClick', () => {
        if (currentPage === 'create' && pageModules.create) {
            pageModules.create.handlePTT();
        }
    });
    
    window.addEventListener('longPressStart', () => {
        console.log('Long press started');
        // Could be used for voice input in create mode
    });
    
    window.addEventListener('longPressEnd', () => {
        console.log('Long press ended');
    });
}

// Initialize storage system
async function initializeStorage() {
    try {
        // Initialize app data structure if not exists
        let appData = await getStorageItem('cad_creator_data');
        if (!appData) {
            const initialData = {
                stlFiles: [],
                settings: {
                    defaultColor: '#00A6FF',
                    autoSave: true,
                    printerSettings: {}
                },
                conversations: [],
                lastUsed: Date.now()
            };
            await setStorageItem('cad_creator_data', initialData);
            console.log('Initialized storage with default data structure');
        } else {
            // Ensure all required properties exist
            let needsUpdate = false;
            
            if (!appData.stlFiles) {
                appData.stlFiles = [];
                needsUpdate = true;
            }
            
            if (!appData.settings) {
                appData.settings = {
                    defaultColor: '#00A6FF',
                    autoSave: true,
                    printerSettings: {}
                };
                needsUpdate = true;
            }
            
            if (!appData.conversations) {
                appData.conversations = [];
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                appData.lastUsed = Date.now();
                await setStorageItem('cad_creator_data', appData);
                console.log('Updated storage structure');
            }
        }
    } catch (error) {
        console.error('Failed to initialize storage:', error);
    }
}

// Initialize R1-specific features
function initializeR1Features() {
    // Set up plugin message handler
    window.onPluginMessage = function(data) {
        console.log('Received plugin message:', data);
        
        // Route to appropriate page handler
        if (currentPage === 'create' && pageModules.create) {
            pageModules.create.handleMessage(data);
        } else if (currentPage === 'files' && pageModules.files) {
            pageModules.files.handleMessage(data);
        } else if (currentPage === 'print' && pageModules.print) {
            pageModules.print.handleMessage(data);
        } else if (currentPage === 'settings' && pageModules.settings) {
            pageModules.settings.handleMessage(data);
        }
    };
}

// Storage utilities
async function getStorageItem(key) {
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            const stored = await window.creationStorage.plain.getItem(key);
            return stored ? JSON.parse(atob(stored)) : null;
        }
        // Fallback to localStorage for browser testing
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Failed to get storage item:', error);
        return null;
    }
}

async function setStorageItem(key, value) {
    try {
        if (window.creationStorage && window.creationStorage.plain) {
            await window.creationStorage.plain.setItem(
                key,
                btoa(JSON.stringify(value))
            );
        } else {
            // Fallback to localStorage for browser testing
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (error) {
        console.error('Failed to set storage item:', error);
    }
}

// Utility functions
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `status status-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '50px';
    toast.style.right = '10px';
    toast.style.zIndex = '1001';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        document.body.removeChild(toast);
    }, 3000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Update app border color (for theming)
function updateAppBorderColor(hexColor) {
    const app = document.getElementById('app');
    app.style.borderColor = hexColor;
}

// Show browser mode notice
function showBrowserModeNotice() {
    const notice = document.createElement('div');
    notice.innerHTML = `
        <div style="position: fixed; top: 10px; left: 50%; transform: translateX(-50%); 
                    background: var(--warning-color); color: black; padding: 8px 12px; 
                    border-radius: 4px; font-size: 11px; z-index: 2000; text-align: center;">
            <strong>Browser Mode:</strong> This is optimized for R1 device (240×282px)
            <button onclick="this.parentElement.style.display='none'" 
                    style="background: none; border: none; margin-left: 8px; cursor: pointer;">×</button>
        </div>
    `;
    document.body.appendChild(notice);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (notice.parentElement) {
            notice.style.opacity = '0';
            setTimeout(() => notice.remove(), 300);
        }
    }, 5000);
}

// Export global utilities
window.cadCreator = {
    getStorageItem,
    setStorageItem,
    showToast,
    formatFileSize,
    generateId,
    updateAppBorderColor
};
