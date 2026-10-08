// lib/orderForm.ts — konfigurasi field form "Order Layanan Jasa" per kategori
// (Kategori A-D di section Layanan). File ini murni data (tanpa dependency
// server-only), jadi aman diimpor baik oleh komponen client (OrderForm)
// maupun route handler (app/api/order) untuk validasi di sisi server.

export type OrderFieldType = "text" | "textarea" | "select";

export type OrderField = {
  name: string;
  label: string;
  type: OrderFieldType;
  placeholder?: string;
  options?: string[]; // khusus type "select"
  required: boolean;
};

// key = Service.id pada lib/data.ts — satu set field relevan per kategori,
// supaya calon klien hanya mengisi info yang benar-benar dibutuhkan untuk
// jenis layanan yang dipilih.
export const orderFormFields: Record<string, OrderField[]> = {
  "bangun-baru": [
    {
      name: "lokasi",
      label: "Lokasi / Alamat Tanah",
      type: "text",
      placeholder: "Contoh: Jl. Raya Purbalingga No. 10, Kutasari",
      required: true,
    },
    {
      name: "luasTanah",
      label: "Luas Tanah (m²)",
      type: "text",
      placeholder: "Contoh: 150",
      required: true,
    },
    {
      name: "luasBangunan",
      label: "Luas Bangunan yang Diinginkan (m²)",
      type: "text",
      placeholder: "Contoh: 100",
      required: true,
    },
    {
      name: "jumlahLantai",
      label: "Jumlah Lantai",
      type: "select",
      options: ["1 Lantai", "2 Lantai", "3 Lantai atau lebih"],
      required: true,
    },
    {
      name: "jumlahKamar",
      label: "Jumlah Kamar Tidur & Kamar Mandi",
      type: "text",
      placeholder: "Contoh: 3 KT, 2 KM",
      required: true,
    },
    {
      name: "budget",
      label: "Estimasi Budget Pembangunan",
      type: "text",
      placeholder: "Contoh: Rp 300.000.000 - 400.000.000",
      required: true,
    },
    {
      name: "targetMulai",
      label: "Target Mulai Pembangunan",
      type: "text",
      placeholder: "Contoh: Januari 2027 / 3 bulan lagi",
      required: false,
    },
    {
      name: "catatan",
      label: "Kebutuhan / Catatan Tambahan",
      type: "textarea",
      placeholder: "Gaya rumah, carport, taman, dsb.",
      required: false,
    },
  ],
  renovasi: [
    {
      name: "lokasi",
      label: "Alamat Bangunan yang Direnovasi",
      type: "text",
      placeholder: "Alamat lengkap bangunan",
      required: true,
    },
    {
      name: "jenisRenovasi",
      label: "Jenis Renovasi",
      type: "select",
      options: ["Interior", "Eksterior", "Interior & Eksterior"],
      required: true,
    },
    {
      name: "bagianDirenovasi",
      label: "Bagian yang Ingin Direnovasi",
      type: "text",
      placeholder: "Contoh: dapur, kamar mandi, atap",
      required: true,
    },
    {
      name: "luasRenovasi",
      label: "Perkiraan Luas Area Renovasi (m²)",
      type: "text",
      placeholder: "Contoh: 40",
      required: true,
    },
    {
      name: "kondisiSaatIni",
      label: "Kondisi Bangunan Saat Ini",
      type: "textarea",
      placeholder: "Jelaskan kondisi & masalah yang ingin diperbaiki",
      required: false,
    },
    {
      name: "budget",
      label: "Estimasi Budget Renovasi",
      type: "text",
      placeholder: "Contoh: Rp 50.000.000 - 80.000.000",
      required: true,
    },
    {
      name: "targetMulai",
      label: "Target Mulai Renovasi",
      type: "text",
      placeholder: "Contoh: Bulan depan",
      required: false,
    },
  ],
  "titip-jual": [
    {
      name: "jenisProperti",
      label: "Jenis Properti",
      type: "select",
      options: ["Tanah Kosong", "Bangunan / Rumah", "Tanah & Bangunan"],
      required: true,
    },
    {
      name: "lokasi",
      label: "Lokasi Properti",
      type: "text",
      placeholder: "Alamat lengkap properti",
      required: true,
    },
    {
      name: "luasTanah",
      label: "Luas Tanah (m²)",
      type: "text",
      placeholder: "Contoh: 200",
      required: true,
    },
    {
      name: "luasBangunan",
      label: "Luas Bangunan (m²) — jika ada",
      type: "text",
      placeholder: "Contoh: 80",
      required: false,
    },
    {
      name: "legalitas",
      label: "Status Legalitas",
      type: "select",
      options: ["SHM", "HGB", "Girik / Letter C", "Lainnya"],
      required: true,
    },
    {
      name: "hargaJual",
      label: "Harga Jual yang Diinginkan",
      type: "text",
      placeholder: "Contoh: Rp 500.000.000",
      required: true,
    },
    {
      name: "catatan",
      label: "Catatan Tambahan",
      type: "textarea",
      placeholder: "Alasan menjual, batas waktu penjualan, dll.",
      required: false,
    },
  ],
  "paket-all-in": [
    {
      name: "lokasi",
      label: "Lokasi / Alamat Tanah",
      type: "text",
      placeholder: "Contoh: Jl. Raya Purbalingga No. 10, Kutasari",
      required: true,
    },
    {
      name: "luasTanah",
      label: "Luas Tanah (m²)",
      type: "text",
      placeholder: "Contoh: 150",
      required: true,
    },
    {
      name: "luasBangunan",
      label: "Luas Bangunan yang Diinginkan (m²)",
      type: "text",
      placeholder: "Contoh: 100",
      required: true,
    },
    {
      name: "jumlahLantai",
      label: "Jumlah Lantai",
      type: "select",
      options: ["1 Lantai", "2 Lantai", "3 Lantai atau lebih"],
      required: true,
    },
    {
      name: "jumlahKamar",
      label: "Jumlah Kamar Tidur & Kamar Mandi",
      type: "text",
      placeholder: "Contoh: 3 KT, 2 KM",
      required: true,
    },
    {
      name: "spesifikasi",
      label: "Tingkat Spesifikasi Bangunan",
      type: "select",
      options: ["Standar", "Menengah", "Premium"],
      required: true,
    },
    {
      name: "budget",
      label: "Range Harga Total yang Diinginkan",
      type: "text",
      placeholder: "Contoh: Rp 350.000.000 - 450.000.000",
      required: true,
    },
    {
      name: "targetMulai",
      label: "Target Mulai Pembangunan",
      type: "text",
      placeholder: "Contoh: Kuartal 1 2027",
      required: false,
    },
  ],
};