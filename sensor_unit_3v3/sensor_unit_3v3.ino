#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <math.h>

const char* WIFI_SSID = "B100M-T3";
const char* WIFI_PASSWORD = "12345678";

const char* MQTT_SERVER = "broker.hivemq.com";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID_PREFIX = "esp32_sensor_unit_";
const char* MQTT_SENSOR_TOPIC = "smartplantation/sensors";

const char* SENSOR_OUTPUT_FORMAT =
  "{\"temperature\":%s,\"humidity\":%s,\"soil_moisture\":%d,\"soil_digital\":%d,\"water_level\":%d,\"water_level_status\":\"%s\",\"water_distance_cm\":%.1f,\"soil_raw\":%d}";

const int DHT_PIN = 16;
const int SOIL_PIN = 34;
const int SOIL_DIGITAL_PIN = 23;
const int ULTRASONIC_TRIG_PIN = 18;
const int ULTRASONIC_ECHO_PIN = 19;

#define DHT_TYPE DHT22

const float TEMPERATURE_OFFSET_C = 0.0;
const float HUMIDITY_OFFSET_PERCENT = 0.0;

const int SOIL_DRY_VALUE = 3200;
const int SOIL_WET_VALUE = 1200;

const float TANK_EMPTY_DISTANCE_CM = 20.0;
const float TANK_FULL_DISTANCE_CM = 4.0;

const unsigned long PUBLISH_INTERVAL_MS = 5000;

const int DHT_RETRY_COUNT = 3;
const int DHT_RETRY_DELAY_MS = 1200;

WiFiClient espClient;
PubSubClient mqtt(espClient);
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastPublishMs = 0;

const char* wifiStatusText(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      return "idle";
    case WL_NO_SSID_AVAIL:
      return "SSID not found";
    case WL_SCAN_COMPLETED:
      return "scan completed";
    case WL_CONNECTED:
      return "connected";
    case WL_CONNECT_FAILED:
      return "connect failed";
    case WL_CONNECTION_LOST:
      return "connection lost";
    case WL_DISCONNECTED:
      return "disconnected";
    default:
      return "unknown";
  }
}

