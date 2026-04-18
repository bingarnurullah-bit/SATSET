<script>
  import { onMount } from 'svelte';
  import { supabase } from './supabase.js';

  // Props dari App.svelte
  export let switchView;
  export let activeTab = 'input'; // 'input', 'rekap', 'rekapObat'

  // =====================================
  // STATE: TIM JAGA
  // =====================================
  let currentShiftJaga = "";
  let nakesText = "";
  let nakesForm = { s: "PAGI", dr: "", p1: "", p2: "", p3: "", b1: "", b2: "" };

  // =====================================
  // STATE: FORM PASIEN
  // =====================================
  let jagaNama = "";
  let jagaTglLahir = "";
  let jagaNorm = "";
  let jagaStatusPasien = "BPJS";
  let jagaBiaya = "0";
  let jagaDiagnosa = "";
  let jagaRuangan = "UGD";
  let jagaTerapi = "";
  let jagaKendala = "";
  
  let obatInput = "";
  let qtyInput = 1;
  let listJaga = []; // Keranjang obat pasien
  
  // Master Data Obat
  let jagaObatUmum = [];
  let jagaObatKaber = [];
  $: activeObatList = jagaRuangan === "KABER" ? jagaObatKaber : jagaObatUmum;
  $: listObatDataAll = [...jagaObatUmum, ...jagaObatKaber];

  let isSavingJaga = false;

  // =====================================
  // STATE: REKAP JAGA & LAPORAN WA
  // =====================================
  let isRekapLoading = false;
  let rekapItems = [];
  let editKendalaShift = "";
  let txtLaporan = "";
  let isSavingKendala = false;

  // =====================================
  // STATE: REKAP PENGGUNAAN OBAT
  // =====================================
  let filterMulaiObat = "";
  let filterSelesaiObat = "";
  let dataRekapObat = [];
  let totalSemuaObat = 0;

  // =====================================
  // STATE: MODAL
  // =====================================
  let showModalEdit = false;
  let editRow = ""; 
  let editNama = "";
  let editRM = "";
  let editTerapi = "";
  let editObat = "";
  let editJumlah = "";
  let isSavingEdit = false;

  let showModalTambah = false;
  let addObatRow = ""; 
  let addObatNama = "";
  let addObatRM = "";
  let addObatInput = "";
  let addObatJumlah = 1;
  let isSavingAdd = false;

  // =====================================
  // INISIALISASI
  // =====================================
  onMount(() => {
    checkNakes();
    fetchObatMaster();
  });

  $: if (activeTab === 'rekap' && currentShiftJaga) {
    muatDataDanLaporan();
  }
  $: if (activeTab === 'rekapObat') {
    if (!filterMulaiObat) setBulanIniObat();
    else tarikDataObat();
  }

  async function fetchObatMaster() {
    try {
      const { data, error } = await supabase.from('master_obat').select('nama').order('nama', { ascending: true });
      if (error) throw error;
      
      const daftarNama = data.map(o => o.nama);
      jagaObatUmum = daftarNama;
      jagaObatKaber = daftarNama;
    } catch (e) {
      console.log("Gagal memuat daftar obat:", e.message);
    }
  }

  // =====================================
  // FUNGSI TIM JAGA
  // =====================================
  function checkNakes() {
    const s = localStorage.getItem('nakesPKM');
    if (s) {
      const d = JSON.parse(s);
      currentShiftJaga = d.s;
      nakesText = `SESI JAGA AKTIF: ${d.s}<br><span class='font-normal text-xs text-gray-300'>Dr. ${d.dr || '-'} | P: ${d.p || '-'} | B: ${d.b || '-'}</span>`;
    } else {
      currentShiftJaga = "";
    }
  }

  function setNakes() {
    const pArray = [nakesForm.p1, nakesForm.p2, nakesForm.p3].filter(Boolean).join(", ");
    const bArray = [nakesForm.b1, nakesForm.b2].filter(Boolean).join(", ");
    const d = { s: nakesForm.s, dr: nakesForm.dr, p: pArray, b: bArray };
    localStorage.setItem('nakesPKM', JSON.stringify(d));
    checkNakes();
  }

  function editNakes() {
    localStorage.removeItem('nakesPKM');
    checkNakes();
  }

  // =====================================
  // FUNGSI FORM PASIEN
  // =====================================
  function handleFormatRupiah(e) {
    let v = e.target.value.replace(/\D/g, "");
    jagaBiaya = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function addJagaItem() {
    if (!obatInput) return;
    const isStok = activeObatList.some(o => o.trim().toLowerCase() === obatInput.trim().toLowerCase());
    listJaga = [...listJaga, {
      obat: obatInput.trim().toUpperCase(),
      jumlah: qtyInput,
      sumber: jagaRuangan,
      status: isStok ? "STOK" : "MANUAL"
    }];
    obatInput = "";
    qtyInput = 1;
  }

  function hapusJagaItem(index) {
    listJaga = listJaga.filter((_, i) => i !== index);
  }

async function saveJaga() {
    if (!jagaNama.trim()) return alert("Nama Pasien wajib diisi!");
    
    isSavingJaga = true;
    const n = JSON.parse(localStorage.getItem('nakesPKM'));
    let itemsToSave = listJaga.length > 0 ? listJaga : [{ obat: "-", jumlah: 0, sumber: jagaRuangan, status: "MANUAL" }];
    
    const hariIni = new Date().toISOString().split('T')[0];
    const shiftID = `${hariIni}_${n.s}`; 

    try {
      // 1. Simpan Data Laporan Pasien ke Database
      const { error } = await supabase.from('laporan_pasien').insert([{
        tanggal: hariIni,
        shift_id: shiftID,
        shift_nama: n.s,
        nakes_info: `Dr: ${n.dr} | P: ${n.p} | B: ${n.b}`,
        nama: jagaNama.toUpperCase(),
        tgl_lahir: jagaTglLahir,
        rm: jagaNorm.trim() || "-",
        diagnosa: jagaDiagnosa.trim() || "-",
        terapi: jagaTerapi.trim() || "-",
        ruangan: jagaRuangan,
        status_pasien: jagaStatusPasien,
        biaya: Number(jagaBiaya.replace(/\./g, '')) || 0,
        kendala: jagaKendala.trim(),
        items: itemsToSave
      }]);
      if (error) throw error;

      // 2. Simpan Catatan Kendala (Jika ada)
      if (jagaKendala.trim() !== "") {
        const { data: eksisting } = await supabase.from('kendala_shift').select('kendala').eq('shift_id', shiftID).single();
        let newKendala = eksisting && eksisting.kendala ? eksisting.kendala + "\n- " + jagaKendala.trim() : "- " + jagaKendala.trim();
        await supabase.from('kendala_shift').upsert({ shift_id: shiftID, kendala: newKendala });
      }

      // ========================================================
      // 3. MESIN PEMOTONG STOK OTOMATIS (Target: stok_obat_jaga)
      // ========================================================
      for (const item of itemsToSave) {
        // Hanya proses obat yang ada di daftar stok resmi (Bukan manual)
        if (item.obat !== "-" && item.status === "STOK") {
          
          // A. Buka laci 'stok_obat_jaga', lihat sisa stok saat ini
          const { data: obatDiLaci } = await supabase
            .from('stok_obat_jaga')
            .select('stok')
            .eq('nama', item.obat)
            .single();

          // B. Jika obatnya ketemu di laci, lakukan pengurangan matematika
          if (obatDiLaci) {
            const sisaBaru = obatDiLaci.stok - item.jumlah;
            
            // C. Simpan angka sisa yang baru ke database
            await supabase
              .from('stok_obat_jaga')
              .update({ stok: sisaBaru })
              .eq('nama', item.obat);
          }
        }
      }
      // ========================================================

      alert("Data Berhasil Tersimpan & Stok Jaga Otomatis Terpotong! 📦✂️");
      resetJaga();
    } catch (err) {
      alert("Gagal terhubung ke database: " + err.message);
    } finally {
      isSavingJaga = false;
    }
  }
  
  function resetJaga() {
    jagaNama = ""; jagaTglLahir = ""; jagaNorm = ""; jagaDiagnosa = "";
    jagaTerapi = ""; jagaKendala = ""; jagaBiaya = "0";
    listJaga = [];
  }

  // =====================================
  // FUNGSI REKAP & LAPORAN WA
  // =====================================
  async function muatDataDanLaporan() {
    if (!currentShiftJaga) return;
    isRekapLoading = true;
    
    const n = JSON.parse(localStorage.getItem('nakesPKM'));
    const hariIni = new Date().toISOString().split('T')[0];
    const shiftID = `${hariIni}_${n.s}`;
    
    try {
      const resKendala = await supabase.from('kendala_shift').select('kendala').eq('shift_id', shiftID).single();
      editKendalaShift = resKendala.data ? resKendala.data.kendala : "";

      const { data: pasienData, error } = await supabase.from('laporan_pasien').select('*').eq('shift_id', shiftID).order('created_at', { ascending: true });
      if (error) throw error;

      rekapItems = (pasienData || []).map(p => {
        let obatStr = (p.items || []).filter(i => i.obat !== "-").map(i => `${i.obat} (${i.jumlah})`).join(', ');
        let totalJumlah = (p.items || []).filter(i => i.obat !== "-").reduce((sum, i) => sum + Number(i.jumlah), 0);
        return { row: p.id, nama: p.nama, rm: p.rm, terapi: p.terapi, obat: obatStr || "-", jumlah: totalJumlah, rawItems: p.items };
      });

      rakitLaporanWA(pasienData, n);
    } catch (err) {
      alert("Terjadi kesalahan saat memuat data rekap.");
    } finally {
      isRekapLoading = false;
    }
  }

  // PERBAIKAN: Rakit Laporan WA yang lebih presisi
  function rakitLaporanWA(pasienList, tim) {
    const dateObj = new Date();
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    const tglStr = `${dd}/${mm}/${yyyy}`;

    let shiftIcon = "☀️";
    if (tim.s.toUpperCase().includes("MALAM") || tim.s.toUpperCase().includes("SORE")) shiftIcon = "🌙";

    const listUGD = (pasienList || []).filter(p => p.ruangan === "UGD");
    const listKABER = (pasienList || []).filter(p => p.ruangan === "KABER");
    const totalUmum = (pasienList || []).filter(p => p.status_pasien === "UMUM").reduce((sum, p) => sum + Number(p.biaya || 0), 0);

    const rekapObatUGD = {};
    listUGD.forEach(p => {
      (p.items || []).forEach(it => {
        if (it.obat && it.obat !== "-") rekapObatUGD[it.obat] = (rekapObatUGD[it.obat] || 0) + Number(it.jumlah || 0);
      });
    });

    const rekapObatKABER = {};
    listKABER.forEach(p => {
      (p.items || []).forEach(it => {
        if (it.obat && it.obat !== "-") rekapObatKABER[it.obat] = (rekapObatKABER[it.obat] || 0) + Number(it.jumlah || 0);
      });
    });

    const formatTgl = (tgl) => {
      if (!tgl) return "-";
      const parts = tgl.split('-');
      if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return tgl;
    }

    const renderPasienList = (list) => {
      if (!list || list.length === 0) return `_- Nihil -_\n\n`;
      let str = "";
      list.forEach(p => {
        let obatStr = (p.items || []).filter(it => it.obat && it.obat !== "-").map(it => `${it.obat} (${it.jumlah})`).join(', ');
        str += `👤 *${p.nama}* [💵 ${p.status_pasien}]\n ├ 📂 RM: ${p.rm || '-'} | 🎂 ${formatTgl(p.tgl_lahir)}\n ├ 🩺 Diag: ${p.diagnosa || '-'}\n ├ 💉 Terapi: ${p.terapi || '-'}\n └ 💊 Obat: ${obatStr || '-'}\n\n`;
      });
      return str;
    };

    const renderObatList = (obj) => {
      const keys = Object.keys(obj).sort();
      if (keys.length === 0) return ` • -\n`;
      return keys.map(k => ` • ${k}: ${obj[k]}`).join('\n') + '\n';
    };

    // SOLUSI PAMUNGKAS KENDALA: Hanya ambil kendala yang melekat pada pasien
    let pasienKendalaArr = (pasienList || [])
      .filter(p => p.kendala && p.kendala.trim() !== "")
      .map(p => `• [${p.nama}]: ${p.kendala}`);
    
    let finalKendala = pasienKendalaArr.length > 0 ? pasienKendalaArr.join("\n") : "- Nihil -";

    let txt = `🏥 *LAPORAN JAGA PKM PONCOKUSUMO*\n📅 ${tglStr} | ${shiftIcon} *Shift: ${tim.s} | Dr: ${tim.dr || '-'} | P: ${tim.p || '-'} | B: ${tim.b || '-'}*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    txt += `♿ *UNIT GAWAT DARURAT (UGD)*\n${renderPasienList(listUGD)}━━━━━━━━━━━━━━━━━━━━\n\n`;
    txt += `🌸 *KAMAR BERSALIN (KABER)*\n${renderPasienList(listKABER)}━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `📦 *REKAP OBAT DAN BMHP*\n\n📍 *UGD:*\n${renderObatList(rekapObatUGD)}\n📍 *KABER:*\n${renderObatList(rekapObatKABER)}\n━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `💰 *TOTAL PENDAPATAN UMUM:*\n*Rp ${totalUmum.toLocaleString('id-ID')}*\n\n━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `⚠️ *KENDALA JAGA:*\n_${finalKendala}_\n\n✅ _Laporan Selesai_`;

    txtLaporan = txt;
  }

  async function simpanKendala() {
    isSavingKendala = true;
    const n = JSON.parse(localStorage.getItem('nakesPKM'));
    const shiftID = `${new Date().toISOString().split('T')[0]}_${n.s}`;
    try {
      const { error } = await supabase.from('kendala_shift').upsert({ shift_id: shiftID, kendala: editKendalaShift });
      if (error) throw error;
      muatDataDanLaporan();
    } catch (e) { alert("Kesalahan Jaringan"); } finally { isSavingKendala = false; }
  }

  async function hapusBaris(row) {
    if (confirm("Hapus data ini secara permanen?")) {
      try {
        await supabase.from('laporan_pasien').delete().eq('id', row);
        muatDataDanLaporan();
      } catch (e) { alert("Kesalahan server."); }
    }
  }

  function kirimWA() { window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(txtLaporan), "_blank"); }

  // =====================================
  // FUNGSI MODAL EDIT & TAMBAH OBAT
  // =====================================
  function bukaModalEdit(it) {
    editRow = it.row; editNama = (it.nama !== "-" ? it.nama : ""); editRM = (it.rm !== "-" ? it.rm : "");
    editTerapi = (it.terapi !== "-" ? it.terapi : "");
    editObat = (it.rawItems && it.rawItems.length > 0 && it.rawItems[0].obat !== "-" ? it.rawItems[0].obat : "");
    editJumlah = (it.rawItems && it.rawItems.length > 0 && it.rawItems[0].jumlah !== 0 ? it.rawItems[0].jumlah : "");
    showModalEdit = true;
  }

  async function simpanEditJaga() {
    isSavingEdit = true;
    try {
      const newItems = [{ obat: editObat.toUpperCase(), jumlah: editJumlah || 0, sumber: "EDIT", status: "MANUAL" }];
      await supabase.from('laporan_pasien').update({ nama: editNama.toUpperCase(), rm: editRM, terapi: editTerapi, items: newItems }).eq('id', editRow);
      showModalEdit = false; muatDataDanLaporan();
    } catch(e) { alert("Error jaringan."); } finally { isSavingEdit = false; }
  }

  function bukaModalTambahObat(row, nama, rm) {
    addObatRow = row; addObatNama = (nama !== "-" ? nama : ""); addObatRM = (rm !== "-" ? rm : "");
    addObatInput = ""; addObatJumlah = 1; showModalTambah = true;
  }

  async function simpanTambahObatJaga() {
    if (!addObatInput) return alert("Nama obat kosong!");
    isSavingAdd = true;
    try {
      const { data: pasien } = await supabase.from('laporan_pasien').select('items').eq('id', addObatRow).single();
      let currentItems = pasien.items || [];
      currentItems.push({ obat: addObatInput.toUpperCase(), jumlah: addObatJumlah, sumber: "SUSULAN", status: "MANUAL" });
      await supabase.from('laporan_pasien').update({ items: currentItems }).eq('id', addObatRow);
      showModalTambah = false; muatDataDanLaporan();
    } catch(e) { alert("Error jaringan."); } finally { isSavingAdd = false; }
  }

  // =====================================
  // FUNGSI REKAP OBAT HARIAN/BULANAN
  // =====================================
  function setHariIniObat() {
    const d = new Date().toISOString().split('T')[0];
    filterMulaiObat = d; filterSelesaiObat = d; tarikDataObat();
  }

  function setBulanIniObat() {
    const date = new Date();
    const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(new Date(y, date.getMonth() + 1, 0).getDate()).padStart(2, '0');
    filterMulaiObat = `${y}-${m}-01`; filterSelesaiObat = `${y}-${m}-${d}`; tarikDataObat();
  }

  async function tarikDataObat() {
    isRekapLoading = true;
    try {
      let query = supabase.from('laporan_pasien').select('ruangan, items');
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
          if (!rekap[namaObat]) rekap[namaObat] = { nama: namaObat, ugd: 0, kaber: 0, total: 0 };
          let qty = Number(it.jumlah) || 0;
          if (p.ruangan === 'UGD') rekap[namaObat].ugd += qty;
          if (p.ruangan === 'KABER') rekap[namaObat].kaber += qty;
          rekap[namaObat].total += qty;
          totalSemuaObat += qty;
        });
      });
      dataRekapObat = Object.values(rekap).sort((a,b) => b.total - a.total);
    } catch(e) { alert("Gagal memuat rekap obat: " + e.message); } finally { isRekapLoading = false; }
  }

