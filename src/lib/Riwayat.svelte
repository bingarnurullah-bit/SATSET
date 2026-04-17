<script>
  import { supabase } from './supabase.js';
  import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, VerticalAlign, PageOrientation } from "docx";
  import { saveAs } from "file-saver";

  export let switchView;

  let dataInsiden = [];
  let isLoading = false;
  
  let bulanPilih = new Date().getMonth() + 1; 
  let tahunPilih = new Date().getFullYear();

  const namaBulan = [ "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember" ];
  const tahunOpsi = [tahunPilih - 2, tahunPilih - 1, tahunPilih];

  const spasiAman = new Paragraph({ children: [new TextRun("")] });

  async function ambilData() {
    isLoading = true;
    try {
      const bulanFormat = String(bulanPilih).padStart(2, '0');
      const { data, error } = await supabase
        .from('insiden_k3')
        .select('*')
        .like('waktu_kejadian', `${tahunPilih}-${bulanFormat}%`)
        .order('waktu_kejadian', { ascending: false });
      if (error) throw error;
      dataInsiden = data;
    } catch (err) {
      alert("❌ Gagal mengambil riwayat:\n" + err.message);
    } finally {
      isLoading = false;
    }
  }

  ambilData();

  // ==========================================
  // FUNGSI KOP DENGAN PERBAIKAN FORMAT GAMBAR (Uint8Array)
  // ==========================================
  async function generateKop() {
    let logoCell;
    try {
      const response = await fetch('/logo-kab.png');
      if (!response.ok) throw new Error("Logo tidak ditemukan");
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      // 💥 KUNCI ANTI-CORRUPT: Ubah format gambar jadi biner absolut
      const logoUint8 = new Uint8Array(arrayBuffer); 

      logoCell = new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logoUint8, transformation: { width: 75, height: 95 } })] })]
      });
    } catch {
      logoCell = new TableCell({ width: { size: 1, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [spasiAman] });
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

    return new Table({ 
      width: { size: 100, type: WidthType.PERCENTAGE }, 
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [ new TableRow({ children: [logoCell, textCell] }) ] 
    });
  }

  async function unduhLaporanUtuh(item) {
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
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `(${item.nama_pelapor || "-"})`, bold: true, underline: {} })] })
              ] 
            })
          ] 
        })
      ]
    });

    const kronologiAman = item.kronologi ? String(item.kronologi).split('\n') : ["-"];
    const tindakanAman = item.tindakan ? String(item.tindakan).split('\n') : ["-"];

    const doc = new Document({
      creator: "SATSET",
      title: "Laporan Insiden",
      sections: [{
        properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        children: [
          await generateKop(),
          spasiAman,
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "LAPORAN INSIDEN (K3 / KP / MANRISK)", bold: true, size: 28, underline: {} })] }),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "1. Data Pelapor & Waktu", bold: true, size: 24 })] }),
          new Paragraph({ children: [new TextRun(`    • Nama Pelapor: ${item.nama_pelapor || "-"}`)] }),
          new Paragraph({ children: [new TextRun(`    • Waktu Kejadian: ${item.waktu_kejadian || "-"}`)] }),
          new Paragraph({ children: [new TextRun(`    • Lokasi: ${item.lokasi || "-"}`)] }),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "2. Data Insiden", bold: true, size: 24 })] }),
          new Paragraph({ children: [new TextRun(`    • Sasaran: ${item.sasaran || "-"}`)] }),
          new Paragraph({ children: [new TextRun(`    • Klasifikasi: Insiden ${item.jenis_insiden || "-"}`)] }),
          new Paragraph({ children: [new TextRun(`    • Nama Pasien: ${item.sasaran === 'Pasien' ? (item.nama_pasien || '-') : '-'}`)] }),
          new Paragraph({ children: [new TextRun(`    • Nama Petugas: ${item.nama_petugas || '-'}`)] }),
          new Paragraph({ children: [new TextRun(`    • Rincian Kategori: ${item.kategori || "-"}`)] }),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "3. Kronologi Kejadian", bold: true, size: 24 })] }),
          ...kronologiAman.map(baris => new Paragraph({ children: [new TextRun(`    ${baris}`)] })),
          spasiAman,
          
          new Paragraph({ children: [new TextRun({ text: "4. Tindakan yang Dilakukan", bold: true, size: 24 })] }),
          ...tindakanAman.map(baris => new Paragraph({ children: [new TextRun(`    ${baris}`)] })),
          spasiAman,
          
          ttdTable
        ]
      }]
    });
    
    // 🚀 KEMBALI MENGGUNAKAN BLOB RESMI BROWSER
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Laporan_Utuh_${(item.nama_pelapor || "Anonim").replace(/\s+/g, '_')}.docx`);
  }

  async function cetakRekap() {
    let contentChildren = [];
    contentChildren.push(await generateKop());
    contentChildren.push(spasiAman);
    
    const judul = `REKAPITULASI INSIDEN BULAN ${namaBulan[bulanPilih-1].toUpperCase()} ${tahunPilih}`;
    contentChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: judul, bold: true, size: 28, underline: {} })] }));
    contentChildren.push(spasiAman);

    if (dataInsiden.length === 0) {
      contentChildren.push(spasiAman);
      contentChildren.push(spasiAman);
      contentChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NIHIL", bold: true, size: 72 })] }));
      contentChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tidak ada insiden yang dilaporkan pada periode ini.", size: 24 })] }));
    } else {
      dataInsiden.forEach((item, index) => {
        contentChildren.push(new Paragraph({ children: [new TextRun({ text: `${index + 1}. Tanggal: ${(item.waktu_kejadian || "-").split(' ')[0]} | Pelapor: ${item.nama_pelapor || "-"}`, bold: true })] }));
        contentChildren.push(new Paragraph({ children: [new TextRun(`    • Jenis: ${item.jenis_insiden || "-"} (${item.sasaran || "-"})`)] }));
        contentChildren.push(new Paragraph({ children: [new TextRun(`    • Kategori: ${item.kategori || "-"}`)] }));
        contentChildren.push(new Paragraph({ children: [new TextRun(`    • Lokasi: ${item.lokasi || "-"}`)] }));
        contentChildren.push(spasiAman);
      });
    }

    const doc = new Document({
      creator: "SATSET",
      title: "Rekap Insiden",
      sections: [{
        properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        children: contentChildren
      }]
    });
    
    // 🚀 KEMBALI MENGGUNAKAN BLOB RESMI BROWSER
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Rekap_Insiden_${namaBulan[bulanPilih-1]}_${tahunPilih}.docx`);
  }
