#!/usr/bin/env python3
"""
Training Visualization Module for Fighting Game AI Fine-tuning

This module provides comprehensive training progress visualization and metrics tracking
for the Phi-3.5 fine-tuning process.

Features:
- Real-time loss tracking and visualization
- Learning rate schedule monitoring
- Gradient norm analysis
- Training timeline visualization
- Comprehensive training summary charts
- JSON metrics export for further analysis
"""

import json
import os
from pathlib import Path
import time
import datetime
from typing import Dict, List, Optional, Any

try:
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    try:
        import seaborn as sns
        plt.style.use('seaborn-v0_8')
    except:
        plt.style.use('default')
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("⚠️ Matplotlib not found. Training visualization will be disabled.")


class TrainingVisualizer:
    """Handles training progress visualization and metrics tracking"""
    
    def __init__(self, output_dir: str = "train_visualizations"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Training metrics storage
        self.metrics = {
            'train_loss': [],
            'eval_loss': [],
            'learning_rate': [],
            'grad_norm': [],
            'steps': [],
            'timestamps': [],
            'epoch': []
        }
        
        # Training session info
        self.session_start = datetime.datetime.now()
        self.session_id = self.session_start.strftime("%Y%m%d_%H%M%S")
        
    def log_metrics(self, step: int, epoch: int, train_loss: float, 
                   eval_loss: Optional[float] = None, learning_rate: Optional[float] = None,
                   grad_norm: Optional[float] = None):
        """Log training metrics for visualization"""
        self.metrics['steps'].append(step)
        self.metrics['epoch'].append(epoch)
        self.metrics['train_loss'].append(train_loss)
        self.metrics['eval_loss'].append(eval_loss)
        self.metrics['learning_rate'].append(learning_rate)
        self.metrics['grad_norm'].append(grad_norm)
        self.metrics['timestamps'].append(datetime.datetime.now())
        
    def create_loss_chart(self):
        """Create training and validation loss chart"""
        if not MATPLOTLIB_AVAILABLE or not self.metrics['steps']:
            return
            
        plt.figure(figsize=(12, 6))
        
        # Training loss
        plt.subplot(1, 2, 1)
        plt.plot(self.metrics['steps'], self.metrics['train_loss'], 
                label='Training Loss', color='#FF6B6B', linewidth=2)
        
        # Add eval loss if available
        eval_steps = [step for step, loss in zip(self.metrics['steps'], self.metrics['eval_loss']) if loss is not None]
        eval_losses = [loss for loss in self.metrics['eval_loss'] if loss is not None]
        if eval_losses:
            plt.plot(eval_steps, eval_losses, label='Validation Loss', 
                    color='#4ECDC4', linewidth=2, marker='o', markersize=4)
        
        plt.xlabel('Training Steps')
        plt.ylabel('Loss')
        plt.title('🎯 Training Progress')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        # Learning rate subplot
        plt.subplot(1, 2, 2)
        lr_steps = [step for step, lr in zip(self.metrics['steps'], self.metrics['learning_rate']) if lr is not None]
        lr_values = [lr for lr in self.metrics['learning_rate'] if lr is not None]
        if lr_values:
            plt.plot(lr_steps, lr_values, color='#95E1D3', linewidth=2)
            plt.xlabel('Training Steps')
            plt.ylabel('Learning Rate')
            plt.title('📈 Learning Rate Schedule')
            plt.grid(True, alpha=0.3)
            plt.yscale('log')
        
        plt.tight_layout()
        plt.savefig(self.output_dir / f'training_progress_{self.session_id}.png', 
                   dpi=300, bbox_inches='tight')
        plt.close()
        
    def create_gradient_chart(self):
        """Create gradient norm chart"""
        if not MATPLOTLIB_AVAILABLE or not self.metrics['steps']:
            return
            
        grad_steps = [step for step, grad in zip(self.metrics['steps'], self.metrics['grad_norm']) if grad is not None]
        grad_values = [grad for grad in self.metrics['grad_norm'] if grad is not None]
        
        if not grad_values:
            return
            
        plt.figure(figsize=(10, 6))
        plt.plot(grad_steps, grad_values, color='#F38BA8', linewidth=2)
        plt.xlabel('Training Steps')
        plt.ylabel('Gradient Norm')
        plt.title('🌊 Gradient Flow Monitoring')
        plt.grid(True, alpha=0.3)
        plt.yscale('log')
        
        plt.tight_layout()
        plt.savefig(self.output_dir / f'gradient_norms_{self.session_id}.png', 
                   dpi=300, bbox_inches='tight')
        plt.close()
        
    def create_training_summary(self):
        """Create comprehensive training summary chart"""
        if not MATPLOTLIB_AVAILABLE or not self.metrics['steps']:
            return
            
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
        
        # Loss over time
        ax1.plot(self.metrics['steps'], self.metrics['train_loss'], 
                color='#FF6B6B', linewidth=2, label='Training Loss')
        eval_steps = [step for step, loss in zip(self.metrics['steps'], self.metrics['eval_loss']) if loss is not None]
        eval_losses = [loss for loss in self.metrics['eval_loss'] if loss is not None]
        if eval_losses:
            ax1.plot(eval_steps, eval_losses, color='#4ECDC4', 
                    linewidth=2, marker='o', markersize=3, label='Validation Loss')
        ax1.set_xlabel('Steps')
        ax1.set_ylabel('Loss')
        ax1.set_title('🎯 Loss Curves')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Learning rate
        lr_steps = [step for step, lr in zip(self.metrics['steps'], self.metrics['learning_rate']) if lr is not None]
        lr_values = [lr for lr in self.metrics['learning_rate'] if lr is not None]
        if lr_values:
            ax2.plot(lr_steps, lr_values, color='#95E1D3', linewidth=2)
            ax2.set_xlabel('Steps')
            ax2.set_ylabel('Learning Rate')
            ax2.set_title('📈 Learning Rate Schedule')
            ax2.set_yscale('log')
            ax2.grid(True, alpha=0.3)
        
        # Gradient norms
        grad_steps = [step for step, grad in zip(self.metrics['steps'], self.metrics['grad_norm']) if grad is not None]
        grad_values = [grad for grad in self.metrics['grad_norm'] if grad is not None]
        if grad_values:
            ax3.plot(grad_steps, grad_values, color='#F38BA8', linewidth=2)
            ax3.set_xlabel('Steps')
            ax3.set_ylabel('Gradient Norm')
            ax3.set_title('🌊 Gradient Norms')
            ax3.set_yscale('log')
            ax3.grid(True, alpha=0.3)
        
        # Training timeline
        if self.metrics['timestamps']:
            time_diffs = [(t - self.session_start).total_seconds() / 60 for t in self.metrics['timestamps']]
            ax4.plot(time_diffs, self.metrics['train_loss'], color='#A8E6CF', linewidth=2)
            ax4.set_xlabel('Training Time (minutes)')
            ax4.set_ylabel('Training Loss')
            ax4.set_title('⏱️ Loss vs Time')
            ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(self.output_dir / f'training_summary_{self.session_id}.png', 
                   dpi=300, bbox_inches='tight')
        plt.close()
        
    def save_metrics_json(self):
        """Save metrics to JSON file for further analysis"""
        # Convert datetime objects to strings for JSON serialization
        serializable_metrics = {}
        for key, values in self.metrics.items():
            if key == 'timestamps':
                serializable_metrics[key] = [t.isoformat() for t in values]
            else:
                serializable_metrics[key] = values
                
        metrics_file = self.output_dir / f'training_metrics_{self.session_id}.json'
        with open(metrics_file, 'w') as f:
            json.dump({
                'session_info': {
                    'session_id': self.session_id,
                    'start_time': self.session_start.isoformat(),
                    'total_steps': len(self.metrics['steps']),
                },
                'metrics': serializable_metrics
            }, f, indent=2)
            
        print(f"📊 Training metrics saved: {metrics_file}")
        
    def finalize_visualization(self):
        """Create final visualization charts and save metrics"""
        if not self.metrics['steps']:
            print("⚠️ No training metrics to visualize")
            return
            
        print("\n🎨 Creating training visualizations...")
        
        try:
            self.create_loss_chart()
            self.create_gradient_chart()
            self.create_training_summary()
            self.save_metrics_json()
            
            print(f"✅ Training visualizations saved to: {self.output_dir}")
            print(f"📈 Session ID: {self.session_id}")
            
        except Exception as e:
            print(f"⚠️ Error creating visualizations: {e}")


class CustomTrainingCallback:
    """Custom callback for training progress tracking and visualization"""
    
    def __init__(self, visualizer: TrainingVisualizer, update_frequency: int = 10):
        self.visualizer = visualizer
        self.update_frequency = update_frequency
        self.step_count = 0
        
    def on_log(self, args, state, control, model=None, **kwargs):
        """Called when logging occurs during training"""
        if hasattr(state, 'log_history') and state.log_history:
            latest_log = state.log_history[-1]
            
            # Extract metrics
            step = latest_log.get('step', self.step_count)
            epoch = latest_log.get('epoch', 0)
            train_loss = latest_log.get('train_loss')
            eval_loss = latest_log.get('eval_loss')
            learning_rate = latest_log.get('learning_rate')
            grad_norm = latest_log.get('grad_norm')
            
            if train_loss is not None:
                self.visualizer.log_metrics(
                    step=step,
                    epoch=epoch,
                    train_loss=train_loss,
                    eval_loss=eval_loss,
                    learning_rate=learning_rate,
                    grad_norm=grad_norm
                )
                
                # Update charts periodically
                if step % self.update_frequency == 0:
                    self.visualizer.create_loss_chart()
        
        self.step_count += 1
