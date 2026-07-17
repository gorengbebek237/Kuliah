#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <Adafruit_Fingerprint.h>
#include <Preferences.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// === KREDENSIAL WIFI & FIREBASE BARU ===
#define WIFI_SSID "Maman" // Ganti jika nama WiFi kamu berbeda
#define WIFI_PASSWORD "test1234" // Ganti jika password WiFi kamu berbeda

#define API_KEY "AIzaSyDuDQvZr_5xmae-GCq5ofwY8OQMp7Jgizo"
#define DATABASE_URL "https://smart-class-30fb0-default-rtdb.asia-southeast1.firebasedatabase.app"
#define DATABASE_SECRET "4bQtnQPGPcL4VhDJkpJvCaIE68T1CMS4SyWsfAtl"

// === PIN AMAN ESP32 ===
#define RELAY_PIN 14
#define FAN_PWM_PIN 27
#define PIR_PIN 26
#define DHTPIN 25
#define DHTTYPE DHT22
#define BUZZER_PIN 32 // <-- Pin untuk Buzzer

// === FINGERPRINT RGB ===
#define FINGERPRINT_LED_GREEN 4
#define FINGERPRINT_LED_YELLOW 5
#define FINGERPRINT_LED_CYAN 6
#define FINGERPRINT_LED_WHITE 7

// === OBJEK HARDWARE ===
HardwareSerial mySerial(2); // RX = 16, TX = 17
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);
DHT dht(DHTPIN, DHTTYPE);
Preferences preferences;
LiquidCrystal_I2C lcd(0x27, 20, 4);

// === OBJEK FIREBASE & NTP ===
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "id.pool.ntp.org", 25200, 60000); 

// === VARIABEL KIPAS ===
const int pwmFreq = 25000; 
const int pwmResolution = 8;
bool modeManual = false;  
int manualSpeed = 0;      
int currentSpeed = 0;     
float currentTemp = 0.0;
bool isPersonPresent = false;
float t1 = 25.0, t2 = 30.0, t3 = 35.0;
const float hysteresis = 1.0; 

// === VARIABEL FINGERPRINT & LCD ===
String modeAlatSekarang = "scan"; 
const char* namaHari[] = {"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"};
const char* namaBulan[] = {"Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"};
unsigned long lastLcdUpdate = 0;
String lcdState = "STANDBY"; 

// === TIMER MULTITASKING ===
unsigned long lastSensorRead = 0;
unsigned long lastFirebaseUpdate = 0;
unsigned long lastFirebaseRead = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\n--- Memulai Smart Class System ---");

  // 1. Setup Hardware
  dht.begin();
  pinMode(PIR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); // Matikan buzzer di awal
  digitalWrite(RELAY_PIN, LOW); 
  ledcAttach(FAN_PWM_PIN, pwmFreq, pwmResolution);
  setFanSpeed(0); 

  preferences.begin("smartfan", false); 
  t1 = preferences.getFloat("t1", 25.0); 
  t2 = preferences.getFloat("t2", 30.0);
  t3 = preferences.getFloat("t3", 35.0);

  // 2. Setup Koneksi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan ke Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWi-Fi Terhubung!");

  timeClient.begin();

  // 3. Setup Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase Siap!");

  // 4. Setup LCD
  lcd.init();
  lcd.backlight();
  tampilkanLayarUtama();

  // 5. Setup Fingerprint
  mySerial.begin(57600, SERIAL_8N1, 16, 17);
  if (finger.verifyPassword()) {
    Serial.println("Sensor R503 Siap!");
    finger.LEDcontrol(FINGERPRINT_LED_BREATHING, 100, FINGERPRINT_LED_BLUE);
  } else {
    Serial.println("Sensor R503 tidak terdeteksi!");
  }
}

