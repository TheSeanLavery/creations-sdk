// AI Service - Real CADAM integration for R1 using DeepSeek V3.1
class AIService {
    constructor() {
        this.apiEndpoint = 'https://api.deepseek.com/v1/chat/completions';
        this.apiKey = null;
        this.isConnected = false;
        this.mockMode = true; // Will be set to false when API key is provided
    }
    
    async generateCADModel(prompt, options = {}) {
        if (this.mockMode || !this.apiKey) {
            return this.generateMockCADModel(prompt, options);
        }
        
        try {
            // Use DeepSeek V3.1 to generate real OpenSCAD code
            const response = await this.callDeepSeekAPI(prompt, options);
            return this.parseDeepSeekResponse(response);
        } catch (error) {
            console.error('DeepSeek API error:', error);
            window.cadCreator.showToast('AI generation failed, using fallback', 'warning');
            // Fallback to mock generation
            return this.generateMockCADModel(prompt, options);
        }
    }
    
    async callDeepSeekAPI(prompt, options) {
        const systemPrompt = `You are Adam, an expert OpenSCAD developer and 3D designer. Generate OpenSCAD code for 3D printable objects based on user requests.

CRITICAL REQUIREMENTS:
1. Generate ONLY valid OpenSCAD code that compiles without errors
2. Make all models parametric with variables at the top
3. Ensure models are manifold and 3D printable
4. Use proper OpenSCAD syntax and best practices
5. Include meaningful comments
6. Make dimensions realistic for 3D printing (in millimeters)
7. Ensure all parts are connected as a single printable object
8. **INCLUDE REALISTIC SURFACE DETAILS** - Add characteristic features, patterns, textures, and details that define the object
9. Use geometric operations to create surface patterns, grooves, ridges, holes, and other defining features

SURFACE DETAIL EXAMPLES:
- Baseball: Add stitching seams using thin raised lines in figure-8 pattern
- Basketball: Add curved line patterns and dimpled texture
- Golf ball: Add dimple pattern using small spherical indentations
- Gear: Add proper involute teeth, hub details, and mounting holes
- Phone stand: Add cable management slots, grip patterns, anti-slip features
- Mug: Add handle attachment details, rim features, base ring
- Vase: Add decorative ridges, fluted patterns, or surface textures
- Box: Add corner reinforcements, lid lips, hinge details, closure mechanisms

ADVANCED TECHNIQUES TO USE:
- rotate_extrude() for circular patterns and details
- linear_extrude() for profile-based features
- for() loops to create repeated patterns
- hull() for smooth transitions and organic shapes
- minkowski() for rounded edges and fillets
- intersection() and difference() for complex surface features
- translate() and rotate() for positioning detailed elements

RESPONSE FORMAT:
Respond with ONLY the OpenSCAD code. No explanations, no markdown formatting, just pure OpenSCAD code that can be directly compiled.

Examples of detailed parametric OpenSCAD code:
- Use variables like: width = 50; height = 30; detail_depth = 0.5;
- Create modules for surface details and patterns
- Include proper $fn values for smooth curves (minimum 32 for circles)
- Use difference() for surface indentations and cutouts
- Use union() for raised surface features
- Add realistic proportions and authentic details`;

        const requestBody = {
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user", 
                    content: `Create a 3D printable OpenSCAD model: ${prompt}`
                }
            ],
            max_tokens: 4000,
            temperature: 0.1,
            stream: false
        };
        
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API request failed: ${response.status} - ${errorText}`);
        }
        
        return response.json();
    }
    
    parseDeepSeekResponse(response) {
        try {
            const scadCode = response.choices[0].message.content.trim();
            
            // Extract parameters from the generated code
            const parameters = this.extractParametersFromCode(scadCode);
            
            // Generate a description based on the prompt and code
            const description = this.generateDescription(scadCode);
            
            return {
                scad_code: scadCode,
                parameters: parameters,
                description: description
            };
        } catch (error) {
            console.error('Error parsing DeepSeek response:', error);
            throw new Error('Failed to parse AI response');
        }
    }
    
    extractParametersFromCode(scadCode) {
        const parameters = [];
        
        // Match variable declarations at the start of the code
        const variableMatches = scadCode.match(/^(\w+)\s*=\s*([\d.]+)\s*;.*$/gm);
        
        if (variableMatches) {
            variableMatches.forEach(match => {
                const [, name, value] = match.match(/^(\w+)\s*=\s*([\d.]+)/);
                if (name && value && !name.includes('$')) {
                    // Determine reasonable min/max based on the parameter name and value
                    const numValue = parseFloat(value);
                    let min = Math.max(1, numValue * 0.2);
                    let max = numValue * 3;
                    
                    // Special cases for common parameter types
                    if (name.toLowerCase().includes('thickness') || name.toLowerCase().includes('wall')) {
                        min = 0.5;
                        max = Math.max(10, numValue * 2);
                    } else if (name.toLowerCase().includes('radius') || name.toLowerCase().includes('diameter')) {
                        min = 1;
                        max = Math.max(100, numValue * 2);
                    } else if (name.toLowerCase().includes('height') || name.toLowerCase().includes('width') || name.toLowerCase().includes('depth')) {
                        min = 5;
                        max = Math.max(200, numValue * 2);
                    }
                    
                    parameters.push({
                        name: name,
                        type: 'number',
                        default: numValue,
                        min: min,
                        max: max
                    });
                }
            });
        }
        
        return parameters;
    }
    
    generateDescription(scadCode) {
        // Generate a description based on the code content
        const lowerCode = scadCode.toLowerCase();
        
        if (lowerCode.includes('baseball') || lowerCode.includes('ball')) {
            return 'Baseball sphere with realistic dimensions';
        } else if (lowerCode.includes('phone') && lowerCode.includes('stand')) {
            return 'Adjustable phone stand';
        } else if (lowerCode.includes('mug') || lowerCode.includes('cup')) {
            return 'Coffee mug with handle';
        } else if (lowerCode.includes('box') || lowerCode.includes('container')) {
            return 'Storage container';
        } else if (lowerCode.includes('gear') || lowerCode.includes('cog')) {
            return 'Mechanical gear';
        } else if (lowerCode.includes('bracket') || lowerCode.includes('mount')) {
            return 'Mounting bracket';
        } else if (lowerCode.includes('vase') || lowerCode.includes('pot')) {
            return 'Decorative vase';
        } else {
            return '3D printable model';
        }
    }
    
    generateMockCADModel(prompt, options = {}) {
        // Enhanced mock generation with more realistic OpenSCAD code
        return new Promise((resolve) => {
            setTimeout(() => {
                const result = this.analyzePromptAndGenerate(prompt);
                resolve(result);
            }, 1500 + Math.random() * 1000);
        });
    }
    
    analyzePromptAndGenerate(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        
        // Sports balls detection
        if (lowerPrompt.includes('baseball')) {
            return this.generateBaseball(prompt);
        }
        if (lowerPrompt.includes('basketball')) {
            return this.generateBasketball(prompt);
        }
        if (lowerPrompt.includes('golf ball') || lowerPrompt.includes('golfball')) {
            return this.generateGolfBall(prompt);
        }
        if (lowerPrompt.includes('tennis ball')) {
            return this.generateTennisBall(prompt);
        }
        
        // Phone stand detection
        if (lowerPrompt.includes('phone') && (lowerPrompt.includes('stand') || lowerPrompt.includes('holder'))) {
            return this.generatePhoneStand(prompt);
        }
        
        // Mug detection
        if (lowerPrompt.includes('mug') || lowerPrompt.includes('cup')) {
            return this.generateMug(prompt);
        }
        
        // Box/container detection
        if (lowerPrompt.includes('box') || lowerPrompt.includes('container') || lowerPrompt.includes('case')) {
            return this.generateBox(prompt);
        }
        
        // Bracket detection
        if (lowerPrompt.includes('bracket') || lowerPrompt.includes('mount')) {
            return this.generateBracket(prompt);
        }
        
        // Gear detection
        if (lowerPrompt.includes('gear') || lowerPrompt.includes('cog')) {
            return this.generateGear(prompt);
        }
        
        // Vase detection
        if (lowerPrompt.includes('vase') || lowerPrompt.includes('pot')) {
            return this.generateVase(prompt);
        }
        
        // Generic ball/sphere detection
        if (lowerPrompt.includes('ball') || lowerPrompt.includes('sphere')) {
            return this.generateBaseball(prompt); // Default to baseball with details
        }
        
        // Default to a customizable box
        return this.generateBox(prompt);
    }
    
    generateBaseball(prompt) {
        const diameter = this.extractValue(prompt, ['diameter', 'size'], 73); // Standard baseball ~73mm
        const stitchDepth = 0.5;
        const stitchWidth = 1.0;
        
        return {
            scad_code: `// Baseball with Stitching - Generated from: "${prompt}"
