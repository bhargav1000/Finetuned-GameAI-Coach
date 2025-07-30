# ai_bridge.py
import json, asyncio, websockets, chromadb, os, base64
from datetime import datetime
from sentence_transformers import SentenceTransformer
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

async def screenshot_saver(queue):
    global screenshot_counter
    while True:
        frame_timestamp, image_data, metadata = await queue.get()
        try:
            image_path = os.path.join(SESSION_FOLDER, f"screenshot_{screenshot_counter}.png")
            metadata_path = os.path.join(SESSION_FOLDER, f"screenshot_{screenshot_counter}.json")
            
            with open(image_path, 'wb') as f:
                f.write(image_data)
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=4)
            screenshot_counter += 1
        except Exception as e:
            print(f"Error saving screenshot: {e}")
        finally:
            queue.task_done()

async def handler(ws, queue):
    async for raw in ws:
        data = json.loads(raw)

        # Handle screenshot data
        if isinstance(data, dict) and data.get('type') == 'screenshot':
            try:
                frame_timestamp = datetime.now().strftime("%H-%M-%S-%f")
                image_data = base64.b64decode(data['image'].split(',')[1])
                metadata = data['metadata']
                
                await queue.put((frame_timestamp, image_data, metadata))
            except Exception as e:
                print(f"Error processing screenshot message: {e}")

        # Handle event batch (existing logic)
        elif isinstance(data,list):
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
        elif 'query' in data:          # retrieval request
            vec = embedder.encode([data['query']]).tolist()[0]
            res = db.query(query_embeddings=[vec], n_results=7)
            await ws.send(json.dumps(res['metadatas'][0]))

async def main():
    queue = asyncio.Queue()
    saver_task = asyncio.create_task(screenshot_saver(queue))

    async with websockets.serve(lambda ws: handler(ws, queue), "0.0.0.0", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())