// =========================================================================
// 1. KONFIGURASI FIREBASE (Smart Class Project)
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDuDQvZr_5xmae-GCq5ofwY8OQMp7Jgizo",
    authDomain: "smart-class-30fb0.firebaseapp.com",
    databaseURL: "https://smart-class-30fb0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-class-30fb0",
    storageBucket: "smart-class-30fb0.firebasestorage.app",
    messagingSenderId: "480246188173",
    appId: "1:480246188173:web:6113c87e2fb3fa1887fac4"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// State Global
let dataSiswa = {};
let fanState = { mode: "auto", temp: "-", pir: "-", currentSpeed: 0 };

// =========================================================================
// 2. INISIALISASI SAAT HALAMAN DIMUAT
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Setel input tanggal ke hari ini secara otomatis
    document.getElementById('tanggal').valueAsDate = new Date();
    
    // Mulai tarik data dari Firebase
    loadDataSiswa();
    pantauStatusAlat();
    initFanStream();
    
    // Jalankan Jam Real-time
    updateClock();
    setInterval(updateClock, 1000); // Perbarui setiap 1 detik
});

// =========================================================================
// 3. JAM DIGITAL REAL-TIME & NAVIGASI UI
// =========================================================================
function updateClock() {
    const now = new Date();
    
    // Format Tanggal
    const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateString = now.toLocaleDateString('id-ID', optionsDate);
    
    // Format Waktu
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('date-display').innerText = dateString;
    document.getElementById('time-display').innerText = `${hours}:${minutes}:${seconds} WIB`;
}

function toggleMenu() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("overlay").classList.toggle("active");
}

function showSection(secId, element) {
    // Sembunyikan semua tab & hilangkan efek aktif di menu
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.menu-link').forEach(m => m.classList.remove('active'));
    
    // Tampilkan tab yang dipilih
    document.getElementById(secId).classList.add('active');
    element.classList.add('active');
    
    // Ubah judul header sesuai menu yang diklik (dengan menghapus icon FontAwesome dari teks)
    const title = element.innerText.trim();
    document.getElementById('page-title').innerText = title;

    // Tutup sidebar otomatis jika dibuka di HP
    if(window.innerWidth < 768) toggleMenu();
}

// =========================================================================
// 4. LOGIKA KIPAS OTOMATIS (SMART FAN)
// =========================================================================
function initFanStream() {
    db.ref('smartfan').on('value', (snap) => {
        const data = snap.val();
        if(!data) return;
        
        // Baca Data Sensor
        if(data.sensor) {
            fanState.temp = data.sensor.suhu;
            fanState.pir = data.sensor.pir;
        }
        // Baca Data Kontrol
        if(data.kontrol) {
            fanState.mode = data.kontrol.mode;
            fanState.currentSpeed = data.kontrol.speedAktual;
        }
        // Baca Threshold Suhu
        if(data.threshold) {
            // 1. Update teks info "Saat ini:"
            document.getElementById('val-t1').innerText = data.threshold.t1;
            document.getElementById('val-t2').innerText = data.threshold.t2;
            document.getElementById('val-t3').innerText = data.threshold.t3;

            // 2. Update isi kotak input (hanya jika user tidak sedang mengetik di dalamnya)
            if(document.activeElement !== document.getElementById('t1Input')) document.getElementById('t1Input').value = data.threshold.t1;
            if(document.activeElement !== document.getElementById('t2Input')) document.getElementById('t2Input').value = data.threshold.t2;
            if(document.activeElement !== document.getElementById('t3Input')) document.getElementById('t3Input').value = data.threshold.t3;
        }
        updateFanUI();
    });
}

