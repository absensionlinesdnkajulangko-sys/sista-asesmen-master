export type QuestionType = 'Pilihan Ganda' | 'Pilihan Ganda Kompleks' | 'Isian Singkat' | 'Uraian' | 'Benar Salah' | 'Menjodohkan';

export interface QuestionConfig {
  type: QuestionType;
  count: number;
  optionCount?: number; // For Pilihan Ganda
  scorePerItem: number;
}

export interface SoalFormData {
  schoolName: string;
  teacherName: string;
  teacherNip: string;
  position: 'Guru Kelas' | 'Guru Mata Pelajaran' | 'Wali Kelas';
  principalName: string;
  principalNip: string;
  regionName: string;
  academicYear: string;
  level: string;
  grade: string;
  semester: string;
  subject: string;
  timeAllocation: string; // 1. MENAMBAHKAN FIELD ALOKASI WAKTU
  material: string[];     // 2. MENGUBAH STRING MENJADI ARRAY STRING
  cp: string; 
  tp: string[];
  withImages?: boolean;
  questionConfigs: QuestionConfig[]; 
  cognitiveLevel: string[]; 
}

export interface QuestionItem {
  number: number;
  type: QuestionType;
  text: string;
  stimulus?: string; // Text stimulus (literacy/numeracy)
  imageUrl?: string; // URL for image stimulus
  options?: string[]; // For Multiple Choice / True-False
  multiOptions?: { text: string; isCorrect: boolean }[]; // For PGK
  matchingPairs?: { prompt: string; answer: string }[]; // For Matching
  answerKey: string;
  explanation: string;
  cognitiveLevel: string;
}

export interface KisiKisiItem {
  no: number;
  cp: string;
  tp: string;
  materiPokok: string;
  indikatorSoal: string;
  levelKognitif: string;
  bentukSoal: string;
}

export interface GeneratedSoal {
  header: {
    schoolName: string;
    subject: string;
    classSemester: string;
    material?: string;
    timeLimit: string; // Properti ini nantinya bisa Anda petakan dari formData.timeAllocation saat melakukan generate
  };
  questions: QuestionItem[];
  kisiKisi: KisiKisiItem[];
}
