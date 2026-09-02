# Webcam Leaf Health Integration

This folder contains the webcam capture helper and the local FastAPI/OpenCV leaf colour analysis API.

## Start the Leaf Health API

Double-click:

```text
start_leaf_health_api.bat
```

Or run manually:

```bash
cd webcam
pip install -r requirements.txt
uvicorn leaf_health_api:app --host 127.0.0.1 --port 8000
```

## Dashboard Flow

1. Start this API.
2. Open `dashboard.html` from localhost or GitHub Pages.
3. Click **Start Camera**.
4. Click **Capture**.
5. The dashboard sends the captured image to:

```text
http://127.0.0.1:8000/leaf-health
```

The API returns green, yellow, and brown percentages plus a leaf health condition.

## Meaning

- Mostly green: Healthy
- High brown: Possible potassium deficiency
- Yellow/brown mixed: Possibly stressed