void loop() {
  timeClient.update();
  unsigned long currentMillis = millis();

  // ================= 1. BACA SENSOR KIPAS (Tiap 2 Detik) =================
  if (currentMillis - lastSensorRead > 2000) {
    currentTemp = dht.readTemperature();
    isPersonPresent = digitalRead(PIR_PIN);
    if (isnan(currentTemp)) currentTemp = 0.0; 
    lastSensorRead = currentMillis;
  }

  // ================= 2. LOGIKA KIPAS (Berjalan Terus) =================
  if (modeManual) {
    setFanSpeed(manualSpeed);
  } else {
    autoModeLogic();
  }

  // ================= 3. TARIK DATA DARI FIREBASE (Tiap 1.5 Detik) =================
  if (currentMillis - lastFirebaseRead > 1500) {
    if (Firebase.ready()) {
      if (Firebase.RTDB.getString(&fbdo, "/device_status/mode")) modeAlatSekarang = fbdo.stringData();
      if (Firebase.RTDB.getString(&fbdo, "/smartfan/kontrol/mode")) modeManual = (fbdo.stringData() == "manual");
      if (Firebase.RTDB.getInt(&fbdo, "/smartfan/kontrol/speedManual")) manualSpeed = fbdo.intData();
      if (Firebase.RTDB.getFloat(&fbdo, "/smartfan/threshold/t1")) t1 = fbdo.floatData();
      if (Firebase.RTDB.getFloat(&fbdo, "/smartfan/threshold/t2")) t2 = fbdo.floatData();
      if (Firebase.RTDB.getFloat(&fbdo, "/smartfan/threshold/t3")) t3 = fbdo.floatData();
    }
    lastFirebaseRead = currentMillis;
  }

  // ================= 4. KIRIM DATA SENSOR KE FIREBASE (Tiap 5 Detik) =================
  if (currentMillis - lastFirebaseUpdate > 5000) {
    if (Firebase.ready()) {
      Firebase.RTDB.setFloat(&fbdo, "/smartfan/sensor/suhu", currentTemp);
      Firebase.RTDB.setBool(&fbdo, "/smartfan/sensor/pir", isPersonPresent);
      Firebase.RTDB.setInt(&fbdo, "/smartfan/kontrol/speedAktual", currentSpeed);
    }
    lastFirebaseUpdate = currentMillis;
  }

  // ================= 5. UPDATE LCD STANDBY (Tiap 1 Detik) =================
  if (lcdState == "STANDBY" && modeAlatSekarang == "scan") {
    if (currentMillis - lastLcdUpdate > 1000) {
      tampilkanLayarUtama();
      lastLcdUpdate = currentMillis;
    }
  }

  // ================= 6. LOGIKA FINGERPRINT =================
  if (modeAlatSekarang == "scan") {
    int userID = getFingerprintID();
    if (userID > 0) {
      handleAttendance(userID);
      delay(2000); 
      finger.LEDcontrol(FINGERPRINT_LED_BREATHING, 100, FINGERPRINT_LED_BLUE);
    }
  } 
  else if (modeAlatSekarang == "proses_daftar") {
    lcdState = "DAFTAR"; 

    int enrollID = 0; String enrollNama = "";
    if (Firebase.RTDB.getInt(&fbdo, "/device_status/enroll_id")) enrollID = fbdo.intData();
    if (Firebase.RTDB.getString(&fbdo, "/device_status/enroll_nama")) enrollNama = fbdo.stringData();
    
    lcd.clear();
    printCentered(0, "MODE DAFTAR");
    lcd.setCursor(0, 1); lcd.print("ID Baru: #" + String(enrollID));
    lcd.setCursor(0, 2); lcd.print("Tempelkan Jari...");
    lcd.setCursor(0, 3); lcd.print("[][][][][][][][]"); 
    
    bool sukses = rekamSidikJariBaru(enrollID);

    if (sukses && Firebase.ready()) {
      Firebase.RTDB.setString(&fbdo, "/users/" + String(enrollID) + "/nama", enrollNama);
      Firebase.RTDB.setString(&fbdo, "/device_status/mode", "scan");
      Firebase.RTDB.setString(&fbdo, "/device_status/pesan_status", "Berhasil didaftarkan!");
      printCentered(2, "PENDAFTARAN SUKSES!");
      bunyiBuzzer(1, 200); // Bunyi sukses daftar
    } else if (Firebase.ready()) {
      Firebase.RTDB.setString(&fbdo, "/device_status/mode", "scan");
      Firebase.RTDB.setString(&fbdo, "/device_status/pesan_status", "Gagal/Batal Mendaftar.");
      printCentered(2, "PENDAFTARAN GAGAL!");
      bunyiBuzzer(2, 300); // Bunyi gagal daftar
    }
    
    delay(2000); 
    lcd.clear();
    modeAlatSekarang = "scan";
    lcdState = "STANDBY";
    finger.LEDcontrol(FINGERPRINT_LED_BREATHING, 100, FINGERPRINT_LED_BLUE);
  }
  else if (modeAlatSekarang == "proses_hapus") {
    int deleteID = 0;
    if (Firebase.RTDB.getInt(&fbdo, "/device_status/delete_id")) deleteID = fbdo.intData();
    uint8_t p = finger.deleteModel(deleteID);
    if (p == FINGERPRINT_OK) {
      finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
      bunyiBuzzer(1, 500); // Bunyi konfirmasi hapus
    }
    if (Firebase.ready()) {
      Firebase.RTDB.setString(&fbdo, "/device_status/mode", "scan");
      Firebase.RTDB.setString(&fbdo, "/device_status/pesan_status", "Mode Scan Siap");
    }
    modeAlatSekarang = "scan";
    finger.LEDcontrol(FINGERPRINT_LED_BREATHING, 100, FINGERPRINT_LED_BLUE);
  }

  delay(20); 
}

