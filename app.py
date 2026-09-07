import cv2
import numpy as np
from flask import Flask, render_template, Response
import socket

app = Flask(__name__)
camera = cv2.VideoCapture(0) # 0 is usually the built-in or USB webcam

def detect_leaf_anomaly(frame):
    # Convert to HSV color space for better color filtering
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

    # Define HSV range for Healthy Green
    lower_green = np.array([35, 40, 40])
    upper_green = np.array([85, 255, 255])
    
    # Define HSV range for Anomaly (Yellow/Brown)
    lower_anomaly = np.array([10, 50, 50])
    upper_anomaly = np.array([34, 255, 255])

    # Create masks
    mask_green = cv2.inRange(hsv, lower_green, upper_green)
    mask_anomaly = cv2.inRange(hsv, lower_anomaly, upper_anomaly)
    
    # Combine masks to find the whole leaf
    mask_leaf = cv2.bitwise_or(mask_green, mask_anomaly)

    # Find contours of the leaf
    contours, _ = cv2.findContours(mask_leaf, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for contour in contours:
        area = cv2.contourArea(contour)
        if area > 2000: # Ignore small background noise
            x, y, w, h = cv2.boundingRect(contour)
            
            # Extract the region of interest (ROI) for the detected leaf
            roi_green = mask_green[y:y+h, x:x+w]
            roi_anomaly = mask_anomaly[y:y+h, x:x+w]
            
            # Count pixels
            green_pixels = cv2.countNonZero(roi_green)
            anomaly_pixels = cv2.countNonZero(roi_anomaly)
            total_pixels = green_pixels + anomaly_pixels
            
            if total_pixels > 0:
                anomaly_ratio = anomaly_pixels / total_pixels
                
                # If more than 15% of the leaf is yellow/brown, flag as anomaly
                if anomaly_ratio > 0.15:
                    color = (0, 0, 255) # Red bounding box
                    label = f"Anomaly Detected ({anomaly_ratio:.1%})"
                else:
                    color = (0, 255, 0) # Green bounding box
                    label = f"Healthy ({1 - anomaly_ratio:.1%} Green)"
                    
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
            # Encode the frame in JPEG format
            ret, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            # Yield the output frame in the byte format
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == '__main__':
    local_ip = get_local_ip()
    print(f"\n" + "="*50)
    print(f"🚀 SERVER RUNNING! Access your camera stream here:")
    print(f"👉 http://{local_ip}:5000")
    print("="*50 + "\n")
    
    # Host on 0.0.0.0 to make it accessible to other devices on your local network
    app.run(host='0.0.0.0', port=5000, debug=False)