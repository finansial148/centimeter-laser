
 let cropper;
let gambarMatengObor = new Image(); // Menyimpan data gambar hasil crop asli
let modePresetGambar = "kayu"; // Nilai bawaan murni: "kayu", "akrilik", atau "siluet"

const fileInput = document.getElementById('file-input');
const imgTargetCrop = document.getElementById('img-target-crop');
const canvasBitmap = document.getElementById('canvas-bitmap');
const ctxBitmap = canvasBitmap.getContext('2d');
const teksBantu = document.getElementById('teks-bantu');
const btnPotong = document.getElementById('btn-potong-sekarang');
const btnKirim = document.getElementById('btn-kirim-editor');

// Ambil elemen slider ruko
const slideBright = document.getElementById('slide-bright');
const slideContrast = document.getElementById('slide-contrast');
const slideDensity = document.getElementById('slide-density');

const valBright = document.getElementById('val-bright');
const valContrast = document.getElementById('val-contrast');
const valDensity = document.getElementById('val-density');

// --- 1. PROSES BUKA FILE & NYALAKAN CROPPER ---
// --- 1. PROSES BUKA FILE & NYALAKAN CROPPER (VERSI BERSIH ANTI-ERROR) ---
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
  
  // 🚀 RESET MEMORI CORETAN DISINI BIAR BERSIH SEPERTI BARU
    resetMemoriPenghapus();

    const reader = new FileReader();
    reader.onload = function(event) {
        // Sembunyikan teks bantu & hasil lama
        teksBantu.style.display = 'none';
        canvasBitmap.style.display = 'none';
        btnKirim.style.display = 'none';
        
        // Tampilkan gambar target buat di-crop
        imgTargetCrop.src = event.target.result;
        imgTargetCrop.style.display = 'block';
        
        // SAKTI: Ini yang bener, Bang, gak pake double .style lagi!
        btnPotong.style.display = 'block'; 

        // Nyalakan mesin Cropper CropperJS
        if (cropper) cropper.destroy();
        cropper = new Cropper(imgTargetCrop, {
            viewMode: 1,
            aspectRatio: NaN, // Bebas sesuka hati ngatur kotak potongnya
            background: true
        });
    };
    reader.readAsDataURL(file);
});

// --- 2. PROSES EKSEKUSI POTONG FOTO ---
function eksekusiPotongFoto() {
    if (!cropper) return;

    // Ambil gambar hasil crop
    // KODE BARU (Paksa naikkan resolusi gambar hasil crop biar titik dither-nya super mikro!)
const canvasHasilCrop = cropper.getCroppedCanvas({
    width: 1200, // SAKTI: Paksa lebar gambar jadi 1200 piksel (Atau 1500 biar lebih halus lagi)
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
});
    
    gambarMatengObor.src = canvasHasilCrop.toDataURL();
    gambarMatengObor.onload = function() {
        // Matikan mesin cropper & sembunyikan gambarnya
        cropper.destroy();
        cropper = null;
        imgTargetCrop.style.display = 'none';
        
        // Sembunyikan tombol potong, munculkan canvas bitmap & tombol kirim
        btnPotong.style.display = 'none';
        canvasBitmap.style.display = 'block';
        btnKirim.style.display = 'block';
      
      //sembunyilan button gambar
      btnGbr.style.display = 'none';

        // Setel ukuran canvas bitmap sesuai hasil potongan gambar
        canvasBitmap.width = gambarMatengObor.width;
        canvasBitmap.height = gambarMatengObor.height;

        // Gaskeun jalankan kalkulasi dither titik RDWorks!
        jalankanOlahBitmap();
      
      
    };
}

// --- 3. PROSES SLIDER GERAK (BRIGHTNESS, CONTRAST, DENSITY) ---
function updateNilaiDanProses() {
    valBright.innerText = slideBright.value;
    valContrast.innerText = slideContrast.value;
    valDensity.innerText = slideDensity.value;
    
    if (gambarMatengObor.src) {
        jalankanOlahBitmap();
    }
}

slideBright.addEventListener('input', updateNilaiDanProses);
slideContrast.addEventListener('input', updateNilaiDanProses);
slideDensity.addEventListener('input', updateNilaiDanProses);

