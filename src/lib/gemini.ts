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

// PERBAIKAN KRITIKAL: Memaksa Gemini membuat kriteria logika skor bergradasi, istilah 'murid', dan akurasi deskripsi gambar khusus (imagePrompt)
const CUSTOM_INSTRUCTION = `PENTING: Gunakan selalu kata 'murid' untuk merujuk pada anak didik. Jangan pernah menggunakan istilah 'peserta didik' di dalam teks output yang Anda hasilkan.

STRICT RULE - DESKRIPSI STIMULUS VISUAL KHUSUS:
Setiap kali Anda merancang pertanyaan, Anda WAJIB menambahkan properti baru bernama 'imagePrompt' di dalam setiap objek soal. 
Isi dari 'imagePrompt' harus berupa deskripsi gambar pendukung yang sangat spesifik, akurat, dan relevan dengan esensi soal tersebut dalam BAHASA INGGRIS. Jangan memasukkan teks pertanyaan ke dalamnya, melainkan deskripsikan objek visualnya secara jelas (contoh: jika soal matematika menghitung volume kubus, isi imagePrompt dengan "A clear 3D mathematical diagram of a single cube with side measurements written on it").

STRICT RULE - PEMBAHASAN DAN LOGIKA SKOR/RUBRIK WAJIB TERPISAH:
1. Kolom Pembahasan ('explanation'): Wajib diisi dengan analisis ilmiah, langkah penyelesaian matematis/logis, atau penjelasan teoritis mengapa kunci jawaban tersebut benar.
2. Kolom Skor ('score'): JANGAN PERNAH mengisi skor konstan 1 untuk tipe soal non-objektif! Properti ini HARUS diisi dengan kalkulasi bergradasi mengikuti format string wajib berikut:
"Skor Maksimal: [Angka_Skor]\n\nRubrik Penilaian:\n[Detail_Aturan_Penilaian]"

Ketentuan Perhitungan Nilai & Logika Rubrik Berdasarkan Bentuk Soal:

1. Pilihan Ganda (PG)
   - Aturan: Skor maksimal selalu 1.
   - Format isi 'score': "Skor Maksimal: 1\n\nRubrik Penilaian:\n- Skor 1: Murid memilih satu opsi jawaban benar dengan tepat.\n- Skor 0: Murid memilih opsi yang salah atau tidak menjawab."

2. Pilihan Ganda Kompleks (PGK)
   - Aturan: Hitung jumlah opsi yang benar pada soal ini. Jika ada 2 opsi benar, maka skor maksimal 2. Jika ada 3 opsi benar, skor maksimal 3.
   - Format isi 'score': "Skor Maksimal: [Tulis_Jumlah_Opsi_Benar_Di_Sini]\n\nRubrik Penilaian:\n- Skor diberikan secara proporsional (1 poin untuk setiap opsi benar yang dipilih dengan tepat oleh murid).\n- Salah memilih opsi atau tidak memilih mendapat skor 0."

3. Benar Salah (BS)
   - Aturan: Skor maksimal selalu 1.
   - Format isi 'score': "Skor Maksimal: 1\n\nRubrik Penilaian:\n- Skor 1: Murid tepat menentukan posisi Benar/Salah sesuai kunci.\n- Skor 0: Murid salah menentukan pilihan."

4. Menjodohkan
   - Aturan: Hitung jumlah baris pasangan (matching pairs) yang ada di dalam soal ini. Jika ada 3 pasangan, maka skor maksimal wajib 3.
   - Format isi 'score': "Skor Maksimal: [Tulis_Jumlah_Pasangan_Di_Sini]\n\nRubrik Penilaian:\n- Murid mendapatkan 1 poin untuk setiap pasangan baris yang dihubungkan dengan benar.\n- Skor 0 jika menjodohkan ke pasangan yang salah."

5. Isian Singkat
   - Aturan: Skor maksimal selalu 2.
   - Format isi 'score': "Skor Maksimal: 2\n\nRubrik Penilaian:\n- Skor 2: Jawaban murid mutlak benar sesuai kata kunci utama.\n- Skor 1: Jawaban murid mendekati benar atau kurang lengkap.\n- Skor 0: Jawaban salah atau kosong."

6. Uraian (STRICT FIX - DILARANG MEMBERI SKOR 1!)
   - Aturan: Berikan bobot skor maksimal antara rentang 4 sampai 5 secara objektif berdasarkan tingkat kesulitan analisis soal.
   - Format isi 'score' WAJIB breakdown logika nilai seperti contoh ini:
"Skor Maksimal: 4

Rubrik Penilaian:
- Skor 4: Murid menuliskan konsep, analisis argumentasi, dan langkah penyelesaian dengan sangat lengkap dan mutlak benar.
- Skor 3: Murid memahami konsep dasar, sebagian besar argumen/langkah benar namun ada detail kecil yang terlewat.
- Skor 2: Murid menjawab sebagian kecil dengan benar, namun kerangka berpikir atau hasil akhirnya kurang tepat.
- Skor 1: Murid hanya menuliskan kata kunci dasar, menyalin ulang soal, atau memberikan ide mentah yang tidak selesai.
- Skor 0: Jawaban murid salah total atau tidak diisi sama sekali."`;

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
      throw new Error("Server AI sedang padat saat merumuskan Kunci Jawaban. Silakan klik ulang kembali tab Kunci & Rubrik.");
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
