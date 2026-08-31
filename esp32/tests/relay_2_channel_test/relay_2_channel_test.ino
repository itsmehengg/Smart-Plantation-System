/*
  2-Channel Relay Test for ESP32

  This test does not use WiFi or MQTT.
  It turns relay channel 1 and channel 2 ON/OFF repeatedly.

  Wiring:
  Relay VCC -> ESP32 5V/VIN
  Relay GND -> ESP32 GND
  Relay IN1 -> ESP32 GPIO 26
  Relay IN2 -> ESP32 GPIO 27

  Expected result:
  - CH1 LED turns ON, relay clicks, then turns OFF
  - CH2 LED turns ON, relay clicks, then turns OFF

  Most 2-channel relay modules are active LOW:
  LOW  = relay ON
  HIGH = relay OFF
*/

const int RELAY_1_PUMP_PIN = 26;
const int RELAY_2_FAN_PIN = 27;

const bool RELAY_ACTIVE_LOW = true;

void setRelay(int pin, bool on) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(pin, on ? LOW : HIGH);
  } else {
    digitalWrite(pin, on ? HIGH : LOW);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_1_PUMP_PIN, OUTPUT);
  pinMode(RELAY_2_FAN_PIN, OUTPUT);

  setRelay(RELAY_1_PUMP_PIN, false);
  setRelay(RELAY_2_FAN_PIN, false);

  Serial.println("2-channel relay test started");
  Serial.println("CH1 / IN1: GPIO 26");
  Serial.println("CH2 / IN2: GPIO 27");
}

void loop() {
  Serial.println("Relay CH1 ON");
  setRelay(RELAY_1_PUMP_PIN, true);
  setRelay(RELAY_2_FAN_PIN, false);
  delay(2000);

  Serial.println("Relay CH1 OFF");
  setRelay(RELAY_1_PUMP_PIN, false);
  delay(1000);

  Serial.println("Relay CH2 ON");
  setRelay(RELAY_1_PUMP_PIN, false);
  setRelay(RELAY_2_FAN_PIN, true);
  delay(2000);

  Serial.println("Relay CH2 OFF");
  setRelay(RELAY_2_FAN_PIN, false);
  delay(1000);

  Serial.println("Both relays ON");
  setRelay(RELAY_1_PUMP_PIN, true);
  setRelay(RELAY_2_FAN_PIN, true);
  delay(2000);

  Serial.println("Both relays OFF");
  setRelay(RELAY_1_PUMP_PIN, false);
  setRelay(RELAY_2_FAN_PIN, false);
  delay(3000);
}
