document.addEventListener('DOMContentLoaded', () => {
    // GANTI DENGAN URL GOOGLE APPS SCRIPT ANDA
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxR_eWYOtWPgMow1lScbEVpwf89IOdmYT1nt9fPaEPHU_lQB47c6AbXhYAx7YZK0sGRFQ/exec';

    // --- Bagian Generator QR Code ---
    const generateBtn = document.getElementById('generate-btn');
    const sesiInput = document.getElementById('sesi-input');
    const qrcodeDiv = document.getElementById('qrcode');

    generateBtn.addEventListener('click', () => {
        const sesiId = sesiInput.value.trim();
        if (!sesiId) {
            alert('ID Sesi tidak boleh kosong!');
            return;
        }

        // Hapus QR Code sebelumnya jika ada
        qrcodeDiv.innerHTML = '';

        // Buat data untuk QR Code. Kita gunakan format JSON agar lebih terstruktur.
        const qrData = JSON.stringify({ sesi: sesiId });

        // Generate QR Code
        new QRCode(qrcodeDiv, {
            text: qrData,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    });

    // --- Bagian Scanner QR Code ---
    const html5QrCode = new Html5Qrcode("reader");
    const scanResultDiv = document.getElementById('scan-result');

    // Konfigurasi untuk memulai scanner
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Fungsi yang akan dijalankan saat QR Code berhasil dipindai
    const onScanSuccess = (decodedText, decodedResult) => {
        // Hentikan scanner setelah berhasil membaca satu kode
        html5QrCode.stop().then(() => {
            console.log(`QR Code terdeteksi: ${decodedText}`);
            
            let sesiId;
            try {
                // Parsing data JSON dari QR Code
                const data = JSON.parse(decodedText);
                sesiId = data.sesi;
            } catch (e) {
                alert('QR Code tidak valid!');
                return;
            }

            // Minta pengguna memasukkan nama
            const nama = prompt("QR Code terdeteksi untuk sesi: '" + sesiId + "'.\nMasukkan Nama Anda:");
            
            if (nama) {
                // Kirim data ke Google Apps Script
                kirimPresensi(nama, sesiId);
            } else {
                alert("Nama harus diisi untuk presensi.");
                // Opsional: Mulai kembali scanner jika nama tidak diisi
                // startScanner();
            }
        }).catch((err) => {
            console.error(`Gagal menghentikan scanner: ${err}`);
        });
    };

    // Fungsi untuk mengirim data ke backend
    async function kirimPresensi(nama, sesi) {
        scanResultDiv.textContent = "Sedang mengirim data...";
        
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
                scanResultDiv.textContent = `Presensi berhasil untuk ${nama}!`;
                scanResultDiv.style.color = 'green';
            } else {
                throw new Error(result.error || 'Terjadi kesalahan yang tidak diketahui.');
            }
        } catch (error) {
            console.error('Error:', error);
            scanResultDiv.textContent = `Gagal mengirim presensi: ${error.message}`;
            scanResultDiv.style.color = 'red';
        }
    }

    // Mulai scanner
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            const cameraId = devices[0].id; // Gunakan kamera pertama yang ditemukan
            html5QrCode.start(cameraId, config, onScanSuccess, onScanFailure).catch(err => {
                console.error(`Gagal memulai scanner: ${err}`);
                scanResultDiv.textContent = "Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin.";
            });
        }
    }).catch(err => {
        console.error(`Gagal mendapatkan daftar kamera: ${err}`);
        scanResultDiv.textContent = "Tidak ada kamera yang terdeteksi di perangkat ini.";
    });

    const onScanFailure = (error) => {
        // Fungsi ini akan dipanggil terus-menerus saat tidak ada QR Code yang terdeteksi
        // kita bisa mengabaikannya atau menampilkan pesan di console untuk debug
        // console.warn(`QR Code scan failed: ${error}`);
    };
});
