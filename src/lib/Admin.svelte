<script>
  import { supabase } from './supabase.js';

  export let switchView;

  // ==========================
  // SISTEM KEAMANAN (SUPABASE AUTH)
  // ==========================
  let isLoggedIn = false;
  let isAuthLoading = true; 
  let userEmail = "";
  let userRole = ""; 
  
  let inputEmail = "";
  let inputPassword = "";

  async function cekSesi() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      isLoggedIn = true;
      userEmail = session.user.email.toLowerCase();
      tentukanRole(userEmail);
      muatSemuaData();
    }
    isAuthLoading = false;
  }

  function tentukanRole(email) {
    const mail = email.toLowerCase();
    if (mail === 'admin@satsetponcokusumo.com') {
      userRole = 'superadmin';
      tabAktif = 'rekap'; 
    } 
    else if (mail === 'bendahara@satsetponcokusumo.com') {
      userRole = 'keuangan';
      tabAktif = 'rekap'; 
    } 
    else if (mail === 'jaga@satsetponcokusumo.com') {
      userRole = 'apotek';
      tabAktif = 'stok_jaga'; 
    } 
    else {
      userRole = 'tamu';
      alert("Akses Terbatas: Email Anda tidak memiliki wewenang administratif.");
      handleLogout(); 
    }
  }
  
  cekSesi();

  async function handleLogin() {
    if (!inputEmail || !inputPassword) return alert("⚠️ Isi Email dan Password!");
    isAuthLoading = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: inputEmail, password: inputPassword });
      if (error) throw error;
      isLoggedIn = true;
      userEmail = data.user.email.toLowerCase();
      tentukanRole(userEmail);
      inputEmail = ""; inputPassword = "";
      muatSemuaData();
    } catch (err) {
      alert("❌ Akses Ditolak: Kredensial tidak valid.");
    } finally {
      isAuthLoading = false;
    }
  }

  async function handleLogout() {
    if (confirm("Keluar dari Panel Admin?")) {
      await supabase.auth.signOut();
      isLoggedIn = false;
      userRole = "";
      userEmail = "";
      riwayatTransaksi = []; daftarObat = []; daftarLayanan = []; daftarStokJaga = [];
    }
  }

  // ==========================
  // STATE DATA ADMIN
  // ==========================
  let tabAktif = ""; 
  let isLoading = false;

  let daftarObat = [];
  let daftarLayanan = [];
  let riwayatTransaksi = [];
  let daftarStokJaga = [];

  let filterMulai = "";
  let filterSelesai = "";

  $: riwayatFiltered = riwayatTransaksi.filter(trx => {
    if (!filterMulai || !filterSelesai) return true; 
    let dTrx = new Date(trx.tanggal);
    let dStart = new Date(filterMulai);
    let dEnd = new Date(filterSelesai);
    dEnd.setHours(23, 59, 59); 
    return dTrx >= dStart && dTrx <= dEnd;
  });

  $: totalPendapatanFiltered = riwayatFiltered.reduce((sum, trx) => sum + Number(trx.total_biaya), 0);
  $: totalPasienFiltered = riwayatFiltered.length;

  let formObat = { nama: "", harga: "", stok: "" };
  let editIdObat = null; 
  let formLayanan = { kategori: "", nama: "", harga: "" };
  let editIdLayanan = null;
  let cariObat = "";
  let cariLayanan = "";

  // DIPERBARUI: Form Stok Jaga sekarang punya memori stok_awal
  let formStokJaga = { nama: "", jumlah: "", stok_awal: "" };
  let editIdStokJaga = null;
  let cariStokJaga = "";

  $: filteredObat = daftarObat.filter(o => o.nama.toLowerCase().includes(cariObat.toLowerCase()));
  $: filteredLayanan = daftarLayanan.filter(l => l.nama.toLowerCase().includes(cariLayanan.toLowerCase()) || l.kategori.toLowerCase().includes(cariLayanan.toLowerCase()));
  $: filteredStokJaga = daftarStokJaga.filter(o => o.nama.toLowerCase().includes(cariStokJaga.toLowerCase()));
  $: kategoriDinamis = [...new Set(daftarLayanan.map(l => l.kategori))].sort();

  // ==========================
  // MESIN PENYEDOT DATA
  // ==========================
  async function muatSemuaData() {
    if (userRole === 'tamu') return;
    isLoading = true;
    try {
      if (userRole === 'apotek' || userRole === 'superadmin') {
        const resStokJaga = await supabase.from('stok_obat_jaga').select('*').order('nama', { ascending: true });
        daftarStokJaga = resStokJaga.data || [];
      }

      if (userRole === 'keuangan' || userRole === 'superadmin') {
        const resObat = await supabase.from('master_obat').select('*').order('nama', { ascending: true });
        daftarObat = resObat.data || [];
        
        const resLayanan = await supabase.from('master_layanan').select('*').order('kategori', { ascending: true });
        daftarLayanan = resLayanan.data || [];

        const resKasir = await supabase.from('riwayat_kasir').select('tanggal, total_biaya').order('tanggal', { ascending: false });
        riwayatTransaksi = resKasir.data || [];
        
        if (!filterMulai) setFilterBulanIni();
      }
    } catch (err) {
      alert("Gagal memuat data admin: " + err.message);
    } finally {
      isLoading = false;
    }
  }

  function setFilterBulanIni() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(new Date(y, date.getMonth() + 1, 0).getDate()).padStart(2, '0');
    filterMulai = `${y}-${m}-01`;
    filterSelesai = `${y}-${m}-${d}`;
  }

  function resetFilter() { filterMulai = ""; filterSelesai = ""; }
  function downloadPDF() { window.print(); }

  // ==========================================
  // SISTEM GULIR LAYAR OTOMATIS
  // ==========================================
  function gulirKeAtas() {
    setTimeout(() => {
      const mainArea = document.getElementById('main-content-area');
      if (mainArea) mainArea.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' }); 
    }, 50); 
  }

  // ==========================
  // FUNGSI CRUD OBAT (E-Billing)
  // ==========================
  async function simpanObat() {
    if (!formObat.nama || !formObat.harga) return alert("Isi nama dan harga!");
    try {
      const payload = { nama: formObat.nama.toUpperCase(), harga: Number(formObat.harga), stok: Number(formObat.stok) || 0 };
      if (editIdObat) await supabase.from('master_obat').update(payload).eq('id', editIdObat);
      else await supabase.from('master_obat').insert([payload]);
      formObat = { nama: "", harga: "", stok: "" }; editIdObat = null; muatSemuaData(); 
    } catch (err) { alert("Error: " + err.message); }
  }
  function siapkanEditObat(o) { 
    formObat = { nama: o.nama, harga: o.harga, stok: o.stok || 0 }; 
    editIdObat = o.id; 
    gulirKeAtas(); 
  }
  async function hapusObat(id) { if(confirm("Yakin hapus?")) { await supabase.from('master_obat').delete().eq('id', id); muatSemuaData(); } }

  // ==========================
  // FUNGSI CRUD STOK JAGA (DIPERKUAT DENGAN STOK AWAL)
  // ==========================
  async function simpanStokJaga() {
    if (!formStokJaga.nama || formStokJaga.jumlah === "") return alert("Isi nama obat dan jumlah sisa fisiknya!");
    try {
      const namaObatClean = formStokJaga.nama.trim().toUpperCase();
      const jumlahInput = Number(formStokJaga.jumlah) || 0;
      const stokAwalInput = Number(formStokJaga.stok_awal) || jumlahInput; // Jika kosong, set sama dengan jumlah awal
      
      let qtyMasuk = 0;
      let totalStokAkhir = 0;
      let ketLog = "";

      if (editIdStokJaga) {
        const dataLama = daftarStokJaga.find(o => o.id === editIdStokJaga);
        if (dataLama) {
          if (jumlahInput > dataLama.jumlah) {
             qtyMasuk = jumlahInput - dataLama.jumlah;
             totalStokAkhir = jumlahInput;
             ketLog = `Penambahan/Restock oleh Admin (${userEmail})`;
          } else if (jumlahInput < dataLama.jumlah) {
             const qtyKeluar = dataLama.jumlah - jumlahInput;
             totalStokAkhir = jumlahInput;
             ketLog = `Koreksi pengurangan oleh Admin (${userEmail})`;
             
             await supabase.from('log_steling_obat').insert({
                nama_obat: namaObatClean, jenis_mutasi: 'KELUAR', jumlah: qtyKeluar, sisa_stok: totalStokAkhir, keterangan: ketLog
             });
          }
        }
        await supabase.from('stok_obat_jaga').update({ nama: namaObatClean, jumlah: jumlahInput, stok_awal: stokAwalInput }).eq('id', editIdStokJaga);

      } else {
        qtyMasuk = jumlahInput;
        totalStokAkhir = jumlahInput;
        ketLog = `Input obat baru ke Laci Jaga oleh (${userEmail})`;
        await supabase.from('stok_obat_jaga').insert([{ nama: namaObatClean, jumlah: jumlahInput, stok_awal: stokAwalInput }]);
      }

      if (qtyMasuk > 0) {
        await supabase.from('log_steling_obat').insert({
          nama_obat: namaObatClean, jenis_mutasi: 'MASUK', jumlah: qtyMasuk, sisa_stok: totalStokAkhir, keterangan: ketLog
        });
      }

      formStokJaga = { nama: "", jumlah: "", stok_awal: "" }; 
      editIdStokJaga = null; 
      muatSemuaData(); 
      alert("Stok berhasil disimpan dan terekam di Steling! 📦✅");
    } catch (err) { 
      alert("Error saat menyimpan stok: " + err.message); 
    }
  }

  function siapkanEditStokJaga(o) { 
    formStokJaga = { nama: o.nama, jumlah: o.jumlah || 0, stok_awal: o.stok_awal || 0 }; 
    editIdStokJaga = o.id; 
    gulirKeAtas(); 
  }
  async function hapusStokJaga(id) { if(confirm("Yakin hapus obat dari Laporan Jaga?")) { await supabase.from('stok_obat_jaga').delete().eq('id', id); muatSemuaData(); } }

  // ==========================
  // FUNGSI CRUD LAYANAN (E-Billing)
  // ==========================
  async function simpanLayanan() {
    if (!formLayanan.kategori || !formLayanan.nama || !formLayanan.harga) return alert("Isi semua data!");
    try {
      const payload = { kategori: formLayanan.kategori.toUpperCase(), nama: formLayanan.nama.toUpperCase(), harga: Number(formLayanan.harga) };
      if (editIdLayanan) await supabase.from('master_layanan').update(payload).eq('id', editIdLayanan);
      else await supabase.from('master_layanan').insert([payload]);
      formLayanan = { kategori: "", nama: "", harga: "" }; editIdLayanan = null; muatSemuaData(); 
    } catch (err) { alert("Error: " + err.message); }
  }
  function siapkanEditLayanan(l) { 
    formLayanan = { kategori: l.kategori, nama: l.nama, harga: l.harga }; 
    editIdLayanan = l.id; 
    gulirKeAtas(); 
  }
  async function hapusLayanan(id) { if(confirm("Yakin hapus?")) { await supabase.from('master_layanan').delete().eq('id', id); muatSemuaData(); } }

