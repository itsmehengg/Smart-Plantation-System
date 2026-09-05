import argparse
import json
from datetime import datetime
from pathlib import Path

import cv2


def main():
    parser = argparse.ArgumentParser(description="Capture a USB webcam image for plant leaf monitoring.")
    parser.add_argument("--camera", type=int, default=0, help="Webcam index. Try 1 if 0 does not work.")
    parser.add_argument("--output-dir", default="webcam/plant_images", help="Folder to save captured images.")
    parser.add_argument("--model", default=None, help="YOLO11 .pt model path. Defaults to webcam/best.pt when present.")
    parser.add_argument("--confidence", type=float, default=0.35, help="Minimum detection confidence.")
    parser.add_argument("--image-size", type=int, default=640, help="YOLO11 inference image size.")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    backends = [
        ("DirectShow", cv2.CAP_DSHOW),
        ("Media Foundation", cv2.CAP_MSMF),
        ("Default", cv2.CAP_ANY),
    ]

    camera = None
    opened_with = None
    for backend_name, backend in backends:
        candidate = cv2.VideoCapture(args.camera, backend)
        if candidate.isOpened():
            camera = candidate
            opened_with = backend_name
            break
        candidate.release()

    if camera is None:
        raise RuntimeError(f"Could not open camera index {args.camera}. Try --camera 1 if another camera is connected.")

    ok, frame = camera.read()
    camera.release()

    if not ok:
        raise RuntimeError("Could not capture image from webcam")

    default_model = Path(__file__).with_name("best.pt")
    model_path = Path(args.model).expanduser() if args.model else default_model
    detections = []
    if model_path.exists():
        try:
            from ultralytics import YOLO
        except ImportError as error:
            raise RuntimeError("Install YOLO11 support with: python -m pip install ultralytics") from error

        print(f"Loading YOLO11 model: {model_path}")
        model = YOLO(str(model_path))
        result = model.predict(frame, imgsz=args.image_size, conf=args.confidence, verbose=False)[0]
        frame = result.plot()
        names = result.names
        for box in result.boxes:
            class_id = int(box.cls[0])
            detections.append({
                "class": names.get(class_id, str(class_id)),
                "score": round(float(box.conf[0]), 3),
                "bbox": [int(value) for value in box.xyxy[0].tolist()],
            })
    elif args.model:
        raise FileNotFoundError(f"YOLO11 model not found: {model_path}")

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    snapshot_path = output_dir / f"leaf_{timestamp}.jpg"
    latest_path = output_dir / "latest.jpg"
    detections_path = output_dir / "latest_detections.json"

    cv2.imwrite(str(snapshot_path), frame)
    cv2.imwrite(str(latest_path), frame)
    detections_path.write_text(json.dumps({
        "captured_at": datetime.now().isoformat(timespec="seconds"),
        "model": str(model_path) if model_path.exists() else None,
        "count": len(detections),
        "objects": detections,
    }, indent=2), encoding="utf-8")

    print(f"Detections: {len(detections)}")
    print(str(latest_path.resolve()))


if __name__ == "__main__":
    main()