// --- 4. ENGINE SAKTI: FLOYD-STEINBERG DITHERING (BITMAP HANDLE) ---
function jalankanOlahBitmap() {
    if (!gambarMatengObor.src) return;

    ctxBitmap.drawImage(gambarMatengObor, 0, 0);
    gambarUlangSemuaCoretan();

    const dataPiksel = ctxBitmap.getImageData(0, 0, canvasBitmap.width, canvasBitmap.height);
    const d = dataPiksel.data;
    const w = dataPiksel.width;

    const bVal = parseInt(slideBright.value);
    const cVal = parseInt(slideContrast.value);
    const factor = (259 * (cVal + 255)) / (255 * (259 - cVal));
    const density = parseInt(slideDensity.value); 

    // ======================================================================
    // TAHAP A (VERSI R&D): Atur Kecerahan, Kontras, Grayscale, & Preset Media
    // ======================================================================
    for (let i = 0; i < d.length; i += 4) {
        let r = d[i];
        let g = d[i+1];
        let b = d[i+2];

        // 1. Efek Brightness
        r += bVal; g += bVal; b += bVal;

        // 2. Efek Contrast
        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;

        // 3. Ubah ke Grayscale murni rumus standar YUV ruko
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        gray = Math.min(255, Math.max(0, gray));

        // 🚀 FORMULA SAKTI R&D LAB (IDE 2) 🚀
        if (modePresetGambar === "akrilik") {
            // Mode Invert: Balik warna murni biar di akrilik hitam mukanya gak kayak hantu
            gray = 255 - gray; 
        } else if (modePresetGambar === "siluet") {
            // Mode Kontras Tinggi: Paksa langsung jadi Hitam (0) atau Putih (255) sebelum dither
            gray = gray < 128 ? 0 : 255;
        }
        // Jika modePresetGambar === "kayu", dia dilewatkan normal tanpa manipulasi tambahan

        d[i] = gray; d[i+1] = gray; d[i+2] = gray;
    }

    // Tahap B: Eksekusi Algoritma Penyebaran Error Titik (Floyd-Steinberg Dithering)
    // (Biarkan kode Tahap B milik Abang ke bawah tetap utuh sampai akhir fungsi!)
    for (let y = 0; y < dataPiksel.height; y += density) {
        for (let x = 0; x < dataPiksel.width; x += density) {
            let idx = (y * w + x) * 4;
            let oldPixel = d[idx];
            let newPixel = oldPixel < 128 ? 0 : 255;
            
            for (let dy = 0; dy < density && (y + dy) < dataPiksel.height; dy++) {
                for (let dx = 0; dx < density && (x + dx) < dataPiksel.width; dx++) {
                    let blockIdx = ((y + dy) * w + (x + dx)) * 4;
                    d[blockIdx] = newPixel; d[blockIdx+1] = newPixel; d[blockIdx+2] = newPixel;
                }
            }

            let error = oldPixel - newPixel;
            distribusikanError(d, x + density, y, w, dataPiksel.width, dataPiksel.height, error * 7 / 16);
            distribusikanError(d, x - density, y + density, w, dataPiksel.width, dataPiksel.height, error * 3 / 16);
            distribusikanError(d, x, y + density, w, dataPiksel.width, dataPiksel.height, error * 5 / 16);
            distribusikanError(d, x + density, y + density, w, dataPiksel.width, dataPiksel.height, error * 1 / 16);
        }
    }

    ctxBitmap.putImageData(dataPiksel, 0, 0);
    gambarTandaTargetKuas();
}

// Fungsi pembagi error piksel gaib tetangga ruko
function distribusikanError(data, x, y, width, maxW, maxH, error) {
    if (x < 0 || x >= maxW || y < 0 || y >= maxH) return;
    let idx = (y * width + x) * 4;
    data[idx] += error;
    data[idx+1] += error;
    data[idx+2] += error;
}

// --- 5. FUNGSI IMPOR: Kirim Hasil Foto Titik ke Editor Utama (v2.html) ---
function kirimKeEditorBapak() {
    const dataHasilBitmap = canvasBitmap.toDataURL('image/png');
    
    // Tembak langsung elemen di editor utama tanpa perantara iframe lagi!
    const logo = document.getElementById('logo-geser');
    if (logo) {
        logo.src = dataHasilBitmap;
        logo.style.display = 'block';
        logo.style.top = '20px';
        logo.style.left = '20px';
        logo.style.width = '200px';
        logo.style.filter = 'none';
        
        if (typeof perbaruiDaftarLayers === "function") perbaruiDaftarLayers();
        
        tutupModalphoto(); // Langsung tutup jendela modal internalnya
        console.log("📸 Foto grafir hasil dither sukses disuntik via modul internal!");
    }
}

