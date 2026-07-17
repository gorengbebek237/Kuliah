// --- KONFIGURASI THINGSPEAK ---
const CHANNEL_ID = '3400718'; 
// Ganti dengan Read API Key kamu jika channel Private. Jika Public, biarkan kosong tidak apa-apa.
const READ_API_KEY = '4V8HDICQV3IQM9QD'; 

// --- Inisialisasi Gauge Kelembapan Tanah (Analog) ---
var optionsSoil = {
    series: [0],
    chart: { 
        height: 320, 
        type: 'radialBar',
        animations: {
            enabled: true,
            easing: 'easeinout',
            speed: 800
        }
    },
    plotOptions: {
        radialBar: {
            startAngle: -135, 
            endAngle: 135,
            hollow: {
                margin: 15,
                size: '65%',
                image: undefined,
            },
            track: {
                background: '#e7e7e7',
                strokeWidth: '100%',
                margin: 0, // margin is in pixels
                dropShadow: {
                    enabled: true,
                    top: 0,
                    left: 0,
                    blur: 3,
                    opacity: 0.15
                }
            },
            dataLabels: { 
                show: true,
                name: { 
                    fontSize: '16px', 
                    color: '#7f8c8d', 
                    offsetY: 120,
                    fontWeight: 600
                },
                value: { 
                    offsetY: 76, 
                    fontSize: '32px', 
                    color: '#2c3e50', 
                    fontWeight: 700,
                    formatter: function (val) { return val + "%"; } 
                } 
            }
        }
    },
    fill: { 
        type: 'gradient',
        gradient: {
            shade: 'dark',
            type: 'horizontal',
            shadeIntensity: 0.5,
            gradientToColors: ['#8D6E63'], // Cokelat tanah terang
            inverseColors: true,
            opacityFrom: 1,
            opacityTo: 1,
            stops: [0, 100]
        },
        colors: ['#5D4037'] // Cokelat tanah gelap
    },
    stroke: { lineCap: 'round' },
    labels: ['Kelembapan Tanah'],
};
var chartSoil = new ApexCharts(document.querySelector("#gaugeSoil"), optionsSoil);
chartSoil.render();

// --- Inisialisasi Grafik Garis DHT21 (Digital) ---
var optionsDHT = {
    series: [
        { name: "Suhu (°C)", data: [] },
        { name: "Kelembapan Udara (%)", data: [] }
    ],
    chart: { 
        height: 350, 
        type: 'area', // Diubah jadi area agar lebih modern
        animations: { enabled: false }, // Dimatikan agar tidak lag saat auto-update
        toolbar: { show: true },
        zoom: { enabled: false }
    },
    dataLabels: { enabled: false },
    stroke: { 
        width: [3, 3], 
        curve: 'smooth' 
    },
    colors: ['#FF9800', '#00BCD4'], // Oranye untuk Suhu, Cyan untuk Kelembapan Udara
    fill: {
        type: 'gradient',
        gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.4,
            opacityTo: 0.05,
            stops: [0, 90, 100]
        }
    },
    xaxis: { 
        type: 'datetime',
        labels: { 
            datetimeUTC: false,
            style: { colors: '#7f8c8d' }
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
    },
    yaxis: { 
        title: { 
            text: 'Nilai Sensor',
            style: { color: '#7f8c8d', fontWeight: 600 }
        },
        labels: { style: { colors: '#7f8c8d' } }
    },
    grid: {
        borderColor: '#f1f1f1',
        strokeDashArray: 4, // Garis putus-putus yang elegan
    },
    tooltip: { 
        x: { format: 'dd MMM yyyy HH:mm:ss' },
        theme: 'light'
    },
    legend: { show: false } // BAGIAN YANG DIUBAH: Mematikan legend bawaan ApexCharts
};
var chartDHT = new ApexCharts(document.querySelector("#lineChartDHT"), optionsDHT);
chartDHT.render();

// --- Fungsi Mengambil dan Memperbarui Data ---
async function updateDashboard() {
    try {
        // Mengambil 15 titik data terakhir dari ThingSpeak API
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=15`;
        const response = await fetch(url);
        const data = await response.json();
        
        const feeds = data.feeds;
        if (!feeds || feeds.length === 0) return;

        const lastFeed = feeds[feeds.length - 1];

        // --- Update Teks Suhu & Kelembapan Real-time ---
        const currentTemp = parseFloat(lastFeed.field1) || 0;
        const currentHum = parseFloat(lastFeed.field2) || 0;
        
        document.getElementById('realtimeTemp').innerText = currentTemp.toFixed(1);
        document.getElementById('realtimeHum').innerText = currentHum.toFixed(1);

        // 1. Update Gauge Tanah
        const currentSoil = parseFloat(lastFeed.field3) || 0;
        chartSoil.updateSeries([currentSoil]);

        // 2. Update Status Relay
        const pumpEl = document.getElementById('statPump');
        const fanEl = document.getElementById('statFan');
        
        if (lastFeed.field4 == "1") {
            pumpEl.innerText = "ON";
            pumpEl.className = "status on";
        } else {
            pumpEl.innerText = "OFF";
            pumpEl.className = "status off";
        }

        if (lastFeed.field5 == "1") {
            fanEl.innerText = "ON";
            fanEl.className = "status on";
        } else {
            fanEl.innerText = "OFF";
            fanEl.className = "status off";
        }

        // 3. Update Waktu Terakhir Data Masuk
        const dateObj = new Date(lastFeed.created_at);
        document.getElementById('lastUpdate').innerText = dateObj.toLocaleString('id-ID');

        // 4. Update Grafik Area DHT21
        const suhuData = feeds.map(f => ({ 
            x: new Date(f.created_at).getTime(), 
            y: parseFloat(f.field1) || 0 
        }));
        const humData = feeds.map(f => ({ 
            x: new Date(f.created_at).getTime(), 
            y: parseFloat(f.field2) || 0 
        }));
        
        chartDHT.updateSeries([
            { name: "Suhu (°C)", data: suhuData },
            { name: "Kelembapan Udara (%)", data: humData }
        ]);

    } catch (error) {
        console.error("Gagal mengambil data dari ThingSpeak:", error);
    }
}

// --- Eksekusi Utama ---
updateDashboard(); 
setInterval(updateDashboard, 20000); // Tarik data baru tiap 20 detik