# Vibe Code - Adaptive Game AI

This project is an advanced **AI fighting game** built with Phaser 3 featuring two Q-learning AI agents battling each other. The game demonstrates sophisticated reinforcement learning in a real-time combat environment with comprehensive animation, physics, and data collection systems.

## Features

- **Dual AI Agents**: Hero and Purple Knight both controlled by Q-learning algorithms
- **Real-time Learning**: AI adapts and improves combat strategies during gameplay
- **Advanced Combat System**: Multiple attack types, blocking, stamina management, and armor
- **113 Directional Animations**: Complete 8-directional animation set for immersive combat
- **Physics-based Combat**: Matter.js integration with collision detection and anti-push systems
- **Data Collection**: ChromaDB integration with screenshot capture and event logging
- **Debug Tools**: Real-time Q-value visualization and combat statistics

## Game Components

### AI System
- **Q-Learning Agents**: Both knights use reinforcement learning to improve combat performance
- **Distance-Closing Behavior**: AI prioritizes aggressive engagement over defensive play
- **Dynamic Action Selection**: Context-aware decision making based on distance, health, and opponent state
- **Configurable Parameters**: JSON-based learning rate, epsilon decay, and reward tuning

### Combat Mechanics
- **Multi-layered Attack System**: Melee, special attacks, kicks with wind-up and hit detection
- **Directional Blocking**: 120-degree frontal arc blocking with stamina costs
- **Armor & Durability**: Helmet, breastplate, greaves with damage-over-time degradation
- **Health & Stamina**: Resource management affecting combat capabilities

### Technical Features
- **Anti-Push Physics**: Robust collision system preventing character displacement
- **Predictive Movement**: Future position calculation to prevent physics exploits
- **Animation Consistency**: Global timing control without frame-rate overrides
- **Data Persistence**: Q-table saving/loading for continuous learning

## Prerequisites

To run this game, you will need a modern web browser and a way to serve the files locally. You'll also need to run the optional backend for data collection.

## Quick Start

### 1. Frontend Setup (Required)

**Option A: Using npm (Recommended)**
```bash
npm install
npm run dev
```
Navigate to `http://localhost:5173`

**Option B: Using npx**
```bash
npx http-server
```
Navigate to `http://localhost:8080`

**Option C: Using Python**
```bash
python3 -m http.server
```
Navigate to `http://localhost:8000`

### 2. Backend Setup (Optional - for data collection)

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Start the AI bridge server:
```bash
python game_event_microservice/ai_bridge_fastapi.py
```

The backend runs on `http://localhost:8765` and provides:
- Screenshot capture and storage
- Game event logging to ChromaDB
- Semantic search capabilities for game analysis

## Game Interface

### AI-Controlled Combat
The game runs **completely autonomously** - both knights are controlled by AI agents that learn and adapt their fighting strategies in real-time. No manual input is required for gameplay.

### Debug Controls
- **X**: Toggle collision boundary visualization
- **F2**: Toggle physics body debug display
- **P**: Manual screenshot capture

### Debug Panels
- **Q-Learning Panel** (right side): Real-time Q-values for knight actions
- **Events Panel** (bottom): Live combat event log
- **Health/Stamina Bars**: Visual representation of knight status

## AI Configuration

### Learning Parameters
Modify `heroknight.json` and `pknight.json` to adjust:
- **learningRate**: How quickly AI adapts (0.05-0.1)
- **discountFactor**: Future reward importance (0.9)
- **epsilonStart/Min**: Exploration vs exploitation balance
- **decaySteps**: Learning progression rate

### Combat Behavior
The AI system includes:
- **Distance-based decision making**: Different strategies for close/medium/far combat
- **Aggressive bias**: Heavy penalties for passive behavior
- **Contextual rewards**: Bonuses for situationally appropriate actions
- **Continuous learning**: Q-tables persist between sessions

## Project Structure

```
Vibe-Code-Adaptive-Game-AI/
├── src/
│   ├── main.js              # Core game logic and AI
│   └── RL.js                # Q-learning implementation
├── assets/
│   ├── character/           # 14 animation spritesheets
│   └── map/                 # Arena and environment assets
├── game_event_microservice/
│   └── ai_bridge_fastapi.py # Data collection backend
├── heroknight.json          # Hero AI configuration
├── pknight.json            # Purple knight AI configuration
└── index.html              # Game interface with debug panels
```

## Research Applications

This project demonstrates:
- **Multi-agent reinforcement learning** in competitive environments
- **Real-time learning** with immediate strategy adaptation
- **Behavioral analysis** through comprehensive data collection
- **Physics-based AI** with realistic movement and collision constraints