<script>
  import { supabase } from './supabase.js';
  import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, VerticalAlign } from "docx";
  import { saveAs } from "file-saver";
  import AuthAdmin from './AuthAdmin.svelte'; // 👈 IMPORT KOMPONEN MODAL
  
  export let switchView;

  // ==========================
  // STATE & VARIABEL UTAMA
  // ==========================
  let form = {
    sasaran: "", lokasi: "", lokasiLainnya: "", kategori: "",
    waktuKejadian: "", kronologi: "", tindakan: "",
    namaPasien: "", namaPetugas: "", namaPelapor: ""
  };
  
  let isSending = false;
  let isDownloadingArsip = false;
  let isPurging = false;
  let showPurgeModal = false; // Trigger untuk membuka modal AuthAdmin

  const daftarLokasi = [ "Lab", "Apotek", "Klaster 2", "Klaster 3", "Klaster 4", "Pendaftaran", "Skrining", "Skrining visual", "RGD", "Rawat inap", "R. Kesehatan gigi", "Kesling", "R. UKM", "Dapur", "R. Vaksin", "Gudang", "Parkiran", "Lain-lain" ];
  const daftarKategori = [ "A. Salah identifikasi pasien", "B. Pasien jatuh", "C. Salah pemberian obat / berkaitan dengan obat", "D. Infeksi nosokomial", "E. Salah dalam prosedur pembedahan", "F. Salah pemberian terapi karena komunikasi tidak efektif", "TIDAK ADA DALAM KATEGORI DI ATAS" ];

  function handleSasaranChange() { if (form.sasaran === 'Petugas') form.kategori = ""; }

  function tentukanJenisInsiden() {
    if (form.sasaran === 'Petugas') return "K3";
    if (form.sasaran === 'Pasien') return (form.kategori && form.kategori !== "TIDAK ADA DALAM KATEGORI DI ATAS") ? "Keselamatan Pasien" : "Manajemen Risiko";
    return "-";
  }

  const spasiAman = new Paragraph({ children: [new TextRun("")] });

  // ==========================
  // FUNGSI DOCX (TETAP SAMA)
  // ==========================
  async function buatDokumenWord() {
    let waktuRapi = "-";
    if (form.waktuKejadian) {
      const dateObj = new Date(form.waktuKejadian);
      waktuRapi = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    }
    const jenisLaporan = tentukanJenisInsiden();
    let logoCell;
    try {
      const response = await fetch('/logo-kab.png');
      if (!response.ok) throw new Error("Logo tidak ditemukan");
      const blobLogo = await response.blob();
      const arrayBuffer = await blobLogo.arrayBuffer();
      const logoUint8 = new Uint8Array(arrayBuffer); 
      logoCell = new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logoUint8, transformation: { width: 75, height: 95 } })] }) ] });
    } catch (error) {
      logoCell = new TableCell({ width: { size: 1, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [spasiAman] });
    }
    const textCell = new TableCell({ width: { size: 85, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PEMERINTAH KABUPATEN MALANG", bold: true, size: 28 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DINAS KESEHATAN", bold: true, size: 28 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UPT PUSKESMAS PONCOKUSUMO", bold: true, size: 32 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Jalan Kusnan Marzuki No. 101, Wonomulyo, Kabupaten Malang, Jawa Timur", size: 20 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Telpon/ Faksimile (0341) 2319509 Laman : puskesmasponcokusumo.malangkab.go.id", size: 20 })] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Pos-el: pkmponcokusumo@gmail.com, Kode Pos : 65157", size: 20 })] }), ] });
    const ttdTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [ new TableRow({ children: [ new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [spasiAman] }), new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [ new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Poncokusumo, __________________")] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Pelapor,")] }), spasiAman, spasiAman, spasiAman, new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `(${form.namaPelapor || "-"})`, bold: true, underline: {} })] }), ] }) ] }) ] });
    const kronologiAman = form.kronologi ? String(form.kronologi).split('\n') : ["-"];
    const tindakanAman = form.tindakan ? String(form.tindakan).split('\n') : ["-"];
    const doc = new Document({ creator: "SATSET", title: "Laporan Insiden", description: "Arsip Digital", sections: [{ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children: [ new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [ new TableRow({ children: [logoCell, textCell] }) ] }), spasiAman, new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "LAPORAN INSIDEN (K3 / KP / MANRISK)", bold: true, size: 28, underline: {} })] }), spasiAman, new Paragraph({ children: [new TextRun({ text: "1. Data Pelapor & Waktu", bold: true, size: 24 })] }), new Paragraph({ children: [new TextRun(`    • Nama Pelapor: ${form.namaPelapor || "-"}`)] }), new Paragraph({ children: [new TextRun(`    • Waktu Kejadian: ${waktuRapi}`)] }), new Paragraph({ children: [new TextRun(`    • Lokasi: ${form.lokasi || "-"}`)] }), spasiAman, new Paragraph({ children: [new TextRun({ text: "2. Data Insiden", bold: true, size: 24 })] }), new Paragraph({ children: [new TextRun(`    • Sasaran: ${form.sasaran || "-"}`)] }), new Paragraph({ children: [new TextRun(`    • Klasifikasi: Insiden ${jenisLaporan}`)] }), new Paragraph({ children: [new TextRun(`    • Nama Pasien: ${form.sasaran === 'Pasien' ? (form.namaPasien || '-') : '-'}`)] }), new Paragraph({ children: [new TextRun(`    • Nama Petugas: ${form.namaPetugas || '-'}`)] }), new Paragraph({ children: [new TextRun(`    • Rincian Kategori: ${form.kategori || "-"}`)] }), spasiAman, new Paragraph({ children: [new TextRun({ text: "3. Kronologi Kejadian", bold: true, size: 24 })] }), ...kronologiAman.map(baris => new Paragraph({ children: [new TextRun(`    ${baris}`)] })), spasiAman, new Paragraph({ children: [new TextRun({ text: "4. Tindakan yang Dilakukan", bold: true, size: 24 })] }), ...tindakanAman.map(baris => new Paragraph({ children: [new TextRun(`    ${baris}`)] })), spasiAman, ttdTable ], }], });
    const b64 = await Packer.toBase64String(doc); const byteCharacters = atob(b64); const byteNumbers = new Array(byteCharacters.length); for (let i = 0; i < byteCharacters.length; i++) { byteNumbers[i] = byteCharacters.charCodeAt(i); } const byteArray = new Uint8Array(byteNumbers); return new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  async function cetakWord() {
    if (!form.namaPelapor) return alert("⚠️ Isi form (Minimal Nama Pelapor) dulu!");
    try { const blobWord = await buatDokumenWord(); saveAs(blobWord, `Laporan_Insiden_${form.namaPelapor.replace(/[^a-zA-Z0-9]/g, '_')}.docx`); } catch (err) { alert("❌ Gagal mencetak:\n" + err.message); }
  }

  // ==========================
  // FUNGSI SIMPAN KE SUPABASE & KIRIM WA (TETAP SAMA)
  // ==========================
  async function kirimLaporan() {
    if (!form.sasaran || !form.lokasi || !form.kronologi || !form.waktuKejadian || !form.tindakan || !form.namaPelapor) return alert("Mohon lengkapi semua data wajib!");
    isSending = true;
    const lokasiFinal = form.lokasi === 'Lain-lain' ? form.lokasiLainnya : form.lokasi;
    const jenisLaporan = tentukanJenisInsiden();
    let jenisSingkat = jenisLaporan === "Keselamatan Pasien" ? "KP" : (jenisLaporan === "Manajemen Risiko" ? "MANRISK" : jenisLaporan);
    const dateObj = new Date(form.waktuKejadian); const waktuRapi = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    try {
      const { error } = await supabase.from('insiden_k3').insert([{ sasaran: form.sasaran, lokasi: lokasiFinal, kategori: form.kategori || "-", waktu_kejadian: form.waktuKejadian.replace("T", " "), kronologi: form.kronologi, tindakan: form.tindakan, nama_pasien: form.namaPasien || "-", nama_petugas: form.namaPetugas || "-", nama_pelapor: form.namaPelapor, jenis_insiden: jenisLaporan }]);
      if (error) throw new Error(error.message);

      let pesanWA = `🚨 *LAPORAN INSIDEN ${jenisSingkat}* 🚨\n━━━━━━━━━━━━━━━━━━━━\n👤 *Pelapor:* ${form.namaPelapor}\n📍 *Lokasi:* ${lokasiFinal}\n⏰ *Waktu:* ${waktuRapi}\n\n`;
      if (form.sasaran === "Pasien") pesanWA += `⚠️ *Insiden PASIEN*\n• Nama Pasien: ${form.namaPasien || "-"}\n• Nama Petugas: ${form.namaPetugas || "-"}\n• Insiden: ${form.kategori}\n\n`; else pesanWA += `🚑 *Insiden Petugas*\n• Nama Petugas: ${form.namaPetugas || "-"}\n\n`;
      pesanWA += `📝 *Kronologi:*\n${form.kronologi}\n\n🛡️ *Tindakan:*\n${form.tindakan}\n━━━━━━━━━━━━━━━━━━━━\nlink download laporan: https://satsetponcokusumo.my.id/`;

      const formDataTeks = new FormData(); formDataTeks.append("target", "120363425742206740@g.us"); formDataTeks.append("message", pesanWA);
      const responseWA = await fetch("https://api.fonnte.com/send", { method: "POST", headers: { "Authorization": "AmenKaTT5udS3ynWZ7DU" }, body: formDataTeks });
      const resultWA = await responseWA.json(); if (resultWA.status === false) throw new Error("Server WA menolak: " + resultWA.reason);

      const blobWord = await buatDokumenWord(); saveAs(blobWord, `Laporan_${jenisLaporan.replace(/\s+/g, '_')}_${form.namaPelapor.replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
      alert("✅ BERHASIL!\nData tersimpan, Notifikasi WA terkirim, dan File Word otomatis terunduh.");
      form = { sasaran: "", lokasi: "", lokasiLainnya: "", kategori: "", waktuKejadian: "", kronologi: "", tindakan: "", namaPasien: "", namaPetugas: "", namaPelapor: "" }; switchView('dashboard');
    } catch (err) { alert("❌ Kesalahan:\n" + err.message); } finally { isSending = false; }
  }

  // ==========================
  // FITUR ARSIP & PEMBERSIHAN 
  // ==========================
  
  // LANGKAH 1: Download Arsip PDF
// LANGKAH 1: Download Arsip PDF (DENGAN KRONOLOGI)
  async function unduhArsipTahunan() {
    isDownloadingArsip = true;
    try {
      const { data, error } = await supabase.from('insiden_k3').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return alert("Database masih kosong. Tidak ada data untuk diunduh.");

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape'); 
      doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("ARSIP REKAPITULASI LAPORAN INSIDEN", 14, 15);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("UPT PUSKESMAS PONCOKUSUMO", 14, 21); doc.text("Diekspor pada: " + new Date().toLocaleString('id-ID'), 14, 27);

      // KOLOM BARU: Menambahkan Kronologi & Tindakan
      const tableColumn = ["Waktu Kejadian", "Jenis / Kategori", "Lokasi", "Pelapor", "Pasien/Petugas Terkait", "Kronologi & Tindakan"];
      
      const tableRows = data.map(item => {
        const waktuRapi = new Date(item.waktu_kejadian).toLocaleString('id-ID');
        const jenisKategori = `${item.jenis_insiden || "-"}\n(${item.kategori || "-"})`;
        const orangTerkait = item.sasaran === 'Pasien' ? item.nama_pasien : item.nama_petugas || "-";
        
        // Menggabungkan Kronologi & Tindakan dalam satu sel dengan pembatas baris
        const kronologiTindakan = `KRONOLOGI:\n${item.kronologi || "-"}\n\nTINDAKAN:\n${item.tindakan || "-"}`;

        return [
          waktuRapi, 
          jenisKategori, 
          item.lokasi || "-", 
          item.nama_pelapor || "-", 
          orangTerkait,
          kronologiTindakan
        ];
      });

      doc.autoTable({ 
        head: [tableColumn], 
        body: tableRows, 
        startY: 32, 
        theme: 'grid', 
        styles: { 
          fontSize: 8, 
          cellPadding: 3,
          valign: 'middle' // Teks berada di tengah (vertikal)
        }, 
        columnStyles: {
          // Mengatur lebar kolom agar Kronologi mendapat porsi paling besar
          0: { cellWidth: 25 }, // Waktu
          1: { cellWidth: 35 }, // Jenis/Kategori
          2: { cellWidth: 25 }, // Lokasi
          3: { cellWidth: 25 }, // Pelapor
          4: { cellWidth: 30 }, // Pasien/Petugas
          5: { cellWidth: 'auto' } // Kronologi mengambil sisa ruang kertas (membungkus teks otomatis)
        },
        headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' }, 
        alternateRowStyles: { fillColor: [250, 245, 245] } 
      });
      
      const tahunIni = new Date().getFullYear();
      doc.save(`Arsip_Insiden_K3_${tahunIni}.pdf`);
      alert("✅ Arsip PDF (Lengkap dengan Kronologi) berhasil diunduh! Jika data sudah aman, Anda boleh mengosongkan database.");
    } catch (err) { 
      alert("❌ Gagal mengunduh arsip: " + err.message); 
    } finally { 
      isDownloadingArsip = false; 
    }
  }
  
  // LANGKAH 2: Ini fungsi rahasia yang dikirim ke Komponen AuthAdmin
  async function jalankanPenghapusanDB() {
    isPurging = true;
    try {
      const { error: delErr } = await supabase.from('insiden_k3').delete().neq('id', 0);
      if (delErr) throw delErr;
      alert("🔥 EKSEKUSI BERHASIL!\nDatabase riwayat Insiden telah dihapus permanen dan bersih untuk tahun baru.");
    } catch (err) {
      alert("Gagal menghapus database: " + err.message);
    } finally {
      isPurging = false;
    }
  }

</script>

<AuthAdmin 
  bind:showModal={showPurgeModal} 
  onSuccess={jalankanPenghapusanDB} 
  judulAksi="Tutup Buku Tahunan"
  pesanPeringatan="Tindakan ini akan menghapus <b class='text-red-600'>SELURUH</b> riwayat Insiden secara permanen. Masukkan kredensial Administrator untuk melanjutkan."
  hanyaAdmin={true} 
/>

<div class="animate-fade-in bg-slate-50 min-h-screen pt-6 pb-20 px-4">
  <div class="max-w-3xl mx-auto mb-6 flex justify-between items-center">
    <button on:click={() => switchView('dashboard')} class="text-[#a435f0] font-bold text-sm flex items-center hover:underline cursor-pointer transition-colors">
      <span class="material-icons text-sm mr-1">arrow_back</span> Kembali ke Dashboard
    </button>
    <div class="text-xs font-bold text-slate-400">SATSET Poncokusumo</div>
  </div>

  <div class="bg-white max-w-3xl mx-auto rounded-2xl shadow-xl border-t-8 border-red-600 p-6 md:p-10 relative">
    
    {#if isSending}
      <div class="absolute inset-0 bg-white/90 z-50 flex flex-col justify-center items-center backdrop-blur-sm rounded-xl">
        <span class="material-icons animate-spin text-5xl text-red-600">sync</span><h3 class="text-red-700 font-bold mt-4 animate-pulse text-lg">Mengirim...</h3>
      </div>
    {/if}

    <div class="relative text-center mb-10">
      <button on:click={() => switchView('riwayat')} class="absolute top-0 right-0 bg-slate-800 text-white hover:bg-black font-bold text-xs px-4 py-2 rounded-lg flex items-center transition-all shadow-md cursor-pointer z-10"><span class="material-icons text-sm mr-1">history</span> Riwayat</button>
      <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-full mb-4 shadow-inner mt-4 md:mt-0"><span class="material-icons text-3xl">warning_amber</span></div>
      <h2 class="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Pelaporan Insiden</h2>
      <p class="text-red-600 mt-2 font-bold bg-red-50 inline-block px-4 py-1 rounded-full text-sm">Tim K3, MANRISK & Keselamatan Pasien</p>
    </div>

    <div class="space-y-8">
      <div class="p-5 bg-white border-2 border-red-100 rounded-xl shadow-sm">
        <div class="block text-base font-black text-red-800 mb-4 flex items-center"><span class="bg-red-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs mr-2">1</span> Siapakah yang terkena insiden?</div>
        <div class="flex flex-col sm:flex-row gap-4">
          <label class="flex-1 flex items-center gap-3 cursor-pointer bg-slate-50 hover:bg-red-50 px-5 py-4 border border-slate-200 hover:border-red-300 rounded-xl transition-all"><input type="radio" bind:group={form.sasaran} value="Pasien" on:change={handleSasaranChange} class="w-5 h-5 accent-red-600"><span class="font-bold text-slate-800">Pasien</span></label>
          <label class="flex-1 flex items-center gap-3 cursor-pointer bg-slate-50 hover:bg-blue-50 px-5 py-4 border border-slate-200 hover:border-blue-300 rounded-xl transition-all"><input type="radio" bind:group={form.sasaran} value="Petugas" on:change={handleSasaranChange} class="w-5 h-5 accent-blue-600"><span class="font-bold text-slate-800">Petugas</span></label>
        </div>
      </div>

      <div class="p-5 bg-slate-50 rounded-xl border border-slate-200">
        <div class="block text-sm font-bold text-slate-800 mb-3">Di mana terjadinya insiden?</div>
        <select bind:value={form.lokasi} class="w-full p-3.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-red-500 font-medium">
          <option value="">-- Pilih Lokasi --</option>{#each daftarLokasi as lok}<option value={lok}>{lok}</option>{/each}
        </select>
        {#if form.lokasi === 'Lain-lain'}<div class="mt-3 animate-fade-in"><input type="text" bind:value={form.lokasiLainnya} class="w-full p-3.5 bg-white border border-red-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100" placeholder="Ketik lokasi spesifik..."></div>{/if}
      </div>

      {#if form.sasaran === 'Pasien'}
        <div class="animate-fade-in p-5 border-2 border-orange-100 bg-orange-50/30 rounded-xl shadow-sm">
          <div class="block text-sm font-black text-orange-800 mb-4">Apakah masuk dalam kategori di bawah ini?</div>
          <div class="space-y-2 bg-white p-4 rounded-lg border border-orange-100">
            {#each daftarKategori as kat}<label class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"><input type="radio" bind:group={form.kategori} value={kat} class="w-4 h-4 accent-orange-500"><span class="text-sm font-semibold text-slate-700">{kat}</span></label>{/each}
          </div>
        </div>
      {/if}

      {#if form.sasaran === 'Petugas' || (form.sasaran === 'Pasien' && form.kategori !== '')}
        <div class="animate-fade-in p-6 bg-slate-800 rounded-xl shadow-md text-white space-y-6">
          <div class="block text-base font-black text-white border-b border-slate-700 pb-3">Rincian Kejadian & Tindakan</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="block text-xs font-bold text-slate-300 uppercase mb-2">Kapan Terjadinya?</label><input type="datetime-local" bind:value={form.waktuKejadian} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500"></div>
            <div><label class="block text-xs font-bold text-slate-300 uppercase mb-2">Nama Pelapor</label><input type="text" bind:value={form.namaPelapor} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Nama Pelapor"></div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="block text-xs font-bold text-slate-300 uppercase mb-2">Nama Pasien</label><input type="text" bind:value={form.namaPasien} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Kosongi jika tidak ada"></div>
            <div><label class="block text-xs font-bold text-slate-300 uppercase mb-2">Nama Petugas</label><input type="text" bind:value={form.namaPetugas} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Kosongi jika tidak ada"></div>
          </div>
          <div><label class="block text-xs font-bold text-slate-300 uppercase mb-2">Bagaimana Kronologinya?</label><textarea bind:value={form.kronologi} rows="4" class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Ceritakan detail kejadian..."></textarea></div>
          <div><label class="block text-xs font-bold text-slate-300 uppercase mb-2">Tindakan Apa yang Sudah Dilakukan?</label><textarea bind:value={form.tindakan} rows="3" class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Penanganan awal yang diberikan..."></textarea></div>
        </div>
      {/if}

      <div class="pt-4 flex flex-col sm:flex-row gap-4">
        <button on:click={cetakWord} class="flex-1 bg-white border-2 border-slate-800 hover:bg-slate-100 text-slate-800 font-black text-lg py-4 rounded-xl transition-all flex justify-center items-center"><span class="material-icons mr-2">print</span> CETAK MS WORD</button>
        <button on:click={kirimLaporan} class="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-lg py-4 rounded-xl shadow-[0_10px_20px_rgba(220,38,38,0.3)] transition-all flex justify-center items-center"><span class="material-icons mr-2">send</span> SIMPAN & KIRIM WA</button>
      </div>
    </div>
  </div>

  <div class="max-w-3xl mx-auto mt-8 bg-white border-2 border-slate-200 border-dashed rounded-xl p-6 text-center shadow-sm mb-12">
    <h3 class="font-bold text-slate-800 mb-2">Manajemen Arsip & Ruang Penyimpanan</h3>
    <p class="text-xs text-slate-500 mb-6">Lakukan pengunduhan arsip PDF di akhir periode sebelum mengosongkan database.</p>
    
    <div class="flex flex-col sm:flex-row justify-center gap-4">
      <button on:click={unduhArsipTahunan} disabled={isDownloadingArsip} class="bg-slate-800 hover:bg-black text-white px-6 py-3 rounded-lg font-bold text-sm shadow flex items-center justify-center transition-colors">
        {#if isDownloadingArsip}<span class="material-icons animate-spin text-sm mr-2">sync</span> Mengekspor PDF...{:else}<span class="material-icons text-sm mr-2">picture_as_pdf</span> 1. Unduh Arsip PDF{/if}
      </button>

      <button on:click={() => showPurgeModal = true} class="bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-400 px-6 py-3 rounded-lg font-bold text-sm shadow-sm flex items-center justify-center transition-colors">
        {#if isPurging}
           <span class="material-icons animate-spin text-sm mr-2">sync</span> Menghapus...
        {:else}
           <span class="material-icons text-sm mr-2">delete_sweep</span> 2. Kosongkan Database
        {/if}
      </button>
    </div>
  </div>

</div>

<style>
  .animate-fade-in { animation: fadeIn 0.4s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>