// Realistic baseball with figure-8 stitching pattern
ball_diameter = ${diameter};
stitch_depth = ${stitchDepth};
stitch_width = ${stitchWidth};
$fn = 64;

module baseball() {
    difference() {
        // Main ball
        sphere(d=ball_diameter);
        
        // Stitching seams - figure-8 pattern
        for (angle = [0:30:330]) {
            rotate([0, 0, angle])
            translate([0, 0, 0])
            rotate([15, 0, 0])
            linear_extrude(height=ball_diameter*2, center=true)
            translate([ball_diameter/2 * sin(angle*2), 0, 0])
            circle(d=stitch_width, $fn=16);
        }
        
        // Cross stitching pattern
        for (i = [0:15]) {
            rotate([0, 0, i*12])
            translate([ball_diameter/2.2, 0, 0])
            rotate([90, 0, 0])
            cylinder(d=stitch_width*0.7, h=ball_diameter/8, center=true, $fn=8);
        }
    }
    
    // Raised stitching lines
    for (angle = [0:60:300]) {
        rotate([0, 0, angle])
        translate([0, 0, 0])
        rotate([10, 0, 0])
        torus(ball_diameter/2.05, stitch_width/4);
    }
}

module torus(major_radius, minor_radius) {
    rotate_extrude($fn=64)
    translate([major_radius, 0, 0])
    circle(r=minor_radius, $fn=16);
}

