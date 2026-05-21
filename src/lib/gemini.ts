import { SoalFormData, GeneratedSoal } from "../types";

// Fungsi pembantu untuk memberikan jeda waktu (dalam milidetik)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi pembantu fetch dengan penanganan error dan retry otomatis jika server Google sibuk (503)
async function fetchSecureWithRetry(url: string, options: any, retries = 3, backoff = 2000): Promise<any> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || "";
      
      // Jika backend melempar 500 karena Google mengembalikan 503 (model overloaded / high demand)
      const isGoogleBusy = response.status === 500 && 
        (errorMessage.includes("503") || 
         errorMessage.toLowerCase().includes("demand") || 
         errorMessage.toLowerCase().includes("unavailable"));

      if (isGoogleBusy && retries > 0) {
        console.warn(`[FIDHAL TOUNA AI] Server sibuk saat mengakses ${url}. Mencoba ulang dalam ${backoff}ms... (Sisa percobaan: ${retries})`);
        await delay(backoff);
        // Lakukan percobaan ulang dengan menaikkan jeda waktu tunggu (Exponential Backoff)
        return fetchSecureWithRetry(url, options, retries - 1, backoff * 1.5);
      }
      
      throw new Error(errorMessage || `Gagal memproses data pada rute ${url} (Status: ${response.status})`);
    }
    
    return await response.json();
  } catch (error: any) {
    // Jika error jaringan murni terdeteksi membawa pesan demand, coba lagi
    if (retries > 0 && error.message?.toLowerCase().includes("demand")) {
      await delay(backoff);
      return fetchSecureWithRetry(url, options, retries - 1, backoff * 1.5);
    }
    throw error;
  }
}

// PERBAIKAN STRATEGIS: Mengoptimalkan instruksi perhitungan skor riil dan rubrik deskriptif per jenis soal
const CUSTOM_INSTRUCTION = `PENTING: Gunakan selalu kata 'murid' untuk merujuk pada anak didik. Jangan pernah menggunakan istilah 'peserta didik' di dalam teks output yang Anda hasilkan.

WAJIB PISAHKAN RUBRIK DARI BAHASAN: Jangan mencampur informasi pembobotan skor atau rubrik ke dalam properti 'explanation'. Properti 'explanation' HANYA berisi pembahasan materi jawaban. Seluruh rincian nilai wajib dimasukkan ke properti 'score'.

ATURAN STRUKTUR & KALKULASI DINAMIS PADA FIELD "score":
Isi dari properti 'score' pada JSON setiap soal harus diawali dengan angka riil total skor hasil kalkulasi nyata Anda, diikuti oleh rincian rubriknya dengan format visual yang rapi:
"Skor Maksimal: [Angka Hasil Hitung Nyata]\n\nRubrik Penilaian:\n- ..."

Ketentuan Perhitungan & Penulisan Rubrik per Bentuk Soal:
1. Pilihan Ganda:
   - Wajib ditulis: "Skor Maksimal: 1"
   - Rubrik: "Skor 1 jika murid memilih satu opsi kunci jawaban dengan tepat. Skor 0 jika jawaban salah atau kosong."

2. Pilihan Ganda Kompleks:
   - Evaluasi jumlah opsi benar pada soal tersebut! Jika opsi yang benar ada 2, wajib ditulis: "Skor Maksimal: 2". Jika opsi benar ada 3, wajib ditulis: "Skor Maksimal: 3".
   - Rubrik: "Skor maksimal menyesuaikan total kunci jawaban benar ([Jumlah Opsi Benar] poin). Setiap 1 opsi benar yang dipilih murid mendapatkan 1 poin. Salah pilih opsi mendapat 0 poin."

3. Benar Salah:
   - Wajib ditulis: "Skor Maksimal: 1"
   - Rubrik: "Skor 1 jika murid tepat menentukan pernyataan Benar/Salah sesuai kunci. Skor 0 jika salah menentukan."

4. Menjodohkan:
   - Hitung total pasangan (matching pairs) yang tersedia di dalam soal tersebut! Jika ada 3 baris pasangan, wajib ditulis: "Skor Maksimal: 3".
   - Rubrik: "Skor maksimal dinamis berdasarkan jumlah pasangan ([Jumlah Pasangan] poin). Setiap baris hubungan pernyataan yang dijodohkan dengan benar oleh murid mendapatkan 1 poin."

5. Isian Singkat:
   - Wajib ditulis: "Skor Maksimal: 2"
   - Rubrik: "Skor 2 jika jawaban murid mutlak benar dan sesuai kata kunci utama. Skor 1 jika jawaban mendekati benar atau kurang lengkap. Skor 0 jika jawaban salah total/kosong."

6. Uraian:
   - Tentukan skor maksimal antara rentang 3 sampai 5 poin berdasarkan tingkat kedalaman berpikir soal. Contoh: "Skor Maksimal: 4".
   - Rubrik: Tuliskan rincian gradasi pencapaian nilai secara eksplisit (misal: "Skor 4 jika konsep dan analisis murid sempurna; Skor 3 jika konsep benar namun argumen kurang tajam; Skor 2 jika jawaban sebatas kulit luar materi; Skor 1 jika hanya menuliskan dasar ide; Skor 0 jika kosong").`;