// === FUNGSI PEMBANTU LCD ===
void printCentered(int row, String text) {
  int padding = (20 - text.length()) / 2;
  lcd.setCursor(0, row);
  for(int i=0; i<20; i++) lcd.print(" "); 
  lcd.setCursor(padding, row);
  lcd.print(text);
}

void tampilkanLayarUtama() {
  time_t epochTime = timeClient.getEpochTime();
  struct tm *ptm = gmtime ((time_t *)&epochTime);
  
  String tgl = String(namaHari[timeClient.getDay()]) + ", " + 
               String(ptm->tm_mday) + " " + 
               String(namaBulan[ptm->tm_mon]) + " " + 
               String(ptm->tm_year + 1900);
               
  String jam = timeClient.getFormattedTime() + " WIB";

  printCentered(0, "- SMART CLASS -");
  printCentered(1, tgl);
  printCentered(2, jam);
  printCentered(3, "TEMPELKAN JARI...");
}

// === FUNGSI KIPAS ===
void autoModeLogic() {
  if (!isPersonPresent) { setFanSpeed(0); return; }
  int targetSpeed = currentSpeed; 
  if (currentSpeed == 0 && currentTemp >= t1) targetSpeed = 100;
  else if (currentSpeed == 100 && currentTemp < (t1 - hysteresis)) targetSpeed = 0;
  else if (currentSpeed == 100 && currentTemp >= t2) targetSpeed = 170;
  else if (currentSpeed == 170 && currentTemp < (t2 - hysteresis)) targetSpeed = 100;
  else if (currentSpeed == 170 && currentTemp >= t3) targetSpeed = 255;
  else if (currentSpeed == 255 && currentTemp < (t3 - hysteresis)) targetSpeed = 170;
  
  if (currentTemp >= t3) targetSpeed = 255;
  else if (currentTemp < (t1 - hysteresis)) targetSpeed = 0;

  setFanSpeed(targetSpeed);
}

void setFanSpeed(int speedValue) {
  if (currentSpeed != speedValue) {
    currentSpeed = speedValue;
    if (currentSpeed == 0) {
      digitalWrite(RELAY_PIN, LOW); 
      ledcWrite(FAN_PWM_PIN, 0); 
    } else {
      digitalWrite(RELAY_PIN, HIGH); 
      ledcWrite(FAN_PWM_PIN, currentSpeed); 
    }
  }
}

