import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const currentDir = process.cwd();
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("SISTA Server Error: GEMINI_API_KEY belum terpasang di Vercel Environment Variables.");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

const formatMaterialsHelper = (material: any) => {
  return Array.isArray(material) 
    ? material.filter((m: string) => m.trim() !== '').map((m: string, i: number) => `${i + 1}. ${m}`).join("\n      ")
    : material;
};

// ===================================================================
// PERBAIKAN UTAMA: Helper untuk mensterilkan teks input agar tidak merusak JSON prompt
// ===================================================================
const sanitizePromptString = (text: any): string => {
  if (!text) return "";
  return String(text)
    .replace(/\\/g, "\\\\")   // Escape backslash
    .replace(/"/g, "'")       // Ubah kutip dua menjadi kutip tunggal agar aman di dalam properti JSON
    .replace(/\n/g, " ")      // Ubah baris baru menjadi spasi biasa
    .replace(/\r/g, "")
    .trim();
};

// HELPER: Parsing JSON yang aman dari pembungkus Markdown maupun Karakter Kontrol tak terlihat
const safeParseJSON = (responseText: string) => {
  let cleanText = responseText.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Menghapus karakter kontrol (ASCII 0-31) yang sering merusak struktur validasi JSON
    return JSON.parse(cleanText.replace(/[\u0000-\u001F]+/g, ""));
  }
};

