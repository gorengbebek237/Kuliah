#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <ThingSpeak.h>
#include <LittleFS.h>
#include <WebServer.h>

#define SOIL_PIN 34
#define RELAY_PUMP 16

const char* ssid = "Maman";
const char* password = "test1234";

unsigned long myChannelNumber = 3435512;
const char *myWriteAPIKey = "QIV86U03H0WQUSIM";

WiFiClient client;
LiquidCrystal_I2C lcd(0x27, 20, 4);
WebServer server(80);

const int SOIL_DRY = 40;

unsigned long lastTimeCloud = 0;
const unsigned long timerDelayCloud = 20000;

unsigned long lastTimeSensor = 0;
const unsigned long timerDelaySensor = 2000;

int lastSoil = 0;
bool pumpState = false;
bool isAutoMode = true; 

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

  if (!LittleFS.begin()) {
    lcd.setCursor(0,3);
    lcd.print("LittleFS Error");
    while (1);
  }

  
  server.on("/", HTTP_GET, []() {
    File file = LittleFS.open("/dashboard_K.html", "r");
    if (!file) {
      server.send(404, "text/plain", "dashboard_K.html not found");
      return;
    }
    server.streamFile(file, "text/html");
    file.close();
  });

  server.on("/set_mode", HTTP_GET, []() {
    if (server.hasArg("auto")) {
      int modeVal = server.arg("auto").toInt();
      isAutoMode = (modeVal == 1);
      server.send(200, "text/plain", "Mode berhasil diubah");
      Serial.println(isAutoMode ? "Mode: AUTO" : "Mode: MANUAL");
    } else {
      server.send(400, "text/plain", "Parameter tidak valid");
    }
  });

  server.on("/set_pump", HTTP_GET, []() {
    // Pompa hanya bisa dikontrol manual JIKA isAutoMode == false
    if (!isAutoMode && server.hasArg("state")) {
      int stateVal = server.arg("state").toInt();
      pumpState = (stateVal == 1);
      digitalWrite(RELAY_PUMP, pumpState ? HIGH : LOW);
      server.send(200, "text/plain", "Pompa berhasil diubah");
      Serial.print("Manual Pump set to: ");
      Serial.println(pumpState ? "ON" : "OFF");
    } else {
      server.send(400, "text/plain", "Gagal: Sistem masih mode Auto atau parameter salah");
    }
  });

  server.serveStatic("/", LittleFS, "/");
  server.begin();

  ThingSpeak.begin(client);

  delay(2000);
  lcd.clear();
}

void loop() {
  server.handleClient();

  if (millis() - lastTimeSensor >= timerDelaySensor) {
    lastTimeSensor = millis();

    int soilAnalog = analogRead(SOIL_PIN);
    lastSoil = map(soilAnalog, 4095, 1000, 0, 100);
    lastSoil = constrain(lastSoil, 0, 100);

    if (isAutoMode) {
      pumpState = (lastSoil < SOIL_DRY);
      digitalWrite(RELAY_PUMP, pumpState ? HIGH : LOW);
    }

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

    lcd.setCursor(0,3);
    lcd.print("Mode  : ");
    lcd.print(isAutoMode ? "AUTO  " : "MANUAL");
    lcd.print("    ");

    Serial.print("Soil: ");
    Serial.print(lastSoil);
    Serial.print("% | Pump: ");
    Serial.print(pumpState ? "ON" : "OFF");
    Serial.print(" | Mode: ");
    Serial.println(isAutoMode ? "AUTO" : "MANUAL");
  }

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
