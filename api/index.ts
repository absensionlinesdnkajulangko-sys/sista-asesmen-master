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

// API Routes
app.post("/api/generate", async (req, res) => {
  try {
    const data = req.body;
    const ai = getGeminiClient();
    
    const configs = data.questionConfigs.map((c: any) => 
      `${c.count} soal ${c.type} ${c.type === 'Pilihan Ganda' ? `dengan ${c.optionCount} pilihan jawaban` : ''} (Skor/soal: ${c.scorePerItem})`
    ).join(", ");

    // PERBAIKAN UTAMA: Mengubah struktur instruksi prompt agar AI membuat TP secara otomatis dan selaras
    const prompt = `
      Bertindaklah sebagai Pakar Asesmen Kurikulum Merdeka dan Ahli Evaluasi Pendidikan Indonesia. 
      Buatlah instrumen asesmen yang modern dengan standar literasi dan numerasi (AKM).
      
      DATA INPUT:
      - Satuan Pendidikan: ${data.schoolName}
      - Mapel: ${data.subject}
      - Materi Pokok / Utama: ${data.material || "AI Tentukan Otomatis"}
      - Capaian Pembelajaran (CP): ${data.cp}
      - Kelas/Semester: ${data.grade} / ${data.semester}
      - Tahun Ajaran: ${data.academicYear}
      - Konfigurasi Soal: ${configs}
      - Level Kognitif: ${data.cognitiveLevel.join(", ")}
      - Gunakan Stimulus Gambar: ${data.withImages ? 'YA (Hasilkan deskripsi visual)' : 'TIDAK'}
      
      TUGAS UTAMA ANDA (OTOMATISASI TUJUAN PEMBELAJARAN):
      1. Berdasarkan "Materi Pokok" dan "Capaian Pembelajaran (CP)" yang diinputkan di atas, Anda WAJIB merumuskan sendiri daftar Tujuan Pembelajaran (TP) yang logis, terukur, dan sesuai dengan esensi Kurikulum Merdeka.
      2. Distribusi & Keselarasan: Turunkan setiap nomor soal secara runtut dari TP tersebut. Untuk setiap butir soal di bagian "kisiKisi", pastikan teks properti "tp" terisi oleh TP bentukan Anda, dan "indikatorSoal" harus benar-benar selaras secara operasional (C1-C6) dengan TP tersebut.
      3. Materi Pokok: Jika input Materi Utama kosong, buatlah ringkasan materi pokok (2-4 kata) yang paling mewakili konteks CP. Masukkan ke dalam property "header.material".
      4. Stimulus & Soal: 
         - Pilihan Ganda: WAJIB menyertakan property "options" sebagai array of strings tanpa abjad penanda (Jangan sertakan "A.", "B.", dll). Jumlah pilihan harus ${data.questionConfigs.find((c: any) => c.type === 'Pilihan Ganda')?.optionCount || 4}.
         - Pilihan Ganda Kompleks: WAJIB memiliki minimal 2 jawaban yang benar di "multiOptions".
         - Isian Singkat: Jawaban eksak, singkat, padat.
         - Uraian: Jawaban terbuka berbobot dengan rubrik penilaian yang jelas di bagian eksplanasi.
         - Benar Salah: Pernyataan kritis terkait materi.
      5. Gambar: JIKA stimulus membutuhkan gambar, sertakan property "imageUrl" dengan format "IMAGE_STIMULUS: [deskripsi detail gambar untuk diconvert ke AI Image]".

      STRUKTUR JSON OUTPUT WAJIB SEPERTI INI (JANGAN DIUBAH KEY-NYA):
      {
        "header": {
          "schoolName": "${data.schoolName}",
          "subject": "${data.subject}",
          "classSemester": "${data.grade} / ${data.semester}",
          "material": "(Hasil ringkasan/konfirmasi materi pokok)",
          "timeLimit": "60 Menit"
        },
        "questions": [
          {
            "number": 1,
            "type": "Pilihan Ganda",
            "stimulus": "Teks bacaan stimulus jika ada",
            "text": "Kalimat pertanyaan soal",
            "options": ["Pilihan A tanpa huruf abjad", "Pilihan B tanpa huruf abjad", "Pilihan C tanpa huruf abjad", "Pilihan D tanpa huruf abjad"],
            "multiOptions": [{"text": "Pilihan Kompleks A"}],
            "matchingPairs": [{"prompt": "Pernyataan A"}],
            "answerKey": "A",
            "explanation": "Penjelasan jawaban",
            "cognitiveLevel": "MOTS"
          }
        ],
        "kisiKisi": [
          {
            "no": 1,
            "tp": "[Tuliskan rumusan Tujuan Pembelajaran yang Anda buat otomatis di sini, pastikan relevan dengan materi]",
            "indikatorSoal": "[Tuliskan Indikator Soal di sini yang diturunkan langsung dan selaras dengan TP di atas]",
            "levelKognitif": "MOTS",
            "bentukSoal": "Pilihan Ganda"
          }
        ]
      }

      PENTING: Respond HANYA dengan JSON valid. JANGAN ada teks pembuka/penutup.
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    
    const cleanText = text.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
    
    // ================= NORMALISASI DATA UNTUK FRONTEND =================
    const rawData = JSON.parse(cleanText);
    
    const parsedData: any = {
      header: {
        schoolName: rawData.header?.schoolName || data.schoolName,
        subject: rawData.header?.subject || data.subject,
        classSemester: rawData.header?.classSemester || `${data.grade} / ${data.semester}`,
        material: rawData.header?.material || rawData.material || data.material || "Materi Pokok",
        timeLimit: rawData.header?.timeLimit || "60 Menit"
      },
      questions: [],
      kisiKisi: []
    };

    // Mapping Questions / Soal secara adaptif
    const rawQuestions = rawData.questions || rawData.soal || [];
    if (Array.isArray(rawQuestions)) {
      parsedData.questions = rawQuestions.map((q: any, idx: number) => ({
        number: q.number || q.no || q.nomor || (idx + 1),
        type: q.type || q.jenis || q.bentukSoal || "Pilihan Ganda",
        stimulus: q.stimulus || q.bacaan || "",
        text: q.text || q.pertanyaan || q.soal || "",
        options: (q.options || q.pilihan || q.jawaban || []).map((opt: string) => 
          typeof opt === 'string' ? opt.replace(/^[A-E]\.\s*/i, '') : opt
        ),
        multiOptions: q.multiOptions || q.pilihanKompleks || [],
        matchingPairs: q.matchingPairs || q.jodohkan || [],
        answerKey: q.answerKey || q.kunci || q.kunciJawaban || "",
        explanation: q.explanation || q.pembahasan || q.bahasan || "",
        cognitiveLevel: q.cognitiveLevel || q.levelKognitif || q.level || "MOTS",
        imageUrl: q.imageUrl || ""
      }));
    }

    // Mapping Kisi-kisi secara adaptif
    const rawKisi = rawData.kisiKisi || rawData.kisi_kisi || rawData.matriks || [];
    if (Array.isArray(rawKisi)) {
      parsedData.kisiKisi = rawKisi.map((k: any, idx: number) => ({
        no: k.no || k.nomor || (idx + 1),
        tp: k.tp || k.tujuanPembelajaran || "Menerapkan konsep " + (parsedData.header.material),
        indikatorSoal: k.indikatorSoal || k.indikator || "",
        levelKognitif: k.levelKognitif || k.level || "MOTS",
        bentukSoal: k.bentukSoal || k.type || "Pilihan Ganda"
      }));
    }
    // ===================================================================
    
    res.json(parsedData);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Serve static files directly for production/Vercel environments
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;

// Only listen if running locally
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
