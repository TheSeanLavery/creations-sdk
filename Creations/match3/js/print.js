// Print Page - 3D printer discovery and management
pageModules.print = {
    discoveredPrinters: [],
    selectedPrinter: null,
    currentPrintJob: null,
    isDiscovering: false,
    
    init: function() {
        this.setupEventListeners();
        this.loadPrinterSettings();
        this.checkForSelectedFile();
        this.startPrinterDiscovery();
    },
    
    setupEventListeners: function() {
        const discoverBtn = document.getElementById('discoverBtn');
        const connectBtn = document.getElementById('connectBtn');
        const printBtn = document.getElementById('printBtn');
        const sliceBtn = document.getElementById('sliceBtn');
        
        if (discoverBtn) {
            discoverBtn.addEventListener('click', () => this.startPrinterDiscovery());
        }
        
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectToPrinter());
        }
        
        if (printBtn) {
            printBtn.addEventListener('click', () => this.startPrint());
        }
        
        if (sliceBtn) {
            sliceBtn.addEventListener('click', () => this.sliceModel());
        }
    },
    
    async startPrinterDiscovery() {
        if (this.isDiscovering) return;
        
        this.isDiscovering = true;
        const discoverBtn = document.getElementById('discoverBtn');
        const statusDiv = document.getElementById('printerStatus');
        
        if (discoverBtn) {
            discoverBtn.disabled = true;
            discoverBtn.innerHTML = '<div class="loading"></div> Discovering...';
        }
        
        if (statusDiv) {
            statusDiv.innerHTML = '<span class="status status-info">Scanning for WiFi printers...</span>';
        }
        
        try {
            // Simulate printer discovery - in real implementation would scan network
            await this.simulatePrinterDiscovery();
            
            this.renderPrinterList();
            
            if (statusDiv) {
                const count = this.discoveredPrinters.length;
                statusDiv.innerHTML = `<span class="status status-success">Found ${count} printer${count !== 1 ? 's' : ''}</span>`;
            }
            
        } catch (error) {
            console.error('Printer discovery failed:', error);
            if (statusDiv) {
                statusDiv.innerHTML = '<span class="status status-error">Discovery failed</span>';
            }
            window.cadCreator.showToast('Printer discovery failed', 'error');
        } finally {
            this.isDiscovering = false;
            if (discoverBtn) {
                discoverBtn.disabled = false;
                discoverBtn.textContent = 'Discover Printers';
            }
        }
    },
    
    async simulatePrinterDiscovery() {
        // Simulate network scanning delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mock discovered printers
        this.discoveredPrinters = [
            {
                id: 'ender3_001',
                name: 'Ender 3 Pro',
                ip: '192.168.1.100',
                type: 'FDM',
                status: 'idle',
                bedTemp: 20,
                nozzleTemp: 22,
                progress: 0,
                connected: false,
                capabilities: ['heated_bed', 'auto_level']
            },
            {
                id: 'prusa_mk3',
                name: 'Prusa i3 MK3S+',
                ip: '192.168.1.101',
                type: 'FDM',
                status: 'idle',
                bedTemp: 21,
                nozzleTemp: 23,
                progress: 0,
                connected: false,
                capabilities: ['heated_bed', 'auto_level', 'power_panic', 'filament_sensor']
            }
        ];
        
        // Try to load previously connected printer
        const settings = await window.cadCreator.getStorageItem('cad_creator_data');
        if (settings && settings.settings && settings.settings.lastPrinter) {
            const lastPrinter = this.discoveredPrinters.find(p => p.id === settings.settings.lastPrinter);
            if (lastPrinter) {
                this.selectedPrinter = lastPrinter;
            }
        }
    },
    
    renderPrinterList() {
        const printerList = document.getElementById('printerList');
        if (!printerList) return;
        
        if (this.discoveredPrinters.length === 0) {
            printerList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <div style="font-size: 24px; margin-bottom: 8px;">🖨️</div>
                    <div>No printers found</div>
                    <div class="text-tiny">Make sure your printer is connected to WiFi</div>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.discoveredPrinters.forEach((printer, index) => {
            const isSelected = this.selectedPrinter && this.selectedPrinter.id === printer.id;
            const statusColor = printer.status === 'idle' ? 'success' : 
                              printer.status === 'printing' ? 'warning' : 'info';
            
            html += `
                <div class="printer-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    <div class="printer-status">
                        <div class="printer-icon ${printer.connected ? 'connected' : ''}"></div>
                        <div class="printer-info">
                            <div class="printer-name">${printer.name}</div>
                            <div class="printer-details">
                                <span class="status status-${statusColor}">${printer.status}</span>
                                <span class="text-tiny">${printer.ip}</span>
                            </div>
                            <div class="printer-temps text-tiny">
                                Bed: ${printer.bedTemp}°C | Nozzle: ${printer.nozzleTemp}°C
                            </div>
                        </div>
                    </div>
                    ${printer.progress > 0 ? `
                        <div class="progress">
                            <div class="progress-bar" style="width: ${printer.progress}%"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        printerList.innerHTML = html;
        
        // Add click handlers
        printerList.querySelectorAll('.printer-item').forEach((item, index) => {
            item.addEventListener('click', () => this.selectPrinter(index));
        });
    },
    
    selectPrinter(index) {
        this.selectedPrinter = this.discoveredPrinters[index];
        this.renderPrinterList();
        this.updatePrinterActions();
        this.savePrinterSettings();
    },
    
    updatePrinterActions() {
        const connectBtn = document.getElementById('connectBtn');
        const printBtn = document.getElementById('printBtn');
        
        if (connectBtn) {
            connectBtn.disabled = !this.selectedPrinter;
            connectBtn.textContent = this.selectedPrinter && this.selectedPrinter.connected ? 'Disconnect' : 'Connect';
        }
        
        if (printBtn) {
            const canPrint = this.selectedPrinter && 
                           this.selectedPrinter.connected && 
                           this.selectedPrinter.status === 'idle' &&
                           (window.cadCreator.selectedFileForPrint || this.currentPrintJob);
            printBtn.disabled = !canPrint;
        }
    },
    
    async connectToPrinter() {
        if (!this.selectedPrinter) return;
        
        const connectBtn = document.getElementById('connectBtn');
        const statusDiv = document.getElementById('printerStatus');
        
        try {
            connectBtn.disabled = true;
            connectBtn.innerHTML = '<div class="loading"></div> Connecting...';
            
            // Simulate connection
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.selectedPrinter.connected = !this.selectedPrinter.connected;
            
            if (this.selectedPrinter.connected) {
                statusDiv.innerHTML = '<span class="status status-success">Connected to printer</span>';
                window.cadCreator.showToast('Printer connected', 'success');
                
                // Start temperature monitoring
                this.startTemperatureMonitoring();
            } else {
                statusDiv.innerHTML = '<span class="status status-info">Disconnected</span>';
                window.cadCreator.showToast('Printer disconnected', 'info');
                this.stopTemperatureMonitoring();
            }
            
            this.renderPrinterList();
            this.updatePrinterActions();
            
        } catch (error) {
            console.error('Connection failed:', error);
            statusDiv.innerHTML = '<span class="status status-error">Connection failed</span>';
            window.cadCreator.showToast('Connection failed', 'error');
        } finally {
            connectBtn.disabled = false;
            connectBtn.textContent = this.selectedPrinter && this.selectedPrinter.connected ? 'Disconnect' : 'Connect';
        }
    },
    
    startTemperatureMonitoring() {
        if (this.tempMonitorInterval) {
            clearInterval(this.tempMonitorInterval);
        }
        
        this.tempMonitorInterval = setInterval(() => {
            if (this.selectedPrinter && this.selectedPrinter.connected) {
                // Simulate temperature fluctuations
                this.selectedPrinter.bedTemp = Math.round(20 + Math.random() * 3);
                this.selectedPrinter.nozzleTemp = Math.round(22 + Math.random() * 3);
                
                this.renderPrinterList();
            }
        }, 5000);
    },
    
    stopTemperatureMonitoring() {
        if (this.tempMonitorInterval) {
            clearInterval(this.tempMonitorInterval);
            this.tempMonitorInterval = null;
        }
    },
    
    async sliceModel() {
        const selectedFile = window.cadCreator.selectedFileForPrint;
        if (!selectedFile) {
            window.cadCreator.showToast('No file selected for slicing', 'warning');
            return;
        }
        
        const sliceBtn = document.getElementById('sliceBtn');
        const statusDiv = document.getElementById('printerStatus');
        
        try {
            sliceBtn.disabled = true;
            sliceBtn.innerHTML = '<div class="loading"></div> Slicing...';
            statusDiv.innerHTML = '<span class="status status-info">Slicing model...</span>';
            
            // Simulate slicing process
            await this.simulateSlicing(selectedFile);
            
            statusDiv.innerHTML = '<span class="status status-success">Model sliced successfully</span>';
            window.cadCreator.showToast('Model ready for printing', 'success');
            
            this.updatePrinterActions();
            
        } catch (error) {
            console.error('Slicing failed:', error);
            statusDiv.innerHTML = '<span class="status status-error">Slicing failed</span>';
            window.cadCreator.showToast('Slicing failed', 'error');
        } finally {
            sliceBtn.disabled = false;
            sliceBtn.textContent = 'Slice Model';
        }
    },
    
    async simulateSlicing(file) {
        // Simulate slicing time based on file complexity
        const sliceTime = Math.max(2000, (file.size || 1000) / 100);
        await new Promise(resolve => setTimeout(resolve, sliceTime));
        
        // Create print job
        this.currentPrintJob = {
            id: window.cadCreator.generateId(),
            file: file,
            sliced: true,
            estimatedTime: Math.round(30 + (file.size || 1000) / 1000 * 60), // minutes
            layerHeight: 0.2,
            infill: 20,
            printTemp: 210,
            bedTemp: 60,
            gcode: `; Generated G-code for ${file.name}\n; Estimated print time: ${Math.round(30 + (file.size || 1000) / 1000 * 60)} minutes\n`
        };
    },
    
    async startPrint() {
        if (!this.selectedPrinter || !this.selectedPrinter.connected || !this.currentPrintJob) {
            window.cadCreator.showToast('Cannot start print', 'warning');
            return;
        }
        
        const printBtn = document.getElementById('printBtn');
        const statusDiv = document.getElementById('printerStatus');
        
        try {
            printBtn.disabled = true;
            printBtn.innerHTML = '<div class="loading"></div> Starting...';
            
            // Send print job to printer
            await this.sendPrintJob();
            
            this.selectedPrinter.status = 'printing';
            this.selectedPrinter.progress = 0;
            
            statusDiv.innerHTML = '<span class="status status-warning">Printing started</span>';
            window.cadCreator.showToast('Print job started', 'success');
            
            // Start print progress simulation
            this.startPrintProgress();
            
            this.renderPrinterList();
            this.updatePrinterActions();
            
        } catch (error) {
            console.error('Print start failed:', error);
            statusDiv.innerHTML = '<span class="status status-error">Print failed to start</span>';
            window.cadCreator.showToast('Print failed to start', 'error');
        } finally {
            printBtn.disabled = true; // Keep disabled during printing
            printBtn.textContent = 'Print';
        }
    },
    
    async sendPrintJob() {
        // Simulate sending G-code to printer
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In real implementation, would send G-code via network protocol
        console.log('Sending print job to printer:', this.currentPrintJob);
    },
    
    startPrintProgress() {
        if (this.printProgressInterval) {
            clearInterval(this.printProgressInterval);
        }
        
        this.printProgressInterval = setInterval(() => {
            if (this.selectedPrinter && this.selectedPrinter.status === 'printing') {
                this.selectedPrinter.progress = Math.min(100, this.selectedPrinter.progress + 1);
                
                // Simulate temperature changes during printing
                this.selectedPrinter.nozzleTemp = Math.round(205 + Math.random() * 10);
                this.selectedPrinter.bedTemp = Math.round(58 + Math.random() * 4);
                
                if (this.selectedPrinter.progress >= 100) {
                    this.selectedPrinter.status = 'idle';
                    this.selectedPrinter.progress = 0;
                    this.selectedPrinter.nozzleTemp = Math.round(25 + Math.random() * 5);
                    this.selectedPrinter.bedTemp = Math.round(22 + Math.random() * 3);
                    
                    clearInterval(this.printProgressInterval);
                    this.printProgressInterval = null;
                    
                    window.cadCreator.showToast('Print completed!', 'success');
                    this.updatePrinterActions();
                }
                
                this.renderPrinterList();
            }
        }, 2000); // Update every 2 seconds for demo
    },
    
    checkForSelectedFile() {
        if (window.cadCreator.selectedFileForPrint) {
            const fileInfo = document.getElementById('selectedFile');
            if (fileInfo) {
                const file = window.cadCreator.selectedFileForPrint;
                fileInfo.innerHTML = `
                    <div class="card">
                        <div class="card-header">Selected File</div>
                        <div class="card-content">
                            <div class="file-name">${file.name || 'Untitled'}</div>
                            <div class="file-details text-tiny">
                                Size: ${window.cadCreator.formatFileSize(file.size || 0)}
                            </div>
                            ${file.description ? `<div class="text-tiny">${file.description}</div>` : ''}
                            <button id="sliceBtn" class="btn btn-small mt-1">Slice Model</button>
                        </div>
                    </div>
                `;
                
                // Re-attach slice button listener
                const sliceBtn = document.getElementById('sliceBtn');
                if (sliceBtn) {
                    sliceBtn.addEventListener('click', () => this.sliceModel());
                }
            }
        }
    },
    
    async loadPrinterSettings() {
        try {
            const appData = await window.cadCreator.getStorageItem('cad_creator_data');
            if (appData && appData.settings && appData.settings.printerSettings) {
                // Load saved printer settings
            }
        } catch (error) {
            console.error('Failed to load printer settings:', error);
        }
    },
    
    async savePrinterSettings() {
        if (!this.selectedPrinter) return;
        
        try {
            const appData = await window.cadCreator.getStorageItem('cad_creator_data') || {};
            if (!appData.settings) appData.settings = {};
            
            appData.settings.lastPrinter = this.selectedPrinter.id;
            appData.settings.printerSettings = {
                [this.selectedPrinter.id]: {
                    name: this.selectedPrinter.name,
                    ip: this.selectedPrinter.ip,
                    lastConnected: new Date().toISOString()
                }
            };
            
            await window.cadCreator.setStorageItem('cad_creator_data', appData);
        } catch (error) {
            console.error('Failed to save printer settings:', error);
        }
    },
    
    // Hardware event handlers
    handleScrollUp() {
        const printerList = document.getElementById('printerList');
        if (printerList) {
            printerList.scrollTop -= 30;
        }
    },
    
    handleScrollDown() {
        const printerList = document.getElementById('printerList');
        if (printerList) {
            printerList.scrollTop += 30;
        }
    },
    
    handleMessage(data) {
        console.log('Print page received message:', data);
    },
    
    cleanup() {
        this.stopTemperatureMonitoring();
        if (this.printProgressInterval) {
            clearInterval(this.printProgressInterval);
        }
    }
};

// Load Print Page
function loadPrintPage(content) {
    content.innerHTML = `
        <div class="print-page">
            <div class="flex justify-between items-center mb-2">
                <h3 style="font-size: 14px; margin: 0;">3D Printers</h3>
                <button id="discoverBtn" class="btn btn-small">Discover</button>
            </div>
            
            <div id="printerStatus" class="mb-2"></div>
            
            <div id="printerList" class="mb-2" style="max-height: 100px; overflow-y: auto;"></div>
            
            <div class="flex gap-1 mb-2">
                <button id="connectBtn" class="btn btn-small flex-1" disabled>Connect</button>
                <button id="printBtn" class="btn btn-small" disabled>Print</button>
            </div>
            
            <div id="selectedFile" class="mb-2"></div>
        </div>
    `;
    
    // Add CSS for printer selection
    const style = document.createElement('style');
    style.textContent = `
        .printer-item {
            padding: 8px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin-bottom: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .printer-item:hover {
            border-color: var(--primary-color);
        }
        .printer-item.selected {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }
        .printer-item.selected .printer-details,
        .printer-item.selected .printer-temps {
            color: rgba(255, 255, 255, 0.8);
        }
        .printer-icon.connected {
            background: var(--success-color);
        }
        .printer-temps {
            margin-top: 2px;
        }
    `;
    document.head.appendChild(style);
    
    pageModules.print.init();
}
