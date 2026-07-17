#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include <Preferences.h>
#include <addons/RTDBHelper.h>

// ——— CONFIGURATION ———
#define WIFI_SSID "Maman"
#define WIFI_PASS "test1234"
#define FIREBASE_URL "smart-office-5feb6-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_SECRET "IEFUKoZTRVL6xCl39KovsmmoBFYLQIXK8QwWBJqO"

const int PIR_PIN       = 14;
const int LAMP_PIN      = 32;
const int BUZZER_PIN    = 25;
const int TOUCH_PIN     = 13;   
const int SOL_PIN       = 33;   

LiquidCrystal_I2C lcd(0x27, 20, 4);
MFRC522 mfrc(5, 27);
Preferences pref;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

String doorMode = "auto";
String doorStatus = "locked";
String lampMode = "auto";
String lampStatus = "off";
bool lastLampOn = false;
bool lastTouchState = LOW;
bool isOffline = true;
unsigned long previousMillisFirebase = 0;
const long intervalFirebase = 1500; 

void setupTime() {
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
}

String getCurrentTime() {
  struct tm tm;
  if (!getLocalTime(&tm)) return "Offline";
  char tmp[32];
  strftime(tmp, sizeof(tmp), "%H:%M:%S", &tm);
  return String(tmp);
}

void sendLogToFirebase(String name, String uid, String statusInfo) {
  if (isOffline) return;
  String timestamp = String(time(nullptr)); 
  String path = "/logs/" + timestamp;
  FirebaseJson json;
  json.set("time", getCurrentTime());
  json.set("name", name);
  json.set("uid", uid);
  json.set("status", statusInfo);
  Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json);
}

// FUNGSI BUKA PINTU (Solenoid aktif 5 detik)
void openDoor(String personName, bool fromOfflineMode = false) {
  Serial.println("PERINTAH: Buka Pintu untuk " + personName);
  
  lcd.clear();
  lcd.setCursor(0, 1);
  lcd.print("Akses Diterima");
  lcd.setCursor(0, 2);
  lcd.print(fromOfflineMode ? "(*Off) " + personName : "Hai, " + personName);

  digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW);
  
  // AKTIFKAN RELAY (LOW = ON karena Active Low)
  digitalWrite(SOL_PIN, LOW); 
  Serial.println("Relay Solenoid: AKTIF (LOW)");
  
  if (!isOffline) Firebase.RTDB.setString(&fbdo, "/devices/door/status", "unlocked");

  delay(5000); // Tahan selama 5 detik sesuai permintaan
  
  // MATIKAN RELAY (HIGH = OFF)
  digitalWrite(SOL_PIN, HIGH); 
  Serial.println("Relay Solenoid: MATI (HIGH)");
  
  if (!isOffline) Firebase.RTDB.setString(&fbdo, "/devices/door/status", "locked");
  lcd.clear();
}

void rejectDoor() {
  Serial.println("PERINTAH: Akses Ditolak");
  lcd.clear();
  lcd.setCursor(0, 1);
  lcd.print("Akses Ditolak!");
  for (int i = 0; i < 5; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(100);
    digitalWrite(BUZZER_PIN, LOW); delay(100);
  }
  delay(2000);
  lcd.clear();
}

