#!/usr/bin/env python3
"""
Data Explorer for Vibe-Code-Adaptive-Game-AI Training Data

This script helps you explore and export your collected game data for training.
"""

import chromadb
import json
import os
from datetime import datetime
from pathlib import Path
# import pandas as pd  # Optional, will work without it
from sentence_transformers import SentenceTransformer

def explore_screenshots():
    """Explore screenshot data on filesystem"""
    screenshots_dir = Path('.screenshots')
    
    if not screenshots_dir.exists():
        print("❌ No screenshots directory found")
        return
    
    print("📁 SCREENSHOT SESSIONS:")
    print("=" * 50)
    
    total_images = 0
    sessions = []
    
    for session_dir in sorted(screenshots_dir.iterdir()):
        if session_dir.is_dir() and not session_dir.name.startswith('.'):
            png_files = list(session_dir.glob('*.png'))
            json_files = list(session_dir.glob('*.json'))
            
            sessions.append({
                'session': session_dir.name,
                'images': len(png_files),
                'metadata': len(json_files),
                'path': str(session_dir)
            })
            
            total_images += len(png_files)
            print(f"📸 {session_dir.name}: {len(png_files)} images, {len(json_files)} metadata files")
    
    print(f"\n🎯 TOTAL: {total_images} screenshots across {len(sessions)} sessions")
    return sessions

def explore_vector_db():
    """Explore ChromaDB vector database"""
    try:
        client = chromadb.Client()
        collection = client.get_collection("duel")
        
        # Get collection info
        count = collection.count()
        print(f"\n🔍 VECTOR DATABASE:")
        print("=" * 50)
        print(f"📊 Collection: 'duel'")
        print(f"📈 Total records: {count}")
        
        if count > 0:
            # Get a sample of records
            sample = collection.get(limit=5)
            print(f"\n📋 SAMPLE RECORDS:")
            
            for i, (doc_id, metadata) in enumerate(zip(sample['ids'], sample['metadatas'])):
                print(f"\n{i+1}. ID: {doc_id}")
                print(f"   Actor: {metadata.get('actor', 'Unknown')}")
                print(f"   Action: {metadata.get('action', 'Unknown')}")
                print(f"   HP: {metadata.get('hp', 0):.2f}")
                print(f"   Position: {metadata.get('pos', 'Unknown')}")
        
        return count
    
    except Exception as e:
        print(f"❌ Error accessing vector database: {e}")
        print("💡 Make sure to run the backend first: python game_event_microservice/ai_bridge_fastapi.py")
        return 0

def query_vector_db(query_text):
    """Query the vector database"""
    try:
        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        client = chromadb.Client()
        collection = client.get_collection("duel")
        
        # Create embedding for query
        query_embedding = embedder.encode([query_text]).tolist()
        
        # Search
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=10
        )
        
        print(f"\n🔍 QUERY RESULTS for: '{query_text}'")
        print("=" * 50)
        
        for i, (doc_id, metadata) in enumerate(zip(results['ids'][0], results['metadatas'][0])):
            print(f"\n{i+1}. ID: {doc_id}")
            print(f"   Actor: {metadata.get('actor', 'Unknown')}")
            print(f"   Action: {metadata.get('action', 'Unknown')}")
            print(f"   HP: {metadata.get('hp', 0):.2f}")
            print(f"   Position: {metadata.get('pos', 'Unknown')}")
            print(f"   Time: {metadata.get('t', 0):.0f}ms")
        
        return results
    
    except Exception as e:
        print(f"❌ Error querying database: {e}")
        return None

def export_training_data():
    """Export all data for training"""
    export_dir = Path('training_export')
    export_dir.mkdir(exist_ok=True)
    
    print(f"\n📤 EXPORTING TRAINING DATA to {export_dir}/")
    print("=" * 50)
    
    # Export vector database
    try:
        client = chromadb.Client()
        collection = client.get_collection("duel")
        
        # Get all data
        all_data = collection.get()
        
        # Convert to structured data
        df_data = []
        for doc_id, metadata in zip(all_data['ids'], all_data['metadatas']):
            df_data.append({
                'id': doc_id,
                'actor': metadata.get('actor'),
                'action': metadata.get('action'),
                'hp': metadata.get('hp'),
                'stamina': metadata.get('stamina'),
                'position': metadata.get('pos'),
                'time': metadata.get('t'),
                'direction': metadata.get('dir')
            })
        
        # Export as CSV manually
        csv_path = export_dir / 'game_events.csv'
        with open(csv_path, 'w') as f:
            # Write header
            f.write('id,actor,action,hp,stamina,position,time,direction\n')
            # Write data
            for item in df_data:
                f.write(f"{item['id']},{item['actor']},{item['action']},{item['hp']},{item['stamina']},{item['position']},{item['time']},{item['direction']}\n")
        print(f"✅ Exported {len(df_data)} game events to {csv_path}")
        
        # Export as JSON
        json_path = export_dir / 'game_events.json'
        with open(json_path, 'w') as f:
            json.dump(df_data, f, indent=2)
        print(f"✅ Exported game events to {json_path}")
        
        # Export embeddings
        embeddings_path = export_dir / 'embeddings.json'
        embeddings_data = {
            'ids': all_data['ids'],
            'embeddings': all_data['embeddings'],
            'metadatas': all_data['metadatas']
        }
        with open(embeddings_path, 'w') as f:
            json.dump(embeddings_data, f, indent=2)
        print(f"✅ Exported embeddings to {embeddings_path}")
        
    except Exception as e:
        print(f"❌ Error exporting vector data: {e}")
    
    # Create summary
    summary = {
        'export_time': datetime.now().isoformat(),
        'total_screenshots': len(list(Path('.screenshots').glob('**/*.png'))),
        'total_sessions': len([d for d in Path('.screenshots').iterdir() if d.is_dir()]),
        'vector_db_records': len(df_data) if 'df_data' in locals() else 0
    }
    
    summary_path = export_dir / 'export_summary.json'
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"✅ Export summary saved to {summary_path}")
    print(f"\n🎯 TRAINING DATA READY in {export_dir}/")

def main():
    """Main function"""
    print("🎮 VIBE-CODE AI TRAINING DATA EXPLORER")
    print("=" * 50)
    
    # Explore screenshots
    sessions = explore_screenshots()
    
    # Explore vector database
    db_count = explore_vector_db()
    
    # Interactive mode
    print(f"\n🤖 INTERACTIVE MODE:")
    print("Commands:")
    print("  'query <text>' - Search vector database")
    print("  'export'       - Export all data for training")
    print("  'quit'         - Exit")
    
    while True:
        try:
            cmd = input("\n> ").strip()
            
            if cmd.lower() == 'quit':
                break
            elif cmd.lower() == 'export':
                export_training_data()
            elif cmd.lower().startswith('query '):
                query_text = cmd[6:]
                query_vector_db(query_text)
            else:
                print("❓ Unknown command. Try 'query <text>', 'export', or 'quit'")
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break

if __name__ == "__main__":
    main()