baseball();`,
            parameters: [
                { name: 'ball_diameter', type: 'number', default: diameter, min: 50, max: 100 },
                { name: 'stitch_depth', type: 'number', default: stitchDepth, min: 0.2, max: 2.0 },
                { name: 'stitch_width', type: 'number', default: stitchWidth, min: 0.5, max: 2.0 }
            ],
            description: `Realistic baseball with stitching (${diameter}mm diameter)`
        };
    }
    
    generateBasketball(prompt) {
        const diameter = this.extractValue(prompt, ['diameter', 'size'], 240); // Standard basketball ~240mm
        const lineDepth = 1.0;
        const lineWidth = 2.0;
        
        return {
            scad_code: `// Basketball with Line Pattern - Generated from: "${prompt}"
// Realistic basketball with curved line patterns
ball_diameter = ${diameter};
line_depth = ${lineDepth};
line_width = ${lineWidth};
$fn = 64;

module basketball() {
    difference() {
        // Main ball
        sphere(d=ball_diameter);
        
        // Horizontal lines
        for (z = [-ball_diameter/3, 0, ball_diameter/3]) {
            translate([0, 0, z])
            rotate_extrude($fn=64)
            translate([ball_diameter/2, 0, 0])
            circle(d=line_width, $fn=16);
        }
        
        // Vertical curved lines
        for (angle = [0:45:315]) {
            rotate([0, 0, angle])
            translate([0, 0, 0])
            rotate([90, 0, 0])
            linear_extrude(height=ball_diameter*2, center=true)
            translate([0, ball_diameter/2, 0])
            circle(d=line_width, $fn=16);
        }
        
        // Surface texture (dimples)
        for (i = [0:360/24:359]) {
            for (j = [-60:30:60]) {
                rotate([j, 0, i])
                translate([ball_diameter/2.1, 0, 0])
                sphere(d=line_width*0.8, $fn=8);
            }
        }
    }
}

