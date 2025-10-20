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
        // Hapus kelas lama dan tambahkan kelas baru
        scanResultDiv.classList.remove('success', 'warning', 'error');
        scanResultDiv.classList.add(type);
    }

    // Fungsi yang dijalankan saat QR Code berhasil dipindai
    const onScanSuccess = async (decodedText, decodedResult) => {
        // Hentikan scanner sementara untuk memproses
        await html5QrCode.stop();

        console.log(`QR Code terdeteksi: ${decodedText}`);

        // 1. CEK APAKAH QR CODE SUDAH PERNAH DISCAN
        if (scannedCodes.has(decodedText)) {
            showMessage("Peringatan: QR Code ini sudah pernah discan!", "warning");
            // Mulai kembali scanner setelah 2 detik
            setTimeout(() => startCamera(cameras[currentCameraIndex].id), 2000);
            return;
        }

        // 2. CEK APAKAH QR CODE VALID (JSON yang benar)
        let data;
        try {
            data = JSON.parse(decodedText);
            if (!data.nama || !data.sesi) {
                throw new Error("Data 'nama' atau 'sesi' tidak ditemukan.");
            }
        } catch (e) {
            showMessage("Error: QR Code tidak valid atau formatnya salah.", "error");
            // Mulai kembali scanner setelah 2 detik
            setTimeout(() => startCamera(cameras[currentCameraIndex].id), 2000);
            return;
        }

        // 3. KIRIM DATA KE GOOGLE SHEET
        await kirimPresensi(data.nama, data.sesi, decodedText);
    };

    // Fungsi untuk mengirim data ke backend
    async function kirimPresensi(nama, sesi, rawQrText) {
        showMessage("Sedang mengirim data...", "success"); // Bisa juga pakai type lain
        
        const formData = new FormData();
        formData.append('nama', nama);
        formData.append('sesi', sesi);
        formData.append('status', 'Hadir');

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.result === 'success') {
                // Tandai QR code ini sebagai sudah discan
                scannedCodes.add(rawQrText);
                showMessage(`Presensi berhasil untuk ${nama}!`, "success");
            } else {
                throw new Error(result.error || 'Terjadi kesalahan yang tidak diketahui.');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage(`Gagal mengirim presensi: ${error.message}`, "error");
        } finally {
            // Mulai kembali scanner setelah 3 detik, siap untuk scan berikutnya
            setTimeout(() => startCamera(cameras[currentCameraIndex].id), 3000);
        }
    }

    // Fungsi saat scan gagal (dipanggil terus-menerus)
    const onScanFailure = (error) => {
        // Abaikan error ini agar console tidak penuh
        // console.warn(`QR Code scan failed: ${error}`);
    };

    // --- Inisialisasi Kamera dan Tombol ---
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            cameras = devices;
            
            // Jika hanya ada 1 kamera, nonaktifkan tombol
            if (cameras.length === 1) {
                switchCameraBtn.style.display = 'none';
            } else {
                switchCameraBtn.disabled = false;
                switchCameraBtn.textContent = 'Ganti Kamera';
            }
            
            // Mulai dengan kamera pertama (biasanya kamera belakang)
            startCamera(cameras[currentCameraIndex].id);
        } else {
            showMessage("Tidak ada kamera yang terdeteksi di perangkat ini.", "error");
        }
    }).catch(err => {
        console.error(`Gagal mendapatkan daftar kamera: ${err}`);
        showMessage("Tidak dapat mengakses daftar kamera.", "error");
    });

    // Event listener untuk tombol ganti kamera
    switchCameraBtn.addEventListener('click', () => {
        // Hentikan kamera saat ini
        html5QrCode.stop().then(() => {
            // Pindah ke kamera berikutnya
            currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
            const nextCamera = cameras[currentCameraIndex];
            
            // Mulai scanner dengan kamera baru
            startCamera(nextCamera.id);
        }).catch((err) => {
            console.error(`Gagal menghentikan scanner: ${err}`);
        });
    });
});