// --- 🚀 REPARASI PASTE (CTRL+V) GAIB ANTI-ERROR LOPE-LOPE ---
window.addEventListener('paste', function(e) {
    const dataClipboard = e.clipboardData || e.originalEvent.clipboardData;
    if (!dataClipboard) return;

    const items = dataClipboard.items;
    let fileGambar = null;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            fileGambar = items[i].getAsFile();
            break;
        }
    }

    if (fileGambar) {
        console.log("📋 Mak Kluthuk! Ada gambar di-paste, langsung diproses...");
        
        const reader = new FileReader();
        reader.onload = function(event) {
            // --- 🛠️ PERBAIKAN SAKTI: Langsung tembak ID HTML-nya biar anti-null ---
            if (document.getElementById('teks-bantu')) document.getElementById('teks-bantu').style.display = 'none';
            if (document.getElementById('canvas-bitmap')) document.getElementById('canvas-bitmap').style.display = 'none';
            if (document.getElementById('btn-kirim-editor')) document.getElementById('btn-kirim-editor').style.display = 'none';
            if (document.getElementById('wadah-nama-file')) document.getElementById('wadah-nama-file').style.display = 'none';
            if (document.getElementById('btn-save-png')) document.getElementById('btn-save-png').style.display = 'none';
            
            // Cekokin ke img target crop
            const imgTarget = document.getElementById('img-target-crop');
            const btnPotongSekarang = document.getElementById('btn-potong-sekarang');
            
            if (imgTarget && btnPotongSekarang) {
                imgTarget.src = event.target.result;
                imgTarget.style.display = 'block';
                btnPotongSekarang.style.display = 'block'; // Munculkan tombol potong "OK, Pas!"

                // Jalankan mesin CropperJS
                if (cropper) cropper.destroy();
                cropper = new Cropper(imgTarget, {
                    viewMode: 1,
                    aspectRatio: NaN,
                    background: true
                });
            }
        };
        reader.readAsDataURL(fileGambar);
    }
});
    
    // Fungsi Sakti untuk Mengubah Preset Olah Gambar R&D Lab
function setelPresetGambarRnd(namaPreset, elemenTombol) {
    modePresetGambar = namaPreset;
    
    // Hilangkan kelas aktif dari semua tombol preset ruko biar rapi
    document.querySelectorAll('.btn-preset-rnd').forEach(btn => {
        btn.style.backgroundColor = "#333";
    });
    
    // Beri tanda warna berbeda pada tombol yang sedang aktif
    if (elemenTombol) {
        elemenTombol.style.backgroundColor = "#e67e22"; // Oranye menyala menandakan aktif
    }
    
    // Jalankan kalkulasi ulang piksel secara live!
    if (gambarMatengObor.src) {
        jalankanOlahBitmap();
    }
}
 

//PENGHAPUS BACKGROUND PUTIH
// --- 🧽 JEROAN BARU: SISTEM CORET PENGHAPUS PRESISI & POINTER GAIB ---
let modeHapusAktif = false;
let sedangMenghapus = false;
let ukuranKuasHapus = 20;
let listCoretanPutih = []; 

// Variabel menyimpan posisi terakhir mouse/jari buat gambar Tanda Target
let posisiX_Sekarang = 0;
let posisiY_Sekarang = 0;
let mouseDiAtasCanvas = false;

function aktifkanModeHapus() {
    const btn = document.getElementById('btn-mode-hapus');
    if (!btn) return;

    if (!modeHapusAktif) {
        modeHapusAktif = true;
        btn.innerText = "🛑 Matikan Penghapus";
        btn.style.backgroundColor = "#ff4d4d";
        inisialisasiKuasHapus();
    } else {
        modeHapusAktif = false;
        btn.innerText = "🧽 Aktifkan Penghapus";
        btn.style.backgroundColor = "#2196F3";
        mouseDiAtasCanvas = false;
        matikanKuasHapus();
        jalankanOlahBitmap(); // Bersihkan sisa lingkaran tanda target
    }
}

