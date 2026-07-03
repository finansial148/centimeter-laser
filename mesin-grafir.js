let cropperFoto;
let gambarMatengObor = new Image(); 
let modePresetGambar = "kayu"; // "kayu", "akrilik", "siluet", "halftone", atau "sketsa"

const fileInput = document.getElementById('file-input');
const imgTargetCrop = document.getElementById('img-target-crop');
const canvasBitmap = document.getElementById('canvas-bitmap');
const ctxBitmap = canvasBitmap.getContext('2d');
const teksBantu = document.getElementById('teks-bantu');
const btnPotong = document.getElementById('btn-potong-sekarang');
const btnKirim = document.getElementById('btn-kirim-editor');

// Slider Standar
const slideBright = document.getElementById('slide-bright');
const slideContrast = document.getElementById('slide-contrast');
const slideDensity = document.getElementById('slide-density');

const valBright = document.getElementById('val-bright');
const valContrast = document.getElementById('val-contrast');
const valDensity = document.getElementById('val-density');

// --- 🌟 SLIDER BARU: GAMMA & SHARPEN ---
const slideGamma = document.getElementById('slide-gamma') || { value: 1.0 };
const slideSharpen = document.getElementById('slide-sharpen') || { value: 0 };

const valGamma = document.getElementById('val-gamma');
const valSharpen = document.getElementById('val-sharpen');

// --- 1. PROSES BUKA FILE & NYALAKAN CROPPER ---
if (fileInput) {
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            if (teksBantu) teksBantu.style.display = 'none';
            if (canvasBitmap) canvasBitmap.style.display = 'none';
            if (btnKirim) btnKirim.style.display = 'none';
            
            if (imgTargetCrop) {
                imgTargetCrop.src = event.target.result;
                imgTargetCrop.style.display = 'block';
            }
            if (btnPotong) btnPotong.style.display = 'block'; 

            if (cropperFoto) cropperFoto.destroy();
            cropperFoto = new Cropper(imgTargetCrop, {
                viewMode: 1,
                aspectRatio: NaN,
                background: true
            });
        };
        reader.readAsDataURL(file);
    });
}

