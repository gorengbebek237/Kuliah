#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#define SOIL_PIN 34
#define RELAY_PUMP 16

LiquidCrystal_I2C lcd(0x27, 20, 4);

const int SOIL_DRY = 40;

unsigned long lastTimeSensor = 0;
const unsigned long timerDelaySensor = 2000;

int lastSoil = 0;
bool pumpState = false;

void setup() {
  Serial.begin(115200);

  Wire.begin(21, 22);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("Memulai Sistem...");

  pinMode(RELAY_PUMP, OUTPUT);
  digitalWrite(RELAY_PUMP, LOW);

  delay(2000);
  lcd.clear();
  Serial.println("Sistem Berjalan");
}

void loop() {
  // Membaca Sensor dan Mengatur Pompa (Setiap 2 detik)
  if (millis() - lastTimeSensor >= timerDelaySensor) {
    lastTimeSensor = millis();

    int soilAnalog = analogRead(SOIL_PIN);
    
    // Mapping nilai analog ke persen (0-100%)
    lastSoil = map(soilAnalog, 4095, 1000, 0, 100);
    lastSoil = constrain(lastSoil, 0, 100);

    // --- LOGIKA KONTROL POMPA ---
    pumpState = (lastSoil < SOIL_DRY);
    digitalWrite(RELAY_PUMP, pumpState ? HIGH : LOW);

    // --- TAMPILAN LCD ---
    lcd.setCursor(0,0);
    lcd.print("Kelembapan Tanah");

    lcd.setCursor(0,1);
    lcd.print("Nilai : ");
    lcd.print(lastSoil);
    lcd.print("%    ");

    lcd.setCursor(0,2);
    lcd.print("Pompa : ");
    if (pumpState) lcd.print("ON ");
    else lcd.print("OFF");
    lcd.print("      ");

    // Menampilkan status sistem di baris ke-4
    lcd.setCursor(0,3);
    lcd.print("Kinanthi Maya Oktavi");

    // Output ke Serial Monitor
    Serial.print("Soil: ");
    Serial.print(lastSoil);
    Serial.print("% | Pump: ");
    Serial.println(pumpState ? "ON" : "OFF");
  }
}
