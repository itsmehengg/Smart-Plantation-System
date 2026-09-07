# Webcam MQTT + Node-RED Access

The USB webcam is connected to the computer running Node-RED. Other users can view the camera preview through Node-RED when they are on the same WiFi network.

## Start the Flask dashboard

From the project root, install the dashboard dependency and start Flask:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe app.py
```

Open `http://127.0.0.1:3000/` on the laptop. To open it from another device, use the laptop's LAN IP on port `3000`.

## Same WiFi Access

1. Connect the laptop and phone to the same WiFi network.
2. Start the webcam and YOLO API on the laptop:

```powershell
..\.venv\Scripts\python.exe webcam\capture_leaf.py --host 0.0.0.0 --port 5000
```

Before starting the service, configure the Supabase URL and publishable key:

```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_KEY = "your-supabase-publishable-key"
```

The API listens on all network interfaces at port `5000`. Put your detection model at `webcam/best.pt` and it will be loaded automatically. The camera is opened only when the dashboard capture button is pressed. Each annotated image is uploaded to the `plant-images` Supabase Storage bucket, then its public URL is inserted into `plant_sensor_readings.image_url`.

Run `supabase/create_plant_sensor_readings.sql` in Supabase SQL Editor first. It creates the table column, storage bucket, and storage policies used by the upload.

Captured annotated images and their detection results are saved in:

```text
webcam/plant_images/
```

3. If Windows Firewall prompts, allow Python access on **Private networks**. If the phone cannot connect, run PowerShell as Administrator once:

```powershell
New-NetFirewallRule -DisplayName "SmartPlant dashboard and webcam" -Direction Inbound -Protocol TCP -LocalPort 3000,5000 -Action Allow -Profile Private
```

4. On the phone, open the dashboard and enter only the laptop IP address in **Laptop IP address**, for example:

```text
192.168.1.25
```

Then press **Capture Photo + Detect**. The dashboard sends one capture request to `http://192.168.1.25:5000/capture_detect`.

If the model is stored elsewhere, provide its path explicitly:

```powershell
..\.venv\Scripts\python.exe webcam\capture_leaf.py --model "C:\path\to\best.pt" --host 0.0.0.0 --port 5000
```

Node-RED access is separate. To use it:

5. Start Node-RED on the computer that has the USB webcam.
6. Import and deploy:

```text
node-red/smart-plantation-combined-flow.json
```

7. On the webcam computer, find the IPv4 address:

```text
ipconfig
```

8. Other users open this URL in their browser:

```text
http://YOUR_COMPUTER_IP:1880/ui
```

Example:

```text
http://192.168.1.25:1880/ui
```

Do not use `127.0.0.1` on another device. That points to the other user's own device, not your computer.

## MQTT Camera Topics

Node-RED uses HiveMQ:

```text
broker.hivemq.com:1883
```

Command topic:

```text
smartplantation/camera/command
```

Supported payloads:

```text
START
CAPTURE
REFRESH
```

Status topic:

```text
smartplantation/camera/status
```

Latest image topic:

```text
smartplantation/camera/latest
```

## Different WiFi

A local IP like `192.168.x.x` only works on the same WiFi. For a different WiFi, use a tunnel such as ngrok or Cloudflare Tunnel, or configure router port forwarding.
