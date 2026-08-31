# Smart Plantation System ESP32 Pin Assignment

## Device Roles

| Device | Main role |
|---|---|
| ESP32 sensor unit | Read sensors and publish values to Node-RED |
| ESP32 relay unit | Control the 2-channel relay for pump and fan |
| Computer | Run Node-RED, Supabase upload flow, and USB webcam capture |

Important: even if an ESP32 is powered from `5V/VIN` or USB, its GPIO pins are still `3.3V` logic only. Do not connect any `5V` signal directly into an ESP32 GPIO pin.

## ESP32 Sensor Unit Pin Guide

Upload the sensor sketch to this ESP32:

```text
esp32/sensor_unit_3v3/sensor_unit_3v3.ino
```

| Feature | ESP32 pin | Module connection |
|---|---:|---|
| DHT11 temperature and humidity | GPIO 16 | DHT11 DATA / S |
| Soil moisture analog reading | GPIO 33 | Soil sensor AO |
| Soil moisture digital test, optional | GPIO 23 | Soil sensor DO |
| Ultrasonic water level TRIG | GPIO 18 | Ultrasonic TRIG |
| Ultrasonic water level ECHO | GPIO 19 | Ultrasonic ECHO through voltage divider |

Sensor unit wiring:

```text
DHT11 VCC  -> ESP32 3V3
DHT11 GND  -> ESP32 GND
DHT11 DATA -> ESP32 GPIO 16

Soil sensor VCC -> ESP32 3V3
Soil sensor GND -> ESP32 GND
Soil sensor AO  -> ESP32 GPIO 22
Soil sensor DO  -> ESP32 GPIO 23, optional digital wet/dry test

Ultrasonic VCC  -> ESP32 5V/VIN, if using HC-SR04
Ultrasonic GND  -> ESP32 GND
Ultrasonic TRIG -> ESP32 GPIO 18
Ultrasonic ECHO -> voltage divider -> ESP32 GPIO 19
```

Use `AO -> GPIO 33` when you want soil moisture percentage.

Use `DO -> GPIO 23` only when you want a simple wet/dry signal.

For HC-SR04, do not connect `ECHO` directly to the ESP32. Use this voltage divider:

```text
HC-SR04 ECHO -> 1k resistor -> ESP32 GPIO 19
ESP32 GPIO 19 -> 2k resistor -> GND
```

## ESP32 Relay Unit Pin Guide

Upload the relay sketch to this ESP32:

```text
esp32/relay_unit_5v/relay_unit_5v.ino
```

| Feature | ESP32 pin | Relay connection |
|---|---:|---|
| Relay channel 1, pump | GPIO 26 | Relay IN1 |
| Relay channel 2, fan | GPIO 27 | Relay IN2 |
| Relay VCC | 5V/VIN | Relay VCC |
| Relay GND | GND | Relay GND |

Relay control wiring:

```text
Relay VCC -> ESP32 5V/VIN
Relay GND -> ESP32 GND
Relay IN1 -> ESP32 GPIO 26
Relay IN2 -> ESP32 GPIO 27
```

Relay channel assignment:

```text
Relay Channel 1 -> Water pump
Relay Channel 2 -> Fan
```

Pump on relay channel 1:

```text
Pump power supply + -> Relay CH1 COM
Relay CH1 NO        -> Pump +
Pump -              -> Pump power supply -
```

Fan on relay channel 2:

```text
Fan power supply + -> Relay CH2 COM
Relay CH2 NO       -> Fan +
Fan -              -> Fan power supply -
```

Use `NO` if the pump/fan should normally be off and turn on only when the relay activates.

## Shared Power And Ground

If the two ESP32 boards only communicate through WiFi/MQTT, they do not need signal wires between them.

If any module or signal is shared between both ESP32 boards, connect the grounds together:

```text
Sensor ESP32 GND -> Relay ESP32 GND
```

For pump and fan, use a separate power supply that matches the device voltage/current. Do not power pump or fan from ESP32 GPIO.

## Ultrasonic Tank Calibration

Mount the ultrasonic sensor at the top of the water tank facing downward.

In the sensor Arduino code, change these values to match your tank:

```cpp
const float TANK_EMPTY_DISTANCE_CM = 20.0;
const float TANK_FULL_DISTANCE_CM = 4.0;
```

Example:

```text
Empty tank distance from sensor to water = 25 cm
Full tank distance from sensor to water = 5 cm
```

Then set:

```cpp
const float TANK_EMPTY_DISTANCE_CM = 25.0;
const float TANK_FULL_DISTANCE_CM = 5.0;
```

## MQTT Topics

The sensor ESP32 publishes sensor readings to:

```text
smartplantation/sensors
```

The relay ESP32 listens for commands:

```text
smartplantation/control/pump
smartplantation/control/fan
```

The relay ESP32 publishes relay status:

```text
smartplantation/status/relay
```

## Current Test Sketches

DHT11 only:

```text
esp32/tests/dht11_gpio4_test/dht11_gpio4_test.ino
```

Soil moisture digital test on GPIO 23:

```text
esp32/tests/soil_moisture_gpio23_digital_test/soil_moisture_gpio23_digital_test.ino
```

DHT11 + ultrasonic test:

```text
esp32/tests/dht11_ultrasonic_test/dht11_ultrasonic_test.ino
```

## Before Uploading

Disconnect wires from these boot-sensitive pins if upload fails:

```text
GPIO 0
GPIO 2
GPIO 12
GPIO 15
TX0
RX0
```

The current selected pins avoid those boot-sensitive pins.
