import { Download, ChevronLeft, FileText, ClipboardCheck, Key, Printer, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
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
  const [localQuestions, setLocalQuestions] = useState(data?.questions || []);
  const [localKisiKisi, setLocalKisiKisi] = useState(data?.kisiKisi || []);
  const [isTabLoading, setIsTabLoading] = useState(false);

  const handlePrint = () => window.print();

  const handleTabChange = async (tab: 'soal' | 'kunci' | 'kisi') => {
    setActiveTab(tab);
    if (tab === 'kunci' && localQuestions.every(q => q.answerKey === "" || q.answerKey === "-")) {
      setIsTabLoading(true);
      try {
        const updatedQuestions = await generateKunciOnly(data.header, localQuestions);
        setLocalQuestions(updatedQuestions);
      } catch (error: any) { alert(error.message || "Gagal memuat kunci."); }
      finally { setIsTabLoading(false); }
    }
    if (tab === 'kisi' && localKisiKisi.length === 0) {
      setIsTabLoading(true);
      try {
        const generatedKisi = await generateKisiOnly(formInput, localQuestions);
        setLocalKisiKisi(generatedKisi);
      } catch (error: any) { alert(error.message || "Gagal memuat kisi-kisi."); }
      finally { setIsTabLoading(false); }
    }
  };

  const handleChatGPTRedirect = async (q: any) => {
    const fullPrompt = `Buatkan gambar ilustrasi untuk soal ini: ${q.text.substring(0, 150)}. Spesifikasi: 2D vector, white background, no text/labels.`;
    try {
      await navigator.clipboard.writeText(fullPrompt);
      alert("✅ Prompt disalin! SISTA akan membuka ChatGPT.");
      window.open('https://chatgpt.com/', '_blank');
    } catch { window.open('https://chatgpt.com/', '_blank'); }
  };

  const handlePasteImageUrl = (num: number) => {
    const url = window.prompt("Tempel URL Gambar dari ChatGPT:");
    if (url && url.trim()) setGeneratedImages(prev => ({ ...prev, [num]: url.trim() }));
  };

  const handleRemoveImage = (num: number) => {
    setGeneratedImages(prev => { const upd = { ...prev }; delete upd[num]; return upd; });
  };

  const formatAnswerKey = (val: any) => !val ? '-' : Array.isArray(val) ? val.join(', ') : String(val);
  const currentMaterial = Array.isArray(formInput.material) ? formInput.material.join(', ') : formInput.material;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-32">
      {/* Navigation Bar */}
      <div className="flex justify-between p-4 bg-white/80 rounded-[1.5rem] border shadow-xl no-print sticky top-4 z-40">
        <button onClick={onBack} className="flex items-center gap-2 font-bold"><ChevronLeft /> Edit Data</button>
        <div className="flex gap-2">
          {['soal', 'kunci', 'kisi'].map(tab => (
            <button key={tab} onClick={() => handleTabChange(tab as any)} className={cn("px-6 py-2 rounded-xl font-bold capitalize", activeTab === tab ? "bg-citrus-600 text-white" : "bg-white")}>{tab}</button>
          ))}
        </div>
        <button onClick={() => setShowExportOptions(!showExportOptions)} className="bg-citrus-600 text-white px-6 py-2 rounded-xl font-bold">Unduh</button>
      </div>

      <div ref={containerRef} className="bg-white p-12 shadow-2xl min-h-[1000px]">
        {isTabLoading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">Memproses data...</div>}
        
        {activeTab === 'soal' && (
          <div className="space-y-8">
            {localQuestions.map((q) => {
              // Bersihkan imagePrompt dari sisa template backend
              const cleanPrompt = (q.imagePrompt && !q.imagePrompt.includes("[Isi dengan")) ? q.imagePrompt : "";
              
              return (
                <div key={q.number} className="pb-6 border-b space-y-4">
                  {/* Area Pemicu Gambar */}
                  {cleanPrompt && (
                    <div className="my-4 p-4 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50 no-print">
                      {generatedImages[q.number] ? (
                        <div className="relative max-w-sm mx-auto">
                          <img src={generatedImages[q.number]} className="w-full rounded-xl border" />
                          <button onClick={() => handleRemoveImage(q.number)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><Trash2 size={16}/></button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="font-bold text-amber-800 text-sm">🖼️ Soal ini membutuhkan gambar:</p>
                          <p className="text-xs italic text-amber-700 my-2">"{cleanPrompt}"</p>
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleChatGPTRedirect(q)} className="bg-citrus-600 text-white px-3 py-1 rounded text-xs">Buat di ChatGPT</button>
                            <button onClick={() => handlePasteImageUrl(q.number)} className="bg-white border px-3 py-1 rounded text-xs">Tempel URL</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-4">
                    <span className="font-bold">{q.number}.</span>
                    <div className="flex-1 whitespace-pre-wrap">{q.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
