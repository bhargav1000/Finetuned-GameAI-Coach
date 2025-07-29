# ai_bridge.py
import json, asyncio, websockets, chromadb
from sentence_transformers import SentenceTransformer
embedder = SentenceTransformer("all-MiniLM-L6-v2")
db = chromadb.Client().get_or_create_collection("duel")
async def handler(ws):
    async for raw in ws:
        data = json.loads(raw)
        if isinstance(data,list):      # event batch
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
asyncio.run(websockets.serve(handler,"0.0.0.0",8765))