function ubahUkuranKuas(nilai) {
    ukuranKuasHapus = parseInt(nilai);
    const info = document.getElementById('info-kuas');
    if (info) info.innerText = nilai + "px";
    if (modeHapusAktif && gambarMatengObor.src) {
        jalankanOlahBitmap(); // Update lingkaran tanda target saat slider digeser
    }
}

function inisialisasiKuasHapus() {
    if (!canvasBitmap) return;
    
    // Mouse PC
    canvasBitmap.addEventListener('mouseenter', () => { mouseDiAtasCanvas = true; });
    canvasBitmap.addEventListener('mouseleave', () => { mouseDiAtasCanvas = false; sedangMenghapus = false; jalankanOlahBitmap(); });
    canvasBitmap.addEventListener('mousedown', mulaiCoretHapus);
    canvasBitmap.addEventListener('mousemove', prosesCoretHapus);
    window.addEventListener('mouseup', berhentiCoretHapus);
    
    // Sentuhan HP
    canvasBitmap.addEventListener('touchstart', mulaiCoretHapusHP, { passive: false });
    canvasBitmap.addEventListener('touchmove', prosesCoretHapusHP, { passive: false });
    canvasBitmap.addEventListener('touchend', berhentiCoretHapusHP);
}

function matikanKuasHapus() {
    if (!canvasBitmap) return;
    canvasBitmap.removeEventListener('mousedown', mulaiCoretHapus);
    canvasBitmap.removeEventListener('mousemove', prosesCoretHapus);
    canvasBitmap.removeEventListener('touchstart', mulaiCoretHapusHP);
    canvasBitmap.removeEventListener('touchmove', prosesCoretHapusHP);
}

// --- LOGIKA MOUSE PC ---
function mulaiCoretHapus(e) {
    if (!modeHapusAktif) return;
    sedangMenghapus = true;
    posisiX_Sekarang = e.offsetX;
    posisiY_Sekarang = e.offsetY;
    simpanDanCoret(posisiX_Sekarang, posisiY_Sekarang);
}

function prosesCoretHapus(e) {
    if (!modeHapusAktif) return;
    posisiX_Sekarang = e.offsetX;
    posisiY_Sekarang = e.offsetY;
    mouseDiAtasCanvas = true;
    
    if (sedangMenghapus) {
        simpanDanCoret(posisiX_Sekarang, posisiY_Sekarang);
    } else {
        jalankanOlahBitmap(); // Gambar tanda lingkaran targetnya aja pas mouse geser
    }
}

// --- LOGIKA SENTUHAN HP (DENGAN SETELAN PENYEIMBANG PRESISI / OFFSET) ---
// --- LOGIKA SENTUHAN HP DENGAN RUMUS ANTI-MELAR (SCALING RATIO) ---

function mulaiCoretHapusHP(e) {
    if (!modeHapusAktif) return;
    e.preventDefault();
    sedangMenghapus = true;
    mouseDiAtasCanvas = true;
    
    hitungKoordinatPresisiHP(e);
    simpanDanCoret(posisiX_Sekarang, posisiY_Sekarang);
}

function prosesCoretHapusHP(e) {
    if (!modeHapusAktif) return;
    e.preventDefault();
    
    hitungKoordinatPresisiHP(e);
    
    if (sedangMenghapus) {
        simpanDanCoret(posisiX_Sekarang, posisiY_Sekarang);
    } else {
        jalankanOlahBitmap();
    }
}

// 🚀 RUMUS UTAMA: Mengonversi Koordinat Layar Fisik HP ke Koordinat Pixel Internal Canvas
function hitungKoordinatPresisiHP(e) {
    const rect = canvasBitmap.getBoundingClientRect();
    
    // 1. Ambil posisi murni sentuhan jari terhadap ujung kotak canvas di layar
    let posisiLayarX = e.touches[0].clientX - rect.left;
    let posisiLayarY = e.touches[0].clientY - rect.top;
    
    // 2. HITUNG SKALA PERBANDINGAN (Ukuran Asli Pixel / Ukuran Fisik Layar)
    let skalaX = canvasBitmap.width / rect.width;
    let skalaY = canvasBitmap.height / rect.height;
    
    // 3. Kalikan posisi layar dengan skala biar koordinatnya pas murni di pixel gambar
    // Ditambah sedikit offset (-15 atau sesuka hati) ke atas biar gak ketutup daging jempol Abang
    posisiX_Sekarang = posisiLayarX * skalaX;
    posisiY_Sekarang = (posisiLayarY * skalaY) - (15 * skalaY); 
}

