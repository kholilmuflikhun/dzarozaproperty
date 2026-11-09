import type { Metadata } from "next";
import { contactEmail, primaryWhatsApp } from "@/lib/data";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Dzaroza Property",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="section-pad bg-white">
      <div className="container-content max-w-3xl">
        <h1 className="text-3xl font-bold text-charcoal-950">Kebijakan Privasi</h1>
        <p className="mt-2 text-sm text-charcoal-400">Terakhir diperbarui: Selasa, 25 Agustus 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-charcoal-700">
          <section>
            <h2 className="text-lg font-bold text-charcoal-950 mb-2">1. Identitas Usaha</h2>
            <p>
              Dzaroza Property adalah Usaha Perseorangan yang memiliki 4 Tim dan Relasi Tukang yang berkompeten, berpengalaman, profesional dan amanah.
              Beralamat di Perum. Permata Regency Blok D No. 03 RT 003 RW 001, Klapasawit, Kalimanah, Purbalingga, Jawa Tengah, Indonesia.
              {/* Kalau sudah punya NIB/legalitas resmi, tambahkan di sini, mis.: */}
              {/* , terdaftar dengan Nomor Induk Berusaha (NIB) [ISI NOMOR NIB DI SINI]. */}
              . Untuk pertanyaan terkait kebijakan ini, hubungi kami di WhatsApp:{" "}
              <a
                href={`https://wa.me/${primaryWhatsApp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-700 hover:underline"
              >
                +{primaryWhatsApp}
              </a>{" "}
              atau email:{" "}
              <a href={`mailto:${contactEmail}`} className="text-orange-700 hover:underline">
                {contactEmail}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-charcoal-950 mb-2">2. Data yang Kami Kumpulkan</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Lewat Login with Google</strong> (form testimoni): nama, alamat email, dan
                foto profil Google Anda — hanya diambil sebatas yang diizinkan Google saat Anda
                menekan tombol login.
              </li>
              <li>
                <strong>Lewat form testimoni:</strong> nama, email, nomor WhatsApp, alamat, dan isi
                ulasan yang Anda tulis sendiri.
              </li>
              <li>
                <strong>Lewat form konsultasi:</strong> nama, nomor WhatsApp, dan pesan yang Anda
                kirim.
              </li>
              <li>
                <strong>Lewat pembayaran produk digital:</strong> data transaksi diproses oleh
                Midtrans (pihak ketiga penyedia payment gateway) sesuai kebijakan privasi mereka
                sendiri — Dzaroza Property tidak menyimpan data kartu/rekening Anda.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-charcoal-950 mb-2">3. Penggunaan Data</h2>
            <p>Data yang Anda berikan digunakan untuk:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Menampilkan testimoni Anda di halaman Review (setelah ditinjau tim kami).</li>
              <li>Menghubungi Anda kembali terkait konsultasi atau pesanan yang Anda ajukan.</li>
              <li>Memproses pembayaran produk digital yang Anda pesan.</li>
            </ul>
            <p className="mt-2">
              Data yang kami dapat dari anda berupa nama, email, alamat dan nomor WhatsApp bertujuan untuk evaluasi tim internal kami. Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak ketiga mana pun
              untuk tujuan pemasaran ataupun untuk tujuan yang melawan hukum negara yang berlaku.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-charcoal-950 mb-2">4. Keamanan Data</h2>
            <p>
              Kami menerapkan langkah keamanan teknis standar (koneksi HTTPS terenkripsi) untuk
              melindungi data Anda selama transmisi. Namun, tidak ada sistem yang 100% bebas
              risiko — Kami terus akan selalu berusah meningkatkan langkah-langkah keamanan kami dengan
              mengikuti perkembangan teknologi dan regulasi yang berlaku.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-charcoal-950 mb-2">5. Hak Anda</h2>
            <p>
              Anda berhak meminta kami menghapus data testimoni/kontak Anda dari sistem kami kapan
              saja dengan menghubungi email di atas.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}