</script>

{#if isAuthLoading}
  <div class="min-h-screen bg-slate-50 flex justify-center items-center">
    <div class="text-center text-slate-400 font-bold animate-pulse flex flex-col items-center">
      <span class="material-icons text-5xl mb-4 animate-spin">lock</span> Memeriksa Otorisasi...
    </div>
  </div>
{:else if !isLoggedIn}
  <div class="min-h-screen bg-slate-50 pt-20 px-4">
    <div class="max-w-md mx-auto mb-6">
      <button on:click={() => switchView('dashboard')} class="text-slate-600 font-bold text-sm flex items-center hover:text-black">
        <span class="material-icons text-sm mr-1">arrow_back</span> Kembali ke Dashboard
      </button>
    </div>
    <div class="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border-t-8 border-slate-800 text-center animate-fade-in">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-slate-100 text-slate-800 rounded-full mb-4">
        <span class="material-icons text-4xl">admin_panel_settings</span>
      </div>
      <h2 class="text-2xl font-black text-slate-900 mb-1">OTORISASI ADMIN</h2>
      <p class="text-xs text-slate-500 font-bold mb-6">Sistem SATSET Terpadu</p>
      
      <input type="email" bind:value={inputEmail} placeholder="Email Admin" class="w-full p-4 mb-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold focus:border-slate-800 outline-none text-center">
      <input type="password" bind:value={inputPassword} on:keydown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Password" class="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-xl tracking-[0.3em] font-black focus:border-slate-800 outline-none mb-6">
      
      <button on:click={handleLogin} class="w-full bg-slate-800 hover:bg-black text-white font-black py-4 rounded-xl shadow-lg transition-all flex justify-center items-center">
        <span class="material-icons mr-2">vpn_key</span> BUKA BRANKAS
      </button>
    </div>
  </div>
{:else}

  <div class="flex h-screen bg-slate-100 font-sans overflow-hidden">
    
    <aside class="sidebar-admin w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-20 transition-all duration-300 flex-shrink-0">
      <div class="p-6 border-b border-slate-800">
        <h1 class="text-2xl font-black text-[#D4AF37] tracking-wider">ADMIN</h1>
        <p class="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">{userRole}</p>
      </div>

      <nav class="flex-1 overflow-y-auto py-4">
        <ul class="space-y-1 px-3">
          
          {#if userRole === 'keuangan' || userRole === 'superadmin'}
            <div class="px-4 py-2 mt-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 mb-2">Kelompok E-Billing</div>
            <li>
              <button on:click={() => tabAktif = 'rekap'} class="w-full flex items-center px-4 py-3 rounded-xl font-bold text-sm transition-colors {tabAktif === 'rekap' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}">
                <span class="material-icons mr-3 text-lg">account_balance_wallet</span> Laporan Keuangan
              </button>
            </li>
            <li>
              <button on:click={() => tabAktif = 'layanan'} class="w-full flex items-center px-4 py-3 rounded-xl font-bold text-sm transition-colors {tabAktif === 'layanan' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}">
                <span class="material-icons mr-3 text-lg">medical_services</span> Tarif & Layanan
              </button>
            </li>
            <li>
              <button on:click={() => tabAktif = 'obat'} class="w-full flex items-center px-4 py-3 rounded-xl font-bold text-sm transition-colors {tabAktif === 'obat' ? 'bg-[#D4AF37] text-black shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}">
                <span class="material-icons mr-3 text-lg">inventory_2</span> Master Obat
              </button>
            </li>
          {/if}

          {#if userRole === 'apotek' || userRole === 'superadmin'}
            <div class="px-4 py-2 mt-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 mb-2">Kelompok Laporan Jaga</div>
            <li>
              <button on:click={() => tabAktif = 'stok_jaga'} class="w-full flex items-center px-4 py-3 rounded-xl font-bold text-sm transition-colors {tabAktif === 'stok_jaga' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}">
                <span class="material-icons mr-3 text-lg">medication</span> Stok Obat Jaga
              </button>
            </li>
          {/if}

        </ul>
      </nav>

      <div class="p-4 border-t border-slate-800 space-y-2">
        <div class="text-xs text-slate-500 font-bold mb-2 truncate px-2"><span class="material-icons text-[10px] mr-1">person</span>{userEmail}</div>
        <button on:click={() => switchView('dashboard')} class="w-full flex items-center px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-bold text-sm transition-colors">
          <span class="material-icons mr-2 text-sm">home</span> App Utama
        </button>
        <button on:click={handleLogout} class="w-full flex items-center px-4 py-2 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900 hover:text-red-200 font-bold text-sm transition-colors">
          <span class="material-icons mr-2 text-sm">logout</span> Keluar
        </button>
      </div>
    </aside>

    <main id="main-content-area" class="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth">
      {#if isLoading}
        <div class="absolute inset-0 bg-slate-100/80 z-10 flex justify-center items-center">
          <div class="bg-white p-4 rounded-xl shadow-lg flex items-center font-bold text-slate-600">
            <span class="material-icons animate-spin mr-3 text-blue-600">sync</span> Menyinkronkan Data...
          </div>
        </div>
      {/if}

      <div class="print-header hidden mb-6">
        <h2 style="font-size: 18px; font-weight: bold; margin: 0;">PEMERINTAH KABUPATEN MALANG - DINAS KESEHATAN</h2>
        <h1 style="font-size: 22px; font-weight: 900; margin: 5px 0;">UPT PUSKESMAS PONCOKUSUMO</h1>
        <p style="font-size: 12px; font-style: italic; margin: 0;">Laporan Rekapitulasi Keuangan E-Billing SATSET</p>
        <p style="text-align: center; font-size: 14px; margin-top: 10px; margin-bottom: 20px; font-weight: bold;">
          Periode: {filterMulai ? new Date(filterMulai).toLocaleDateString('id-ID') : 'Awal'} s.d {filterSelesai ? new Date(filterSelesai).toLocaleDateString('id-ID') : 'Akhir'}
        </p>
      </div>

      <div class="print-area animate-fade-in max-w-5xl mx-auto">
        
        {#if tabAktif === 'rekap'}
          <h2 class="text-2xl font-black text-slate-800 mb-6 border-b-2 pb-2 no-print">Laporan Keuangan E-Billing</h2>
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 justify-between items-end no-print">
            <div class="flex gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Mulai</label>
                <input type="date" bind:value={filterMulai} class="p-2 border rounded-lg font-bold outline-none">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Selesai</label>
                <input type="date" bind:value={filterSelesai} class="p-2 border rounded-lg font-bold outline-none">
              </div>
            </div>
            <div class="flex gap-2">
              <button on:click={setFilterBulanIni} class="bg-slate-100 hover:bg-slate-200 font-bold px-4 py-2 rounded-lg text-sm">Bulan Ini</button>
              <button on:click={resetFilter} class="bg-slate-100 hover:bg-slate-200 font-bold px-4 py-2 rounded-lg text-sm">Semua</button>
              <button on:click={downloadPDF} class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg shadow flex items-center">
                <span class="material-icons mr-2 text-sm">print</span> Cetak Laporan
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <span class="material-icons absolute -right-4 -bottom-4 text-8xl text-white/20">account_balance_wallet</span>
              <p class="font-bold text-emerald-100 text-xs uppercase tracking-widest mb-1">Total Pendapatan</p>
              <h2 class="text-4xl font-black">Rp {totalPendapatanFiltered.toLocaleString('id-ID')}</h2>
              <p class="text-sm mt-2 font-bold opacity-90">{totalPasienFiltered} Transaksi Terfilter</p>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table class="w-full text-sm text-left print-table">
              <thead class="bg-slate-800 text-white">
                <tr><th class="p-4">Tanggal Transaksi</th><th class="p-4 text-right">Total Pendapatan (Rp)</th></tr>
              </thead>
              <tbody>
                {#if riwayatFiltered.length === 0}
                  <tr><td colspan="2" class="p-8 text-center text-slate-500 italic">Tidak ada transaksi di periode ini.</td></tr>
                {/if}
                {#each riwayatFiltered as r}
                  <tr class="border-b hover:bg-slate-50">
                    <td class="p-4">{new Date(r.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    <td class="p-4 text-right font-bold text-emerald-600">{Number(r.total_biaya).toLocaleString('id-ID')}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        {#if tabAktif === 'obat'}
          <div class="animate-fade-in">
            <h2 class="text-2xl font-black text-slate-800 mb-6 border-b-2 pb-2">Master Obat E-Billing</h2>
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-end bg-gradient-to-r from-blue-50 to-white">
              <div class="flex-1">
                <label class="block text-xs font-bold text-blue-800 uppercase mb-1">Nama Obat / BMHP</label>
                <input type="text" bind:value={formObat.nama} class="w-full p-3 border-2 border-blue-200 rounded-xl font-bold uppercase outline-none focus:border-blue-500" placeholder="Contoh: AMOXICILLIN 500MG">
              </div>
              <div class="w-32">
                <label class="block text-xs font-bold text-blue-800 uppercase mb-1">Stok Gudang</label>
                <input type="number" bind:value={formObat.stok} class="w-full p-3 border-2 border-blue-200 rounded-xl font-bold outline-none focus:border-blue-500 text-center text-blue-700 bg-white" placeholder="0">
              </div>
              <div class="w-48">
                <label class="block text-xs font-bold text-blue-800 uppercase mb-1">Harga Jual (Rp)</label>
                <input type="number" bind:value={formObat.harga} class="w-full p-3 border-2 border-blue-200 rounded-xl font-bold outline-none focus:border-blue-500" placeholder="Contoh: 5000">
              </div>
              <button on:click={simpanObat} class="bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 px-6 rounded-xl shadow-md transition-colors h-12 flex items-center justify-center">
                {editIdObat ? 'Update Data' : 'Tambah Baru'}
              </button>
              {#if editIdObat}
                <button on:click={() => { editIdObat=null; formObat={nama:"", harga:"", stok:""} }} class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold p-3 px-4 rounded-xl transition-colors h-12">Batal</button>
              {/if}
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div class="p-4 border-b bg-slate-50 flex items-center">
                <span class="material-icons text-slate-400 mr-2">search</span>
                <input type="text" bind:value={cariObat} placeholder="Cari nama obat di gudang..." class="bg-transparent border-none outline-none font-bold w-full text-slate-700">
              </div>
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-800 text-white">
                  <tr><th class="p-4 w-12 text-center">No</th><th class="p-4">Nama Barang</th><th class="p-4 text-center w-32">Stok Gudang</th><th class="p-4 text-right w-40">Tarif Jual (Rp)</th><th class="p-4 text-center w-32">Aksi</th></tr>
                </thead>
                <tbody>
                  {#each filteredObat as o, i}
                    <tr class="border-b hover:bg-slate-50">
                      <td class="p-4 text-center text-slate-400">{i+1}</td>
                      <td class="p-4 font-bold text-slate-800 uppercase">{o.nama}</td>
                      <td class="p-4 text-center font-black {o.stok < 10 ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50'}">{o.stok || 0}</td>
                      <td class="p-4 text-right font-semibold">{Number(o.harga).toLocaleString('id-ID')}</td>
                      <td class="p-4 text-center">
                        <button on:click={() => siapkanEditObat(o)} class="text-blue-600 hover:text-blue-800 mx-1"><span class="material-icons text-sm">edit</span></button>
                        <button on:click={() => hapusObat(o.id)} class="text-red-500 hover:text-red-700 mx-1"><span class="material-icons text-sm">delete</span></button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        {#if tabAktif === 'layanan'}
          <div class="animate-fade-in">
            <h2 class="text-2xl font-black text-slate-800 mb-6 border-b-2 pb-2">Master Tarif & Layanan Tindakan</h2>
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-end bg-gradient-to-r from-purple-50 to-white">
              <div class="w-48">
                <label class="block text-xs font-bold text-purple-800 uppercase mb-1">Unit/Poli</label>
                <input type="text" list="cat-list" bind:value={formLayanan.kategori} class="w-full p-3 border-2 border-purple-200 rounded-xl font-bold uppercase outline-none focus:border-purple-500" placeholder="Ketik Unit">
                <datalist id="cat-list">{#each kategoriDinamis as k}<option value={k}></option>{/each}</datalist>
              </div>
              <div class="flex-1">
                <label class="block text-xs font-bold text-purple-800 uppercase mb-1">Nama Tindakan</label>
                <input type="text" bind:value={formLayanan.nama} class="w-full p-3 border-2 border-purple-200 rounded-xl font-bold uppercase outline-none focus:border-purple-500" placeholder="Contoh: CABUT GIGI">
              </div>
              <div class="w-48">
                <label class="block text-xs font-bold text-purple-800 uppercase mb-1">Tarif (Rp)</label>
                <input type="number" bind:value={formLayanan.harga} class="w-full p-3 border-2 border-purple-200 rounded-xl font-bold outline-none focus:border-purple-500" placeholder="Contoh: 50000">
              </div>
              <button on:click={simpanLayanan} class="bg-purple-600 hover:bg-purple-700 text-white font-bold p-3 px-6 rounded-xl shadow-md transition-colors h-12">
                {editIdLayanan ? 'Update Data' : 'Tambah Tindakan'}
              </button>
              {#if editIdLayanan}
                <button on:click={() => { editIdLayanan=null; formLayanan={kategori:"", nama:"", harga:""} }} class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold p-3 px-4 rounded-xl h-12">Batal</button>
              {/if}
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div class="p-4 border-b bg-slate-50 flex items-center">
                <span class="material-icons text-slate-400 mr-2">search</span>
                <input type="text" bind:value={cariLayanan} placeholder="Cari berdasarkan Unit atau Nama Tindakan..." class="bg-transparent border-none outline-none font-bold w-full text-slate-700">
              </div>
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-800 text-white">
                  <tr><th class="p-4 w-1/4">Unit / Poli</th><th class="p-4 w-2/4">Nama Tindakan</th><th class="p-4 text-right w-32">Tarif (Rp)</th><th class="p-4 text-center w-32">Aksi</th></tr>
                </thead>
                <tbody>
                  {#each filteredLayanan as l}
                    <tr class="border-b hover:bg-slate-50">
                      <td class="p-4 font-bold text-purple-700 uppercase bg-purple-50/30">{l.kategori}</td>
                      <td class="p-4 font-bold text-slate-800 uppercase">{l.nama}</td>
                      <td class="p-4 text-right font-semibold">{Number(l.harga).toLocaleString('id-ID')}</td>
                      <td class="p-4 text-center">
                        <button on:click={() => siapkanEditLayanan(l)} class="text-blue-600 hover:text-blue-800 mx-1"><span class="material-icons text-sm">edit</span></button>
                        <button on:click={() => hapusLayanan(l.id)} class="text-red-500 hover:text-red-700 mx-1"><span class="material-icons text-sm">delete</span></button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        {#if tabAktif === 'stok_jaga'}
          <div class="animate-fade-in">
            <h2 class="text-2xl font-black text-slate-800 mb-6 border-b-2 pb-2">Manajemen Stok Obat Jaga</h2>
            <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-end bg-gradient-to-r from-emerald-50 to-white">
              
              <div class="flex-1">
                <label class="block text-xs font-bold text-emerald-800 uppercase mb-1">Nama Obat / BMHP</label>
                <input type="text" bind:value={formStokJaga.nama} class="w-full p-3 border-2 border-emerald-200 rounded-xl font-bold uppercase outline-none focus:border-emerald-500" placeholder="Contoh: PARACETAMOL 500MG">
              </div>
              
              <div class="w-32">
                <label class="block text-xs font-bold text-emerald-800 uppercase mb-1">Stok Standar</label>
                <input type="number" bind:value={formStokJaga.stok_awal} class="w-full p-3 border-2 border-emerald-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-center text-emerald-700 bg-white" placeholder="0">
              </div>

              <div class="w-32">
                <label class="block text-xs font-bold text-emerald-800 uppercase mb-1">Sisa Fisik</label>
                <input type="number" bind:value={formStokJaga.jumlah} class="w-full p-3 border-2 border-emerald-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-center text-emerald-700 bg-white" placeholder="0">
              </div>

              <button on:click={simpanStokJaga} class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 px-6 rounded-xl shadow-md transition-colors h-12 flex items-center justify-center">
                {editIdStokJaga ? 'Update Data' : 'Tambah Baru'}
              </button>
              {#if editIdStokJaga}
                <button on:click={() => { editIdStokJaga=null; formStokJaga={nama:"", jumlah:"", stok_awal:""} }} class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold p-3 px-4 rounded-xl transition-colors h-12">Batal</button>
              {/if}
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div class="p-4 border-b bg-slate-50 flex items-center">
                <span class="material-icons text-slate-400 mr-2">search</span>
                <input type="text" bind:value={cariStokJaga} placeholder="Cari nama obat jaga..." class="bg-transparent border-none outline-none font-bold w-full text-slate-700">
              </div>
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-800 text-white">
                  <tr>
                    <th class="p-4 w-12 text-center">No</th>
                    <th class="p-4">Nama Barang</th>
                    <th class="p-4 text-center w-32">Stok Standar</th>
                    <th class="p-4 text-center w-32">Sisa Saat Ini</th>
                    <th class="p-4 text-center w-32">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {#if filteredStokJaga.length === 0}
                    <tr><td colspan="5" class="p-8 text-center text-slate-500 italic">Belum ada data stok obat jaga.</td></tr>
                  {/if}
                  
                  {#each filteredStokJaga as o, i}
                    <tr class="border-b transition-colors {o.stok_awal > 0 && o.jumlah < o.stok_awal ? 'bg-red-50 hover:bg-red-100 border-red-200' : 'hover:bg-slate-50'}">
                      <td class="p-4 text-center text-slate-400">{i+1}</td>
                      <td class="p-4 font-bold text-slate-800 uppercase">
                        {o.nama}
                        {#if o.stok_awal > 0 && o.jumlah < o.stok_awal}
                          <span class="ml-2 inline-block bg-red-600 text-white text-[10px] px-2 py-0.5 rounded shadow-sm animate-pulse">Butuh Restock</span>
                        {/if}
                      </td>
                      <td class="p-4 text-center font-bold text-slate-400">{o.stok_awal || 0}</td>
                      <td class="p-4 text-center font-black {o.stok_awal > 0 && o.jumlah < o.stok_awal ? 'text-red-700 bg-red-200/50' : 'text-emerald-700 bg-emerald-50'}">
                        {o.jumlah || 0}
                      </td>
                      <td class="p-4 text-center">
                        <button on:click={() => siapkanEditStokJaga(o)} class="text-blue-600 hover:text-blue-800 mx-1"><span class="material-icons text-sm">edit</span></button>
                        <button on:click={() => hapusStokJaga(o.id)} class="text-red-500 hover:text-red-700 mx-1"><span class="material-icons text-sm">delete</span></button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

      </div>
    </main>
  </div>
{/if}

<style>
  .animate-fade-in { animation: fadeIn 0.4s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  /* CSS KHUSUS UNTUK CETAK LAPORAN KEUANGAN */
  @media print {
    body { background: white !important; }
    .no-print, .sidebar-admin { display: none !important; }
    .print-area { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
    .print-header { display: block !important; text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;}
    
    .print-table th { background-color: #f1f5f9 !important; color: black !important; font-weight: bold !important; border: 1px solid black !important; }
    .print-table td { border: 1px solid black !important; color: black !important; }
    
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>