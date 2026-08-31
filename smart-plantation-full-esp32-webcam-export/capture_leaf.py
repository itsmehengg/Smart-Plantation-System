import argparse
from datetime import datetime
from pathlib import Path

import cv2


def main():
    parser = argparse.ArgumentParser(description="Capture a USB webcam image for plant leaf monitoring.")
    parser.add_argument("--camera", type=int, default=0, help="Webcam index. Try 1 if 0 does not work.")
    parser.add_argument("--output-dir", default="webcam/plant_images", help="Folder to save captured images.")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    camera = cv2.VideoCapture(args.camera)
    if not camera.isOpened():
        raise RuntimeError(f"Could not open camera index {args.camera}")

    ok, frame = camera.read()
    camera.release()

    if not ok:
        raise RuntimeError("Could not capture image from webcam")

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    snapshot_path = output_dir / f"leaf_{timestamp}.jpg"
    latest_path = output_dir / "latest.jpg"

    cv2.imwrite(str(snapshot_path), frame)
    cv2.imwrite(str(latest_path), frame)

    print(str(latest_path.resolve()))


if __name__ == "__main__":
    main()
