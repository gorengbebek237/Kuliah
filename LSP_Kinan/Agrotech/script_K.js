// --- KONFIGURASI THINGSPEAK ---
const CHANNEL_ID = '3435512'; // Menggunakan Channel ID yang baru
const READ_API_KEY = 'HQ36KS3Q7581USR5'; // Pastikan Read API Key ini sesuai dengan Channel yang baru ya!

// Status mode di sisi web (Default: Auto)
let currentModeIsAuto = true; 

// --- FUNGSI KONTROL MANUAL ---
function setMode(autoVal) {
    currentModeIsAuto = (autoVal === 1);
    
    // Update teks di HTML
    document.getElementById('txtMode').innerText = currentModeIsAuto ? "Otomatis" : "Manual";
    
    // Kirim HTTP GET ke ESP32 secara background
    fetch(`/set_mode?auto=${autoVal}`).catch(e => console.log("Error set mode:", e));
    alert(currentModeIsAuto ? "Mode Otomatis Aktif!" : "Mode Manual Aktif! Kamu sekarang bisa mengontrol pompa.");
}

function setDevice(device, state) {
    // Cegah kontrol manual jika masih mode otomatis
    if (currentModeIsAuto) {
        alert("Ubah ke Mode Manual terlebih dahulu sebelum mematikan/menyalakan pompa!");
        return;
    }
    
    // Update teks di HTML secara langsung agar responsif
    let el = document.getElementById('statPump');
    el.innerText = state === 1 ? "ON" : "OFF";

    // Kirim HTTP GET ke ESP32 secara background
    fetch(`/set_${device}?state=${state}`).catch(e => console.log(`Error set ${device}:`, e));
}

// --- INISIALISASI GRAFIK APEXCHARTS ---
// Gauge Kelembapan Tanah
var optionsSoil = {
    series: [0],
    chart: { height: 280, type: 'radialBar' },
    plotOptions: {
        radialBar: {
            startAngle: -135, 
            endAngle: 135,
            dataLabels: { 
                name: { fontSize: '16px', offsetY: 80 },
                value: { offsetY: 40, fontSize: '24px', formatter: function (val) { return val + "%"; } } 
            }
        }
    },
    labels: ['Kelembapan Tanah'],
};
var chartSoil = new ApexCharts(document.querySelector("#gaugeSoil"), optionsSoil);
chartSoil.render();

// --- FUNGSI MENGAMBIL DAN MEMPERBARUI DATA THINGSPEAK ---
async function updateDashboard() {
    try {
        // Hanya mengambil 1 data terakhir karena grafik history DHT sudah dihapus
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=1`;
        const response = await fetch(url);
        const data = await response.json();
        
        const feeds = data.feeds;
        if (!feeds || feeds.length === 0) return;

        const lastFeed = feeds[feeds.length - 1];

        // Update Grafik Gauge Tanah dari Field 1
        chartSoil.updateSeries([parseFloat(lastFeed.field1) || 0]);

        // Update Status Pompa dari Field 2 (HANYA JIKA dalam mode Auto)
        if (currentModeIsAuto) {
            document.getElementById('statPump').innerText = lastFeed.field2 == "1" ? "ON" : "OFF";
        }

    } catch (error) {
        console.error("Gagal mengambil data dari ThingSpeak:", error);
    }
}

// --- EKSEKUSI UTAMA ---
updateDashboard(); 
setInterval(updateDashboard, 20000); // Ambil data baru setiap 20 detik