// --- 2. PROSES EKSEKUSI POTONG FOTO ---
function eksekusiPotongFoto() {
    if (!cropperFoto) return;

    const canvasHasilCrop = cropperFoto.getCroppedCanvas({
        width: 1200, // Resolusi tinggi agar titik laser mikro pas di RDWorks
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
        
    gambarMatengObor.src = canvasHasilCrop.toDataURL();
    gambarMatengObor.onload = function() {
        if (cropperFoto) {
            cropperFoto.destroy();
            cropperFoto = null;
        }
        if (imgTargetCrop) imgTargetCrop.style.display = 'none';
        
        if (btnPotong) btnPotong.style.display = 'none';
        if (canvasBitmap) {
            canvasBitmap.style.display = 'block';
            canvasBitmap.width = gambarMatengObor.width;
            canvasBitmap.height = gambarMatengObor.height;
        }
        if (btnKirim) btnKirim.style.display = 'block';
          
        const btnGbr = document.getElementById('btnGbr');
        if (btnGbr) btnGbr.style.display = 'none';

        jalankanOlahBitmap();
    };
    if (document.getElementById('kotakmen-uGrafir')) {
        document.getElementById('kotakmen-uGrafir').style.display = "flex";  
    }
}

// --- 3. PROSES SLIDER GERAK ---
function updateNilaiDanProses() {
    if (valBright) valBright.innerText = slideBright.value;
    if (valContrast) valContrast.innerText = slideContrast.value;
    if (valDensity) valDensity.innerText = slideDensity.value;
    if (valGamma) valGamma.innerText = slideGamma.value;
    if (valSharpen) valSharpen.innerText = slideSharpen.value;
        
    if (gambarMatengObor.src) {
        jalankanOlahBitmap();
    }
}

if (slideBright) slideBright.addEventListener('input', updateNilaiDanProses);
if (slideContrast) slideContrast.addEventListener('input', updateNilaiDanProses);
if (slideDensity) slideDensity.addEventListener('input', updateNilaiDanProses);
if (slideGamma.addEventListener) slideGamma.addEventListener('input', updateNilaiDanProses);
if (slideSharpen.addEventListener) slideSharpen.addEventListener('input', updateNilaiDanProses);

// --- 4. ENGINE UTAMA: ENGINE BITMAP GRAFIR ---
function jalankanOlahBitmap() {
    if (!gambarMatengObor.src || !canvasBitmap) return;

    // Masukkan gambar asli ke canvas awal
    ctxBitmap.drawImage(gambarMatengObor, 0, 0);

    const w = canvasBitmap.width;
    const h = canvasBitmap.height;
    
    // Ambil data piksel mentah
    let imgData = ctxBitmap.getImageData(0, 0, w, h);
    
    // TAHAP 1: Filter Penajaman (Sharpening Matrix 3x3) jika slider > 0
    const nilaiSharpen = parseFloat(slideSharpen.value || 0);
    if (nilaiSharpen > 0) {
        imgData = terapkanSharpening(imgData, nilaiSharpen);
    }

    const d = imgData.data;
    const bVal = parseInt(slideBright.value || 0);
    const cVal = parseInt(slideContrast.value || 0);
    const factor = (259 * (cVal + 255)) / (255 * (259 - cVal));
    const density = parseInt(slideDensity.value || 1); 
    const gamma = parseFloat(slideGamma.value || 1.0);

    // TAHAP 2: Pengolahan Warna Dasar & Mode Preset Efek
    if (modePresetGambar === "sketsa") {
        // Efek Sketsa Pensil murni menggunakan teknik deteksi tepi (Sobel Edge)
        const sketsaData = terapkanEfekSketsa(imgData);
        for (let i = 0; i < d.length; i++) d[i] = sketsaData[i];
    } else {
        // Mode Standar (Kayu, Akrilik, Siluet, Halftone)
        for (let i = 0; i < d.length; i += 4) {
            let r = d[i];
            let g = d[i+1];
            let b = d[i+2];

            // Brightness & Contrast
            r = factor * (r + bVal - 128) + 128;
            g = factor * (g + bVal - 128) + 128;
            b = factor * (b + bVal - 128) + 128;

            // Koreksi Gamma (Mengangkat Midtone tanpa merusak Pure Black/White)
            if (gamma !== 1.0) {
                r = 255 * Math.pow(Math.max(0, r) / 255, 1 / gamma);
                g = 255 * Math.pow(Math.max(0, g) / 255, 1 / gamma);
                b = 255 * Math.pow(Math.max(0, b) / 255, 1 / gamma);
            }

            // Grayscale Rumus Persepsi Mata
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            gray = Math.min(255, Math.max(0, gray));

            // Penyesuaian Preset Khusus
            if (modePresetGambar === "akrilik") {
                gray = 255 - gray; // Invert untuk grafir tembus pandang
            } else if (modePresetGambar === "siluet") {
                gray = gray < 128 ? 0 : 255; // Ambang batas ekstrem (Murni Hitam/Putih)
            }

            d[i] = gray; d[i+1] = gray; d[i+2] = gray;
        }
    }

    // TAHAP 3: Render Bentuk Akhir (Halftone Koran / Dithering Titik)
    if (modePresetGambar === "halftone") {
        terapkanHalftoneSemu(ctxBitmap, imgData, density);
    } else {
        // Algoritma Floyd-Steinberg Dithering untuk Akrilik, Kayu, Siluet, dan Sketsa
        for (let y = 0; y < h; y += density) {
            for (let x = 0; x < w; x += density) {
                let idx = (y * w + x) * 4;
                let oldPixel = d[idx];
                let newPixel = oldPixel < 128 ? 0 : 255;
                
                for (let dy = 0; dy < density && (y + dy) < h; dy++) {
                    for (let dx = 0; dx < density && (x + dx) < w; dx++) {
                        let blockIdx = ((y + dy) * w + (x + dx)) * 4;
                        d[blockIdx] = newPixel; d[blockIdx+1] = newPixel; d[blockIdx+2] = newPixel;
                    }
                }

                let error = oldPixel - newPixel;
                distribusikanError(d, x + density, y, w, w, h, error * 7 / 16);
                distribusikanError(d, x - density, y + density, w, w, h, error * 3 / 16);
                distribusikanError(d, x, y + density, w, w, h, error * 5 / 16);
                distribusikanError(d, x + density, y + density, w, w, h, error * 1 / 16);
            }
        }
        ctxBitmap.putImageData(imgData, 0, 0);
    }
}

function distribusikanError(data, x, y, width, maxW, maxH, error) {
    if (x < 0 || x >= maxW || y < 0 || y >= maxH) return;
    let idx = (y * width + x) * 4;
    data[idx] += error;
    data[idx+1] += error;
    data[idx+2] += error;
}

// --- ⚙️ FUNGSI MATRIKS KETAJAMAN (SHARPENING 3x3) ---
function terapkanSharpening(imgData, tingkatKetajaman) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const output = ctxBitmap.createImageData(w, h);
    const dst = output.data;

    // Matriks Laplasian custom berdasarkan nilai slider
    const k = tingkatKetajaman;
    const matriks = [
         0, -k,  0,
        -k, 1 + (4 * k), -k,
         0, -k,  0
    ];

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let rSum = 0, gSum = 0, bSum = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const pixelIdx = ((y + ky) * w + (x + kx)) * 4;
                    const bobotMatriks = matriks[(ky + 1) * 3 + (kx + 1)];
                    
                    rSum += src[pixelIdx] * bobotMatriks;
                    gSum += src[pixelIdx+1] * bobotMatriks;
                    bSum += src[pixelIdx+2] * bobotMatriks;
                }
            }

            const idxAwal = (y * w + x) * 4;
            dst[idxAwal]   = Math.min(255, Math.max(0, rSum));
            dst[idxAwal+1] = Math.min(255, Math.max(0, gSum));
            dst[idxAwal+2] = Math.min(255, Math.max(0, bSum));
            dst[idxAwal+3] = src[idxAwal+3]; // Alpha tetap aman
        }
    }
    return output;
}

