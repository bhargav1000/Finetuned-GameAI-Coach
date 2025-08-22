#!/usr/bin/env python3
"""
Fix Phi-3.5 Compatibility Issues

This script helps resolve version compatibility issues between Phi-3.5 and transformers library.
"""

import subprocess
import sys
import pkg_resources
from packaging import version

def get_installed_version(package_name):
    """Get installed version of a package"""
    try:
        return pkg_resources.get_distribution(package_name).version
    except pkg_resources.DistributionNotFound:
        return None

def run_command(command):
    """Run a shell command"""
    print(f"🔄 Running: {command}")
    result = subprocess.run(command.split(), capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return False
    return True

def main():
    print("🔧 Phi-3.5 Compatibility Fixer")
    print("=" * 40)
    
    # Check current versions
    transformers_version = get_installed_version("transformers")
    peft_version = get_installed_version("peft")
    
    print(f"📦 Current transformers version: {transformers_version}")
    print(f"📦 Current peft version: {peft_version}")
    
    # Check if versions are compatible
    needs_fix = False
    
    if transformers_version and version.parse(transformers_version) >= version.parse("4.45.0"):
        print("⚠️  Transformers version is too new for Phi-3.5")
        needs_fix = True
    
    if peft_version and version.parse(peft_version) >= version.parse("0.13.0"):
        print("⚠️  PEFT version may have compatibility issues")
        needs_fix = True
    
    if needs_fix:
        print("\n🔧 Installing compatible versions...")
        
        # Install compatible versions
        commands = [
            "pip install transformers==4.44.2",
            "pip install peft==0.12.0",
        ]
        
        for cmd in commands:
            if not run_command(cmd):
                print(f"❌ Failed to run: {cmd}")
                return False
        
        print("\n✅ Compatibility fix applied!")
        print("📝 Compatible versions installed:")
        print("   - transformers==4.44.2")
        print("   - peft==0.12.0")
        
    else:
        print("\n✅ Versions are already compatible!")
    
    print("\n🚀 You can now run the fine-tuning script:")
    print("   python finetune_phi_model.py")

if __name__ == "__main__":
    main()