function berhentiCoretHapus() {
    sedangMenghapus = false;
}

function berhentiCoretHapusHP() {
    sedangMenghapus = false;
    mouseDiAtasCanvas = false; // Hilangkan lingkaran pas jari diangkat dari layar HP
    jalankanOlahBitmap();
}

function simpanDanCoret(x, y) {
    listCoretanPutih.push({ x: x, y: y, r: ukuranKuasHapus / 2 });
    jalankanOlahBitmap(); 
}

function gambarUlangSemuaCoretan() {
    listCoretanPutih.forEach(pt => {
        ctxBitmap.fillStyle = "#ffffff";
        ctxBitmap.beginPath();
        ctxBitmap.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctxBitmap.fill();
    });
}

// 🎯 FUNGSI BARU: Menggambar lingkaran tanda target (Pointer) penunjuk lokasi kuas
function gambarTandaTargetKuas() {	
    if (!modeHapusAktif || !mouseDiAtasCanvas) return;
    
    ctxBitmap.lineWidth = 2;
    ctxBitmap.strokeStyle = "#ff0000"; // Warna merah menyala biar kelihatan jelas di foto hitam putih!
    ctxBitmap.beginPath();
    // Gambar lingkaran bayangan sesuai diameter slider kuas
    ctxBitmap.arc(posisiX_Sekarang, posisiY_Sekarang, ukuranKuasHapus / 2, 0, Math.PI * 2);
    ctxBitmap.stroke();
    
    // Tambah titik pusat kecil di tengah lingkaran biar makin presisi
    ctxBitmap.fillStyle = "#ff0000";
    ctxBitmap.beginPath();
    ctxBitmap.arc(posisiX_Sekarang, posisiY_Sekarang, 2, 0, Math.PI * 2);
    ctxBitmap.fill();
}

function resetMemoriPenghapus() {
    listCoretanPutih = [];
    modeHapusAktif = false;
    mouseDiAtasCanvas = false;
    
    // 🚀 TAMBAHAN: Sembunyikan panel kembali pas ganti foto
    const panel = document.getElementById('wadah-kontrol-penghapus');
    if (panel) panel.style.display = 'none';
    
    const btnToggle = document.getElementById('btn-toggle-panel-hapus');
    if (btnToggle) {
        btnToggle.style.backgroundColor = "#4CAF50";
        btnToggle.innerHTML = '<i class="fas fa-eraser"></i>';
    }

    const btn = document.getElementById('btn-mode-hapus');
    if (btn) {
        btn.innerText = "🧽 Jalankan Kuas";
        btn.style.backgroundColor = "#2196F3";
    }
    matikanKuasHapus();
}
    
// --- 🎛️ FUNGSI TOGGLE POP-UP PANEL PENGHAPUS ---
function togglePanelPenghapus() {
    const panel = document.getElementById('wadah-kontrol-penghapus');
    const btnToggle = document.getElementById('btn-toggle-panel-hapus');
    
    if (!panel) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        // 🔓 MUNCULKAN PANEL (Paket Flex biar rapi, Bang!)
        panel.style.display = 'flex';
        btnToggle.style.backgroundColor = "#e67e22"; // Ubah warna tombol biar tahu lagi aktif
        btnToggle.innerHTML = '<i class="fas fa-eraser"></i>';
    } else {
        // 🔒 SEMBUNYIKAN PANEL
        panel.style.display = 'none';
        btnToggle.style.backgroundColor = "#4CAF50"; // Balik ke warna hijau semula
        btnToggle.innerHTML = '<i class="fas fa-eraser"></i>';
        
        // Pengaman otomatis: Kalau panel ditutup, matikan juga mode kuasnya biar gak bocor ngapus pas gak sengaja kesenggol
        if (modeHapusAktif) {
            aktifkanModeHapus(); 
        }
    }
}
