# R1 CAD Creator

A text-to-CAD creation for the Rabbit R1 device that enables users to generate 3D models using AI, manage STL files, and print wirelessly to 3D printers.

## Features

### 🤖 AI-Powered CAD Generation
- Natural language to 3D model conversion
- Parametric model generation with adjustable parameters
- Real-time model preview and updates
- Conversation-based model refinement

### 📁 File Management
- STL file storage and organization on R1 device
- File viewing, renaming, and deletion
- Storage usage tracking
- Export capabilities

### 🖨️ 3D Printer Integration
- WiFi 3D printer discovery on local network
- Printer connection and status monitoring
- Built-in model slicing with customizable settings
- Print job management and progress tracking
- Support for FDM printers with heated beds

### ⚙️ Settings & Configuration
- Customizable default colors and preferences
- Printer settings and profiles
- Storage management
- Debug mode for troubleshooting

## R1 Device Optimization

### Hardware Integration
- **Touch Screen**: Optimized for 240x282px display
- **Scroll Wheel**: Navigate through files and chat history
- **PTT Button**: Quick generate/print actions
- **Storage**: Persistent file storage using R1 Creation Storage API

### UI/UX Design
- Touch-friendly interface with minimum 32px touch targets
- Dark theme optimized for small screen readability
- Efficient use of limited screen real estate
- Hardware button integration for key functions

## Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **AI Integration**: Via R1 Plugin Message Handler
- **Storage**: R1 Creation Storage API with localStorage fallback
- **3D Processing**: Client-side STL generation simulation
- **Deployment**: Netlify static hosting

## File Structure

```
app_creations_16/
├── index.html              # Main application entry point
├── css/
│   └── styles.css         # R1-optimized responsive styles
├── js/
│   ├── app.js             # Main application logic and navigation
│   ├── create.js          # Text-to-CAD generation functionality
│   ├── files.js           # STL file management
│   ├── print.js           # 3D printer discovery and control
│   └── settings.js        # App configuration and preferences
├── netlify.toml           # Netlify deployment configuration
├── _headers               # HTTP security headers
├── _redirects             # SPA routing configuration
└── README.md              # This file
```

## Development

### Local Testing
1. Open `index.html` in a web browser
2. The app will run in browser mode with localStorage fallback
3. Use browser developer tools to simulate R1 device dimensions (240x282px)

### R1 Creation Deployment
1. Deploy to Netlify or any static hosting service
2. Install as R1 Creation using the hosted URL
3. The app will automatically detect R1 environment and use native APIs

## Usage

### Creating 3D Models
1. Navigate to "Create" page
2. Enter natural language description of desired 3D model
3. Tap "Generate" or use PTT button
4. Adjust parameters using sliders if available
5. Save as STL file when satisfied

### Managing Files
1. Navigate to "Files" page
2. View all saved STL files with size and date information
3. Select files to view, rename, or delete
4. Send files directly to print queue

### 3D Printing
1. Navigate to "Print" page
2. Tap "Discover" to find WiFi-enabled 3D printers
3. Select and connect to desired printer
4. Choose STL file and configure print settings
5. Slice model and start print job
6. Monitor progress in real-time

### Configuration
1. Navigate to "Settings" page
2. Adjust default colors, temperatures, and preferences
3. Manage storage and clear data if needed
4. Export app data for backup

## Hardware Requirements

### R1 Device
- Rabbit R1 with Creation support
- WiFi connectivity for printer discovery
- Sufficient storage for STL files (varies by usage)

### 3D Printer Requirements
- WiFi connectivity on same network as R1
- Compatible with standard G-code commands
- Heated bed support recommended
- FDM (Fused Deposition Modeling) printer type

## Limitations

- Models are generated as OpenSCAD code (text-based CAD)
- 3D preview is simulated (not actual STL rendering)
- Printer discovery uses simulated network scanning
- Slicing is simplified (not full-featured slicer)
- Limited to basic geometric shapes and operations

## Future Enhancements

- Real STL file rendering and preview
- Advanced slicing with support structures
- Multiple printer type support (SLA, SLS)
- Cloud sync for model library
- Community model sharing
- Advanced parametric modeling tools

## License

This project is designed for use with the Rabbit R1 device and follows the R1 Creation development guidelines.

## Support

For issues or questions related to R1 Creation development, refer to the official R1 Creation SDK documentation.