// 1. HANYA GENERATE SOAL UTAMA (Dengan Proteksi Auto-Retry)
export async function generateSoalOnly(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    console.log("Memulai pembuatan soal utama saja...");
    
    // MENYISIPKAN INSTRUKSI KUSTOM KE DALAM DATA SEBELUM DIKIRIM KE BACKEND API
    const payload = {
      ...data,
      customInstruction: CUSTOM_INSTRUCTION
    };

    const dataSoal = await fetchSecureWithRetry('/api/generate/soal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      header: dataSoal.header,
      questions: dataSoal.questions,
      kisiKisi: [] // Kosong di awal sesuai permintaan
    };
  } catch (error: any) {
    console.error("Error Generate Soal Only:", error);
    if (error.message?.includes("503") || error.message?.toLowerCase().includes("demand")) {
      throw new Error("Server AI Google saat ini sedang sangat sibuk. Sistem telah mencoba otomatis sebanyak 3 kali namun tetap penuh. Silakan tunggu 30 detik lalu klik kembali tombol Generate.");
    }
    throw error;
  }
}

// 2. GENERATE KUNCI JAWABAN (Dipanggil saat tab Kunci diklik, Dengan Proteksi Auto-Retry)
export async function generateKunciOnly(header: any, questions: any[]): Promise<any[]> {
  try {
    console.log("Memulai pembuatan kunci jawaban secara terpisah...");
    const dataKunci = await fetchSecureWithRetry('/api/generate/kunci', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        header, 
        questions,
        customInstruction: CUSTOM_INSTRUCTION // Menyisipkan instruksi pada kunci jawaban
      }),
    });
    return dataKunci.questions;
  } catch (error: any) {
    console.error("Error Generate Kunci:", error);
    if (error.message?.includes("503") || error.message?.toLowerCase().includes("demand")) {
      throw new Error("Server AI sedang padat saat merumuskan Kunci Jawaban. Silakan klik ulang kembali tab Kunci & Bahasan.");
    }
    throw error;
  }
}

// 3. GENERATE KISI-KISI (Dipanggil saat tab Kisi-kisi diklik, Dengan Proteksi Auto-Retry)
export async function generateKisiOnly(formInput: SoalFormData, questions: any[]): Promise<any[]> {
  try {
    console.log("Memulai pembuatan kisi-kisi secara terpisah...");
    const dataKisi = await fetchSecureWithRetry('/api/generate/kisi-kisi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        formInput, 
        questions,
        customInstruction: CUSTOM_INSTRUCTION // Menyisipkan instruksi pada kisi-kisi
      }),
    });
    return dataKisi.kisiKisi;
  } catch (error: any) {
    console.error("Error Generate Kisi-Kisi:", error);
    if (error.message?.includes("503") || error.message?.toLowerCase().includes("demand")) {
      throw new Error("Server AI sedang padat saat merancang Kisi-kisi. Silakan klik ulang kembali tab Kisi-kisi.");
    }
    throw error;
  }
}
