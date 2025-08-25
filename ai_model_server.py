#!/usr/bin/env python3
"""
AI Model Server for Vibe Code Fighting Game Demo

This server hosts the fine-tuned Phi-3.5 model and provides tactical suggestions.
Runs separately from the data collection bridge to maintain separation of concerns.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict
import uvicorn
import os
import torch
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Fighting Coach", 
    description="Fine-tuned Phi-3.5 Model Server for Tactical Suggestions",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variables
model = None
tokenizer = None
device = None
MODEL_LOADED = False

class AISuggestionRequest(BaseModel):
    game_state: str
    timestamp: int

class AISuggestionResponse(BaseModel):
    suggestion: str
    confidence: str
    timestamp: int
    status: str
    model_used: str

def detect_device():
    """Detect best available device for inference"""
    # Prioritize MPS for Apple Silicon
    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        print("🍎 Using MPS (Metal Performance Shaders) for Apple Silicon")
        return "mps"
    # Fall back to CUDA if available
    elif torch.cuda.is_available():
        print("🖥️ Using CUDA for NVIDIA GPU")
        return "cuda"
    # CPU as last resort
    else:
        print("⚠️ No GPU acceleration available, using CPU (slower)")
        return "cpu"

def load_model():
    """Load the fine-tuned Phi-3.5 model"""
    global model, tokenizer, device, MODEL_LOADED
    
    try:
        device = detect_device()
        logger.info(f"🖥️ Using device: {device}")
        
        # Try to load fine-tuned model first
        model_path = "model/fine_tuned"
        if os.path.exists(model_path):
            logger.info(f"📥 Loading fine-tuned model from {model_path}")
            
            # Import here to avoid dependency issues if transformers not installed
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            # Load tokenizer and model
            tokenizer = AutoTokenizer.from_pretrained(model_path)
            
            # Configure model loading based on device
            if device == "mps":
                # MPS-specific configuration for Apple Silicon
                logger.info("🍎 Configuring model for MPS (Apple Silicon)")
                model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    torch_dtype=torch.float16,  # Using float16 as specified in finetune_phi_model.py
                    low_cpu_mem_usage=True
                )
                # Move model to MPS device
                model = model.to(device)
                
            elif device == "cuda":
                # CUDA configuration for NVIDIA GPUs
                logger.info("🖥️ Configuring model for CUDA (NVIDIA GPU)")
                model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    torch_dtype=torch.float16,
                    device_map="auto",
                    low_cpu_mem_usage=True
                )
                
            else:
                # CPU fallback
                logger.info("⚠️ Configuring model for CPU (slower)")
                model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=True
                )
                model = model.to(device)
            
            model.eval()  # Set to evaluation mode
            MODEL_LOADED = True
            logger.info("✅ Fine-tuned model loaded successfully!")
            
        else:
            logger.warning(f"❌ Fine-tuned model not found at {model_path}")
            logger.info("🔄 Falling back to rule-based suggestions")
            
    except Exception as e:
        logger.error(f"❌ Error loading model: {str(e)}")
        logger.info("🔄 Falling back to rule-based suggestions")

def generate_model_suggestion(game_state: str) -> tuple[str, str]:
    """Generate suggestion using fine-tuned model"""
    if not MODEL_LOADED or model is None or tokenizer is None:
        raise Exception("Model not loaded")
    
    try:
        # Format the prompt for Phi-3.5 with enhanced instructions
        prompt = f"""<|system|>
You are an expert sword-fighting coach providing real-time tactical advice during combat. Analyze the game state and give ONE specific, actionable tip.

Focus on:
- Health/stamina management when critical
- Combat timing and positioning
- Counter-attack opportunities
- Defensive strategies when overwhelmed
- Finishing moves when enemy is weak

Be concise but specific. Use action words. Prioritize survival over aggression when health is low.<|end|>
<|user|>
Current battle situation: {game_state}

