#!/usr/bin/env python3
"""
AI Model Server for Vibe Code Fighting Game Demo

This server hosts the fine-tuned Phi-3.5 model and provides tactical suggestions.
Runs separately from the data collection bridge to maintain separation of concerns.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        return "mps"
    else:
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
            model = AutoModelForCausalLM.from_pretrained(
                model_path,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else None,
                low_cpu_mem_usage=True
            )
            
            if device != "cuda":
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
        # Format the prompt for Phi-3.5
        prompt = f"""<|system|>
You are an in-game sword-duel coach. Give one concise tip about movement, blocking, dodging, or melee attacks only.
If unsure, reply: No tip.<|end|>
<|user|>
Analyze this game state and provide tactical advice for the hero player.

Game State: {game_state}<|end|>
<|assistant|>
"""
        
        # Tokenize input
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate response
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=64,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )
        
        # Decode response
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract just the assistant's response
        if "<|assistant|>" in response:
            suggestion = response.split("<|assistant|>")[-1].strip()
        else:
            suggestion = response.strip()
        
        # Clean up the suggestion
        suggestion = suggestion.replace("<|end|>", "").strip()
        
        # Ensure it's not empty
        if not suggestion or suggestion.lower() in ["no tip", "no tip."]:
            raise Exception("Empty or invalid model response")
        
        return suggestion, "High"
        
    except Exception as e:
        logger.error(f"Model inference failed: {str(e)}")
        raise

def generate_tactical_suggestion(game_state: str) -> tuple[str, str]:
    """Generate tactical suggestions based on game state analysis"""
    state = game_state.lower()
    
    # Health-based suggestions
    if "hero: " in state:
        hero_health = extract_percentage(state, "hero:")
        knight_health = extract_percentage(state, "knight:")
        
        if hero_health and hero_health < 30:
            return "🚨 Critical health! Focus on defense and stamina management. Look for blocking opportunities.", "High"
        
        if knight_health and knight_health < 30:
            return "⚡ Enemy weakened! Press the attack with aggressive combos to finish them off.", "High"
    
    # Distance-based tactics
    if "distance: close" in state:
        if "attacking" in state:
            return "⚔️ In close combat! Use quick melee attacks and watch for blocking opportunities.", "High"
        else:
            return "🥊 Perfect range for combat! Initiate melee attacks or prepare defensive stance.", "High"
    
    elif "distance: medium" in state:
        return "🏃 Medium range detected. Close distance with movement or use lunge attacks to engage.", "Medium"
    
    elif "distance: far" in state:
        return "📍 Too far from enemy! Move closer to engage in combat. Use directional movement strategically.", "Medium"
    
    # Phase-based advice
    if "phase: critical" in state:
        return "⚠️ Critical phase! Every move counts. Focus on high-damage attacks and precise defense.", "High"
    
    elif "phase: mid_game" in state:
        return "⚖️ Mid-game phase. Balance aggression with defense. Look for stamina advantages.", "Medium"
    
    elif "phase: early_game" in state:
        return "🎯 Early game. Establish positioning and test enemy patterns. Build momentum carefully.", "Medium"
    
    # Stamina-based advice
    if "stamina" in state:
        stamina_match = state.split("stamina")[0]
        if "%" in stamina_match:
            stamina_val = stamina_match.split("%")[-2].split()[-1]
            try:
                stamina = int(stamina_val)
                if stamina < 30:
                    return "🔋 Low stamina! Avoid heavy attacks and focus on stamina regeneration.", "High"
            except:
                pass
    
    # Action-based suggestions
    if "idle" in state and "hero" in state:
        return "💪 Take action! Move toward the enemy or prepare for their attack.", "Medium"
    
    # Default tactical advice
    return "🎯 Analyze enemy patterns and maintain optimal distance for your next move.", "Low"

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

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    logger.info("🚀 Starting AI Model Server...")
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

@app.get("/model_info")
async def get_model_info():
    """Get information about the loaded model"""
    return {
        "model_loaded": MODEL_LOADED,
        "model_path": "model/fine_tuned" if MODEL_LOADED else None,
        "device": device,
        "torch_version": torch.__version__,
        "available_devices": {
            "cuda": torch.cuda.is_available(),
            "mps": hasattr(torch.backends, 'mps') and torch.backends.mps.is_available(),
            "cpu": True
        }
    }

if __name__ == "__main__":
    print("🤖 Starting AI Fighting Coach Server...")
    print("🔗 Available endpoints:")
    print("   POST /ai_suggestion - Get tactical suggestions")
    print("   GET /health - Health check")
    print("   GET /model_info - Model information")
    print("🌐 Server starting on http://localhost:8766")
    uvicorn.run(app, host="localhost", port=8766)
