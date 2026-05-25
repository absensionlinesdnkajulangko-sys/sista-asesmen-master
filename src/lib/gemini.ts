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
      
      const isGoogleBusy = response.status === 500 && 
        (errorMessage.includes("503") || 
         errorMessage.toLowerCase().includes("demand") || 
         errorMessage.toLowerCase().includes("unavailable"));

      if (isGoogleBusy && retries > 0) {
        console.warn(`[FIDHAL TOUNA AI] Server sibuk saat mengakses ${url}. Mencoba ulang dalam ${backoff}ms... (Sisa percobaan: ${retries})`);
        await delay(backoff);
        return fetchSecureWithRetry(url, options, retries - 1, backoff * 1.5);
      }
      
      throw new Error(errorMessage || `Gagal memproses data pada rute ${url} (Status: ${response.status})`);
    }
    
    return await response.json();
  } catch (error: any) {
    if (retries > 0 && error.message?.toLowerCase().includes("demand")) {
      await delay(backoff);
      return fetchSecureWithRetry(url, options, retries - 1, backoff * 1.5);
    }
    throw error;
  }
}

// PERBAIKAN CUSTOM INSTRUCTION: Menambahkan aturan distribusi proporsional jika ada lebih dari 1 materi
const CUSTOM_INSTRUCTION = `PENTING: Gunakan selalu kata 'murid' untuk merujuk pada anak didik. Jangan pernah menggunakan istilah 'peserta didik'.

STRICT RULE - BATASAN MATERI MUTLAK (MATERI POKOK VS CP):
1. Teks "Capaian Pembelajaran" (cp) HANYA berfungsi sebagai payung konteks kurikulum. DILARANG KERAS mengambil atau merancang soal dari topik yang ada di dalam teks CP JIKA topik tersebut tidak ditulis secara eksplisit di dalam "Materi Pokok" (material).
2. DISTRIBUSI MATERI POKOK: Perhatikan dengan saksama kolom input "Materi Pokok". Jika terdapat lebih dari 1 materi pokok, Anda WAJIB membagi jumlah soal secara proporsional untuk mencakup SELURUH materi tersebut. Jangan hanya fokus pada materi pertama!
3. HEADER MATERI POKOK: Dilarang keras memodifikasi, merangkum, atau menambahkan materi pokok lain ke dalam output data 'header'. Output 'material' pada header harus PERSIS sama dengan input pengguna.

STRICT RULE - ATURAN PEMBUATAN SOAL PILIHAN GANDA KOMPLEKS (PGK):
Khusus untuk soal tipe "Pilihan Ganda Kompleks", Anda WAJIB mengisi properti 'multiOptions' dengan minimal 4 atau 5 kalimat pernyataan mandiri (Contoh: ["Pernyataan A benar", "Pernyataan B salah", "Pernyataan C", "Pernyataan D"]). 
DILARANG KERAS membiarkan 'multiOptions' kosong ([]) jika tipe soal Pilihan Ganda Kompleks!

STRICT RULE - PEMILIHAN STIMULUS VISUAL OTOMATIS SECARA ACAK:
1. Berikan peluang 30%-40% bagi sebuah soal untuk memiliki stimulus visual (butuh gambar).
2. JIKA ADA GAMBAR: Tambahkan properti 'imagePrompt' berisi deskripsi visual yang sangat spesifik dalam BAHASA INGGRIS (contoh: "A clear mathematical diagram of a cube").
3. JIKA TANPA GAMBAR: Jangan tambahkan 'imagePrompt' atau isi dengan null/string kosong.

STRICT RULE - PEMBAHASAN DAN LOGIKA SKOR/RUBRIK WAJIB TERPISAH:
Setiap soal WAJIB memiliki properti 'score' dengan format berikut:

"PEMBAHASAN MATERI:\n[Penjelasan logis agar murid paham konteksnya]\n\nANALISIS SKOR:\nSkor Maksimal: [Angka_Skor]\n\nRubrik Penilaian:\n[Detail_Aturan_Penilaian]"

1. PG: Max 1. (Benar 1, Salah 0)
2. PGK: Max [Jumlah Opsi Benar]. (Proporsional 1 poin per jawaban benar)
3. BS: Max 1. (Tepat 1, Salah 0)
4. Menjodohkan: Max [Jumlah Pasangan]. (1 poin per pasangan benar)
5. Isian Singkat: Max 2. (Tepat 2, Mendekati 1, Salah 0)
6. Uraian: Max 4 atau 5. (Bobot dari 0 hingga Max berdasarkan kelengkapan argumen)`;