// === FUNGSI FINGERPRINT ===
bool rekamSidikJariBaru(int id) {
  int p = -1;
  finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_BLUE, 0); 
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (!modeManual) autoModeLogic(); 
    delay(50);
  }
  p = finger.image2Tz(1); 
  if (p != FINGERPRINT_OK) return false;

  bunyiBuzzer(1, 100); // Bunyi bip tempelan pertama
  finger.LEDcontrol(FINGERPRINT_LED_ON, 0, FINGERPRINT_LED_PURPLE); 
  delay(2000);
  
  p = 0;
  while (p != FINGERPRINT_NOFINGER) { p = finger.getImage(); delay(50); }

  finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_BLUE, 0);
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (!modeManual) autoModeLogic();
    delay(50);
  }
  p = finger.image2Tz(2); 
  if (p != FINGERPRINT_OK) return false;

  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 3);
    return false;
  }
  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_GREEN, 5); 
    return true;
  }
  return false;
}

int getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return -1;
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;
  p = finger.fingerSearch();
  if (p != FINGERPRINT_OK) {
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_RED, 2);
    bunyiBuzzer(1, 1000); // Bunyi salah / tidak dikenali
    delay(1000);
    return -1;
  }
  return finger.fingerID;
}

void handleAttendance(int id) {
  if (Firebase.ready()) {
    lcdState = "ABSEN"; 
    
    String timestamp = timeClient.getFormattedTime(); 
    time_t epochTime = timeClient.getEpochTime();
    struct tm *ptm = gmtime ((time_t *)&epochTime);
    int currentHour = timeClient.getHours(); 
    
    char dateBuffer[15];
    sprintf(dateBuffer, "%04d-%02d-%02d", ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday);
    String date = String(dateBuffer);
    
    String statusAbsen = (currentHour < 12) ? "Masuk" : "Pulang";
    String path = "/logs_absensi/" + date + "/" + String(id) + "_" + statusAbsen;

    String namaSiswa = "Siswa #" + String(id); 
    if (Firebase.RTDB.getString(&fbdo, "/users/" + String(id) + "/nama")) {
      namaSiswa = fbdo.stringData();
    }

    String namaTampil = namaSiswa;
    if (namaTampil.length() > 14) {
      namaTampil = namaTampil.substring(0, 14);
    }

    lcd.clear();

    if (Firebase.RTDB.getString(&fbdo, (path + "/waktu").c_str())) {
      finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_YELLOW, 3); 
      bunyiBuzzer(2, 150); // Bunyi peringatan sudah absen
      printCentered(0, "PERHATIAN");
      
      String statusText = "SUDAH ABSEN " + statusAbsen;
      if(statusText.length() > 20) statusText = statusText.substring(0, 20); 
      printCentered(1, statusText); 
      
      lcd.setCursor(0, 2); lcd.print("Nama: " + namaTampil);
      lcd.setCursor(0, 3); lcd.print("Jam : " + timestamp + " WIB");
    } else {
      finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 25, FINGERPRINT_LED_PURPLE, 3);
      bunyiBuzzer(1, 100); // Bunyi sukses absen
      
      FirebaseJson json;
      json.set("user_id", id);
      json.set("waktu", timestamp);
      json.set("status", statusAbsen);
      Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json);
      
      printCentered(0, "BERHASIL");
      if(statusAbsen == "Masuk") printCentered(1, "ABSEN MASUK");
      else printCentered(1, "ABSEN PULANG");
      
      lcd.setCursor(0, 2); lcd.print("Nama: " + namaTampil);
      lcd.setCursor(0, 3); lcd.print("Jam : " + timestamp + " WIB");
    }
    
    delay(3000); 
    lcd.clear();
    lcdState = "STANDBY"; 
  }
}

// === FUNGSI BUZZER ===
void bunyiBuzzer(int jumlah, int durasi) {
  for (int i = 0; i < jumlah; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(durasi);
    digitalWrite(BUZZER_PIN, LOW);
    if (jumlah > 1) delay(durasi); // Jeda jika bunyi lebih dari 1 kali
  }
}