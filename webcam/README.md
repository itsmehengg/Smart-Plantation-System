# Webcam MQTT + Node-RED Access

The USB webcam is connected to the computer running Node-RED. Other users can view the camera preview through Node-RED when they are on the same WiFi network.

## Same WiFi Access

1. Start Node-RED on the computer that has the USB webcam.
2. Import and deploy:

```text
node-red/smart-plantation-combined-flow.json
```

3. On the webcam computer, find the IPv4 address:

```text
ipconfig
```

4. Other users open this URL in their browser:

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
