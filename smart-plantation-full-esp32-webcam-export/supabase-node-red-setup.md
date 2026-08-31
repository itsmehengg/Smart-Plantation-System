# Supabase + Node-RED Sensor Upload Setup

## 1. Create the Supabase Table

Open your Supabase project, then go to:

```text
SQL Editor -> New query
```

Run this file:

```text
supabase/create_plant_sensor_readings.sql
```

This creates one table:

```text
plant_sensor_readings
```

Each row stores one sensor upload from the ESP32:

| Column | Meaning |
|---|---|
| created_at | Upload time |
| temperature | DHT11 temperature |
| humidity | DHT11 humidity |
| soil_moisture | Soil moisture percentage |
| soil_digital | Soil sensor digital wet/dry output |
| water_level | Ultrasonic water level percentage |
| water_distance_cm | Ultrasonic distance reading |
| soil_raw | Raw ESP32 analog value |

One table is better than one separate table per sensor because every reading from the ESP32 belongs to the same time point.

## 2. Import the Node-RED Flow

Import:

```text
node-red/smart-plantation-webcam-flow.json
```

The flow:

```text
ESP32 MQTT -> Node-RED dashboard gauges
ESP32 MQTT -> Node-RED dashboard sensor table
ESP32 MQTT -> Supabase plant_sensor_readings table
```

## 3. MQTT Topic

The ESP32 sensor unit publishes to:

```text
smartplantation/sensors
```

Node-RED listens to the same topic.

## 4. Supabase REST Insert

Node-RED sends data to:

```text
https://ntvknrblgmjauaznenpk.supabase.co/rest/v1/plant_sensor_readings
```

It uses the publishable key you provided in the `Prepare Supabase insert` function node.

## 5. Check If It Works

In Node-RED debug sidebar, check:

```text
Supabase insert result
```

If it works, you should see an inserted row returned from Supabase.

If it fails with permission/RLS error, rerun the SQL file and make sure the insert policy was created.