</script>

<div class="animate-fade-in bg-[#eef2f5] min-h-screen pb-20">
  
  {#if activeTab === 'input'}
    <div class="max-w-4xl mx-auto p-4 pt-8">
      <div class="mb-4 flex justify-between items-center">
        <button on:click={() => switchView('dashboard')} class="text-[#a435f0] font-bold text-sm flex items-center hover:underline">
          <span class="material-icons text-sm mr-1">arrow_back</span> Kembali ke Dashboard
        </button>
        <button on:click={() => { activeTab = 'rekapObat'; }} class="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg font-bold text-sm flex items-center transition-colors">
          <span class="material-icons text-sm mr-2">inventory_2</span> Rekap Penggunaan Obat
        </button>
      </div>
      
      <div class="w-full h-40 overflow-hidden relative border-b-4 border-[#1c1d1f] mb-6 rounded-t-lg">
        <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1200" class="w-full h-full object-cover filter brightness-75" alt="Banner">
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 text-white">
          <h1 class="text-3xl font-extrabold tracking-tight">🏥 PKM PONCOKUSUMO</h1>
          <p class="text-sm opacity-90 uppercase tracking-widest font-bold text-yellow-400 mt-1">Digital Healthcare & Patient Reports</p>
        </div>
      </div>

      {#if !currentShiftJaga}
        <div class="jaga-card">
          <h2 class="jaga-section-title">Pengaturan Tim Jaga</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><span class="jaga-label" style="margin-top:0;">Shift Operasional</span><select bind:value={nakesForm.s} class="jaga-input"><option value="PAGI">Shift Pagi (☀️)</option><option value="SORE-MALAM">Shift Sore - Malam (🌙)</option></select></div>
            <div><span class="jaga-label" style="margin-top:0;">Dokter Penanggung Jawab</span><input type="text" bind:value={nakesForm.dr} class="jaga-input" placeholder="dr. Nama Lengkap"></div>
          </div>
          <span class="jaga-label">Perawat Jaga (P1, P2, P3)</span>
          <div class="grid grid-cols-3 gap-3">
            <input type="text" bind:value={nakesForm.p1} class="jaga-input" placeholder="Nama P1"><input type="text" bind:value={nakesForm.p2} class="jaga-input" placeholder="Nama P2"><input type="text" bind:value={nakesForm.p3} class="jaga-input" placeholder="Nama P3">
          </div>
          <span class="jaga-label">Bidan Jaga (B1, B2)</span>
          <div class="grid grid-cols-2 gap-3">
            <input type="text" bind:value={nakesForm.b1} class="jaga-input" placeholder="Nama B1"><input type="text" bind:value={nakesForm.b2} class="jaga-input" placeholder="Nama B2">
          </div>
          <div class="mt-10"><button on:click={setNakes} class="jaga-btn-primary bg-[#5624d0] border-[#5624d0]">Aktifkan Sesi Jaga</button></div>
        </div>

      {:else}
        <div class="bg-[#1c1d1f] text-white p-5 flex justify-between items-center mb-6 border-2 border-white shadow-lg rounded-b-lg">
          <div class="text-sm font-bold leading-relaxed">{@html nakesText}</div>
          <button on:click={editNakes} class="text-xs font-black uppercase border-2 border-white px-4 py-2 hover:bg-white hover:text-black transition-all">Ganti Tim</button>
        </div>

        <div class="jaga-card">
          <h2 class="jaga-section-title">Input Pasien Baru</h2>
          <span class="jaga-label" style="margin-top:0;">Identitas Nama Pasien</span><input type="text" bind:value={jagaNama} class="jaga-input uppercase" placeholder="Nama lengkap sesuai KTP/KK">
          <span class="jaga-label">Tanggal Lahir</span><input type="date" bind:value={jagaTglLahir} class="jaga-input">
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div><span class="jaga-label">Nomor Rekam Medis</span><input type="text" bind:value={jagaNorm} class="jaga-input" placeholder="No. RM"></div>
            <div><span class="jaga-label">Kategori Pembayaran</span><select bind:value={jagaStatusPasien} class="jaga-input"><option value="BPJS">Pasien BPJS</option><option value="UMUM">Pasien UMUM (Mandiri)</option></select></div>
          </div>
          {#if jagaStatusPasien === 'UMUM'}
            <div class="mt-2 animate-fade-in"><span class="jaga-label">Nominal Biaya (Rp)</span><input type="text" bind:value={jagaBiaya} on:input={handleFormatRupiah} class="jaga-input"></div>
          {/if}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div><span class="jaga-label">Diagnosa Pasien</span><input type="text" bind:value={jagaDiagnosa} class="jaga-input" placeholder="Diagnosa Utama"></div>
            <div><span class="jaga-label">Unit Penanganan</span><select bind:value={jagaRuangan} class="jaga-input"><option value="UGD">Unit Gawat Darurat (UGD)</option><option value="KABER">Kamar Bersalin (KABER)</option></select></div>
          </div>
          
          <span class="jaga-label">Terapi & Tindakan Medis</span>
          <textarea bind:value={jagaTerapi} class="jaga-input" rows="3" placeholder="Rincian tindakan, dosis obat suntik, dll..."></textarea>
          
          <div class="mt-10 p-6 bg-[#f7f9fa] border-2 border-dashed border-[#1c1d1f]">
            <h3 class="font-extrabold text-base mb-4 uppercase tracking-wider">📦 Resep Obat & BMHP</h3>
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="flex-1"><input type="text" bind:value={obatInput} list="jaga-obatData" class="jaga-input" placeholder="Ketik nama obat/alkes..."><datalist id="jaga-obatData">{#each activeObatList as o}<option value={o}></option>{/each}</datalist></div>
              <div class="w-full sm:w-24 text-center"><input type="number" bind:value={qtyInput} min="1" class="jaga-input text-center"></div>
            </div>
            <button on:click={addJagaItem} class="mt-4 jaga-btn-secondary text-xs py-2 uppercase tracking-tighter">Masukkan ke Daftar Penggunaan</button>
            <div class="mt-4 space-y-2">
              {#each listJaga as it, i}
                <div class="bg-white border border-[#1c1d1f] p-3 mt-2 flex justify-between items-center text-sm animate-fade-in"><div class="font-bold">{it.obat} <span class="text-[#a435f0] ml-1">x{it.jumlah}</span><span class="ml-2 text-[10px] bg-gray-100 px-2 py-0.5 border">{it.status === "STOK" ? "✓ Stok" : "⚠ Manual"}</span></div><button on:click={() => hapusJagaItem(i)} class="text-red-600 hover:bg-red-50 px-2 py-1 font-bold text-xs uppercase">Hapus</button></div>
              {/each}
            </div>
          </div>

          <div class="mt-8"><span class="jaga-label">Kendala Shift (Jika Ada)</span><textarea bind:value={jagaKendala} class="jaga-input" rows="2" placeholder="Tuliskan kendala teknis atau medis jika ada..."></textarea></div>
          
          <div class="mt-10"><button on:click={saveJaga} disabled={isSavingJaga} class="jaga-btn-primary flex items-center justify-center {isSavingJaga ? 'opacity-70' : ''}">{#if isSavingJaga}<span class="material-icons animate-spin mr-2 text-base">sync</span> MENYIMPAN...{:else}Simpan ke Database Pasien{/if}</button></div>
        </div>

        <div class="flex flex-col gap-3 mt-4 mb-20"><button on:click={() => activeTab = 'rekap'} class="jaga-btn-secondary py-4 uppercase text-xs tracking-widest bg-gray-100 flex items-center justify-center">Buka Menu Rekapitulasi Data & WA <span class="material-icons ml-2 text-sm">arrow_forward</span></button></div>
      {/if}
    </div>

  {:else if activeTab === 'rekap'}
    <div class="max-w-6xl mx-auto p-4 pt-8">
      <div class="mb-6 flex justify-between items-center">
        <h1 class="text-2xl font-bold tracking-tight text-[#1c1d1f]">Rekap Data & Laporan Jaga</h1>
        <div class="flex gap-4">
          <button on:click={() => activeTab = 'rekapObat'} class="text-sm font-bold text-indigo-600 hover:underline flex items-center gap-1">
            <span class="material-icons text-sm">inventory_2</span> Rekap Obat
          </button>
          <span class="text-gray-300">|</span>
          <button on:click={() => activeTab = 'input'} class="text-sm font-bold text-[#a435f0] hover:underline flex items-center gap-1">
            <span class="material-icons text-sm">arrow_back</span> Form Pasien
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          
          <div class="jaga-card p-5 border-l-4 border-l-red-600 bg-[#fff5f5] mb-0">
            <label class="font-bold text-sm text-[#1c1d1f] flex items-center gap-2 mb-2"><span class="material-icons text-red-600 text-lg">warning</span> Kendala Shift Keseluruhan (Internal)</label>
            <textarea bind:value={editKendalaShift} rows="2" class="jaga-input bg-white" placeholder="Ketik atau update kendala shift..."></textarea>
            <button on:click={simpanKendala} disabled={isSavingKendala} class="mt-3 text-sm font-bold text-[#a435f0] hover:underline flex items-center">{#if isSavingKendala}<span class="material-icons animate-spin mr-1 text-sm">sync</span> Menyimpan...{:else}Simpan Pembaruan Kendala{/if}</button>
          </div>

          <div class="jaga-card p-0 overflow-hidden">
            <div class="p-4 border-b border-[#d1d7dc] flex justify-between items-center bg-[#f7f9fa]">
              <h2 class="font-bold text-lg text-[#1c1d1f]">Daftar Pasien Shift Ini</h2>
              <button on:click={muatDataDanLaporan} class="jaga-btn-secondary w-auto px-3 py-1.5 text-xs flex items-center"><span class="material-icons text-sm mr-1 {isRekapLoading ? 'animate-spin' : ''}">sync</span> Muat Ulang</button>
            </div>
            
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead><tr class="border-b border-[#d1d7dc] text-[#6a6f73]"><th class="p-4 font-normal">Pasien & RM</th><th class="p-4 font-normal">Obat & Qty</th><th class="p-4 font-normal hidden sm:table-cell">Terapi</th><th class="p-4 font-normal text-right">Aksi</th></tr></thead>
                <tbody>
                  {#if isRekapLoading}<tr><td colspan="4" class="p-8 text-center text-gray-500"><span class="material-icons animate-spin align-middle mr-2">sync</span> Memuat data...</td></tr>
                  {:else if rekapItems.length === 0}<tr><td colspan="4" class="p-8 text-center text-[#6a6f73] italic">Belum ada data pasien di shift ini.</td></tr>
                  {:else}
                    {#each rekapItems as it}
                      <tr class="border-b border-[#d1d7dc] hover:bg-gray-50">
                        <td class="p-4 align-top"><div class="font-bold text-[#1c1d1f] uppercase">{it.nama}</div><div class="text-xs text-[#6a6f73] mt-1">RM: {it.rm}</div></td>
                        <td class="p-4 align-top"><div class="font-bold text-[#5624d0] uppercase">{it.obat}</div><div class="text-xs text-gray-600 mt-1">Total Qty: {it.jumlah}</div></td>
                        <td class="p-4 align-top hidden sm:table-cell text-sm truncate max-w-[200px]">{it.terapi}</td>
                        <td class="p-4 align-top text-right space-y-2">
                          <div class="flex justify-end gap-2"><button on:click={() => bukaModalEdit(it)} class="text-sm font-semibold hover:underline">Edit</button><span class="text-gray-300">|</span><button on:click={() => hapusBaris(it.row)} class="text-sm font-semibold text-red-600 hover:underline">Hapus</button></div>
                          <div><button on:click={() => bukaModalTambahObat(it.row, it.nama, it.rm)} class="text-xs font-bold text-[#a435f0] border border-[#a435f0] px-2 py-1 hover:bg-[#a435f0] hover:text-white transition-colors">+ Obat</button></div>
                        </td>
                      </tr>
                    {/each}
                  {/if}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div class="lg:col-span-1">
          <div class="jaga-card p-0 sticky top-6">
            <div class="p-4 border-b border-[#d1d7dc] bg-[#f7f9fa]"><h2 class="font-bold text-lg text-[#1c1d1f]">Pratinjau Laporan</h2></div>
            <div class="p-4">
              <textarea bind:value={txtLaporan} class="jaga-input h-[400px] mb-4 font-mono text-xs leading-relaxed custom-scroll" readonly placeholder="Laporan akan muncul di sini..."></textarea>
              <button on:click={kirimWA} disabled={!txtLaporan} class="jaga-btn-primary py-3 flex items-center justify-center {txtLaporan ? '' : 'opacity-50'}">Kirim ke WhatsApp <span class="material-icons ml-2 text-sm">send</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>

  {:else if activeTab === 'rekapObat'}
    <div class="max-w-6xl mx-auto p-4 pt-8 animate-fade-in">
      <div class="mb-6 flex justify-between items-center">
        <h1 class="text-2xl font-bold tracking-tight text-[#1c1d1f] flex items-center">
          <span class="material-icons mr-3 text-indigo-600 text-3xl">inventory_2</span>
          Dashboard Rekap Obat & BMHP
        </h1>
        <button on:click={() => activeTab = 'input'} class="text-sm font-bold text-slate-500 hover:text-black flex items-center gap-1">
          <span class="material-icons text-sm">close</span> Tutup
        </button>
      </div>

      <div class="jaga-card p-6">
        <div class="bg-[#f7f9fa] p-5 rounded-lg border border-[#d1d7dc] mb-6 flex flex-col md:flex-row gap-4 items-end justify-between">
          <div class="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div>
              <span class="jaga-label mt-0 mb-1 text-xs">Tanggal Mulai</span>
              <input type="date" bind:value={filterMulaiObat} class="jaga-input py-2">
            </div>
            <div>
              <span class="jaga-label mt-0 mb-1 text-xs">Tanggal Selesai</span>
              <input type="date" bind:value={filterSelesaiObat} class="jaga-input py-2">
            </div>
          </div>
          <div class="flex flex-wrap gap-2 w-full md:w-auto">
            <button on:click={setHariIniObat} class="bg-white border border-[#d1d7dc] text-[#1c1d1f] hover:bg-slate-100 font-bold px-4 py-2 rounded text-sm transition-colors">Hari Ini</button>
            <button on:click={setBulanIniObat} class="bg-white border border-[#d1d7dc] text-[#1c1d1f] hover:bg-slate-100 font-bold px-4 py-2 rounded text-sm transition-colors">Bulan Ini</button>
            <button on:click={tarikDataObat} class="bg-[#1c1d1f] text-white hover:bg-black font-bold px-5 py-2 rounded text-sm flex items-center transition-colors shadow-md">
              <span class="material-icons text-sm mr-2 {isRekapLoading ? 'animate-spin' : ''}">search</span> Terapkan Filter
            </button>
          </div>
        </div>

        <div class="overflow-x-auto border border-[#d1d7dc] rounded-lg">
          <table class="w-full text-left border-collapse">
            <thead class="bg-[#1c1d1f] text-white">
              <tr>
                <th class="p-4 font-bold w-12 text-center">No</th>
                <th class="p-4 font-bold text-sm uppercase tracking-wide">Nama Obat / BMHP</th>
                <th class="p-4 font-bold text-sm uppercase tracking-wide text-center">Pemakaian UGD</th>
                <th class="p-4 font-bold text-sm uppercase tracking-wide text-center">Pemakaian KABER</th>
                <th class="p-4 font-bold text-sm uppercase tracking-wide text-center bg-[#a435f0]">TOTAL KELUAR</th>
              </tr>
            </thead>
            <tbody>
              {#if isRekapLoading}
                <tr><td colspan="5" class="p-10 text-center text-slate-500 font-bold"><span class="material-icons animate-spin align-middle mr-2">sync</span> Menyusun Data Inventaris...</td></tr>
              {:else if dataRekapObat.length === 0}
                <tr><td colspan="5" class="p-10 text-center text-slate-400 font-bold italic">Tidak ada penggunaan obat pada rentang tanggal ini.</td></tr>
              {:else}
                {#each dataRekapObat as item, i}
                  <tr class="border-b border-[#d1d7dc] hover:bg-indigo-50 transition-colors">
                    <td class="p-4 text-center text-slate-500 font-bold">{i + 1}</td>
                    <td class="p-4 font-bold text-[#1c1d1f] text-base">{item.nama}</td>
                    <td class="p-4 text-center font-semibold text-slate-600">{item.ugd}</td>
                    <td class="p-4 text-center font-semibold text-slate-600">{item.kaber}</td>
                    <td class="p-4 text-center font-black text-indigo-700 text-lg bg-indigo-50/50">{item.total}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
            {#if dataRekapObat.length > 0}
              <tfoot class="bg-[#f7f9fa] border-t-2 border-[#1c1d1f]">
                <tr>
                  <td colspan="4" class="p-4 text-right font-black text-sm uppercase text-[#1c1d1f]">Total Seluruh Item Keluar :</td>
                  <td class="p-4 text-center font-black text-xl text-red-600">{totalSemuaObat}</td>
                </tr>
              </tfoot>
            {/if}
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showModalEdit}
  <div class="fixed inset-0 modal-overlay flex justify-center items-center z-50 p-4 animate-fade-in">
    <div class="bg-white jaga-card p-6 w-full max-w-lg relative mb-0">
      <button on:click={() => showModalEdit = false} class="absolute top-4 right-4 text-gray-400 hover:text-black"><span class="material-icons">close</span></button>
      <h3 class="font-bold text-xl mb-6 text-[#1c1d1f]">Edit Data Pasien</h3>
      <div class="space-y-4 text-sm">
        <div><label class="font-bold block mb-1">Nama Pasien</label><input type="text" bind:value={editNama} class="jaga-input uppercase"></div>
        <div><label class="font-bold block mb-1">No RM</label><input type="text" bind:value={editRM} class="jaga-input"></div>
        <div class="grid grid-cols-3 gap-4">
          <div class="col-span-2"><label class="font-bold block mb-1">Nama Obat (Utama)</label><input type="text" bind:value={editObat} class="jaga-input uppercase"></div>
          <div><label class="font-bold block mb-1">Jumlah</label><input type="number" bind:value={editJumlah} class="jaga-input text-center"></div>
        </div>
        <div><label class="font-bold block mb-1">Terapi / Tindakan</label><textarea bind:value={editTerapi} rows="3" class="jaga-input"></textarea></div>
      </div>
      <div class="flex justify-end gap-3 mt-8">
        <button on:click={() => showModalEdit = false} class="jaga-btn-secondary w-auto px-6 py-2.5">Batal</button>
        <button on:click={simpanEditJaga} disabled={isSavingEdit} class="jaga-btn-primary w-auto px-6 py-2.5 bg-[#a435f0] border-[#a435f0] flex items-center">{#if isSavingEdit}<span class="material-icons animate-spin mr-2 text-sm">sync</span>{/if} Simpan</button>
      </div>
    </div>
  </div>
{/if}

{#if showModalTambah}
  <div class="fixed inset-0 modal-overlay flex justify-center items-center z-50 p-4 animate-fade-in">
    <div class="bg-white jaga-card p-6 w-full max-w-md relative mb-0">
      <button on:click={() => showModalTambah = false} class="absolute top-4 right-4 text-gray-400 hover:text-black"><span class="material-icons">close</span></button>
      <h3 class="font-bold text-xl mb-2 text-[#1c1d1f]">Tambah Obat Susulan</h3>
      <div class="mb-5 text-sm text-[#6a6f73]">Pasien: <span class="font-bold text-black">{addObatNama}</span> (RM: {addObatRM})</div>
      <div class="space-y-4 text-sm">
        <div>
          <label class="font-bold block mb-1">Ketik Nama Obat</label>
          <input type="text" bind:value={addObatInput} list="listObatDataAll" class="jaga-input uppercase" placeholder="Ketik...">
          <datalist id="listObatDataAll">{#each listObatDataAll as o}<option value={o}></option>{/each}</datalist>
        </div>
        <div><label class="font-bold block mb-1">Jumlah</label><input type="number" bind:value={addObatJumlah} min="1" class="jaga-input"></div>
      </div>
      <div class="flex justify-end gap-3 mt-8">
        <button on:click={() => showModalTambah = false} class="jaga-btn-secondary w-auto px-6 py-2.5">Batal</button>
        <button on:click={simpanTambahObatJaga} disabled={isSavingAdd} class="jaga-btn-primary w-auto bg-[#a435f0] border-[#a435f0] px-6 py-2.5 flex items-center">{#if isSavingAdd}<span class="material-icons animate-spin mr-2 text-sm">sync</span>{/if} Tambahkan</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Base & Jaga Styles */
  .jaga-card { background: white; border: 2px solid #1c1d1f; padding: 30px; margin-bottom: 30px; border-radius: 8px; box-shadow: 8px 8px 0px rgba(28, 29, 31, 0.1); }
  .jaga-input { width: 100%; padding: 12px 16px; border: 1px solid #d1d7dc; border-radius: 4px; font-weight: 500; font-size: 1rem; color: #1c1d1f; background: #ffffff; transition: all 0.2s; outline: none;}
  .jaga-input:focus { border-color: #a435f0 !important; box-shadow: inset 0 0 0 1px #a435f0; }
  .jaga-label { font-size: 0.875rem; font-weight: 700; color: #1c1d1f; display: block; margin-bottom: 8px; margin-top: 20px; text-transform: uppercase; letter-spacing: 0.5px;}
  
  .jaga-btn-primary { width: 100%; padding: 16px; background: #1c1d1f; color: white; font-weight: 800; font-size: 0.95rem; border: 2px solid #1c1d1f; border-radius: 6px; cursor: pointer; transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px; }
  .jaga-btn-primary:hover:not(:disabled) { background: #333; transform: translate(-2px, -2px); box-shadow: 4px 4px 0px #a435f0; }
  .jaga-btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
  
  .jaga-btn-secondary { width: 100%; padding: 16px; background: white; color: #1c1d1f; font-weight: 800; font-size: 0.95rem; border: 2px solid #1c1d1f; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
  .jaga-btn-secondary:hover { background: #f7f9fa; transform: translate(-2px, -2px); box-shadow: 4px 4px 0px #d1d7dc;}
  
  .jaga-section-title { font-size: 1.25rem; font-weight: 900; border-bottom: 3px solid #1c1d1f; padding-bottom: 10px; margin-bottom: 25px; display: inline-block; text-transform: uppercase; letter-spacing: -0.5px;}
  
  .modal-overlay { background: rgba(28, 29, 31, 0.75); backdrop-filter: blur(2px);}
  
  .custom-scroll::-webkit-scrollbar { width: 6px; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>