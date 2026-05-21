import { SoalFormData, GeneratedSoal } from "../types";

export async function generateSoal(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    // LANGKAH 1: Generate Struktur Soal Utama
    const resSoal = await fetch('/api/generate/soal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!resSoal.ok) {
      const errorData = await resSoal.json().catch(() => ({}));
      throw new Error(errorData.error || `Gagal membuat lembar soal utama (Status: ${resSoal.status})`);
    }
    const dataSoal = await resSoal.json();

    // LANGKAH 2: Generate Kunci Jawaban & Bahasan (Berdasarkan soal dari langkah 1)
    const resKunci = await fetch('/api/generate/kunci', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        header: dataSoal.header,
        questions: dataSoal.questions
      }),
    });

    if (!resKunci.ok) {
      const errorData = await resKunci.json().catch(() => ({}));
      throw new Error(errorData.error || `Gagal merumuskan kunci jawaban (Status: ${resKunci.status})`);
    }
    const dataKunci = await resKunci.json();

    // LANGKAH 3: Generate Matriks Kisi-Kisi Asesmen
    const resKisi = await fetch('/api/generate/kisi-kisi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        formInput: data,
        questions: dataSoal.questions
      }),
    });

    if (!resKisi.ok) {
      const errorData = await resKisi.json().catch(() => ({}));
      throw new Error(errorData.error || `Gagal menyusun matriks kisi-kisi (Status: ${resKisi.status})`);
    }
    const dataKisi = await resKisi.json();

    // GABUNGKAN SEMUA HASIL MENJADI STRUKTUR DATA GENERATEDSOAL YANG UTUH
    return {
      header: dataSoal.header,
      questions: dataKunci.questions, // Menggunakan pertanyaan yang sudah dilengkapi kunci & bahasan
      kisiKisi: dataKisi.kisiKisi
    };

  } catch (error) {
    console.error("Client API Error:", error);
    throw error;
  }
}
