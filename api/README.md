# Leaf Colour Health API

Run this local API before using the dashboard webcam analysis.

```bash
cd api
pip install -r requirements.txt
uvicorn leaf_health_api:app --host 127.0.0.1 --port 8000
```

Endpoint:

```text
POST http://127.0.0.1:8000/leaf-health
```

The dashboard sends the captured webcam JPEG to this endpoint and shows the returned leaf colour condition.
