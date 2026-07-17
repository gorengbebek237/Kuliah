// ==========================================
// 1. IMPORT FIREBASE (Versi Modular / v9+)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Konfigurasi Firebase dari project Smart Office milikmu
const firebaseConfig = {
    apiKey: "AIzaSyARlCJHLpkOAxc1SL_UoWF_G-xE2YPP58Y",
    authDomain: "smart-office-5feb6.firebaseapp.com",
    databaseURL: "https://smart-office-5feb6-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-office-5feb6",
    storageBucket: "smart-office-5feb6.firebasestorage.app",
    messagingSenderId: "139786275850",
    appId: "1:139786275850:web:8434fd42fe23f8d6f0e3f3"
};

// Inisialisasi Firebase & Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ==========================================
// 2. UI & NAVIGASI (SIDEBAR & TAB)
// ==========================================
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const navItems = document.querySelectorAll('.nav-item');
const pageSections = document.querySelectorAll('.page-section');

// Menu Mobile
menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

// Pindah Tab Halaman
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        pageSections.forEach(section => section.classList.remove('active-section'));
        
        item.classList.add('active');
        document.getElementById(item.getAttribute('data-target')).classList.add('active-section');
        
        if (window.innerWidth <= 768) sidebar.classList.remove('active');
    });
});

// ==========================================
// 3. JAM DIGITAL REAL-TIME
// ==========================================
function updateClock() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const dateElement = document.getElementById('live-date');
    const timeElement = document.getElementById('live-time');
    
    if (dateElement) {
        dateElement.textContent = `${dayName}, ${date} ${monthName} ${year}`;
    }
    if (timeElement) {
        timeElement.textContent = `${hours}:${minutes}:${seconds} WIB`;
    }
}
setInterval(updateClock, 1000);
updateClock(); // Jalankan sekali agar tidak nunggu 1 detik pertama

// ==========================================
// 4. LOGIKA KONTROL PERANGKAT (PINTU & LAMPU)
// ==========================================
const doorMode = document.getElementById('door-mode');
const doorToggle = document.getElementById('door-toggle');
const doorStatusText = document.getElementById('door-status');

const lampMode = document.getElementById('lamp-mode');
const lampToggle = document.getElementById('lamp-toggle');
const lampStatusText = document.getElementById('lamp-status');

