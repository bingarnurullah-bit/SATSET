<script>
  import { onMount } from 'svelte';
  import { supabase } from './supabase.js';

  export let switchView;
  let activeTab = 'input'; // Pilihan: input, rekap, rekapObat, steling

  // =====================================
  // STATE: FORM BON OBAT
  // =====================================
  let pasienNama = "";
  let pasienTglLahir = "";
  let ruangan = "RAWAT INAP";
  let dokterDPJP = "";

  let obatInput = "";
  let qtyInput = 1;
  let listBon = [];

  let listObatMaster = [];
  let showDropdown = false;
  $: filteredObat = listObatMaster.filter(o => {
    if (!o) return false;
    if (!obatInput) return true;
    return o.toLowerCase().includes(obatInput.toLowerCase());
  });

  let isSaving = false;

  // =====================================
  // STATE: REKAP WA & EDIT
  // =====================================
  let isRekapLoading = false;
  let rekapItems = [];
  let txtLaporan = "";

  let showModalEdit = false;
  let editRowId = "";
  let editNama = "";
  let editTglLahir = "";
  let editDPJP = "";
  let editRuangan = "RAWAT INAP";
  let editItems = [];
  let editObatInput = "";
  let editQtyInput = 1;
  let isSavingEdit = false;
  let showDropdownEdit = false;

  $: filteredObatEdit = listObatMaster.filter(o => {
    if (!o) return false;
    if (!editObatInput) return true;
    return o.toLowerCase().includes(editObatInput.toLowerCase());
  });

  // =====================================
  // STATE: REKAP TOTAL ITEM OBAT TERPADU
  // =====================================
  let filterMulaiObat = "";
  let filterSelesaiObat = "";
  let dataRekapObat = [];
  let totalSemuaObat = 0;
  let isRekapItemLoading = false;

  // =====================================
  // STATE: STELING LOG
  // =====================================
  let stelingStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  let stelingEndDate = new Date().toISOString().split('T')[0];
  let stelingFilterObat = "SEMUA";
  let stelingItems = [];
  let isStelingLoading = false;

  // =====================================
  // INISIALISASI & SINKRONISASI
  // =====================================
  onMount(async () => {
    await fetchObatMaster();
  });

  $: if (activeTab === 'rekap') muatRekapHariIni();
  $: if (activeTab === 'rekapObat') {
      if (!filterMulaiObat) {
          const d = new Date().toISOString().split('T')[0];
          filterMulaiObat = d;
          filterSelesaiObat = d;
      }
      tarikDataObat();
  }
  $: if (activeTab === 'steling') tarikDataSteling();

  async function fetchObatMaster() {
    try {
      const { data, error } = await supabase.from('stok_obat_jaga').select('nama').order('nama', { ascending: true });
      if (error) throw error;
      if (data) listObatMaster = [...new Set(data.map(o => o.nama).filter(Boolean))];
    } catch (e) { console.error("Error muat obat:", e); }
  }

  // =====================================
  // FUNGSI FORM BON
  // =====================================
  function addItem() {
    if (!obatInput) return;
    const exactObat = listObatMaster.find(o => o.trim().toLowerCase() === obatInput.trim().toLowerCase());
    const finalObatName = exactObat ? exactObat : obatInput.trim().toUpperCase();
    const isStok = !!exactObat;

    listBon = [...listBon, { obat: finalObatName, jumlah: qtyInput, status: isStok ? "STOK" : "MANUAL" }];
    obatInput = ""; qtyInput = 1; showDropdown = false;
  }

  function hapusItem(idx) {
    listBon = listBon.filter((_, i) => i !== idx);
  }

  async function simpanBon() {
    if (!pasienNama.trim() || !dokterDPJP.trim()) return alert("Nama Pasien dan Dokter DPJP wajib diisi!");
    if (listBon.length === 0) return alert("Belum ada obat yang dimasukkan ke dalam daftar bon!");

    isSaving = true;
    const hariIni = new Date().toISOString().split('T')[0];
    const shiftID = `BON_${hariIni}`; 

    try {
      const { error } = await supabase.from('laporan_pasien').insert([{
        tanggal: hariIni, shift_id: shiftID, shift_nama: "BON_OBAT", nakes_info: `DPJP: ${dokterDPJP}`,
        nama: pasienNama.toUpperCase(), tgl_lahir: pasienTglLahir, rm: "-", diagnosa: "-",
        terapi: "-", ruangan: ruangan, status_pasien: "BON", biaya: 0,
        kendala: "", items: listBon
      }]);
      if (error) throw error;

      for (const item of listBon) {
        if (item.status === "STOK") {
          const { data: obatDiLaci } = await supabase.from('stok_obat_jaga').select('jumlah').eq('nama', item.obat).single();
          if (obatDiLaci) {
            const sisaBaru = obatDiLaci.jumlah - item.jumlah;
            const { error: errUpdate } = await supabase.from('stok_obat_jaga').update({ jumlah: sisaBaru }).eq('nama', item.obat);
            if (!errUpdate) {
              await supabase.from('log_steling_obat').insert({
                nama_obat: item.obat, jenis_mutasi: 'KELUAR', jumlah: item.jumlah, sisa_stok: sisaBaru,
                keterangan: `Bon ${ruangan}: ${pasienNama.toUpperCase()} (DPJP: ${dokterDPJP})`
              });
            }
          }
        }
      }
      alert("✅ Bon Obat Tersimpan!\nStok obat otomatis terpotong dan tercatat di Buku Steling.");
      pasienNama = ""; pasienTglLahir = ""; dokterDPJP = ""; listBon = [];
    } catch (err) { alert("Gagal menyimpan: " + err.message); } finally { isSaving = false; }
  }

  // =====================================
  // FUNGSI REKAP WA & EDIT
  // =====================================
  async function muatRekapHariIni() {
    isRekapLoading = true;
    const hariIni = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase.from('laporan_pasien').select('*').eq('shift_id', `BON_${hariIni}`).order('created_at', { ascending: true });
      if (error) throw error;
      rekapItems = data || [];
      rakitLaporanWA(rekapItems);
    } catch (err) { alert("Gagal memuat rekap."); } finally { isRekapLoading = false; }
  }

  function rakitLaporanWA(dataList) {
    const dateObj = new Date();
    const tglStr = `${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`;

    const listInap = dataList.filter(p => p.ruangan === "RAWAT INAP");
    const listKaber = dataList.filter(p => p.ruangan === "KABER");

    const formatTgl = (tgl) => { 
        if (!tgl) return "-"; 
        const parts = tgl.split('-'); 
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : tgl; 
    }

    const renderList = (list) => {
      if (list.length === 0) return `_- Nihil -_\n\n`;
      let str = "";
      list.forEach(p => {
        let obatStr = (p.items || []).map(it => `${it.obat} (${it.jumlah})`).join(', ');
        str += `👤 *${p.nama}* (DPJP: ${p.nakes_info.replace('DPJP: ','')})\n ├ 🎂 Tgl Lahir: ${formatTgl(p.tgl_lahir)}\n └ 💊 Obat: ${obatStr}\n\n`;
      });
      return str;
    };

    const rekapInap = {}; const rekapKaber = {};
    listInap.forEach(p => { (p.items || []).forEach(it => { rekapInap[it.obat] = (rekapInap[it.obat] || 0) + Number(it.jumlah); }); });
    listKaber.forEach(p => { (p.items || []).forEach(it => { rekapKaber[it.obat] = (rekapKaber[it.obat] || 0) + Number(it.jumlah); }); });

    const renderRekap = (obj) => { const keys = Object.keys(obj).sort(); return keys.length === 0 ? ` • -\n` : keys.map(k => ` • ${k}: ${obj[k]}`).join('\n') + '\n'; };

    let txt = `🏥 *LAPORAN BON OBAT RAWAT INAP & KABER*\n📅 ${tglStr}\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    txt += `🛌 *RAWAT INAP*\n${renderList(listInap)}━━━━━━━━━━━━━━━━━━━━\n\n`;
    txt += `🌸 *KABER*\n${renderList(listKaber)}━━━━━━━━━━━━━━━━━━━━\n\n`;
    txt += `📦 *REKAP TOTAL OBAT KELUAR*\n\n📍 *RAWAT INAP:*\n${renderRekap(rekapInap)}\n📍 *KABER:*\n${renderRekap(rekapKaber)}\n━━━━━━━━━━━━━━━━━━━━\n✅ _Laporan Selesai_`;
    txtLaporan = txt;
  }

  function bukaModalEdit(it) {
    editRowId = it.id;
    editNama = it.nama;
    editTglLahir = it.tgl_lahir || "";
    editDPJP = it.nakes_info.replace('DPJP: ', '');
    editRuangan = it.ruangan;
    editItems = JSON.parse(JSON.stringify(it.items || [])); 
    editObatInput = ""; editQtyInput = 1; showModalEdit = true;
  }

  function tambahEditItem() {
    if (!editObatInput) return;
    const exactObat = listObatMaster.find(o => o.trim().toLowerCase() === editObatInput.trim().toLowerCase());
    const finalObatName = exactObat ? exactObat : editObatInput.trim().toUpperCase();
    const isStok = !!exactObat;

    editItems = [...editItems, { obat: finalObatName, jumlah: editQtyInput, status: isStok ? "STOK" : "MANUAL" }];
    editObatInput = ""; editQtyInput = 1; showDropdownEdit = false;
  }

  function hapusEditItem(idx) { editItems = editItems.filter((_, i) => i !== idx); }

  async function simpanEditBon() {
    if (!editNama.trim() || !editDPJP.trim()) return alert("Nama dan DPJP tidak boleh kosong!");
    isSavingEdit = true;

    try {
      const { error } = await supabase.from('laporan_pasien').update({
        nama: editNama.toUpperCase(), tgl_lahir: editTglLahir, nakes_info: `DPJP: ${editDPJP}`, ruangan: editRuangan, items: editItems
      }).eq('id', editRowId);
      if (error) throw error;
      
      alert("✅ Data Bon berhasil diubah!\n\nCatatan: Perubahan Obat ini HANYA mengubah teks di Laporan WA. Jika ada perubahan fisik obat, silakan kurangi/tambah stok laci (Steling) secara manual.");
      showModalEdit = false; muatRekapHariIni();
    } catch (e) { alert("Terjadi kesalahan: " + e.message); } finally { isSavingEdit = false; }
  }

  async function hapusBaris(id) {
     if(confirm("Hapus permanen data bon ini? (Perhatian: Stok di steling tidak akan kembali secara otomatis)")) {
        await supabase.from('laporan_pasien').delete().eq('id', id); muatRekapHariIni();
     }
  }
  function kirimWA() { window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(txtLaporan), "_blank"); }

  // =====================================
  // 🔥 FUNGSI TOTAL ITEM OBAT (REKAP TERPADU 4 KOLOM) 🔥
  // =====================================
  async function tarikDataObat() {
    isRekapItemLoading = true;
    try {
      // SEDOT SEMUA DATA SHIFT & BON TANPA KECUALI!
      let query = supabase.from('laporan_pasien').select('shift_nama, ruangan, items');
      if (filterMulaiObat) query = query.gte('tanggal', filterMulaiObat);
      if (filterSelesaiObat) query = query.lte('tanggal', filterSelesaiObat);
      
      const { data, error } = await query;
      if (error) throw error;

      let rekap = {};
      totalSemuaObat = 0;
      
      (data || []).forEach(p => {
        (p.items || []).forEach(it => {
          if (!it.obat || it.obat === "-") return;
          let namaObat = it.obat.toUpperCase();
          if (!rekap[namaObat]) {
             // Inisialisasi 4 Sub Kolom
             rekap[namaObat] = { nama: namaObat, jaga_ugd: 0, jaga_kaber: 0, bon_ranap: 0, bon_kaber: 0, total: 0 };
          }
          
          let qty = Number(it.jumlah) || 0;
          
          // Pisahkan berdasarkan sumbernya (Bon Obat VS Laporan Jaga)
          if (p.shift_nama === 'BON_OBAT') {
              if (p.ruangan === 'RAWAT INAP') rekap[namaObat].bon_ranap += qty;
              if (p.ruangan === 'KABER') rekap[namaObat].bon_kaber += qty;
          } else {
              // Selain Bon Obat, kita anggap dari Laporan Shift UGD
              if (p.ruangan === 'UGD') rekap[namaObat].jaga_ugd += qty;
              if (p.ruangan === 'KABER') rekap[namaObat].jaga_kaber += qty;
          }
          
          rekap[namaObat].total += qty;
          totalSemuaObat += qty;
        });
      });
      dataRekapObat = Object.values(rekap).sort((a,b) => b.total - a.total);
    } catch(e) {
      alert("Gagal memuat rekap obat.");
    } finally {
      isRekapItemLoading = false;
    }
  }

  // =====================================
  // FUNGSI STELING LOG TERPUSAT
  // =====================================
  async function tarikDataSteling() {
    if (!stelingStartDate || !stelingEndDate) return;
    isStelingLoading = true;
    try {
      let query = supabase.from('log_steling_obat').select('*')
        .gte('created_at', `${stelingStartDate}T00:00:00`)
        .lte('created_at', `${stelingEndDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (stelingFilterObat !== "SEMUA") {
        query = query.eq('nama_obat', stelingFilterObat);
      }
      const { data, error } = await query;
      if (error) throw error;
      stelingItems = data || [];
    } catch (e) {
      console.error("Gagal muat steling:", e.message);
    } finally {
      isStelingLoading = false;
    }
  }
