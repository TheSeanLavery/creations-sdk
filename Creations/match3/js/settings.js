// Settings Page - App configuration and preferences
pageModules.settings = {
    currentSettings: {},
    
    init: function() {
        this.loadSettings();
        this.setupEventListeners();
    },
    
    setupEventListeners: function() {
        const saveBtn = document.getElementById('saveSettingsBtn');
        const resetBtn = document.getElementById('resetSettingsBtn');
        const clearDataBtn = document.getElementById('clearDataBtn');
        const exportDataBtn = document.getElementById('exportDataBtn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }
        
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', () => this.clearAllData());
        }
        
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => this.exportData());
        }
    },
    
    async loadSettings() {
        try {
            let appData = await window.cadCreator.getStorageItem('cad_creator_data');
            
            // Initialize appData if it doesn't exist
            if (!appData) {
                appData = {
                    stlFiles: [],
                    settings: this.getDefaultSettings(),
                    conversations: [],
                    lastUsed: Date.now()
                };
                await window.cadCreator.setStorageItem('cad_creator_data', appData);
            }
            
            // Ensure settings object exists
            if (!appData.settings) {
                appData.settings = this.getDefaultSettings();
            }
            
            this.currentSettings = appData.settings;
            
            // Apply API key if available
            if (this.currentSettings.deepseekApiKey && this.currentSettings.deepseekApiKey.startsWith('sk-')) {
                window.aiService.setAPIKey(this.currentSettings.deepseekApiKey);
            }
            
            this.renderSettings();
            this.updateAppStats();
            
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.currentSettings = this.getDefaultSettings();
            this.renderSettings();
        }
    },
    
    getDefaultSettings() {
        return {
            deepseekApiKey: '',
            defaultColor: '#00A6FF',
            autoSave: true,
            maxFiles: 50,
            compressionLevel: 5,
            printerSettings: {},
            ui: {
                theme: 'dark',
                fontSize: 'normal',
                animations: true
            },
            advanced: {
                debugMode: false,
                maxMemoryUsage: 100, // MB
                cacheTimeout: 3600 // seconds
            }
        };
    },
    
    renderSettings() {
        const settingsContainer = document.getElementById('settingsContainer');
        if (!settingsContainer) return;
        
        settingsContainer.innerHTML = `
            <div class="settings-section">
                <div class="card">
                    <div class="card-header">AI Configuration</div>
                    <div class="card-content">
                        <div class="form-group">
                            <label>DeepSeek API Key</label>
                            <input type="password" id="deepseekApiKey" class="input" 
                                   value="${this.currentSettings.deepseekApiKey || ''}" 
                                   placeholder="sk-...">
                            <div class="text-tiny" style="margin-top: 4px; color: var(--text-secondary);">
                                Get your API key from <a href="https://platform.deepseek.com" target="_blank" style="color: var(--primary-color);">DeepSeek Platform</a>
                            </div>
                            <div class="text-tiny mt-1">
                                Status: <span id="aiStatus">${window.aiService.getStatus()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">General</div>
                    <div class="card-content">
                        <div class="form-group">
                            <label>Default Model Color</label>
                            <input type="color" id="defaultColor" class="input" 
                                   value="${this.currentSettings.defaultColor}" 
                                   style="height: 32px;">
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="autoSave" 
                                       ${this.currentSettings.autoSave ? 'checked' : ''}
                                       style="margin-right: 8px;">
                                Auto-save models
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>Max Files to Keep</label>
                            <input type="number" id="maxFiles" class="input" 
                                   value="${this.currentSettings.maxFiles}"
                                   min="10" max="100">
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">User Interface</div>
                    <div class="card-content">
                        <div class="form-group">
                            <label>Theme</label>
                            <select id="theme" class="input">
                                <option value="dark" ${(this.currentSettings.ui && this.currentSettings.ui.theme === 'dark') ? 'selected' : ''}>Dark</option>
                                <option value="light" ${(this.currentSettings.ui && this.currentSettings.ui.theme === 'light') ? 'selected' : ''}>Light</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="animations" 
                                       ${(this.currentSettings.ui && this.currentSettings.ui.animations) ? 'checked' : ''}
                                       style="margin-right: 8px;">
                                Enable animations
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">3D Printing</div>
                    <div class="card-content">
                        <div class="form-group">
                            <label>Default Print Temperature (°C)</label>
                            <input type="number" id="printTemp" class="input" 
                                   value="${this.currentSettings.printTemp || 210}"
                                   min="180" max="300">
                        </div>
                        
                        <div class="form-group">
                            <label>Default Bed Temperature (°C)</label>
                            <input type="number" id="bedTemp" class="input" 
                                   value="${this.currentSettings.bedTemp || 60}"
                                   min="0" max="120">
                        </div>
                        
                        <div class="form-group">
                            <label>Default Infill (%)</label>
                            <input type="number" id="infill" class="input" 
                                   value="${this.currentSettings.infill || 20}"
                                   min="0" max="100">
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">Advanced</div>
                    <div class="card-content">
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="debugMode" 
                                       ${(this.currentSettings.advanced && this.currentSettings.advanced.debugMode) ? 'checked' : ''}
                                       style="margin-right: 8px;">
                                Debug mode
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>Memory Limit (MB)</label>
                            <input type="number" id="maxMemoryUsage" class="input" 
                                   value="${(this.currentSettings.advanced && this.currentSettings.advanced.maxMemoryUsage) || 100}"
                                   min="50" max="500">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add color picker change listener
        const colorPicker = document.getElementById('defaultColor');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                window.cadCreator.updateAppBorderColor(e.target.value);
            });
        }
        
        // Add API key input listener
        const apiKeyInput = document.getElementById('deepseekApiKey');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('input', (e) => {
                const apiKey = e.target.value.trim();
                if (apiKey && apiKey.startsWith('sk-')) {
                    window.aiService.setAPIKey(apiKey);
                    document.getElementById('aiStatus').textContent = window.aiService.getStatus();
                } else if (!apiKey) {
                    window.aiService.mockMode = true;
                    window.aiService.apiKey = null;
                    document.getElementById('aiStatus').textContent = window.aiService.getStatus();
                }
            });
        }
    },
    
    async saveSettings() {
        const saveBtn = document.getElementById('saveSettingsBtn');
        const statusDiv = document.getElementById('settingsStatus');
        
        try {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<div class="loading"></div> Saving...';
            
            // Collect settings from form
            const newSettings = {
                deepseekApiKey: document.getElementById('deepseekApiKey')?.value || '',
                defaultColor: document.getElementById('defaultColor')?.value || this.currentSettings.defaultColor,
                autoSave: document.getElementById('autoSave')?.checked || false,
                maxFiles: parseInt(document.getElementById('maxFiles')?.value || '50'),
                printTemp: parseInt(document.getElementById('printTemp')?.value || '210'),
                bedTemp: parseInt(document.getElementById('bedTemp')?.value || '60'),
                infill: parseInt(document.getElementById('infill')?.value || '20'),
                ui: {
                    theme: document.getElementById('theme')?.value || 'dark',
                    fontSize: (this.currentSettings.ui && this.currentSettings.ui.fontSize) || 'normal',
                    animations: document.getElementById('animations')?.checked || false
                },
                advanced: {
                    debugMode: document.getElementById('debugMode')?.checked || false,
                    maxMemoryUsage: parseInt(document.getElementById('maxMemoryUsage')?.value || '100'),
                    cacheTimeout: (this.currentSettings.advanced && this.currentSettings.advanced.cacheTimeout) || 3600
                },
                printerSettings: this.currentSettings.printerSettings || {}
            };
            
            // Save to storage
            let appData = await window.cadCreator.getStorageItem('cad_creator_data');
            if (!appData) {
                appData = {
                    stlFiles: [],
                    settings: {},
                    conversations: [],
                    lastUsed: Date.now()
                };
            }
            appData.settings = newSettings;
            await window.cadCreator.setStorageItem('cad_creator_data', appData);
            
            this.currentSettings = newSettings;
            
            // Apply API key if provided
            if (newSettings.deepseekApiKey && newSettings.deepseekApiKey.startsWith('sk-')) {
                window.aiService.setAPIKey(newSettings.deepseekApiKey);
            }
            
            // Apply settings immediately
            this.applySettings();
            
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="status status-success">Settings saved</span>';
            }
            
            window.cadCreator.showToast('Settings saved successfully', 'success');
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="status status-error">Save failed</span>';
            }
            window.cadCreator.showToast('Failed to save settings', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Settings';
        }
    },
    
    applySettings() {
        // Apply color theme
        window.cadCreator.updateAppBorderColor(this.currentSettings.defaultColor);
        
        // Apply UI settings
        if (this.currentSettings.ui.theme === 'light') {
            // Could implement light theme switching here
        }
        
        // Apply debug mode
        if (this.currentSettings.advanced.debugMode) {
            console.log('Debug mode enabled');
            window.cadCreatorDebug = true;
        }
    },
    
    async resetSettings() {
        if (!confirm('Reset all settings to defaults?')) {
            return;
        }
        
        try {
            this.currentSettings = this.getDefaultSettings();
            
            let appData = await window.cadCreator.getStorageItem('cad_creator_data');
            if (!appData) {
                appData = {
                    stlFiles: [],
                    settings: {},
                    conversations: [],
                    lastUsed: Date.now()
                };
            }
            appData.settings = this.currentSettings;
            await window.cadCreator.setStorageItem('cad_creator_data', appData);
            
            this.renderSettings();
            this.applySettings();
            
            window.cadCreator.showToast('Settings reset to defaults', 'success');
            
        } catch (error) {
            console.error('Failed to reset settings:', error);
            window.cadCreator.showToast('Failed to reset settings', 'error');
        }
    },
    
    async clearAllData() {
        const confirmation = prompt('Type "DELETE" to permanently clear all data:');
        if (confirmation !== 'DELETE') {
            return;
        }
        
        try {
            // Clear all stored data
            if (window.creationStorage && window.creationStorage.plain) {
                await window.creationStorage.plain.removeItem('cad_creator_data');
            } else {
                localStorage.removeItem('cad_creator_data');
            }
            
            // Reset to defaults
            this.currentSettings = this.getDefaultSettings();
            this.renderSettings();
            this.updateAppStats();
            
            window.cadCreator.showToast('All data cleared', 'warning');
            
        } catch (error) {
            console.error('Failed to clear data:', error);
            window.cadCreator.showToast('Failed to clear data', 'error');
        }
    },
    
    async exportData() {
        try {
            const appData = await window.cadCreator.getStorageItem('cad_creator_data');
            if (!appData) {
                window.cadCreator.showToast('No data to export', 'info');
                return;
            }
            
            // Create export data
            const exportData = {
                version: '1.0',
                exported: new Date().toISOString(),
                settings: appData.settings,
                fileCount: (appData.stlFiles || []).length,
                // Note: STL files themselves are not exported due to size
                metadata: {
                    totalFiles: (appData.stlFiles || []).length,
                    totalSize: (appData.stlFiles || []).reduce((sum, f) => sum + (f.size || 0), 0)
                }
            };
            
            // In a real R1 implementation, this would save to R1 storage
            console.log('Export data:', exportData);
            
            window.cadCreator.showToast('Data export prepared', 'success');
            
        } catch (error) {
            console.error('Failed to export data:', error);
            window.cadCreator.showToast('Export failed', 'error');
        }
    },
    
    async updateAppStats() {
        const statsDiv = document.getElementById('appStats');
        if (!statsDiv) return;
        
        try {
            const appData = await window.cadCreator.getStorageItem('cad_creator_data');
            const fileCount = (appData && appData.stlFiles) ? appData.stlFiles.length : 0;
            const totalSize = (appData && appData.stlFiles) ? 
                appData.stlFiles.reduce((sum, f) => sum + (f.size || 0), 0) : 0;
            
            const lastUsed = appData && appData.lastUsed ? 
                new Date(appData.lastUsed).toLocaleDateString() : 'Never';
            
            statsDiv.innerHTML = `
                <div class="card">
                    <div class="card-header">App Statistics</div>
                    <div class="card-content">
                        <div class="flex justify-between text-tiny mb-1">
                            <span>STL Files:</span>
                            <span>${fileCount}</span>
                        </div>
                        <div class="flex justify-between text-tiny mb-1">
                            <span>Total Size:</span>
                            <span>${window.cadCreator.formatFileSize(totalSize)}</span>
                        </div>
                        <div class="flex justify-between text-tiny mb-1">
                            <span>Last Used:</span>
                            <span>${lastUsed}</span>
                        </div>
                        <div class="flex justify-between text-tiny">
                            <span>Version:</span>
                            <span>1.0</span>
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Failed to load app stats:', error);
        }
    },
    
    // Hardware event handlers
    handleScrollUp() {
        const settingsContainer = document.getElementById('settingsContainer');
        if (settingsContainer) {
            settingsContainer.scrollTop -= 30;
        }
    },
    
    handleScrollDown() {
        const settingsContainer = document.getElementById('settingsContainer');
        if (settingsContainer) {
            settingsContainer.scrollTop += 30;
        }
    },
    
    handleMessage(data) {
        console.log('Settings page received message:', data);
    }
};

// Load Settings Page
function loadSettingsPage(content) {
    content.innerHTML = `
        <div class="settings-page">
            <div class="flex justify-between items-center mb-2">
                <h3 style="font-size: 14px; margin: 0;">Settings</h3>
            </div>
            
            <div id="settingsStatus" class="mb-2"></div>
            
            <div id="settingsContainer" style="max-height: 140px; overflow-y: auto;" class="mb-2"></div>
            
            <div class="flex gap-1 mb-2">
                <button id="saveSettingsBtn" class="btn btn-small flex-1">Save</button>
                <button id="resetSettingsBtn" class="btn btn-secondary btn-small">Reset</button>
            </div>
            
            <div id="appStats" class="mb-2"></div>
            
            <div class="flex gap-1">
                <button id="exportDataBtn" class="btn btn-secondary btn-small flex-1">Export</button>
                <button id="clearDataBtn" class="btn btn-secondary btn-small" 
                        style="color: var(--error-color);">Clear All</button>
            </div>
        </div>
    `;
    
    pageModules.settings.init();
}