function updateFanUI() {
    document.getElementById('tempValue').innerText = fanState.temp !== "-" ? `${fanState.temp} °C` : "- °C";
    document.getElementById('pirValue').innerText = fanState.pir === true ? "Ada Orang" : "Kosong";
    
    let speedLabel = "MATI";
    if(fanState.currentSpeed === 85 || fanState.currentSpeed === 100) speedLabel = "Speed 1"; // Menyesuaikan jika kamu ubah ke 100
    if(fanState.currentSpeed === 170) speedLabel = "Speed 2";
    if(fanState.currentSpeed === 255) speedLabel = "Speed 3";
    document.getElementById('fanStatus').innerText = speedLabel;

    const modeBtn = document.getElementById('modeToggleBtn');
    const modeDesc = document.getElementById('mode-desc');
    
    if(fanState.mode === 'auto') {
        modeBtn.innerHTML = '<i class="fas fa-hand-paper"></i> Ubah ke Manual';
        modeBtn.style.backgroundColor = "#6b7280"; 
        modeDesc.innerText = "Status: OTOMATIS (Berdasarkan Sensor)";
    } else {
        modeBtn.innerHTML = '<i class="fas fa-robot"></i> Ubah ke Otomatis';
        modeBtn.style.backgroundColor = "#3b82f6"; 
        modeDesc.innerText = "Status: MANUAL (Kontrol via Web)";
    }

    const isAuto = fanState.mode === 'auto';
    document.querySelectorAll('.btn-speed').forEach(btn => {
        btn.disabled = isAuto;
        btn.classList.remove('active');
        if(!isAuto && parseInt(btn.getAttribute('data-speed')) === fanState.currentSpeed) {
            btn.classList.add('active'); 
        }
    });
}

document.getElementById('modeToggleBtn').addEventListener('click', () => {
    const newMode = fanState.mode === 'auto' ? 'manual' : 'auto';
    db.ref('smartfan/kontrol/mode').set(newMode);
    if (newMode === 'manual') db.ref('smartfan/kontrol/speedManual').set(0); 
});

document.querySelectorAll('.btn-speed').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = parseInt(e.target.getAttribute('data-speed'));
        db.ref('smartfan/kontrol/speedManual').set(val);
    });
});

document.getElementById('saveThresholdBtn').addEventListener('click', () => {
    const t1 = parseFloat(document.getElementById('t1Input').value);
    const t2 = parseFloat(document.getElementById('t2Input').value);
    const t3 = parseFloat(document.getElementById('t3Input').value);
    
    if (t1 >= t2 || t2 >= t3) {
        alert("Peringatan: Urutan suhu salah! Pastikan S1 < S2 < S3");
        return;
    }
    
    db.ref('smartfan/threshold').set({ t1, t2, t3 });
    alert("Konfigurasi Suhu Berhasil Disimpan!");
});

// =========================================================================
// 5. LOGIKA MANAJEMEN USER & ALAT SIDIK JARI
// =========================================================================
function pantauStatusAlat() {
    db.ref('device_status').on('value', (snap) => {
        const status = snap.val();
        if(!status) return;
        
        const led = document.getElementById('led-indicator');
        const text = document.getElementById('status-text');
        led.className = 'led'; 
        
        if (status.mode === 'scan') {
            led.classList.add('hijau');
            text.innerText = "Mode Scan Aktif";
        } else if (status.mode === 'proses_hapus') {
            led.classList.add('merah');
            text.innerText = "Menghapus Data...";
        } else {
            led.classList.add('biru');
            text.innerText = "Mode Daftar Aktif";
        }
    });
}

function loadDataSiswa() {
    db.ref('users').on('value', (snap) => {
        dataSiswa = {}; 
        const tabel = document.getElementById('tabel-users');
        tabel.innerHTML = ""; 
        
        if (snap.exists()) {
            snap.forEach((child) => {
                dataSiswa[child.key] = child.val();
                tabel.innerHTML += `
                    <tr>
                        <td style="font-weight: 600; color: var(--gray);">#${child.key}</td>
                        <td style="font-weight: 500;">${child.val().nama}</td>
                        <td><button class="action-btn danger" onclick="hapusUser('${child.key}')"><i class="fas fa-trash"></i> Hapus</button></td>
                    </tr>`;
            });
        } else {
            tabel.innerHTML = `<tr><td colspan="3" style="text-align:center; color:gray; padding: 20px;">Belum ada siswa terdaftar.</td></tr>`;
        }
        loadAbsensiData(); 
    });
}

function hapusUser(id) {
    if(confirm(`Hapus Siswa ID #${id} dari sistem (Termasuk di memori alat)?`)) {
        db.ref('users/' + id).remove().then(() => {
            db.ref('device_status').set({
                mode: "proses_hapus",
                delete_id: parseInt(id),
                pesan_status: `Menghapus ID #${id}...`
            });
        });
    }
}

function setFingerMode(mode) {
    db.ref('device_status').set({ 
        mode: mode, 
        pesan_status: mode === 'scan' ? "Mode Scan Siap" : "Menyiapkan Sensor Daftar..." 
    });
}

