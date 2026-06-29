let cropperFoto;
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
if (fileInput) {
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
      
        // 🚀 RESET MEMORI CORETAN DISINI BIAR BERSIH SEPERTI BARU
        resetMemoriPenghapus();

        const reader = new FileReader();
        reader.onload = function(event) {
            // Sembunyikan teks bantu & hasil lama
            if (teksBantu) teksBantu.style.display = 'none';
            if (canvasBitmap) canvasBitmap.style.display = 'none';
            if (btnKirim) btnKirim.style.display = 'none';
            
            // Tampilkan gambar target buat di-crop
            if (imgTargetCrop) {
                imgTargetCrop.src = event.target.result;
                imgTargetCrop.style.display = 'block';
            }
            
            if (btnPotong) btnPotong.style.display = 'block'; 

            // Nyalakan mesin Cropper CropperJS
            if (cropperFoto) cropperFoto.destroy();
            cropperFoto = new Cropper(imgTargetCrop, {
                viewMode: 1,
                aspectRatio: NaN, // Bebas sesuka hati ngatur kotak potongnya
                background: true
            });
        };
        reader.readAsDataURL(file);
    });
}

// --- 2. PROSES EKSEKUSI POTONG FOTO ---
function eksekusiPotongFoto() {
    if (!cropperFoto) return;

    // Ambil gambar hasil crop & paksa resolusi tinggi
    const canvasHasilCrop = cropperFoto.getCroppedCanvas({
        width: 600, // SAKTI: Paksa lebar gambar jadi 1200 piksel biar titik dither super mikro
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
        
    gambarMatengObor.src = canvasHasilCrop.toDataURL();
    gambarMatengObor.onload = function() {
        // Matikan mesin cropper & sembunyikan gambarnya
        cropperFoto.destroy();
        cropperFoto = null;
        if (imgTargetCrop) imgTargetCrop.style.display = 'none';
        
        // Atur visibilitas tombol & canvas
        if (btnPotong) btnPotong.style.display = 'none';
        if (canvasBitmap) {
            canvasBitmap.style.display = 'block';
            canvasBitmap.width = gambarMatengObor.width;
            canvasBitmap.height = gambarMatengObor.height;
        }
        if (btnKirim) btnKirim.style.display = 'block';
          
        const btnGbr = document.getElementById('btnGbr');
        if (btnGbr) btnGbr.style.display = 'none';

        // Jalankan kalkulasi dither titik RDWorks!
        jalankanOlahBitmap();
    };
}

// --- 3. PROSES SLIDER GERAK (BRIGHTNESS, CONTRAST, DENSITY) ---
function updateNilaiDanProses() {
    if (valBright) valBright.innerText = slideBright.value;
    if (valContrast) valContrast.innerText = slideContrast.value;
    if (valDensity) valDensity.innerText = slideDensity.value;
        
    if (gambarMatengObor.src) {
        jalankanOlahBitmap();
    }
}

if (slideBright) slideBright.addEventListener('input', updateNilaiDanProses);
if (slideContrast) slideContrast.addEventListener('input', updateNilaiDanProses);
if (slideDensity) slideDensity.addEventListener('input', updateNilaiDanProses);

// --- 4. ENGINE SAKTI: FLOYD-STEINBERG DITHERING (BITMAP HANDLE) ---
function jalankanOlahBitmap() {
    if (!gambarMatengObor.src || !canvasBitmap) return;

    ctxBitmap.drawImage(gambarMatengObor, 0, 0);
    gambarUlangSemuaCoretan();

    const dataPiksel = ctxBitmap.getImageData(0, 0, canvasBitmap.width, canvasBitmap.height);
    const d = dataPiksel.data;
    const w = dataPiksel.width;

    const bVal = parseInt(slideBright.value || 0);
    const cVal = parseInt(slideContrast.value || 0);
    const factor = (259 * (cVal + 255)) / (255 * (259 - cVal));
    const density = parseInt(slideDensity.value || 1); 

    // TAHAP A: Atur Kecerahan, Kontras, Grayscale, & Preset Media
    for (let i = 0; i < d.length; i += 4) {
        let r = d[i];
        let g = d[i+1];
        let b = d[i+2];

        // 1. Brightness
        r += bVal; g += bVal; b += bVal;

        // 2. Contrast
        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;

        // 3. Grayscale murni
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        gray = Math.min(255, Math.max(0, gray));

        // FORMULA SAKTI PRESET MODE
        if (modePresetGambar === "akrilik") {
            gray = 255 - gray; // Mode Invert warna
        } else if (modePresetGambar === "siluet") {
            gray = gray < 128 ? 0 : 255; // Mode Kontras Tinggi murni hitam putih
        }

        d[i] = gray; d[i+1] = gray; d[i+2] = gray;
    }

    // Tahap B: Algoritma Floyd-Steinberg Dithering
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

function distribusikanError(data, x, y, width, maxW, maxH, error) {
    if (x < 0 || x >= maxW || y < 0 || y >= maxH) return;
    let idx = (y * width + x) * 4;
    data[idx] += error;
    data[idx+1] += error;
    data[idx+2] += error;
}

// --- 5. FUNGSI IMPOR: Kirim Hasil Foto Langsung ke Canvas Editor Utama ---
function kirimKeEditorBapak() {
    if (!canvasBitmap) return;
    const dataHasilBitmap = canvasBitmap.toDataURL('image/png');
    
    // Tembak langsung elemen logo geser di editor utama tanpa perantara iframe lagi!
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

    const btnGbr = document.getElementById('btnGbr');
    if (btnGbr) btnGbr.style.display = 'block';
}

// --- 🚀 REPARASI PASTE (CTRL+V) GAIB ANTI-ERROR ---
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
        console.log("📋 Ada gambar di-paste, langsung diproses...");
        resetMemoriPenghapus();
        const reader = new FileReader();
        reader.onload = function(event) {
            if (document.getElementById('teks-bantu')) document.getElementById('teks-bantu').style.display = 'none';
            if (document.getElementById('canvas-bitmap')) document.getElementById('canvas-bitmap').style.display = 'none';
            if (document.getElementById('btn-kirim-editor')) document.getElementById('btn-kirim-editor').style.display = 'none';
            
            const imgTarget = document.getElementById('img-target-crop');
            const btnPotongSekarang = document.getElementById('btn-potong-sekarang');
            
            if (imgTarget && btnPotongSekarang) {
                imgTarget.src = event.target.result;
                imgTarget.style.display = 'block';
                btnPotongSekarang.style.display = 'block';

                if (cropperFoto) cropperFoto.destroy();
                cropperFoto = new Cropper(imgTarget, {
                    viewMode: 1,
                    aspectRatio: NaN,
                    background: true
                });
            }
        };
        reader.readAsDataURL(fileGambar);
    }
});
    
