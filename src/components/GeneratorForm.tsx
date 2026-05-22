import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, School, User as UserIcon, Briefcase, GraduationCap, Calendar, BookOpen, Layers, Target, ClipboardList, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { SoalFormData, QuestionType, QuestionConfig } from '../types';
import { NavItem } from './Sidebar';
import { cn } from '../lib/utils';

interface GeneratorFormProps {
  onSubmit: (data: SoalFormData) => void;
  isLoading: boolean;
  mode: NavItem;
}

const COGNITIVE_LEVELS = ['LOTS', 'MOTS', 'HOTS'];
const QUESTION_TYPES: QuestionType[] = ['Pilihan Ganda', 'Pilihan Ganda Kompleks', 'Isian Singkat', 'Uraian', 'Benar Salah', 'Menjodohkan'];

// KODE KEAMANAN / NAMA SEKOLAH YANG DIIZINKAN
const ALLOWED_SCHOOLS = [
  "SD Negeri 1 Merdeka",
  "SD NEGERI 1 MERDEKA",
  "SDN 1 MERDEKA"
];

// KODE KEAMANAN / NAMA GURU YANG DIIZINKAN
const ALLOWED_TEACHERS = [
  "Rista Kasaraeng, S.Pd",
  "RISTA KASARAENG, S.Pd",
  "Fidhal"
];

