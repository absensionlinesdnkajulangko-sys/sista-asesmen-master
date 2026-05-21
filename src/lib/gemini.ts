import { SoalFormData, GeneratedSoal } from "../types";

// Fungsi pembantu untuk memberikan jeda waktu (dalam milidetik)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi pembantu untuk fetch dengan retry otomatis khusus jika terkena error 503
async function fetchWithRetry(url: string, options: any, retries = 3, backoff = 2000): Promise<any> {
  try {
    const response = await fetch(url, options);
    
    // Jika server backend mengembalikan error status 500 karena Google Gemini 503
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || "";
      
      // Jika terdeteksi overload atau unavailable, lakukan retry
      if ((response.status === 500 || response.status === 503) && 
          (errorMessage.includes("503") || errorMessage.toLowerCase().includes("demand") || errorMessage.toLowerCase().includes("unavailable")) && 
          retries > 0) {
        console.warn(`Server sibuk saat memanggil ${url}. Mencoba ulang dalam ${backoff}ms... (Sisa percobaan: ${retries})`);
        await delay(backoff);
        return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
      }
      
      throw new Error(errorMessage || `Gagal memproses data pada rute ${url} (Status: ${response.status})`);
    }
    
    return await response.json();
  } catch (error: any) {
    if (retries > 0 && error.message?.toLowerCase().includes("demand")) {
      await delay(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
    }
    throw error;
  }
}

export async function generateSoal(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    // LANGKAH 1: Generate Struktur Soal Utama
    console.log("Memulai pembuatan soal...");
    const dataSoal = await fetchWithRetry('/api/generate/soal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    // Berikan jeda 1.5 detik agar server Google beristirahat sejenak sebelum rute berikutnya
    await delay(1500);

    // LANGKAH 2: Generate Kunci Jawaban & Bahasan
    console.log("Memulai pembuatan kunci jawaban...");
    const dataKunci = await fetchWithRetry('/api/generate/kunci', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        header: dataSoal.header,
        questions: dataSoal.questions
      }),
    });

    // Berikan jeda 1.5 detik lagi
    await delay(1500);

    // LANGKAH 3: Generate Matriks Kisi-Kisi Asesmen
    console.log("Memulai pembuatan kisi-kisi...");
    const dataKisi = await fetchWithRetry('/api/generate/kisi-kisi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formInput: data,
        questions: dataSoal.questions
      }),
    });

    // GABUNGKAN SEMUA HASIL MENJADI STRUKTUR DATA GENERATEDSOAL YANG UTUH
    return {
      header: dataSoal.header,
      questions: dataKunci.questions,
      kisiKisi: dataKisi.kisiKisi
    };

  } catch (error: any) {
    console.error("Client API Error:", error);
    // Berikan pesan yang lebih ramah pengguna di browser
    if (error.message?.includes("503") || error.message?.toLowerCase().includes("demand")) {
      throw new Error("Server AI Google sedang sangat padat. SISTA sudah mencoba mengirim ulang 3 kali namun tetap ditolak. Mohon tunggu 1 menit lalu klik tombol Generate kembali.");
    }
    throw error;
  }
}
