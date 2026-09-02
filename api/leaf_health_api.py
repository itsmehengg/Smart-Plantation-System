from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

app = FastAPI(title="Leaf Colour Health API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "running", "service": "Leaf Colour Health API"}


@app.post("/leaf-health")
async def analyse_leaf(file: UploadFile = File(...)):
    image_bytes = await file.read()
    image_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]
    brightness = hsv[:, :, 2]

    # Works best when the leaf is photographed on a plain white/light background.
    leaf_mask = ((saturation > 35) & (brightness > 25)).astype(np.uint8)

    contours, _ = cv2.findContours(
        leaf_mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    if not contours:
        raise HTTPException(status_code=422, detail="No leaf detected")

    largest_contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest_contour) < 300:
        raise HTTPException(status_code=422, detail="Leaf area is too small")

    leaf_mask = np.zeros_like(leaf_mask)
    cv2.drawContours(leaf_mask, [largest_contour], -1, 1, thickness=-1)

    leaf_pixels = leaf_mask == 1
    total_pixels = np.count_nonzero(leaf_pixels)

    if total_pixels == 0:
        raise HTTPException(status_code=422, detail="No leaf pixels detected")

    # OpenCV hue range is 0-179.
    green = leaf_pixels & (hue >= 35) & (hue <= 90)
    yellow = leaf_pixels & (hue >= 20) & (hue < 35)
    brown = leaf_pixels & (hue >= 0) & (hue < 20) & (brightness < 190)

    green_percentage = np.count_nonzero(green) / total_pixels * 100
    yellow_percentage = np.count_nonzero(yellow) / total_pixels * 100
    brown_percentage = np.count_nonzero(brown) / total_pixels * 100

    health_score = round(green_percentage, 2)
    stress_percentage = yellow_percentage + brown_percentage

    if brown_percentage >= 20:
        condition = "Possible potassium deficiency"
        advice = "Brown leaf colour is high. Check potassium level and lighting."
    elif green_percentage >= 70 and stress_percentage < 20:
        condition = "Healthy"
        advice = "Leaf is mostly green."
    elif green_percentage >= 40:
        condition = "Possibly stressed"
        advice = "Leaf still has green area, but yellow/brown colour is visible."
    else:
        condition = "Possibly unhealthy"
        advice = "Green area is low. Recheck plant nutrition and image lighting."

    return {
        "condition": condition,
        "health_score": health_score,
        "green_percentage": round(green_percentage, 2),
        "yellow_percentage": round(yellow_percentage, 2),
        "brown_percentage": round(brown_percentage, 2),
        "advice": advice,
        "warning": (
            "Colour-based estimation only. Thresholds should be calibrated "
            "for the plant species and lighting conditions."
        ),
    }
