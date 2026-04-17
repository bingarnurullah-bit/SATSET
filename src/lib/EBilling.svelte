<script>
  import { supabase } from './supabase.js'; 

  export let switchView;

  // State Reaktif Utama
  let dataObatDinamis = [];
  let dataLayananDinamis = {};
  
  // =====================================
  // PERBAIKAN: IDENTITAS PASIEN (6 ITEM)
  // =====================================
  let labelIdentitas = [
    "Nama Lengkap", 
    "NIK", 
    "Tanggal Lahir", 
    "Ruangan", 
    "Tanggal Masuk", 
    "Tanggal Keluar"
  ];
  let identitasValues = {};
  
  let keranjang = [];
  let kategoriTerpilih = "";
  let tindakanInput = "";
  let tindakanQty = 1;
  let obatInput = "";
  let obatQty = 1;
  
  let isPreview = false;
  let isSavingDB = false;
  
  let showRiwayat = false;
  let riwayatData = [];
  let isRiwayatLoading = false;
  let editRowKasir = ""; 

  const hariIni = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const cleanText = (txt) => txt ? txt.toString().replace(/^[0-9a-z]+\)\s*/gi, '').trim() : "";

  $: totalHarga = keranjang.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  $: listTindakan = keranjang.filter(it => it.tipe === 'tindakan');
  $: listObat = keranjang.filter(it => it.tipe === 'obat');

  const urlLogoKiri = "/logo-kab.png";
  const urlLogoKanan = "/logo-pkm.png";

  function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);
  }

  // =====================================
  // PENYEDOT DATA MASTER
  // =====================================
  async function muatMasterData() {
    try {
      const resObat = await supabase.from('master_obat').select('nama, harga');
      dataObatDinamis = resObat.data || [];

      const resLayanan = await supabase.from('master_layanan').select('kategori, nama, harga');
      let layananDict = {};
      if(resLayanan.data) {
        resLayanan.data.forEach(item => {
          if (!layananDict[item.kategori]) layananDict[item.kategori] = [];
          layananDict[item.kategori].push([item.nama, item.harga]); 
        });
      }
      dataLayananDinamis = layananDict;
    } catch(err) {
      console.error("Gagal muat master data", err);
    }
  }

  muatMasterData();

  // =====================================
  // LOGIKA KERANJANG
  // =====================================
  function tambahItem(tipe) {
    let item; let qty = 1;
    if (tipe === 'tindakan') {
      if (!tindakanInput || !kategoriTerpilih) return;
      const found = dataLayananDinamis[kategoriTerpilih]?.find(t => cleanText(t[0]) === tindakanInput);
      if (!found) return alert("Pilih tindakan dari daftar!");
      item = { nama: cleanText(found[0]), harga: found[1], tipe: 'tindakan' };
      qty = tindakanQty;
      tindakanInput = ""; tindakanQty = 1;
    } else {
      if (!obatInput) return;
      const found = dataObatDinamis.find(o => o.nama === obatInput);
      if (!found) return alert("Obat tidak terdaftar!");
      item = { nama: found.nama, harga: found.harga, tipe: 'obat' };
      qty = obatQty;
      obatInput = ""; obatQty = 1;
    }

    const idx = keranjang.findIndex(k => k.nama === item.nama);
    if (idx > -1) {
      keranjang[idx].qty += qty;
      keranjang = [...keranjang]; 
    } else {
      keranjang = [...keranjang, { ...item, qty }];
    }
  }

  function hapusItem(index) {
    keranjang = keranjang.filter((_, i) => i !== index);
  }

  // =====================================
  // FUNGSI DATABASE E-BILLING SUPABASE
  // =====================================
  async function simpanDataKasir() {
    // Array index 0 = Nama Lengkap, index 1 = NIK
    const namaPasien = identitasValues[0];
    if (!namaPasien) return alert("Mohon isi Nama Lengkap pasien sebelum menyimpan!");

    isSavingDB = true;
    try {
      if (editRowKasir) {
        const { error } = await supabase.from('riwayat_kasir').update({
          tanggal: hariIni,
          nama_pasien: namaPasien,
          rm: identitasValues[1] || "-", // Menyimpan NIK ke kolom RM di database
          total_biaya: totalHarga,
          identitas: identitasValues,
          keranjang: keranjang
        }).eq('id', editRowKasir);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('riwayat_kasir').insert([{
          tanggal: hariIni,
          nama_pasien: namaPasien,
          rm: identitasValues[1] || "-", // Menyimpan NIK ke kolom RM di database
          total_biaya: totalHarga,
          identitas: identitasValues,
          keranjang: keranjang
        }]);
        if (error) throw error;
      }

      alert("✅ Sukses menyimpan kuitansi!");
      if (editRowKasir) batalEditKasir();
      if (showRiwayat) muatRiwayatKasir();
      
      // PERUBAHAN: Memanggil Jurus iFrame, bukan lagi window.print() biasa
      cetakKwitansiIframe();

    } catch (err) {
      alert("❌ Gagal menyimpan ke Database: " + err.message);
    } finally {
      isSavingDB = false;
    }
  }

  function toggleRiwayatKasir() {
    showRiwayat = !showRiwayat;
    if (showRiwayat) {
      muatRiwayatKasir();
      setTimeout(() => {
        document.getElementById('kasir-riwayat-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  async function muatRiwayatKasir() {
    isRiwayatLoading = true;
    try {
      const { data, error } = await supabase
        .from('riwayat_kasir')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      riwayatData = data || [];
    } catch (err) {
      alert("❌ Terjadi kesalahan saat memuat riwayat: " + err.message);
    } finally {
      isRiwayatLoading = false;
    }
  }

  function editDataKasir(data) {
    editRowKasir = data.id;
    identitasValues = data.identitas || {};
    keranjang = data.keranjang || [];
    isPreview = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function hapusKasir(id_kasir) { 
    if (confirm("Yakin ingin menghapus riwayat Kuitansi ini secara permanen?")) {
      try {
        const { error } = await supabase.from('riwayat_kasir').delete().eq('id', id_kasir);
        if (error) throw error;
        muatRiwayatKasir(); 
      } catch (err) {
        alert("❌ Gagal menghapus: " + err.message);
      }
    }
  }

  function batalEditKasir() {
    editRowKasir = "";
    identitasValues = {};
    keranjang = [];
  }

  // ==========================================
  // JURUS PAMUNGKAS: CETAK IFRAME (ANTI-SCREENSHOT)
  // ==========================================
  function cetakKwitansiIframe() {
    // 1. Ambil HANYA area HTML Kwitansi yang sudah kita tandai
    const printContent = document.getElementById('area-cetak-kwitansi').innerHTML;

    // 2. Buat Jendela Isolasi (iFrame) di latar belakang
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // 3. Suntikkan HTML & CSS Murni khusus kertas cetak Kwitansi
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kwitansi_EBilling_${identitasValues[0] || 'Pasien'}</title>
        <style>
          /* Seting Kertas A4 Portrait */
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Arial', sans-serif; background: white; color: black; margin: 0; padding: 0; }
          
          /* Anti-Tabel Terpotong & Warna Tajam */
          table { page-break-inside: auto; border-collapse: collapse; width: 100%; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          td, th { page-break-inside: avoid; color: black !important; }

          /* Paksa warna background tabel tercetak (penting untuk header abu-abu) */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Blokir Ekstensi Browser yang suka mengganggu form */
          magical-app, grammarly-extension, div[id^="magical"] { display: none !important; }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.print(); window.parent.postMessage('printSelesaiEBilling', '*'); }, 800)">
        ${printContent}
      </body>
      </html>
    `);
    doc.close();

    // 4. Bersihkan memori setelah kertas selesai dicetak
    window.addEventListener('message', function cleanup(e) {
      if (e.data === 'printSelesaiEBilling') {
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500);
        window.removeEventListener('message', cleanup);
      }
    });

    // Fallback darurat (Mencegah iframe menyangkut di RAM)
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 8000);
  }

</script>

<div class="animate-fade-in bg-slate-50 min-h-screen pb-20">
  
  {#if !isPreview}
    <div class="max-w-7xl mx-auto p-4 pt-8 no-print">
      <div class="mb-4 flex justify-between items-center">
        <button on:click={() => switchView('dashboard')} class="text-[#a435f0] hover:text-[#8710d8] font-bold text-sm flex items-center">
          <span class="material-icons text-sm mr-1">arrow_back</span> Kembali ke Dashboard
        </button>
      </div>

      <header class="bg-slate-900 text-white p-7 rounded-[32px] mb-8 flex justify-between items-center shadow-2xl border-b-8 border-[#D4AF37]">
        <div class="pl-4">
          <h1 class="text-3xl uppercase italic text-[#D4AF37] font-black">BILLING KASIR</h1>
          <p class="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em]">Puskesmas Poncokusumo</p>
        </div>
        <span class="material-icons text-4xl text-[#D4AF37]">point_of_sale</span>
      </header>

      {#if editRowKasir}
        <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-r-lg font-bold flex justify-between items-center">
            <span>Anda sedang mengedit riwayat kuitansi lama! (Hati-hati menyimpan perubahan)</span>
            <button on:click={batalEditKasir} class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Batal Edit</button>
        </div>
      {/if}

      <div class="flex flex-col lg:flex-row gap-8">
        <div class="flex-1 space-y-6">
          <section class="card-input pt-4">
            <h2 class="text-[#0F172A] font-black mb-6 uppercase text-xs border-b pb-3 italic">Identitas Pasien</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              {#each labelIdentitas as label, i}
                <div>
                  <label class="label-pro" for="p-{i}">{label}</label>
                  <input type={label.toLowerCase().includes('tanggal') ? 'date' : (label === 'NIK' ? 'number' : 'text')} id="p-{i}" bind:value={identitasValues[i]} class="input-search uppercase">
                </div>
              {/each}
            </div>
          </section>

          <section class="card-input pt-4">
            <h2 class="text-[#0F172A] font-black mb-6 uppercase text-xs border-b pb-3 italic">Layanan Medis</h2>
            <div class="flex flex-col md:flex-row gap-4 items-end">
              <div class="flex-1 w-full">
                <label class="label-pro">Pilih Unit</label>
                <select bind:value={kategoriTerpilih} class="input-search py-3.5">
                  <option value="">-- Pilih Unit --</option>
                  {#each Object.keys(dataLayananDinamis) as cat}
                    <option value={cat}>{cat}</option>
                  {/each}
                </select>
              </div>
              <div class="flex-[1.5] w-full">
                <label class="label-pro">Cari Tindakan</label>
                <input list="tindakan-list" bind:value={tindakanInput} class="input-search py-3.5" disabled={!kategoriTerpilih} placeholder="Ketik tindakan...">
                <datalist id="tindakan-list">
                  {#if kategoriTerpilih && dataLayananDinamis[kategoriTerpilih]}
                    {#each dataLayananDinamis[kategoriTerpilih] as t}
                      <option value={cleanText(t[0])}></option>
                    {/each}
                  {/if}
                </datalist>
              </div>
              <div class="w-40">
                <label class="label-pro">Jumlah</label>
                <div class="qty-control">
                  <button class="btn-qty-minus" on:click={() => tindakanQty > 1 ? tindakanQty-- : 1}><span class="material-icons text-sm">remove</span></button>
                  <input type="number" bind:value={tindakanQty} class="w-full text-center bg-transparent font-bold outline-none border-none">
                  <button class="btn-qty-plus" on:click={() => tindakanQty++}><span class="material-icons text-sm">add</span></button>
                </div>
              </div>
              <button on:click={() => tambahItem('tindakan')} class="btn-add-modern"><span class="material-icons">add_task</span></button>
            </div>
          </section>

          <section class="card-input pt-4">
            <h2 class="text-[#0F172A] font-black mb-6 uppercase text-xs border-b pb-3 italic">Obat & BMHP</h2>
            <div class="flex flex-col md:flex-row gap-4 items-end">
              <div class="flex-[2] w-full">
                <label class="label-pro">Cari Nama Barang</label>
                <input list="obat-datalist" bind:value={obatInput} class="input-search py-3.5" placeholder="Ketik obat...">
                <datalist id="obat-datalist">
                  {#each dataObatDinamis as o}<option value={o.nama}></option>{/each}
                </datalist>
              </div>
              <div class="w-40">
                <label class="label-pro">Jumlah</label>
                <div class="qty-control">
                  <button class="btn-qty-minus" on:click={() => obatQty > 1 ? obatQty-- : 1}><span class="material-icons text-sm">remove</span></button>
                  <input type="number" bind:value={obatQty} class="w-full text-center bg-transparent font-bold outline-none border-none">
                  <button class="btn-qty-plus" on:click={() => obatQty++}><span class="material-icons text-sm">add</span></button>
                </div>
              </div>
              <button on:click={() => tambahItem('obat')} class="btn-add-modern"><span class="material-icons">add_shopping_cart</span></button>
            </div>
          </section>
        </div>

        <div class="w-full lg:w-96">
          <div class="side-panel-keranjang sticky top-[100px] h-[650px] flex flex-col shadow-2xl">
            <div class="flex-1 overflow-y-auto custom-scroll space-y-4 pr-2">
              {#if keranjang.length === 0}
                <div class="text-center opacity-30 mt-32 italic">Belum ada item di keranjang</div>
              {/if}
              {#if listTindakan.length > 0}
                <p class="text-[9px] text-blue-400 font-bold mb-2 uppercase border-b border-blue-400/30 pb-1">Layanan/Tindakan</p>
                {#each keranjang.filter(it => it.tipe === 'tindakan') as it, i}
                  <div class="sidebar-item-2d mb-3">
                    <p class="text-[10px] text-white font-black uppercase leading-tight mb-1">{it.nama}</p>
                    <div class="flex justify-between items-center">
                      <span class="text-xs text-[#D4AF37] font-bold">{it.qty} x {formatRupiah(it.harga)}</span>
                      <button on:click={() => hapusItem(keranjang.indexOf(it))} class="text-red-400 text-[10px] underline hover:text-white">Hapus</button>
                    </div>
                  </div>
                {/each}
              {/if}
              {#if listObat.length > 0}
                <p class="text-[9px] text-[#D4AF37] font-bold mb-2 mt-4 uppercase border-b border-[#D4AF37]/30 pb-1">Obat & BMHP</p>
                {#each keranjang.filter(it => it.tipe === 'obat') as it, i}
                  <div class="sidebar-item-2d mb-3">
                    <p class="text-[10px] text-white font-black uppercase leading-tight mb-1">{it.nama}</p>
                    <div class="flex justify-between items-center">
                      <span class="text-xs text-[#D4AF37] font-bold">{it.qty} x {formatRupiah(it.harga)}</span>
                      <button on:click={() => hapusItem(keranjang.indexOf(it))} class="text-red-400 text-[10px] underline hover:text-white">Hapus</button>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
            <div class="mt-4 pt-4 border-t border-white/10">
              <div class="flex justify-between mb-4 items-end">
                <span class="text-xs uppercase text-slate-300 font-bold">Total</span>
                <span class="text-2xl font-black text-[#D4AF37] leading-none">{formatRupiah(totalHarga)}</span>
              </div>
              <button on:click={() => { if(keranjang.length > 0) { isPreview = true; window.scrollTo(0,0); } }} class="btn-cetak w-full {keranjang.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" disabled={keranjang.length === 0}>PROSES & CEK KUITANSI</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="action-buttons mt-8 flex flex-wrap justify-center gap-3 border-t border-gray-300 pt-8">
          <button on:click={toggleRiwayatKasir} class="bg-[#0F172A] text-white px-8 py-4 rounded-xl font-bold shadow-md hover:bg-black transition-colors flex items-center justify-center">
              <span class="material-icons mr-2">history</span> Riwayat Data Kasir
          </button>
      </div>

      {#if showRiwayat}
        <div id="kasir-riwayat-section" class="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-fade-in">
          <div class="flex justify-between items-center mb-4 border-b pb-4">
            <h3 class="font-bold text-xl text-[#0F172A]">Riwayat Kuitansi Terakhir</h3>
            <button on:click={muatRiwayatKasir} class="text-sm bg-blue-50 text-blue-600 font-bold px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center transition-colors">
              <span class="material-icons text-sm mr-2 {isRiwayatLoading ? 'animate-spin' : ''}">refresh</span> Muat Ulang
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left border">
              <thead class="bg-slate-100 border-b text-slate-700">
                <tr>
                  <th class="p-3 font-semibold w-1/5">Tanggal</th>
                  <th class="p-3 font-semibold w-1/3">Nama Pasien / NIK</th>
                  <th class="p-3 font-semibold w-1/4">Total Biaya</th>
                  <th class="p-3 font-semibold text-center w-1/6">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {#if isRiwayatLoading}
                  <tr><td colspan="4" class="text-center p-8 text-gray-500"><span class="material-icons animate-spin mr-2 align-middle">sync</span> Memuat data...</td></tr>
                {:else if riwayatData.length === 0}
                  <tr><td colspan="4" class="text-center p-8 text-gray-400 italic">Belum ada data Kuitansi.</td></tr>
                {:else}
                  {#each riwayatData as it}
                    <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td class="p-3 align-middle text-xs text-gray-500">{it.tanggal}</td>
                      <td class="p-3 align-middle">
                        <div class="font-bold text-[#0F172A] text-sm uppercase">{it.nama_pasien || '-'}</div>
                        <div class="text-xs text-gray-500 mt-1">NIK: {it.rm || '-'}</div>
                      </td>
                      <td class="p-3 align-middle text-sm font-bold text-emerald-600">
                        Rp {Number(it.total_biaya).toLocaleString('id-ID')}
                      </td>
                      <td class="p-3 align-middle text-center space-y-2">
                        <button on:click={() => editDataKasir(it)} class="text-xs font-bold text-[#a435f0] hover:underline w-full text-center block">Edit & Cetak Ulang</button>
                        <button on:click={() => hapusKasir(it.id)} class="text-xs font-bold text-red-600 hover:underline w-full text-center block">Hapus</button>
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

    </div>

  {:else}
    <div class="max-w-4xl mx-auto p-10 bg-white shadow-xl my-4 print-container relative">
      
      <div class="no-print absolute top-4 left-4 flex gap-3">
        <button on:click={() => { isPreview = false; window.scrollTo(0,0); }} class="bg-gray-800 text-white px-5 py-2 rounded-lg font-bold flex items-center text-sm shadow-md hover:bg-black transition-colors">
          <span class="material-icons text-sm mr-2">edit</span> Edit Kembali
        </button>
      </div>

      <div class="no-print absolute top-4 right-4 flex gap-3">
        <button on:click={simpanDataKasir} disabled={isSavingDB} class="bg-[#D4AF37] text-white px-5 py-2 rounded-lg font-bold flex items-center text-sm shadow-md hover:bg-[#b5952f] transition-colors {isSavingDB ? 'opacity-70 cursor-not-allowed' : 'animate-pulse'}">
          {#if isSavingDB}
            <span class="material-icons text-sm mr-2 animate-spin">sync</span> Menyimpan...
          {:else}
            <span class="material-icons text-sm mr-2">save</span> {editRowKasir ? 'Update Data & Cetak' : 'Simpan Data & Cetak'}
          {/if}
        </button>
      </div>

      <div id="area-cetak-kwitansi" class="mt-12 print-content">
        <div style="page-break-after: always; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px dashed #999; display: block;">
          
          <table style="width: 100%; margin-bottom: 5px; border-bottom: 3px solid black; padding-bottom: 5px; border-collapse: collapse;">
            <tbody>
              <tr>
                  <td style="width: 85px; text-align: left; vertical-align: middle; padding: 0;">
                      <img src={urlLogoKiri} style="height: 80px; width: 80px; object-fit: contain; display: block;" alt="Logo Kiri">
                  </td>
                  <td style="text-align: center; font-family: Arial, sans-serif; padding: 0 10px; vertical-align: middle;">
                      <p style="margin: 0 0 2px 0; font-size: 12px; line-height: 1.2;">PEMERINTAH KABUPATEN MALANG</p>
                      <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: bold; line-height: 1.2; text-transform: uppercase;">DINAS KESEHATAN</p>
                      <p style="margin: 0 0 2px 0; font-size: 18px; font-weight: 900; line-height: 1.2; text-transform: uppercase;">UPT PUSKESMAS PONCOKUSUMO</p>
                      <p style="margin: 2px 0 0 0; font-size: 9px; font-style: italic; line-height: 1.1;">Jalan Kusnan Marzuki No. 101, Wonomulyo, Kabupaten Malang, Jawa Timur</p>
                      <p style="margin: 1px 0; font-size: 9px; font-style: italic; line-height: 1.1;">Telpon/ Faksimile (0341) 2319509 Laman : puskesmasponcokusumo.malangkab.go.id</p>
                      <p style="margin: 1px 0; font-size: 9px; font-style: italic; line-height: 1.1;">Pos-el: pkmponcokusumo@gmail.com, Kode Pos : 65157</p>
                  </td>
                  <td style="width: 85px; text-align: right; vertical-align: middle; padding: 0;">
                      <img src={urlLogoKanan} style="height: 80px; width: 80px; object-fit: contain; display: block;" alt="Logo Kanan">
                  </td>
              </tr>
            </tbody>
          </table>
          <div style="border-top: 1px solid black; margin-top: 2px; margin-bottom: 15px;"></div>

          <table style="width: 100%; font-size: 10px; margin-bottom: 15px; border-collapse: collapse;">
            <tbody>
                {#each labelIdentitas as label, i}
                  {#if i % 2 === 0}
                    <tr>
                      <td style="width: 15%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #555; text-transform: uppercase; vertical-align: top;">{label}</td>
                      <td style="width: 33%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #000; text-transform: uppercase; vertical-align: top;">: {identitasValues[i] || '-'}</td>
                      <td style="width: 4%;"></td>
                      
                      {#if labelIdentitas[i+1]}
                        <td style="width: 15%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #555; text-transform: uppercase; vertical-align: top;">{labelIdentitas[i+1]}</td>
                        <td style="width: 33%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #000; text-transform: uppercase; vertical-align: top;">: {identitasValues[i+1] || '-'}</td>
                      {:else}
                        <td style="width: 15%;"></td><td style="width: 33%;"></td>
                      {/if}
                    </tr>
                  {/if}
                {/each}
            </tbody>
          </table>

          <h3 style="text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 15px; font-style: italic; font-size: 12px;">Kuitansi Rincian (Arsip Kasir)</h3>

          <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
            <thead>
              <tr style="background: #F3F4F6;">
                <th style="border: 1px solid black; padding: 4px; width: 30px;">NO</th>
                <th style="border: 1px solid black; padding: 4px; text-align: left;">URAIAN</th>
                <th style="border: 1px solid black; padding: 4px; width: 35px;">QTY</th>
                <th style="border: 1px solid black; padding: 4px; text-align: right; width: 70px;">HARGA</th>
                <th style="border: 1px solid black; padding: 4px; text-align: right; width: 70px;">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {#if listTindakan.length > 0}
                <tr style="background: #F3F4F6;"><td colspan="5" style="border: 1px solid black; padding: 4px; font-weight: bold; font-style: italic; font-size: 9px;">A. LAYANAN & TINDAKAN</td></tr>
                {#each listTindakan as it, index}
                  <tr>
                    <td style="border: 1px solid black; padding: 4px; text-align: center;">{index + 1}</td>
                    <td style="border: 1px solid black; padding: 4px; text-transform: uppercase;">{it.nama}</td>
                    <td style="border: 1px solid black; padding: 4px; text-align: center;">{it.qty}</td>
                    <td style="border: 1px solid black; padding: 4px; text-align: right;">{it.harga.toLocaleString('id-ID')}</td>
                    <td style="border: 1px solid black; padding: 4px; text-align: right; font-weight: bold;">{(it.harga * it.qty).toLocaleString('id-ID')}</td>
                  </tr>
                {/each}
              {/if}

              {#if listObat.length > 0}
                <tr style="background: #F3F4F6;"><td colspan="5" style="border: 1px solid black; padding: 4px; font-weight: bold; font-style: italic; font-size: 9px;">B. OBAT & BMHP</td></tr>
                {#each listObat as it, index}
                  <tr>
                    <td style="border: 1px solid black; padding: 4px; text-align: center;">{listTindakan.length + index + 1}</td>
                    <td style="border: 1px solid black; padding: 4px; text-transform: uppercase;">{it.nama}</td>
                    <td style="border: 1px solid black; padding: 4px; text-align: center;">{it.qty}</td>
                    <td style="border: 1px solid black; padding: 4px; text-align: right;">{it.harga.toLocaleString('id-ID')}</td>
                    <td style="border: 1px solid black; padding: 4px; text-align: right; font-weight: bold;">{(it.harga * it.qty).toLocaleString('id-ID')}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="4" style="border: 1px solid black; padding: 4px; text-align: right; text-transform: uppercase;">Total Bayar</td>
                <td style="border: 1px solid black; padding: 4px; text-align: right;">Rp {totalHarga.toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>

          <table style="width: 100%; margin-top: 40px; font-size: 10px; text-align: center; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="width: 35%; vertical-align: bottom;">
                  <p style="margin: 0 0 50px 0;">Pasien/Keluarga,</p>
                  <p style="margin: 0;">( ................................ )</p>
                </td>
                <td style="width: 30%;"></td>
                <td style="width: 35%; vertical-align: bottom;">
                  <p style="margin: 0 0 5px 0;">Poncokusumo, {hariIni}</p>
                  <p style="margin: 0 0 50px 0;">Petugas Kasir,</p>
                  <p style="margin: 0; font-weight: bold; text-decoration: underline; text-transform: uppercase;">( ................................ )</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="display: block;">
          <table style="width: 100%; margin-bottom: 5px; border-bottom: 3px solid black; padding-bottom: 5px; border-collapse: collapse;">
            <tbody>
              <tr>
                  <td style="width: 85px; text-align: left; vertical-align: middle; padding: 0;">
                      <img src={urlLogoKiri} style="height: 80px; width: 80px; object-fit: contain; display: block;" alt="Logo Kiri">
                  </td>
                  <td style="text-align: center; font-family: Arial, sans-serif; padding: 0 10px; vertical-align: middle;">
                      <p style="margin: 0 0 2px 0; font-size: 12px; line-height: 1.2;">PEMERINTAH KABUPATEN MALANG</p>
                      <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: bold; line-height: 1.2; text-transform: uppercase;">DINAS KESEHATAN</p>
                      <p style="margin: 0 0 2px 0; font-size: 18px; font-weight: 900; line-height: 1.2; text-transform: uppercase;">UPT PUSKESMAS PONCOKUSUMO</p>
                      <p style="margin: 2px 0 0 0; font-size: 9px; font-style: italic; line-height: 1.1;">Jalan Kusnan Marzuki No. 101, Wonomulyo, Kabupaten Malang, Jawa Timur</p>
                      <p style="margin: 1px 0; font-size: 9px; font-style: italic; line-height: 1.1;">Telpon/ Faksimile (0341) 2319509 Laman : puskesmasponcokusumo.malangkab.go.id</p>
                      <p style="margin: 1px 0; font-size: 9px; font-style: italic; line-height: 1.1;">Pos-el: pkmponcokusumo@gmail.com, Kode Pos : 65157</p>
                  </td>
                  <td style="width: 85px; text-align: right; vertical-align: middle; padding: 0;">
                      <img src={urlLogoKanan} style="height: 80px; width: 80px; object-fit: contain; display: block;" alt="Logo Kanan">
                  </td>
              </tr>
            </tbody>
          </table>
          <div style="border-top: 1px solid black; margin-top: 2px; margin-bottom: 15px;"></div>

          <table style="width: 100%; font-size: 10px; margin-bottom: 15px; border-collapse: collapse;">
            <tbody>
                {#each labelIdentitas as label, i}
                  {#if i % 2 === 0}
                    <tr>
                      <td style="width: 15%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #555; text-transform: uppercase; vertical-align: top;">{label}</td>
                      <td style="width: 33%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #000; text-transform: uppercase; vertical-align: top;">: {identitasValues[i] || '-'}</td>
                      <td style="width: 4%;"></td>
                      
                      {#if labelIdentitas[i+1]}
                        <td style="width: 15%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #555; text-transform: uppercase; vertical-align: top;">{labelIdentitas[i+1]}</td>
                        <td style="width: 33%; padding: 4px 0; border-bottom: 1px dotted #ccc; font-weight: bold; color: #000; text-transform: uppercase; vertical-align: top;">: {identitasValues[i+1] || '-'}</td>
                      {:else}
                        <td style="width: 15%;"></td><td style="width: 33%;"></td>
                      {/if}
                    </tr>
                  {/if}
                {/each}
            </tbody>
          </table>

          <h3 style="text-align: center; font-weight: bold; font-size: 14px; text-decoration: underline; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px;">Kuitansi Pembayaran</h3>
          
          <table style="width: 100%; border-top: 2px solid black; border-bottom: 2px solid black; background: #F9F9F9; margin-bottom: 30px; border-collapse: collapse;">
            <tbody>
              <tr>
                  <td style="padding: 20px; text-align: left; font-weight: bold; font-size: 12px; font-style: italic; text-transform: uppercase; vertical-align: middle;">
                      {keranjang.some(i=>i.nama.toLowerCase().includes("inap")) ? "Pelayanan Rawat Inap" : "Pelayanan Rawat Jalan/UGD"}
                  </td>
                  <td style="padding: 20px; text-align: right; font-weight: 900; font-size: 18px; font-family: 'Courier New', monospace; vertical-align: middle;">
                      Rp {totalHarga.toLocaleString('id-ID')}
                  </td>
              </tr>
            </tbody>
          </table>

          <table style="width: 100%; margin-top: 30px; font-size: 10px; text-align: center; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="width: 35%; vertical-align: bottom;">
                  <p style="margin: 0 0 50px 0;">Pasien/Keluarga,</p>
                  <p style="margin: 0;">( ................................ )</p>
                </td>
                <td style="width: 30%;"></td>
                <td style="width: 35%; vertical-align: bottom;">
                  <p style="margin: 0 0 5px 0;">Poncokusumo, {hariIni}</p>
                  <p style="margin: 0 0 50px 0;">Petugas Kasir,</p>
                  <p style="margin: 0; font-weight: bold; text-decoration: underline; text-transform: uppercase;">( ................................ )</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  {/if}
</div>

<style>
  .card-input { background: #FFFFFF; border: 2px solid #D4AF37; border-radius: 24px; padding: 28px; }
  .label-pro { color: #000; font-weight: 800; text-transform: uppercase; font-size: 11px; margin-bottom: 6px; display: block; }
  .input-search { width: 100%; padding: 1rem; border-radius: 0.75rem; background-color: #f8fafc; border: 1.5px solid #E2E8F0; font-weight: 700; color: #0F172A; outline: none;}
  .input-search:focus { border-color: #a435f0; }
  .btn-add-modern { background: #D4AF37; color: white; width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: transform 0.2s;}
  .btn-add-modern:hover { transform: scale(1.05); background: #c5a030;}
  .side-panel-keranjang { background: #0F172A; border-radius: 40px; padding: 24px; border: 2px solid #D4AF37; }
  .sidebar-item-2d { background: rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 14px; position: relative; border: 1px solid rgba(255, 255, 255, 0.1); }
  .sidebar-item-2d::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: #D4AF37; border-radius: 16px 0 0 16px;}
  
  .btn-qty-plus { background: #3b82f6; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; transition: background 0.2s;}
  .btn-qty-plus:hover { background: #2563eb; }
  .btn-qty-minus { background: #ef4444; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; transition: background 0.2s;}
  .btn-qty-minus:hover { background: #dc2626; }
  .qty-control { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 4px; border-radius: 12px; border: 1.5px solid #E2E8F0; height: 56px; }
  
  .btn-cetak { background: #D4AF37; color: white; font-weight: 900; border-radius: 1rem; padding: 1.25rem; text-transform: uppercase; cursor: pointer; border: none; transition: transform 0.2s; }
  .btn-cetak:hover:not(:disabled) { transform: scale(1.02); background: #c5a030; }
  
  .custom-scroll::-webkit-scrollbar { width: 4px; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 10px; }

  @media print { 
    @page { size: auto; margin: 0mm; } 
    body { background: white !important; padding: 5mm 10mm !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
    .no-print { display: none !important; } 
  }
</style>