document.addEventListener('DOMContentLoaded', () => {
    // GANTI DENGAN URL GOOGLE APPS SCRIPT ANDA
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxR_eWYOtWPgMow1lScbEVpwf89IOdmYT1nt9fPaEPHU_lQB47c6AbXhYAx7YZK0sGRFQ/exec';

    // Elemen-elemen HTML
    const html5QrCode = new Html5Qrcode("reader");
    const scanResultDiv = document.getElementById('scan-result');
    const switchCameraBtn = document.getElementById('switch-camera-btn');

    // Variabel untuk manajemen kamera dan state
    let cameras = [];
    let currentCameraIndex = 0;
    const scannedCodes = new Set(); // Untuk menyimpan QR code yang sudah discan

    // Konfigurasi scanner
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Fungsi untuk memulai scanner dengan kamera tertentu
    function startCamera(cameraId) {
        html5QrCode.start(cameraId, config, onScanSuccess, onScanFailure)
            .catch(err => {
                console.error(`Gagal memulai scanner: ${err}`);
                showMessage("Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin.", "error");
            });
    }

    // Fungsi untuk menampilkan pesan
    function showMessage(message, type = 'success') {
        scanResultDiv.textContent = message;
        scanResultDiv.classList.remove('success', 'warning', 'error');
        scanResultDiv.classList.add(type);
    }

    // Fungsi yang dijalankan saat QR Code berhasil dipindai
    const onScanSuccess = async (decodedText, decodedResult) => {
        await html5QrCode.stop();
        console.log(`QR Code terdeteksi (mentah): "${decodedText}"`);

        // 1. CEK APAKAH QR CODE SUDAH PERNAH DISCAN
        if (scannedCodes.has(decodedText)) {
            showMessage("QR Code ini sudah pernah discan!", "warning");
            setTimeout(() => startCamera(cameras[currentCameraIndex].id), 2000);
            return;
        }

        // 2. CEK APAKAH QR CODE VALID (JSON yang benar)
        let data;
        try {
            // --- PERUBAHAN DIMULAI DI SINI ---
            // Bersihkan teks dari spasi di awal dan akhir sebelum di-parsing
            const cleanedText = decodedText.trim();
            console.log(`QR Code setelah dibersihkan: "${cleanedText}"`);
            data = JSON.parse(cleanedText);
            // --- PERUBAHAN SELESAI DI SINI ---

            // Validasi sekarang mencari 'nama' dan 'nisn'
            if (!data.nama || !data.nisn) {
                throw new Error("Data 'nama' atau 'nisn' tidak ditemukan di dalam QR Code.");
            }
        } catch (e) {
            // Tampilkan error yang lebih detail di console untuk debugging
            console.error("Gagal mem-parsing JSON:", e);
            showMessage("QR Code tidak valid", "error");
            setTimeout(() => startCamera(cameras[currentCameraIndex].id), 2000);
            return;
        }

        // 3. KIRIM DATA KE GOOGLE SHEET
        await kirimPresensi(data.nama, data.nisn, decodedText);
    };

    // Fungsi untuk mengirim data ke backend
    async function kirimPresensi(nama, nisn, rawQrText) {
        showMessage("Sedang mengirim data...", "success");
        
        const body = new URLSearchParams();
        body.append('nama', nama);
        body.append('nisn', nisn);
        body.append('status', 'Hadir');
    
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
            });
            
            const result = await response.json();
            
            if (result.result === 'success') {
                scannedCodes.add(rawQrText);
                showMessage(`${nama} hadir!`, "success");
            } else {
                throw new Error(result.error || 'Terjadi kesalahan yang tidak diketahui.');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage(`Gagal mengirim presensi: ${error.message}`, "error");
        } finally {
            setTimeout(() => startCamera(cameras[currentCameraIndex].id), 3000);
        }
    }

    const onScanFailure = (error) => {
        // Abaikan error ini
    };

    // --- Inisialisasi Kamera dan Tombol ---
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            cameras = devices;
            if (cameras.length === 1) {
                switchCameraBtn.style.display = 'none';
            } else {
                switchCameraBtn.disabled = false;
                switchCameraBtn.textContent = 'Ganti Kamera';
            }
            startCamera(cameras[currentCameraIndex].id);
        } else {
            showMessage("Tidak ada kamera yang terdeteksi di perangkat ini.", "error");
        }
    }).catch(err => {
        console.error(`Gagal mendapatkan daftar kamera: ${err}`);
        showMessage("Tidak dapat mengakses daftar kamera.", "error");
    });

    switchCameraBtn.addEventListener('click', () => {
        html5QrCode.stop().then(() => {
            currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
            const nextCamera = cameras[currentCameraIndex];
            startCamera(nextCamera.id);
        }).catch((err) => {
            console.error(`Gagal menghentikan scanner: ${err}`);
        });
    });
});
