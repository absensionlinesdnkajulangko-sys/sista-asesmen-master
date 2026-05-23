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

// PERBAIKAN: Mengubah instruksi menjadi sangat ketat agar AI tidak salah meletakkan deskripsi gambar ke dalam stimulus
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
1. Pilihan Ganda (PG) -> Skor maksimal: 1 (Skor 1 jika benar, 0 jika salah).
2. Pilihan Ganda Kompleks (PGK) -> Skor maksimal: [Jumlah Opsi Benar] (Proporsional).
3. Benar Salah (BS) -> Skor maksimal: 1.
4. Menjodohkan -> Skor maksimal: [Jumlah Pasangan].
5. Isian Singkat -> Skor maksimal: 2.
6. Uraian -> Skor maksimal: 4 atau 5.`;

  let imageRule = "";
  
  if (data && data.withImages && data.imageCount && data.imageCount > 0) {
    imageRule = `\n\nSTRICT RULE - PEMBUATAN SOAL BERGAMBAR (WAJIB DIIKUTI 100%):
Sistem meminta agar TEPAT ${data.imageCount} soal memiliki visual/gambar.

TUGAS ANDA UNTUK ${data.imageCount} SOAL TERSEBUT:
1. Anda WAJIB menyisipkan properti JSON dengan nama persis "imagePrompt" (tipe data string).
2. Isi "imagePrompt" dengan DESKRIPSI GAMBAR DALAM BAHASA INGGRIS yang sangat detail. Contoh: "A 2D vector illustration of the Garuda Pancasila shield, solid white background, flat design."
3. LARANGAN KERAS: JANGAN PERNAH menaruh deskripsi gambar di dalam properti "stimulus". Properti "stimulus" HANYA untuk teks literasi/bacaan paragraf.
4. Di properti "text", langsung saja buat pertanyaannya.

Untuk soal sisanya yang TIDAK bergambar, KOSONGKAN properti "imagePrompt" (berikan string kosong "").`;
  } else {
    imageRule = `\n\nSTRICT RULE - TANPA STIMULUS VISUAL:
Sistem menetapkan untuk tidak menggunakan gambar. JANGAN menambahkan properti 'imagePrompt' ke dalam objek soal mana pun. Semua soal harus murni berbasis teks.`;
  }

  return baseRule + imageRule;
}

// 1. HANYA GENERATE SOAL UTAMA (Dengan Proteksi Auto-Retry & Validasi Input)
export async function generateSoalOnly(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    console.log("Memulai pembuatan soal utama saja...");

    // CEGAT KESALAHAN INPUT PENGGUNA DI SINI
    if (data.withImages && data.imageCount !== undefined && data.questionCount !== undefined) {
      if (data.imageCount > data.questionCount) {
        throw new Error(`Kesalahan Input: Anda meminta ${data.imageCount} soal bergambar, padahal total soal hanya ${data.questionCount}. Jumlah gambar tidak boleh melebihi total soal.`);
      }
      if (data.imageCount < 0) {
        throw new Error("Kesalahan Input: Jumlah soal bergambar tidak boleh bernilai negatif.");
      }
    }
    
    // Menyisipkan instruksi yang sudah beradaptasi dengan form input
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
    throw error; // Ini akan melempar error validasi kita ke UI untuk ditampilkan ke user
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
        customInstruction: buildCustomInstruction(formInput) // Ikutkan konteks form
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