basketball();`,
            parameters: [
                { name: 'ball_diameter', type: 'number', default: diameter, min: 150, max: 300 },
                { name: 'line_depth', type: 'number', default: lineDepth, min: 0.5, max: 2.0 },
                { name: 'line_width', type: 'number', default: lineWidth, min: 1.0, max: 4.0 }
            ],
            description: `Realistic basketball with line pattern (${diameter}mm diameter)`
        };
    }
    
    generateGolfBall(prompt) {
        const diameter = this.extractValue(prompt, ['diameter', 'size'], 43); // Standard golf ball ~43mm
        const dimpleDepth = 0.3;
        const dimpleDiameter = 2.5;
        
        return {
            scad_code: `// Golf Ball with Dimples - Generated from: "${prompt}"
// Realistic golf ball with dimple pattern
ball_diameter = ${diameter};
dimple_depth = ${dimpleDepth};
dimple_diameter = ${dimpleDiameter};
$fn = 32;

module golf_ball() {
    difference() {
        // Main ball
        sphere(d=ball_diameter);
        
        // Dimple pattern - hexagonal close packing
        for (phi = [0:20:180]) {
            for (theta = [0:15:345]) {
                rotate([phi, 0, theta])
                translate([ball_diameter/2 - dimple_depth/2, 0, 0])
                sphere(d=dimple_diameter, $fn=16);
            }
        }
        
        // Additional random dimples for realism
        for (i = [0:50]) {
            rotate([rands(0, 180, 1)[0], 0, rands(0, 360, 1)[0]])
            translate([ball_diameter/2 - dimple_depth/2, 0, 0])
            sphere(d=dimple_diameter*0.8, $fn=12);
        }
    }
}

golf_ball();`,
            parameters: [
                { name: 'ball_diameter', type: 'number', default: diameter, min: 35, max: 50 },
                { name: 'dimple_depth', type: 'number', default: dimpleDepth, min: 0.1, max: 1.0 },
                { name: 'dimple_diameter', type: 'number', default: dimpleDiameter, min: 1.5, max: 4.0 }
            ],
            description: `Realistic golf ball with dimples (${diameter}mm diameter)`
        };
    }
    
    generateTennisBall(prompt) {
        const diameter = this.extractValue(prompt, ['diameter', 'size'], 67); // Standard tennis ball ~67mm
        const seamDepth = 0.8;
        const seamWidth = 1.5;
        
        return {
            scad_code: `// Tennis Ball with Curved Seam - Generated from: "${prompt}"
// Realistic tennis ball with characteristic curved seam
ball_diameter = ${diameter};
seam_depth = ${seamDepth};
seam_width = ${seamWidth};
$fn = 64;

module tennis_ball() {
    difference() {
        // Main ball
        sphere(d=ball_diameter);
        
        // Curved seam pattern - tennis ball characteristic
        for (side = [0, 1]) {
            rotate([0, 0, side*180])
            rotate([0, 90, 0])
            rotate_extrude(angle=180, $fn=64)
            translate([ball_diameter/2, 0, 0])
            circle(d=seam_width, $fn=16);
        }
        
        // Fuzzy texture simulation with small indentations
        for (i = [0:360/30:359]) {
            for (j = [-75:15:75]) {
                rotate([j, 0, i])
                translate([ball_diameter/2.05, 0, 0])
                sphere(d=0.5, $fn=6);
            }
        }
    }
}

tennis_ball();`,
            parameters: [
                { name: 'ball_diameter', type: 'number', default: diameter, min: 50, max: 80 },
                { name: 'seam_depth', type: 'number', default: seamDepth, min: 0.3, max: 1.5 },
                { name: 'seam_width', type: 'number', default: seamWidth, min: 1.0, max: 3.0 }
            ],
            description: `Realistic tennis ball with curved seam (${diameter}mm diameter)`
        };
    }
    
    generatePhoneStand(prompt) {
        const dimensions = this.extractDimensions(prompt, { width: 80, depth: 60, height: 20 });
        const angle = this.extractValue(prompt, ['angle', 'tilt'], 15);
        
        return {
            scad_code: `// Phone Stand - Generated from: "${prompt}"