function mulaiDaftar() {
    const nama = document.getElementById('nama-baru').value.trim();
    if (!nama) return alert("Silakan masukkan nama siswa terlebih dahulu!");
    
    let idBaru = 1; 
    while(dataSiswa[idBaru]) idBaru++;
    
    if (idBaru > 200) return alert("Kapasitas sensor penuh!");

    db.ref('device_status').set({
        mode: "proses_daftar",
        enroll_id: idBaru,
        enroll_nama: nama,
        pesan_status: `Menunggu jari ${nama}... (Tempel 2x)`
    });
    
    document.getElementById('nama-baru').value = "";
    alert("Perintah dikirim! Silakan tempelkan jari ke alat.");
}

// =========================================================================
// 6. LOGIKA DATA KEDATANGAN & STATISTIK
// =========================================================================
function loadAbsensiData() {
    const tgl = document.getElementById('tanggal').value; 
    
    db.ref("logs_absensi/" + tgl).on('value', (snap) => {
        const tabel = document.getElementById('tabel-absensi');
        tabel.innerHTML = ""; 
        let grouped = {}; 
        
        if (snap.exists()) {
            snap.forEach((child) => {
                const parts = child.key.split('_');
                const id = parts[0];
                const tipe = parts[1];
                
                if(!grouped[id]) {
                    grouped[id] = { 
                        id: id, 
                        nama: dataSiswa[id] ? dataSiswa[id].nama : "Tidak Dikenal (ID #"+id+")", 
                        in: "-", out: "-", date: tgl 
                    };
                }
                
                if(tipe === "Masuk") grouped[id].in = child.val().waktu;
                if(tipe === "Pulang") grouped[id].out = child.val().waktu;
            });
            
            document.getElementById('count-hari-ini').innerText = Object.keys(grouped).length;
            
            for(let id in grouped) {
                const d = grouped[id];
                const namaHari = new Date(d.date).toLocaleDateString('id-ID', {weekday: 'long'});
                
                tabel.innerHTML += `
                    <tr>
                        <td style="color: var(--gray); font-size: 0.85rem;">${d.date}</td>
                        <td><strong>${namaHari}</strong></td>
                        <td style="font-weight: 500;">${d.nama}</td>
                        <td style="color:var(--success); font-family:monospace; font-weight:bold; font-size:16px;">${d.in}</td>
                        <td style="color:var(--danger); font-family:monospace; font-weight:bold; font-size:16px;">${d.out}</td>
                    </tr>`;
            }
        } else {
            document.getElementById('count-hari-ini').innerText = "0";
            tabel.innerHTML = `<tr><td colspan="5" style="text-align:center; color:gray; padding: 20px;">Belum ada data presensi pada tanggal ini.</td></tr>`;
        }
    });

    updateStatistikMingguan();
}

function updateStatistikMingguan() {
    const countMingguIni = document.getElementById('count-minggu-ini');
    if(!countMingguIni) return;

    let totalHadirMinggu = 0;
    const today = new Date();
    let promises = [];

    for (let i = 0; i < 7; i++) {
        let d = new Date();
        d.setDate(today.getDate() - i);
        let dateString = d.toISOString().split('T')[0];
        
        if (d.getDay() !== 0) { 
            promises.push(db.ref("logs_absensi/" + dateString).get());
        }
    }

    Promise.all(promises).then((snapshots) => {
        snapshots.forEach((snap) => {
            if (snap.exists()) {
                let dailyIds = new Set();
                snap.forEach(child => {
                    dailyIds.add(child.key.split('_')[0]); 
                });
                totalHadirMinggu += dailyIds.size; 
            }
        });
        countMingguIni.innerText = totalHadirMinggu;
    });
}

function unduhExcel() {
    const tgl = document.getElementById('tanggal').value;
    const tabelAbsensi = document.querySelector("#sec-absen .modern-table");
    
    const wb = XLSX.utils.table_to_book(tabelAbsensi, {sheet: "Data Kehadiran"});
    const ws = wb.Sheets["Data Kehadiran"];
    ws['!cols'] = [{wch:15}, {wch:12}, {wch:25}, {wch:15}, {wch:15}];
    
    XLSX.writeFile(wb, `Laporan_Absensi_SmartClass_${tgl}.xlsx`);
}