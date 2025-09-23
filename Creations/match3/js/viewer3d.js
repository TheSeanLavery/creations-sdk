// 3D Viewer for R1 CAD Creator
class Viewer3D {
    constructor(containerId) {
        this.containerId = containerId;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.mesh = null;
        this.animationId = null;
        this.isInitialized = false;
    }
    
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('3D viewer container not found:', this.containerId);
            return false;
        }
        
        // Get container dimensions
        const rect = container.getBoundingClientRect();
        const width = rect.width || 200;
        const height = rect.height || 120;
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
        
        // Add renderer to container
        container.innerHTML = '';
        container.appendChild(this.renderer.domElement);
        
        // Add basic controls (rotation on touch/mouse)
        this.addControls();
        
        this.isInitialized = true;
        this.animate();
        
        return true;
    }
    
    addControls() {
        let isRotating = false;
        let isZooming = false;
        let previousMousePosition = { x: 0, y: 0 };
        let previousTouchDistance = 0;
        let previousTouches = [];
        
        const canvas = this.renderer.domElement;
        
        // Mouse controls
        canvas.addEventListener('mousedown', (e) => {
            isRotating = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isRotating) return;
            
            const deltaMove = {
                x: e.clientX - previousMousePosition.x,
                y: e.clientY - previousMousePosition.y
            };
            
            this.rotateCamera(deltaMove.x * 0.01, deltaMove.y * 0.01);
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        canvas.addEventListener('mouseup', () => {
            isRotating = false;
            canvas.style.cursor = 'grab';
        });
        
        canvas.addEventListener('mouseleave', () => {
            isRotating = false;
            canvas.style.cursor = 'grab';
        });
        
        // Mouse wheel zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const zoomDelta = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
            this.zoomCamera(zoomDelta);
        });
        
        // Touch controls with pinch-to-zoom
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1) {
                // Single touch - rotation
                isRotating = true;
                isZooming = false;
                previousMousePosition = { 
                    x: e.touches[0].clientX, 
                    y: e.touches[0].clientY 
                };
            } else if (e.touches.length === 2) {
                // Two finger touch - zoom and rotate
                isRotating = false;
                isZooming = true;
                
                // Calculate distance between touches for zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                previousTouchDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                // Store touch positions for rotation
                previousTouches = [
                    { x: touch1.clientX, y: touch1.clientY },
                    { x: touch2.clientX, y: touch2.clientY }
                ];
            }
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && isRotating) {
                // Single touch rotation
                const deltaMove = {
                    x: e.touches[0].clientX - previousMousePosition.x,
                    y: e.touches[0].clientY - previousMousePosition.y
                };
                
                this.rotateCamera(deltaMove.x * 0.01, deltaMove.y * 0.01);
                previousMousePosition = { 
                    x: e.touches[0].clientX, 
                    y: e.touches[0].clientY 
                };
            } else if (e.touches.length === 2 && isZooming) {
                // Two finger pinch-to-zoom and rotation
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                // Handle zoom
                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                if (previousTouchDistance > 0) {
                    const zoomDelta = currentDistance / previousTouchDistance;
                    this.zoomCamera(zoomDelta);
                }
                previousTouchDistance = currentDistance;
                
                // Handle rotation with two fingers
                if (previousTouches.length === 2) {
                    const currentCenter = {
                        x: (touch1.clientX + touch2.clientX) / 2,
                        y: (touch1.clientY + touch2.clientY) / 2
                    };
                    
                    const previousCenter = {
                        x: (previousTouches[0].x + previousTouches[1].x) / 2,
                        y: (previousTouches[0].y + previousTouches[1].y) / 2
                    };
                    
                    const deltaMove = {
                        x: currentCenter.x - previousCenter.x,
                        y: currentCenter.y - previousCenter.y
                    };
                    
                    this.rotateCamera(deltaMove.x * 0.005, deltaMove.y * 0.005);
                }
                
                previousTouches = [
                    { x: touch1.clientX, y: touch1.clientY },
                    { x: touch2.clientX, y: touch2.clientY }
                ];
            }
        });
        
        canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                isRotating = false;
                isZooming = false;
                previousTouches = [];
            } else if (e.touches.length === 1) {
                // Switch back to rotation mode
                isZooming = false;
                isRotating = true;
                previousMousePosition = { 
                    x: e.touches[0].clientX, 
                    y: e.touches[0].clientY 
                };
            }
        });
        
        // Set initial cursor
        canvas.style.cursor = 'grab';
        canvas.style.touchAction = 'none'; // Prevent default touch behaviors
    }
    
    rotateCamera(deltaX, deltaY) {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position);
        
        spherical.theta -= deltaX;
        spherical.phi += deltaY;
        
        // Limit vertical rotation
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
    }
    
    zoomCamera(zoomDelta) {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position);
        
        // Adjust zoom with limits
        spherical.radius *= zoomDelta;
        spherical.radius = Math.max(2, Math.min(100, spherical.radius));
        
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
    }
    
    resetView() {
        // Reset to default view
        const spherical = new THREE.Spherical();
        spherical.radius = 15;
        spherical.phi = Math.PI / 3;
        spherical.theta = Math.PI / 4;
        
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
    }
    
    setPresetView(viewName) {
        const spherical = new THREE.Spherical();
        spherical.radius = 15;
        
        switch (viewName) {
            case 'front':
                spherical.phi = Math.PI / 2;
                spherical.theta = 0;
                break;
            case 'back':
                spherical.phi = Math.PI / 2;
                spherical.theta = Math.PI;
                break;
            case 'left':
                spherical.phi = Math.PI / 2;
                spherical.theta = -Math.PI / 2;
                break;
            case 'right':
                spherical.phi = Math.PI / 2;
                spherical.theta = Math.PI / 2;
                break;
            case 'top':
                spherical.phi = 0.1;
                spherical.theta = 0;
                break;
            case 'bottom':
                spherical.phi = Math.PI - 0.1;
                spherical.theta = 0;
                break;
            case 'isometric':
                spherical.phi = Math.PI / 3;
                spherical.theta = Math.PI / 4;
                break;
            default:
                return this.resetView();
        }
        
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
    }
    
    loadModelFromSCAD(scadCode, color = '#00A6FF') {
        if (!this.isInitialized) {
            if (!this.init()) return;
        }
        
        // Remove existing mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh = null;
        }
        
        // Parse OpenSCAD code and create geometry
        const geometry = this.parseOpenSCADCode(scadCode);
        if (!geometry) {
            this.showError('Unable to parse 3D model');
            return;
        }
        
        // Create material
        const material = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.9
        });
        
        // Create mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
        
        // Center and scale the model
        this.centerModel();
    }
    
    parseOpenSCADCode(scadCode) {
        // Enhanced OpenSCAD parser for more complex shapes
        // This analyzes the code and creates appropriate 3D geometry
        
        try {
            // Analyze the code to determine the primary shape type
            const codeType = this.analyzeCodeType(scadCode);
            console.log('3D Viewer: Detected code type:', codeType);
            console.log('3D Viewer: SCAD code preview:', scadCode.substring(0, 200) + '...');
            
            switch (codeType) {
                case 'baseball':
                    return this.createBaseballGeometry(scadCode);
                case 'basketball':
                    return this.createBasketballGeometry(scadCode);
                case 'golf_ball':
                    return this.createGolfBallGeometry(scadCode);
                case 'tennis_ball':
                    return this.createTennisBallGeometry(scadCode);
                case 'phone_stand':
                    return this.createPhoneStandGeometry(scadCode);
                case 'mug':
                    return this.createMugGeometry(scadCode);
                case 'box':
                    return this.createBoxGeometry(scadCode);
                case 'bracket':
                    return this.createBracketGeometry(scadCode);
                case 'gear':
                    return this.createGearGeometry(scadCode);
                case 'vase':
                    return this.createVaseGeometry(scadCode);
                case 'cylinder':
                    return this.createCylinderGeometry(scadCode);
                case 'sphere':
                    return this.createSphereGeometry(scadCode);
                case 'cube':
                    return this.createCubeGeometry(scadCode);
                default:
                    return this.createSphereGeometry(scadCode); // Default to sphere
            }
            
        } catch (error) {
            console.error('Error parsing OpenSCAD code:', error);
            return new THREE.BoxGeometry(10, 10, 10);
        }
    }
    
    analyzeCodeType(scadCode) {
        const lowerCode = scadCode.toLowerCase();
        
        // Sports balls - check for specific ball types first
        if (lowerCode.includes('baseball') || (lowerCode.includes('stitch') && lowerCode.includes('ball'))) {
            return 'baseball';
        }
        if (lowerCode.includes('basketball') || (lowerCode.includes('line') && lowerCode.includes('ball'))) {
            return 'basketball';
        }
        if (lowerCode.includes('golf') || (lowerCode.includes('dimple') && lowerCode.includes('ball'))) {
            return 'golf_ball';
        }
        if (lowerCode.includes('tennis') || (lowerCode.includes('seam') && lowerCode.includes('ball'))) {
            return 'tennis_ball';
        }
        
        // Check for sphere/ball before cylinder (since balls contain sphere())
        if (lowerCode.includes('sphere') || lowerCode.includes('ball')) {
            return 'sphere';
        }
        
        // Other objects
        if (lowerCode.includes('phone_stand') || (lowerCode.includes('phone') && lowerCode.includes('stand'))) {
            return 'phone_stand';
        }
        if (lowerCode.includes('coffee_mug') || lowerCode.includes('mug') || lowerCode.includes('torus')) {
            return 'mug';
        }
        if (lowerCode.includes('storage_box') || lowerCode.includes('box') || lowerCode.includes('minkowski')) {
            return 'box';
        }
        if (lowerCode.includes('mounting_bracket') || lowerCode.includes('bracket')) {
            return 'bracket';
        }
        if (lowerCode.includes('gear') || lowerCode.includes('involute')) {
            return 'gear';
        }
        if (lowerCode.includes('vase') || lowerCode.includes('hull')) {
            return 'vase';
        }
        if (lowerCode.includes('cylinder')) {
            return 'cylinder';
        }
        if (lowerCode.includes('cube')) {
            return 'cube';
        }
        
        return 'sphere'; // Default to sphere instead of generic
    }
    
    extractParameter(scadCode, paramName, defaultValue = 10) {
        const regex = new RegExp(`${paramName}\\s*=\\s*([\\d.]+)`, 'i');
        const match = scadCode.match(regex);
        return match ? parseFloat(match[1]) : defaultValue;
    }
    
    createPhoneStandGeometry(scadCode) {
        const width = this.extractParameter(scadCode, 'stand_width', 80);
        const depth = this.extractParameter(scadCode, 'stand_depth', 60);
        const height = this.extractParameter(scadCode, 'stand_height', 20);
        
        // Create a simplified phone stand shape
        const geometry = new THREE.Group();
        
        // Main stand body
        const backPanel = new THREE.BoxGeometry(width, 3, height);
        const backMesh = new THREE.Mesh(backPanel);
        backMesh.position.set(0, -depth/2, height/2);
        geometry.add(backMesh);
        
        // Base
        const base = new THREE.BoxGeometry(width, depth, 3);
        const baseMesh = new THREE.Mesh(base);
        baseMesh.position.set(0, 0, 1.5);
        geometry.add(baseMesh);
        
        return this.groupToGeometry(geometry, width, depth, height);
    }
    
    createMugGeometry(scadCode) {
        const height = this.extractParameter(scadCode, 'cup_height', 100);
        const radius = this.extractParameter(scadCode, 'cup_radius', 40);
        const thickness = this.extractParameter(scadCode, 'wall_thickness', 3);
        
        // Create hollow cylinder for mug
        const outerGeometry = new THREE.CylinderGeometry(radius, radius, height, 32);
        const innerGeometry = new THREE.CylinderGeometry(radius - thickness, radius - thickness, height - thickness, 32);
        
        // Use CSG-like approach (simplified)
        return outerGeometry;
    }
    
    createBoxGeometry(scadCode) {
        const width = this.extractParameter(scadCode, 'box_width', 50);
        const height = this.extractParameter(scadCode, 'box_height', 30);
        const depth = this.extractParameter(scadCode, 'box_depth', 40);
        
        return new THREE.BoxGeometry(width, depth, height);
    }
    
    createBracketGeometry(scadCode) {
        const width = this.extractParameter(scadCode, 'bracket_width', 60);
        const height = this.extractParameter(scadCode, 'bracket_height', 40);
        const thickness = this.extractParameter(scadCode, 'bracket_thickness', 4);
        
        // Create L-shaped bracket
        const geometry = new THREE.Group();
        
        // Vertical part
        const vertical = new THREE.BoxGeometry(thickness, width, height);
        const verticalMesh = new THREE.Mesh(vertical);
        verticalMesh.position.set(-width/2, 0, height/2);
        geometry.add(verticalMesh);
        
        // Horizontal part
        const horizontal = new THREE.BoxGeometry(width, thickness, thickness);
        const horizontalMesh = new THREE.Mesh(horizontal);
        horizontalMesh.position.set(0, -width/2, thickness/2);
        geometry.add(horizontalMesh);
        
        return this.groupToGeometry(geometry, width, width, height);
    }
    
    createGearGeometry(scadCode) {
        const teeth = this.extractParameter(scadCode, 'gear_teeth', 20);
        const radius = this.extractParameter(scadCode, 'gear_radius', 25);
        const thickness = this.extractParameter(scadCode, 'gear_thickness', 5);
        
        // Create simplified gear shape
        const geometry = new THREE.CylinderGeometry(radius, radius, thickness, teeth * 2);
        return geometry;
    }
    
    createVaseGeometry(scadCode) {
        const height = this.extractParameter(scadCode, 'vase_height', 120);
        const bottomRadius = this.extractParameter(scadCode, 'bottom_radius', 30);
        const topRadius = this.extractParameter(scadCode, 'top_radius', 25);
        
        // Create tapered cylinder
        return new THREE.CylinderGeometry(topRadius, bottomRadius, height, 32);
    }
    
    createCylinderGeometry(scadCode) {
        const heightMatch = scadCode.match(/h\s*=\s*([\d.]+)/i);
        const radiusMatch = scadCode.match(/r\s*=\s*([\d.]+)/i) || scadCode.match(/d\s*=\s*([\d.]+)/i);
        
        const height = heightMatch ? parseFloat(heightMatch[1]) : 10;
        const radius = radiusMatch ? parseFloat(radiusMatch[1]) / (scadCode.includes('d=') ? 2 : 1) : 5;
        
        return new THREE.CylinderGeometry(radius, radius, height, 32);
    }
    
    createSphereGeometry(scadCode) {
        // Check for diameter parameter first
        const diameterMatch = scadCode.match(/(?:ball_diameter|diameter)\s*=\s*([\d.]+)/i) ||
                             scadCode.match(/sphere\s*\(\s*d\s*=\s*([\d.]+)/i);
        
        if (diameterMatch) {
            const diameter = parseFloat(diameterMatch[1]);
            return new THREE.SphereGeometry(diameter / 2, 32, 16);
        }
        
        // Check for radius parameter
        const radiusMatch = scadCode.match(/sphere\s*\(\s*r?\s*=?\s*([\d.]+)/i) || 
                           scadCode.match(/sphere\s*\(\s*([\d.]+)/i);
        const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 5;
        
        return new THREE.SphereGeometry(radius, 32, 16);
    }
    
    createCubeGeometry(scadCode) {
        const cubeMatch = scadCode.match(/cube\s*\(\s*\[([^\]]+)\]\s*\)/i);
        if (cubeMatch) {
            const dimensions = cubeMatch[1].split(',').map(d => parseFloat(d.trim()) || 10);
            return new THREE.BoxGeometry(dimensions[0] || 10, dimensions[1] || 10, dimensions[2] || 10);
        }
        
        const sizeMatch = scadCode.match(/cube\s*\(\s*([\d.]+)/i);
        const size = sizeMatch ? parseFloat(sizeMatch[1]) : 10;
        
        return new THREE.BoxGeometry(size, size, size);
    }
    
    createGenericGeometry(scadCode) {
        // Try to extract any numeric values and create a reasonable shape
        const numbers = scadCode.match(/\d+\.?\d*/g);
        if (numbers && numbers.length >= 3) {
            const dims = numbers.slice(0, 3).map(n => parseFloat(n));
            return new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
        }
        
        return new THREE.BoxGeometry(20, 20, 20);
    }
    
    createBaseballGeometry(scadCode) {
        const diameter = this.extractParameter(scadCode, 'ball_diameter', 73);
        const radius = diameter / 2;
        
        // Create sphere with surface details
        const geometry = new THREE.SphereGeometry(radius, 32, 16);
        
        // Add visual indication of surface details (simplified representation)
        return geometry;
    }
    
    createBasketballGeometry(scadCode) {
        const diameter = this.extractParameter(scadCode, 'ball_diameter', 240);
        const radius = diameter / 2;
        
        // Create sphere for basketball
        return new THREE.SphereGeometry(radius, 32, 16);
    }
    
    createGolfBallGeometry(scadCode) {
        const diameter = this.extractParameter(scadCode, 'ball_diameter', 43);
        const radius = diameter / 2;
        
        // Create sphere for golf ball
        return new THREE.SphereGeometry(radius, 32, 16);
    }
    
    createTennisBallGeometry(scadCode) {
        const diameter = this.extractParameter(scadCode, 'ball_diameter', 67);
        const radius = diameter / 2;
        
        // Create sphere for tennis ball
        return new THREE.SphereGeometry(radius, 32, 16);
    }
    
    groupToGeometry(group, width, depth, height) {
        // Convert a group of meshes to a single geometry (simplified)
        // For now, just return a bounding box representation
        return new THREE.BoxGeometry(width, depth, height);
    }
    
    centerModel() {
        if (!this.mesh) return;
        
        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(this.mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Center the model
        this.mesh.position.sub(center);
        
        // Scale to fit in view
        const maxSize = Math.max(size.x, size.y, size.z);
        const targetSize = 8; // Target size in scene units
        const scale = targetSize / maxSize;
        this.mesh.scale.setScalar(Math.min(scale, 1));
        
        // Adjust camera distance
        const distance = maxSize * 1.5;
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position);
        spherical.radius = Math.max(distance, 10);
        this.camera.position.setFromSpherical(spherical);
    }
    
    showError(message) {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; 
                           height: 100%; color: var(--error-color); font-size: 10px; text-align: center;">
                    <div>
                        <div style="font-size: 20px; margin-bottom: 4px;">⚠️</div>
                        <div>${message}</div>
                    </div>
                </div>
            `;
        }
    }
    
    showPlaceholder(message = '3D Model Preview') {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; 
                           height: 100%; color: var(--text-secondary); font-size: 10px; text-align: center;">
                    <div>
                        <div style="font-size: 24px; margin-bottom: 4px;">📦</div>
                        <div>${message}</div>
                    </div>
                </div>
            `;
        }
    }
    
    animate() {
        if (!this.isInitialized) return;
        
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Subtle rotation animation when idle
        if (this.mesh && !this.isInteracting) {
            this.mesh.rotation.y += 0.005;
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
        
        this.isInitialized = false;
    }
    
    resize(width, height) {
        if (!this.isInitialized) return;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}

// Global 3D viewer instances
window.viewer3D = {
    instances: {},
    
    create(containerId) {
        if (this.instances[containerId]) {
            this.instances[containerId].dispose();
        }
        
        this.instances[containerId] = new Viewer3D(containerId);
        return this.instances[containerId];
    },
    
    get(containerId) {
        return this.instances[containerId];
    },
    
    dispose(containerId) {
        if (this.instances[containerId]) {
            this.instances[containerId].dispose();
            delete this.instances[containerId];
        }
    }
};
