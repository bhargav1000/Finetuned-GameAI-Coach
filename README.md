# Vibe Code - Adaptive Game AI

This project is an advanced **AI fighting game** built with Phaser 3 featuring two Q-learning AI agents battling each other. The game demonstrates sophisticated reinforcement learning in a real-time combat environment with comprehensive animation, physics, and data collection systems.

## Features

- **Dual AI Agents**: Hero and Purple Knight both controlled by Q-learning algorithms
- **Real-time Learning**: AI adapts and improves combat strategies during gameplay
- **Advanced Combat System**: Multiple attack types, blocking, stamina management, and armor
- **113 Directional Animations**: Complete 8-directional animation set for immersive combat
- **Physics-based Combat**: Matter.js integration with collision detection and anti-push systems
- **Data Collection**: ChromaDB integration with screenshot capture and event logging
- **Training Data Generation**: Automated creation of 11,741+ instruction-following examples for AI model fine-tuning
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

- **Modern web browser** (Chrome, Firefox, Safari, Edge)
- **Python 3.8+** (for backend and AI features)
- **Node.js** (optional, for npm-based development)

## Installation

### Complete Setup (Recommended)

Install all dependencies for the full experience:
```bash
pip install -r requirements.txt
```

This includes:
- 🎮 **Game backend** (FastAPI, ChromaDB)
- 🤖 **AI training** (transformers, PEFT, LoRA) 
- 📊 **Data processing** (numpy, scipy, scikit-learn)
- 📈 **Progress visualization** (tqdm)
- 🔧 **Utilities** (packaging, websockets)

### Enhanced Performance (Optional)

For 2x faster fine-tuning and 50% less memory usage:
```bash
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
```

### Compatibility Check

If you encounter issues with Phi-3.5 fine-tuning:
```bash
python fix_phi_compatibility.py
```

### Platform Notes

**Apple Silicon Macs (M1/M2/M3):**
- ✅ MPS acceleration automatically detected
- ✅ All dependencies Mac compatible
- ✅ No CUDA requirements

**NVIDIA GPUs:**
- ✅ CUDA acceleration automatic
- ✅ 4-bit quantization supported
- 🔧 Optional: flash-attn for extra performance

**CPU Only:**
- ✅ All features work on CPU
- ⚠️ Training will be slower
- 💡 Consider cloud GPU for fine-tuning

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

Dependencies are already installed if you ran the installation above.

Start the AI bridge server:
```bash
python game_event_microservice/ai_bridge_fastapi.py
```

The backend runs on `http://localhost:8765` and provides:
- Screenshot capture and storage
- Game event logging to ChromaDB
- Semantic search capabilities for game analysis

### 3. Training Data Generation (Optional - for AI assistant development)

Generate comprehensive training datasets from collected gameplay data:
```bash
python generate_training_data.py
```

This creates:
- **11,741+ training examples** in instruction-following format
- **Tactical analysis** for each game state
- **Strategic recommendations** based on historical win/loss patterns
- **Model-ready datasets** for fine-tuning AI assistants

### 4. Fine-tune AI Model (Optional - for AI assistant)

Fine-tune a Phi-3.5 model using your collected training data:
```bash
python finetune_phi_model.py
```

This will:
- 📥 Download Phi-3.5-mini-instruct model
- 🔧 Apply LoRA fine-tuning with your 11,741+ examples
- 💾 Save fine-tuned model for tactical advice generation
- 🧪 Test model with sample game scenarios

**Hardware Requirements:**
- **Recommended**: 8GB+ VRAM (NVIDIA/AMD) or Apple Silicon Mac
- **Minimum**: 16GB+ RAM for CPU-only training

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
├── training_data/           # Generated training datasets
│   ├── [session_folders]/   # Screenshots, metadata, training data
│   └── summary/             # Aggregated datasets and statistics
├── generate_training_data.py # Training data generation script
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
- **AI assistant training** using gameplay data for strategic coaching models

## Training Data Features

### Generated Dataset Statistics
- **11,741 training examples** from 134 game sessions
- **99.3% hero win rate** providing winning strategy patterns
- **Multi-phase coverage**: Early game, mid game, critical moments, endgame
- **Tactical depth**: Health management, stamina optimization, positioning advice

### AI Assistant Training Format
Each training example includes:
```json
{
  "instruction": "You are an expert fighting game coach. Analyze this game state and provide tactical advice for the hero player.",
  "input": "Hero: 73% HP, 69% stamina, unsheath-s. Knight: 0% HP, 24% stamina, die. Distance: close, Phase: game_over",
  "output": "You have a significant health advantage! Control the pace"
}
```

### Model Compatibility
The training dataset is optimized for fine-tuning:
- **Phi-3.5 Mini Instruct** (3.8B parameters)
- **Llama 3.1 8B Instruct** (8B parameters)  
- **Mistral 7B Instruct** (7B parameters)
- Other instruction-following language models