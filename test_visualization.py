#!/usr/bin/env python3
"""
Test Training Visualization System

This script demonstrates the training visualization system without actually training a model.
It creates sample training data and generates example charts.

Usage:
    python test_visualization.py
"""

import numpy as np
import matplotlib.pyplot as plt
from training_visualizer import TrainingVisualizer, MATPLOTLIB_AVAILABLE
import datetime

def generate_sample_training_data():
    """Generate realistic training data for demonstration"""
    
    # Simulate training progression
    steps = list(range(0, 101, 1))
    
    # Realistic loss curve (decreasing with noise)
    base_loss = 2.5
    decay_rate = 0.02
    noise_scale = 0.1
    
    train_loss = []
    learning_rates = []
    grad_norms = []
    
    for step in steps:
        # Training loss with exponential decay + noise
        loss = base_loss * np.exp(-decay_rate * step) + np.random.normal(0, noise_scale)
        loss = max(loss, 0.1)  # Minimum loss
        train_loss.append(loss)
        
        # Learning rate schedule (linear decay)
        lr = 2e-4 * (1 - step / 100)
        learning_rates.append(lr)
        
        # Gradient norms (realistic range with some spikes)
        grad_norm = np.random.lognormal(mean=-1, sigma=0.5) + 0.1
        if np.random.random() < 0.05:  # Occasional gradient spikes
            grad_norm *= 3
        grad_norms.append(grad_norm)
    
    return steps, train_loss, learning_rates, grad_norms

def test_visualization():
    """Test the visualization system with sample data"""
    
    if not MATPLOTLIB_AVAILABLE:
        print("❌ Matplotlib not available. Cannot test visualization.")
        return
    
    print("🎨 Testing Training Visualization System")
    print("=" * 50)
    
    # Create visualizer
    visualizer = TrainingVisualizer("train_visualizations")
    
    # Generate sample data
    steps, train_loss, learning_rates, grad_norms = generate_sample_training_data()
    
    print(f"📊 Generating {len(steps)} sample training steps...")
    
    # Log sample data
    for i, (step, loss, lr, grad) in enumerate(zip(steps, train_loss, learning_rates, grad_norms)):
        epoch = i // 20  # Simulate epochs
        eval_loss = loss * 0.95 if i % 10 == 0 else None  # Eval every 10 steps
        
        visualizer.log_metrics(
            step=step,
            epoch=epoch,
            train_loss=loss,
            eval_loss=eval_loss,
            learning_rate=lr,
            grad_norm=grad
        )
    
    # Create all visualizations
    print("🎯 Creating training progress charts...")
    visualizer.create_loss_chart()
    
    print("🌊 Creating gradient flow charts...")
    visualizer.create_gradient_chart()
    
    print("📈 Creating comprehensive summary...")
    visualizer.create_training_summary()
    
    print("💾 Saving metrics to JSON...")
    visualizer.save_metrics_json()
    
    # Final summary
    print("\n✅ VISUALIZATION TEST COMPLETED")
    print("=" * 50)
    print(f"📁 Charts saved to: {visualizer.output_dir}")
    print(f"🆔 Session ID: {visualizer.session_id}")
    print(f"📊 Total metrics logged: {len(visualizer.metrics['steps'])}")
    
    # Print file list
    import os
    files = os.listdir(visualizer.output_dir)
    png_files = [f for f in files if f.endswith('.png')]
    json_files = [f for f in files if f.endswith('.json')]
    
    print(f"\n📋 Generated Files:")
    for png_file in png_files:
        print(f"  🖼️  {png_file}")
    for json_file in json_files:
        print(f"  📄 {json_file}")
    
    print("\n🔧 Integration:")
    print("  • Visualization is automatically integrated into finetune_phi_model.py")
    print("  • Charts update every 5 training steps during real training")
    print("  • Final comprehensive charts created when training completes")
    
    print("\n🎯 Next Steps:")
    print("  1. Run: python finetune_phi_model.py")
    print("  2. Watch real-time visualization during training")
    print("  3. Analyze final charts in train_visualizations/")

if __name__ == "__main__":
    test_visualization()
