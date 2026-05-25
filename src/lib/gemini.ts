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

// PERBAIKAN CUSTOM INSTRUCTION (BASE)
const CUSTOM_INSTRUCTION = `PENTING: Gunakan selalu kata 'murid' untuk merujuk pada anak didik. Jangan pernah menggunakan istilah 'peserta didik'.

STRICT RULE - BATASAN MATERI MUTLAK (MATERI POKOK VS CP):
1. Teks "Capaian Pembelajaran" (cp) HANYA berfungsi sebagai payung konteks kurikulum. DILARANG KERAS mengambil atau merancang soal dari topik yang ada di dalam teks CP JIKA topik tersebut tidak ditulis secara eksplisit di dalam "Materi Pokok" (material).
2. DISTRIBUSI MATERI POKOK: Perhatikan dengan saksama kolom input "Materi Pokok". Jika terdapat lebih dari 1 materi pokok, Anda WAJIB membagi jumlah soal secara proporsional untuk mencakup SELURUH materi tersebut. Jangan hanya fokus pada materi pertama!
3. HEADER MATERI POKOK: Dilarang keras memodifikasi, merangkum, atau menambahkan materi pokok lain ke dalam output data 'header'. Output 'material' pada header harus PERSIS sama dengan input pengguna.

STRICT RULE - ATURAN PEMBUATAN SOAL PILIHAN GANDA KOMPLEKS (PGK):
Khusus untuk soal tipe "Pilihan Ganda Kompleks", Anda WAJIB mengisi properti 'multiOptions' dengan minimal 3 atau 4 kalimat pernyataan mandiri (Contoh: ["Pernyataan A benar", "Pernyataan B salah", "Pernyataan C", "Pernyataan D"]). 
DILARANG KERAS membiarkan 'multiOptions' kosong ([]) jika tipe soal Pilihan Ganda Kompleks!

STRICT RULE - PEMILIHAN STIMULUS VISUAL OTOMATIS SECARA ACAK:
1. Berikan peluang 20%-30% bagi sebuah soal untuk memiliki stimulus visual (butuh gambar).
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
    
    // 1. Ambil data material dari form
    const materialArray = Array.isArray(data.material) ? data.material : [data.material];
    const validMaterials = materialArray.filter((m: string) => m && m.trim() !== '');
    
    const materialForAI = validMaterials.join(' DAN ');
    const materialForHeader = validMaterials.join(', ');

    // 2. TANGKAP LEVEL KOGNITIF DARI FORM (Jika kosong, default ke MOTS)
    const selectedLevel = data.cognitiveLevel || (data as any).levelKognitif || "MOTS";

    // 3. TAMBAHKAN ATURAN LEVEL KOGNITIF MUTLAK KE DALAM INSTRUKSI
    const strictCognitiveRule = `\n\nSTRICT RULE - LEVEL KOGNITIF MUTLAK:\nPengguna HANYA meminta level kognitif: ${selectedLevel}. SELURUH (100%) soal yang dibuat WAJIB berada di level ${selectedLevel}. DILARANG KERAS membuat soal dengan level di luar ${selectedLevel} (Jangan dicampur)!`;

    // 4. INJEKSI PROMPT SUPER KETAT PADA PAYLOAD
    const payload = {
      ...data,
      // Pastikan level kognitif ikut terkirim ke backend
      cognitiveLevel: selectedLevel, 
      
      // BAJAK SUBJECT: Kita tipu AI agar mengira nama mata pelajarannya adalah materi itu sendiri
      subject: `KONSENTRASI KHUSUS: ${materialForAI}`,
      
      // KOSONGKAN CP: Jangan biarkan AI membaca referensi luar
      cp: "KOSONG. DILARANG MEMBUAT SOAL BERDASARKAN PENGETAHUAN UMUM.",
      
      // KUNCI MATERI: Berikan peringatan ancaman spesifik
      material: `[WARNING MATERI MUTLAK: 100% SOAL WAJIB HANYA MEMBAHAS TENTANG [${materialForAI}]. DILARANG KERAS MEMBUAT SOAL TENTANG RUKUN ISLAM, SYAHADAT, ATAU TOPIK LAINNYA!]`,
      
      // Gabungkan instruksi dasar dengan ancaman level kognitif
      customInstruction: CUSTOM_INSTRUCTION + strictCognitiveRule 
    };

    const dataSoal = await fetchSecureWithRetry('/api/generate/soal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      header: {
        ...dataSoal.header,
        // KEMBALIKAN KE TEKS ASLI
        subject: data.subject, 
        material: materialForHeader 
      },
      questions: dataSoal.questions.map((q: any) => ({
        ...q,
        imagePrompt: q.imagePrompt || null,
        options: q.options || [],
        multiOptions: q.multiOptions || [],
        // Jaring Pengaman Akhir: Paksa output frontend sesuai pilihan jika AI masih sedikit meleset
        cognitiveLevel: q.cognitiveLevel || selectedLevel 
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
        customInstruction: CUSTOM_INSTRUCTION // Kunci jawaban tidak butuh pengulangan level kognitif
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
    const selectedLevel = formInput.cognitiveLevel || (formInput as any).levelKognitif || "MOTS";
    const strictCognitiveRule = `\n\nSTRICT RULE - LEVEL KOGNITIF:\nKisi-kisi WAJIB selaras dengan soal. Semua indikator soal harus mencerminkan level kognitif ${selectedLevel}.`;

    const dataKisi = await fetchSecureWithRetry('/api/generate/kisi-kisi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        formInput, 
        questions,
        customInstruction: CUSTOM_INSTRUCTION + strictCognitiveRule 
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
