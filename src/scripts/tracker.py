
import sys
import time
import signal
from codecarbon import EmissionsTracker


# Redirect stderr to stdout
sys.stderr = sys.stdout

tracker = EmissionsTracker()
running = True  # Global variable to control the loop

def start():
    """
    Start the tracker and run continuously until a termination signal is received.
    """
    print("Tracker started.")
    tracker.start()

    try:
        # Run an infinite loop, checking for the `running` variable
        while running:
            time.sleep(1)  # Reduce CPU usage
    finally:
        stop()

def stop():
    """
    Stop the tracker and print a stop message.
    """
    emissions = tracker.stop()
    print("Tracker stopped.")
    print(f"Total emissions: {emissions}")

def signal_handler(sig, frame):
    """
    Handle termination signals by setting `running` to False.
    """
    global running
    print("Signal received, stopping the tracker...")
    running = False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Please provide 'start' as an argument.")
        sys.exit(1)
    print("Starting the tracker...")
    command = sys.argv[1].lower()
    if command == "start":
        # Register the signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, signal_handler)  # Handle Ctrl+C
        signal.signal(signal.SIGTERM, signal_handler)  # Handle termination signal
        start()
    else:
        print("Unknown command. Use 'start'.")
        sys.exit(1)