// lib/data.ts — sumber data terpusat Dzaroza Property

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  photo: string;
};

export const team: TeamMember[] = [
  {
    id: "arif",
    name: "Arif Nurhidayat",
    role: "CEO (Chief Executive Officer)",
    photo: "/images/team/arif.svg",
  },
  {
    id: "kholil",
    name: "Kholil Muflikhun",
    role: "Site Manager",
    photo: "/images/team/kholil.svg",
  },
  {
    id: "kaiska",
    name: "Kaiska Maymunah",
    role: "Engineering Manager",
    photo: "/images/team/kaiska.svg",
  },
  {
    id: "supriyatno",
    name: "Supriyatno",
    role: "Site Analyst",
    photo: "/images/team/supriyatno.svg",
  },
];

// Satu-satunya kontak WhatsApp resmi di seluruh situs — dipakai di floating
// button, dropdown konsultasi, dan fallback tombol beli produk.
export const primaryWhatsApp = "62882008562999"; // Customer Service
export type SocialLink = { label: string; url: string };

export const instagramAccounts: SocialLink[] = [
  { label: "@dzarozaproperti", url: "https://instagram.com/dzarozaproperti" },
  { label: "@official.dzarozaproperty", url: "https://instagram.com/official.dzarozaproperty" },
];
export const contactEmail = "dzaroza.properti@gmail.com";

// --------------------------- Produk Digital -----------------------------

export type ProductStatus = "coming-soon" | "new-release" | "published";

export type Product = {
  slug: string; // unik per produk, dipakai di URL /produk/[slug] — pakai huruf kecil & tanda "-"
  type: string; // kategori produk, mis. "E-Book", "E-Class", "Webinar", "Template", dst.
  title: string;
  summary: string;
  description: string;
  price: string; // label tampilan, mis. "Rp 99.000"
  priceAmount: number; // nilai numerik murni (IDR) untuk perhitungan Payment Gateway
  cover: string;
  videoUrl?: string; // opsional — video promosi (mp4/webm), mis. hasil upload lewat /admin/upload
  features: string[];
  ctaLabel: string; // "Pesan Sekarang" | "Berlangganan Sekarang"
  status: ProductStatus;
  releaseDate?: string; // ISO datetime — WAJIB diisi jika status "coming-soon", dipakai untuk countdown
};

export const products: Product[] = [
  {
    slug: "e-book",
    type: "E-Book",
    title: "Panduan Cerdas Investasi Property Amanah",
    summary:
      "Dasar-dasar investasi properti yang transparan dan bebas gharar, lengkap dengan simulasi cost & fee.",
    description:
      "E-Book ini membahas dasar investasi properti secara syar'i — mulai dari memilih lokasi, memahami akad cost and fee, hingga skema akad salam untuk titip-jual tanah/bangunan. Disusun berdasarkan pengalaman nyata proyek Dzaroza Property agar pembaca terhindar dari ketidakjelasan (gharar) dalam bertransaksi properti.",
    price: "Rp 99.000",
    priceAmount: 99000,
    cover: "/images/products/ebook-cover.svg",
    features: [
      "120+ halaman materi terstruktur",
      "Studi kasus proyek nyata Dzaroza Property",
      "Template simulasi biaya (cost & fee)",
      "Penjelasan akad salam untuk titip-jual",
      "Akses seumur hidup, format PDF",
    ],
    ctaLabel: "Pesan Sekarang",
    status: "coming-soon",
  },
  {
    slug: "e-class",
    type: "E-Class",
    title: "Kelas Praktik Manajerial Proyek Property",
    summary:
      "Video pembelajaran terstruktur cara mengelola proyek bangun & renovasi secara profesional dan amanah.",
    description:
      "Kelas video berjenjang tentang cara mengelola proyek bangun/renovasi dengan akad yang jelas sejak awal. Anda akan belajar menyusun kontrak cost and fee 10%, mengawasi mutu pekerjaan, dan menghindari sengketa lewat transparansi laporan biaya — semua dipandu langsung oleh tim Dzaroza Property.",
    price: "Rp 349.000 / bulan",
    priceAmount: 349000,
    cover: "/images/products/eclass-thumb.svg",
    features: [
      "8 modul video + worksheet",
      "Bimbingan grup via WhatsApp",
      "Template akad cost and fee siap pakai",
      "Sertifikat penyelesaian",
      "Sesi tanya-jawab bulanan bersama tim manajerial",
    ],
    ctaLabel: "Berlangganan Sekarang",
    status: "coming-soon",
  },
  {
    slug: "webinar-property-syariah",
    type: "Webinar",
    title: "Webinar Live: Memulai Bisnis Property Syariah",
    summary:
      "Sesi live 2 jam membahas dasar bisnis property tanpa riba dan gharar.",
    description:
      "Webinar interaktif bersama tim Dzaroza Property, membahas cara memulai bisnis property yang sesuai syariat, termasuk sesi tanya-jawab langsung bersama tim manajerial.",
    price: "Rp 149.000",
    priceAmount: 149000,
    cover: "/images/products/webinar-cover.svg",
    features: [
      "Durasi 2 jam, live via Zoom",
      "Rekaman tersedia 30 hari setelah acara",
      "Sesi tanya-jawab langsung",
      "E-sertifikat kehadiran",
    ],
    ctaLabel: "Daftar Sekarang",
    status: "coming-soon",
  },
];

