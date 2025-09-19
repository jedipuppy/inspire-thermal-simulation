# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

All development commands should be run from the `app/` directory:

- `npm install` - Install dependencies (run after pulling changes)
- `npm run dev` - Start Vite development server at http://localhost:5173 with hot reload
- `npm run build` - Build for production (TypeScript compilation + Vite bundling)
- `npm run lint` - Run ESLint checks (run before committing)
- `npm run preview` - Preview production build locally

## Project Architecture

This is a thermal simulation web application built with React + TypeScript + Vite.

### Core Structure

- **`app/src/App.tsx`** - Main application component orchestrating the UI and React Flow graph
- **`app/src/simulation.ts`** - Core thermal solver implementing Euler method for heat transfer calculations
- **`app/inspire.json`** - Default thermal network configuration with sample nodes and edges
- **`app/src/types/`** - TypeScript type definitions, including Plotly.js patches

### Key Technologies

- **React Flow** - Interactive node/edge graph for thermal network visualization
- **Plotly.js** - Temperature vs time plotting and visualization
- **Vite** - Build tool and development server
- **TypeScript** - Type safety throughout the application

### Application Flow

1. Users create thermal nodes with properties (name, initial temperature, heat capacity, boundary conditions)
2. Nodes are connected with thermal conductance edges using React Flow interface
3. Simulation settings (time step, total time) are configured
4. Thermal simulation runs using Euler method in `simulation.ts`
5. Results are visualized with Plotly.js showing temperature evolution over time

### Configuration Notes

- `inspire.json` contains sample thermal network data that loads on startup
- Style configurations are stored in `app/src/style-config.json`
- ESLint configuration is in `app/eslint.config.js`
- All development should maintain the existing 2-space indentation style

### Architecture Principles

- Thermal nodes support both free and fixed-temperature boundary conditions
- Simulation uses explicit Euler integration for thermal network solving
- React Flow provides drag-and-drop node positioning and edge creation
- State management is handled through React hooks without external state libraries