export default function GeneratorForm({ onSubmit, isLoading, mode }: GeneratorFormProps) {
  // Cek apakah mode saat ini termasuk kategori Sumatif
  const isSumatifMode = mode === 'sh' || mode === 'sts' || mode === 'sas';

  // State untuk mendeteksi apakah kuota API Gemini habis
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  const [formData, setFormData] = useState<SoalFormData>(() => {
    const savedData = localStorage.getItem(`sista_form_${mode}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (typeof parsed.material === 'string') {
          parsed.material = parsed.material ? [parsed.material] : [''];
        }
        return parsed;
      } catch (e) {
        console.error("Gagal membaca data formulir dari localStorage", e);
      }
    }
    return {
      schoolName: '',
      teacherName: '',
      teacherNip: '',
      position: 'Guru Kelas',
      principalName: '',
      principalNip: '',
      regionName: '',
      academicYear: '',
      level: 'SD',
      grade: '',
      semester: 'I / Ganjil',
      subject: '',
      timeAllocation: '', 
      material: [''], 
      cp: '',
      withImages: false,
      questionConfigs: [{ type: 'Pilihan Ganda', count: 5, optionCount: 4, scorePerItem: 1 }],
      cognitiveLevel: ['MOTS']
    };
  });

  // Validasi status lisensi sekolah
  const isSchoolValid = ALLOWED_SCHOOLS.some(
    (school) => school.toLowerCase() === formData.schoolName.trim().toLowerCase()
  );
  const isTeacherValid = ALLOWED_TEACHERS.some(
    (teacher) => teacher.toLowerCase() === formData.teacherName.trim().toLowerCase()
  );
  const isSecurityValid = isSchoolValid && isTeacherValid;

  useEffect(() => {
    localStorage.setItem(`sista_form_${mode}`, JSON.stringify(formData));
  }, [formData, mode]);

  useEffect(() => {
    // Reset state eror kuota setiap kali beralih jenis asesmen
    setIsQuotaExceeded(false);

    const savedData = localStorage.getItem(`sista_form_${mode}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (typeof parsed.material === 'string') {
          parsed.material = parsed.material ? [parsed.material] : [''];
        }
        setFormData(parsed);
      } catch (e) {
        console.error(e);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        grade: '',
        subject: '',
        timeAllocation: '', 
        material: [''],
        cp: ''
      }));
    }
  }, [mode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMaterialChange = (index: number, value: string) => {
    const newMaterials = [...formData.material];
    newMaterials[index] = value;
    setFormData(prev => ({ ...prev, material: newMaterials }));
  };

  const handleAddMaterial = () => {
    setFormData(prev => ({ ...prev, material: [...prev.material, ''] }));
  };

  const handleRemoveMaterial = (index: number) => {
    setFormData(prev => ({ ...prev, material: prev.material.filter((_, i) => i !== index) }));
  };

  const handleLevelToggle = (item: string) => {
    setFormData(prev => ({
      ...prev,
      cognitiveLevel: prev.cognitiveLevel.includes(item)
        ? prev.cognitiveLevel.filter(i => i !== item)
        : [...prev.cognitiveLevel, item]
    }));
  };

  const addConfig = () => {
    setFormData(prev => ({
      ...prev,
      questionConfigs: [...prev.questionConfigs, { type: 'Pilihan Ganda', count: 5, optionCount: 4, scorePerItem: 1 }]
    }));
  };

  const removeConfig = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questionConfigs: prev.questionConfigs.filter((_, i) => i !== index)
    }));
  };

  const updateConfig = (index: number, updates: Partial<QuestionConfig>) => {
    setFormData(prev => ({
      ...prev,
      questionConfigs: prev.questionConfigs.map((c, i) => i === index ? { ...c, ...updates } : c)
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSchoolValid) return;
    setIsQuotaExceeded(false);
    
    try {
      await onSubmit(formData);
    } catch (error: any) {
      const errorText = error?.message || String(error);
      if (errorText.includes("429") || errorText.toLowerCase().includes("quota") || errorText.toLowerCase().includes("limit")) {
        setIsQuotaExceeded(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const sectionClass = "glass p-6 md:p-8 rounded-[1.5rem] space-y-6";
  const labelClass = "text-sm font-bold text-citrus-800 flex items-center gap-2";
  const inputClass = "w-full bg-white/50 border border-citrus-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-citrus-500 focus:border-transparent outline-none transition-all";

  return (
    <form onSubmit={handleFormSubmit} className="max-w-4xl mx-auto space-y-8 pb-20">
      
      {/* Kotak Notifikasi di Bagian Paling Atas Formulir dengan Transisi yang Aman */}
      <AnimatePresence>
        {isQuotaExceeded && (
          <motion.div 
            key="quota-alert"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-3 p-5 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-900 shadow-sm"
          >
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <p className="font-black text-sm uppercase tracking-wide">KUOTA HARIAN ANDA TELAH HABIS</p>
              <p className="text-xs font-medium text-rose-700/90 mt-0.5">Batas permintaan harian API gratis dari Google Cloud telah terpenuhi. Silakan hubungi admin Fidhal Touna AI atau ganti token API Anda.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Identity Section */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-citrus-100 text-citrus-600">
            <School className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-citrus-900">Identitas Satuan Pendidikan</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelClass}><School className="w-4 h-4"/> Nama Satuan Pendidikan</label>
            <input 
              name="schoolName" value={formData.schoolName} onChange={handleChange} required className={inputClass} placeholder="Contoh: SD Negeri 1 Merdeka" />
          </div>
          <div className="space-y-2">
            <label className={labelClass}><UserIcon className="w-4 h-4"/> Nama Guru</label>
            <input name="teacherName" value={formData.teacherName} onChange={handleChange} required className={inputClass} placeholder="Nama Lengkap" />
          </div>
          <div className="space-y-2">
            <label className={labelClass} >NIP Guru</label>
            <input name="teacherNip" value={formData.teacherNip} onChange={handleChange} required className={inputClass} placeholder="NIP" />
          </div>
          <div className="space-y-2">
            <label className={labelClass}><Briefcase className="w-4 h-4"/> Jabatan</label>
            <select name="position" value={formData.position} onChange={handleChange} required className={inputClass}>
              <option value="Guru Kelas">Guru Kelas</option>
              <option value="Guru Mata Pelajaran">Guru Mata Pelajaran</option>
              <option value="Wali Kelas">Wali Kelas</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass}><UserIcon className="w-4 h-4"/> Nama Kepala Sekolah</label>
            <input name="principalName" value={formData.principalName} onChange={handleChange} required className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>NIP Kepala Sekolah</label>
            <input name="principalNip" value={formData.principalNip} onChange={handleChange} required className={inputClass} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className={labelClass}><Calendar className="w-4 h-4"/> Tahun Ajaran</label>
            <input name="academicYear" value={formData.academicYear} onChange={handleChange} required className={inputClass} placeholder="Contoh: 2023/2024" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className={labelClass}><Target className="w-4 h-4"/> Nama (Kabupaten/Kecamatan/Kelurahan/Desa) Sekolah Anda</label>
            <input name="regionName" value={formData.regionName} onChange={handleChange} required className={inputClass} placeholder="Contoh: Kec. Merdeka, Kab. Indonesia" />
          </div>
        </div>
      </div>

      {/* Curriculum Details */}
      <div className={sectionClass}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-citrus-100 text-citrus-600">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-citrus-900">Kurikulum & Materi</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className={labelClass}>Jenjang</label>
            <select name="level" value={formData.level} onChange={handleChange} className={inputClass} required>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Kelas</label>
            <input name="grade" value={formData.grade} onChange={handleChange} className={inputClass} placeholder="Contoh: 1, 7, 10" required />
          </div>
          <div className="space-y-2">
            <label className={labelClass}><Calendar className="w-4 h-4"/> Semester</label>
            <select name="semester" value={formData.semester} onChange={handleChange} className={inputClass} required>
              <option value="I / Ganjil">I / Ganjil</option>
              <option value="II / Genap">II / Genap</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelClass}><BookOpen className="w-4 h-4"/> Mata Pelajaran</label>
            <input name="subject" value={formData.subject} onChange={handleChange} className={inputClass} required />
          </div>
          
          <div className="space-y-2">
            <label className={labelClass}><Clock className="w-4 h-4"/> Alokasi Waktu</label>
            <input 
              name="timeAllocation" 
              value={formData.timeAllocation || ''} 
              onChange={handleChange} 
              className={inputClass} 
              placeholder="Contoh: 90 Menit" 
              required 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass}><Target className="w-4 h-4"/> Capaian Pembelajaran (CP)</label>
          <textarea name="cp" value={formData.cp} onChange={handleChange} className={cn(inputClass, "h-24 resize-none")} required placeholder="Tempelkan Capaian Pembelajaran dari Kurikulum Merdeka di sini" />
        </div>

        {/* Dynamic Material Input Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className={labelClass}><ClipboardList className="w-4 h-4"/> Materi Utama (Materi Pokok)</label>
            {isSumatifMode && (
              <button 
                type="button" 
                onClick={handleAddMaterial}
                className="text-[10px] font-bold bg-citrus-50 text-citrus-600 px-3 py-1 rounded-full border border-citrus-200 hover:bg-citrus-100 transition-colors"
              >
                + Tambah Materi Pokok
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {formData.material.map((mat, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <input 
                    value={mat} 
                    onChange={(e) => handleMaterialChange(index, e.target.value)} 
                    className={cn(inputClass, "h-12")} 
                    placeholder={isSumatifMode ? `Materi Pokok Pembahasan Ujian ${index + 1}` : "Masukkan Materi Utama"} 
                    required 
                  />
                </div>
                {isSumatifMode && formData.material.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(index)}
                    className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Question Config */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-citrus-100 text-citrus-600">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-citrus-900">Konfigurasi Tipe Soal</h2>
          </div>
          <button type="button" onClick={addConfig} className="flex items-center gap-2 text-citrus-700 font-bold hover:text-citrus-900 transition-colors px-3 py-1 bg-citrus-100 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Tambah Tipe
          </button>
        </div>
        
        <div className="space-y-4">
          {formData.questionConfigs.map((config, idx) => (
            <div key={idx} className="bg-white/40 p-6 rounded-2xl border border-citrus-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-citrus-600 uppercase">Bentuk Soal</label>
                  <select 
                    value={config.type} 
                    onChange={(e) => updateConfig(idx, { type: e.target.value as QuestionType })}
                    className={cn(inputClass, "py-2 text-sm")}
                  >
                    {QUESTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-citrus-600 uppercase">Jumlah Soal</label>
                    <div className="flex items-center gap-2 bg-white rounded-xl border border-citrus-200 p-1">
                      <button type="button" onClick={() => updateConfig(idx, { count: Math.max(1, config.count - 1) })} className="p-1 px-2 hover:bg-citrus-50 rounded-lg transition-colors"><Minus className="w-3 h-3 text-citrus-600"/></button>
                      <span className="font-bold w-full text-center text-sm">{config.count}</span>
                      <button type="button" onClick={() => updateConfig(idx, { count: config.count + 1 })} className="p-1 px-2 hover:bg-citrus-50 rounded-lg transition-colors"><Plus className="w-3 h-3 text-citrus-600"/></button>
                    </div>
                  </div>
                  {config.type === 'Pilihan Ganda' && (
                    <div className="w-24 space-y-1">
                      <label className="text-[10px] font-bold text-citrus-600 uppercase">Option</label>
                      <select
                        value={config.optionCount || 4}
                        onChange={(e) => updateConfig(idx, { optionCount: parseInt(e.target.value) })}
                        className={cn(inputClass, "py-2 px-2 text-sm")}
                      >
                        <option value={3}>3 (A-C)</option>
                        <option value={4}>4 (A-D)</option>
                        <option value={5}>5 (A-E)</option>
                      </select>
                    </div>
                  )}

                  {formData.questionConfigs.length > 1 && (
                    <div className="pt-5">
                      <button type="button" onClick={() => removeConfig(idx)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <Minus className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 border-t border-citrus-100 pt-6">
          <label className={labelClass}>Level Kognitif</label>
          <div className="flex flex-wrap gap-3">
            {COGNITIVE_LEVELS.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => handleLevelToggle(item)}
                className={cn(
                  "px-6 py-3 rounded-xl text-sm font-semibold border transition-all",
                  formData.cognitiveLevel.includes(item)
                    ? "bg-citrus-600 border-citrus-600 text-white shadow-md shadow-citrus-600/20"
                    : "bg-white border-citrus-200 text-citrus-700 hover:border-citrus-400"
                )}
              >
                {item}
              </button>
            ))}
          </div>
          {formData.cognitiveLevel.length === 0 && (
            <p className="text-xs text-red-500 italic">Pilih minimal satu level kognitif.</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <motion.button
        whileHover={(!isLoading && isSecurityValid && formData.cognitiveLevel.length > 0) ? { scale: 1.01 } : {}}
        whileTap={(!isLoading && isSecurityValid && formData.cognitiveLevel.length > 0) ? { scale: 0.99 } : {}}
        type="submit"
        disabled={isLoading || formData.cognitiveLevel.length === 0 || !isSecurityValid}
        className={cn(
          "w-full font-bold py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all",
          (isLoading || formData.cognitiveLevel.length === 0 || !isSecurityValid)
            ? "bg-slate-300 text-slate-500 shadow-none cursor-not-allowed opacity-70"
            : "gradient-citrus text-white shadow-citrus-500/20 cursor-pointer"
        )}
      >
        {isLoading ? (
          <>
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating Assessment...
          </>
        ) : !isSecurityValid ? (
          <>
            <AlertTriangle className="w-6 h-6" />
            Aplikasi Terkunci: Kode Validasi Anda Tidak Valid. (Hubungi Fidhal Touna AI)
          </>
        ) : (
          <>
            <Target className="w-6 h-6" />
            Generate Lembar Asesmen
          </>
        )}
      </motion.button>
    </form>
  );
}
