#!/usr/bin/env python
"""
Script to run the Flask backend server persistently.
"""
import subprocess
import sys
import os
import time

def start_flask_backend():
    """Start the Flask backend server"""
    print("Starting Flask backend on port 5001...")
    
    # Change to backend directory
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
    
    # Start the Flask app
    process = subprocess.Popen(
        [sys.executable, 'app.py'],
        cwd=backend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1
    )
    
    print("Flask backend process started with PID:", process.pid)
    
    # Print output from the Flask server
    try:
        while True:
            output = process.stdout.readline()
            if output:
                print(f"[Flask Backend] {output.strip()}")
            elif process.poll() is not None:
                break
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nStopping Flask backend...")
        process.terminate()
        process.wait(timeout=5)
        print("Flask backend stopped.")
    except Exception as e:
        print(f"Error: {e}")
        process.terminate()

if __name__ == "__main__":
    start_flask_backend()