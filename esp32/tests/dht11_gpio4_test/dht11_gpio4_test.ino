/*
  DHT11 GPIO 16 Test Sketch
  
  Requirements:
  - Install the "DHT sensor library" by Adafruit via the Library Manager.
  - Also ensure you have the "Adafruit Unified Sensor" library installed.
*/

#include <DHT.h>

#define DHTPIN 16     // Pin connected to the DHT11 data pin
#define DHTTYPE DHT11 // Defining sensor type as DHT11

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  delay(1000); // Allow system to settle
  
  dht.begin();
  Serial.println("\nDHT11 GPIO 16 diagnostic test started...");
}

void loop() {
  // Wait 2 seconds between measurements (DHT11 updates roughly every 2s)
  delay(2000);

  // Read humidity and temperature in Celsius
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // Check if readings failed and exit early to try again
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Error: Failed to read from DHT sensor! Check VCC, GND, and DATA wiring.");
    return;
  }

  // Print successful results
  Serial.print("Temperature: ");
  Serial.print(temperature, 1);
  Serial.print(" °C  |  Humidity: ");
  Serial.print(humidity, 1);
  Serial.println(" %");
}