// Adjustable phone stand with customizable dimensions
stand_width = ${dimensions.width};
stand_depth = ${dimensions.depth};
stand_height = ${dimensions.height};
phone_angle = ${angle};
wall_thickness = 3;
phone_slot_width = 12;

module phone_stand() {
    difference() {
        // Main stand body
        hull() {
            cube([stand_width, wall_thickness, stand_height]);
            translate([0, stand_depth, 0])
            cube([stand_width, wall_thickness, stand_height/3]);
        }
        
        // Phone slot
        translate([stand_width/2 - phone_slot_width/2, -1, stand_height - 8])
        cube([phone_slot_width, wall_thickness + 2, 10]);
        
        // Angle cut for phone rest
        translate([0, wall_thickness, stand_height])
        rotate([-phone_angle, 0, 0])
        cube([stand_width, stand_depth, stand_height]);
    }
    
    // Support base
    translate([0, 0, 0])
    cube([stand_width, stand_depth, wall_thickness]);
}

phone_stand();`,
            parameters: [
                { name: 'stand_width', type: 'number', default: dimensions.width, min: 60, max: 120 },
                { name: 'stand_depth', type: 'number', default: dimensions.depth, min: 40, max: 100 },
                { name: 'stand_height', type: 'number', default: dimensions.height, min: 15, max: 40 },
                { name: 'phone_angle', type: 'number', default: angle, min: 0, max: 45 },
                { name: 'wall_thickness', type: 'number', default: 3, min: 2, max: 6 }
            ],
            description: `Adjustable phone stand (${dimensions.width}×${dimensions.depth}×${dimensions.height}mm)`
        };
    }
    
    generateMug(prompt) {
        const height = this.extractValue(prompt, ['height', 'tall'], 100);
        const radius = this.extractValue(prompt, ['width', 'radius', 'diameter'], 40);
        const thickness = this.extractValue(prompt, ['thick', 'wall'], 3);
        
        return {
            scad_code: `// Coffee Mug - Generated from: "${prompt}"
// Customizable coffee mug with handle
cup_height = ${height};
cup_radius = ${radius};
wall_thickness = ${thickness};
handle_radius = 25;
handle_thickness = 8;
base_thickness = 5;

module coffee_mug() {
    difference() {
        union() {
            // Main cup body
            cylinder(h=cup_height, r=cup_radius, $fn=64);
            
            // Handle
            translate([cup_radius-2, 0, cup_height/2])
            rotate([90, 0, 0])
            difference() {
                torus(handle_radius, handle_thickness/2);
                translate([0, 0, -handle_thickness])
                torus(handle_radius, handle_thickness/2 - wall_thickness);
            }
            
            // Base reinforcement
            cylinder(h=base_thickness, r=cup_radius+2, $fn=64);
        }
        
        // Hollow out the cup
        translate([0, 0, wall_thickness])
        cylinder(h=cup_height, r=cup_radius-wall_thickness, $fn=64);
    }
}

module torus(r1, r2) {
    rotate_extrude($fn=64)
    translate([r1, 0, 0])
    circle(r=r2, $fn=32);
}

coffee_mug();`,
            parameters: [
                { name: 'cup_height', type: 'number', default: height, min: 60, max: 150 },
                { name: 'cup_radius', type: 'number', default: radius, min: 25, max: 60 },
                { name: 'wall_thickness', type: 'number', default: thickness, min: 2, max: 6 },
                { name: 'handle_radius', type: 'number', default: 25, min: 15, max: 35 },
                { name: 'handle_thickness', type: 'number', default: 8, min: 6, max: 12 }
            ],
            description: `Coffee mug (${radius*2}mm diameter, ${height}mm height)`
        };
    }
    
    generateBox(prompt) {
        const dimensions = this.extractDimensions(prompt, { width: 50, height: 30, depth: 40 });
        const thickness = this.extractValue(prompt, ['thick', 'wall'], 2);
        const hasLid = prompt.toLowerCase().includes('lid') || prompt.toLowerCase().includes('cover');
        
        return {
            scad_code: `// Storage Box - Generated from: "${prompt}"
