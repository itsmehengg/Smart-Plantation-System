/*
  Soil Moisture Digital Test - GPIO 23

  Use this when your soil moisture module is connected by DO.

  Wiring:
  Soil sensor VCC -> ESP32 3V3
  Soil sensor GND -> ESP32 GND
  Soil sensor DO  -> ESP32 GPIO 23

  Note:
  GPIO 23 is digital only for this sensor test.
  If you want moisture percentage, connect AO to an ADC pin such as GPIO 33.
*/

const int SOIL_DIGITAL_PIN = 23;

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(SOIL_DIGITAL_PIN, INPUT);

  Serial.println("Soil moisture digital test started");
  Serial.println("Sensor DO connected to ESP32 GPIO 23");
}

void loop() {
  int soilState = digitalRead(SOIL_DIGITAL_PIN);

  Serial.print("GPIO 23 state: ");
  Serial.print(soilState);
  Serial.print(" -> ");

  if (soilState == HIGH) {
    Serial.println("HIGH");
  } else {
    Serial.println("LOW");
  }

  delay(1000);
}