// ------------------------------ Layanan Jasa ------------------------------

export type Service = {
  id: string;
  kategori: string;
  akad: string;
  title: string;
  description: string;
  points: string[];
};

export const services: Service[] = [
  {
    id: "bangun-baru",
    kategori: "Kategori A",
    akad: "Akad Cost and Fee 10%",
    title: "Jasa Membangun Bangunan Baru (Interior & Eksterior)",
    description:
      "Pengelolaan penuh proyek pembangunan dari nol — struktur, eksterior, hingga finishing interior — dengan akad yang disepakati jelas sejak awal.",
    points: [
      "Perencanaan & pengadaan material transparan",
      "Pengawasan lapangan berkala oleh tim manajerial",
      "Laporan biaya berkala, fee tetap 10% dari total cost",
      "Tanpa biaya tersembunyi (bebas gharar)",
    ],
  },
  {
    id: "renovasi",
    kategori: "Kategori B",
    akad: "Akad Cost and Fee 10%",
    title: "Jasa Renovasi Bangunan (Interior & Eksterior)",
    description:
      "Perbaikan dan peningkatan mutu bangunan — interior maupun eksterior — dengan tim quality control independen dari kontraktor pelaksana.",
    points: [
      "Survei kondisi awal & rencana renovasi jelas",
      "Rincian cost & fee dilaporkan tiap termin",
      "Koordinasi tukang dan material terpusat",
      "Akad disepakati sebelum pekerjaan dimulai",
    ],
  },
  {
    id: "titip-jual",
    kategori: "Kategori C",
    akad: "Akad Salam",
    title: "Jasa Titip & Menjualkan Bangunan / Tanah",
    description:
      "Bagi Anda yang ingin menitipkan tanah atau bangunan untuk dipasarkan dan dijualkan, dengan skema akad salam yang menyepakati harga dan spesifikasi di awal.",
    points: [
      "Kesepakatan harga & spesifikasi di awal (akad salam)",
      "Pemasaran aktif ke jaringan calon pembeli",
      "Pendampingan dokumen & proses transaksi",
      "Update progres pemasaran secara berkala",
    ],
  },
];

export const syariahStatement =
  "Akad Jelas di Awal, Transparan dan Amanah, tanpa unsur Gharar (ketidakpastian) yang bertentangan dengan Syariat Islam.";

// ---------------------------- Portofolio Project ---------------------------

export type PortfolioTag = "Bangunan Baru" | "Renovasi Bangunan" | "Titip & Menjualkan";
export type PortfolioCategory = "Interior" | "Eksterior";