</script>

<div class="animate-fade-in bg-[#eef2f5] min-h-screen pb-20 relative">
  <div class="max-w-6xl mx-auto px-4 pt-6 pb-2 flex justify-between items-center no-print">
    <button on:click={() => switchView('app-jaga-menu')} class="text-[#a435f0] font-bold text-sm flex items-center hover:underline">
      <span class="material-icons text-sm mr-1">arrow_back</span> Kembali ke Menu Shift
    </button>
  </div>

  <div class="max-w-5xl mx-auto px-4 mt-4">
    
    <div class="w-full h-32 overflow-hidden relative border-b-4 border-emerald-600 mb-6 rounded-t-lg shadow-md no-print">
      <img src="https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=1200" class="w-full h-full object-cover filter brightness-50" alt="Banner">
      <div class="absolute bottom-0 left-0 right-0 p-6 text-white">
        <h1 class="text-3xl font-extrabold tracking-tight">💊 BON OBAT</h1>
        <p class="text-sm opacity-90 uppercase tracking-widest font-bold text-emerald-400 mt-1">Rawat Inap & Kamar Bersalin</p>
      </div>
    </div>

<div class="sticky top-20 z-40 max-w-5xl mx-auto px-4 py-4 flex justify-center w-full no-print">
    <div class="bg-slate-200/80 backdrop-blur-md p-2 md:p-3 rounded-[2rem] shadow-lg border border-slate-300 w-full flex flex-col items-center">
      <div class="flex flex-wrap justify-center gap-2 md:gap-3 w-full">
        
        <button on:click={() => { activeTab = 'input'; window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                class="px-4 py-3 md:px-6 md:py-3 rounded-2xl font-bold text-sm transition-all duration-300 flex-1 min-w-[140px] flex justify-center items-center {activeTab === 'input' ? 'bg-gradient-to-br from-purple-700 to-purple-900 text-white shadow-inner' : 'bg-white text-gray-600 hover:bg-gradient-to-br hover:from-purple-700 hover:to-purple-900 hover:text-white hover:shadow-inner'}">
          <span class="material-icons text-sm mr-2">edit_document</span> Form Pasien
        </button>

        <button on:click={() => { activeTab = 'rekap'; window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                class="px-4 py-3 md:px-6 md:py-3 rounded-2xl font-bold text-sm transition-all duration-300 flex-1 min-w-[140px] flex justify-center items-center {activeTab === 'rekap' ? 'bg-gradient-to-br from-purple-700 to-purple-900 text-white shadow-inner' : 'bg-white text-gray-600 hover:bg-gradient-to-br hover:from-purple-700 hover:to-purple-900 hover:text-white hover:shadow-inner'}">
          <span class="material-icons text-sm mr-2">chat</span> Rekap WA
        </button>

        <button on:click={() => { activeTab = 'rekapObat'; window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                class="px-4 py-3 md:px-6 md:py-3 rounded-2xl font-bold text-sm transition-all duration-300 flex-1 min-w-[140px] flex justify-center items-center {activeTab === 'rekapObat' ? 'bg-gradient-to-br from-purple-700 to-purple-900 text-white shadow-inner' : 'bg-white text-gray-600 hover:bg-gradient-to-br hover:from-purple-700 hover:to-purple-900 hover:text-white hover:shadow-inner'}">
          <span class="material-icons text-sm mr-2">inventory_2</span> Total Obat Keluar
        </button>

        <button on:click={() => { activeTab = 'steling'; window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                class="px-4 py-3 md:px-6 md:py-3 rounded-2xl font-bold text-sm transition-all duration-300 flex-1 min-w-[140px] flex justify-center items-center {activeTab === 'steling' ? 'bg-gradient-to-br from-purple-700 to-purple-900 text-white shadow-inner' : 'bg-white text-gray-600 hover:bg-gradient-to-br hover:from-purple-700 hover:to-purple-900 hover:text-white hover:shadow-inner'}">
          <span class="material-icons text-sm mr-2">receipt_long</span> Steling Log
        </button>

      </div>
    </div>
  </div>
  
    {#if activeTab === 'input'}
      <div class="bg-white border-2 border-emerald-600 p-8 rounded-lg shadow-[8px_8px_0px_rgba(5,150,105,0.2)] mb-8 animate-fade-in">
        <h2 class="font-black text-xl mb-6 uppercase border-b-2 border-slate-100 pb-3">Identitas Pasien</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label class="block text-xs font-bold text-slate-700 uppercase mb-2">Nama Pasien</label><input type="text" bind:value={pasienNama} class="w-full p-3 border rounded bg-slate-50 uppercase focus:border-emerald-500 outline-none" placeholder="Nama Lengkap"></div>
          <div><label class="block text-xs font-bold text-slate-700 uppercase mb-2">Tanggal Lahir</label><input type="date" bind:value={pasienTglLahir} class="w-full p-3 border rounded bg-slate-50 focus:border-emerald-500 outline-none"></div>
          <div><label class="block text-xs font-bold text-slate-700 uppercase mb-2">Dokter DPJP</label><input type="text" bind:value={dokterDPJP} class="w-full p-3 border rounded bg-slate-50 focus:border-emerald-500 outline-none" placeholder="dr. Nama Dokter"></div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Ruangan</label>
            <select bind:value={ruangan} class="w-full p-3 border rounded bg-slate-50 font-bold focus:border-emerald-500 outline-none">
              <option value="RAWAT INAP">Rawat Inap</option>
              <option value="KABER">Kamar Bersalin (KABER)</option>
            </select>
          </div>
        </div>

        <div class="mt-8 p-6 bg-emerald-50/50 border-2 border-dashed border-emerald-200 rounded-lg">
          <h3 class="font-extrabold text-sm mb-4 uppercase tracking-wider text-emerald-800">📦 Daftar Permintaan Obat</h3>
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1 relative">
              <input type="text" bind:value={obatInput} on:focus={() => showDropdown = true} on:blur={() => setTimeout(() => showDropdown = false, 300)} class="w-full p-3 border rounded uppercase focus:border-emerald-500 outline-none" placeholder="Ketik nama obat...">
              {#if showDropdown && filteredObat.length > 0}
                <ul class="absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto rounded">
                  {#each filteredObat as o}
                    <li on:mousedown|preventDefault={() => { obatInput = o; showDropdown = false; }} class="px-4 py-2 hover:bg-emerald-600 hover:text-white cursor-pointer text-sm font-bold border-b">{o}</li>
                  {/each}
                </ul>
              {/if}
            </div>
            <div class="w-full sm:w-24 text-center"><input type="number" bind:value={qtyInput} min="1" class="w-full p-3 border rounded text-center focus:border-emerald-500 outline-none"></div>
            <button on:click={addItem} class="bg-emerald-600 text-white font-bold px-4 py-3 rounded hover:bg-emerald-700 whitespace-nowrap">Tambah</button>
          </div>
          
          <div class="mt-4 space-y-2">
            {#each listBon as it, i}
              <div class="bg-white border p-3 flex justify-between items-center text-sm rounded shadow-sm">
                <div class="font-bold">{it.obat} <span class="text-emerald-600 ml-1">x{it.jumlah}</span></div>
                <button on:click={() => hapusItem(i)} class="text-red-500 hover:text-red-700 font-bold text-xs uppercase">Hapus</button>
              </div>
            {/each}
          </div>
        </div>

        <button on:click={simpanBon} disabled={isSaving} class="w-full mt-8 bg-slate-900 text-white font-black py-4 rounded-lg uppercase tracking-widest hover:bg-black transition-colors flex justify-center items-center shadow-lg">
          {#if isSaving}<span class="material-icons animate-spin mr-2">sync</span> Menyimpan...{:else}Simpan Bon Obat{/if}
        </button>
      </div>

    {:else if activeTab === 'rekap'}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
        <div class="bg-white p-6 rounded-lg shadow border border-gray-200">
           <div class="flex justify-between items-center mb-4 border-b pb-2">
             <h2 class="font-black text-lg text-slate-800">Daftar Pasien Hari Ini</h2>
             <button on:click={muatRekapHariIni} class="text-xs bg-slate-100 font-bold px-3 py-1.5 rounded hover:bg-slate-200 flex items-center"><span class="material-icons text-sm mr-1 {isRekapLoading ? 'animate-spin' : ''}">sync</span> Muat Ulang</button>
           </div>
           <div class="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scroll">
             {#if isRekapLoading} <div class="text-center p-4 text-gray-500">Memuat data...</div>
             {:else if rekapItems.length === 0} <div class="text-center p-4 text-gray-400 italic">Belum ada bon obat hari ini.</div>
             {:else}
               {#each rekapItems as it}
                 <div class="border p-3 rounded-lg hover:border-emerald-400 transition-colors">
                    <div class="flex justify-between">
                       <span class="font-black text-sm uppercase">{it.nama}</span>
                       <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">{it.ruangan}</span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">DPJP: {it.nakes_info.replace('DPJP: ','')} | Tgl Lahir: {it.tgl_lahir ? it.tgl_lahir.split('-').reverse().join('/') : '-'}</div>
                    <div class="mt-2 text-xs font-bold text-slate-700 bg-slate-50 p-2 rounded border">
                       {(it.items||[]).map(o => `${o.obat} (${o.jumlah})`).join(', ')}
                    </div>
                    <div class="mt-3 text-right">
                       <button on:click={() => bukaModalEdit(it)} class="text-xs font-bold text-blue-600 hover:underline mr-3 px-2 py-1 bg-blue-50 rounded">✏️ Edit</button>
                       <button on:click={() => hapusBaris(it.id)} class="text-xs font-bold text-red-600 hover:underline px-2 py-1 bg-red-50 rounded">🗑️ Hapus</button>
                    </div>
                 </div>
               {/each}
             {/if}
           </div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow border border-gray-200 sticky top-6 h-fit">
           <h2 class="font-black text-lg text-slate-800 mb-4 border-b pb-2">Pratinjau Laporan WA</h2>
           <textarea bind:value={txtLaporan} class="w-full h-[350px] p-3 border rounded bg-slate-50 font-mono text-xs focus:outline-none custom-scroll" readonly placeholder="Laporan akan muncul di sini..."></textarea>
           <button on:click={kirimWA} disabled={!txtLaporan} class="w-full mt-4 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center">Kirim ke WhatsApp <span class="material-icons text-sm ml-2">send</span></button>
        </div>
      </div>

    {:else if activeTab === 'rekapObat'}
      <div class="bg-white p-6 md:p-8 rounded-lg shadow-sm border border-gray-200 animate-fade-in">
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b pb-4 no-print">
           <h2 class="font-black text-xl text-slate-800 flex items-center"><span class="material-icons mr-2 text-purple-600">inventory_2</span> Total Rekap Obat Terpadu</h2>
           <div class="flex gap-2 w-full md:w-auto">
              <input type="date" bind:value={filterMulaiObat} class="p-2 border rounded bg-slate-50 text-sm w-full md:w-auto font-bold">
              <span class="py-2 text-gray-400 font-bold">-</span>
              <input type="date" bind:value={filterSelesaiObat} class="p-2 border rounded bg-slate-50 text-sm w-full md:w-auto font-bold">
              <button on:click={tarikDataObat} class="bg-slate-900 text-white px-5 py-2 rounded font-bold text-sm hover:bg-black whitespace-nowrap flex items-center">
                 <span class="material-icons text-sm mr-1 {isRekapItemLoading ? 'animate-spin' : ''}">search</span> Cari
              </button>
           </div>
        </div>

<div class="overflow-x-auto rounded-lg border border-black shadow-md">
           <table class="w-full text-sm text-left border-collapse">
              <thead class="bg-black text-white">
                 <tr>
                    <th rowspan="2" class="p-3 font-bold text-center w-12 border-r border-white align-middle">No</th>
                    <th rowspan="2" class="p-3 font-bold border-r border-white uppercase align-middle">Nama Obat / BMHP</th>
                    <th colspan="2" class="p-2 font-bold text-center border-b border-r border-white uppercase">Laporan Shift (Jaga)</th>
                    <th colspan="2" class="p-2 font-bold text-center border-b border-r border-white uppercase">Bon Obat</th>
                    <th rowspan="2" class="p-3 font-bold text-center uppercase align-middle">Total Keluar</th>
                 </tr>
                 <tr>
                    <th class="p-2 text-center border-r border-white text-xs uppercase">UGD</th>
                    <th class="p-2 text-center border-r border-white text-xs uppercase">KABER</th>
                    <th class="p-2 text-center border-r border-white text-xs uppercase">RANAP</th>
                    <th class="p-2 text-center border-r border-white text-xs uppercase">KABER</th>
                 </tr>
              </thead>
              <tbody>
                 {#if isRekapItemLoading}
                    <tr><td colspan="7" class="text-center p-8 text-black font-bold"><span class="material-icons animate-spin mr-2 align-middle">sync</span> Memproses data...</td></tr>
                 {:else if dataRekapObat.length === 0}
                    <tr><td colspan="7" class="text-center p-8 text-gray-500 italic">Tidak ada pengeluaran obat pada rentang tanggal ini.</td></tr>
                 {:else}
                    {#each dataRekapObat as it, idx}
                       <tr class="border-b border-black hover:bg-gray-100 transition-colors text-black">
                          <td class="p-3 text-center border-r border-black font-bold">{idx + 1}</td>
                          <td class="p-3 font-bold border-r border-black">{it.nama}</td>
                          <td class="p-3 text-center border-r border-black font-normal">{it.jaga_ugd === 0 ? '-' : it.jaga_ugd}</td>
                          <td class="p-3 text-center border-r border-black font-normal">{it.jaga_kaber === 0 ? '-' : it.jaga_kaber}</td>
                          <td class="p-3 text-center border-r border-black font-normal">{it.bon_ranap === 0 ? '-' : it.bon_ranap}</td>
                          <td class="p-3 text-center border-r border-black font-normal">{it.bon_kaber === 0 ? '-' : it.bon_kaber}</td>
                          
                          <td class="p-3 text-center font-black text-white bg-gradient-to-br from-purple-700 to-purple-900 shadow-inner text-base">{it.total}</td>
                       </tr>
                    {/each}
                    <tr class="bg-gray-200 font-black border-t-2 border-black text-black">
                       <td colspan="6" class="p-4 text-right uppercase border-r border-black tracking-wider">Total Seluruh Item Keluar :</td>
                       
                       <td class="p-4 text-center text-white bg-gradient-to-br from-purple-700 to-purple-900 shadow-inner text-xl">{totalSemuaObat}</td>
                    </tr>
                 {/if}
              </tbody>
           </table>
        </div>
      </div>

    {:else if activeTab === 'steling'}
      <div class="bg-white p-6 md:p-8 rounded-lg shadow-sm border border-gray-200 animate-fade-in">
        <div class="mb-6 border-b pb-4 flex justify-between items-end no-print">
           <div>
              <h2 class="font-black text-xl text-slate-800 flex items-center"><span class="material-icons mr-2 text-slate-900">receipt_long</span> Buku Catatan Steling Obat</h2>
              <p class="text-sm text-gray-500 mt-1">Merekam mutasi fisik Laci Jaga secara terpusat (Satu Pintu dengan Laporan UGD).</p>
           </div>
        </div>

        <div class="bg-[#f7f9fa] p-5 rounded-lg border border-[#d1d7dc] mb-6 flex flex-col xl:flex-row gap-4 items-end justify-between no-print">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <div class="w-full">
              <span class="block mt-0 mb-1 text-xs font-bold text-gray-600 uppercase">Tanggal Mulai</span>
              <input type="date" bind:value={stelingStartDate} class="w-full p-2 border border-gray-300 rounded bg-white focus:border-slate-500 outline-none">
            </div>
            <div class="w-full">
              <span class="block mt-0 mb-1 text-xs font-bold text-gray-600 uppercase">Tanggal Selesai</span>
              <input type="date" bind:value={stelingEndDate} class="w-full p-2 border border-gray-300 rounded bg-white focus:border-slate-500 outline-none">
            </div>
            <div class="w-full">
              <span class="block mt-0 mb-1 text-xs font-bold text-gray-600 uppercase">Filter Spesifik Obat</span>
              <select bind:value={stelingFilterObat} class="w-full p-2 border border-gray-300 rounded bg-white font-bold focus:border-slate-500 outline-none">
                <option value="SEMUA">-- SEMUA OBAT --</option>
                {#each listObatMaster as obat}
                   <option value={obat}>{obat}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="flex gap-3 w-full xl:w-auto mt-2 xl:mt-0">
            <button on:click={tarikDataSteling} class="bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-5 rounded text-sm flex items-center justify-center transition-colors shadow-md h-[42px] flex-1 xl:flex-none whitespace-nowrap">
              <span class="material-icons text-sm mr-2 {isStelingLoading ? 'animate-spin' : ''}">search</span> Terapkan Filter
            </button>
            <button on:click={() => alert('Fitur Cetak PDF penuh tersedia di menu "Laporan Shift UGD > Steling Log".')} class="bg-slate-900 text-white hover:bg-black font-bold px-5 rounded text-sm flex items-center justify-center transition-colors shadow-md h-[42px] flex-1 xl:flex-none whitespace-nowrap">
              <span class="material-icons text-sm mr-2">print</span> Cetak PDF
            </button>
          </div>
        </div>

        <div class="overflow-x-auto rounded-lg border border-gray-200">
           <table class="w-full text-sm text-left">
              <thead class="bg-slate-900 text-white">
                 <tr>
                    <th class="p-3 font-bold w-32 border-r border-slate-700 text-center">Waktu</th>
                    <th class="p-3 font-bold border-r border-slate-700">Nama Obat</th>
                    <th class="p-3 font-bold text-center w-24 border-r border-slate-700">Mutasi</th>
                    <th class="p-3 font-bold text-center w-20 border-r border-slate-700">Qty</th>
                    <th class="p-3 font-bold text-center w-24 border-r border-slate-700">Sisa Stok</th>
                    <th class="p-3 font-bold w-1/3">Keterangan</th>
                 </tr>
              </thead>
              <tbody>
                 {#if isStelingLoading}
                    <tr><td colspan="6" class="text-center p-8 text-gray-500"><span class="material-icons animate-spin mr-2 align-middle">sync</span> Menarik log database...</td></tr>
                 {:else if stelingItems.length === 0}
                    <tr><td colspan="6" class="text-center p-8 text-gray-400 italic">Belum ada catatan mutasi steling.</td></tr>
                 {:else}
                    {#each stelingItems as it}
                       <tr class="border-b border-gray-100 hover:bg-gray-50">
                          <td class="p-3 text-xs text-gray-500 border-r border-gray-100 text-center">{new Date(it.created_at).toLocaleString('id-ID', {day:'numeric', month:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit'})}</td>
                          <td class="p-3 font-bold text-slate-800 border-r border-gray-100">{it.nama_obat}</td>
                          <td class="p-3 text-center font-bold border-r border-gray-100 {it.jenis_mutasi === 'KELUAR' ? 'text-red-600' : (it.jenis_mutasi === 'MASUK' ? 'text-emerald-600' : 'text-blue-600')}">{it.jenis_mutasi}</td>
                          <td class="p-3 text-center font-black text-lg border-r border-gray-100">{it.jumlah === 0 ? '-' : it.jumlah}</td>
                          <td class="p-3 text-center font-bold text-blue-700 bg-blue-50/50 border-r border-gray-100">{it.sisa_stok}</td>
                          <td class="p-3 text-xs text-gray-500 leading-tight">{it.keterangan || '-'}</td>
                       </tr>
                    {/each}
                 {/if}
              </tbody>
           </table>
        </div>
      </div>
    {/if}
  </div>

  {#if showModalEdit}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4 backdrop-blur-sm">
     <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        <div class="bg-emerald-600 p-4 text-white font-bold flex justify-between items-center shrink-0">
           <span class="flex items-center"><span class="material-icons mr-2">edit_document</span> Edit Bon Obat Pasien</span>
           <button on:click={() => showModalEdit = false} class="text-white hover:text-gray-200 bg-emerald-700 hover:bg-emerald-800 rounded-full p-1"><span class="material-icons text-sm">close</span></button>
        </div>
        
        <div class="p-6 overflow-y-auto custom-scroll flex-1">
           <h3 class="font-bold text-sm text-slate-500 uppercase border-b pb-2 mb-4">Identitas Pasien</h3>
           <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                 <label class="block text-xs font-bold text-gray-700 mb-1 uppercase">Nama Pasien</label>
                 <input type="text" bind:value={editNama} class="w-full p-2 border rounded bg-gray-50 uppercase focus:border-emerald-500 outline-none">
              </div>
              <div>
                 <label class="block text-xs font-bold text-gray-700 mb-1 uppercase">Tanggal Lahir</label>
                 <input type="date" bind:value={editTglLahir} class="w-full p-2 border rounded bg-gray-50 focus:border-emerald-500 outline-none">
              </div>
              <div>
                 <label class="block text-xs font-bold text-gray-700 mb-1 uppercase">Dokter DPJP</label>
                 <input type="text" bind:value={editDPJP} class="w-full p-2 border rounded bg-gray-50 focus:border-emerald-500 outline-none">
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1 uppercase">Ruangan</label>
                <select bind:value={editRuangan} class="w-full p-2 border rounded bg-gray-50 font-bold focus:border-emerald-500 outline-none">
                  <option value="RAWAT INAP">Rawat Inap</option>
                  <option value="KABER">Kamar Bersalin (KABER)</option>
                </select>
              </div>
           </div>

           <h3 class="font-bold text-sm text-slate-500 uppercase border-b pb-2 mb-4">Daftar Obat Pasien</h3>
           
           <div class="bg-slate-50 border rounded-lg p-4 mb-4">
              {#if editItems.length === 0}
                <div class="text-xs text-gray-400 italic text-center">Kosong</div>
              {:else}
                {#each editItems as it, idx}
                  <div class="flex justify-between items-center bg-white p-2 border rounded mb-2 shadow-sm">
                    <span class="text-sm font-bold uppercase">{it.obat} <span class="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded ml-2">Qty: {it.jumlah}</span></span>
                    <button on:click={() => hapusEditItem(idx)} class="text-red-500 hover:text-red-700"><span class="material-icons text-sm">delete</span></button>
                  </div>
                {/each}
              {/if}
           </div>

           <div class="flex flex-col sm:flex-row gap-2 items-end bg-emerald-50 p-4 border border-emerald-100 rounded-lg">
              <div class="flex-1 relative w-full">
                 <label class="block text-[10px] font-bold text-emerald-800 mb-1 uppercase">Tambah Obat</label>
                 <input type="text" bind:value={editObatInput} on:focus={() => showDropdownEdit = true} on:blur={() => setTimeout(() => showDropdownEdit = false, 300)} class="w-full p-2 border rounded uppercase focus:border-emerald-500 outline-none text-sm" placeholder="Ketik nama obat...">
                 {#if showDropdownEdit && filteredObatEdit.length > 0}
                   <ul class="absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-xl max-h-40 overflow-y-auto rounded">
                     {#each filteredObatEdit as o}
                       <li on:mousedown|preventDefault={() => { editObatInput = o; showDropdownEdit = false; }} class="px-3 py-2 hover:bg-emerald-600 hover:text-white cursor-pointer text-xs font-bold border-b">{o}</li>
                     {/each}
                   </ul>
                 {/if}
              </div>
              <div class="w-20">
                 <label class="block text-[10px] font-bold text-emerald-800 mb-1 uppercase">Qty</label>
                 <input type="number" bind:value={editQtyInput} min="1" class="w-full p-2 border rounded text-center focus:border-emerald-500 outline-none text-sm">
              </div>
              <button on:click={tambahEditItem} class="bg-emerald-600 text-white font-bold px-4 py-2 rounded hover:bg-emerald-700 text-sm h-[38px]">Tambah</button>
           </div>
        </div>

        <div class="p-4 bg-gray-100 flex justify-end gap-3 border-t shrink-0">
           <button on:click={() => showModalEdit = false} class="px-5 py-2 text-sm font-bold text-gray-600 hover:text-black">Batal</button>
           <button on:click={simpanEditBon} disabled={isSavingEdit} class="px-5 py-2 text-sm font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-md flex items-center">
             {#if isSavingEdit}<span class="material-icons animate-spin text-sm mr-2">sync</span>{/if}
             {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
           </button>
        </div>
     </div>
  </div>
  {/if}
</div>

<style>
  .custom-scroll::-webkit-scrollbar { width: 6px; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #10b981; border-radius: 10px; }
  .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>