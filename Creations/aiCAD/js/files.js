// Files Page - STL file management
pageModules.files = {
    currentFiles: [],
    selectedFile: null,
    
    init: function() {
        this.loadFiles();
        this.setupEventListeners();
    },
    
    setupEventListeners: function() {
        const refreshBtn = document.getElementById('refreshBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const viewBtn = document.getElementById('viewBtn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadFiles());
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteSelectedFile());
        }
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => this.viewSelectedFile());
        }
    },
    
    async loadFiles() {
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
                await window.cadCreator.setStorageItem('cad_creator_data', appData);
            }
            
            // Ensure stlFiles array exists
            if (!appData.stlFiles) {
                appData.stlFiles = [];
            }
            
            this.currentFiles = appData.stlFiles;
            
            this.renderFileList();
            this.updateFileStats();
            
        } catch (error) {
            console.error('Failed to load files:', error);
            this.currentFiles = [];
            this.renderFileList();
            this.updateFileStats();
            window.cadCreator.showToast('Failed to load files', 'error');
        }
    },
    
    renderFileList() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;
        
        if (this.currentFiles.length === 0) {
            fileList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <div style="font-size: 24px; margin-bottom: 8px;">📁</div>
                    <div>No STL files yet</div>
                    <div class="text-tiny">Create models to see them here</div>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.currentFiles.forEach((file, index) => {
            const isSelected = this.selectedFile && this.selectedFile.id === file.id;
            html += `
                <div class="file-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    <div class="file-info">
                        <div class="file-name">${file.name || 'Untitled'}</div>
                        <div class="file-details">
                            <span class="file-size">${window.cadCreator.formatFileSize(file.size || 0)}</span>
                            <span class="file-date">${this.formatDate(file.created)}</span>
                        </div>
                        ${file.description ? `<div class="file-description">${file.description}</div>` : ''}
                    </div>
                    <div class="file-actions">
                        <button class="btn btn-small view-file-btn" data-index="${index}">View</button>
                    </div>
                </div>
            `;
        });
        
        fileList.innerHTML = html;
        
        // Add click handlers
        fileList.querySelectorAll('.file-item').forEach((item, index) => {
            item.addEventListener('click', () => this.selectFile(index));
        });
        
        fileList.querySelectorAll('.view-file-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.viewFile(index);
            });
        });
    },
    
    selectFile(index) {
        this.selectedFile = this.currentFiles[index];
        this.renderFileList();
        this.updateActionButtons();
    },
    
    updateActionButtons() {
        const deleteBtn = document.getElementById('deleteBtn');
        const viewBtn = document.getElementById('viewBtn');
        
        const hasSelection = this.selectedFile !== null;
        
        if (deleteBtn) deleteBtn.disabled = !hasSelection;
        if (viewBtn) viewBtn.disabled = !hasSelection;
    },
    
    viewFile(index) {
        const file = this.currentFiles[index];
        if (!file) return;
        
        const viewerDiv = document.getElementById('fileViewer');
        if (!viewerDiv) return;
        
        viewerDiv.innerHTML = `
            <div class="card">
                <div class="card-header">${file.name || 'Untitled'}</div>
                <div class="card-content">
                    <div id="fileViewer3D" class="viewer-container" style="position: relative;">
                        <div style="position: absolute; top: 4px; right: 4px; z-index: 10;">
                            <span class="status status-info" style="font-size: 8px;">3D</span>
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
                    <div class="file-metadata">
                        <div class="text-tiny">
                            <div><strong>Size:</strong> ${window.cadCreator.formatFileSize(file.size || 0)}</div>
                            <div><strong>Created:</strong> ${this.formatDate(file.created)}</div>
                            ${file.exported ? `<div><strong>Exported:</strong> ${this.formatDate(file.exported)}</div>` : ''}
                            ${file.parameters ? `<div><strong>Parameters:</strong> ${file.parameters.length}</div>` : ''}
                        </div>
                    </div>
                    <div class="flex gap-1 mt-2">
                        <button class="btn btn-small flex-1 send-to-print-btn" data-file-id="${file.id}">Send to Print</button>
                        <button class="btn btn-secondary btn-small rename-file-btn" data-file-id="${file.id}">Rename</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for file actions
        const sendToPrintBtn = viewerDiv.querySelector('.send-to-print-btn');
        const renameBtn = viewerDiv.querySelector('.rename-file-btn');
        
        if (sendToPrintBtn) {
            sendToPrintBtn.addEventListener('click', () => this.sendFileToPrint(file));
        }
        
        if (renameBtn) {
            renameBtn.addEventListener('click', () => this.renameFile(file));
        }
        
        // Load 3D model if available
        if (file.scadCode) {
            setTimeout(() => {
                const viewer = window.viewer3D.create('fileViewer3D');
                if (viewer) {
                    const color = file.color || '#00A6FF';
                    viewer.loadModelFromSCAD(file.scadCode, color);
                    
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
        }
    },
    
    viewSelectedFile() {
        if (!this.selectedFile) return;
        
        const index = this.currentFiles.findIndex(f => f.id === this.selectedFile.id);
        if (index >= 0) {
            this.viewFile(index);
        }
    },
    
    async deleteSelectedFile() {
        if (!this.selectedFile) return;
        
        if (!confirm(`Delete "${this.selectedFile.name || 'Untitled'}"?`)) {
            return;
        }
        
        try {
            let appData = await window.cadCreator.getStorageItem('cad_creator_data');
            if (!appData) {
                appData = { stlFiles: [] };
            }
            if (!appData.stlFiles) {
                appData.stlFiles = [];
            }
            
            appData.stlFiles = appData.stlFiles.filter(f => f.id !== this.selectedFile.id);
            await window.cadCreator.setStorageItem('cad_creator_data', appData);
            
            this.selectedFile = null;
            await this.loadFiles();
            
            // Clear viewer
            const viewerDiv = document.getElementById('fileViewer');
            if (viewerDiv) {
                window.viewer3D.dispose('fileViewer3D');
                viewerDiv.innerHTML = '';
            }
            
            window.cadCreator.showToast('File deleted', 'success');
            
        } catch (error) {
            console.error('Failed to delete file:', error);
            window.cadCreator.showToast('Failed to delete file', 'error');
        }
    },
    
    async renameFile(file) {
        const newName = prompt('Enter new name:', file.name || 'Untitled');
        if (!newName || newName === file.name) return;
        
        try {
            let appData = await window.cadCreator.getStorageItem('cad_creator_data');
            if (!appData) {
                appData = { stlFiles: [] };
            }
            if (!appData.stlFiles) {
                appData.stlFiles = [];
            }
            
            const fileIndex = appData.stlFiles.findIndex(f => f.id === file.id);
            if (fileIndex >= 0) {
                appData.stlFiles[fileIndex].name = newName;
                await window.cadCreator.setStorageItem('cad_creator_data', appData);
            }
            
            await this.loadFiles();
            
            // Refresh viewer if this file is being viewed
            const viewerDiv = document.getElementById('fileViewer');
            if (viewerDiv && viewerDiv.innerHTML.includes('fileViewer3D')) {
                const updatedFile = this.currentFiles.find(f => f.id === file.id);
                if (updatedFile) {
                    this.viewFile(this.currentFiles.indexOf(updatedFile));
                }
            }
            
            window.cadCreator.showToast('File renamed', 'success');
            
        } catch (error) {
            console.error('Failed to rename file:', error);
            window.cadCreator.showToast('Failed to rename file', 'error');
        }
    },
    
    sendFileToPrint(file) {
        // Switch to print page with selected file
        window.cadCreator.selectedFileForPrint = file;
        loadPage('print');
        window.cadCreator.showToast('File selected for printing', 'info');
    },
    
    updateFileStats() {
        const statsDiv = document.getElementById('fileStats');
        if (!statsDiv) return;
        
        const totalFiles = this.currentFiles.length;
        const totalSize = this.currentFiles.reduce((sum, file) => sum + (file.size || 0), 0);
        
        statsDiv.innerHTML = `
            <div class="flex justify-between text-tiny">
                <span>${totalFiles} file${totalFiles !== 1 ? 's' : ''}</span>
                <span>${window.cadCreator.formatFileSize(totalSize)}</span>
            </div>
        `;
    },
    
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString();
        } catch (error) {
            return 'Unknown';
        }
    },
    
    // Hardware event handlers
    handleScrollUp() {
        // Navigate file list
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.scrollTop -= 30;
        }
    },
    
    handleScrollDown() {
        // Navigate file list
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.scrollTop += 30;
        }
    },
    
    handleMessage(data) {
        // Handle any plugin messages related to file operations
        console.log('Files page received message:', data);
    }
};

// Load Files Page
function loadFilesPage(content) {
    content.innerHTML = `
        <div class="files-page">
            <div class="flex justify-between items-center mb-2">
                <h3 style="font-size: 14px; margin: 0;">STL Files</h3>
                <button id="refreshBtn" class="btn btn-small">↻</button>
            </div>
            
            <div id="fileStats" class="mb-2"></div>
            
            <div id="fileList" class="file-list mb-2"></div>
            
            <div class="flex gap-1 mb-2">
                <button id="viewBtn" class="btn btn-small flex-1" disabled>View</button>
                <button id="deleteBtn" class="btn btn-secondary btn-small" disabled>Delete</button>
            </div>
            
            <div id="fileViewer"></div>
        </div>
    `;
    
    // Add CSS for file selection
    const style = document.createElement('style');
    style.textContent = `
        .file-item.selected {
            background: var(--primary-color);
            color: white;
        }
        .file-item.selected .file-size,
        .file-item.selected .file-date,
        .file-item.selected .file-description {
            color: rgba(255, 255, 255, 0.8);
        }
        .file-info {
            flex: 1;
        }
        .file-details {
            display: flex;
            gap: 8px;
            margin-top: 2px;
        }
        .file-description {
            font-size: 9px;
            color: var(--text-secondary);
            margin-top: 2px;
        }
        .file-metadata {
            margin-top: 8px;
            padding: 8px;
            background: var(--background-dark);
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);
    
    pageModules.files.init();
}
