#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <ThingSpeak.h>

#define SOIL_PIN 34
#define RELAY_PUMP 16

const char* ssid = "Maman";
const char* password = "test1234";

unsigned long myChannelNumber = 3435512;
const char *myWriteAPIKey = "QIV86U03H0WQUSIM";

WiFiClient client;
LiquidCrystal_I2C lcd(0x27, 20, 4);

const int SOIL_DRY = 40;

unsigned long lastTimeCloud = 0;
const unsigned long timerDelayCloud = 20000;

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
  lcd.print("Memulai Sistem");

  pinMode(RELAY_PUMP, OUTPUT);
  digitalWrite(RELAY_PUMP, LOW);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  lcd.setCursor(0,1);
  lcd.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi Connected");
  Serial.println(WiFi.localIP());

  lcd.setCursor(0,2);
  lcd.print("WiFi Connected");

  ThingSpeak.begin(client);

  delay(2000);
  lcd.clear();
}

void loop() {
  // 1. Membaca Sensor dan Mengatur Pompa (Setiap 2 detik)
  if (millis() - lastTimeSensor >= timerDelaySensor) {
    lastTimeSensor = millis();

    int soilAnalog = analogRead(SOIL_PIN);
    lastSoil = map(soilAnalog, 4095, 1000, 0, 100);
    lastSoil = constrain(lastSoil, 0, 100);

    // --- LOGIKA KONTROL POMPA (Selalu Otomatis) ---
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

    // Menampilkan Alamat IP di baris ke-4
    lcd.setCursor(0,3);
    lcd.print("IP: ");
    lcd.print(WiFi.localIP());
    lcd.print("      ");

    Serial.print("Soil: ");
    Serial.print(lastSoil);
    Serial.print("% | Pump: ");
    Serial.println(pumpState ? "ON" : "OFF");
  }

  // 2. Mengirim Data ke ThingSpeak (Setiap 20 detik)
  if (millis() - lastTimeCloud >= timerDelayCloud) {
    lastTimeCloud = millis();

    ThingSpeak.setField(1, lastSoil);
    ThingSpeak.setField(2, pumpState ? 1 : 0);

    int status = ThingSpeak.writeFields(myChannelNumber, myWriteAPIKey);

    if (status == 200) {
      Serial.println("ThingSpeak Update Success");
    } else {
      Serial.print("ThingSpeak Error : ");
      Serial.println(status);
    }
  }
}
