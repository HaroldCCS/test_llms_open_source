"""
Watch an iPhone camera stream (via the DroidCam app) and print to the
console whenever a cat is detected using YOLO.

Setup on the iPhone:
  1. Install "DroidCam" from the App Store (free, by Dev47Apps).
  2. Connect the iPhone to the SAME WiFi network as this Mac.
  3. Open the app -> it shows an IP address and port, e.g. 192.168.1.23:4747
  4. Leave the app open and pointed at whatever you want to scan for cats.

Run it:
  .venv/bin/python cat_watch.py 192.168.1.23:4747
  (or just `python cat_watch.py` and type the address when prompted)

Press 'q' in the video window, or Ctrl+C in the terminal, to stop.
"""

import sys
import time

import cv2
from ultralytics import YOLO

MODEL_PATH = "yolo26n-seg.pt"   # already downloaded locally
CAT_CLASS_ID = 15               # COCO class index for "cat"
CONF_THRESHOLD = 0.5
PRINT_COOLDOWN_SECONDS = 1.0    # don't spam the console every single frame
SHOW_WINDOW = True              # live preview with bounding boxes


def build_stream_url(raw: str) -> str:
    """Accepts '192.168.1.23:4747', '192.168.1.23:4747/video', or a full URL."""
    raw = raw.strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    if not raw.endswith("/video"):
        raw = raw.rstrip("/") + "/video"
    return f"http://{raw}"


def main():
    if len(sys.argv) > 1:
        address = sys.argv[1]
    else:
        address = input("DroidCam address shown on the phone (e.g. 192.168.1.23:4747): ")

    stream_url = build_stream_url(address)
    print(f"Connecting to phone camera at: {stream_url}")

    cap = cv2.VideoCapture(stream_url)
    if not cap.isOpened():
        print("Could not open the camera stream. Check that:")
        print("  - The phone and Mac are on the same WiFi network")
        print("  - The DroidCam app is open and showing that IP/port")
        print("  - The address you typed matches what's on the phone screen")
        sys.exit(1)

    print("Loading YOLO model...")
    model = YOLO(MODEL_PATH)
    print("Watching for cats. Press 'q' (in the video window) or Ctrl+C to stop.\n")

    last_print_time = 0.0
    cat_was_visible = False

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("Lost connection to the camera stream, retrying...")
                time.sleep(1)
                continue

            results = model.predict(
                frame,
                classes=[CAT_CLASS_ID],
                conf=CONF_THRESHOLD,
                verbose=False,
            )
            result = results[0]
            detections = result.boxes
            cat_count = 0 if detections is None else len(detections)
            now = time.time()

            if cat_count > 0:
                if not cat_was_visible:
                    print(f"[{time.strftime('%H:%M:%S')}] Cat detected! ({cat_count} found)")
                    last_print_time = now
                elif now - last_print_time >= PRINT_COOLDOWN_SECONDS:
                    print(f"[{time.strftime('%H:%M:%S')}] Still watching a cat... ({cat_count} found)")
                    last_print_time = now
                cat_was_visible = True
            else:
                if cat_was_visible:
                    print(f"[{time.strftime('%H:%M:%S')}] Cat left the frame.")
                cat_was_visible = False

            if SHOW_WINDOW:
                annotated = result.plot()
                cv2.imshow("Cat Watch", annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        print("\nStopped by user.")
    finally:
        cap.release()
        if SHOW_WINDOW:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
