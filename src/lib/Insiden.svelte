<script>
  import { supabase } from './supabase.js';
  import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, VerticalAlign } from "docx";
  import { saveAs } from "file-saver";
  
  export let switchView;

  let form = {
    sasaran: "", lokasi: "", lokasiLainnya: "", kategori: "",
    waktuKejadian: "", kronologi: "", tindakan: "",
    namaPasien: "", namaPetugas: "", namaPelapor: ""
  };
  
  let isSending = false;

  const daftarLokasi = [
    "Lab", "Apotek", "Klaster 2", "Klaster 3", "Klaster 4",
    "Pendaftaran", "Skrining", "Skrining visual", "RGD",
    "Rawat inap", "R. Kesehatan gigi", "Kesling", "R. UKM",
    "Dapur", "R. Vaksin", "Gudang", "Parkiran", "Lain-lain"
  ];

  const daftarKategori = [
    "A. Salah identifikasi pasien", "B. Pasien jatuh",
    "C. Salah pemberian obat / berkaitan dengan obat", "D. Infeksi nosokomial",
    "E. Salah dalam prosedur pembedahan", "F. Salah pemberian terapi karena komunikasi tidak efektif",
    "TIDAK ADA DALAM KATEGORI DI ATAS"
  ];

  function handleSasaranChange() {
    if (form.sasaran === 'Petugas') form.kategori = "";
  }

  function tentukanJenisInsiden() {
    if (form.sasaran === 'Petugas') return "K3";
    if (form.sasaran === 'Pasien') {
      if (form.kategori && form.kategori !== "TIDAK ADA DALAM KATEGORI DI ATAS") {
        return "Keselamatan Pasien";
      } else {
        return "Manajemen Risiko";
      }
    }
    return "-";
  }

  // ALAT BANTU SPASI AMAN UNTUK MICROSOFT WORD
  const spasiAman = new Paragraph({ children: [new TextRun("")] });

  // ----- FIX "nodebuffer is not supported by this platform" -----
  // Use Packer.toBlob() instead of Packer.toBuffer(). No toBuffer() or Buffer in browser!

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
      // KUNCI PENGAMAN 1: Ubah paksa ke Uint8Array agar browser paham
      const logoUint8 = new Uint8Array(arrayBuffer); 

      logoCell = new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({ data: logoUint8, transformation: { width: 75, height: 95 } })]
          })
        ]
      });
    } catch (error) {
      logoCell = new TableCell({
        width: { size: 1, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [spasiAman]
      });
    }

    const textCell = new TableCell({
      width: { size: 85, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PEMERINTAH KABUPATEN MALANG", bold: true, size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DINAS KESEHATAN", bold: true, size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UPT PUSKESMAS PONCOKUSUMO", bold: true, size: 32 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Jalan Kusnan Marzuki No. 101, Wonomulyo, Kabupaten Malang, Jawa Timur", size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Telpon/ Faksimile (0341) 2319509 Laman : puskesmasponcokusumo.malangkab.go.id", size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Pos-el: pkmponcokusumo@gmail.com, Kode Pos : 65157", size: 20 })] }),
      ]
    });

    const ttdTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [spasiAman] }),
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Poncokusumo, __________________")] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Pelapor,")] }),
                spasiAman, spasiAman, spasiAman,
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `(${form.namaPelapor || "-"})`, bold: true, underline: {} })] }),
              ]
            })
          ]
        })
      ]
    });

    // PENGAMAN ENTER TEXTAREA
    const kronologiAman = form.kronologi ? String(form.kronologi).split('\n') : ["-"];
    const tindakanAman = form.tindakan ? String(form.tindakan).split('\n') : ["-"];

    const doc = new Document({
      creator: "SATSET Poncokusumo",
      title: "Laporan Insiden",
      description: "Arsip Digital Laporan Insiden Puskesmas",
      sections: [{
        properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        children: [
          new Table({ 
            width: { size: 100, type: WidthType.PERCENTAGE }, 
            borders: { 
              top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, 
              left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, 
              insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } 
            },
            rows: [ new TableRow({ children: [logoCell, textCell] }) ] 
          }),
          
          spasiAman,
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "LAPORAN INSIDEN (K3 / KP / MANRISK)", bold: true, size: 28, underline: {} })] }),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "1. Data Pelapor & Waktu", bold: true, size: 24 })] }),
          new Paragraph({ children: [new TextRun(`    • Nama Pelapor: ${form.namaPelapor || "-"}`)] }),
          new Paragraph({ children: [new TextRun(`    • Waktu Kejadian: ${waktuRapi}`)] }),
          new Paragraph({ children: [new TextRun(`    • Lokasi: ${form.lokasi || "-"}`)] }),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "2. Data Insiden", bold: true, size: 24 })] }),
          new Paragraph({ children: [new TextRun(`    • Sasaran: ${form.sasaran || "-"}`)] }),
          new Paragraph({ children: [new TextRun(`    • Klasifikasi: Insiden ${jenisLaporan}`)] }),
          new Paragraph({ children: [new TextRun(`    • Nama Pasien: ${form.sasaran === 'Pasien' ? (form.namaPasien || '-') : '-'}`)] }),
          new Paragraph({ children: [new TextRun(`    • Nama Petugas: ${form.namaPetugas || '-'}`)] }),
          new Paragraph({ children: [new TextRun(`    • Rincian Kategori: ${form.kategori || "-"}`)] }),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "3. Kronologi Kejadian", bold: true, size: 24 })] }),
          ...kronologiAman.map(baris => new Paragraph({ children: [new TextRun(`    ${baris}`)] })),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "4. Tindakan yang Dilakukan", bold: true, size: 24 })] }),
          ...tindakanAman.map(baris => new Paragraph({ children: [new TextRun(`    ${baris}`)] })),
          spasiAman,
          
          ttdTable
        ],
      }],
    });

    // --- KUNCI PENGAMAN 2: JURUS BYPASS BASE64 ---
    // Jangan gunakan Packer.toBlob(doc) lagi!
    
    const b64 = await Packer.toBase64String(doc); // Jadikan teks dulu
    const byteCharacters = atob(b64); // Terjemahkan teksnya
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers); // Rakit ulang
    
    // Hasil akhirnya 100% aman untuk semua Browser dan HP!
    return new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  } // <-- Ini adalah kurung tutup fungsi buatDokumenWord()

  async function cetakWord() {
    if (!form.namaPelapor) return alert("⚠️ Isi form (Minimal Nama Pelapor) dulu!");
    try {
      const blobWord = await buatDokumenWord();
      saveAs(blobWord, `Laporan_Insiden_${form.namaPelapor.replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
    } catch (err) { alert("❌ Gagal mencetak:\n" + err.message); }
  }

  async function kirimLaporan() {
    if (!form.sasaran || !form.lokasi || !form.kronologi || !form.waktuKejadian || !form.tindakan || !form.namaPelapor) {
      return alert("Mohon lengkapi semua data wajib!");
    }

    isSending = true;
    const lokasiFinal = form.lokasi === 'Lain-lain' ? form.lokasiLainnya : form.lokasi;
    const jenisLaporan = tentukanJenisInsiden();
    
    let jenisSingkat = jenisLaporan;
    if (jenisLaporan === "Keselamatan Pasien") jenisSingkat = "KP";
    if (jenisLaporan === "Manajemen Risiko") jenisSingkat = "MANRISK";
    
    const dateObj = new Date(form.waktuKejadian);
    const waktuRapi = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    try {
      const { error } = await supabase.from('insiden_k3').insert([{
        sasaran: form.sasaran, lokasi: lokasiFinal, kategori: form.kategori || "-",
        waktu_kejadian: form.waktuKejadian.replace("T", " "), kronologi: form.kronologi,
        tindakan: form.tindakan, nama_pasien: form.namaPasien || "-",
        nama_petugas: form.namaPetugas || "-", nama_pelapor: form.namaPelapor,
        jenis_insiden: jenisLaporan
      }]);
      if (error) throw new Error(error.message);

      let pesanWA = `🚨 *LAPORAN INSIDEN ${jenisSingkat}* 🚨\n━━━━━━━━━━━━━━━━━━━━\n`;
      pesanWA += `👤 *Pelapor:* ${form.namaPelapor}\n📍 *Lokasi:* ${lokasiFinal}\n⏰ *Waktu:* ${waktuRapi}\n\n`;
      
      if (form.sasaran === "Pasien") {
        pesanWA += `⚠️ *Insiden PASIEN*\n• Nama Pasien: ${form.namaPasien || "-"}\n• Nama Petugas: ${form.namaPetugas || "-"}\n• Insiden: ${form.kategori}\n\n`;
      } else {
        pesanWA += `🚑 *Insiden Petugas*\n• Nama Petugas: ${form.namaPetugas || "-"}\n\n`;
      }
      
      pesanWA += `📝 *Kronologi:*\n${form.kronologi}\n\n🛡️ *Tindakan:*\n${form.tindakan}\n━━━━━━━━━━━━━━━━━━━━\n`;
      pesanWA += `link download laporan: https://satsetponcokusumo.my.id/`;

      const formDataTeks = new FormData();
      formDataTeks.append("target", "120363425742206740@g.us"); 
      formDataTeks.append("message", pesanWA);
      
      const responseWA = await fetch("https://api.fonnte.com/send", { method: "POST", headers: { "Authorization": "AmenKaTT5udS3ynWZ7DU" }, body: formDataTeks });
      const resultWA = await responseWA.json();
      if (resultWA.status === false) {
        throw new Error("Server WA menolak: " + resultWA.reason);
      }

      const blobWord = await buatDokumenWord();
      const namaFileSafe = `Laporan_${jenisLaporan.replace(/\s+/g, '_')}_${form.namaPelapor.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
      saveAs(blobWord, namaFileSafe);

      alert("✅ BERHASIL!\nData tersimpan, Notifikasi WA terkirim, dan File Word otomatis terunduh.");
      form = { sasaran: "", lokasi: "", lokasiLainnya: "", kategori: "", waktuKejadian: "", kronologi: "", tindakan: "", namaPasien: "", namaPetugas: "", namaPelapor: "" };
      switchView('dashboard');
      
    } catch (err) {
      alert("❌ Kesalahan:\n" + err.message);
    } finally {
      isSending = false;
    }
  }
</script>

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
        <span class="material-icons animate-spin text-5xl text-red-600">sync</span>
        <h3 class="text-red-700 font-bold mt-4 animate-pulse text-lg">Mengirim Laporan & Dokumen...</h3>
      </div>
    {/if}

    <div class="relative text-center mb-10">
      
      <button on:click={() => switchView('riwayat')} class="absolute top-0 right-0 bg-slate-800 text-white hover:bg-black font-bold text-xs px-4 py-2 rounded-lg flex items-center transition-all shadow-md cursor-pointer z-10">
        <span class="material-icons text-sm mr-1">history</span> Riwayat
      </button>

      <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 text-red-600 rounded-full mb-4 shadow-inner mt-4 md:mt-0">
        <span class="material-icons text-3xl">warning_amber</span>
      </div>
      <h2 class="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight">Pelaporan Insiden</h2>
      <p class="text-red-600 mt-2 font-bold bg-red-50 inline-block px-4 py-1 rounded-full text-sm">Tim K3, MANRISK & Keselamatan Pasien</p>
    </div>

    <div class="space-y-8">
      
      <div class="p-5 bg-white border-2 border-red-100 rounded-xl shadow-sm">
        <div class="block text-base font-black text-red-800 mb-4 flex items-center">
          <span class="bg-red-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs mr-2">1</span> 
          Siapakah yang terkena insiden?
        </div>
        <div class="flex flex-col sm:flex-row gap-4">
          <label class="flex-1 flex items-center gap-3 cursor-pointer bg-slate-50 hover:bg-red-50 px-5 py-4 border border-slate-200 hover:border-red-300 rounded-xl transition-all">
            <input type="radio" bind:group={form.sasaran} value="Pasien" on:change={handleSasaranChange} class="w-5 h-5 accent-red-600">
            <span class="font-bold text-slate-800">Pasien</span>
          </label>
          <label class="flex-1 flex items-center gap-3 cursor-pointer bg-slate-50 hover:bg-blue-50 px-5 py-4 border border-slate-200 hover:border-blue-300 rounded-xl transition-all">
            <input type="radio" bind:group={form.sasaran} value="Petugas" on:change={handleSasaranChange} class="w-5 h-5 accent-blue-600">
            <span class="font-bold text-slate-800">Petugas</span>
          </label>
        </div>
      </div>

      <div class="p-5 bg-slate-50 rounded-xl border border-slate-200">
        <div class="block text-sm font-bold text-slate-800 mb-3">Di mana terjadinya insiden?</div>
        <select bind:value={form.lokasi} class="w-full p-3.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-red-500 font-medium">
          <option value="">-- Pilih Lokasi --</option>
          {#each daftarLokasi as lok}
            <option value={lok}>{lok}</option>
          {/each}
        </select>
        
        {#if form.lokasi === 'Lain-lain'}
          <div class="mt-3 animate-fade-in">
            <input type="text" bind:value={form.lokasiLainnya} class="w-full p-3.5 bg-white border border-red-300 rounded-lg outline-none focus:ring-2 focus:ring-red-100" placeholder="Ketik lokasi spesifik...">
          </div>
        {/if}
      </div>

      {#if form.sasaran === 'Pasien'}
        <div class="animate-fade-in p-5 border-2 border-orange-100 bg-orange-50/30 rounded-xl shadow-sm">
          <div class="block text-sm font-black text-orange-800 mb-4">
            Apakah masuk dalam kategori di bawah ini?
          </div>
          <div class="space-y-2 bg-white p-4 rounded-lg border border-orange-100">
            {#each daftarKategori as kat}
              <label class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                <input type="radio" bind:group={form.kategori} value={kat} class="w-4 h-4 accent-orange-500">
                <span class="text-sm font-semibold text-slate-700">{kat}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      {#if form.sasaran === 'Petugas' || (form.sasaran === 'Pasien' && form.kategori !== '')}
        <div class="animate-fade-in p-6 bg-slate-800 rounded-xl shadow-md text-white space-y-6">
          <div class="block text-base font-black text-white border-b border-slate-700 pb-3">
            Rincian Kejadian & Tindakan
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase mb-2">Kapan Terjadinya?</label>
              <input type="datetime-local" bind:value={form.waktuKejadian} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase mb-2">Nama Pelapor</label>
              <input type="text" bind:value={form.namaPelapor} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Nama Pelapor">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase mb-2">Nama Pasien</label>
              <input type="text" bind:value={form.namaPasien} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Kosongi jika tidak ada">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase mb-2">Nama Petugas</label>
              <input type="text" bind:value={form.namaPetugas} class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Kosongi jika tidak ada">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase mb-2">Bagaimana Kronologinya?</label>
            <textarea bind:value={form.kronologi} rows="4" class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Ceritakan detail kejadian..."></textarea>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-300 uppercase mb-2">Tindakan Apa yang Sudah Dilakukan?</label>
            <textarea bind:value={form.tindakan} rows="3" class="w-full p-3 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-red-500" placeholder="Penanganan awal yang diberikan..."></textarea>
          </div>
        </div>
      {/if}

      <div class="pt-4 flex flex-col sm:flex-row gap-4">
        <button on:click={cetakWord} class="flex-1 bg-white border-2 border-slate-800 hover:bg-slate-100 text-slate-800 font-black text-lg py-4 rounded-xl transition-all flex justify-center items-center">
          <span class="material-icons mr-2">print</span> CETAK MS WORD
        </button>
        
        <button on:click={kirimLaporan} class="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-lg py-4 rounded-xl shadow-[0_10px_20px_rgba(220,38,38,0.3)] transition-all flex justify-center items-center">
          <span class="material-icons mr-2">send</span> SIMPAN & KIRIM WA
        </button>
      </div>

    </div>
  </div>
</div>

<style>
  .animate-fade-in { animation: fadeIn 0.4s ease-out; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>