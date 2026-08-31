/*
  DHT11 + Ultrasonic Sensor Test

  Use this sketch to test only:
  - DHT11 temperature/humidity sensor
  - Ultrasonic water level sensor

  No WiFi. No MQTT. Open Serial Monitor at 115200 baud.

  Wiring:
  DHT11 VCC   -> ESP32 3V3
  DHT11 GND   -> ESP32 GND
  DHT11 DATA  -> ESP32 GPIO 16

  Ultrasonic VCC  -> ESP32 5V/VIN for HC-SR04, or 3V3 if your module supports it
  Ultrasonic GND  -> ESP32 GND
  Ultrasonic TRIG -> ESP32 GPIO 18
  Ultrasonic ECHO -> ESP32 GPIO 19

  Important for HC-SR04:
  The ECHO pin is usually 5V. ESP32 GPIO is 3.3V only.
  Use a voltage divider:
  ECHO -> 1k resistor -> GPIO 19
  GPIO 19 -> 2k resistor -> GND
*/

#include <DHT.h>

const int DHT_PIN = 16;
const int ULTRASONIC_TRIG_PIN = 18;
const int ULTRASONIC_ECHO_PIN = 19;

#define DHT_TYPE DHT11

const float TANK_EMPTY_DISTANCE_CM = 20.0;
const float TANK_FULL_DISTANCE_CM = 4.0;

DHT dht(DHT_PIN, DHT_TYPE);

int clampPercent(int value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

float readUltrasonicDistanceCm() {
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    return -1.0;
  }

  return duration * 0.0343 / 2.0;
}

int waterPercentFromDistance(float distanceCm) {
  if (distanceCm < 0) return -1;

  int percent = map(
    (int)(distanceCm * 10),
    (int)(TANK_EMPTY_DISTANCE_CM * 10),
    (int)(TANK_FULL_DISTANCE_CM * 10),
    0,
    100
  );

  return clampPercent(percent);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  dht.begin();
  pinMode(ULTRASONIC_TRIG_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  Serial.println("DHT11 + Ultrasonic test started");
  Serial.println("DHT11 DATA: GPIO 16");
  Serial.println("Ultrasonic TRIG: GPIO 18");
  Serial.println("Ultrasonic ECHO: GPIO 19");
  Serial.println();
}

void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  float distanceCm = readUltrasonicDistanceCm();
  int waterLevel = waterPercentFromDistance(distanceCm);

  Serial.println("----- Sensor Test -----");

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT11: FAILED");
    Serial.println("Check VCC, GND, DATA to GPIO 16, and sensor pin order.");
  } else {
    Serial.print("Temperature: ");
    Serial.print(temperature, 1);
    Serial.println(" C");

    Serial.print("Humidity: ");
    Serial.print(humidity, 1);
    Serial.println(" %");
  }

  if (distanceCm < 0) {
    Serial.println("Ultrasonic: FAILED");
    Serial.println("Check TRIG GPIO 18, ECHO GPIO 19, GND, VCC, and voltage divider.");
  } else {
    Serial.print("Distance: ");
    Serial.print(distanceCm, 1);
    Serial.println(" cm");

    Serial.print("Water Level: ");
    Serial.print(waterLevel);
    Serial.println(" %");
  }

  Serial.println();
  delay(2000);
}
