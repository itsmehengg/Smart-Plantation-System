# Webcam MQTT + Node-RED Access

The USB webcam is connected to the computer running Node-RED. Other users can view the camera preview through Node-RED when they are on the same WiFi network.

## Same WiFi Access

1. Connect the laptop and phone to the same WiFi network.
2. Start the webcam host on the laptop:

```powershell
python webcam\stream_host.py
```

The host listens on all network interfaces and prints the laptop's local IP address. The default port is `8000`. Put your detection model at `webcam/best.pt` and it will be loaded automatically.

3. If Windows Firewall prompts, allow Python access on **Private networks**. If the phone cannot connect, run PowerShell as Administrator once:

```powershell
New-NetFirewallRule -DisplayName "SmartPlant webcam" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```

4. On the phone, open the dashboard and enter only the laptop IP address in **Laptop IP address**, for example:

```text
192.168.1.25
```

Then press **Load Network Stream**. The dashboard automatically uses `http://192.168.1.25:8000/stream.mjpg`.

If the model is stored elsewhere, provide its path explicitly:

```powershell
python webcam\stream_host.py --model "C:\path\to\best.pt"
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