What's the best tactical move right now?<|end|>
<|assistant|>
"""
        
        # Tokenize input
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate response with device-specific handling
        with torch.no_grad():
            if device == "mps":
                # MPS-specific handling
                try:
                    # Use float16 for MPS as specified in finetune_phi_model.py
                    with torch.autocast(device_type="mps", dtype=torch.float16):
                        outputs = model.generate(
                            **inputs,
                            max_new_tokens=64,
                            temperature=0.7,
                            do_sample=True,
                            pad_token_id=tokenizer.eos_token_id,
                            eos_token_id=tokenizer.eos_token_id,
                        )
                except Exception as mps_error:
                    # Fall back to standard generation if autocast fails
                    logger.warning(f"MPS autocast failed: {str(mps_error)}. Falling back to standard generation.")
                    outputs = model.generate(
                        **inputs,
                        max_new_tokens=64,
                        temperature=0.7,
                        do_sample=True,
                        pad_token_id=tokenizer.eos_token_id,
                        eos_token_id=tokenizer.eos_token_id,
                    )
            else:
                # Standard generation for CUDA/CPU
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=64,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id,
                    eos_token_id=tokenizer.eos_token_id,
                )
        
        # Decode response - keep special tokens to preserve structure
        response = tokenizer.decode(outputs[0], skip_special_tokens=False)
        print("DEBUG RESPONSE: ", response)
        
        # Extract just the assistant's response with refined logic based on actual output
        suggestion = ""
        
        # The response format is: ...question?<|end|><|assistant|> ACTUAL_SUGGESTION<|end|><|endoftext|>
        # Extract everything between <|assistant|> and the first <|end|> after it
        if "<|assistant|>" in response:
            # Split on <|assistant|> and take the part after it
            assistant_part = response.split("<|assistant|>", 1)[-1]
            
            # Now extract everything before the first <|end|> tag
            if "<|end|>" in assistant_part:
                suggestion = assistant_part.split("<|end|>", 1)[0]
            else:
                # If no <|end|>, take everything until <|endoftext|>
                if "<|endoftext|>" in assistant_part:
                    suggestion = assistant_part.split("<|endoftext|>", 1)[0]
                else:
                    suggestion = assistant_part
        
        # Fallback: if no <|assistant|> tag found, try after the question
        if not suggestion and "What's the best tactical move right now?<|end|>" in response:
            parts = response.split("What's the best tactical move right now?<|end|>", 1)
            if len(parts) > 1:
                suggestion = parts[1]
        
        # Clean up the suggestion by removing any remaining special tokens
        suggestion = suggestion.replace("<|assistant|>", "")
        suggestion = suggestion.replace("<|end|>", "")
        suggestion = suggestion.replace("<|endoftext|>", "")
        suggestion = suggestion.replace("<|user|>", "")
        suggestion = suggestion.replace("<|system|>", "")
        suggestion = suggestion.strip()
        
        # Remove any remaining newlines and extra spaces
        suggestion = ' '.join(suggestion.split())
        
        # Ensure it's not empty and not just punctuation
        if not suggestion or suggestion.lower() in ["no tip", "no tip.", ".", "!", "?"]:
            raise Exception("Empty or invalid model response")
        
        return suggestion, "High"
        
    except Exception as e:
        logger.error(f"Model inference failed: {str(e)}")
        raise

def generate_tactical_suggestion(game_state: str) -> tuple[str, str]:
    """Generate advanced tactical suggestions based on comprehensive game state analysis"""
    state = game_state.lower()
    
    # Parse detailed game state
    hero_health = extract_percentage(state, "hero:")
    knight_health = extract_percentage(state, "knight:")
    hero_stamina = extract_stamina(state, "hero")
    knight_stamina = extract_stamina(state, "knight")
    distance = extract_distance(state)
    phase = extract_phase(state)
    
    # Advanced combat analysis
    hero_attacking = "hero attacking" in state or "hero action: attack" in state
    knight_attacking = "knight attacking" in state or "purple attacking" in state
    hero_blocking = "hero blocking" in state
    knight_blocking = "knight blocking" in state or "purple blocking" in state
    
    # CRITICAL HEALTH SITUATIONS (Priority 1)
    if hero_health and hero_health <= 20:
        if hero_stamina and hero_stamina > 50:
            return "What's the best tactical move right now? 🚨 CRITICAL! Health dangerously low. Use stamina for defensive rolls and blocks. Avoid direct confrontation!", "Critical"
        else:
            return "What's the best tactical move right now? 💀 DIRE SITUATION! Low health AND stamina. Play extremely defensively. Look for hit-and-run opportunities only.", "Critical"
    
    if knight_health and knight_health <= 25:
        if hero_stamina and hero_stamina > 40:
            return "What's the best tactical move right now? 🎯 FINISH HIM! Enemy critically wounded. Use heavy attacks (melee2/special) for the kill shot!", "Critical"
        else:
            return "What's the best tactical move right now? ⚡ Enemy weakened but manage stamina! Use basic attacks to finish safely without exhausting yourself.", "High"
    
    # STAMINA CRISIS MANAGEMENT (Priority 2)
    if hero_stamina and hero_stamina <= 20:
        if distance == "close" and knight_attacking:
            return "What's the best tactical move right now? 🔋 STAMINA CRISIS! Enemy attacking at close range. Emergency dodge/roll to create space, then recover stamina!", "Critical"
        else:
            return "What's the best tactical move right now? ⚠️ Low stamina! Avoid ALL heavy actions. Maintain distance and let stamina regenerate. Block only if necessary.", "High"
    
    # TACTICAL COMBAT SCENARIOS (Priority 3)
    if distance == "close":
        if knight_attacking and hero_stamina and hero_stamina > 30:
            if knight_stamina and knight_stamina < 40:
                return "What's the best tactical move right now? ⚔️ Counter-attack opportunity! Enemy attacking but low stamina. Block then immediately counter with melee combo!", "High"
            else:
                return "What's the best tactical move right now? 🛡️ Under attack! Enemy has good stamina. Focus on blocking and look for opening after their combo ends.", "High"
        elif not hero_attacking and hero_stamina and hero_stamina > 50:
            return "What's the best tactical move right now? 🥊 Prime attack position! You have stamina advantage. Initiate aggressive melee combo before they recover!", "High"
        elif hero_blocking and knight_stamina and knight_stamina < 30:
            return "What's the best tactical move right now? 💪 Perfect defense! Enemy low stamina. They'll tire soon - prepare counter-attack when they stop.", "Medium"
    
    elif distance == "medium":
        if hero_stamina and hero_stamina > 60:
            return "What's the best tactical move right now? 🏃 Optimal engagement distance! Rush in with movement + immediate attack combo. Strike before they can react!", "High"
        elif knight_health and knight_health > 70 and hero_health and hero_health < 50:
            return "What's the best tactical move right now? ⚖️ Disadvantaged position. Use hit-and-run tactics. Close distance, single attack, then retreat to medium range.", "Medium"
        else:
            return "What's the best tactical move right now? 🎯 Medium range advantage! Control the engagement. Move closer when they're recovering, back off when they attack.", "Medium"
    
    elif distance == "far":
        if phase == "critical":
            return "What's the best tactical move right now? 🏃💨 Critical phase - no time to waste! Sprint directly toward enemy. Every second counts!", "High"
        elif hero_stamina and hero_stamina > 80:
            return "What's the best tactical move right now? 🚀 Full stamina at distance! Perfect setup for surprise rush attack. Sprint in and unleash full combo!", "High"
        else:
            return "What's the best tactical move right now? 📍 Too far for effective combat. Move closer while managing stamina. Save energy for the actual fight.", "Medium"
    
    # ADVANCED TACTICAL PATTERNS
    if hero_stamina and knight_stamina:
        stamina_advantage = hero_stamina - knight_stamina
        if stamina_advantage > 30:
            return "What's the best tactical move right now? 💪 STAMINA ADVANTAGE! Enemy exhausted. Press aggressive attack - they can't block or dodge effectively!", "High"
        elif stamina_advantage < -30:
            return "What's the best tactical move right now? 🛡️ Stamina disadvantage! Play defensive. Let them waste energy attacking, then counter when they're tired.", "Medium"
    
    # PHASE-SPECIFIC ADVANCED TACTICS
    if phase == "early_game":
        return "What's the best tactical move right now? 🎯 Early game - gather intelligence! Test their reaction patterns with single attacks. Learn their defensive habits.", "Medium"
    elif phase == "mid_game":
        if hero_health and knight_health and abs(hero_health - knight_health) < 20:
            return "What's the best tactical move right now? ⚖️ Even match! Focus on stamina efficiency. Win through better resource management, not just damage.", "Medium"
    elif phase == "critical":
        return "What's the best tactical move right now? ⚠️ CRITICAL ENDGAME! Calculated risks only. One mistake could end it. Focus on guaranteed hits over flashy combos.", "Critical"
    
    # SITUATIONAL AWARENESS
    if knight_blocking and hero_stamina and hero_stamina > 40:
        return "What's the best tactical move right now? 🔄 Enemy blocking! Don't waste attacks. Move to their side/back for angle attack, or wait for block to drop.", "Medium"
    
    if not hero_attacking and not knight_attacking and distance == "close":
        return "What's the best tactical move right now? ⚡ Standoff situation! Whoever attacks first has advantage. Be ready to counter or strike first!", "Medium"
    
    # DEFAULT TACTICAL ANALYSIS
    return "What's the best tactical move right now? 🧠 Analyze current situation: Check health/stamina ratios, maintain optimal distance, and look for opponent weaknesses.", "Low"

def extract_percentage(text: str, prefix: str) -> int:
    """Extract percentage value after a given prefix"""
    try:
        start = text.find(prefix)
        if start == -1:
            return None
        
        segment = text[start:start + 50]  # Look ahead 50 chars
        percent_pos = segment.find('%')
        if percent_pos == -1:
            return None
            
        # Work backwards from % to find the number
        for i in range(percent_pos - 1, -1, -1):
            if not segment[i].isdigit():
                number_str = segment[i+1:percent_pos]
                return int(number_str) if number_str.isdigit() else None
    except:
        return None
    
    return None

def extract_stamina(text: str, character: str) -> int:
    """Extract stamina percentage for a given character"""
    try:
        # Look for patterns like "hero stamina: 45%" or "stamina 67%"
        pattern1 = f"{character} stamina:"
        pattern2 = f"{character}.*stamina"
        
        for pattern in [pattern1, pattern2]:
            start = text.find(pattern)
            if start != -1:
                segment = text[start:start + 50]
                percent_pos = segment.find('%')
                if percent_pos != -1:
                    for i in range(percent_pos - 1, -1, -1):
                        if not segment[i].isdigit():
                            number_str = segment[i+1:percent_pos]
                            return int(number_str) if number_str.isdigit() else None
    except:
        pass
    return None

def extract_distance(text: str) -> str:
    """Extract distance classification from game state"""
    if "distance: close" in text or "close combat" in text:
        return "close"
    elif "distance: medium" in text or "medium range" in text:
        return "medium"
    elif "distance: far" in text or "far apart" in text:
        return "far"
    return "unknown"

def extract_phase(text: str) -> str:
    """Extract game phase from state"""
    if "phase: critical" in text or "critical phase" in text:
        return "critical"
    elif "phase: mid_game" in text or "mid game" in text:
        return "mid_game"
    elif "phase: early_game" in text or "early game" in text:
        return "early_game"
    return "unknown"

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    logger.info("🚀 Starting AI Model Server...")
    
    # Configure MPS if available
    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        # Set MPS as the preferred device
        logger.info("🍎 Configuring MPS for Apple Silicon")
        try:
            # Enable MPS fallback for unsupported operations
            torch.backends.mps.enable_fallback_to_cpu = True
            logger.info("✅ MPS fallback to CPU enabled for unsupported operations")
            
            # Set memory limit if available in this PyTorch version
            if hasattr(torch.mps, 'set_per_process_memory_fraction'):
                torch.mps.set_per_process_memory_fraction(0.9)  # Use 90% of available GPU memory
                logger.info("✅ MPS memory limit set to 90% of available GPU memory")
        except Exception as e:
            logger.warning(f"⚠️ MPS configuration warning: {str(e)}")
    
    # Load the model
    load_model()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "AI Fighting Coach Server",
        "status": "running",
        "model_loaded": MODEL_LOADED,
        "device": device if device else "unknown"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "model_loaded": MODEL_LOADED,
        "device": device,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/ai_suggestion", response_model=AISuggestionResponse)
async def get_ai_suggestion(request: AISuggestionRequest):
    """Get AI tactical suggestion based on current game state"""
    try:
        logger.info(f"🤖 AI Suggestion requested: {request.game_state}")
        
        suggestion = None
        confidence = "Medium"
        model_used = "fallback"
        
        # Try fine-tuned model first
        if MODEL_LOADED:
            try:
                suggestion, confidence = generate_model_suggestion(request.game_state)
                model_used = "phi-3.5-fine-tuned"
                logger.info("✅ Used fine-tuned model")
            except Exception as model_error:
                logger.warning(f"⚠️ Model inference failed: {model_error}")
        
        # Fall back to rule-based suggestions
        if suggestion is None:
            suggestion, confidence = generate_tactical_suggestion(request.game_state)
            model_used = "rule-based"
            logger.info("🔄 Used rule-based fallback")
        
        return AISuggestionResponse(
            suggestion=suggestion,
            confidence=confidence,
            timestamp=request.timestamp,
            status="success",
            model_used=model_used
        )
        
    except Exception as e:
        logger.error(f"❌ Error generating AI suggestion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating AI suggestion: {str(e)}")

@app.post("/game_event")
async def handle_game_event(event_data: Dict[str, Any]):
    """Handle game events (simplified - just acknowledge)"""
    logger.info(f"🎮 Game event received: {event_data.get('event_type', 'unknown')}")
    return {"message": "Game event received", "status": "success"}

@app.post("/game_state_snapshot")
async def handle_game_state_snapshot(snapshot_data: Dict[str, Any]):
    """Handle game state snapshots (simplified - just acknowledge)"""
    logger.info(f"📸 Game state snapshot received")
    return {"message": "Game state snapshot received", "status": "success"}

@app.get("/model_info")
async def get_model_info():
    """Get information about the loaded model"""
    mps_info = {}
    
    # Get detailed MPS information if available
    if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        mps_info = {
            "is_available": torch.backends.mps.is_available(),
            "is_built": torch.backends.mps.is_built(),
            "fallback_to_cpu": getattr(torch.backends.mps, "enable_fallback_to_cpu", False),
        }
        
        # Add memory info if available
        try:
            if hasattr(torch.mps, 'current_allocated_memory'):
                mps_info["allocated_memory_mb"] = round(torch.mps.current_allocated_memory() / (1024 * 1024), 2)
            if hasattr(torch.mps, 'driver_allocated_memory'):
                mps_info["driver_allocated_memory_mb"] = round(torch.mps.driver_allocated_memory() / (1024 * 1024), 2)
        except Exception as e:
            mps_info["memory_error"] = str(e)
    
    return {
        "model_loaded": MODEL_LOADED,
        "model_path": "model/fine_tuned" if MODEL_LOADED else None,
        "device": device,
        "torch_version": torch.__version__,
        "available_devices": {
            "cuda": torch.cuda.is_available(),
            "mps": hasattr(torch.backends, 'mps') and torch.backends.mps.is_available(),
            "cpu": True
        },
        "mps_details": mps_info if mps_info else None
    }

if __name__ == "__main__":
    print("🤖 Starting AI Fighting Coach Server...")
    print("🔗 Available endpoints:")
    print("   POST /ai_suggestion - Get tactical suggestions")
    print("   POST /game_event - Game event logging")
    print("   POST /game_state_snapshot - Screenshot capture")
    print("   GET /model_info - Model information")
    print("🌐 Server starting on http://localhost:8766")
    uvicorn.run(app, host="localhost", port=8766)