// --- ⚙️ FUNGSI DETEKSI TEPI (SOBEL EDGE FOR SKETCH) ---
function terapkanEfekSketsa(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const bufferMurniHitam = new Uint8ClampedArray(src.length);

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            // Hitung gradien horizontal (Gx) & vertikal (Gy) ala Sobel operator
            let gx = 0, gy = 0;

            const idxTopLeft  = ((y - 1) * w + (x - 1)) * 4;
            const idxTopMid   = ((y - 1) * w + x) * 4;
            const idxTopRight = ((y - 1) * w + (x + 1)) * 4;
            const idxMidLeft  = (y * w + (x - 1)) * 4;
            const idxMidRight = (y * w + (x + 1)) * 4;
            const idxBotLeft  = ((y + 1) * w + (x - 1)) * 4;
            const idxBotMid   = ((y + 1) * w + x) * 4;
            const idxBotRight = ((y + 1) * w + (x + 1)) * 4;

            // Merubah warna sekitar ke kecerahan abu-abu kilat
            const tl = src[idxTopLeft],  tm = src[idxTopMid],  tr = src[idxTopRight];
            const ml = src[idxMidLeft],                        mr = src[idxMidRight];
            const bl = src[idxBotLeft],  bm = src[idxBotMid],  br = src[idxBotRight];

            gx = (-1 * tl) + (1 * tr) + (-2 * ml) + (2 * mr) + (-1 * bl) + (1 * br);
            gy = (-1 * tl) + (-2 * tm) + (-1 * tr) + (1 * bl) + (2 * bm) + (1 * br);

            const nilaiTepi = Math.sqrt(gx * gx + gy * gy);
            
            // Balik warnanya agar latar belakang putih dan garis tepi hitam (seperti sketsa pensil)
            let warnaSketsa = 255 - nilaiTepi;
            warnaSketsa = Math.min(255, Math.max(0, warnaSketsa));

            const idxSkrg = (y * w + x) * 4;
            bufferMurniHitam[idxSkrg]   = warnaSketsa;
            bufferMurniHitam[idxSkrg+1] = warnaSketsa;
            bufferMurniHitam[idxSkrg+2] = warnaSketsa;
            bufferMurniHitam[idxSkrg+3] = 255;
        }
    }
    return bufferMurniHitam;
}

// --- ⚙️ FUNGSI HALFTONE RETRO SEMU ---
function terapkanHalftoneSemu(ctx, imgData, density) {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;

    // Bersihkan layar jadi background putih total
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#000000";

    const ukuranKotak = density * 4; // Pengali kerapatan lubang dot

    for (let y = 0; y < h; y += ukuranKotak) {
        for (let x = 0; x < w; x += ukuranKotak) {
            let idx = (y * w + x) * 4;
            if (idx >= src.length) continue;
            
            let gray = src[idx];
            
            // Semakin gelap piksel aslinya, lingkaran hitamnya makin melar besar
            let rasioGelap = (255 - gray) / 255; 
            let radiusMaks = ukuranKotak * 0.75;
            let radiusKoran = radiusMaks * rasioGelap;

            if (radiusKoran > 0.5) {
                ctx.beginPath();
                ctx.arc(x + ukuranKotak/2, y + ukuranKotak/2, radiusKoran, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// --- 5. FUNGSI IMPOR KELUAR ---
function kirimKeEditorBapak() {
    if (!canvasBitmap) return;
    const dataHasilBitmap = canvasBitmap.toDataURL('image/png');
    
    const logo = document.getElementById('logo-geser');
    if (logo) {
        logo.src = dataHasilBitmap;
        logo.style.display = 'block';
        logo.style.top = '20px';
        logo.style.left = '20px';
        logo.style.width = '200px';
        logo.style.filter = 'none';
        
        if (typeof perbaruiDaftarLayers === "function") perbaruiDaftarLayers();
        if (typeof tutupModalphoto === "function") tutupModalphoto();
        console.log("📸 Foto grafir sukses dikirim ke editor utama!");
    }

    const btnGbr = document.getElementById('btnGbr');
    if (btnGbr) btnGbr.style.display = 'block';
}

// --- 6. PASTE HANDLER ---
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
    
function setelPresetGambarRnd(namaPreset, elemenTombol) {
    modePresetGambar = namaPreset;
    
    document.querySelectorAll('.btn-preset-rnd').forEach(btn => {
        btn.style.backgroundColor = "#333";
    });
    
    if (elemenTombol) {
        elemenTombol.style.backgroundColor = "#e67e22";
    }
    
    if (gambarMatengObor.src) {
        jalankanOlahBitmap();
    }
}