int clampPercent(int value) {
  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

int readStableSoilRaw() {
  long total = 0;
  const int sampleCount = 10;

  for (int i = 0; i < sampleCount; i++) {
    int raw = analogRead(SOIL_PIN);
    total += raw;
    delay(20);
  }

  return total / sampleCount;
}

int soilPercentFromRaw(int rawValue) {
  int percent = map(
    rawValue,
    SOIL_DRY_VALUE,
    SOIL_WET_VALUE,
    0,
    100
  );

  return clampPercent(percent);
}

int waterPercentFromDistance(float distanceCm) {
  if (distanceCm < 0) {
    return 0;
  }

  int percent = map(
    (int)(distanceCm * 10),
    (int)(TANK_EMPTY_DISTANCE_CM * 10),
    (int)(TANK_FULL_DISTANCE_CM * 10),
    0,
    100
  );

  return clampPercent(percent);
}

float readUltrasonicDistanceCm() {
  digitalWrite(
    ULTRASONIC_TRIG_PIN,
    LOW
  );

  delayMicroseconds(2);

  digitalWrite(
    ULTRASONIC_TRIG_PIN,
    HIGH
  );

  delayMicroseconds(10);

  digitalWrite(
    ULTRASONIC_TRIG_PIN,
    LOW
  );

  unsigned long duration =
    pulseIn(
      ULTRASONIC_ECHO_PIN,
      HIGH,
      30000
    );

  if (duration == 0) {
    return -1.0;
  }

  return duration * 0.0343 / 2.0;
}

bool isDhtReadingValid(
  float temperature,
  float humidity
) {
  if (
    isnan(temperature) ||
    isnan(humidity)
  ) {
    return false;
  }

  return
    temperature >= -10.0 &&
    temperature <= 60.0 &&
    humidity >= 0.0 &&
    humidity <= 100.0;
}

bool readDhtReadings(
  float* temperature,
  float* humidity
) {
  for (
    int attempt = 0;
    attempt < DHT_RETRY_COUNT;
    attempt++
  ) {
    float newHumidity =
      dht.readHumidity();

    float newTemperature =
      dht.readTemperature();

    if (
      isDhtReadingValid(
        newTemperature,
        newHumidity
      )
    ) {
      newTemperature +=
        TEMPERATURE_OFFSET_C;

      newHumidity +=
        HUMIDITY_OFFSET_PERCENT;

      if (newHumidity < 0.0) {
        newHumidity = 0.0;
      }

      if (newHumidity > 100.0) {
        newHumidity = 100.0;
      }

      *temperature =
        newTemperature;

      *humidity =
        newHumidity;

      return true;
    }

    if (
      attempt <
      DHT_RETRY_COUNT - 1
    ) {
      delay(
        DHT_RETRY_DELAY_MS
      );
    }
  }

  *temperature = NAN;
  *humidity = NAN;

  return false;
}

void formatJsonFloat(
  char* output,
  size_t outputSize,
  float value
) {
  if (isnan(value)) {
    snprintf(
      output,
      outputSize,
      "null"
    );
  } else {
    snprintf(
      output,
      outputSize,
      "%.1f",
      value
    );
  }
}

void printReadableSensorData(
  float temperature,
  float humidity,
  int soilMoisture,
  int soilRaw,
  int soilDigital,
  int waterLevel,
  float waterDistanceCm
) {
  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.print(
    "temperature: "
  );

  if (isnan(temperature)) {
    Serial.println(
      "not detected"
    );
  } else {
    Serial.print(
      temperature,
      1
    );

    Serial.println(" C");
  }

  Serial.print(
    "humidity: "
  );

  if (isnan(humidity)) {
    Serial.println(
      "not detected"
    );
  } else {
    Serial.print(
      humidity,
      1
    );

    Serial.println("%");
  }

  Serial.print(
    "soil raw: "
  );

  Serial.println(
    soilRaw
  );

  Serial.print(
    "soil moisture: "
  );

  Serial.print(
    soilMoisture
  );

  Serial.println("%");

  Serial.print(
    "soil digital: "
  );

  Serial.println(
    soilDigital
  );

  Serial.print(
    "water level: "
  );

  Serial.print(
    waterLevel
  );

  Serial.println("%");

  Serial.print(
    "water status: "
  );

  Serial.println(
    waterLevel >= 80
      ? "full"
      : "not full"
  );

  Serial.print(
    "water distance cm: "
  );

  if (waterDistanceCm < 0) {
    Serial.println(
      "not detected"
    );
  } else {
    Serial.print(
      waterDistanceCm,
      1
    );

    Serial.println(" cm");
  }

  Serial.println(
    "================================"
  );
}

const char* waterLevelStatus(
  int waterLevel
) {
  return waterLevel >= 80
    ? "full"
    : "not full";
}

bool connectWiFi() {
  Serial.print(
    "Connecting to WiFi"
  );

  Serial.print(
    " SSID: "
  );

  Serial.println(
    WIFI_SSID
  );

  WiFi.mode(
    WIFI_STA
  );

  WiFi.disconnect(true);

  delay(1000);

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  unsigned long startMs =
    millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startMs < 20000
  ) {
    delay(500);
    Serial.print(".");
  }

  if (
    WiFi.status() == WL_CONNECTED
  ) {
    Serial.println();

    Serial.print(
      "WiFi connected. IP: "
    );

    Serial.println(
      WiFi.localIP()
    );

    return true;
  }

  Serial.println();

  Serial.print(
    "WiFi connection failed. Status: "
  );

  Serial.println(
    wifiStatusText(
      WiFi.status()
    )
  );

  Serial.println(
    "Check SSID/password and make sure the WiFi is 2.4GHz."
  );

  return false;
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print(
      "Connecting to MQTT..."
    );

    String clientId =
      String(
        MQTT_CLIENT_ID_PREFIX
      ) +
      String(
        (uint32_t)ESP.getEfuseMac(),
        HEX
      );

    if (
      mqtt.connect(
        clientId.c_str()
      )
    ) {
      Serial.println(
        "connected"
      );

      Serial.print(
        "MQTT topic: "
      );

      Serial.println(
        MQTT_SENSOR_TOPIC
      );

    } else {
      Serial.print(
        "failed, rc="
      );

      Serial.print(
        mqtt.state()
      );

      Serial.println(
        ". Retrying in 3 seconds"
      );

      delay(3000);
    }
  }
}