// A. Sinkronisasi Data Pintu dari Firebase
onValue(ref(db, 'devices/door'), (snapshot) => {
    const data = snapshot.val() || { mode: 'auto', status: 'locked' };
    
    // Update UI berdasarkan database (ditambah replace untuk antisipasi tanda petik)
    const modeClean = data.mode.replace(/"/g, "");
    const statusClean = data.status.replace(/"/g, "");

    if (doorMode) doorMode.value = modeClean;
    if (doorToggle) {
        doorToggle.disabled = (modeClean === 'auto');
        doorToggle.checked = (statusClean === 'unlocked');
    }

    // Update Teks di Dashboard
    if (doorStatusText) {
        if(statusClean === 'unlocked') {
            doorStatusText.textContent = 'Terbuka';
            doorStatusText.className = 'status-text unlocked';
        } else {
            doorStatusText.textContent = 'Terkunci';
            doorStatusText.className = 'status-text locked';
        }
    }
});

// B. Sinkronisasi Data Lampu dari Firebase
onValue(ref(db, 'devices/lamp'), (snapshot) => {
    const data = snapshot.val() || { mode: 'auto', status: 'off' };
    
    const modeClean = data.mode.replace(/"/g, "");
    const statusClean = data.status.replace(/"/g, "");

    if (lampMode) lampMode.value = modeClean;
    if (lampToggle) {
        lampToggle.disabled = (modeClean === 'auto');
        lampToggle.checked = (statusClean === 'on');
    }

    if (lampStatusText) {
        if(statusClean === 'on') {
            lampStatusText.textContent = 'Menyala';
            lampStatusText.className = 'status-text unlocked'; 
        } else {
            lampStatusText.textContent = 'Mati';
            lampStatusText.className = 'status-text locked'; 
        }
    }
});

// C. Kirim Perintah ke Firebase saat Select/Toggle diubah
if(doorMode) {
    doorMode.addEventListener('change', (e) => update(ref(db, 'devices/door'), { mode: e.target.value }));
}
if(doorToggle) {
    doorToggle.addEventListener('change', (e) => update(ref(db, 'devices/door'), { status: e.target.checked ? 'unlocked' : 'locked' }));
}

if(lampMode) {
    lampMode.addEventListener('change', (e) => update(ref(db, 'devices/lamp'), { mode: e.target.value }));
}
if(lampToggle) {
    lampToggle.addEventListener('change', (e) => update(ref(db, 'devices/lamp'), { status: e.target.checked ? 'on' : 'off' }));
}


// ==========================================
// 5. PENDAFTARAN & WHITELIST RFID
// ==========================================
const rfidForm = document.getElementById('rfid-form');
const uidInput = document.getElementById('rfid-uid');
const nameInput = document.getElementById('rfid-name');
const registeredCardsBody = document.getElementById('registered-cards-body');
const btnScan = document.querySelector('.btn-scan');

// A. Tampilkan Daftar Kartu secara Realtime
onValue(ref(db, 'rfid_whitelist'), (snapshot) => {
    if (!registeredCardsBody) return;
    registeredCardsBody.innerHTML = '';
    const data = snapshot.val();
    
    if (data) {
        Object.keys(data).forEach(uid => {
            const cleanName = data[uid].name ? data[uid].name.replace(/"/g, "") : "Tanpa Nama";
            registeredCardsBody.innerHTML += `
                <tr>
                    <td>${cleanName}</td>
                    <td>${uid}</td>
                    <td>
                        <button class="btn-delete" data-uid="${uid}" title="Hapus Kartu">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    } else {
        registeredCardsBody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center;">Belum ada kartu terdaftar</td>
            </tr>
        `;
    }
});

// B. Hapus Kartu (Event Delegation)
if (registeredCardsBody) {
    registeredCardsBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (btn) {
            const uidTarget = btn.getAttribute('data-uid');
            if(confirm('Hapus kartu ini?')) {
                remove(ref(db, `rfid_whitelist/${uidTarget}`));
            }
        }
    });
}

// C. Simpan Kartu Baru
if (rfidForm) {
    rfidForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const uid = uidInput.value.toUpperCase();
        set(ref(db, `rfid_whitelist/${uid}`), { name: nameInput.value, uid: uid })
            .then(() => {
                rfidForm.reset();
                alert('Kartu berhasil didaftarkan ke Database!');
            });
    });
}

// D. Fitur Tangkap UID Otomatis
onValue(ref(db, 'rfid_last_scanned'), (snapshot) => {
    const val = snapshot.val();
    if(val && val !== "" && uidInput) {
        uidInput.value = val.replace(/"/g, "");
        uidInput.style.borderColor = '#10b981';
        setTimeout(() => {
            uidInput.style.borderColor = '#e2e8f0';
        }, 1000);
    }
});

// E. Tombol Simulasi Scan
if (btnScan) {
    btnScan.addEventListener('click', () => {
        const dummyUIDs = ['C9D8E7F6', '1A2B3C4D', '9F8E7D6C', '55AA44BB', 'E5F6G7H8'];
        const randomUID = dummyUIDs[Math.floor(Math.random() * dummyUIDs.length)];
        set(ref(db, 'rfid_last_scanned'), randomUID);
    });
}

// ==========================================
// 6. RIWAYAT LOG AKTIVITAS & EXPORT EXCEL
// ==========================================
const logTableBody = document.getElementById('log-table-body');
const reportTableBody = document.getElementById('report-table-body');
const filterDateInput = document.getElementById('filter-date');
const btnResetFilter = document.getElementById('btn-reset-filter');
const btnDownloadExcel = document.getElementById('btn-download-excel');

let allLogsData = []; // Variabel global untuk menyimpan data laporan

onValue(ref(db, 'logs'), (snapshot) => {
    if (logTableBody) logTableBody.innerHTML = '';
    allLogsData = []; // Kosongkan array sebelum diisi ulang
    const data = snapshot.val();
    
    if (data) {
        // Ekstrak data dan ubah epoch menjadi objek JS
        Object.keys(data).forEach(epochKey => {
            const logItem = data[epochKey];
            const dateObj = new Date(parseInt(epochKey) * 1000); // Unix timestamp ke JS Date
            const daysArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            
            // Format YYYY-MM-DD untuk mempermudah filter input="date" HTML
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const formatTanggal = `${dd}/${mm}/${yyyy}`; // Untuk Tampilan Tabel
            
            allLogsData.push({
                dateFilterStr: `${yyyy}-${mm}-${dd}`,
                tanggalTampil: formatTanggal,
                hari: daysArr[dateObj.getDay()],
                jam: logItem.time ? logItem.time.replace(/"/g, "") : '-',
                nama: logItem.name ? logItem.name.replace(/"/g, "") : 'Tidak Dikenal',
                uid: logItem.uid ? logItem.uid.replace(/"/g, "") : '-',
                status: logItem.status ? logItem.status.replace(/"/g, "") : '-'
            });
        });

        // Balik urutannya (terbaru di atas)
        allLogsData.reverse();
        
        // --- 1. TAMPILKAN 5 TERAKHIR DI DASHBOARD ---
        if (logTableBody) {
            const top5 = allLogsData.slice(0, 5);
            top5.forEach(log => {
                let badgeClass = 'info';
                if(log.status === 'DITERIMA') badgeClass = 'success';
                else if(log.status === 'DITOLAK') badgeClass = 'danger';

                logTableBody.innerHTML += `
                    <tr>
                        <td>${log.jam}</td>
                        <td><strong>${log.nama}</strong></td>
                        <td>${log.uid}</td>
                        <td><span class="badge ${badgeClass}">${log.status}</span></td>
                    </tr>
                `;
            });
        }

        // --- 2. TAMPILKAN SELURUH DATA DI TAB REPORT ---
        renderReportTable(allLogsData);

    } else {
        if (logTableBody) {
            logTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center;">Belum ada riwayat aktivitas</td>
                </tr>
            `;
        }
        if (reportTableBody) {
            reportTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center;">Belum ada laporan</td>
                </tr>
            `;
        }
    }
});

// Fungsi untuk menggambar tabel laporan berdasarkan data array
function renderReportTable(dataArray) {
    if (!reportTableBody) return;
    reportTableBody.innerHTML = '';
    
    if(dataArray.length === 0) {
        reportTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center;">Data tidak ditemukan</td>
            </tr>
        `;
        return;
    }

    dataArray.forEach(log => {
        let statusColor = log.status === 'DITERIMA' ? 'color: #065f46; font-weight: bold;' : 'color: #ef4444; font-weight: bold;';
        reportTableBody.innerHTML += `
            <tr>
                <td>${log.tanggalTampil}</td>
                <td><strong>${log.hari}</strong></td>
                <td>${log.nama}</td>
                <td>${log.jam}</td>
                <td style="${statusColor}">${log.status}</td>
            </tr>
        `;
    });
}

// Event Filter Tanggal
if(filterDateInput) {
    filterDateInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value; // Format: YYYY-MM-DD
        if(!selectedDate) {
            renderReportTable(allLogsData); // Jika kosong, tampilkan semua
            return;
        }
        const filteredData = allLogsData.filter(log => log.dateFilterStr === selectedDate);
        renderReportTable(filteredData);
    });
}

// Event Reset Filter
if(btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
        filterDateInput.value = '';
        renderReportTable(allLogsData);
    });
}

// ==========================================
// SOLUSI: MENGATUR LEBAR KOLOM EXCEL
// ==========================================
if(btnDownloadExcel) {
    btnDownloadExcel.addEventListener('click', () => {
        let tableElement = document.getElementById("report-table");
        if (!tableElement) return;

        // 1. Ambil worksheet dari tabel HTML
        let ws = XLSX.utils.table_to_sheet(tableElement);
        
        // 2. Tentukan lebar setiap kolom (wch = width in characters)
        ws['!cols'] = [
            { wch: 15 }, // Kolom A: Tanggal
            { wch: 15 }, // Kolom B: Hari
            { wch: 30 }, // Kolom C: Nama Pengguna (Paling Lebar)
            { wch: 15 }, // Kolom D: Jam Akses
            { wch: 18 }  // Kolom E: Status
        ];

        // 3. Masukkan worksheet ke dalam workbook baru
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Akses");
        
        // 4. Proses penamaan file dan download
        let dateAppend = filterDateInput.value ? filterDateInput.value : "Semua_Waktu";
        let fileName = `Laporan_Akses_SmartOffice_${dateAppend}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
    });
}