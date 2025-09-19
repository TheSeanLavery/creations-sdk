# Overview

This project is the **Creations SDK** - a development toolkit for building interactive applications for the R1 device's unique 240x282 pixel screen. The repository includes demonstration applications showcasing hardware integration capabilities, QR code generation utilities, and a bouncing ball game. The primary focus is on testing and demonstrating R1 device-specific features like hardware button controls, accelerometer data, LLM integration, and text-to-speech functionality.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The project uses a **static file server approach** with vanilla HTML, CSS, and JavaScript applications optimized for the R1's constrained viewport (240x282px). The architecture follows these key patterns:

- **Single Page Applications (SPAs)**: Each demo uses client-side navigation without page refreshes
- **Viewport-relative sizing**: All UI elements use `vw` units instead of fixed pixels for responsive scaling
- **Hardware-optimized CSS**: Emphasis on `transform` and `opacity` properties for hardware acceleration
- **Minimal DOM operations**: Lightweight JavaScript to accommodate the R1's limited hardware resources

## Backend Architecture
The backend consists of a **minimal Node.js static file server** (`server.js`) that serves multiple applications through directory mounting:

- `/public` - Host application with iframe for plugin demonstration
- `/plugin-demo` - Main SDK demonstration application
- `/ball` - Bouncing ball game built with Vite
- **No database**: All applications are client-side with no persistent server-side state

## Core SDK Integration
Applications integrate with the **R1 Creations SDK** through several JavaScript APIs:

- **PluginMessageHandler**: Bidirectional communication with R1 system and LLM
- **Hardware Event System**: Custom events for scroll wheel (`scrollUp`/`scrollDown`) and side button (`sideClick`)
- **Accelerometer API**: Real-time motion sensor data access
- **Storage APIs**: Secure and insecure local storage capabilities

## Design Constraints
The architecture is specifically designed around R1 hardware limitations:

- **Fixed viewport**: 240x282 pixels portrait orientation
- **Performance optimization**: Minimal particle effects, CSS transitions over JavaScript animations
- **Touch-first design**: 44x44 pixel minimum touch targets
- **High contrast theming**: Black background with white text and orange (#FE5F00) accents

# External Dependencies

## Core Dependencies
- **Node.js HTTP module**: Static file serving
- **QRCode library**: QR code generation functionality for the `/qr` utility

## R1 Device Integration
- **PluginMessageHandler**: R1 system messaging interface
- **Hardware Event System**: R1-specific scroll wheel and side button events
- **Accelerometer API**: R1 motion sensor integration
- **LLM Integration**: R1's built-in language model for AI-powered responses

## Development Tools
- **Vite**: Build system for the bouncing ball game application
- **Modern Browser APIs**: Camera, microphone, and speaker access through standard web APIs

## Notable Architecture Decisions
- **No frameworks**: Vanilla JavaScript approach for minimal overhead on constrained hardware
- **Static hosting**: No server-side processing reduces complexity and resource usage
- **Iframe embedding**: Host page uses iframe to demonstrate plugin integration patterns
- **Multiple app structure**: Separate demonstration applications for different SDK features