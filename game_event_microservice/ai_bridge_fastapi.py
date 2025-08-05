# ai_bridge_fastapi.py
import json
import asyncio
import chromadb
import os
import base64
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

# Initialize FastAPI app
app = FastAPI(title="AI Bridge API", description="Game AI Bridge with ChromaDB and Screenshot Storage")

# Add CORS middleware to allow all origins
# This is necessary to allow the browser-based game client to connect to the WebSocket server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize components
embedder = SentenceTransformer("all-MiniLM-L6-v2")
db = chromadb.Client().get_or_create_collection("duel")

# Pre-load the model to avoid a delay on the first request
print("Pre-loading SentenceTransformer model...")
embedder.encode("preload")
print("Model pre-loaded.")

# Create a single session folder on startup
SESSION_FOLDER = os.path.join('.screenshots', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
if not os.path.exists(SESSION_FOLDER):
    os.makedirs(SESSION_FOLDER)

screenshot_counter = 0

# Pydantic models for data validation
class CharacterState(BaseModel):
    t: float
    actor: str
    pos: List[float]
    dir: int
    hp: float
    stamina: float
    action: str

class GameStateSnapshot(BaseModel):
    type: str
    image: str
    hero_state: CharacterState
    knight_state: CharacterState

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    results: List[Dict[str, Any]]

# Global queue for screenshot processing
screenshot_queue = asyncio.Queue()

async def screenshot_saver():
    """Background task to save screenshots and their associated state data"""
    global screenshot_counter
    while True:
        try:
            # The queue now contains the full character states alongside the image
            image_data, hero_state, knight_state = await screenshot_queue.get()
            
            # Define file paths
            image_path = os.path.join(SESSION_FOLDER, f"snapshot_{screenshot_counter}.png")
            metadata_path = os.path.join(SESSION_FOLDER, f"snapshot_{screenshot_counter}.json")
            
            # Save image
            with open(image_path, 'wb') as f:
                f.write(image_data)
            
            # Save combined metadata for both characters
            combined_metadata = {
                "hero_state": hero_state,
                "knight_state": knight_state
            }
            with open(metadata_path, 'w') as f:
                json.dump(combined_metadata, f, indent=4)
                
            screenshot_counter += 1
            screenshot_queue.task_done()
        except Exception as e:
            print(f"Error saving screenshot snapshot: {e}")

# Start background task on app startup
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(screenshot_saver())

# --- HTTP Endpoints (for external querying, not used by the game client directly) ---
@app.get("/")
async def root():
    return {"message": "AI Bridge FastAPI Server", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/query", response_model=QueryResponse)
async def query_events(request: QueryRequest):
    """Query events from ChromaDB"""
    try:
        vec = embedder.encode([request.query]).tolist()[0]
        res = db.query(query_embeddings=[vec], n_results=10) # Increased results to 10
        return QueryResponse(results=res['metadatas'][0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying events: {str(e)}")

# --- WebSocket Endpoint (main communication channel with the game) ---
@app.post("/game_state_snapshot")
async def process_game_state_snapshot(snapshot: GameStateSnapshot):
    """Receives, processes, and stores a complete game state snapshot."""
    try:
        # 1. Extract data from the payload
        hero_state = snapshot.hero_state.dict()
        knight_state = snapshot.knight_state.dict()

        # 2. Queue the screenshot and states for saving to disk
        image_data = base64.b64decode(snapshot.image.split(',')[1])
        await screenshot_queue.put((image_data, hero_state, knight_state))

        # 3. Prepare hero and knight data for the vector DB
        states_to_embed = [hero_state, knight_state]
        
        texts = []
        ids = []
        for state in states_to_embed:
            # Convert position list to a string for ChromaDB compatibility
            pos_str = ','.join(map(str, state['pos']))
            state['pos'] = pos_str
            
            # Create descriptive text for embedding
            text_description = f"{state['actor']} is performing {state['action']} at position {pos_str} with {state['hp']:.2f} HP and {state['stamina']:.2f} stamina"
            texts.append(text_description)
            
            # Generate a unique ID for the document
            doc_id = f"{state['t']}-{state['actor']}"
            ids.append(doc_id)

        # 4. Add to ChromaDB
        db.add(
            ids=ids,
            embeddings=embedder.encode(texts).tolist(),
            metadatas=states_to_embed
        )
        return {"status": "success", "message": "Snapshot processed"}
    except Exception as e:
        print(f"Error processing game state snapshot: {e}")
        raise HTTPException(status_code=500, detail="Error processing snapshot")

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8765)
