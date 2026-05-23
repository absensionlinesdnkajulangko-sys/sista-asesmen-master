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

// PERBAIKAN: Mengubah instruksi menjadi dinamis untuk membaca setelan gambar dari user, 
// tanpa mengurangi instruksi wajib analisis skor & penggunaan kata 'murid'.
function buildCustomInstruction(data?: Partial<SoalFormData>) {
  const baseRule = `PENTING: Gunakan selalu kata 'murid' untuk merujuk pada anak didik. Jangan pernah menggunakan istilah 'peserta didik' di dalam teks output yang Anda hasilkan.

STRICT RULE - PEMBAHASAN DAN LOGIKA SKOR/RUBRIK WAJIB TERPISAH:
Setiap soal WAJIB memiliki properti 'score' yang isinya terdiri dari dua bagian utama dengan format berikut:

"PEMBAHASAN MATERI:\n[Penjelasan mendalam mengenai konsep atau langkah penyelesaian materi soal ini agar murid paham konteksnya]\n\nANALISIS SKOR:\nSkor Maksimal: [Angka_Skor]\n\nRubrik Penilaian:\n[Detail_Aturan_Penilaian untuk setiap level skor]"

Ketentuan Detail:
1. PEMBAHASAN MATERI: Jelaskan logika di balik jawaban yang benar. Jika soal hitungan, berikan langkah pengerjaannya. Jika soal konsep, jelaskan definisinya.
2. ANALISIS SKOR: Berikan breakdown penilaian. Contoh:
   - Skor X: Murid menjawab benar sepenuhnya karena alasan [X].
   - Skor Y: Murid menjawab sebagian benar karena [Y].
   - Skor 0: Murid tidak memberikan jawaban yang relevan.

Ketentuan Perhitungan Nilai Berdasarkan Bentuk Soal:
(Gunakan panduan berikut untuk mengisi 'ANALISIS SKOR')

1. Pilihan Ganda (PG)
   - Skor maksimal: 1
   - Rubrik: Skor 1 jika jawaban benar, Skor 0 jika salah.

2. Pilihan Ganda Kompleks (PGK)
   - Skor maksimal: [Jumlah Opsi Benar]
   - Rubrik: Skor diberikan proporsional (1 poin per jawaban benar).

3. Benar Salah (BS)
   - Skor maksimal: 1
   - Rubrik: Skor 1 jika tepat memilih Benar/Salah, Skor 0 jika sebaliknya.

4. Menjodohkan
   - Skor maksimal: [Jumlah Pasangan]
   - Rubrik: Skor 1 untuk setiap pasangan yang dihubungkan dengan benar.

5. Isian Singkat
   - Skor maksimal: 2
   - Rubrik: Skor 2 (Jawaban tepat), Skor 1 (Jawaban mendekati/kurang lengkap), Skor 0 (Salah).

6. Uraian
   - Skor maksimal: 4 atau 5
   - Rubrik: Berikan rincian bobot dari Skor 0 hingga Skor Maksimal berdasarkan kelengkapan argumen, ketepatan analisis, dan kerangka berpikir murid.`;

  let imageRule = "";
  
  if (data && data.withImages && data.imageCount && data.imageCount > 0) {
    imageRule = `\n\nSTRICT RULE - PEMILIHAN STIMULUS VISUAL (SOAL BERGAMBAR):
Berdasarkan permintaan sistem, Anda WAJIB menyertakan stimulus visual pada TEPAT ${data.imageCount} soal dari total soal yang Anda buat.
1. UNTUK ${data.imageCount} SOAL BERGAMBAR TERSEBUT: Tambahkan properti 'imagePrompt' di dalam objek soal. Isi dari 'imagePrompt' harus berupa deskripsi gambar pendukung yang sangat spesifik, akurat, dan relevan dengan esensi soal tersebut dalam BAHASA INGGRIS. Jangan memasukkan teks pertanyaan ke dalamnya, melainkan deskripsikan objek visualnya secara jelas (contoh: "A clear 3D mathematical diagram of a single cube with side measurements written on it").
2. UNTUK SISA SOAL LAINNYA: JANGAN menambahkan properti 'imagePrompt' ke dalam objek soal (atau isi nilainya dengan string kosong).`;
  } else {
    imageRule = `\n\nSTRICT RULE - TANPA STIMULUS VISUAL:
Sistem menetapkan untuk tidak menggunakan gambar. JANGAN menambahkan properti 'imagePrompt' ke dalam objek soal mana pun. Semua soal harus murni berbasis teks.`;
  }

  return baseRule + imageRule;
}

// 1. HANYA GENERATE SOAL UTAMA (Dengan Proteksi Auto-Retry)
export async function generateSoalOnly(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    console.log("Memulai pembuatan soal utama saja...");
    
    // Menyisipkan instruksi yang sudah beradaptasi dengan form input (khususnya jumlah gambar)
    const payload = {
      ...data,
      customInstruction: buildCustomInstruction(data)
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
        customInstruction: buildCustomInstruction() // Pakai rule dasar
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
        customInstruction: buildCustomInstruction(formInput) // Ikutkan konteks form jika diperlukan
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