// 1. HANYA GENERATE SOAL UTAMA
export async function generateSoalOnly(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    console.log("Memulai pembuatan soal utama...");
    
    // 1. Ambil data material dari form dan pastikan berbentuk Array
    const materialArray = Array.isArray(data.material) ? data.material : [data.material];
    
    // 2. Bersihkan array dari kemungkinan input kosong
    const validMaterials = materialArray.filter((m: string) => m && m.trim() !== '');
    
    // 3. Gabungkan dengan kata "DAN" untuk AI (agar AI tahu itu hal yang terpisah), 
    //    dan gabungkan dengan koma untuk tabel frontend
    const materialForAI = validMaterials.join(' DAN ');
    const materialForHeader = validMaterials.join(', ');

    // 4. LOGIKA DINAMIS PROMPT INJECTION
    let materialInstruction = "";
    if (validMaterials.length > 1) {
      materialInstruction = `[FOKUS MUTLAK: PENGGUNA MEMASUKKAN ${validMaterials.length} MATERI POKOK BERBEDA YAITU: ${materialForAI}. ANDA WAJIB MEMBAGI JUMLAH SOAL SECARA PROPORSIONAL UNTUK MENGUJI KESEMUA MATERI TERSEBUT. JANGAN ADA MATERI YANG TERLEWAT!]`;
    } else {
      materialInstruction = `[FOKUS 100%: SELURUH SOAL YANG DIBUAT WAJIB, MUTLAK, DAN HANYA MEMBAHAS MATERI INI SAJA] -> ${materialForAI}`;
    }

    const payload = {
      ...data,
      cp: `[PERINGATAN MUTLAK: TEKS CAPAIAN PEMBELAJARAN DI BAWAH INI HANYA UNTUK REFERENSI TINGKAT KESULITAN/LEVEL KELAS. DILARANG KERAS MENGAMBIL TOPIK ATAU MEMBUAT SOAL DARI TEKS INI!] -> ${data.cp}`,
      material: materialInstruction,
      customInstruction: CUSTOM_INSTRUCTION
    };

    const dataSoal = await fetchSecureWithRetry('/api/generate/soal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      header: {
        ...dataSoal.header,
        material: materialForHeader // Kembalikan format ke koma agar rapi saat dicetak di tabel
      },
      questions: dataSoal.questions.map((q: any) => ({
        ...q,
        imagePrompt: q.imagePrompt || null,
        options: q.options || [],
        multiOptions: q.multiOptions || [] 
      })),
      kisiKisi: []
    };
  } catch (error: any) {
    console.error("Error Frontend Soal Utama:", error);
    throw error;
  }
}
// 2. GENERATE KUNCI JAWABAN & RUBRIK
export async function generateKunciOnly(header: any, questions: any[]): Promise<any[]> {
  try {
    const dataKunci = await fetchSecureWithRetry('/api/generate/kunci', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        header, 
        questions,
        customInstruction: CUSTOM_INSTRUCTION
      }),
    });
    
    return dataKunci.questions.map((q: any) => ({
      ...q,
      score: q.explanation || q.score || q.rubrik || "Belum ada pembahasan."
    }));
  } catch (error: any) {
    console.error("Error Frontend Kunci:", error);
    throw error;
  }
}

// 3. GENERATE KISI-KISI
export async function generateKisiOnly(formInput: SoalFormData, questions: any[]): Promise<any[]> {
  try {
    const dataKisi = await fetchSecureWithRetry('/api/generate/kisi-kisi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        formInput, 
        questions,
        customInstruction: CUSTOM_INSTRUCTION 
      }),
    });
    return dataKisi.kisiKisi;
  } catch (error: any) {
    if (error.message?.includes("503") || error.message?.toLowerCase().includes("demand")) {
      throw new Error("Server AI sedang padat saat merancang Kisi-kisi. Silakan klik ulang kembali tab Kisi-kisi.");
    }
    throw error;
  }
}
