import argparse
import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import cv2


class CameraStream:
    def __init__(self, camera_index, width, height, fps, jpeg_quality, model_path, confidence, image_size):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.frame_interval = 1 / max(fps, 1)
        self.jpeg_quality = jpeg_quality
        self.confidence = confidence
        self.image_size = image_size
        self.lock = threading.Lock()
        self.latest_frame = None
        self.latest_detections = []
        self.latest_detected_at = None
        self.running = False
        self.thread = None
        self.camera = None
        if model_path:
            self.model = self._load_model(model_path)
        else:
            self.model = None

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        if self.camera:
            self.camera.release()

    def get_frame(self):
        with self.lock:
            return self.latest_frame

    def get_detections(self):
        with self.lock:
            return {
                "detected_at": self.latest_detected_at,
                "count": len(self.latest_detections),
                "objects": list(self.latest_detections),
            }

    def _load_model(self, model_path):
        path = Path(model_path).expanduser()
        if not path.exists():
            raise FileNotFoundError(f"YOLO model not found: {path}")

        try:
            from ultralytics import YOLO
        except ImportError as error:
            raise RuntimeError(
                "Install YOLO support with: python -m pip install -r webcam/requirements.txt"
            ) from error

        print(f"Loading YOLO model: {path}")
        return YOLO(str(path))

    def _open_camera(self):
        backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
        for backend in backends:
            camera = cv2.VideoCapture(self.camera_index, backend)
            if camera.isOpened():
                camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                return camera
            camera.release()
        raise RuntimeError(f"Could not open camera index {self.camera_index}")

    def _capture_loop(self):
        self.camera = self._open_camera()
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg_quality]

        while self.running:
            ok, frame = self.camera.read()
            if ok:
                detections = []
                if self.model:
                    frame, detections = self._detect_and_annotate(frame)

                ok, encoded = cv2.imencode(".jpg", frame, encode_params)
                if ok:
                    with self.lock:
                        self.latest_frame = encoded.tobytes()
                        self.latest_detections = detections
                        self.latest_detected_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            time.sleep(self.frame_interval)

    def _detect_and_annotate(self, frame):
        result = self.model.predict(frame, imgsz=self.image_size, conf=self.confidence, verbose=False)[0]
        names = result.names
        detections = []

        for box in result.boxes:
            x1, y1, x2, y2 = [int(value) for value in box.xyxy[0].tolist()]
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            label = names.get(class_id, str(class_id))

            detections.append({
                "class": label,
                "score": round(confidence, 3),
                "bbox": [x1, y1, x2 - x1, y2 - y1],
            })

            text = f"{label} {confidence:.0%}"
            cv2.rectangle(frame, (x1, y1), (x2, y2), (64, 218, 203), 3)
            text_size, baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
            text_y = max(0, y1 - text_size[1] - baseline - 8)
            cv2.rectangle(
                frame,
                (x1, text_y),
                (x1 + text_size[0] + 12, text_y + text_size[1] + baseline + 8),
                (6, 47, 39),
                -1,
            )
            cv2.putText(
                frame,
                text,
                (x1 + 6, text_y + text_size[1] + 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )

        return frame, detections


def get_lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def make_handler(camera_stream):
    class WebcamHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            print(f"{self.client_address[0]} - {format % args}")

        def do_GET(self):
            path = urlparse(self.path).path

            if path in ("/", "/index.html"):
                self._send_index()
                return

            if path == "/stream.mjpg":
                self._send_stream()
                return

            if path == "/snapshot.jpg":
                self._send_snapshot()
                return

            if path == "/detections.json":
                self._send_detections()
                return

            self.send_error(404)

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            super().end_headers()

        def _send_index(self):
            page = (
                '<!doctype html>\n'
                '<html>\n'
                '<head>\n'
                '  <meta charset="utf-8">\n'
                '  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
                '  <title>Laptop Webcam Host</title>\n'
                '  <style>\n'
                '    body { margin: 0; font-family: Arial, sans-serif; background: #111; color: #f5f5f5; }\n'
                '    main { max-width: 980px; margin: 0 auto; padding: 16px; }\n'
                '    h1 { font-size: 22px; margin: 8px 0 14px; }\n'
                '    img { width: 100%; background: #000; border: 1px solid #333; }\n'
                '    a { color: #9ad7ff; }\n'
                '  </style>\n'
                '</head>\n'
                '<body>\n'
                '  <main>\n'
                '    <h1>Laptop Webcam Host</h1>\n'
                '    <img src="/stream.mjpg" alt="Laptop webcam stream">\n'
                '    <p>Snapshot: <a href="/snapshot.jpg">/snapshot.jpg</a></p>\n'
                '    <p>Detections: <a href="/detections.json">/detections.json</a></p>\n'
                '  </main>\n'
                '</body>\n'
                '</html>'
            )
            payload = page.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _send_snapshot(self):
            frame = camera_stream.get_frame()
            if frame is None:
                self.send_error(503, "Camera frame is not ready yet")
                return

            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(frame)))
            self.end_headers()
            self.wfile.write(frame)

        def _send_detections(self):
            payload = json.dumps(camera_stream.get_detections()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _send_stream(self):
            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()

            try:
                while True:
                    frame = camera_stream.get_frame()
                    if frame is None:
                        time.sleep(0.1)
                        continue

                    self.wfile.write(b"--frame\r\n")
                    self.wfile.write(b"Content-Type: image/jpeg\r\n")
                    self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii"))
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
                    time.sleep(camera_stream.frame_interval)
            except (BrokenPipeError, ConnectionResetError):
                return

    return WebcamHandler


def main():
    parser = argparse.ArgumentParser(description="Host a laptop USB webcam for phones on the same WiFi.")
    parser.add_argument("--camera", type=int, default=0, help="Webcam index. Try 1 if 0 does not work.")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address. Keep 0.0.0.0 for phone access.")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port.")
    parser.add_argument("--width", type=int, default=1280, help="Requested camera width.")
    parser.add_argument("--height", type=int, default=720, help="Requested camera height.")
    parser.add_argument("--fps", type=int, default=15, help="Stream frame rate.")
    parser.add_argument("--quality", type=int, default=80, help="JPEG quality from 1 to 100.")
    parser.add_argument("--model", default=None, help="YOLO .pt model path. Defaults to webcam/best.pt when present.")
    parser.add_argument("--confidence", type=float, default=0.35, help="YOLO confidence threshold.")
    parser.add_argument("--image-size", type=int, default=640, help="YOLO inference image size.")
    args = parser.parse_args()

    default_model = Path(__file__).with_name("best.pt")
    model_path = args.model if args.model is not None else (str(default_model) if default_model.exists() else "")

    camera_stream = CameraStream(
        args.camera,
        args.width,
        args.height,
        args.fps,
        args.quality,
        model_path,
        args.confidence,
        args.image_size,
    )
    camera_stream.start()

    server = ThreadingHTTPServer((args.host, args.port), make_handler(camera_stream))
    lan_ip = get_lan_ip()
    print(f"Laptop webcam host running at http://{lan_ip}:{args.port}/")
    print(f"Use this stream URL from another device: http://{lan_ip}:{args.port}/stream.mjpg")
    print("Open that URL on your phone while both devices are on the same WiFi.")
    print("Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping webcam host...")
    finally:
        server.server_close()
        camera_stream.stop()


if __name__ == "__main__":
    main()