// Fungsi untuk Mengubah Preset Olah Gambar R&D Lab
function setelPresetGambarRnd(namaPreset, elemenTombol) {
    modePresetGambar = namaPreset;
    
    document.querySelectorAll('.btn-preset-rnd').forEach(btn => {
        btn.style.backgroundColor = "#333";
    });
    
    if (elemenTombol) {
        elemenTombol.style.backgroundColor = "#e67e22"; // Oranye menyala
    }
    
    if (gambarMatengObor.src) {
        jalankanOlahBitmap();
    }
}

// --- 🧽 SISTEM CORET PENGHAPUS PRESISI & POINTER ---
let modeHapusAktif = false;
let sedangMenghapus = false;
let ukuranKuasHapus = 20;
let listCoretanPutih = []; 

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
        jalankanOlahBitmap(); 
    }
}

function ubahUkuranKuas(nilai) {
    ukuranKuasHapus = parseInt(nilai);
    const info = document.getElementById('info-kuas');
    if (info) info.innerText = nilai + "px";
    if (modeHapusAktif && gambarMatengObor.src) {
        jalankanOlahBitmap(); 
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
        jalankanOlahBitmap(); 
    }
}

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

function hitungKoordinatPresisiHP(e) {
    if (!canvasBitmap) return;
    const rect = canvasBitmap.getBoundingClientRect();
    
    let posisiLayarX = e.touches[0].clientX - rect.left;
    let posisiLayarY = e.touches[0].clientY - rect.top;
    
    let skalaX = canvasBitmap.width / rect.width;
    let skalaY = canvasBitmap.height / rect.height;
    
    posisiX_Sekarang = posisiLayarX * skalaX;
    posisiY_Sekarang = (posisiLayarY * skalaY) - (15 * skalaY); 
}

function berhentiCoretHapus() {
    sedangMenghapus = false;
}

function berhentiCoretHapusHP() {
    sedangMenghapus = false;
    mouseDiAtasCanvas = false; 
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

function gambarTandaTargetKuas() { 
    if (!modeHapusAktif || !mouseDiAtasCanvas) return;
    
    ctxBitmap.lineWidth = 2;
    ctxBitmap.strokeStyle = "#ff0000"; // Merah menyala
    ctxBitmap.beginPath();
    ctxBitmap.arc(posisiX_Sekarang, posisiY_Sekarang, ukuranKuasHapus / 2, 0, Math.PI * 2);
    ctxBitmap.stroke();
    
    ctxBitmap.fillStyle = "#ff0000";
    ctxBitmap.beginPath();
    ctxBitmap.arc(posisiX_Sekarang, posisiY_Sekarang, 2, 0, Math.PI * 2);
    ctxBitmap.fill();
}

function resetMemoriPenghapus() {
    listCoretanPutih = [];
    modeHapusAktif = false;
    mouseDiAtasCanvas = false;
    
    const panel = document.getElementById('wadah-kontrol-penghapus');
    if (panel) panel.style.display = 'none';
    
    const btnToggle = document.getElementById('btn-toggle-panel-hapus');
    if (btnToggle) {
        btnToggle.style.backgroundColor = "#4CAF50";
        btnToggle.innerHTML = '🧽 Hapusan';
    }

    const btn = document.getElementById('btn-mode-hapus');
    if (btn) {
        btn.innerText = "🧽 Jalankan Kuas";
        btn.style.backgroundColor = "#2196F3";
    }
    matikanKuasHapus();
}
    
function togglePanelPenghapus() {
    const panel = document.getElementById('wadah-kontrol-penghapus');
    const btnToggle = document.getElementById('btn-toggle-panel-hapus');
    
    if (!panel) return;
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'flex';
        if (btnToggle) btnToggle.style.backgroundColor = "#e67e22"; 
    } else {
        panel.style.display = 'none';
        if (btnToggle) btnToggle.style.backgroundColor = "#4CAF50"; 
        if (modeHapusAktif) {
            aktifkanModeHapus(); 
        }
    }
      document.getElementById("media-Grafir").style.display = 'none';
      document.getElementById("titik-Dot").style.display = 'none';
      mgrafir.style.color ='black';
      titikd.style.color ='black';
}
