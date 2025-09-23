// Create Page - Text to CAD functionality
pageModules.create = {
    currentConversation: null,
    isGenerating: false,
    currentSTL: null,
    conversationId: null,
    
    init: function() {
        this.setupEventListeners();
        this.loadConversationHistory();
        
        // Initialize conversation ID for AI service
        if (!this.conversationId) {
            this.conversationId = window.cadCreator.generateId();
        }
    },
    
    setupEventListeners: function() {
        const generateBtn = document.getElementById('generateBtn');
        const promptInput = document.getElementById('promptInput');
        const exportBtn = document.getElementById('exportBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateCAD());
        }
        
        if (promptInput) {
            promptInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.generateCAD();
                }
            });
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSTL());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearConversation());
        }
    },
    
    async generateCAD() {
        const promptInput = document.getElementById('promptInput');
        const generateBtn = document.getElementById('generateBtn');
        const statusDiv = document.getElementById('generateStatus');
        
        if (!promptInput || !promptInput.value.trim()) {
            window.cadCreator.showToast('Please enter a description', 'warning');
            return;
        }
        
        if (this.isGenerating) {
            return;
        }
        
        this.isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<div class="loading"></div> Generating...';
        statusDiv.innerHTML = '<span class="status status-info">Generating 3D model...</span>';
        
        try {
            // Add user message to chat
            this.addMessageToChat('user', promptInput.value);
            
            // Use AI Service for CAD generation
            window.aiService.generateCADModel(promptInput.value, {
                conversationId: this.conversationId || window.cadCreator.generateId(),
                model: 'fast'
            }).then(result => {
                // Format response to match expected structure
                const response = {
                    data: JSON.stringify({
                        scad_code: result.scad_code,
                        parameters: result.parameters,
                        description: result.description
                    })
                };
                this.handleMessage(response);
            }).catch(error => {
                console.error('AI generation error:', error);
                statusDiv.innerHTML = '<span class="status status-error">Generation failed</span>';
                this.isGenerating = false;
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate';
                window.cadCreator.showToast('AI generation failed', 'error');
            });
            
            promptInput.value = '';
            
        } catch (error) {
            console.error('Generation error:', error);
            statusDiv.innerHTML = '<span class="status status-error">Generation failed</span>';
            this.isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate';
            window.cadCreator.showToast('Generation failed', 'error');
        }
    },
    
    handleMessage(data) {
        const statusDiv = document.getElementById('generateStatus');
        const generateBtn = document.getElementById('generateBtn');
        const exportBtn = document.getElementById('exportBtn');
        const viewerDiv = document.getElementById('modelViewer');
        const parametersDiv = document.getElementById('parameters');
        
        try {
            let response = null;
            
            // Parse response from different possible formats
            if (data.data) {
                response = JSON.parse(data.data);
            } else if (data.message) {
                try {
                    response = JSON.parse(data.message);
                } catch (e) {
                    // Handle plain text response
                    this.addMessageToChat('assistant', data.message);
                    throw new Error('Invalid JSON response');
                }
            }
            
            if (response && response.scad_code) {
                // Successfully generated CAD model
                this.addMessageToChat('assistant', response.description || 'Generated 3D model');
                
                // Store the current model
                this.currentSTL = {
                    id: window.cadCreator.generateId(),
                    name: `model_${Date.now()}`,
                scadCode: response.scad_code,
                parameters: response.parameters || [],
                description: response.description || '',
                color: '#00A6FF',
                created: new Date().toISOString()
                };
                
                // Update UI
                statusDiv.innerHTML = '<span class="status status-success">Model generated!</span>';
                
                // Create 3D viewer container with controls
                viewerDiv.innerHTML = `
                    <div id="modelViewer3D" class="viewer-container" style="position: relative;">
                        <div style="position: absolute; top: 4px; right: 4px; z-index: 10;">
                            <span class="status status-success" style="font-size: 8px;">3D</span>
                        </div>
                        <div class="viewer-controls" style="position: absolute; bottom: 4px; left: 4px; z-index: 10; display: flex; gap: 2px;">
                            <button class="btn btn-small view-btn" data-view="front" title="Front">F</button>
                            <button class="btn btn-small view-btn" data-view="right" title="Right">R</button>
                            <button class="btn btn-small view-btn" data-view="top" title="Top">T</button>
                            <button class="btn btn-small view-btn" data-view="isometric" title="Isometric">ISO</button>
                            <button class="btn btn-small view-btn" data-view="reset" title="Reset">⌂</button>
                        </div>
                        <div class="viewer-help" style="position: absolute; top: 4px; left: 4px; z-index: 10; font-size: 8px; color: var(--text-secondary);">
                            ${typeof window !== 'undefined' && 'ontouchstart' in window ? 
                                'Drag: Rotate • Pinch: Zoom' : 
                                'Drag: Rotate • Wheel: Zoom'}
                        </div>
                    </div>
                `;
                
                // Load 3D model
                setTimeout(() => {
                    const viewer = window.viewer3D.create('modelViewer3D');
                    if (viewer) {
                        const color = this.currentSTL.color || '#00A6FF';
                        viewer.loadModelFromSCAD(response.scad_code, color);
                        
                        // Add view control event listeners
                        const viewButtons = viewerDiv.querySelectorAll('.view-btn');
                        viewButtons.forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const viewName = btn.dataset.view;
                                if (viewName === 'reset') {
                                    viewer.resetView();
                                } else {
                                    viewer.setPresetView(viewName);
                                }
                            });
                        });
                    }
                }, 100);
                
                // Show parameters if available
                if (response.parameters && response.parameters.length > 0) {
                    this.renderParameters(response.parameters);
                }
                
                exportBtn.disabled = false;
                
                // Auto-save to storage
                this.saveModelToStorage();
                
            } else {
                throw new Error('Invalid response format');
            }
            
        } catch (error) {
            console.error('Error processing response:', error);
            statusDiv.innerHTML = '<span class="status status-error">Processing failed</span>';
            this.addMessageToChat('assistant', 'Sorry, I could not generate a valid 3D model. Please try rephrasing your request.');
            window.cadCreator.showToast('Processing failed', 'error');
        } finally {
            this.isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate';
        }
    },
    
    renderParameters(parameters) {
        const parametersDiv = document.getElementById('parameters');
        if (!parametersDiv || !parameters.length) return;
        
        let html = '<div class="card"><div class="card-header">Parameters</div><div class="card-content">';
        
        parameters.forEach(param => {
            html += `
                <div class="form-group">
                    <label>${param.name}</label>
                    <input type="number" 
                           class="input parameter-input" 
                           data-param="${param.name}"
                           value="${param.default}"
                           min="${param.min || 0}"
                           max="${param.max || 100}"
                           step="${param.type === 'number' ? '0.1' : '1'}">
                </div>
            `;
        });
        
        html += '</div></div>';
        parametersDiv.innerHTML = html;
        
        // Add parameter change listeners
        parametersDiv.querySelectorAll('.parameter-input').forEach(input => {
            input.addEventListener('input', () => this.updateParameter(input.dataset.param, input.value));
        });
    },
    
    updateParameter(paramName, value) {
        if (!this.currentSTL) return;
        
        // Update parameter in current model
        const param = this.currentSTL.parameters.find(p => p.name === paramName);
        if (param) {
            param.current = parseFloat(value);
        }
        
        // Update 3D viewer with new parameter
        const viewer = window.viewer3D.get('modelViewer3D');
        if (viewer && this.currentSTL) {
            // Update the parameter in the SCAD code
            let updatedCode = this.currentSTL.scadCode;
            const paramPattern = new RegExp(`\\b${paramName}\\s*=\\s*[\\d.]+`, 'g');
            if (paramPattern.test(updatedCode)) {
                updatedCode = updatedCode.replace(paramPattern, `${paramName} = ${value}`);
            } else {
                // If parameter not found, try to replace in cube/sphere/cylinder calls
                updatedCode = updatedCode.replace(/(\d+)/g, (match, num) => {
                    return Math.abs(parseFloat(num) - param.default) < 0.1 ? value : num;
                });
            }
            
            this.currentSTL.scadCode = updatedCode;
            
            // Reload 3D model with updated code
            const color = this.currentSTL.color || '#00A6FF';
            viewer.loadModelFromSCAD(updatedCode, color);
        }
    },
    
    async exportSTL() {
        if (!this.currentSTL) {
            window.cadCreator.showToast('No model to export', 'warning');
            return;
        }
        
        try {
            // Save to app storage
            let appData = await window.cadCreator.getStorageItem('cad_creator_data');
            
            // Initialize appData if it doesn't exist
            if (!appData) {
                appData = {
                    stlFiles: [],
                    settings: {
                        defaultColor: '#00A6FF',
                        autoSave: true,
                        printerSettings: {}
                    },
                    conversations: [],
                    lastUsed: Date.now()
                };
            }
            
            // Ensure stlFiles array exists
            if (!appData.stlFiles) {
                appData.stlFiles = [];
            }
            
            // Create STL file entry
            const stlFile = {
                ...this.currentSTL,
                exported: new Date().toISOString(),
                size: this.estimateSTLSize()
            };
            
            appData.stlFiles.push(stlFile);
            await window.cadCreator.setStorageItem('cad_creator_data', appData);
            
            // Update UI
            const statusDiv = document.getElementById('generateStatus');
            statusDiv.innerHTML = '<span class="status status-success">STL saved to files!</span>';
            
            window.cadCreator.showToast('STL file saved successfully', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            window.cadCreator.showToast('Export failed', 'error');
        }
    },
    
    estimateSTLSize() {
        // Rough estimation based on code length
        if (!this.currentSTL) return 0;
        return Math.max(1024, this.currentSTL.scadCode.length * 50);
    },
    
    addMessageToChat(role, message) {
        const chatDiv = document.getElementById('chatMessages');
        if (!chatDiv) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.textContent = message;
        
        chatDiv.appendChild(messageDiv);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    },
    
    clearConversation() {
        const chatDiv = document.getElementById('chatMessages');
        const statusDiv = document.getElementById('generateStatus');
        const viewerDiv = document.getElementById('modelViewer');
        const parametersDiv = document.getElementById('parameters');
        
        if (chatDiv) chatDiv.innerHTML = '';
        if (statusDiv) statusDiv.innerHTML = '';
        if (parametersDiv) parametersDiv.innerHTML = '';
        
        if (viewerDiv) {
            // Dispose of existing 3D viewer
            window.viewer3D.dispose('modelViewer3D');
            viewerDiv.innerHTML = '<div class="viewer-container">3D Model Preview</div>';
        }
        
        this.currentSTL = null;
        document.getElementById('exportBtn').disabled = true;
    },
    
    async saveModelToStorage() {
        if (!this.currentSTL) return;
        
        try {
            let appData = await window.cadCreator.getStorageItem('cad_creator_data');
            
            // Initialize appData if it doesn't exist
            if (!appData) {
                appData = {
                    stlFiles: [],
                    settings: {
                        defaultColor: '#00A6FF',
                        autoSave: true,
                        printerSettings: {}
                    },
                    conversations: [],
                    lastUsed: Date.now()
                };
            }
            
            // Save conversation state
            if (!appData.conversations) appData.conversations = [];
            appData.lastModel = this.currentSTL;
            appData.lastUsed = Date.now();
            
            await window.cadCreator.setStorageItem('cad_creator_data', appData);
        } catch (error) {
            console.error('Failed to save model:', error);
        }
    },
    
    async loadConversationHistory() {
        try {
            const appData = await window.cadCreator.getStorageItem('cad_creator_data');
            if (appData && appData.lastModel) {
                this.currentSTL = appData.lastModel;
                document.getElementById('exportBtn').disabled = false;
            }
        } catch (error) {
            console.error('Failed to load conversation history:', error);
        }
    },
    
    // Hardware event handlers
    handleScrollUp() {
        // Navigate through chat history or parameters
        const chatDiv = document.getElementById('chatMessages');
        if (chatDiv) {
            chatDiv.scrollTop -= 20;
        }
    },
    
    handleScrollDown() {
        // Navigate through chat history or parameters
        const chatDiv = document.getElementById('chatMessages');
        if (chatDiv) {
            chatDiv.scrollTop += 20;
        }
    },
    
    handlePTT() {
        // Quick generate action
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn && !generateBtn.disabled) {
            generateBtn.click();
        }
    }
};

// Load Create Page
function loadCreatePage(content) {
    content.innerHTML = `
        <div class="create-page">
            <div class="form-group">
                <label>Describe your 3D model</label>
                <textarea id="promptInput" class="textarea" 
                          placeholder="e.g., A 5cm baseball, A phone stand with adjustable angle"></textarea>
                <div class="text-tiny" style="margin-top: 4px; color: var(--text-secondary);">
                    AI Status: <span id="createAiStatus">${window.aiService.getStatus()}</span>
                </div>
            </div>
            
            <div class="flex gap-1 mb-2">
                <button id="generateBtn" class="btn flex-1">Generate</button>
                <button id="clearBtn" class="btn btn-secondary btn-small">Clear</button>
            </div>
            
            <div id="generateStatus" class="mb-2"></div>
            
            <div id="modelViewer" class="mb-2">
                <div class="viewer-container">3D Model Preview</div>
            </div>
            
            <div id="parameters" class="mb-2"></div>
            
            <button id="exportBtn" class="btn btn-secondary" disabled>Save as STL</button>
            
            <div class="chat-container mt-2">
                <div id="chatMessages" class="chat-messages"></div>
            </div>
        </div>
    `;
    
    pageModules.create.init();
}
