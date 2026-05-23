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
  return new GoogleGenAI({ apiKey: apiKey });
};

const formatMaterialsHelper = (material: any) => {
  return Array.isArray(material) 
    ? material.filter((m: string) => m.trim() !== '').map((m: string, i: number) => `${i + 1}. ${m}`).join("\n      ")
    : material;
};

// ===================================================================
// 1. ENDPOINT: GENERATE SOAL (DIPERBAIKI)
// ===================================================================
app.post("/api/generate/soal", async (req, res) => {
  try {
    const { customInstruction, ...data } = req.body;
    const ai = getGeminiClient();
    
    const configs = (data.questionConfigs || []).map((c: any) => `${c.count} soal ${c.type}`).join(", ");
    const formattedMaterials = formatMaterialsHelper(data.material);

    const prompt = `
      Bertindaklah sebagai Pakar Asesmen Kurikulum Merdeka. 
      ${customInstruction || ""}
      
      DATA INPUT:
      - Mapel: ${data.subject}, Materi: ${formattedMaterials}, Total Soal: ${data.questionConfigs?.reduce((acc: number, c: any) => acc + c.count, 0) || 0}
      - WAJIB buat ${data.imageCount || 0} soal dengan gambar.

      INSTRUKSI GAMBAR:
      - Jika soal terpilih untuk bergambar, isi "imagePrompt" dengan deskripsi visual (Bahasa Inggris).
      - Jika soal tidak terpilih, isi "imagePrompt" dengan string kosong "".
      - JANGAN campurkan deskripsi gambar ke properti "text" atau "stimulus".

      STRUKTUR JSON OUTPUT WAJIB:
      {
        "header": { "schoolName": "${data.schoolName}", "subject": "${data.subject}", "classSemester": "${data.grade} / ${data.semester}", "material": "...", "timeLimit": "${data.timeAllocation || '60 Menit'}" },
        "questions": [{ "number": 1, "type": "...", "text": "Pertanyaan saja (TANPA deskripsi gambar)", "stimulus": "...", "options": [], "imagePrompt": "Deskripsi gambar atau string kosong", "score": "" }]
      }
      Respond HANYA dengan JSON valid.
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const rawData = JSON.parse(response.text || "{}");
    res.json({
      header: rawData.header,
      questions: (rawData.questions || []).map((q: any, idx: number) => ({
        ...q,
        number: q.number || (idx + 1),
        imagePrompt: (q.imagePrompt && !q.imagePrompt.includes("[Isi dengan")) ? q.imagePrompt : ""
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// 2. ENDPOINT: GENERATE KUNCI JAWABAN (DIPERBAIKI)
// ===================================================================
app.post("/api/generate/kunci", async (req, res) => {
  try {
    const { questions, customInstruction } = req.body; 
    const ai = getGeminiClient();

    const prompt = `
      Anda adalah Pakar Evaluasi Pendidikan. Berikan Kunci Jawaban dan Rubrik Penilaian yang mendalam untuk setiap soal berikut:
      ${JSON.stringify(questions)}
      
      ${customInstruction || ""}

      STRUKTUR OUTPUT JSON WAJIB:
      {
        "questions": [{ "number": 1, "answerKey": "...", "score": "Pembahasan dan analisis rubrik penilaian..." }]
      }
      Respond HANYA dengan JSON valid.
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const rawData = JSON.parse(response.text || "{}");
    res.json({ questions: rawData.questions || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
// 3. ENDPOINT: GENERATE KISI-KISI
// ===================================================================
app.post("/api/generate/kisi-kisi", async (req, res) => {
  try {
    const { formInput, questions, customInstruction } = req.body; 
    const ai = getGeminiClient();
    const formattedMaterials = formatMaterialsHelper(formInput.material);

    const prompt = `
      Buatkan matriks KISI-KISI SOAL untuk data berikut:
      CP: ${formInput.cp}
      Materi: ${formattedMaterials}
      Soal: ${JSON.stringify(questions)}
      ${customInstruction || ""}

      STRUKTUR OUTPUT JSON WAJIB:
      { "kisiKisi": [{ "no": 1, "tp": "...", "indikatorSoal": "...", "levelKognitif": "...", "bentukSoal": "..." }] }
      Respond HANYA dengan JSON valid.
    `;

    const response = await ai.models.generateContent({ 
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const rawData = JSON.parse(response.text || "{}");
    res.json({ kisiKisi: rawData.kisiKisi || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===================================================================
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));

export default app;
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}
