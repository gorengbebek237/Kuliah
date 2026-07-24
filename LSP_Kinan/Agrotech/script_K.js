// --- KONFIGURASI THINGSPEAK ---
const CHANNEL_ID = '3400718'; 
const READ_API_KEY = '4V8HDICQV3IQM9QD'; 

// Status mode di sisi web (Default: Auto)
let currentModeIsAuto = true; 

// --- FUNGSI KONTROL MANUAL ---
function setMode(autoVal) {
    currentModeIsAuto = (autoVal === 1);
    
    // Update teks di HTML
    document.getElementById('txtMode').innerText = currentModeIsAuto ? "Otomatis" : "Manual";
    
    // Kirim HTTP GET ke ESP32 secara background
    fetch(`/set_mode?auto=${autoVal}`).catch(e => console.log("Error set mode:", e));
    alert(currentModeIsAuto ? "Mode Otomatis Aktif!" : "Mode Manual Aktif! Kamu sekarang bisa mengontrol alat.");
}

function setDevice(device, state) {
    // Cegah kontrol manual jika masih mode otomatis
    if (currentModeIsAuto) {
        alert("Ubah ke Mode Manual terlebih dahulu sebelum mematikan/menyalakan alat!");
        return;
    }
    
    // Update teks di HTML secara langsung agar responsif
    let el = document.getElementById(device === 'pump' ? 'statPump' : 'statFan');
    el.innerText = state === 1 ? "ON" : "OFF";

    // Kirim HTTP GET ke ESP32 secara background
    fetch(`/set_${device}?state=${state}`).catch(e => console.log(`Error set ${device}:`, e));
}

// --- INISIALISASI GRAFIK APEXCHARTS ---
// 1. Gauge Kelembapan Tanah
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

// 2. Grafik Area DHT21
var optionsDHT = {
    series: [
        { name: "Suhu", data: [] }, 
        { name: "Kelembapan", data: [] }
    ],
    chart: { height: 350, type: 'area', animations: { enabled: false }, toolbar: { show: true } },
    dataLabels: { enabled: false }, 
    stroke: { width: [3, 3], curve: 'smooth' },
    colors: ['#FF9800', '#00BCD4'],
    xaxis: { type: 'datetime' }, 
    tooltip: { x: { format: 'dd MMM yyyy HH:mm:ss' } },
    legend: { show: false }
};
var chartDHT = new ApexCharts(document.querySelector("#lineChartDHT"), optionsDHT);
chartDHT.render();

// --- FUNGSI MENGAMBIL DAN MEMPERBARUI DATA THINGSPEAK ---
async function updateDashboard() {
    try {
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=15`;
        const response = await fetch(url);
        const data = await response.json();
        
        const feeds = data.feeds;
        if (!feeds || feeds.length === 0) return;

        const lastFeed = feeds[feeds.length - 1];

        // Update Teks Suhu & Kelembapan
        document.getElementById('realtimeTemp').innerText = (parseFloat(lastFeed.field1) || 0).toFixed(1);
        document.getElementById('realtimeHum').innerText = (parseFloat(lastFeed.field2) || 0).toFixed(1);
        
        // Update Grafik Gauge Tanah
        chartSoil.updateSeries([parseFloat(lastFeed.field3) || 0]);

        // Update Status Relay HANYA JIKA dalam mode Auto
        // (Jika Manual, biarkan teksnya mengikuti tombol yang ditekan user agar tidak bentrok)
        if (currentModeIsAuto) {
            document.getElementById('statPump').innerText = lastFeed.field4 == "1" ? "ON" : "OFF";
            document.getElementById('statFan').innerText = lastFeed.field5 == "1" ? "ON" : "OFF";
        }

        // Update Grafik Garis DHT
        const suhuData = feeds.map(f => ({ x: new Date(f.created_at).getTime(), y: parseFloat(f.field1) || 0 }));
        const humData = feeds.map(f => ({ x: new Date(f.created_at).getTime(), y: parseFloat(f.field2) || 0 }));
        chartDHT.updateSeries([
            { name: "Suhu (°C)", data: suhuData }, 
            { name: "Kelembapan Udara (%)", data: humData }
        ]);

    } catch (error) {
        console.error("Gagal mengambil data dari ThingSpeak:", error);
    }
}

// --- EKSEKUSI UTAMA ---
updateDashboard(); 
setInterval(updateDashboard, 20000); // Ambil data baru setiap 20 detik
