import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Middleware for Gemini key check
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Helper untuk memformat materi array menjadi string list
const formatMaterialsHelper = (material: any) => {
  return Array.isArray(material) 
    ? material.filter((m: string) => m.trim() !== '').map((m: string, i: number) => `${i + 1}. ${m}`).join("\n      ")
    : material;
};

// ===================================================================
// 1. ENDPOINT: GENERATE LEMBAR SOAL UTAMA
// ===================================================================
app.post("/api/generate/soal", async (req, res) => {
  try {
    // PERBAIKAN: Mengekstrak customInstruction yang dikirim oleh frontend
    const { customInstruction, ...data } = req.body;
    const ai = getGeminiClient();
    
    const configs = data.questionConfigs.map((c: any) => 
      `${c.count} soal ${c.type} ${c.type === 'Pilihan Ganda' ? `dengan ${c.optionCount} pilihan jawaban` : ''}`
    ).join(", ");

    const formattedMaterials = formatMaterialsHelper(data.material);

    const prompt = `
      Bertindaklah sebagai Pakar Asesmen Kurikulum Merdeka dan Ahli Evaluasi Pendidikan Indonesia.
      Tugas Anda adalah memproduksi INSTRUMEN BUTIR SOAL SAJA berdasarkan data input berikut.
      
      PANDUAN ATURAN BAHASA UTAMA:
      ${customInstruction || "Gunakan istilah bahasa Indonesia yang baku."}

      DATA INPUT:
      - Satuan Pendidikan: ${data.schoolName}
      - Mapel: ${data.subject}
      - Materi Pokok / Utama: \n${formattedMaterials}
      - Capaian Pembelajaran (CP): ${data.cp}
      - Kelas/Semester: ${data.grade} / ${data.semester}
      - Tahun Ajaran: ${data.academicYear}
      - Konfigurasi Soal: ${configs}
      - Level Kognitif: ${data.cognitiveLevel.join(", ")}
      - Gunakan Stimulus Gambar: ${data.withImages ? 'YA (Hasilkan deskripsi visual)' : 'TIDAK'}
      
      INSTRUKSI KHUSUS LEMBAR SOAL:
      1. Distribusikan total konfigurasi soal secara otomatis, merata, dan proporsional ke SELURUH materi pokok yang diinputkan.
      2. Pilihan Ganda: WAJIB menyertakan property "options" sebagai array of strings tanpa abjad penanda (Jangan sertakan "A.", "B.", dll). Jumlah pilihan harus ${data.questionConfigs.find((c: any) => c.type === 'Pilihan Ganda')?.optionCount || 4}.
      3. Pilihan Ganda Kompleks: WAJIB memiliki beberapa opsi di "multiOptions". Bagian "isCorrect" di-set false atau true secara acak namun logis (akan divalidasi saat pembuat kunci).
      4. Gambar: JIKA stimulus membutuhkan gambar, sertakan property "imageUrl" dengan format "IMAGE_STIMULUS: [deskripsi detail gambar]".
      5. Pada rute ini, Anda hanya fokus membuat struktur pertanyaan, teks stimulus, dan opsi jawaban saja. Nilai "answerKey" dan "explanation" CUKUP DIISI STRING KOSONG "" atau "-" saja terlebih dahulu.

      STRUKTUR JSON OUTPUT WAJIB:
      {
        "header": {
          "schoolName": "${data.schoolName}",
          "subject": "${data.subject}",
          "classSemester": "${data.grade} / ${data.semester}",
          "material": "Gabungan atau ringkasan materi pokok yang diisi",
          "timeLimit": "${data.timeAllocation || '60 Menit'}"
        },
        "questions": [
          {
            "number": 1,
            "type": "Pilihan Ganda",
            "stimulus": "Teks bacaan stimulus jika ada",
            "text": "Kalimat pertanyaan soal",
            "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
            "multiOptions": [{"text": "Opsi A", "isCorrect": false}],
            "matchingPairs": [{"prompt": "Pernyataan A", "answer": ""}],
            "answerKey": "",
            "explanation": "",
            "cognitiveLevel": "MOTS",
            "imageUrl": ""
          }
        ]
      }
      Respond HANYA dengan JSON valid tanpa markdown pembuka/penutup.
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0.7 }
    });

    const text = response.text || "";
    const cleanText = text.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
    const rawData = JSON.parse(cleanText);

    // Normalisasi struktur output soal
    const parsedData = {
      header: {
        schoolName: rawData.header?.schoolName || data.schoolName,
        subject: rawData.header?.subject || data.subject,
        classSemester: rawData.header?.classSemester || `${data.grade} / ${data.semester}`,
        material: rawData.header?.material || "Materi Pokok",
        timeLimit: rawData.header?.timeLimit || data.timeAllocation || "60 Menit"
      },
      questions: (rawData.questions || []).map((q: any, idx: number) => ({
        number: q.number || (idx + 1),
        type: q.type || "Pilihan Ganda",
        stimulus: q.stimulus || "",
        text: q.text || "",
        options: (q.options || []).map((opt: string) => typeof opt === 'string' ? opt.replace(/^[A-E]\.\s*/i, '') : opt),
        multiOptions: q.multiOptions || [],
        matchingPairs: q.matchingPairs || [],
        answerKey: "",
        explanation: "",
        cognitiveLevel: q.cognitiveLevel || "MOTS",
        imageUrl: q.imageUrl || ""
      })),
      kisiKisi: [] // Kosong, diisi via endpoint terpisah
    };

    res.json(parsedData);
  } catch (error: any) {
    console.error("Error Soal:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ===================================================================
// 2. ENDPOINT: GENERATE KUNCI JAWABAN & BAHASAN
// ===================================================================
app.post("/api/generate/kunci", async (req, res) => {
  try {
    // PERBAIKAN: Mengekstrak customInstruction dari request frontend
    const { header, questions, customInstruction } = req.body; 
    const ai = getGeminiClient();

    const prompt = `
      Bertindaklah sebagai Pakar Evaluasi Pendidikan. Tugas Anda adalah menganalisis daftar instrumen soal di bawah ini dan merumuskan KUNCI JAWABAN yang valid beserta PEMBAHASAN/RUBRIK PENILAIAN yang mendalam untuk setiap butir soal.

      PANDUAN ATURAN BAHASA UTAMA:
      ${customInstruction || "Gunakan istilah bahasa Indonesia yang baku."}

      SOAL YANG HARUS DIBUATKAN KUNCI & BAHASAN:
      ${JSON.stringify(questions)}

      PETUNJUK PENGISIAN JAWABAN:
      - Pilihan Ganda: Berikan abjad jawaban yang benar saja (Contoh: "A" atau "B").
      - Pilihan Ganda Kompleks: Berikan array/list teks opsi mana saja yang bernilai benar.
      - Benar Salah: Tulis kunci jawaban berupa teks "BENAR" atau "SALAH".
      - Isian Singkat: Berikan kunci jawaban yang pendek, tepat, dan baku.
      - Uraian: Berikan poin jawaban ideal beserta kriteria rubrik skor nilai di dalam kolom deskripsi penjelasan.

      Kembalikan data dalam bentuk array of objects "questions" yang strukturnya sama persis, namun sekarang nilai properti "answerKey" dan "explanation" WAJIB TELAH TERISI LENGKAP DAN VALID.

      STRUKTUR OUTPUT JSON:
      {
        "questions": [
          {
            "number": 1,
            "answerKey": "Jawaban Benar",
            "explanation": "Alasan mendalam mengapa jawaban tersebut benar dan bagaimana rubrik poinnya."
          }
        ]
      }
      Respond HANYA dengan JSON valid.
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 }
    });

    const text = response.text || "";
    const cleanText = text.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
    const rawData = JSON.parse(cleanText);

    // Gabungkan kembali kunci jawaban dari AI ke dalam database pertanyaan frontend
    const updatedQuestions = questions.map((origQ: any) => {
      const aiKeyData = (rawData.questions || []).find((item: any) => item.number === origQ.number);
      return {
        ...origQ,
        answerKey: aiKeyData?.answerKey || "A",
        explanation: aiKeyData?.explanation || "Belum ada pembahasan."
      };
    });

    res.json({ questions: updatedQuestions });
  } catch (error: any) {
    console.error("Error Kunci:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ===================================================================
// 3. ENDPOINT: GENERATE KISI-KISI MATRIKS ASESMEN
// ===================================================================
app.post("/api/generate/kisi-kisi", async (req, res) => {
  try {
    // PERBAIKAN: Mengekstrak customInstruction dari request frontend
    const { formInput, questions, customInstruction } = req.body; 
    const ai = getGeminiClient();

    const formattedMaterials = formatMaterialsHelper(formInput.material);

    const prompt = `
      Bertindaklah sebagai Penyusun Kurikulum Merdeka. Tugas Anda adalah memetakan dan membuat matriks KISI-KISI SOAL yang selaras sempurna dengan materi pokok, Capaian Pembelajaran (CP), dan butir soal yang sudah ada.

      PANDUAN ATURAN BAHASA UTAMA:
      ${customInstruction || "Gunakan istilah bahasa Indonesia yang baku."}

      DATA RUJUKAN:
      - CP Utama: ${formInput.cp}
      - Daftar Materi Pokok: \n${formattedMaterials}
      - Daftar Butir Soal Terbentuk: ${JSON.stringify(questions.map((q: any) => ({ number: q.number, type: q.type, text: q.text, level: q.cognitiveLevel })))}

      TUGAS ANDA:
      1. Untuk setiap nomor soal di atas, buatkan baris kisi-kisi terperinci.
      2. Rumuskan "tp" (Tujuan Pembelajaran) yang logis, spesifik, dan operasional yang menjadi payung hukum dari materi soal tersebut.
      3. Tulis "indikatorSoal" dengan rumusan kalimat baku (Contoh: "Disajikan teks cerita, murid mampu menentukan..."). Indikator harus selaras dengan level kognitif soal asli.

      STRUKTUR OUTPUT JSON WAJIB:
      {
        "kisiKisi": [
          {
            "no": 1,
            "tp": "Rumusan Tujuan Pembelajaran buatan Anda",
            "indikatorSoal": "Kalimat indikator ketercapaian operasional butir soal",
            "levelKognitif": "LOTS/MOTS/HOTS sesuai level soal terkait",
            "bentukSoal": "Bentuk tipe soal terkait"
          }
        ]
      }
      Respond HANYA dengan JSON valid.
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 }
    });

    const text = response.text || "";
    const cleanText = text.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
    const rawData = JSON.parse(cleanText);

    res.json({ kisiKisi: rawData.kisiKisi || [] });
  } catch (error: any) {
    console.error("Error Kisi-Kisi:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ===================================================================

// Serve static files directly for production/Vercel environments
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
