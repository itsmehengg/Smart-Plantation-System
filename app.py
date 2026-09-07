import cv2
import numpy as np
from flask import Flask, Response
from flask_cors import CORS
import socket

app = Flask(__name__)
# Enable CORS so your HTML dashboard can access the stream from any port
CORS(app) 

# 0 is the default laptop webcam or USB camera
camera = cv2.VideoCapture(1)

def detect_leaf_anomaly(frame):
    # Convert to HSV color space for accurate color filtering
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Healthy Green HSV range
    lower_green = np.array([35, 40, 40])
    upper_green = np.array([85, 255, 255])
    
    # Anomaly (Yellow/Brown) HSV range
    lower_anomaly = np.array([10, 50, 50])
    upper_anomaly = np.array([34, 255, 255])

    # Create masks
    mask_green = cv2.inRange(hsv, lower_green, upper_green)
    mask_anomaly = cv2.inRange(hsv, lower_anomaly, upper_anomaly)
    mask_leaf = cv2.bitwise_or(mask_green, mask_anomaly)

    # Find contours
    contours, _ = cv2.findContours(mask_leaf, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for contour in contours:
        if cv2.contourArea(contour) > 3000: # Ignore small noise
            x, y, w, h = cv2.boundingRect(contour)
            
            roi_green = mask_green[y:y+h, x:x+w]
            roi_anomaly = mask_anomaly[y:y+h, x:x+w]
            
            green_pixels = cv2.countNonZero(roi_green)
            anomaly_pixels = cv2.countNonZero(roi_anomaly)
            total_pixels = green_pixels + anomaly_pixels
            
            if total_pixels > 0:
                anomaly_ratio = anomaly_pixels / total_pixels
                
                # If > 15% is yellow/brown, flag as anomaly
                if anomaly_ratio > 0.15:
                    color = (0, 0, 255) # Red
                    label = f"Anomaly: {anomaly_ratio:.1%}"
                else:
                    color = (0, 255, 0) # Green
                    label = f"Healthy: {1 - anomaly_ratio:.1%} Green"
                    
                cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
                cv2.putText(frame, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    return frame

def gen_frames():
    while True:
        success, frame = camera.read()
        if not success:
            break
        else:
            frame = detect_leaf_anomaly(frame)
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

if __name__ == '__main__':
    ip = get_local_ip()
    print(f"\n✅ Server running! Stream URL: http://{ip}:5000/video_feed\n")
    app.run(host='0.0.0.0', port=5000, debug=False)