import { Download, ChevronLeft, FileText, DownloadCloud, ClipboardCheck, Key, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { GeneratedSoal, SoalFormData } from '../types';
import { NavItem } from './Sidebar';
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateKunciOnly, generateKisiOnly } from '../lib/gemini';

interface ModulTableProps {
  data: GeneratedSoal;
  formInput: SoalFormData;
  onBack: () => void;
  mode: NavItem;
}

export default function ModulTable({ data, formInput, onBack, mode }: ModulTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<'soal' | 'kunci' | 'kisi'>('soal');
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<number, boolean>>({});
  
  const [localQuestions, setLocalQuestions] = useState(data?.questions || []);
  const [localKisiKisi, setLocalKisiKisi] = useState(data?.kisiKisi || []);
  const [isTabLoading, setIsTabLoading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleTabChange = async (tab: 'soal' | 'kunci' | 'kisi') => {
    setActiveTab(tab);

    if (tab === 'kunci') {
      const belumAdaKunci = localQuestions.every(q => q.answerKey === "" || q.answerKey === "-");
      if (belumAdaKunci) {
        setIsTabLoading(true);
        try {
          const updatedQuestions = await generateKunciOnly(data.header, localQuestions);
          setLocalQuestions(updatedQuestions);
        } catch (error: any) {
          alert(error.message || "Gagal memuat kunci jawaban.");
        } finally {
          setIsTabLoading(false);
        }
      }
    }

    if (tab === 'kisi') {
      if (localKisiKisi.length === 0) {
        setIsTabLoading(true);
        try {
          const generatedKisi = await generateKisiOnly(formInput, localQuestions);
          setLocalKisiKisi(generatedKisi);
        } catch (error: any) {
          alert(error.message || "Gagal memuat matriks kisi-kisi.");
        } finally {
          setIsTabLoading(false);
        }
      }
    }
  };

  const generateImage = async (questionNumber: number, questionObject: any) => {
    setIsGeneratingImage(prev => ({ ...prev, [questionNumber]: true }));
    try {
      let basePrompt = questionObject.imagePrompt || questionObject.stimulus || questionObject.text;
      
      basePrompt = basePrompt
        .replace(/Murid melihat/gi, '')
        .replace(/Bapak\/Ibu Guru menunjukkan/gi, '')
        .replace(/Perhatikan gambar/gi, '')
        .replace(/di bawah ini/gi, '')
        .replace(/dengan teliti/gi, '');

      const fullPrompt = `${basePrompt.trim()}, clip art style for elementary school textbook, vibrant colors, clear object, isolated on a solid white background, no text, no characters, 2d vector`;
      const encodedPrompt = encodeURIComponent(fullPrompt);
      
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=450&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
      
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      setGeneratedImages(prev => ({ ...prev, [questionNumber]: imageUrl }));
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [questionNumber]: false }));
    }
  };
  
  const handleRemoveImage = (questionNumber: number) => {
    setGeneratedImages(prev => {
      const updated = { ...prev };
      delete updated[questionNumber];
      return updated;
    });
  };

  const getHeaderText = () => {
    switch(activeTab) {
      case 'soal': return 'LEMBAR ASESMEN KURIKULUM MERDEKA';
      case 'kunci': return 'LEMBAR KUNCI JAWABAN DAN RUBRIK PENILAIAN';
      case 'kisi': return 'LEMBAR KISI-KISI SOAL';
      default: return 'LEMBAR ASESMEN KURIKULUM MERDEKA';
    }
  };

  const getMaterialString = () => {
    if (data?.header?.material && typeof data.header.material === 'string') {
      return data.header.material;
    }
    if (Array.isArray(formInput.material)) {
      return formInput.material.filter(m => m.trim() !== '').join(', ') || "Materi Pokok";
    }
    return formInput.material || "Materi Pokok";
  };
  
  const currentMaterial = getMaterialString();

  const formatAnswerKey = (answerKey: any) => {
    if (!answerKey) return '-';
    if (Array.isArray(answerKey)) return answerKey.join(', ');
    if (typeof answerKey === 'object' && answerKey !== null) {
      return Object.entries(answerKey).map(([key, val]) => `${key}: ${val}`).join(', ');
    }
    return String(answerKey);
  };

  const downloadWord = () => {
    if (!containerRef.current) return;
    
    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export Doc</title><style>@page { margin: 1in; size: portrait; } body { font-family: 'Times New Roman', serif; margin: 0; line-height: 1.5; font-size: 11pt; color: black; } table { width: 100%; border-collapse: collapse; margin-bottom: 15pt; } .centered { text-align: center; } .font-bold { font-weight: bold; } .uppercase { text-transform: uppercase; } .identity-table { border: 1pt solid black; } .identity-table td { border: 1pt solid black; padding: 6pt; font-size: 10pt; vertical-align: top; } .question-table { margin-bottom: 10pt; } .question-table td { vertical-align: top; padding: 3pt; border: none; } .q-num { width: 30pt; } .q-text { text-align: justify; } .options-table { margin-left: 30pt; } .options-table td { padding: 2pt; border: none; } .spreadsheet-table { border: 1pt solid black; } .spreadsheet-table th, .spreadsheet-table td { border: 1pt solid black; padding: 5pt; font-size: 10pt; } .stimulus-box { border: 1pt solid #ccc; padding: 10pt; margin-bottom: 10pt; font-style: italic; background-color: #f9f9f9; } .signature-table { margin-top: 30pt; } .signature-table td { width: 50%; vertical-align: top; border: none; } .no-print { display: none !important; }</style></head><body>`;
    const postHtml = "</body></html>";
    
    let contentHtml = '<div style="width: 100%;">';
    contentHtml += `<div class="centered"><h2 class="uppercase font-bold" style="margin-bottom: 5pt;">LEMBAR ASESMEN KURIKULUM MERDEKA</h2><p class="font-bold" style="margin-top: 0;">TAHUN AJARAN ${formInput.academicYear}</p></div><div style="border-bottom: 2pt double black; height: 1pt; margin-bottom: 15pt; width: 100%;"></div>`;
    contentHtml += `<table class="identity-table"><tr><td width="50%"><b>SATUAN PENDIDIKAN</b>: ${formInput.schoolName}<br><b>MATA PELAJARAN</b>: ${formInput.subject}<br><b>KELAS / SEMESTER</b>: ${formInput.grade} / ${formInput.semester}<br><b>MATERI POKOK</b>: ${currentMaterial}</td><td><b>NAMA GURU</b>: ${formInput.teacherName}<br><b>NIP GURU</b>: ${formInput.teacherNip}<br><b>JABATAN</b>: ${formInput.position}<br><b>ALOKASI WAKTU</b>: ${formInput.timeAllocation || data?.header?.timeLimit || '60 Menit'}</td></tr></table>`;

    if (activeTab === 'soal') {
      contentHtml += `<p style="font-style: italic; border-bottom: 1px solid #ccc; padding-bottom: 5pt; margin-bottom: 15pt;">Petunjuk: Kerjakanlah soal-soal di bawah ini dengan jujur dan teliti!</p>`;
      for (const q of localQuestions) {
        contentHtml += `<div class="question-item">`;
        if (q.stimulus) contentHtml += `<div class="stimulus-box"><b>STIMULUS BACAAN:</b><br>${q.stimulus}</div>`;
        const imgUrl = generatedImages[q.number];
        if (imgUrl) contentHtml += `<div style="text-align: center; margin-bottom: 10pt;"><img src="${imgUrl}" width="350" /></div>`;
        contentHtml += `<table class="question-table"><tr><td class="q-num"><b>${q.number}.</b></td><td class="q-text">${q.text}</td></tr></table>`;

        if (q.type === 'Pilihan Ganda' && q.options) {
          contentHtml += `<table class="options-table">`;
          q.options.forEach((opt, i) => { contentHtml += `<tr><td width="20"><b>${String.fromCharCode(65 + i)}.</b></td><td>${opt}</td></tr>`; });
          contentHtml += `</table>`;
        } else if (q.type === 'Pilihan Ganda Kompleks' && q.multiOptions) {
          contentHtml += `<table class="options-table">`;
          q.multiOptions.forEach((opt) => { contentHtml += `<tr><td width="20">[ ]</td><td>${opt.text}</td></tr>`; });
          contentHtml += `</table>`;
        } else if (q.type === 'Benar Salah') {
          contentHtml += `<div style="margin-left: 30pt;"> ( ) BENAR &nbsp;&nbsp;&nbsp; ( ) SALAH </div>`;
        } else if (q.type === 'Isian Singkat') {
          contentHtml += `<div style="margin-left: 30pt; margin-top: 5pt; border-bottom: 1px dotted #000; height: 15pt; width: 80%;"></div>`;
        } else if (q.type === 'Uraian') {
          contentHtml += `<div style="margin-left: 30pt; margin-top: 5pt; border-bottom: 1px dotted #000; height: 15pt; width: 90%;"></div><div style="margin-left: 30pt; margin-top: 5pt; border-bottom: 1px dotted #000; height: 15pt; width: 90%;"></div>`;
        } else if (q.type === 'Menjodohkan' && q.matchingPairs) {
          contentHtml += `<table class="spreadsheet-table" style="margin-left: 30pt; width: 90%;"><tr><th width="50%">Pernyataan A</th><th width="50%">Pernyataan B (Jawaban)</th></tr>${q.matchingPairs.map(p => `<tr><td height="30">${p.prompt}</td><td></td></tr>`).join('')}</table>`;
        }
        contentHtml += `</div><br>`;
      }
    } else if (activeTab === 'kunci') {
      contentHtml += `<table class="spreadsheet-table"><tr><th width="40">No</th><th>Kunci Jawaban & Rubrik Penilaian</th></tr>${localQuestions.map(q => `<tr><td class="centered">${q.number}</td><td><b>KUNCI JAWABAN: ${formatAnswerKey(q.answerKey)}</b><br><br><b>RUBRIK PENILAIAN:</b><br><i>${(q as any).score || (q as any).rubrik || 'Skor 1 jika benar, 0 jika salah.'}</i><br><br><small>Level Kognitif: ${q.cognitiveLevel || 'MOTS'}</small></td></tr>`).join('')}</table>`;
    } else if (activeTab === 'kisi') {
      contentHtml += `<table class="spreadsheet-table"><tr><th>No</th><th>Capaian & Tujuan Pembelajaran</th><th>Indikator</th><th>Level</th><th>Bentuk</th></tr>${localKisiKisi.map(k => `<tr><td class="centered">${k.no}</td><td><b>CP:</b> ${formInput.cp}<br><b>TP:</b> ${k.tp || '-'}</td><td>${k.indikatorSoal}</td><td class="centered">${k.levelKognitif}</td><td class="centered">${k.bentukSoal}</td></tr>`).join('')}</table>`;
    }

    if (activeTab !== 'soal') {
      contentHtml += `<table class="signature-table"><tr><td>Mengetahui,<br>Kepala Sekolah<br><br><br><br><b><u>${formInput.principalName}</u></b><br>NIP. ${formInput.principalNip}</td><td>${formInput.regionName}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>${formInput.position}<br><br><br><br><b><u>${formInput.teacherName}</u></b><br>NIP. ${formInput.teacherNip}</td></tr></table>`;
    }

    contentHtml += '</div>';
    const blob = new Blob(['\ufeff', preHtml + contentHtml + postHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formInput.subject || 'Asesmen'}_${activeTab}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const NavButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: React.ComponentType<{className?: string}>, label: string }) => (
    <button
      onClick={() => handleTabChange(id)}
      className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all",
        activeTab === id 
          ? "bg-citrus-600 text-white shadow-lg shadow-citrus-600/20" 
          : "bg-white text-citrus-700 hover:bg-citrus-50 border border-citrus-100"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      {/* PERBAIKAN CSS PRINT:
        - Menggunakan border hanya pada kotak utama
        - Tabel di dalam tabel (.inner-table) TIDAK diberikan border agar bersih
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print { 
          .no-print, button, header, nav, aside, footer, .sticky { display: none !important; } 
          body, main, #root { background: white !important; padding: 0 !important; margin: 0 !important; width: 100% !important; } 
          .print-container { border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; } 
          table, .spreadsheet-table { width: 100% !important; border-collapse: collapse !important; } 
          .spreadsheet-table th, .spreadsheet-table td { border: 1px solid #000000 !important; padding: 6px !important; font-size: 10pt !important; } 
          .print-only-header { display: block !important; } 
          .screen-only-header { display: none !important; } 
          
          /* KOTAK IDENTITAS LUAR */
          .print-identity-table { display: table !important; width: 100% !important; border: 1px solid #000 !important; border-collapse: collapse !important; font-size: 10pt !important; } 
          .print-identity-table > tbody > tr > td { border: 1px solid #000 !important; padding: 6px !important; width: 50% !important; vertical-align: top !important; } 
          
          /* TABEL DI DALAM TABEL (Merapikan Titik Dua) */
          .inner-table { width: 100% !important; border: none !important; margin: 0 !important; }
          .inner-table tr td { border: none !important; padding: 2px 4px 2px 0 !important; vertical-align: top !important; }
          
          .screen-identity-grid { display: none !important; } 
        } 
        .print-only-header, .print-identity-table { display: none; }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print bg-white/80 backdrop-blur-md p-4 rounded-[1.5rem] border border-citrus-100 sticky top-4 z-40 shadow-xl shadow-citrus-900/5">
        <button onClick={onBack} className="flex items-center gap-2 text-citrus-700 font-bold hover:text-citrus-900 transition-colors px-4 py-2">
          <ChevronLeft className="w-5 h-5" /> Edit Data
        </button>

        <div className="flex items-center gap-2">
          <NavButton id="soal" icon={FileText} label="Evaluasi" />
          <NavButton id="kunci" icon={Key} label="Kunci & Rubrik" />
          <NavButton id="kisi" icon={ClipboardCheck} label="Kisi-kisi" />
        </div>

        <div className="relative">
          <button disabled={isTabLoading} onClick={() => setShowExportOptions(!showExportOptions)} className="gradient-citrus text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">
            <Download className="w-5 h-5" /> Unduh
          </button>
          
          <AnimatePresence>
            {showExportOptions && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-citrus-100 overflow-hidden z-50">
                <button onClick={downloadWord} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-citrus-50 text-citrus-900 transition-colors border-b border-citrus-50">
                  <FileText className="w-5 h-5 text-blue-500" /> Format Word (.doc)
                </button>
                <button onClick={handlePrint} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-citrus-50 text-citrus-900 transition-colors">
                  <Printer className="w-5 h-5 text-citrus-600" /> Cetak Langsung
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div ref={containerRef} className="print-container bg-white p-8 md:p-12 shadow-2xl border border-slate-200 min-h-[1000px] relative">
        {isTabLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-citrus-200 border-t-citrus-600 rounded-full animate-spin" />
            <p className="font-bold text-citrus-900 animate-pulse text-sm">FIDHAL TOUNA AI sedang merumuskan halaman ini...</p>
          </div>
        )}

        <div className="text-center border-b-4 border-double border-black pb-4 mb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide screen-only-header">{getHeaderText()}</h1>
          <h1 className="text-2xl font-bold uppercase tracking-wide print-only-header">LEMBAR ASESMEN KURIKULUM MERDEKA</h1>
          <p className="text-sm font-medium mt-1">TAHUN AJARAN {formInput.academicYear}</p>
        </div>

        {/* 1. Tampilan Monitor: Menggunakan Tabel Dalam Tabel agar LURUS SEMPURNA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 mb-8 text-[10px] md:text-xs border border-black p-4 screen-identity-grid">
          <table className="w-full text-left border-none">
            <tbody>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[140px] py-0.5">Satuan Pendidikan</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{formInput.schoolName}</td></tr>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[140px] py-0.5">Mata Pelajaran</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{formInput.subject}</td></tr>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[140px] py-0.5">Kelas / Semester</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{formInput.grade} / {formInput.semester}</td></tr>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[140px] py-0.5">Materi Pokok</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{currentMaterial}</td></tr>
            </tbody>
          </table>
          <table className="w-full text-left border-none">
            <tbody>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[100px] py-0.5">Nama Guru</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{formInput.teacherName}</td></tr>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[100px] py-0.5">NIP Guru</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{formInput.teacherNip}</td></tr>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[100px] py-0.5">Jabatan</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{formInput.position}</td></tr>
              <tr><td className="font-bold uppercase whitespace-nowrap w-[100px] py-0.5">Alokasi Waktu</td><td className="w-3 font-bold py-0.5">:</td><td className="py-0.5">{formInput.timeAllocation || data?.header?.timeLimit || '60 Menit'}</td></tr>
            </tbody>
          </table>
        </div>

        {/* 2. Tampilan Cetak Fisik: Menggunakan Tabel Dalam Tabel agar LURUS SEMPURNA */}
        <table className="print-identity-table mb-8">
          <tbody>
            <tr>
              <td>
                <table className="inner-table text-[10px]">
                  <tbody>
                    <tr><td className="font-bold whitespace-nowrap w-[140px]">SATUAN PENDIDIKAN</td><td className="font-bold w-3">:</td><td>{formInput.schoolName}</td></tr>
                    <tr><td className="font-bold whitespace-nowrap w-[140px]">MATA PELAJARAN</td><td className="font-bold w-3">:</td><td>{formInput.subject}</td></tr>
                    <tr><td className="font-bold whitespace-nowrap w-[140px]">KELAS / SEMESTER</td><td className="font-bold w-3">:</td><td>{formInput.grade} / {formInput.semester}</td></tr>
                    <tr><td className="font-bold whitespace-nowrap w-[140px]">MATERI POKOK</td><td className="font-bold w-3">:</td><td>{currentMaterial}</td></tr>
                  </tbody>
                </table>
              </td>
              <td>
                <table className="inner-table text-[10px]">
                  <tbody>
                    <tr><td className="font-bold whitespace-nowrap w-[100px]">NAMA GURU</td><td className="font-bold w-3">:</td><td>{formInput.teacherName}</td></tr>
                    <tr><td className="font-bold whitespace-nowrap w-[100px]">NIP GURU</td><td className="font-bold w-3">:</td><td>{formInput.teacherNip}</td></tr>
                    <tr><td className="font-bold whitespace-nowrap w-[100px]">JABATAN</td><td className="font-bold w-3">:</td><td>{formInput.position}</td></tr>
                    <tr><td className="font-bold whitespace-nowrap w-[100px]">ALOKASI WAKTU</td><td className="font-bold w-3">:</td><td>{formInput.timeAllocation || data?.header?.timeLimit || '60 Menit'}</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {activeTab === 'soal' && (
          <div className="space-y-8">
            <p className="font-bold border-b border-gray-200 pb-2 italic">Petunjuk: Kerjakanlah soal-soal di bawah ini dengan jujur dan teliti!</p>
            {localQuestions.map((q) => {
              const isAbove = q.text?.toLowerCase()?.includes('di atas') || false;    
              
              return (
                <div key={q.number} className="break-inside-avoid border-b border-slate-50 pb-6 space-y-4">
                  {q.stimulus && (
                    <div className="bg-slate-50 p-6 rounded-xl border-2 border-slate-200 mb-4 text-justify italic">
                      <div className="whitespace-pre-wrap leading-relaxed">{q.stimulus}</div>
                    </div>
                  )}
                  <div className="flex flex-col gap-4">
                    {generatedImages[q.number] ? (
                      <div className={cn("relative group", isAbove ? "w-full max-w-2xl mx-auto" : "max-w-sm")}>
                        <img src={generatedImages[q.number]} className="w-full h-auto rounded-xl border" referrerPolicy="no-referrer" />
                        
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity no-print bg-slate-900/60 backdrop-blur-sm p-1.5 rounded-xl">
                          <button 
                            onClick={() => generateImage(q.number, q)} 
                            disabled={isGeneratingImage[q.number]}
                            title="Ganti/Regenerate Gambar"
                            className="p-1.5 bg-white text-citrus-600 hover:bg-citrus-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={cn("w-4 h-4", isGeneratingImage[q.number] && "animate-spin")} />
                          </button>
                          <button 
                            onClick={() => handleRemoveImage(q.number)}
                            title="Hapus Gambar"
                            className="p-1.5 bg-white text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="no-print">
                        <button onClick={() => generateImage(q.number, q)} disabled={isGeneratingImage[q.number]} className="gradient-citrus text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
                          <DownloadCloud className="w-4 h-4" /> {isGeneratingImage[q.number] ? 'Memproses Gambar...' : 'Generate Stimulus Visual'}
                        </button>
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <span className="font-bold min-w-[25px] h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0">{q.number}.</span>
                      <div className="flex-1"><div className="text-justify leading-relaxed whitespace-pre-wrap font-medium text-slate-900">{q.text}</div></div>
                    </div>
                  </div>

                  <div className="ml-9 space-y-4">
                    {q.type === 'Pilihan Ganda' && q.options && (
                      <div className="grid grid-cols-1 gap-2 ml-2">
                        {q.options.map((opt, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="font-bold text-slate-700 w-5">{String.fromCharCode(65 + i)}.</span>
                            <span className="text-slate-800">{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'Benar Salah' && (
                      <div className="flex gap-4 ml-2">
                        <div className="flex items-center gap-2"><div className="w-5 h-5 border-2 rounded-full" /><span className="text-sm font-bold">BENAR</span></div>
                        <div className="flex items-center gap-2"><div className="w-5 h-5 border-2 rounded-full" /><span className="text-sm font-bold">SALAH</span></div>
                      </div>
                    )}
                    {q.type === 'Pilihan Ganda Kompleks' && q.multiOptions && (
                      <div className="grid grid-cols-1 gap-3 ml-2">
                        {q.multiOptions.map((opt, i) => (
                          <div key={i} className="flex gap-3 items-center">
                            <div className="w-5 h-5 border-2 rounded" /><span className="text-slate-800">{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'Menjodohkan' && q.matchingPairs && (
                      <div className="ml-2"><table className="w-full border-2 border-collapse"><thead><tr className="bg-slate-50"><th className="border-2 p-2 text-xs font-bold w-1/2">Pernyataan A</th><th className="border-2 p-2 text-xs font-bold w-1/2">Pernyataan B</th></tr></thead><tbody>{q.matchingPairs.map((pair, i) => <tr key={i}><td className="border-2 p-3 text-sm">{pair.prompt}</td><td className="border-2 p-3 text-sm"></td></tr>)}</tbody></table></div>
                    )}
                    {q.type === 'Isian Singkat' && <div className="ml-2 mt-4"><div className="w-full border-b-2 border-dotted h-8" /></div>}
                    {q.type === 'Uraian' && <div className="ml-2 mt-4 space-y-2"><div className="w-full border-b-2 border-dotted h-8" /><div className="w-full border-b-2 border-dotted h-8" /></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'kunci' && (
          <div className="space-y-8">
            <h3 className="text-lg font-bold border-b-2 border-citrus-200 pb-2 text-citrus-800 uppercase tracking-tighter">Kunci Jawaban & Rubrik Penilaian</h3>
            <table className="spreadsheet-table w-full">
              <thead>
                <tr>
                  <th className="w-16 text-center">No</th>
                  <th>Kunci Jawaban & Rubrik Penilaian</th>
                </tr>
              </thead>
              <tbody>
                {localQuestions.map((q) => (
                  <tr key={q.number}>
                    <td className="text-center font-bold font-mono vertical-align-top pt-4">{q.number}</td>
                    <td>
                      <div className="space-y-3 p-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-bold bg-citrus-500 text-white px-2 py-0.5 rounded shrink-0">KUNCI</span>
                          <p className="font-bold text-citrus-900">{formatAnswerKey(q.answerKey)}</p>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-1">Rubrik Penilaian:</p>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {(q as any).score || (q as any).rubrik || "Skor 1 jika murid menjawab dengan tepat. Skor 0 jika salah/kosong."}
                          </p>
                        </div>
                        
                        <p className="text-[10px] text-citrus-600 font-bold uppercase">Level Kognitif: {q.cognitiveLevel}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'kisi' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold border-b-2 border-citrus-200 pb-2 text-citrus-800 uppercase tracking-tighter">Matriks Kisi-kisi Asesmen</h3>
            <div className="overflow-x-auto">
              <table className="spreadsheet-table w-full">
                <thead>
                  <tr>
                    <th className="text-center w-12">No</th>
                    <th>Capaian & Tujuan Pembelajaran</th>
                    <th>Indikator Soal</th>
                    <th className="text-center w-20">Level</th>
                    <th className="text-center w-32">Bentuk</th>
                  </tr>
                </thead>
                <tbody>
                  {localKisiKisi.map((item) => (
                    <tr key={item.no}>
                      <td className="text-center font-bold font-mono">{item.no}</td>
                      <td className="text-xs leading-relaxed"><b>CP:</b> <p className="mb-2 italic text-slate-700">{formInput.cp}</p><b>TP:</b> <p className="text-slate-800">{item.tp}</p></td>
                      <td className="text-xs italic text-slate-700">{item.indikatorSoal}</td>
                      <td className="text-center"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border">{item.levelKognitif}</span></td>
                      <td className="text-center w-32 whitespace-nowrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border inline-block whitespace-nowrap">
                          {item.bentukSoal}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab !== 'soal' && (
          <table className="signature-table mt-20 no-border w-full">
            <tbody>
              <tr>
                <td className="text-left align-top"><p>Mengetahui,</p><p>Kepala Sekolah</p><div className="h-24"></div><p className="font-bold underline">{formInput.principalName}</p><p>NIP. {formInput.principalNip}</p></td>
                <td className="text-left align-top"><p>{formInput.regionName}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p><p>{formInput.position}</p><div className="h-24"></div><p className="font-bold underline">{formInput.teacherName}</p><p>NIP. {formInput.teacherNip}</p></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