// Customizable storage box${hasLid ? ' with lid' : ''}
box_width = ${dimensions.width};
box_height = ${dimensions.height};
box_depth = ${dimensions.depth};
wall_thickness = ${thickness};
corner_radius = 3;

module storage_box() {
    difference() {
        // Outer shell with rounded corners
        minkowski() {
            cube([box_width - corner_radius*2, box_depth - corner_radius*2, box_height]);
            cylinder(r=corner_radius, h=0.01, $fn=16);
        }
        
        // Inner cavity
        translate([wall_thickness, wall_thickness, wall_thickness])
        minkowski() {
            cube([box_width - wall_thickness*2 - corner_radius*2, 
                  box_depth - wall_thickness*2 - corner_radius*2, 
                  box_height]);
            cylinder(r=corner_radius, h=0.01, $fn=16);
        }
    }
}

${hasLid ? `
module box_lid() {
    lid_height = 8;
    lip_depth = 2;
    
    union() {
        // Main lid
        minkowski() {
            cube([box_width - corner_radius*2, box_depth - corner_radius*2, lid_height]);
            cylinder(r=corner_radius, h=0.01, $fn=16);
        }
        
        // Lip that fits inside box
        translate([wall_thickness + 0.2, wall_thickness + 0.2, -lip_depth])
        minkowski() {
            cube([box_width - wall_thickness*2 - corner_radius*2 - 0.4, 
                  box_depth - wall_thickness*2 - corner_radius*2 - 0.4, 
                  lip_depth]);
            cylinder(r=corner_radius-0.2, h=0.01, $fn=16);
        }
    }
}

translate([0, box_depth + 10, 0])
box_lid();
` : ''}

storage_box();`,
            parameters: [
                { name: 'box_width', type: 'number', default: dimensions.width, min: 20, max: 200 },
                { name: 'box_height', type: 'number', default: dimensions.height, min: 10, max: 100 },
                { name: 'box_depth', type: 'number', default: dimensions.depth, min: 20, max: 200 },
                { name: 'wall_thickness', type: 'number', default: thickness, min: 1, max: 5 },
                { name: 'corner_radius', type: 'number', default: 3, min: 1, max: 10 }
            ],
            description: `Storage box (${dimensions.width}×${dimensions.depth}×${dimensions.height}mm)${hasLid ? ' with lid' : ''}`
        };
    }
    
    generateBracket(prompt) {
        const width = this.extractValue(prompt, ['width'], 60);
        const height = this.extractValue(prompt, ['height'], 40);
        const thickness = this.extractValue(prompt, ['thick'], 4);
        
        return {
            scad_code: `// Mounting Bracket - Generated from: "${prompt}"
// L-shaped mounting bracket
bracket_width = ${width};
bracket_height = ${height};
bracket_thickness = ${thickness};
hole_diameter = 5;
hole_spacing = 20;

module mounting_bracket() {
    difference() {
        union() {
            // Vertical part
            cube([bracket_thickness, bracket_width, bracket_height]);
            
            // Horizontal part
            cube([bracket_width, bracket_thickness, bracket_thickness]);
            
            // Reinforcement gusset
            hull() {
                translate([0, 0, 0])
                cube([bracket_thickness, bracket_thickness, bracket_thickness]);
                translate([bracket_width/3, bracket_width/3, bracket_height/3])
                cube([bracket_thickness/2, bracket_thickness/2, bracket_thickness/2]);
            }
        }
        
        // Mounting holes in vertical part
        for(i = [1 : floor((bracket_height - hole_spacing) / hole_spacing)]) {
            translate([-1, bracket_width/2, i * hole_spacing])
            rotate([0, 90, 0])
            cylinder(d=hole_diameter, h=bracket_thickness + 2, $fn=16);
        }
        
        // Mounting holes in horizontal part
        for(i = [1 : floor((bracket_width - hole_spacing) / hole_spacing)]) {
            translate([i * hole_spacing, -1, bracket_thickness/2])
            rotate([-90, 0, 0])
            cylinder(d=hole_diameter, h=bracket_thickness + 2, $fn=16);
        }
    }
}

