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

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
};

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
    const { customInstruction, ...data } = req.body;
    const ai = getGeminiClient();
    
    const configs = data.questionConfigs.map((c: any) => 
      `${c.count} soal ${c.type}`
    ).join(", ");

    const prompt = `
      Bertindaklah sebagai Pakar Asesmen Kurikulum Merdeka. 
      Tugas: Buat instrumen butir soal untuk: ${data.subject}, Kelas ${data.grade}.
      CP: ${data.cp}.
      ${customInstruction}
      
      PENTING: Jawab HANYA dengan JSON valid. Pastikan semua string tertutup dengan benar.
      Jika butuh gambar, isi 'imagePrompt' dengan deskripsi bahasa Inggris. Jika tidak, isi null.

      STRUKTUR JSON:
      {
        "header": {"schoolName": "${data.schoolName}", "subject": "${data.subject}", "classSemester": "${data.grade} / ${data.semester}", "material": "Ringkasan Materi", "timeLimit": "60 Menit"},
        "questions": [{"number": 1, "type": "Pilihan Ganda", "stimulus": "", "text": "...", "options": ["A", "B", "C", "D"], "imagePrompt": null, "cognitiveLevel": "MOTS"}]
      }
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.0-flash", // Disarankan gunakan versi stabil terbaru
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 }
    });

    const cleanText = (response.text || "").replace(/```json\s*/g, '').replace(/```/g, '').trim();
    
    let rawData;
    try {
      rawData = JSON.parse(cleanText);
    } catch (e) {
      // Fallback jika JSON rusak: coba bersihkan karakter kontrol
      rawData = JSON.parse(cleanText.replace(/[\u0000-\u001F]+/g, ""));
    }

    const parsedData = {
      header: rawData.header || {},
      questions: (rawData.questions || []).map((q: any, idx: number) => ({
        number: q.number || (idx + 1),
        type: q.type || "Pilihan Ganda",
        stimulus: q.stimulus || "",
        text: q.text || "",
        imagePrompt: q.imagePrompt || null, // Pastikan dikirim ke frontend
        options: q.options || [],
        multiOptions: q.multiOptions || [],
        matchingPairs: q.matchingPairs || [],
        answerKey: "",
        explanation: "",
        cognitiveLevel: q.cognitiveLevel || "MOTS"
      })),
      kisiKisi: []
    };

    res.json(parsedData);
  } catch (error: any) {
    res.status(500).json({ error: "Gagal memproses soal: " + error.message });
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
app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));

export default app;

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
