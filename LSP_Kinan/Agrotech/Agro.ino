#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <ThingSpeak.h>
#include <LittleFS.h>       
#include <WebServer.h>      

#define DHTPIN 18          
#define DHTTYPE DHT21      
#define SOIL_PIN 34        
#define RELAY_PUMP 16      
#define RELAY_FAN 27       

const char* ssid = "Man";                   
const char* password = "Mantul123";         
unsigned long myChannelNumber = 3400718;    
const char * myWriteAPIKey = "36VRJGCPF1O6AHD5"; 

WiFiClient client;
LiquidCrystal_I2C lcd(0x27, 20, 4);
DHT dht(DHTPIN, DHTTYPE);

WebServer server(80);

const int SOIL_DRY = 40;       
const float TEMP_HOT = 25.0;   

unsigned long lastTimeCloud = 0;
const unsigned long timerDelayCloud = 20000; 

unsigned long lastTimeSensor = 0;
const unsigned long timerDelaySensor = 2000; 

float lastTemp = 0.0;
float lastHum = 0.0;
int lastSoil = 0;
bool pumpState = false;
bool fanState = false;

void setup() {
  Serial.begin(115200);

  lcd.init();
  lcd.backlight();
  lcd.print("Memulai Sistem...");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan ke WiFi");
  while(WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nTerhubung ke WiFi!");
  Serial.print("IP Address Web Server: ");
  Serial.println(WiFi.localIP()); 

  if (!LittleFS.begin()) {
    Serial.println("Gagal me-mount LittleFS!");
    return;
  }
  Serial.println("LittleFS berhasil di-mount.");

  server.on("/", HTTP_GET, []() {
    File file = LittleFS.open("/index.html", "r");
    if (!file) {
      server.send(404, "text/plain", "Error: File index.html tidak ditemukan! Kamu belum melakukan ESP32 Sketch Data Upload.");
      return;
    }
    server.streamFile(file, "text/html");
    file.close();
  });

  server.serveStatic("/", LittleFS, "/");  

  server.begin();
  Serial.println("Web Server Aktif!");

  ThingSpeak.begin(client); 
  dht.begin();
  pinMode(RELAY_PUMP, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);
  digitalWrite(RELAY_PUMP, LOW);
  digitalWrite(RELAY_FAN, LOW);
  
  lcd.clear();
  lcd.print("Sistem Agrotek Siap!");
  delay(2000);
  lcd.clear();
}

void loop() {
  server.handleClient(); 

  if (millis() - lastTimeSensor >= timerDelaySensor) {
    lastTimeSensor = millis();

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    int soilAnalogValue = analogRead(SOIL_PIN);
    
    if (!isnan(humidity) && !isnan(temperature)) {
      lastHum = humidity;
      lastTemp = temperature;
      int soilPercent = map(soilAnalogValue, 4095, 1000, 0, 100);
      lastSoil = constrain(soilPercent, 0, 100);

      pumpState = (lastSoil < SOIL_DRY);
      digitalWrite(RELAY_PUMP, pumpState ? HIGH : LOW);

      fanState = (lastTemp > TEMP_HOT);
      digitalWrite(RELAY_FAN, fanState ? HIGH : LOW);

      lcd.setCursor(0, 0); lcd.print("T:" + String(lastTemp, 1) + "C H:" + String(lastHum, 1) + "%  ");
      lcd.setCursor(0, 1); lcd.print("Soil: " + String(lastSoil) + "%   ");
      lcd.setCursor(0, 2); lcd.print("PUMP:" + String(pumpState ? "ON " : "OFF") + " FAN:" + String(fanState ? "ON " : "OFF"));
    }
  }

  if (millis() - lastTimeCloud >= timerDelayCloud) {
    lastTimeCloud = millis();
    
    ThingSpeak.setField(1, lastTemp);
    ThingSpeak.setField(2, lastHum);
    ThingSpeak.setField(3, lastSoil);
    ThingSpeak.setField(4, pumpState ? 1 : 0); 
    ThingSpeak.setField(5, fanState ? 1 : 0);

    int x = ThingSpeak.writeFields(myChannelNumber, myWriteAPIKey);
    if(x == 200){
      Serial.println("Update ThingSpeak berhasil.");
    }
  }
}