void setup() {
  Serial.begin(115200);

  // Inisialisasi Pin
  pinMode(PIR_PIN,    INPUT);
  pinMode(LAMP_PIN,   OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(TOUCH_PIN,  INPUT);
  pinMode(SOL_PIN,    OUTPUT);

  // Pastikan saat menyala pertama kali relay dalam kondisi mati (HIGH)
  digitalWrite(SOL_PIN, HIGH); 
  digitalWrite(LAMP_PIN, HIGH); 
  digitalWrite(BUZZER_PIN, LOW);

  SPI.begin();
  mfrc.PCD_Init();
  lcd.init();
  lcd.backlight();
  pref.begin("whitelist", false); 

  lcd.setCursor(2, 1);
  lcd.print("Menghubungkan WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) { delay(300); Serial.print("."); attempts++; }

  if (WiFi.status() == WL_CONNECTED) {
    setupTime();
    config.database_url = FIREBASE_URL;
    config.signer.tokens.legacy_token = FIREBASE_SECRET;
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    isOffline = false;
  }

  lcd.clear();
  lcd.setCursor(4, 1);
  lcd.print("Smart Office");
  delay(1500);
  lcd.clear();
}

void loop() {
  isOffline = (WiFi.status() != WL_CONNECTED);

  lcd.setCursor(4, 0);
  lcd.print("Smart Office");
  lcd.setCursor(3, 1);
  lcd.print("Selamat Datang");
  lcd.setCursor(1, 2);
  lcd.print("Silahkan Tap Kartu");

  unsigned long currentMillis = millis();

  // Sinkronisasi Firebase
  if (!isOffline && (currentMillis - previousMillisFirebase >= intervalFirebase)) {
    previousMillisFirebase = currentMillis;
    
    if (Firebase.RTDB.getString(&fbdo, "/devices/door/mode")) {
        doorMode = fbdo.stringData();
        doorMode.replace("\"", ""); // Hapus tanda petik jika ada
    }
    if (Firebase.RTDB.getString(&fbdo, "/devices/door/status")) {
        doorStatus = fbdo.stringData();
        doorStatus.replace("\"", ""); // Hapus tanda petik jika ada
    }
    if (Firebase.RTDB.getString(&fbdo, "/devices/lamp/mode")) {
        lampMode = fbdo.stringData();
        lampMode.replace("\"", "");
    }
    if (Firebase.RTDB.getString(&fbdo, "/devices/lamp/status")) {
        lampStatus = fbdo.stringData();
        lampStatus.replace("\"", "");
    }
  }

  // ==========================================
  // KONTROL LAMPU (SUDAH DIPERBAIKI SINKRONISASINYA)
  // ==========================================
  if (lampMode == "auto") {
    bool motion = (digitalRead(PIR_PIN) == HIGH);
    digitalWrite(LAMP_PIN, motion ? LOW : HIGH); 
    
    // Logika Sinkronisasi Paksa
    String expectedStatus = motion ? "on" : "off";
    if (!isOffline && lampStatus != expectedStatus) {
      Firebase.RTDB.setString(&fbdo, "/devices/lamp/status", expectedStatus);
      lampStatus = expectedStatus; 
      Serial.println("SINKRONISASI: Lampu dikembalikan ke " + expectedStatus);
    }
  } else {
    digitalWrite(LAMP_PIN, (lampStatus == "on") ? LOW : HIGH);
  }
  // ==========================================

  // KONTROL PINTU
  if (doorMode == "manual") {
    // Jika status manual 'unlocked', berikan LOW (Aktif)
    if (doorStatus == "unlocked") {
        digitalWrite(SOL_PIN, LOW);
    } else {
        digitalWrite(SOL_PIN, HIGH);
    }
  } else {
    // Mode Auto: RFID & Touch
    bool touch = digitalRead(TOUCH_PIN);
    if (touch == HIGH && lastTouchState == LOW) {
      openDoor("Admin (Sentuh)");
      sendLogToFirebase("Admin (Touch)", "TOUCH", "DITERIMA");
    }
    lastTouchState = touch;

    if (mfrc.PICC_IsNewCardPresent() && mfrc.PICC_ReadCardSerial()) {
      String uid = "";
      for (byte i = 0; i < 4; i++) {
        if (mfrc.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(mfrc.uid.uidByte[i], HEX);
      }
      uid.toUpperCase();

      if (!isOffline) {
        Firebase.RTDB.setString(&fbdo, "/rfid_last_scanned", uid);
        String pathName = "/rfid_whitelist/" + uid + "/name";
        
        if (Firebase.RTDB.getString(&fbdo, pathName.c_str()) && fbdo.stringData() != "null" && fbdo.stringData() != "") {
          String name = fbdo.stringData();
          name.replace("\"", ""); 
          pref.putString(uid.c_str(), name); 
          openDoor(name, false);
          sendLogToFirebase(name, uid, "DITERIMA");
        } else {
          pref.remove(uid.c_str());
          rejectDoor();
          sendLogToFirebase("Tidak Dikenal", uid, "DITOLAK");
        }
      } else {
        String nameOff = pref.getString(uid.c_str(), ""); 
        if (nameOff != "") openDoor(nameOff, true);
        else rejectDoor();
      }
      mfrc.PICC_HaltA();
    }
  }
}