export type PortfolioProject = {
  id: string;
  title: string;
  categories: PortfolioCategory[]; // bisa isi 1 atau lebih, mis. ["Interior", "Eksterior"]
  tag: PortfolioTag;
  location: string;
  year: string;
  images: string[];
  description: string;
};

export const portfolioProjects: PortfolioProject[] = [
  {
    id: "1",
    title: "Renovasi Gedung Sarwaguna dan Perubahan Nama Menjadi Erhanesia Convention Center",
    categories: ["Interior", "Eksterior"],
    tag: "Renovasi Bangunan",
    location: "Purbalingga, Jawa Tengah",
    year: "2025",
    images: [
      "/images/portfolio/erhanesia-1.png",
      "/images/portfolio/erhanesia-2.png",
      "/images/portfolio/erhanesia-3.png",
      "/images/portfolio/erhanesia-4.png",
      "/images/portfolio/erhanesia-5.png",
      "/images/portfolio/erhanesia-6.png",
      "/images/portfolio/erhanesia-7.png",
      "/images/portfolio/erhanesia-8.png",
      "/images/portfolio/erhanesia-9.png",
    ],
    description: "Proyek Besar Renovasi Fasad & Interior Gedung Sarwaguna dan Perubahan Nama Menjadi Erhanesia Convention Center. Dengan desain Fasad serta Arsitektur Interior dan Eksterior yang Modern dan Minimalis.",
  },
  {
    id: "2",
    title: "Pemasangan Plafon dan Pembuatan Backdrop Panggung Aula Gedung Kesenian SMK Muhammadiyah Bobotsari",
    categories: ["Interior"],
    tag: "Renovasi Bangunan",
    location: "Bobotsari, Purbalingga, Jawa Tengah",
    year: "2025",
    images: [
      "/images/portfolio/smkmuh-1.jpg",
      "/images/portfolio/smkmuh-2.jpg",
      "/images/portfolio/smkmuh-3.jpg",
      "/images/portfolio/smkmuh-4.jpg",
      "/images/portfolio/smkmuh-5.jpg",
      "/images/portfolio/smkmuh-6.jpg",
      "/images/portfolio/smkmuh-7.jpg",
      "/images/portfolio/smkmuh-8.jpg",
      "/images/portfolio/smkmuh-9.jpg",
      "/images/portfolio/smkmuh-10.jpg",
    ],
    description: "Pasang plafon dan buat backdrop panggung aula gedung kesenian SMK Muhammadiyah Bobotsari. Dikerjakan dengan desain interior yang modern dan minimalis, menggunakan material berkualitas untuk daya tahan yang optimal.",
  },
  {
    id: "3",
    title: "Renovasi Interior Rumah Tinggal Mba Mita di Purwokerto",
    categories: ["Interior"],
    tag: "Renovasi Bangunan",
    location: "Banyumas, Jawa Tengah",
    year: "2026",
    images: [
      "/images/portfolio/mita-01.jpg",
      "/images/portfolio/mita-02.jpg",
      "/images/portfolio/mita-03.jpg",
      "/images/portfolio/mita-04.jpg",
      "/images/portfolio/mita-05.jpg",
      "/images/portfolio/mita-06.jpg",
      "/images/portfolio/mita-07.jpg",
      "/images/portfolio/mita-08.jpg",
      "/images/portfolio/mita-09.jpg",
      "/images/portfolio/mita-10.jpg",
    ],
    description: "Penataan ulang ruang keluarga, penambahan ruang di lantai 2 dan perbaikan dapur dengan konsep hangat dan fungsional. Mengutamakan pencahayaan alami dan ventilasi yang baik untuk menciptakan suasana nyaman di rumah tinggal Mba Mita.",
  },
  {
    id: "4",
    title: "Renovasi Fasad dan Pembuatan Dapur Rumah Mba Heppy di Purbalingga",
    categories: ["Interior"],
    tag: "Renovasi Bangunan",
    location: "Purbalingga, Jawa Tengah",
    year: "2026",
    images: [
      "/images/portfolio/hepi-01.png",
      "/images/portfolio/hepi-02.png",
      "/images/portfolio/hepi-03.png",
      "/images/portfolio/hepi-04.png",
      "/images/portfolio/hepi-05.png",
      "/images/portfolio/hepi-06.png",
      "/images/portfolio/hepi-07.png",
      "/images/portfolio/hepi-08.png",
      "/images/portfolio/hepi-09.png",
      "/images/portfolio/hepi-10.png",
    ],
    description: "Renovasi fasad rumah dan pembuatan dapur baru dengan desain modern minimalis. Proyek ini mencakup perbaikan struktur fasad, pemilihan material berkualitas, serta penataan interior dapur yang ergonomis dan estetis.",
  },
  {
    id: "5",
    title: "Renovasi Eksterior & Interior - Penambahan Ruang Tamu dan Dapur Rumah Mba Rina di Perum. Griya Kalika Purbalingga",
    categories: ["Eksterior", "Interior"],
    tag: "Renovasi Bangunan",
    location: "Purbalingga, Jawa Tengah",
    year: "2026",
    images: [
      "/images/portfolio/kalika-01.jpg",
      "/images/portfolio/kalika-02.jpg",
      "/images/portfolio/kalika-03.jpg",
      "/images/portfolio/kalika-04.jpg",
      "/images/portfolio/kalika-05.jpg",
      "/images/portfolio/kalika-06.jpg",
    ],
    description: "Proyek renovasi eksterior & interior - penambahan ruang tamu dan dapur rumah Mba Rina di Perum. Griya Kalika Purbalingga, dengan konsep desain yang harmonis dan fungsional.",
  },
  {
    id: "6",
    title: "Pembangunan Toko ATK & Foto Copy di Purbalingga",
    categories: ["Interior", "Eksterior"],
    tag: "Bangunan Baru",
    location: "Purbalingga, Jawa Tengah",
    year: "2024",
    images: [
      "/images/portfolio/gemuruh-01.jpg",
      "/images/portfolio/gemuruh-02.jpg",
      "/images/portfolio/gemuruh-03.jpg",
      "/images/portfolio/gemuruh-04.jpg",
      "/images/portfolio/gemuruh-05.jpg",
      "/images/portfolio/gemuruh-06.jpg",
      "/images/portfolio/gemuruh-07.jpg",
      "/images/portfolio/gemuruh-08.jpg",
      "/images/portfolio/gemuruh-09.jpg",
      "/images/portfolio/gemuruh-10.jpg",
    ],
    description: "Pembangunan toko ATK & Foto Copy di Purbalingga dengan desain modern dan fungsional. Proyek ini mencakup perencanaan struktur, eksterior, dan interior yang sesuai dengan kebutuhan bisnis.",
  },
];