// ===================================================================
// 1. ENDPOINT: GENERATE LEMBAR SOAL UTAMA
// ===================================================================
app.post("/api/generate/soal", async (req, res) => {
  try {
    const { customInstruction, ...data } = req.body;
    const ai = getGeminiClient();
    
    const configs = data.questionConfigs ? data.questionConfigs.map((c: any) => 
      `${c.count} soal ${c.type}`
    ).join(", ") : "beberapa soal";

    // Semua data dinamis disterilkan menggunakan fungsi sanitizePromptString
    const sSchoolName = sanitizePromptString(data.schoolName);
    const sSubject = sanitizePromptString(data.subject);
    const sGrade = sanitizePromptString(data.grade);
    const sSemester = sanitizePromptString(data.semester);
    const sCp = sanitizePromptString(data.cp);
    const sInstruction = sanitizePromptString(customInstruction);

    const prompt = `
      Bertindaklah sebagai Pakar Asesmen Kurikulum Merdeka tingkat Sekolah Dasar. 
      Tugas: Buat instrumen butir soal untuk mata pelajaran: ${sSubject || "Umum"}, Kelas ${sGrade || ""}.
      Capaian Pembelajaran (CP): ${sCp || ""}.
      Konfigurasi Soal: ${configs}
      Instruksi Tambahan khusus: ${sInstruction || ""}
      
      PENTING & WAJIB: 
      1. Jawab HANYA dengan JSON valid sesuai struktur di bawah. 
      2. PENTING: Jika di dalam teks soal, stimulus, atau pilihan ganda terdapat kata yang membutuhkan tanda kutip dua, Anda WAJIB mengubahnya menjadi kutip tunggal (') agar JSON tidak rusak.
      3. Pastikan semua tanda kurung kurawal pembuka dan penutup seimbang dan tidak terputus.
      4. Jika pertanyaan meminta atau membutuhkan gambar (mengandung instruksi seperti 'perhatikan gambar', 'amati gambar', 'pada gambar'), isi properti 'imagePrompt' dengan deskripsi bahasa Inggris yang mendetail untuk generator gambar. Jika tidak membutuhkan gambar, isi 'imagePrompt' dengan null.

      STRUKTUR JSON WAJIB:
      {
        "header": {
          "schoolName": "${sSchoolName}", 
          "subject": "${sSubject}", 
          "classSemester": "${sGrade} / ${sSemester}", 
          "material": "Ringkasan Materi Pokok terkait", 
          "timeLimit": "60 Menit"
        },
        "questions": [
          {
            "number": 1,
            "type": "Pilihan Ganda",
            "stimulus": "Isi jika ada bacaan pendukung, jika tidak kosongkan saja",
            "text": "Teks pertanyaan soal...",
            "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
            "multiOptions": [],
            "imagePrompt": null,
            "cognitiveLevel": "MOTS"
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 }
    });

    const rawData = safeParseJSON(response.text || "");

    const parsedData = {
      header: rawData.header || {},
      questions: (rawData.questions || []).map((q: any, idx: number) => {
        const isPGK = q.type?.toLowerCase().includes("kompleks");
        const finalMultiOptions = isPGK && (!q.multiOptions || q.multiOptions.length === 0) 
          ? (q.options || []) 
          : (q.multiOptions || []);

        return {
          number: q.number || (idx + 1),
          type: q.type || "Pilihan Ganda",
          stimulus: q.stimulus || "",
          text: q.text || "",
          imagePrompt: q.imagePrompt || null,
          options: isPGK ? [] : (q.options || []),
          multiOptions: finalMultiOptions,
          matchingPairs: q.matchingPairs || [],
          answerKey: q.answerKey || "",
          explanation: q.explanation || "",
          cognitiveLevel: q.cognitiveLevel || "MOTS"
        };
      }),
      kisiKisi: []
    };

    res.json(parsedData);
  } catch (error: any) {
    console.error("[SOAL ERROR]:", error);
    
    if (error.message?.includes("quota") || error.message?.includes("429") || error.status === "RESOURCE_EXHAUSTED") {
      return res.status(429).json({ 
        error: "Kuota harian Google Gemini API telah habis. Silakan ganti API Key di Vercel Environment Variables atau coba lagi besok." 
      });
    }
    res.status(500).json({ error: "Gagal memproses soal: " + error.message });
  }
});

// ===================================================================
// 2. ENDPOINT: GENERATE KUNCI JAWABAN & BAHASAN
// ===================================================================
app.post("/api/generate/kunci", async (req, res) => {
  try {
    const { questions, customInstruction } = req.body; 
    const ai = getGeminiClient();
    const sInstruction = sanitizePromptString(customInstruction);

    const prompt = `
      Bertindaklah sebagai Pakar Evaluasi Pendidikan. Tugas Anda adalah menganalisis daftar instrumen soal di bawah ini dan merumuskan KUNCI JAWABAN yang valid beserta PEMBAHASAN/RUBRIK PENILAIAN yang mendalam untuk setiap butir soal.

      PANDUAN ATURAN BAHASA UTAMA:
      ${sInstruction || "Gunakan istilah bahasa Indonesia yang baku."}

      SOAL YANG HARUS DIBUATKAN KUNCI & BAHASAN:
      ${JSON.stringify(questions)}

      PETUNJUK PENGISIAN JAWABAN:
      - Pilihan Ganda: Berikan abjad jawaban yang benar saja (Contoh: "A" atau "B").
      - Pilihan Ganda Kompleks: Berikan array/list teks opsi mana saja yang bernilai benar.
      - Benar Salah: Tulis kunci jawaban berupa teks "BENAR" atau "SALAH".
      - Isian Singkat: Berikan kunci jawaban yang pendek, tepat, dan baku.
      - Uraian: Berikan poin jawaban ideal beserta kriteria rubrik skor nilai di dalam kolom deskripsi penjelasan.

      STRUKTUR OUTPUT JSON:
      {
        "questions": [
          {
            "number": 1,
            "answerKey": "Jawaban Benar",
            "explanation": "Alasan mendalam mengapa jawaban tersebut benar."
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 }
    });

    const rawData = safeParseJSON(response.text || "");

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
    console.error("[KUNCI ERROR]:", error);

    if (error.message?.includes("quota") || error.message?.includes("429") || error.status === "RESOURCE_EXHAUSTED") {
      return res.status(429).json({ 
        error: "Gagal memproses kunci jawaban: Kuota API Gemini Anda sudah habis." 
      });
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ===================================================================
// 3. ENDPOINT: GENERATE KISI-KISI MATRIKS ASESMEN
// ===================================================================
app.post("/api/generate/kisi-kisi", async (req, res) => {
  try {
    const { formInput, questions, customInstruction } = req.body; 
    const ai = getGeminiClient();

    const formattedMaterials = formatMaterialsHelper(formInput?.material);
    const sInstruction = sanitizePromptString(customInstruction);
    const sCp = sanitizePromptString(formInput?.cp);

    const prompt = `
      Bertindaklah sebagai Penyusun Kurikulum Merdeka. Tugas Anda adalah memetakan dan membuat matriks KISI-KISI SOAL yang selaras sempurna dengan materi pokok, Capaian Pembelajaran (CP), dan butir soal yang sudah ada.

      PANDUAN ATURAN BAHASA UTAMA:
      ${sInstruction || "Gunakan istilah bahasa Indonesia yang baku."}

      DATA RUJUKAN:
      - CP Utama: ${sCp || ""}
      - Daftar Materi Pokok: \n${formattedMaterials}
      - Daftar Butir Soal Terbentuk: ${JSON.stringify(questions ? questions.map((q: any) => ({ number: q.number, type: q.type, text: q.text, level: q.cognitiveLevel })) : [])}

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
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", maxOutputTokens: 8192 }
    });

    const rawData = safeParseJSON(response.text || "");

    res.json({ kisiKisi: rawData.kisiKisi || [] });
  } catch (error: any) {
    console.error("[KISI-KISI ERROR]:", error);

    if (error.message?.includes("quota") || error.message?.includes("429") || error.status === "RESOURCE_EXHAUSTED") {
      return res.status(429).json({ 
        error: "Gagal memproses kisi-kisi: Kuota API Gemini Anda sudah habis." 
      });
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ===================================================================

const distPath = path.join(currentDir, "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));

export default app;

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