</script>

<div class="bg-slate-50 min-h-screen pt-6 pb-20 px-4">
  <div class="max-w-4xl mx-auto mb-6 flex justify-between items-center">
    <button on:click={() => switchView('app-insiden')} class="text-[#a435f0] font-bold flex items-center hover:underline cursor-pointer">
      <span class="material-icons mr-1">arrow_back</span> Kembali ke Form Laporan
    </button>
    <div class="text-xs font-bold text-slate-400">Arsip SATSET Poncokusumo</div>
  </div>

  <div class="bg-white max-w-4xl mx-auto rounded-2xl shadow-lg border-t-8 border-slate-800 p-6">
    <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
      <h2 class="text-2xl font-black text-slate-800 flex items-center">
        <span class="material-icons mr-2 text-3xl">history</span> Riwayat & Arsip
      </h2>
      <button on:click={cetakRekap} class="w-full md:w-auto bg-slate-800 hover:bg-black text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-all shadow-md">
        <span class="material-icons mr-2">summarize</span> Cetak Rekap Bulanan
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-slate-100 p-4 rounded-xl">
      <div>
        <label class="block text-xs font-bold text-slate-500 mb-1">Filter Bulan</label>
        <select bind:value={bulanPilih} on:change={ambilData} class="w-full p-3 rounded-lg border border-slate-300 font-bold text-slate-700 outline-none">
          {#each namaBulan as bulan, i}
            <option value={i + 1}>{bulan}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-500 mb-1">Filter Tahun</label>
        <select bind:value={tahunPilih} on:change={ambilData} class="w-full p-3 rounded-lg border border-slate-300 font-bold text-slate-700 outline-none">
          {#each tahunOpsi as tahun}
            <option value={tahun}>{tahun}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="overflow-x-auto border border-slate-200 rounded-xl">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-800 text-white text-sm">
            <th class="p-4 font-bold rounded-tl-xl whitespace-nowrap">Tgl/Waktu</th>
            <th class="p-4 font-bold">Pelapor</th>
            <th class="p-4 font-bold">Jenis Insiden</th>
            <th class="p-4 font-bold rounded-tr-xl text-center">Tindakan</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          {#if isLoading}
            <tr><td colspan="4" class="text-center p-8 text-slate-400 font-bold animate-pulse">Memuat data dari brankas...</td></tr>
          {:else if dataInsiden.length === 0}
            <tr><td colspan="4" class="text-center p-10 text-slate-400">
              <span class="material-icons text-5xl mb-2 text-slate-300 block">assignment_turned_in</span>
              <span class="font-bold text-lg text-slate-500 block">NIHIL</span>
              Tidak ada laporan insiden di bulan ini.
            </td></tr>
          {:else}
            {#each dataInsiden as item}
              <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-4 whitespace-nowrap font-semibold text-slate-700">{(item.waktu_kejadian || "").substring(0, 16)}</td>
                <td class="p-4 font-bold text-slate-900">{item.nama_pelapor}</td>
                <td class="p-4">
                  <span class="text-[10px] uppercase font-black px-2 py-1 rounded-full {item.jenis_insiden === 'K3' ? 'bg-blue-100 text-blue-700' : (item.jenis_insiden === 'Manajemen Risiko' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700')}">
                    {item.jenis_insiden}
                  </span>
                </td>
                <td class="p-4 text-center">
                  <button 
                    type="button"
                    on:click={async (e) => {
                      e.preventDefault();
                      const tombol = e.currentTarget;
                      const teksAsli = tombol.innerHTML;
                      tombol.innerHTML = `<span class="material-icons animate-spin text-sm mr-1">sync</span> Proses...`;
                      tombol.disabled = true;
                      
                      try {
                        const itemAman = { ...item };
                        await unduhLaporanUtuh(itemAman);
                      } catch (err) {
                        alert("❌ Gagal Download: " + err.message);
                      } finally {
                        tombol.innerHTML = teksAsli;
                        tombol.disabled = false;
                      }
                    }} 
                    class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center mx-auto transition-all border border-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    <span class="material-icons text-sm mr-1">download</span> Laporan Utuh
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>