void publishSensorData() {

  float temperature = NAN;
  float humidity = NAN;

  bool dhtDetected =
    readDhtReadings(
      &temperature,
      &humidity
    );

  int soilRaw =
    readStableSoilRaw();

  int soilMoisture =
    soilPercentFromRaw(
      soilRaw
    );

  int soilDigital =
    digitalRead(
      SOIL_DIGITAL_PIN
    );

  float waterDistanceCm =
    readUltrasonicDistanceCm();

  int waterLevel =
    waterPercentFromDistance(
      waterDistanceCm
    );

  const char* waterStatus =
    waterLevelStatus(
      waterLevel
    );

  if (!dhtDetected) {
    Serial.println(
      "DHT22 read failed. Check VCC, GND, DATA pin, and sensor type."
    );
  }

  printReadableSensorData(
    temperature,
    humidity,
    soilMoisture,
    soilRaw,
    soilDigital,
    waterLevel,
    waterDistanceCm
  );

  char temperatureJson[16];
  char humidityJson[16];

  formatJsonFloat(
    temperatureJson,
    sizeof(temperatureJson),
    temperature
  );

  formatJsonFloat(
    humidityJson,
    sizeof(humidityJson),
    humidity
  );

  char payload[256];

  snprintf(
    payload,
    sizeof(payload),
    SENSOR_OUTPUT_FORMAT,
    temperatureJson,
    humidityJson,
    soilMoisture,
    soilDigital,
    waterLevel,
    waterStatus,
    waterDistanceCm,
    soilRaw
  );

  Serial.println(
    "MQTT Payload:"
  );

  Serial.println(
    payload
  );

  bool published =
    mqtt.publish(
      MQTT_SENSOR_TOPIC,
      payload
    );

  if (!published) {
    Serial.println(
      "{\"mqtt_publish\":\"FAILED\"}"
    );
  } else {
    Serial.println(
      "MQTT publish: SUCCESS"
    );
  }
}

void setup() {

  Serial.begin(
    115200
  );

  delay(1000);

  dht.begin();

  analogReadResolution(
    12
  );

  pinMode(
    SOIL_PIN,
    INPUT
  );

  pinMode(
    SOIL_DIGITAL_PIN,
    INPUT
  );

  pinMode(
    ULTRASONIC_TRIG_PIN,
    OUTPUT
  );

  pinMode(
    ULTRASONIC_ECHO_PIN,
    INPUT
  );

  digitalWrite(
    ULTRASONIC_TRIG_PIN,
    LOW
  );

  connectWiFi();

  mqtt.setServer(
    MQTT_SERVER,
    MQTT_PORT
  );
}

void loop() {

  if (
    WiFi.status() != WL_CONNECTED
  ) {
    connectWiFi();

    delay(5000);

    return;
  }

  if (!mqtt.connected()) {
    connectMQTT();
  }

  mqtt.loop();

  unsigned long now =
    millis();

  if (
    now - lastPublishMs >=
    PUBLISH_INTERVAL_MS
  ) {
    lastPublishMs = now;

    publishSensorData();
  }
}