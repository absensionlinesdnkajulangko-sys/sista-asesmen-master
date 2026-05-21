/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Login from './components/Login';
import GeneratorForm from './components/GeneratorForm';
import ModulTable from './components/ModulTable';
import Sidebar, { NavItem } from './components/Sidebar';
import { SoalFormData, GeneratedSoal } from './types';
import { generateSoal } from './lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Target, LayoutDashboard, Search, Bell, User as UserIcon, FileText } from 'lucide-react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<NavItem>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<SoalFormData | null>(null);
  const [generatedSoal, setGeneratedSoal] = useState<GeneratedSoal | null>(null);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    setIsLoggedIn(false);
    setGeneratedSoal(null);
    setFormData(null);
  };

  const handleSubmit = async (data: SoalFormData) => {
    setIsLoading(true);
    setFormData(data);
    try {
      const result = await generateSoal(data);
      setGeneratedSoal(result);
    } catch (error) {
      alert("Terjadi kesalahan saat generate soal. Silakan coba lagi.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const renderContent = () => {
    if (generatedSoal) {
      return (
        <ModulTable 
          data={generatedSoal} 
          formInput={formData!} 
          onBack={() => setGeneratedSoal(null)} 
          mode={activeTab}
        />
      );
    }

    if (activeTab === 'dashboard') {
      return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Welcome Message at the top */}
          <div className="glass p-10 rounded-[2.5rem] border-citrus-100 relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight text-center md:text-left">Selamat Datang di <span className="text-citrus-600">SISTA DASHBOARD</span></h2>
              <p className="text-slate-600 max-w-2xl leading-relaxed text-center md:text-left">
                Sistem Asesmen Pintar (SISTA) adalah platform Generator Asesmen tercanggih untuk Bapak/Ibu Guru. dikembangkan oleh FIDHAL TOUNA AI. Gunakan menu di sebelah kiri untuk mulai merancang bank soal berkualitas tinggi berbasis HOTS dan Literasi-Numerasi.
              </p>
              <div className="flex justify-center md:justify-start">
                <button 
                  onClick={() => setActiveTab('sumatif')}
                  className="gradient-citrus text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-citrus-500/30 hover:scale-105 transition-transform"
                >
                  Mulai Buat Soal Sekarang
                </button>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-citrus-100 rounded-full blur-3xl opacity-50" />
            <div className="absolute -left-10 -top-10 w-64 h-64 bg-amber-100 rounded-full blur-3xl opacity-30" />
          </div>

          {/* Detailed User Guide */}
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-citrus-600 text-white">
                <FileText className="w-5 h-5" />
              </div>
              Panduan Penggunaan Aplikasi
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-citrus-50 text-citrus-600 flex items-center justify-center font-bold mb-4">1</div>
                <h4 className="font-bold text-slate-900 mb-2">Pilih Jenis Asesmen</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Pilihlah salah satu menu di sidebar (Asesmen Diagnostik, Formatif, Sumatif, STS, atau SAS) sesuai kebutuhan evaluasi Anda.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-citrus-50 text-citrus-600 flex items-center justify-center font-bold mb-4">2</div>
                <h4 className="font-bold text-slate-900 mb-2">Isi Identitas & Kurikulum</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Lengkapi data satuan pendidikan, guru, dan kepala sekolah. Masukkan Capaian Pembelajaran (CP) dan Tujuan Pembelajaran (TP) yang ingin diukur.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-citrus-50 text-citrus-600 flex items-center justify-center font-bold mb-4">3</div>
                <h4 className="font-bold text-slate-900 mb-2">Konfigurasi Soal</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Tentukan jumlah soal, tingkat kognitif (LOTS/MOTS/HOTS), dan jenis soal (Pilihan Ganda, Pilihan Ganda Kompleks, Benar Salah, Menjodohkan, Isian, atau Uraian). Aktifkan stimulus gambar jika diperlukan.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-citrus-50 text-citrus-600 flex items-center justify-center font-bold mb-4">4</div>
                <h4 className="font-bold text-slate-900 mb-2">Generate & Tinjau Soal</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Klik tombol generate dan tunggu AI memproses. Anda dapat meninjau soal, memilih stimulus visual, dan mengecek kunci jawaban serta kisi-kisi.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-citrus-50 text-citrus-600 flex items-center justify-center font-bold mb-4">5</div>
                <h4 className="font-bold text-slate-900 mb-2">Kustomisasi Gambar</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Jika stimulus gambar sudah diaktifkan, Anda dapat mengubah gambar yang dihasilkan AI agar lebih relevan dengan konteks soal melalui tombol "Ganti Gambar".
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-citrus-50 text-citrus-600 flex items-center justify-center font-bold mb-4">6</div>
                <h4 className="font-bold text-slate-900 mb-2">Unduh ke Microsoft Word</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Gunakan tombol export untuk mengunduh instrumen penilaian ke format .doc secara terpisah (Lembar Soal, Kunci Jawaban, atau Kisi-kisi).
                </p>
              </div>
            </div>
            
            <div className="bg-citrus-900 text-white p-8 rounded-[2rem] shadow-2xl">
              <h4 className="font-black text-xl mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-citrus-400" />
                Tips Profesional
              </h4>
              <ul className="space-y-3 text-sm text-citrus-100">
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-citrus-400 mt-1.5 shrink-0" />
                  <span>Pastikan CP dan TP diisi dengan detail agar AI dapat menyesuaikan materi soal dengan target pembelajaran yang spesifik.</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-citrus-400 mt-1.5 shrink-0" />
                  <span>Pilih variasi level kognitif (HOTS/MOTS) untuk mengukur kemampuan berpikir kritis siswa secara komprehensif.</span>
                </li>
                <li className="flex gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-citrus-400 mt-1.5 shrink-0" />
                  <span>Gunakan kisi-kisi soal yang dihasilkan sebagai dasar pembuatan Jurnal Asesmen Kelas Bapak/Ibu.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Default to Generator Form for all other tabs (simplification for this turn)
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
        <div className="flex flex-col space-y-2 mb-10">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{activeTab.replace('-', ' ')}</h2>
          <p className="text-citrus-700 font-medium max-w-xl">
            Lengkapi data di bawah ini untuk menghasilkan instrumen penilaian yang valid dan reliabel sesuai standar BSKAP Kurikulum Merdeka.
          </p>
        </div>
        <GeneratorForm onSubmit={handleSubmit} isLoading={isLoading} mode={activeTab} />
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-citrus-50">
      <Sidebar active={activeTab} onChange={(tab) => { setActiveTab(tab); setGeneratedSoal(null); }} onLogout={handleLogout} />
      
      <main className="flex-1 min-h-screen overflow-y-auto relative py-8 px-12">
        {/* Header UI */}
        <div className="flex items-center justify-between mb-12 no-print">
          <div className="relative group w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-citrus-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Cari bank soal atau materi..." 
              className="w-full bg-white border border-citrus-100 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-citrus-500 focus:border-transparent shadow-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="w-12 h-12 rounded-xl bg-white border border-citrus-100 flex items-center justify-center text-slate-500 hover:text-citrus-600 hover:bg-citrus-50 transition-all shadow-sm">
              <Bell className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 px-3 py-2 bg-white border border-citrus-100 rounded-2xl shadow-sm">
              <div className="w-10 h-10 rounded-xl gradient-citrus flex items-center justify-center text-white font-bold">P</div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 font-bold uppercase tracking-wider">GENERATOR AI</p>
                <p className="text-[10px] text-citrus-600 leading-none">Premium Account</p>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (generatedSoal ? '-result' : '-form')}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>

        <footer className="no-print mt-20 border-t border-citrus-200/50 py-10 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
            SISTA • SISTEM ASESMEN PINTAR © {new Date().getFullYear()}
          </p>
          <p className="text-[10px] font-bold text-citrus-600/60 uppercase tracking-widest">
            Developed by FIDHAL TOUNA AI
          </p>
        </footer>
      </main>
    </div>
  );
}