// ---------------------------- Review & Testimoni ----------------------------

export type Testimonial = {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  message: string;
};

export const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Bapak Arif Rahman",
    rating: 5,
    message:
      "Akadnya jelas di awal, tidak ada biaya siluman. Proses renovasi transparan dan hasilnya rapi sesuai budget.",
  },
  {
    id: "2",
    name: "Ibu Sri Wahyuni",
    rating: 5,
    message:
      "Tanah warisan keluarga akhirnya laku terjual lewat akad salam Dzaroza Property. Prosesnya amanah dan didampingi sampai tuntas.",
  },
  {
    id: "3",
    name: "Bapak Doni Prasetyo",
    rating: 4,
    message:
      "Tim manajerialnya komunikatif dan detail dalam pengawasan lapangan. Sangat membantu karena saya tidak bisa selalu di lokasi.",
  },
  {
    id: "4",
    name: "Ibu Maya Kartika",
    rating: 5,
    message:
      "Materi E-Class-nya aplikatif, langsung saya pakai untuk mengelola renovasi rumah kos milik saya sendiri.",
  },
];

// ------------------------------ Company Profile ------------------------------

export const companyProfile = {
  name: "Dzaroza Property",
  founded: "2019",
  address: "Perum. Permata Regency Blok D No. 03 RT 003 RW 001, Klapasawit, Kalimanah, Purbalingga, Jawa Tengah, Indonesia",
  mapEmbedUrl:
    "https://www.google.com/maps?q=Perum.+Permata+Regency+Blok+D+No.+03+Klapasawit+Kalimanah+Purbalingga+Jawa+Tengah&output=embed<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3956.5468591382128!2d109.33832677172187!3d-7.404560256546188!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e6559bb29e44e47%3A0x80ec89f17e338b0a!2sMitra%20Berlian%20Sejahtera!5e0!3m2!1sid!2sid!4v1789610587696!5m2!1sid!2sid" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>",
  history:
    "Dzaroza Property berawal dari kegelisahan atas minimnya jasa pengelolaan proyek properti yang transparan dan amanah di kalangan pemilik rumah dan tanah. Sejak 2019, kami tumbuh dari layanan renovasi skala kecil menjadi mitra managerial property tepercaya di wilayah Jawa Tengah, dengan akad yang jelas sejak awal dan bebas dari gharar.",
  vision:
    "Menjadi mitra property terpercaya yang menghadirkan pengelolaan proyek transparan, kokoh, dan sesuai prinsip syariat Islam bagi setiap klien.",
  mission: [
    "Memberikan jasa managerial property dengan akad cost and fee yang jelas.",
    "Menjalankan skema akad salam yang adil bagi pemilik dan calon pembeli.",
    "Meningkatkan literasi property syar'i lewat produk edukasi (E-Book & E-Class).",
    "Menjaga kualitas dan kejujuran (amanah) di setiap tahap pengerjaan proyek.",
  ],
  values: [
    { title: "Amanah", desc: "Memegang teguh kepercayaan klien dalam setiap akad dan laporan biaya." },
    { title: "Transparan", desc: "Rincian cost and fee terbuka, tanpa gharar atau biaya tersembunyi." },
    { title: "Profesional", desc: "Standar kerja rapi, terukur, dan tepat waktu di setiap proyek." },
    { title: "Kokoh", desc: "Konstruksi dan hasil kerja yang dibangun untuk bertahan lama." },
  ],
};

