import { SoalFormData, GeneratedSoal } from "../types";

// Fungsi pembantu untuk fetch dengan handling error bersih
async function fetchSecure(url: string, options: any): Promise<any> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Gagal memproses data pada rute ${url} (Status: ${response.status})`);
  }
  return await response.json();
}

// HANYA GENERATE SOAL UTAMA
export async function generateSoalOnly(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    console.log("Memulai pembuatan soal utama saja...");
    const dataSoal = await fetchSecure('/api/generate/soal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    return {
      header: dataSoal.header,
      questions: dataSoal.questions,
      kisiKisi: [] // Kosong di awal
    };
  } catch (error) {
    console.error("Error Generate Soal Only:", error);
    throw error;
  }
}

// GENERATE KUNCI JAWABAN (Dipanggil saat tab Kunci diklik)
export async function generateKunciOnly(header: any, questions: any[]): Promise<any[]> {
  try {
    console.log("Memulai pembuatan kunci jawaban secara terpisah...");
    const dataKunci = await fetchSecure('/api/generate/kunci', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ header, questions }),
    });
    return dataKunci.questions;
  } catch (error: any) {
    if (error.message?.includes("503") || error.message?.toLowerCase().includes("demand")) {
      throw new Error("Server AI sedang sibuk memproses kunci jawaban. Silakan klik ulang tab Kunci beberapa saat lagi.");
    }
    throw error;
  }
}

// GENERATE KISI-KISI (Dipanggil saat tab Kisi-kisi diklik)
export async function generateKisiOnly(formInput: SoalFormData, questions: any[]): Promise<any[]> {
  try {
    console.log("Memulai pembuatan kisi-kisi secara terpisah...");
    const dataKisi = await fetchSecure('/api/generate/kisi-kisi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formInput, questions }),
    });
    return dataKisi.kisiKisi;
  } catch (error: any) {
    if (error.message?.includes("503") || error.message?.toLowerCase().includes("demand")) {
      throw new Error("Server AI sedang sibuk memproses kisi-kisi. Silakan klik ulang tab Kisi-kisi beberapa saat lagi.");
    }
    throw error;
  }
}
