// lib/gdrive.ts
//
// Google Drive TIDAK menyajikan gambar langsung lewat link share biasa
// (https://drive.google.com/file/d/FILE_ID/view?usp=sharing) — link itu
// membuka halaman preview Drive, bukan file gambar mentah. Fungsi ini
// mengubahnya menjadi URL yang benar-benar bisa dipakai sebagai <img src>.
//
// CARA PAKAI:
// 1. Upload foto ke Google Drive.
// 2. Klik kanan file → Share → ubah General access jadi
//    "Anyone with the link" → role "Viewer" → Copy link.
// 3. Ambil FILE_ID dari link tsb (bagian di antara "/d/" dan "/view"), lalu:
//
//      import { driveImageUrl } from "@/lib/gdrive";
//      images: [driveImageUrl("1AbCdEfGhIjKlMnOpQrStUvWxYz")]
//
//    ATAU tempel link share aslinya langsung — fungsi ini otomatis
//    mengekstrak ID-nya:
//
//      images: [driveImageUrl("https://drive.google.com/file/d/1AbC.../view?usp=sharing")]

export function driveImageUrl(fileIdOrLink: string, width = 1200): string {
  const idMatch = fileIdOrLink.match(/\/d\/([^/]+)/) || fileIdOrLink.match(/id=([^&]+)/);
  const fileId = idMatch ? idMatch[1] : fileIdOrLink; // sudah berupa ID polos

  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}
