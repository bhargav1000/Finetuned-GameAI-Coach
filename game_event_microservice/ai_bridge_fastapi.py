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
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

# Initialize FastAPI app
app = FastAPI(title="AI Bridge API", description="Game AI Bridge with ChromaDB and Screenshot Storage")

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

# Pydantic models
class GameEvent(BaseModel):
    actor: str
    action: str
    dir: str
    hp: float
    pos: List[float]
    t: str

class ScreenshotData(BaseModel):
    type: str
    image: str
    metadata: Dict[str, Any]

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    results: List[Dict[str, Any]]

# Global queue for screenshot processing
screenshot_queue = asyncio.Queue()

async def screenshot_saver():
    """Background task to save screenshots"""
    global screenshot_counter
    while True:
        try:
            frame_timestamp, image_data, metadata = await screenshot_queue.get()
            image_path = os.path.join(SESSION_FOLDER, f"screenshot_{screenshot_counter}.png")
            metadata_path = os.path.join(SESSION_FOLDER, f"screenshot_{screenshot_counter}.json")
            
            with open(image_path, 'wb') as f:
                f.write(image_data)
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=4)
            screenshot_counter += 1
            screenshot_queue.task_done()
        except Exception as e:
            print(f"Error saving screenshot: {e}")

# Start background task
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(screenshot_saver())

# HTTP Endpoints
@app.get("/")
async def root():
    return {"message": "AI Bridge FastAPI Server", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/events", response_model=Dict[str, str])
async def add_events(events: List[GameEvent]):
    """Add game events to ChromaDB"""
    try:
        # Convert events to the format expected by the original handler
        data = []
        for event in events:
            event_dict = event.dict()
            # Convert position lists to strings for ChromaDB compatibility
            if 'pos' in event_dict and isinstance(event_dict['pos'], list):
                event_dict['pos'] = ','.join(map(str, event_dict['pos']))
            data.append(event_dict)
        
        texts = [f"{e['actor']} {e['action']} dir {e['dir']}"
                 f" hp {e['hp']:.2f} dist ?"
                 for e in data]
        
        db.add(ids=[str(e['t']) for e in data],
               embeddings=embedder.encode(texts).tolist(),
               metadatas=data)
        
        return {"status": "success", "message": f"Added {len(events)} events"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding events: {str(e)}")

@app.post("/query", response_model=QueryResponse)
async def query_events(request: QueryRequest):
    """Query events from ChromaDB"""
    try:
        vec = embedder.encode([request.query]).tolist()[0]
        res = db.query(query_embeddings=[vec], n_results=7)
        return QueryResponse(results=res['metadatas'][0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying events: {str(e)}")

@app.post("/screenshot")
async def save_screenshot(screenshot: ScreenshotData):
    """Save screenshot data"""
    try:
        frame_timestamp = datetime.now().strftime("%H-%M-%S-%f")
        image_data = base64.b64decode(screenshot.image.split(',')[1])
        metadata = screenshot.metadata
        
        await screenshot_queue.put((frame_timestamp, image_data, metadata))
        return {"status": "success", "message": "Screenshot queued for saving"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing screenshot: {str(e)}")

# WebSocket endpoint for real-time communication
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)

            # Handle screenshot data
            if isinstance(data, dict) and data.get('type') == 'screenshot':
                try:
                    frame_timestamp = datetime.now().strftime("%H-%M-%S-%f")
                    image_data = base64.b64decode(data['image'].split(',')[1])
                    metadata = data['metadata']
                    
                    await screenshot_queue.put((frame_timestamp, image_data, metadata))
                except Exception as e:
                    print(f"Error processing screenshot message: {e}")

            # Handle event batch (existing logic)
            elif isinstance(data, list):
                # Convert position lists to strings for ChromaDB compatibility
                for event in data:
                    if 'pos' in event and isinstance(event['pos'], list):
                        event['pos'] = ','.join(map(str, event['pos']))
                
                texts = [f"{e['actor']} {e['action']} dir {e['dir']}"
                         f" hp {e['hp']:.2f} dist ?"
                         for e in data]
                db.add(ids=[str(e['t']) for e in data],
                       embeddings=embedder.encode(texts).tolist(),
                       metadatas=data)
            
            elif 'query' in data:  # retrieval request
                vec = embedder.encode([data['query']]).tolist()[0]
                res = db.query(query_embeddings=[vec], n_results=7)
                await websocket.send_text(json.dumps(res['metadatas'][0]))

    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8765)
