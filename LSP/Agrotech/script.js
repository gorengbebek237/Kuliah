// --- KONFIGURASI THINGSPEAK ---
const CHANNEL_ID = '3400718'; 
const READ_API_KEY = '4V8HDICQV3IQM9QD'; 

// --- Inisialisasi Gauge Kelembapan Tanah (Analog) ---
var optionsSoil = {
    series: [0],
    chart: { 
        height: 320, 
        type: 'radialBar',
        fontFamily: 'Inter, sans-serif',
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
            },
            track: {
                background: '#edf2f0', /* Disesuaikan dengan tema baru */
                strokeWidth: '100%',
                margin: 0,
                dropShadow: {
                    enabled: true,
                    top: 0,
                    left: 0,
                    blur: 3,
                    opacity: 0.05
                }
            },
            dataLabels: { 
                show: true,
                name: { 
                    fontSize: '15px', 
                    color: '#808e9b', 
                    offsetY: 120,
                    fontWeight: 600
                },
                value: { 
                    offsetY: 76, 
                    fontSize: '36px', 
                    color: '#1e272e', 
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
            gradientToColors: ['#2ecc71'], // Hijau Mint
            inverseColors: true,
            opacityFrom: 1,
            opacityTo: 1,
            stops: [0, 100]
        },
        colors: ['#1b5e20'] // Hijau Zamrud
    },
    stroke: { lineCap: 'round' },
    labels: ['Kelembapan Tanah'],
};
var chartSoil = new ApexCharts(document.querySelector("#gaugeSoil"), optionsSoil);
chartSoil.render();

// --- Inisialisasi Grafik Garis DHT21 (Area Digital) ---
// --- Inisialisasi Grafik Garis DHT21 (Area Digital) ---
var optionsDHT = {
    series: [
        { name: "Suhu (°C)", data: [] },
        { name: "Kelembapan Udara (%)", data: [] }
    ],
    chart: { 
        height: 350, 
        type: 'area', 
        fontFamily: 'Inter, sans-serif',
        animations: { enabled: false }, 
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
            style: { colors: '#808e9b' }
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
    },
    yaxis: { 
        title: { 
            text: 'Nilai Sensor',
            style: { color: '#808e9b', fontWeight: 600 }
        },
        labels: { style: { colors: '#808e9b' } }
    },
    grid: {
        borderColor: '#edf2f0',
        strokeDashArray: 4, 
    },
    tooltip: { 
        x: { format: 'dd MMM yyyy HH:mm:ss' },
        theme: 'light'
    },
    
    // --- INI BAGIAN YANG DIPERBARUI AGAR KETERANGAN LEBIH JELAS ---
    legend: { 
        show: true,
        position: 'top', 
        horizontalAlign: 'right',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        labels: {
            colors: '#1e272e', /* Warna teks hitam arang agar jelas */
        },
        markers: {
            width: 12,
            height: 12,
            radius: 12, /* Membuat ikon keterangan menjadi bulat sempurna */
        },
        itemMargin: {
            horizontal: 15, /* Memberi jarak antar keterangan */
            vertical: 5
        }
    }
};
var chartDHT = new ApexCharts(document.querySelector("#lineChartDHT"), optionsDHT);
chartDHT.render();

// --- Fungsi Mengambil dan Memperbarui Data ---
async function updateDashboard() {
    try {
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=15`;
        const response = await fetch(url);
        const data = await response.json();
        
        const feeds = data.feeds;
        if (!feeds || feeds.length === 0) return;

        const lastFeed = feeds[feeds.length - 1];

        // 1. Update Teks Kondisi Udara Aktual (Suhu & Kelembapan)
        const currentTemp = parseFloat(lastFeed.field1) || 0;
        const currentHum = parseFloat(lastFeed.field2) || 0;
        
        // Memasukkan data ke dalam elemen HTML dengan id txtTemp dan txtHum
        document.getElementById('txtTemp').innerText = currentTemp.toFixed(1);
        document.getElementById('txtHum').innerText = currentHum.toFixed(1);

        // 2. Update Gauge Tanah
        const currentSoil = parseFloat(lastFeed.field3) || 0;
        chartSoil.updateSeries([currentSoil]);

        // 3. Update Status Relay (Pompa & Kipas)
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

        // 4. Update Waktu Terakhir Data Masuk
        const dateObj = new Date(lastFeed.created_at);
        document.getElementById('lastUpdate').innerText = dateObj.toLocaleString('id-ID');

        // 5. Update Grafik Area DHT21
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