mounting_bracket();`,
            parameters: [
                { name: 'bracket_width', type: 'number', default: width, min: 30, max: 120 },
                { name: 'bracket_height', type: 'number', default: height, min: 20, max: 80 },
                { name: 'bracket_thickness', type: 'number', default: thickness, min: 3, max: 8 },
                { name: 'hole_diameter', type: 'number', default: 5, min: 3, max: 8 },
                { name: 'hole_spacing', type: 'number', default: 20, min: 15, max: 30 }
            ],
            description: `L-bracket (${width}×${height}×${thickness}mm)`
        };
    }
    
    generateGear(prompt) {
        const teeth = this.extractValue(prompt, ['teeth', 'tooth'], 20);
        const radius = this.extractValue(prompt, ['radius', 'size'], 25);
        const thickness = this.extractValue(prompt, ['thick', 'height'], 5);
        
        return {
            scad_code: `// Gear - Generated from: "${prompt}"
// Parametric gear with involute teeth
gear_teeth = ${teeth};
gear_radius = ${radius};
gear_thickness = ${thickness};
hole_diameter = 6;
pressure_angle = 20;

module involute_gear() {
    difference() {
        gear(number_of_teeth=gear_teeth,
             circular_pitch=360/gear_teeth,
             pressure_angle=pressure_angle,
             clearance=0.2,
             gear_thickness=gear_thickness,
             rim_thickness=gear_thickness,
             rim_width=5,
             hub_thickness=gear_thickness,
             hub_diameter=hole_diameter*3,
             bore_diameter=hole_diameter);
    }
}

// Simplified gear module (basic implementation)
module gear(number_of_teeth, circular_pitch, pressure_angle, clearance, 
           gear_thickness, rim_thickness, rim_width, hub_thickness, 
           hub_diameter, bore_diameter) {
    
    pitch_radius = number_of_teeth * circular_pitch / (2 * PI);
    base_radius = pitch_radius * cos(pressure_angle);
    outer_radius = pitch_radius + (circular_pitch / (2 * PI));
    
    difference() {
        union() {
            // Gear body
            cylinder(r=outer_radius, h=gear_thickness, $fn=number_of_teeth*4);
            
            // Hub
            cylinder(r=hub_diameter/2, h=hub_thickness, $fn=32);
        }
        
        // Center hole
        translate([0, 0, -1])
        cylinder(d=bore_diameter, h=gear_thickness + 2, $fn=16);
        
        // Tooth spaces (simplified)
        for(i = [0 : number_of_teeth-1]) {
            rotate([0, 0, i * 360 / number_of_teeth])
            translate([pitch_radius, 0, -1])
            cylinder(r=circular_pitch/(4*PI), h=gear_thickness + 2, $fn=8);
        }
    }
}

involute_gear();`,
            parameters: [
                { name: 'gear_teeth', type: 'number', default: teeth, min: 8, max: 60 },
                { name: 'gear_radius', type: 'number', default: radius, min: 10, max: 50 },
                { name: 'gear_thickness', type: 'number', default: thickness, min: 2, max: 15 },
                { name: 'hole_diameter', type: 'number', default: 6, min: 3, max: 15 },
                { name: 'pressure_angle', type: 'number', default: 20, min: 14.5, max: 25 }
            ],
            description: `${teeth}-tooth gear (R${radius}mm, ${thickness}mm thick)`
        };
    }
    
    generateVase(prompt) {
        const height = this.extractValue(prompt, ['height', 'tall'], 120);
        const bottomRadius = this.extractValue(prompt, ['bottom', 'base'], 30);
        const topRadius = this.extractValue(prompt, ['top', 'opening'], 25);
        const thickness = this.extractValue(prompt, ['thick', 'wall'], 2);
        
        return {
            scad_code: `// Decorative Vase - Generated from: "${prompt}"
