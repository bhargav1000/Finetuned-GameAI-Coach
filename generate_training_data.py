#!/usr/bin/env python3
"""
Training Data Generator for Fighting Game AI Assistant

This script processes game screenshots and metadata to generate comprehensive
training data for fine-tuning a game strategy assistant model.

Structure:
training_data/
├── [session_timestamp]/
│   ├── snapshot_X.png          # Original screenshot
│   ├── snapshot_X.json         # Game state metadata
│   └── snapshot_X_training.json # Generated training data
└── summary/
    ├── game_outcomes.json      # All game results
    ├── winning_patterns.json   # Successful strategies
    └── training_dataset.jsonl  # Final training format
"""

import os
import json
import shutil
import math
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional

class TrainingDataGenerator:
    def __init__(self, screenshots_dir="screenshots", training_dir="training_data"):
        self.screenshots_dir = Path(screenshots_dir)
        self.training_dir = Path(training_dir)
        
        # Game analysis constants
        self.HEALTH_THRESHOLDS = {
            "critical": 0.15,
            "low": 0.25, 
            "medium": 0.5,
            "high": 0.75
        }
        
        self.DISTANCE_THRESHOLDS = {
            "close": 100,
            "medium": 200,
            "far": 400
        }
        
        # Action categories for analysis
        self.DEFENSIVE_ACTIONS = {"block", "shield-block", "dodge", "roll"}
        self.OFFENSIVE_ACTIONS = {"attack", "melee", "special", "kick"}
        self.MOVEMENT_ACTIONS = {"walk", "run", "dash"}
        
    def setup_training_directory(self):
        """Create the training data directory structure"""
        print("🗂️  Setting up training data directory...")
        
        # Create main training directory
        self.training_dir.mkdir(exist_ok=True)
        
        # Create summary directory
        summary_dir = self.training_dir / "summary"
        summary_dir.mkdir(exist_ok=True)
        
        print(f"✅ Created directory: {self.training_dir}")
        
    def copy_screenshots_and_metadata(self):
        """Copy all screenshots and JSON files to training directory"""
        print("📸 Copying screenshots and metadata...")
        
        if not self.screenshots_dir.exists():
            print(f"❌ Screenshots directory not found: {self.screenshots_dir}")
            return
            
        copied_sessions = 0
        total_files = 0
        
        for session_dir in self.screenshots_dir.iterdir():
            if session_dir.is_dir():
                # Create corresponding training session directory
                training_session_dir = self.training_dir / session_dir.name
                training_session_dir.mkdir(exist_ok=True)
                
                # Copy all files from session
                session_files = 0
                for file_path in session_dir.iterdir():
                    if file_path.is_file() and (file_path.suffix in ['.png', '.json']):
                        dest_path = training_session_dir / file_path.name
                        shutil.copy2(file_path, dest_path)
                        session_files += 1
                        total_files += 1
                
                if session_files > 0:
                    copied_sessions += 1
                    print(f"  📁 {session_dir.name}: {session_files} files")
        
        print(f"✅ Copied {copied_sessions} sessions ({total_files} total files)")
        
    def analyze_game_state(self, hero_state: Dict, knight_state: Dict) -> Dict:
        """Analyze current game state and extract tactical information"""
        
        # Calculate distance between players
        hero_pos = [float(x) for x in hero_state["pos"].split(",")]
        knight_pos = [float(x) for x in knight_state["pos"].split(",")]
        distance = math.sqrt((hero_pos[0] - knight_pos[0])**2 + (hero_pos[1] - knight_pos[1])**2)
        
        # Categorize distance
        if distance < self.DISTANCE_THRESHOLDS["close"]:
            distance_category = "close"
        elif distance < self.DISTANCE_THRESHOLDS["medium"]:
            distance_category = "medium"
        else:
            distance_category = "far"
            
        # Categorize health levels
        hero_health_category = self._categorize_health(hero_state["hp"])
        knight_health_category = self._categorize_health(knight_state["hp"])
        
        # Analyze stamina
        hero_stamina_category = self._categorize_stamina(hero_state["stamina"])
        knight_stamina_category = self._categorize_stamina(knight_state["stamina"])
        
        # Determine tactical situation
        health_advantage = hero_state["hp"] - knight_state["hp"]
        if health_advantage > 0.2:
            tactical_situation = "hero_advantage"
        elif health_advantage < -0.2:
            tactical_situation = "knight_advantage"
        else:
            tactical_situation = "even_match"
            
        # Analyze current actions
        hero_action_category = self._categorize_action(hero_state["action"])
        knight_action_category = self._categorize_action(knight_state["action"])
        
        return {
            "distance": distance,
            "distance_category": distance_category,
            "hero_health_category": hero_health_category,
            "knight_health_category": knight_health_category,
            "hero_stamina_category": hero_stamina_category,
            "knight_stamina_category": knight_stamina_category,
            "tactical_situation": tactical_situation,
            "health_advantage": health_advantage,
            "hero_action_category": hero_action_category,
            "knight_action_category": knight_action_category,
            "game_phase": self._determine_game_phase(hero_state["hp"], knight_state["hp"])
        }
        
    def _categorize_health(self, health: float) -> str:
        """Categorize health level"""
        if health <= self.HEALTH_THRESHOLDS["critical"]:
            return "critical"
        elif health <= self.HEALTH_THRESHOLDS["low"]:
            return "low"
        elif health <= self.HEALTH_THRESHOLDS["medium"]:
            return "medium"
        elif health <= self.HEALTH_THRESHOLDS["high"]:
            return "high"
        else:
            return "full"
            
    def _categorize_stamina(self, stamina: float) -> str:
        """Categorize stamina level"""
        if stamina <= 0.2:
            return "exhausted"
        elif stamina <= 0.4:
            return "low"
        elif stamina <= 0.7:
            return "medium"
        else:
            return "high"
            
    def _categorize_action(self, action: str) -> str:
        """Categorize the type of action being performed"""
        action_lower = action.lower()
        
        if any(defensive in action_lower for defensive in self.DEFENSIVE_ACTIONS):
            return "defensive"
        elif any(offensive in action_lower for offensive in self.OFFENSIVE_ACTIONS):
            return "offensive"
        elif any(movement in action_lower for movement in self.MOVEMENT_ACTIONS):
            return "movement"
        elif "idle" in action_lower:
            return "idle"
        elif "die" in action_lower:
            return "death"
        elif "unsheath" in action_lower:
            return "victory"
        else:
            return "other"
            
    def _determine_game_phase(self, hero_hp: float, knight_hp: float) -> str:
        """Determine what phase of the game this is"""
        min_hp = min(hero_hp, knight_hp)
        
        if min_hp <= 0:
            return "game_over"
        elif min_hp <= self.HEALTH_THRESHOLDS["critical"]:
            return "critical_phase"
        elif min_hp <= self.HEALTH_THRESHOLDS["low"]:
            return "late_game"
        elif min_hp <= self.HEALTH_THRESHOLDS["medium"]:
            return "mid_game"
        else:
            return "early_game"
            
    def generate_tactical_advice(self, analysis: Dict, hero_state: Dict, knight_state: Dict) -> Dict:
        """Generate tactical advice based on game state analysis"""
        
        advice_data = {
            "situation_summary": self._create_situation_summary(analysis, hero_state, knight_state),
            "tactical_advice": [],
            "risk_assessment": "medium",
            "recommended_actions": [],
            "avoid_actions": [],
            "confidence": 0.7
        }
        
        # Generate advice based on game phase
        if analysis["game_phase"] == "early_game":
            advice_data["tactical_advice"].append("Focus on positioning and stamina management")
            advice_data["recommended_actions"].extend(["defensive positioning", "patient play"])
            
        elif analysis["game_phase"] == "critical_phase":
            if analysis["tactical_situation"] == "hero_advantage":
                advice_data["tactical_advice"].append("Finish the fight! Maintain pressure but don't get reckless")
                advice_data["recommended_actions"].extend(["controlled aggression", "prevent opponent recovery"])
                advice_data["risk_assessment"] = "medium"
            else:
                advice_data["tactical_advice"].append("Desperate situation! Look for high-risk, high-reward opportunities")
                advice_data["recommended_actions"].extend(["surprise attacks", "risky counters"])
                advice_data["avoid_actions"].extend(["passive play", "defensive only"])
                advice_data["risk_assessment"] = "high"
                
        # Stamina-based advice
        if analysis["knight_stamina_category"] == "exhausted":
            advice_data["tactical_advice"].append("Opponent is exhausted! This is your window to attack")
            advice_data["recommended_actions"].append("immediate aggression")
            advice_data["confidence"] = 0.9
            
        if analysis["hero_stamina_category"] == "exhausted":
            advice_data["tactical_advice"].append("You're exhausted! Play defensively until stamina recovers")
            advice_data["recommended_actions"].extend(["defensive play", "stamina recovery"])
            advice_data["avoid_actions"].extend(["attacking", "aggressive moves"])
            
        # Distance-based advice
        if analysis["distance_category"] == "close":
            if analysis["knight_action_category"] == "offensive":
                advice_data["tactical_advice"].append("Opponent is attacking at close range! Block or dodge immediately")
                advice_data["recommended_actions"].extend(["block", "dodge", "counter-attack"])
                advice_data["risk_assessment"] = "high"
                
        elif analysis["distance_category"] == "far":
            advice_data["tactical_advice"].append("You're far apart. Close distance or use ranged attacks")
            advice_data["recommended_actions"].extend(["close distance", "ranged attacks"])
            
        # Health-based strategy
        if analysis["health_advantage"] > 0.3:
            advice_data["tactical_advice"].append("You have a significant health advantage! Control the pace")
            advice_data["recommended_actions"].extend(["controlled aggression", "maintain pressure"])
            advice_data["avoid_actions"].append("reckless attacks")
            
        elif analysis["health_advantage"] < -0.3:
            advice_data["tactical_advice"].append("You're significantly behind! Need to take calculated risks")
            advice_data["recommended_actions"].extend(["calculated risks", "exploit openings"])
            advice_data["risk_assessment"] = "high"
            
        return advice_data
        
    def _create_situation_summary(self, analysis: Dict, hero_state: Dict, knight_state: Dict) -> str:
        """Create a human-readable situation summary"""
        
        hero_hp_pct = int(hero_state["hp"] * 100)
        knight_hp_pct = int(knight_state["hp"] * 100)
        hero_stamina_pct = int(hero_state["stamina"] * 100)
        knight_stamina_pct = int(knight_state["stamina"] * 100)
        
        summary = f"Hero: {hero_hp_pct}% HP, {hero_stamina_pct}% stamina, {hero_state['action']}. "
        summary += f"Knight: {knight_hp_pct}% HP, {knight_stamina_pct}% stamina, {knight_state['action']}. "
        summary += f"Distance: {analysis['distance_category']}, Phase: {analysis['game_phase']}"
        
        return summary
        
    def analyze_game_session(self, session_dir: Path) -> Dict:
        """Analyze a complete game session to determine outcome and patterns"""
        
        snapshots = []
        
        # Load all snapshots in order
        json_files = sorted([f for f in session_dir.iterdir() if f.suffix == '.json' and 'training' not in f.name])
        
        for json_file in json_files:
            try:
                with open(json_file, 'r') as f:
                    data = json.load(f)
                    data['snapshot_index'] = int(json_file.stem.split('_')[1])
                    snapshots.append(data)
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"⚠️  Error loading {json_file}: {e}")
                continue
                
        if not snapshots:
            return {"error": "No valid snapshots found"}
            
        # Sort by snapshot index
        snapshots.sort(key=lambda x: x['snapshot_index'])
        
        # Determine game outcome
        final_snapshot = snapshots[-1]
        hero_final_hp = final_snapshot['hero_state']['hp']
        knight_final_hp = final_snapshot['knight_state']['hp']
        
        if knight_final_hp <= 0:
            winner = "hero"
            loser = "knight"
        elif hero_final_hp <= 0:
            winner = "knight"
            loser = "hero"
        else:
            # Game didn't end in death, determine by health
            if hero_final_hp > knight_final_hp:
                winner = "hero"
                loser = "knight"
            else:
                winner = "knight"
                loser = "hero"
                
        # Calculate game statistics
        game_duration = final_snapshot['hero_state']['t'] - snapshots[0]['hero_state']['t']
        total_snapshots = len(snapshots)
        
        return {
            "session_name": session_dir.name,
            "winner": winner,
            "loser": loser,
            "game_duration_ms": game_duration,
            "total_snapshots": total_snapshots,
            "final_hero_hp": hero_final_hp,
            "final_knight_hp": knight_final_hp,
            "snapshots_analyzed": len(snapshots)
        }
        
    def generate_training_data_for_session(self, session_dir: Path):
        """Generate training data files for all snapshots in a session"""
        
        session_analysis = self.analyze_game_session(session_dir)
        if "error" in session_analysis:
            print(f"❌ Skipping {session_dir.name}: {session_analysis['error']}")
            return
            
        print(f"🎮 Processing {session_dir.name} - Winner: {session_analysis['winner']}")
        
        # Process each snapshot
        json_files = sorted([f for f in session_dir.iterdir() if f.suffix == '.json' and 'training' not in f.name])
        
        for json_file in json_files:
            try:
                # Load snapshot data
                with open(json_file, 'r') as f:
                    snapshot_data = json.load(f)
                    
                # Analyze game state
                analysis = self.analyze_game_state(
                    snapshot_data['hero_state'],
                    snapshot_data['knight_state']
                )
                
                # Generate tactical advice
                advice = self.generate_tactical_advice(
                    analysis,
                    snapshot_data['hero_state'], 
                    snapshot_data['knight_state']
                )
                
                # Create comprehensive training data
                training_data = {
                    "metadata": {
                        "session": session_analysis['session_name'],
                        "snapshot_index": int(json_file.stem.split('_')[1]),
                        "game_outcome": session_analysis['winner'],
                        "timestamp": snapshot_data['hero_state']['t']
                    },
                    "game_state": {
                        "hero": snapshot_data['hero_state'],
                        "knight": snapshot_data['knight_state']
                    },
                    "analysis": analysis,
                    "tactical_advice": advice,
                    "instruction_format": {
                        "instruction": "You are an expert fighting game coach. Analyze this game state and provide tactical advice for the hero player.",
                        "input": advice["situation_summary"],
                        "output": " ".join(advice["tactical_advice"]) if advice["tactical_advice"] else "Continue current strategy."
                    }
                }
                
                # Save training data
                training_file = session_dir / f"{json_file.stem}_training.json"
                with open(training_file, 'w') as f:
                    json.dump(training_data, f, indent=2)
                    
            except Exception as e:
                print(f"⚠️  Error processing {json_file}: {e}")
                continue
                
    def generate_summary_reports(self):
        """Generate summary reports and final training dataset"""
        print("📊 Generating summary reports...")
        
        all_games = []
        all_training_examples = []
        winning_patterns = {"hero_wins": [], "knight_wins": []}
        
        # Collect data from all sessions
        for session_dir in self.training_dir.iterdir():
            if session_dir.is_dir() and session_dir.name != "summary":
                session_analysis = self.analyze_game_session(session_dir)
                if "error" not in session_analysis:
                    all_games.append(session_analysis)
                    
                    # Collect training examples
                    training_files = list(session_dir.glob("*_training.json"))
                    for training_file in training_files:
                        try:
                            with open(training_file, 'r') as f:
                                training_data = json.load(f)
                                all_training_examples.append(training_data["instruction_format"])
                                
                                # Collect winning patterns
                                if session_analysis["winner"] == "hero":
                                    winning_patterns["hero_wins"].append(training_data)
                                else:
                                    winning_patterns["knight_wins"].append(training_data)
                                    
                        except Exception as e:
                            print(f"⚠️  Error loading training file {training_file}: {e}")
                            
        # Generate game outcomes summary
        summary_dir = self.training_dir / "summary"
        
        with open(summary_dir / "game_outcomes.json", 'w') as f:
            json.dump({
                "total_games": len(all_games),
                "hero_wins": len([g for g in all_games if g["winner"] == "hero"]),
                "knight_wins": len([g for g in all_games if g["winner"] == "knight"]),
                "games": all_games
            }, f, indent=2)
            
        # Save winning patterns
        with open(summary_dir / "winning_patterns.json", 'w') as f:
            json.dump(winning_patterns, f, indent=2)
            
        # Generate final training dataset in JSONL format
        with open(summary_dir / "training_dataset.jsonl", 'w') as f:
            for example in all_training_examples:
                f.write(json.dumps(example) + '\n')
                
        print(f"✅ Generated summary reports:")
        print(f"   📈 {len(all_games)} total games analyzed")
        print(f"   📝 {len(all_training_examples)} training examples created")
        print(f"   💾 Files saved to {summary_dir}")
        
    def run_full_pipeline(self):
        """Run the complete training data generation pipeline"""
        print("🚀 Starting Training Data Generation Pipeline")
        print("=" * 50)
        
        # Step 1: Setup directories
        self.setup_training_directory()
        
        # Step 2: Copy screenshots and metadata
        self.copy_screenshots_and_metadata()
        
        # Step 3: Generate training data for each session
        print("\n🧠 Generating training data...")
        sessions_processed = 0
        
        for session_dir in self.training_dir.iterdir():
            if session_dir.is_dir() and session_dir.name != "summary":
                self.generate_training_data_for_session(session_dir)
                sessions_processed += 1
                
        print(f"✅ Processed {sessions_processed} sessions")
        
        # Step 4: Generate summary reports
        self.generate_summary_reports()
        
        print("\n🎉 Training Data Generation Complete!")
        print(f"📁 All data saved to: {self.training_dir}")
        print("\nNext steps:")
        print("1. Review the training_dataset.jsonl for model fine-tuning")
        print("2. Check winning_patterns.json for strategic insights")
        print("3. Use game_outcomes.json for dataset statistics")

def main():
    """Main entry point"""
    print("🎮 Fighting Game AI Training Data Generator")
    print("=" * 45)
    
    generator = TrainingDataGenerator()
    generator.run_full_pipeline()

if __name__ == "__main__":
    main()
