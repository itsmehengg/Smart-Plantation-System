/*
  Smart Plantation System - ESP32 Relay Control Unit

  Board role:
  - ESP32 is powered from 5V through USB/VIN
  - Controls a 2-channel relay module
  - Receives pump/fan commands from Node-RED using MQTT

  Important:
  - ESP32 GPIO pins are still 3.3V logic, even when powered from 5V.
  - Most relay modules are active LOW. If your relay works backward, change RELAY_ACTIVE_LOW.

  Required Arduino library:
  - PubSubClient by Nick O'Leary

  MQTT commands:
  - smartplantation/control/pump payload: ON or OFF
  - smartplantation/control/fan payload: ON or OFF
*/

#include <WiFi.h>
#include <PubSubClient.h>

// ---------- WiFi settings ----------
const char* WIFI_SSID = "B33-20_samleezx-TIME";
const char* WIFI_PASSWORD = "01127118938";

// ---------- MQTT settings ----------
const char* MQTT_SERVER = "broker.hivemq.com";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "esp32_relay_unit";

const char* MQTT_PUMP_TOPIC = "smartplantation/control/pump";
const char* MQTT_FAN_TOPIC = "smartplantation/control/fan";
const char* MQTT_STATUS_TOPIC = "smartplantation/status/relay";

// ---------- Pin assignment ----------
const int RELAY_1_PUMP_PIN = 26; // Relay channel 1 IN1
const int RELAY_2_FAN_PIN = 27;  // Relay channel 2 IN2

const bool RELAY_ACTIVE_LOW = true;

WiFiClient espClient;
PubSubClient mqtt(espClient);

bool pumpOn = false;
bool fanOn = false;

void setRelay(int pin, bool on) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(pin, on ? LOW : HIGH);
  } else {
    digitalWrite(pin, on ? HIGH : LOW);
  }
}

void publishStatus() {
  char payload[80];
  snprintf(
    payload,
    sizeof(payload),
    "{\"pump\":\"%s\",\"fan\":\"%s\"}",
    pumpOn ? "ON" : "OFF",
    fanOn ? "ON" : "OFF"
  );

  mqtt.publish(MQTT_STATUS_TOPIC, payload, true);
  Serial.println(payload);
}

bool payloadIsOn(byte* payload, unsigned int length) {
  String command;
  for (unsigned int i = 0; i < length; i++) {
    command += (char)payload[i];
  }

  command.trim();
  command.toUpperCase();

  return command == "ON" || command == "1" || command == "TRUE";
}

bool payloadIsOff(byte* payload, unsigned int length) {
  String command;
  for (unsigned int i = 0; i < length; i++) {
    command += (char)payload[i];
  }

  command.trim();
  command.toUpperCase();

  return command == "OFF" || command == "0" || command == "FALSE";
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message on ");
  Serial.println(topic);

  bool isOn = payloadIsOn(payload, length);
  bool isOff = payloadIsOff(payload, length);

  if (!isOn && !isOff) {
    Serial.println("Unknown command. Use ON or OFF.");
    return;
  }

  if (String(topic) == MQTT_PUMP_TOPIC) {
    pumpOn = isOn;
    setRelay(RELAY_1_PUMP_PIN, pumpOn);
  }

  if (String(topic) == MQTT_FAN_TOPIC) {
    fanOn = isOn;
    setRelay(RELAY_2_FAN_PIN, fanOn);
  }

  publishStatus();
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");

    if (mqtt.connect(MQTT_CLIENT_ID)) {
      Serial.println("connected");
      mqtt.subscribe(MQTT_PUMP_TOPIC);
      mqtt.subscribe(MQTT_FAN_TOPIC);
      publishStatus();
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      Serial.println(". Retrying in 3 seconds");
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_1_PUMP_PIN, OUTPUT);
  pinMode(RELAY_2_FAN_PIN, OUTPUT);

  setRelay(RELAY_1_PUMP_PIN, false);
  setRelay(RELAY_2_FAN_PIN, false);

  connectWiFi();
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqtt.connected()) {
    connectMQTT();
  }

  mqtt.loop();
}