// ------------------------------ FAQ Page ------------------------------

export type FAQItem = { question: string; answer: string };

export const faqs: FAQItem[] = [
  {
    question: "Apa itu akad Cost and Fee 10% di Dzaroza Property?",
    answer:
      "Skema akad untuk jasa membangun dan renovasi bangunan (interior maupun eksterior), di mana Dzaroza Property mengelola seluruh biaya proyek (cost) secara transparan, dan mengenakan fee tetap sebesar 10% dari total biaya — dilaporkan secara berkala kepada pemilik proyek.",
  },
  {
    question: "Apa itu akad Salam untuk titip-jual tanah/bangunan?",
    answer:
      "Skema di mana harga dan spesifikasi disepakati bersama di awal sebelum proses pemasaran dimulai, sehingga tidak ada ketidakjelasan (gharar) antara pemilik dan calon pembeli selama proses berlangsung.",
  },
  {
    question: "Bagaimana cara pembayaran produk digital (E-Book/E-Class)?",
    answer:
      "Pembayaran diproses langsung lewat Payment Gateway (Midtrans) yang mendukung kartu debit/kredit, transfer bank, dan e-wallet. Klik tombol beli pada produk untuk memulai proses pembayaran.",
  },
  {
    question: "Apakah bisa konsultasi dulu sebelum memesan layanan?",
    answer:
      "Bisa. Hubungi salah satu tim kami langsung lewat WhatsApp — tersedia tombol konsultasi di setiap kategori layanan maupun tombol WhatsApp mengambang di pojok kanan bawah situs.",
  },
  {
    question: "Di mana lokasi operasional Dzaroza Property?",
    answer: "Purbalingga, Jawa Tengah, Indonesia — melayani proyek di wilayah sekitar Jawa Tengah.",
  },
  {
    question: "Sejak kapan Dzaroza Property beroperasi?",
    answer:
      "Sejak 2019, dengan prinsip akad yang jelas sejak awal, transparan, dan amanah dalam setiap proyek.",
  },
];