// Tapered vase with smooth curves
vase_height = ${height};
bottom_radius = ${bottomRadius};
top_radius = ${topRadius};
wall_thickness = ${thickness};
segments = 64;

module decorative_vase() {
    difference() {
        // Outer shape
        hull() {
            cylinder(r=bottom_radius, h=5, $fn=segments);
            translate([0, 0, vase_height])
            cylinder(r=top_radius, h=5, $fn=segments);
        }
        
        // Inner cavity
        translate([0, 0, wall_thickness])
        hull() {
            cylinder(r=bottom_radius-wall_thickness, h=5, $fn=segments);
            translate([0, 0, vase_height-wall_thickness])
            cylinder(r=top_radius-wall_thickness, h=5, $fn=segments);
        }
        
        // Decorative rings (optional)
        for(z = [vase_height*0.3, vase_height*0.6, vase_height*0.8]) {
            translate([0, 0, z])
            rotate_extrude($fn=segments)
            translate([bottom_radius + (top_radius-bottom_radius)*z/vase_height, 0, 0])
            circle(r=1, $fn=8);
        }
    }
}

decorative_vase();`,
            parameters: [
                { name: 'vase_height', type: 'number', default: height, min: 60, max: 200 },
                { name: 'bottom_radius', type: 'number', default: bottomRadius, min: 20, max: 60 },
                { name: 'top_radius', type: 'number', default: topRadius, min: 15, max: 50 },
                { name: 'wall_thickness', type: 'number', default: thickness, min: 1.5, max: 4 },
                { name: 'segments', type: 'number', default: 64, min: 32, max: 128 }
            ],
            description: `Decorative vase (${height}mm tall, ${bottomRadius}→${topRadius}mm)`
        };
    }
    
    extractDimensions(prompt, defaults) {
        const dimensions = { ...defaults };
        
        // Extract width
        const widthMatch = prompt.match(/(\d+)\s*(mm|cm)?\s*(wide|width)/i);
        if (widthMatch) {
            dimensions.width = parseInt(widthMatch[1]) * (widthMatch[2] === 'cm' ? 10 : 1);
        }
        
        // Extract height
        const heightMatch = prompt.match(/(\d+)\s*(mm|cm)?\s*(tall|high|height)/i);
        if (heightMatch) {
            dimensions.height = parseInt(heightMatch[1]) * (heightMatch[2] === 'cm' ? 10 : 1);
        }
        
        // Extract depth
        const depthMatch = prompt.match(/(\d+)\s*(mm|cm)?\s*(deep|depth)/i);
        if (depthMatch) {
            dimensions.depth = parseInt(depthMatch[1]) * (depthMatch[2] === 'cm' ? 10 : 1);
        }
        
        return dimensions;
    }
    
    extractValue(prompt, keywords, defaultValue) {
        for (const keyword of keywords) {
            const regex = new RegExp(`(${keyword})\\s*:?\\s*(\\d+)`, 'i');
            const match = prompt.match(regex);
            if (match) {
                return parseInt(match[2]);
            }
        }
        return defaultValue;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Method to enable DeepSeek API integration
    setAPIKey(apiKey) {
        this.apiKey = apiKey;
        this.mockMode = false;
        this.isConnected = true;
        console.log('AI Service: DeepSeek V3.1 integration enabled');
        window.cadCreator.showToast('DeepSeek AI enabled!', 'success');
    }
    
    // Check if API is configured
    isConfigured() {
        return !this.mockMode && this.apiKey;
    }
    
    // Get current status
    getStatus() {
        if (this.isConfigured()) {
            return 'Connected to DeepSeek V3.1-Terminus';
        } else {
            return 'Using mock mode - Add API key in Settings';
        }
    }
}

// Export global AI service instance
window.aiService = new AIService();
