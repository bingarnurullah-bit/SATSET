<script>
  import { supabase } from './supabase.js';
  export let switchView;

  // ==========================
  // STATE NAVIGASI & OTORISASI
  // ==========================
  let activePage = 'form'; 
  let userEmail = "";
  let isKapus = false;
  
  let showApprovalModal = false;
  let showUnlockModal = false; 
  let approvalPassword = "";
  let unlockPassword = "";
  let visumTarget = null;
  let isProcessing = false;
  let loginErrorMsg = "";

  async function cekSesi() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      userEmail = session.user.email.toLowerCase();
      isKapus = userEmail === 'kapus@satsetponcokusumo.com';
    }
  }
  cekSesi();

  // ==========================
  // STATE DATA VISUM
  // ==========================
  let editRow = ""; 
  let isSaving = false;
  let riwayatData = [];
  let isRiwayatLoading = false;

  let form = {
    no_surat: "", tgl_permintaan: "", no_polisi: "", penandatangan_polisi: "", pangkat_polisi: "",
    tgl_terima: "", jam_terima: "", nama_dokter: "", nip_dokter: "",
    nama_korban: "", jk_korban: "", umur_korban: "", agama_korban: "", wn_korban: "", pekerjaan_korban: "", alamat_korban: "",
    ku: "", td: "", suhu: "", nadi: "", rr: "", tb: "", bb: "",
    hasil_luar: "",
    kepala: "", dahi: "", pipi: "", mata: "", hidung: "", bibir: "", gigi: "", mulut: "", telinga: "", rahang: "", dagu: "", leher: "",
    dada: "", perut: "", tangan: "", punggung: "", pinggang: "", pinggul: "", kemaluan: "", kaki: "",
    kesimpulan: "", tgl_buat: "", status_approval: false, 
    foto_bukti: [] // STATE BARU UNTUK MENYIMPAN FOTO BUKTI
  };

  // ==========================
  // FUNGSI KOMPRESI & UPLOAD FOTO
  // ==========================
  function handleFileUpload(event) {
    const files = event.target.files;
    if (!files) return;
    
    // Pastikan array foto_bukti sudah ada
    if (!form.foto_bukti) form.foto_bukti = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Kompresi Gambar menggunakan Canvas agar Database tidak penuh
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Lebar maksimal gambar di PDF
          let scaleSize = 1;
          
          if (img.width > MAX_WIDTH) {
            scaleSize = MAX_WIDTH / img.width;
          }
          
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Ubah ke format JPEG dengan kualitas 70%
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7); 
          
          form.foto_bukti = [...form.foto_bukti, dataUrl];
        }
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  function hapusFoto(index) {
    form.foto_bukti = form.foto_bukti.filter((_, i) => i !== index);
  }

  // ==========================
  // FUNGSI DATABASE
  // ==========================
  async function kirimDataVisum() {
    if (!form.nama_korban) return alert("Isi Nama Korban terlebih dahulu!");
    isSaving = true;
    try {
      // Pastikan foto_bukti diset sebagai array kosong jika tidak ada foto
      const payloadToSave = { ...form, foto_bukti: form.foto_bukti || [] };

      if (editRow) {
        const { error } = await supabase.from('laporan_visum').update(payloadToSave).eq('id', editRow);
        if (error) throw error; alert("Draft Visum berhasil diupdate.");
      } else {
        const { error } = await supabase.from('laporan_visum').insert([payloadToSave]);
        if (error) throw error; alert("Draft Visum berhasil disimpan.");
        batalEditVisum();
      }
      pindahHalaman('riwayat'); 
    } catch (error) { alert("Gagal menyimpan: " + error.message); } 
    finally { isSaving = false; }
  }

  async function muatRiwayatVisum() {
    isRiwayatLoading = true;
    try {
      const { data, error } = await supabase.from('laporan_visum').select('*').order('created_at', { ascending: false }).limit(30);
      if (error) throw error; riwayatData = data || [];
    } catch (err) { alert("Gagal memuat riwayat."); } 
    finally { isRiwayatLoading = false; }
  }

  function editDataVisum(data) {
    if (data.status_approval) {
      visumTarget = data;
      unlockPassword = "";
      loginErrorMsg = "";
      showUnlockModal = true;
      return;
    }
    editRow = data.id; 
    // Pastikan memuat array foto jika ada, jika tidak, set array kosong
    form = { ...data, foto_bukti: data.foto_bukti || [] };
    pindahHalaman('form');
  }

  function batalEditVisum() {
    editRow = ""; 
    Object.keys(form).forEach(key => {
      if (key === 'status_approval') form[key] = false;
      else if (key === 'foto_bukti') form[key] = [];
      else form[key] = "";
    });
  }

  async function hapusVisum(id) {
    if (confirm("Hapus dokumen hukum visum ini secara permanen?")) {
      await supabase.from('laporan_visum').delete().eq('id', id);
      muatRiwayatVisum();
    }
  }

  function pindahHalaman(target) {
    activePage = target;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (target === 'riwayat') muatRiwayatVisum();
  }

  // ==========================
  // SISTEM APPROVAL & UNLOCK
  // ==========================
  function bukaModalApproval(visum) {
    visumTarget = visum;
    approvalPassword = "";
    loginErrorMsg = "";
    showApprovalModal = true;
  }

  async function setujuiVisumDenganPassword() {
    if (!approvalPassword) return loginErrorMsg = "Password wajib diisi!";
    isProcessing = true; loginErrorMsg = "";
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: 'kapus@satsetponcokusumo.com', password: approvalPassword });
      if (authError) throw new Error("Password Kepala Puskesmas Salah!");

      const { error: updateErr } = await supabase.from('laporan_visum').update({ status_approval: true }).eq('id', visumTarget.id);
      if (updateErr) throw updateErr;

      alert("Dokumen Sah! Visum telah DISETUJUI.");
      showApprovalModal = false;
      muatRiwayatVisum(); 
    } catch (err) { loginErrorMsg = err.message; } 
    finally { isProcessing = false; }
  }

  async function bukaKunciEditDenganPassword() {
    if (!unlockPassword) return loginErrorMsg = "Password wajib diisi!";
    isProcessing = true; loginErrorMsg = "";
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: 'kapus@satsetponcokusumo.com', password: unlockPassword });
      if (authError) throw new Error("Password Kepala Puskesmas Salah!");

      showUnlockModal = false;
      editRow = visumTarget.id; 
      form = { ...visumTarget, foto_bukti: visumTarget.foto_bukti || [] };
      alert("Akses Bypass Kapus Berhasil. Dokumen dapat diedit.");
      pindahHalaman('form');
    } catch (err) { loginErrorMsg = err.message; } 
    finally { isProcessing = false; }
  }

  // ==========================
  // METODE CETAK (PDF)
  // ==========================
  function cetakVisum(dataVisum) {
    if (!dataVisum.status_approval) return alert("❌ DITOLAK: Visum belum disetujui.");
    form = { ...dataVisum, foto_bukti: dataVisum.foto_bukti || [] }; 

    setTimeout(() => {
      const printContent = document.getElementById('print-layer').innerHTML;
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>VISUM_${form.nama_korban || 'Korban'}</title>
          <style>
            /* MARGIN ATAS DIKECILKAN JADI 10mm AGAR KOP NAIK */
            @page { size: A4; margin: 10mm 20mm 20mm 20mm; }
            body { font-family: 'Times New Roman', Times, serif; background: white; color: black; font-size: 12pt; line-height: 1.5; word-wrap: break-word; overflow-wrap: break-word; }
            magical-app, grammarly-extension, div[id^="magical"] { display: none !important; }
            
            .kop-surat { text-align: center; margin-bottom: 15px; position: relative; }
            .kop-logo { position: absolute; left: 0; top: 0; width: 75px; }
            .kop-judul { font-size: 16pt; font-weight: bold; margin: 0; letter-spacing: 1px; }
            .kop-teks { font-size: 11pt; margin: 2px 0; }
            
            .tabel-identitas, .tabel-umum { width: 100%; table-layout: fixed; }
            .tabel-identitas td, .tabel-umum td { vertical-align: top; padding: 3px 0; }
            .kolom-label { width: 30%; font-weight: normal; }
            .kolom-titikdua { width: 3%; text-align: center; }
            .kolom-isi { width: 67%; }

            .kolom-isi span, .teks-area { display: block; word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; font-weight: bold; }
            .paragraf-indent { text-indent: 1.25cm; text-align: justify; margin-top: 15px; margin-bottom: 15px; }
            .teks-cetak { font-weight: bold; border-bottom: 1px dotted #000; padding: 0 4px; }
            h4 { font-size: 12pt; text-decoration: underline; margin-top: 20px; margin-bottom: 10px; font-weight: bold; }
            table { page-break-inside: auto; border-collapse: collapse; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            
            /* CLASS BARU UNTUK LAMPIRAN HALAMAN BARU */
            .page-break { page-break-before: always; }
            .foto-grid { text-align: center; margin-top: 20px; }
            .foto-item { display: inline-block; width: 45%; margin: 10px; border: 1px solid #000; padding: 5px; box-sizing: border-box; }
            .foto-item img { width: 100%; height: auto; max-height: 350px; object-fit: contain; }
          </style>
        </head>
        <body onload="setTimeout(function(){ window.print(); window.parent.postMessage('printVisumSelesai', '*'); }, 1000)">
          ${printContent}
        </body>
        </html>
      `);
      doc.close();

      window.addEventListener('message', function cleanup(e) {
        if (e.data === 'printVisumSelesai') {
          setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500);
          window.removeEventListener('message', cleanup);
          if(!editRow) batalEditVisum(); 
        }
      });
    }, 100);
  }
</script>

{#if showApprovalModal}
  <div class="fixed inset-0 bg-slate-900/70 z-[100] flex justify-center items-center backdrop-blur-sm p-4">
    <div class="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full border-t-8 border-emerald-500 animate-fade-in">
      <div class="text-center mb-6">
        <span class="material-icons text-5xl text-emerald-500 mb-2">verified_user</span>
        <h3 class="font-black text-xl text-slate-800">Otorisasi Kapus</h3>
        <p class="text-sm text-slate-500">Persetujuan Dokumen Pro Justitia</p>
      </div>
      <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-6 text-sm text-center">
        Korban: <span class="font-bold uppercase">{visumTarget?.nama_korban}</span>
      </div>
      {#if loginErrorMsg} <div class="bg-red-100 text-red-700 p-2 rounded text-sm font-bold text-center mb-4 border border-red-200">{loginErrorMsg}</div> {/if}
      <input type="password" bind:value={approvalPassword} on:keydown={(e) => e.key === 'Enter' && setujuiVisumDenganPassword()} placeholder="Masukkan Password Kapus" class="w-full border-2 border-slate-300 p-3 rounded-xl mb-6 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 font-bold text-center tracking-widest text-lg">
      <div class="flex gap-3">
        <button on:click={() => showApprovalModal = false} class="bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl w-full">Batal</button>
        <button on:click={setujuiVisumDenganPassword} disabled={isProcessing} class="bg-emerald-600 text-white font-bold px-4 py-3 rounded-xl w-full">{isProcessing ? 'Proses...' : 'Setujui'}</button>
      </div>
    </div>
  </div>
{/if}

{#if showUnlockModal}
  <div class="fixed inset-0 bg-slate-900/70 z-[100] flex justify-center items-center backdrop-blur-sm p-4">
    <div class="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full border-t-8 border-red-500 animate-fade-in">
      <div class="text-center mb-6">
        <span class="material-icons text-5xl text-red-500 mb-2">lock</span>
        <h3 class="font-black text-xl text-slate-800">Dokumen Terkunci</h3>
        <p class="text-xs text-slate-500 mt-2">Visum ini telah disetujui dan sah secara hukum. Hanya Kapus yang dapat membuka kunci edit.</p>
      </div>
      {#if loginErrorMsg} <div class="bg-red-100 text-red-700 p-2 rounded text-sm font-bold text-center mb-4 border border-red-200">{loginErrorMsg}</div> {/if}
      <input type="password" bind:value={unlockPassword} on:keydown={(e) => e.key === 'Enter' && bukaKunciEditDenganPassword()} placeholder="Masukkan Password Kapus" class="w-full border-2 border-slate-300 p-3 rounded-xl mb-6 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 font-bold text-center tracking-widest text-lg">
      <div class="flex gap-3">
        <button on:click={() => showUnlockModal = false} class="bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl w-full">Batal</button>
        <button on:click={bukaKunciEditDenganPassword} disabled={isProcessing} class="bg-red-600 text-white font-bold px-4 py-3 rounded-xl w-full flex justify-center items-center">
          <span class="material-icons text-sm mr-1">lock_open</span> {isProcessing ? 'Proses...' : 'Buka Kunci'}
        </button>
      </div>
    </div>
  </div>
{/if}


<div class="bg-slate-50 min-h-screen pt-4 pb-20 relative">
  <div class="max-w-6xl mx-auto px-4 mb-6 flex flex-wrap gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
    <button on:click={() => switchView('dashboard')} class="text-purple-500 font-bold text-sm flex items-center hover:text-black transition">
      <span class="material-icons text-purple-500 mr-1">arrow_back</span> Kembali ke Dashboard
    </button>
    <div class="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
      <button on:click={() => pindahHalaman('form')} class="w-1/2 md:w-auto px-6 py-2 rounded-md font-bold text-sm transition-all {activePage === 'form' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-black'}">📝 Form Input</button>
      <button on:click={() => pindahHalaman('riwayat')} class="w-1/2 md:w-auto px-6 py-2 rounded-md font-bold text-sm transition-all {activePage === 'riwayat' ? 'bg-white shadow text-[#D4AF37]' : 'text-slate-500 hover:text-black'}">📂 Riwayat Dokumen</button>
    </div>
  </div>

  {#if activePage === 'form'}
  <div class="max-w-5xl mx-auto bg-white p-6 md:p-12 shadow-xl rounded-sm border-t-8 border-blue-600 animate-fade-in">
    
    <div class="text-center pb-4 mb-6 relative">
      <img src="/logo-kab.png" alt="Logo Kab Malang" class="absolute left-0 top-0 w-16 md:w-20">
      <h2 class="text-xl md:text-2xl font-black m-0 uppercase text-slate-800 tracking-wider">PEMERINTAH KABUPATEN MALANG</h2>
      <h2 class="text-xl md:text-2xl font-black m-0 uppercase tracking-wider">DINAS KESEHATAN</h2>
      <h1 class="text-2xl md:text-3xl font-black m-0 uppercase tracking-widest mt-1">UPT Puskesmas Poncokusumo</h1>
      <div class="text-center mt-2 pt-2 text-slate-700">
        <p class="text-[10px] md:text-xs leading-relaxed m-0 font-medium">Jalan Kusnan Marzuki No. 101, Wonomulyo, Kabupaten Malang, Jawa Timur</p>
        <p class="text-[10px] md:text-xs leading-relaxed m-0">Telpon/ Faksimile <span class="font-semibold">(0341) 2319509</span> | Laman: <span class="italic text-black-700">puskesmasponcokusumo.malangkab.go.id</span></p>
        <p class="text-[10px] md:text-xs leading-relaxed m-0 font-medium">Pos-el: <span class="italic font-semibold">pkmponcokusumo@gmail.com</span>, Kode Pos: 65157</p>
      </div>
    </div>

    <div class="flex justify-between items-start mb-6">
      <div>
        <h3 class="font-black text-xl underline tracking-widest">PRO JUSTISIA</h3>
        <table class="text-sm mt-2 font-bold w-full">
          <tbody><tr><td class="w-24">Nomor</td><td>: <input type="text" bind:value={form.no_surat} class="border-b border-dashed border-slate-400 outline-none w-full max-w-[200px]"></td></tr>
          <tr><td>Klasifikasi</td><td>: Rahasia</td></tr>
          <tr><td>Perihal</td><td>: Visum Et Repertum Hidup</td></tr>
        </tbody></table>
      </div>
      <div class="text-right">
        <h2 class="text-xl md:text-2xl font-black border-2 border-black p-2 inline-block shadow-sm">VISUM ET REPERTUM</h2>
      </div>
    </div>

    <div class="space-y-4 text-sm md:text-base">
      <p class="leading-relaxed text-justify">
        Atas permintaan tertulis dari Kepolisian Negara Republik Indonesia Resor Malang Sektor Poncokusumo, melalui suratnya tanggal <input type="date" bind:value={form.tgl_permintaan} class="border-b border-dashed border-blue-400 text-blue-700 font-bold outline-none">
        Nomor Polisi: <input type="text" bind:value={form.no_polisi} class="border-b border-dashed border-blue-400 text-blue-700 font-bold outline-none w-full md:w-48"> yang ditanda-tangani oleh 
        <input type="text" bind:value={form.penandatangan_polisi} placeholder="Nama Penyidik" class="border-b border-dashed border-blue-400 text-blue-700 font-bold outline-none w-full md:w-auto">, 
        Pangkat <input type="text" bind:value={form.pangkat_polisi} class="border-b border-dashed border-blue-400 text-blue-700 font-bold outline-none w-full md:w-32">
        yang diterima pada tanggal <input type="date" bind:value={form.tgl_terima} class="border-b border-dashed border-blue-400 text-blue-700 font-bold outline-none"> 
        pukul <input type="time" bind:value={form.jam_terima} class="border-b border-dashed border-blue-400 text-blue-700 font-bold outline-none"> WIB, 
        dan dilakukan pemeriksaan medis oleh Dokter Puskesmas Poncokusumo, tentang permintaan Visum Et Repertum Hidup dengan identitas korban sebagai berikut:
      </p>

      <table class="w-full ml-8 font-semibold">
        <tbody><tr><td class="w-[30%] md:w-[20%]">Nama</td><td>: <input type="text" bind:value={form.nama_korban} class="border-b w-[90%] md:w-3/4 uppercase"></td></tr>
        <tr><td>Jenis Kelamin</td><td>: <select bind:value={form.jk_korban} class="border-b outline-none w-[90%] md:w-auto"><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></td></tr>
        <tr><td>Umur</td><td>: <input type="text" bind:value={form.umur_korban} class="border-b w-[90%] md:w-1/2 outline-none"></td></tr>
        <tr><td>Agama</td><td>: <input type="text" bind:value={form.agama_korban} class="border-b w-[90%] md:w-1/2 outline-none"></td></tr>
        <tr><td>Pekerjaan</td><td>: <input type="text" bind:value={form.pekerjaan_korban} class="border-b w-[90%] md:w-1/2 outline-none"></td></tr>
        <tr><td>Alamat</td><td>: <input type="text" bind:value={form.alamat_korban} class="border-b w-[90%] md:w-3/4 outline-none"></td></tr>
      </tbody></table>

      <h3 class="font-bold mt-6 mb-2 bg-slate-200 p-2 rounded">TANDA-TANDA VITAL :</h3>
      <div class="grid grid-cols-2 gap-4 ml-4">
        <div>Keadaan Umum: <input type="text" bind:value={form.ku} class="border-b border-dashed w-full md:w-1/2 outline-none text-blue-700 font-bold"></div>
        <div>Suhu: <input type="text" bind:value={form.suhu} class="border-b border-dashed w-[80%] md:w-1/2 outline-none text-blue-700 font-bold"> °C</div>
        <div>Tekanan Darah: <input type="text" bind:value={form.td} class="border-b border-dashed w-[80%] md:w-1/2 outline-none text-blue-700 font-bold"> mmHg</div>
        <div>Nadi: <input type="text" bind:value={form.nadi} class="border-b border-dashed w-[80%] md:w-1/2 outline-none text-blue-700 font-bold"> x/mnt</div>
        <div>Tinggi Badan: <input type="text" bind:value={form.tb} class="border-b border-dashed w-[80%] md:w-1/2 outline-none text-blue-700 font-bold"> cm</div>
        <div>Pernafasan: <input type="text" bind:value={form.rr} class="border-b border-dashed w-[80%] md:w-1/2 outline-none text-blue-700 font-bold"> x/mnt</div>
        <div>Berat Badan: <input type="text" bind:value={form.bb} class="border-b border-dashed w-[80%] md:w-1/2 outline-none text-blue-700 font-bold"> kg</div>
      </div>

      <h3 class="font-bold mt-6 mb-2 bg-slate-200 p-2 rounded">HASIL PEMERIKSAAN LUAR :</h3>
      <textarea bind:value={form.hasil_luar} class="w-full border p-3 min-h-[100px] rounded mb-4 text-blue-800" placeholder="Ketik narasi umum pemeriksaan luar di sini..."></textarea>
      
      <div class="grid grid-cols-2 gap-x-2 gap-y-4 ml-0 md:ml-4">
        {#each ['Kepala', 'Dahi', 'Pipi', 'Mata', 'Hidung', 'Bibir', 'Gigi', 'Mulut', 'Telinga', 'Rahang', 'Dagu', 'Leher', 'Dada', 'Perut', 'Tangan', 'Punggung', 'Pinggang', 'Pinggul', 'Kemaluan', 'Kaki'] as organ}
          <div class="flex items-center">
            <span class="w-24 font-semibold">{organ}</span> <span class="hidden md:inline">:</span> 
            <input type="text" bind:value={form[organ.toLowerCase()]} class="border-b border-dashed w-full md:ml-2 outline-none text-blue-700 font-bold" placeholder="...">
          </div>
        {/each}
      </div>

      <h3 class="font-bold mt-8 mb-2 bg-slate-200 p-2 rounded">KESIMPULAN :</h3>
      <p class="italic text-xs text-slate-500 mb-2">Dari pemeriksaan luar tersebut ditemukan:</p>
      <textarea bind:value={form.kesimpulan} class="w-full border p-3 min-h-[120px] rounded mb-4 text-blue-800 font-bold" placeholder="Tuliskan derajat luka dan benda penyebab (Tumpul/Tajam)..."></textarea>

      <p class="text-justify mt-4">Demikian Visum et Repertum hidup ini dibuat dengan mengingat sumpah jabatan dan dapat dipertanggungjawabkan kebenarannya.</p>

      <div class="flex justify-between mt-12 mb-8 flex-col md:flex-row gap-8">
        
        <div class="text-left w-full md:w-64">
          <p>Mengetahui,</p>
          <p>Kepala UPT Puskesmas Poncokusumo,</p>
          <br><br><br><br>
          <p class="font-bold">dr. Wiwit Wijayati</p>
          <p>NIP. 19750124 200604 2 015</p>
        </div>

        <div class="text-left w-full md:w-64">
          <p>Dikeluarkan di Poncokusumo</p>
          <p>Pada Tanggal, <input type="date" bind:value={form.tgl_buat} class="border-b border-dashed border-slate-400 outline-none w-[130px]"></p>
          <p>Dokter Pemeriksa,</p>
          <br><br><br>
          <p class="font-bold">dr. <input type="text" bind:value={form.nama_dokter} placeholder="Nama Dokter" class="border-b border-dashed border-slate-400 outline-none font-bold w-3/4"></p>
          <p>NIP. <input type="text" bind:value={form.nip_dokter} placeholder="NIP Dokter" class="border-b border-dashed border-slate-400 outline-none w-3/4"></p>
        </div>
        
      </div>

      <div class="mt-12 border-t-2 border-dashed border-slate-300 pt-8">
        <h3 class="font-black text-lg mb-2 text-slate-800 flex items-center">
          <span class="material-icons mr-2 text-blue-600">add_a_photo</span> Lampiran Bukti Foto (Opsional)
        </h3>
        <p class="text-xs text-slate-500 mb-4">Unggah foto luka/korban. Foto akan dikompresi otomatis dan dicetak di halaman terpisah (Lampiran).</p>
        
        <input type="file" multiple accept="image/*" on:change={handleFileUpload} 
               class="mb-6 block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"/>
        
        {#if form.foto_bukti && form.foto_bukti.length > 0}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {#each form.foto_bukti as foto, i}
              <div class="relative group">
                <img src={foto} alt="Bukti Visum" class="w-full h-32 md:h-40 object-cover rounded-xl border-2 border-slate-200 shadow-sm">
                <button on:click={() => hapusFoto(i)} class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow hover:bg-red-600 transition opacity-90 hover:opacity-100" title="Hapus Foto">
                  <span class="material-icons text-sm block">close</span>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    </div>

    <div class="bg-slate-100 p-4 rounded-xl flex justify-center gap-4 mt-8 border border-slate-300">
      <button on:click={kirimDataVisum} disabled={isSaving} class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center transition">
        <span class="material-icons mr-2">save</span> {editRow ? 'Perbarui Draft Visum' : 'Simpan Draft Ke Database'}
      </button>
      {#if editRow}
        <button on:click={batalEditVisum} class="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 py-3 rounded-xl font-bold shadow flex items-center transition">Batal Edit</button>
      {/if}
    </div>
  </div>
  {/if}

  {#if activePage === 'riwayat'}
  <div class="max-w-6xl mx-auto bg-white p-4 md:p-8 rounded-2xl shadow-xl border border-slate-200 animate-fade-in mx-2 md:mx-auto">
    <div class="flex justify-between items-end border-b-2 border-slate-200 pb-4 mb-6">
      <div>
        <h2 class="font-black text-xl md:text-2xl text-slate-800">Bank Dokumen Visum</h2>
        <p class="text-xs md:text-sm text-slate-500">Daftar Laporan Visum Et Repertum yang tersimpan di sistem.</p>
      </div>
    </div>

    {#if isRiwayatLoading}
      <div class="text-center py-10"><span class="material-icons animate-spin text-4xl text-slate-300">sync</span></div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-slate-800 text-white">
            <tr>
              <th class="p-3 md:p-4 rounded-tl-lg whitespace-nowrap">No. Polisi / Tgl</th>
              <th class="p-3 md:p-4 whitespace-nowrap">Identitas Korban</th>
              <th class="p-3 md:p-4 text-center whitespace-nowrap">Status Hukum</th>
              <th class="p-3 md:p-4 text-right rounded-tr-lg whitespace-nowrap">Aksi Dokumen</th>
            </tr>
          </thead>
          <tbody>
            {#each riwayatData as v}
              <tr class="border-b hover:bg-slate-50 transition">
                <td class="p-3 md:p-4"><span class="font-bold block text-xs md:text-sm">{v.no_polisi || '-'}</span><span class="text-[10px] md:text-xs text-slate-500">{v.tgl_buat || 'Belum di-set'}</span></td>
                <td class="p-3 md:p-4"><span class="font-black text-slate-800 uppercase text-xs md:text-sm">{v.nama_korban}</span><span class="text-[10px] md:text-xs text-slate-500 block mt-1">Penyidik: {v.penandatangan_polisi}</span></td>
                
                <td class="p-3 md:p-4 text-center">
                  {#if v.status_approval}
                    <div class="bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-1 md:px-3 md:py-1.5 rounded-lg font-black text-[10px] md:text-xs inline-flex items-center shadow-sm">
                      <span class="material-icons text-xs md:text-sm mr-1">verified</span> DISETUJUI
                    </div>
                  {:else}
                    <div class="bg-orange-100 text-orange-700 border border-orange-300 px-2 py-1 md:px-3 md:py-1.5 rounded-lg font-bold text-[10px] md:text-xs inline-flex items-center shadow-sm">
                      <span class="material-icons text-xs md:text-sm mr-1">pending_actions</span> DRAFT
                    </div>
                  {/if}
                </td>
                
                <td class="p-3 md:p-4 text-right space-y-2 md:space-y-0 md:space-x-2">
                  {#if v.status_approval}
                    <button on:click={() => editDataVisum(v)} class="bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 px-2 md:px-3 py-1.5 md:py-2 rounded-lg font-bold text-[10px] md:text-xs inline-flex items-center transition shadow-sm w-full md:w-auto justify-center mb-1 md:mb-0" title="Bypass khusus Kapus">
                      <span class="material-icons text-xs md:text-sm mr-1">lock</span> Edit Terkunci
                    </button>
                  {:else}
                    <button on:click={() => editDataVisum(v)} class="bg-slate-100 text-slate-700 hover:bg-slate-200 px-2 md:px-3 py-1.5 md:py-2 rounded-lg font-bold text-[10px] md:text-xs inline-flex items-center transition shadow-sm border border-slate-300 w-full md:w-auto justify-center mb-1 md:mb-0">
                      <span class="material-icons text-xs md:text-sm mr-1">edit</span> Edit
                    </button>
                  {/if}

                  {#if !v.status_approval}
                    <button on:click={() => bukaModalApproval(v)} class="bg-[#D4AF37] hover:bg-yellow-600 text-white px-2 md:px-3 py-1.5 md:py-2 rounded-lg font-bold text-[10px] md:text-xs inline-flex items-center transition shadow-md w-full md:w-auto justify-center">
                      <span class="material-icons text-xs md:text-sm mr-1">gavel</span> Setujui
                    </button>
                  {:else}
                    <button on:click={() => cetakVisum(v)} class="bg-blue-600 hover:bg-blue-700 text-white px-2 md:px-4 py-1.5 md:py-2 rounded-lg font-black text-[10px] md:text-xs inline-flex items-center transition shadow-lg ring-1 md:ring-2 ring-blue-300 ring-offset-1 w-full md:w-auto justify-center">
                      <span class="material-icons text-xs md:text-sm mr-1">print</span> PRINT
                    </button>
                  {/if}
                  
                  {#if !v.status_approval}
                    <button on:click={() => hapusVisum(v.id)} class="text-red-400 hover:text-red-600 p-1 md:p-2 rounded-full transition md:ml-2 align-middle" title="Hapus"><span class="material-icons text-sm md:text-base">delete</span></button>
                  {/if}
                </td>
              </tr>
            {/each}
            {#if riwayatData.length === 0} <tr><td colspan="4" class="p-8 text-center text-slate-400 font-bold">Belum ada dokumen visum.</td></tr> {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  {/if}
</div>

<div id="print-layer" style="display: none;">
  <div class="kop-surat" style="text-align: center; margin-bottom: 15px; position: relative;">
    <img src="/logo-kab.png" class="kop-logo" alt="Logo" style="position: absolute; left: 0; top: 0; width: 75px;">
    <h2 class="kop-judul uppercase" style="color: black; letter-spacing: 1px; font-size: 16pt; font-weight: bold; margin: 0;">PEMERINTAH KABUPATEN MALANG</h2>
    <h2 class="kop-judul uppercase" style="font-size: 16pt; font-weight: bold; margin: 0;">DINAS KESEHATAN</h2>
    <h2 class="kop-judul uppercase" style="font-size: 18pt; font-weight: bold; margin: 0;">UPT PUSKESMAS PONCOKUSUMO</h2>
    
    <div style="text-align: center; margin-top: 5px; color: black;">
      <p style="font-size: 11pt; margin: 0; font-weight: 500;">Jalan Kusnan Marzuki No. 101, Wonomulyo, Kabupaten Malang, Jawa Timur</p>
      <p style="font-size: 11pt; margin: 0;">Telpon/ Faksimile <span style="font-weight: bold;">(0341) 2319509</span> | Laman: <span style="font-style: italic; color: black;">puskesmasponcokusumo.malangkab.go.id</span></p>
      <p style="font-size: 11pt; margin: 0; font-weight: 500;">Pos-el: <span style="font-style: italic; font-weight: bold;">pkmponcokusumo@gmail.com</span>, Kode Pos: 65157</p>
    </div>
  </div>

  <table style="width: 100%; margin-bottom: 20px;">
    <tbody>
      <tr>
        <td style="width: 60%; vertical-align: top;">
          <h3 style="text-decoration: underline; margin:0; letter-spacing: 2px;">PRO JUSTISIA</h3>
          <table style="margin-top: 10px;">
            <tbody>
              <tr><td style="width: 80px;">Nomor</td><td style="width: 10px;">:</td><td>{form.no_surat}</td></tr>
              <tr><td>Klasifikasi</td><td>:</td><td>Rahasia</td></tr>
              <tr><td>Perihal</td><td>:</td><td>Visum Et Repertum Hidup</td></tr>
            </tbody>
          </table> 
        </td> 
        <td style="width: 40%; text-align: right; vertical-align: top;">
          <div style="border: 2px solid black; padding: 10px; display: inline-block;">
            <h2 style="margin:0; font-size: 14pt; font-weight: bold;">VISUM ET REPERTUM</h2>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  <p class="paragraf-indent">
    Atas permintaan tertulis dari Kepolisian Negara Republik Indonesia Resor Malang Sektor Poncokusumo, melalui suratnya tanggal <span class="teks-cetak">{form.tgl_permintaan}</span> 
    Nomor Polisi: <span class="teks-cetak">{form.no_polisi}</span> yang ditanda-tangani oleh <span class="teks-cetak">{form.penandatangan_polisi}</span>, Pangkat <span class="teks-cetak">{form.pangkat_polisi}</span> 
    yang diterima tanggal <span class="teks-cetak">{form.tgl_terima}</span> pukul <span class="teks-cetak">{form.jam_terima}</span> WIB, dan dilakukan pemeriksaan oleh dr. <span class="teks-cetak">{form.nama_dokter}</span> 
    Jabatan Dokter Puskesmas Poncokusumo, tentang permintaan Visum Et Repertum Hidup dengan identitas sebagai berikut:
  </p>

  <table class="tabel-identitas">
    <tbody>
      <tr><td class="kolom-label">Nama</td><td class="kolom-titikdua">:</td><td class="kolom-isi"><span style="text-transform: uppercase;">{form.nama_korban}</span></td></tr>
      <tr><td class="kolom-label">Jenis kelamin</td><td class="kolom-titikdua">:</td><td class="kolom-isi"><span>{form.jk_korban}</span></td></tr>
      <tr><td class="kolom-label">Umur</td><td class="kolom-titikdua">:</td><td class="kolom-isi"><span>{form.umur_korban}</span></td></tr>
      <tr><td class="kolom-label">Agama</td><td class="kolom-titikdua">:</td><td class="kolom-isi"><span>{form.agama_korban}</span></td></tr>
      <tr><td class="kolom-label">Warga Negara</td><td class="kolom-titikdua">:</td><td class="kolom-isi"><span>{form.wn_korban}</span></td></tr>
      <tr><td class="kolom-label">Pekerjaan</td><td class="kolom-titikdua">:</td><td class="kolom-isi"><span>{form.pekerjaan_korban}</span></td></tr>
      <tr><td class="kolom-label">Alamat</td><td class="kolom-titikdua">:</td><td class="kolom-isi"><span>{form.alamat_korban}</span></td></tr>
    </tbody>
  </table>

  <h4>TANDA - TANDA VITAL :</h4>
  <table class="tabel-umum">
    <tbody>
      <tr><td style="width: 50%;">Keadaan Umum : <span style="font-weight: bold;">{form.ku}</span></td><td style="width: 50%;">Pernafasan : <span style="font-weight: bold;">{form.rr}</span> x/mnt</td></tr>
      <tr><td>Tekanan Darah : <span style="font-weight: bold;">{form.td}</span> mmHg</td><td>Tinggi Badan : <span style="font-weight: bold;">{form.tb}</span> cm</td></tr>
      <tr><td>Suhu : <span style="font-weight: bold;">{form.suhu}</span> °C</td><td>Berat badan : <span style="font-weight: bold;">{form.bb}</span> kg</td></tr>
      <tr><td>Nadi : <span style="font-weight: bold;">{form.nadi}</span> x/mnt</td><td></td></tr>
    </tbody>
  </table>

  <h4>HASIL PEMERIKSAAN LUAR :</h4>
  <span class="teks-area">{form.hasil_luar}</span>
  
  <table class="tabel-umum" style="margin-top: 15px;">
    <tbody>
      <tr><td style="width: 50%;">Kepala : <span style="font-weight:bold;">{form.kepala}</span></td><td style="width: 50%;">Dagu : <span style="font-weight:bold;">{form.dagu}</span></td></tr>
      <tr><td>Dahi : <span style="font-weight:bold;">{form.dahi}</span></td><td>Leher : <span style="font-weight:bold;">{form.leher}</span></td></tr>
      <tr><td>Pipi : <span style="font-weight:bold;">{form.pipi}</span></td><td>Dada : <span style="font-weight:bold;">{form.dada}</span></td></tr>
      <tr><td>Mata : <span style="font-weight:bold;">{form.mata}</span></td><td>Perut : <span style="font-weight:bold;">{form.perut}</span></td></tr>
      <tr><td>Hidung : <span style="font-weight:bold;">{form.hidung}</span></td><td>Tangan : <span style="font-weight:bold;">{form.tangan}</span></td></tr>
      <tr><td>Bibir : <span style="font-weight:bold;">{form.bibir}</span></td><td>Punggung : <span style="font-weight:bold;">{form.punggung}</span></td></tr>
      <tr><td>Gigi : <span style="font-weight:bold;">{form.gigi}</span></td><td>Pinggang : <span style="font-weight:bold;">{form.pinggang}</span></td></tr>
      <tr><td>Mulut : <span style="font-weight:bold;">{form.mulut}</span></td><td>Pinggul : <span style="font-weight:bold;">{form.pinggul}</span></td></tr>
      <tr><td>Telinga : <span style="font-weight:bold;">{form.telinga}</span></td><td>Kemaluan : <span style="font-weight:bold;">{form.kemaluan}</span></td></tr>
      <tr><td>Rahang : <span style="font-weight:bold;">{form.rahang}</span></td><td>Kaki : <span style="font-weight:bold;">{form.kaki}</span></td></tr>
    </tbody>
  </table>

  <h4>KESIMPULAN :</h4>
  <p style="margin: 0 0 5px 0;">Dari pemeriksaan luar tersebut ditemukan :</p>
  <span class="teks-area">{form.kesimpulan}</span>

  <p class="paragraf-indent">
    Demikian Visum et Repertum hidup ini dibuat dengan mengingat sumpah jabatan dan dapat dipertanggungjawabkan kebenarannya.
  </p>

  <table style="width: 100%; margin-top: 40px; border: none; table-layout: fixed;">
    <tbody>
      <tr>
        <td style="width: 50%; vertical-align: top; text-align: center;">
          <div style="display: inline-block; text-align: left;">
            <p style="margin:0;">Mengetahui,</p>
            <p style="margin:0;">Kepala UPT Puskesmas Poncokusumo,</p>
            <br><br><br><br>
            <p style="margin:0; font-weight: bold;">dr. Wiwit Wijayati</p>
            <p style="margin:0;">NIP. 19750124 200604 2 015</p>
          </div>
        </td>
        
        <td style="width: 50%; vertical-align: top; text-align: center;">
          <div style="display: inline-block; text-align: left;">
            <p style="margin:0;">Dikeluarkan di Poncokusumo</p>
            <p style="margin:0;">Pada Tanggal, {form.tgl_buat}</p>
            <p style="margin:0;">Dokter Pemeriksa,</p>
            <br><br><br><br>
            <p style="margin:0; font-weight: bold;">dr. {form.nama_dokter || '............................'}</p>
            <p style="margin:0;">NIP. {form.nip_dokter || '............................'}</p>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  {#if form.foto_bukti && form.foto_bukti.length > 0}
    <div class="page-break"></div>

    <div class="kop-surat" style="text-align: center; margin-bottom: 15px; position: relative;">
      <img src="/logo-kab.png" class="kop-logo" alt="Logo" style="position: absolute; left: 0; top: 0; width: 75px;">
      <h2 class="kop-judul uppercase" style="color: black; letter-spacing: 1px; font-size: 16pt; font-weight: bold; margin: 0;">PEMERINTAH KABUPATEN MALANG</h2>
      <h2 class="kop-judul uppercase" style="font-size: 16pt; font-weight: bold; margin: 0;">DINAS KESEHATAN</h2>
      <h2 class="kop-judul uppercase" style="font-size: 18pt; font-weight: bold; margin: 0;">UPT PUSKESMAS PONCOKUSUMO</h2>
      
      <div style="text-align: center; margin-top: 5px; color: black;">
        <p style="font-size: 11pt; margin: 0; font-weight: 500;">Jalan Kusnan Marzuki No. 101, Wonomulyo, Kabupaten Malang, Jawa Timur</p>
        <p style="font-size: 11pt; margin: 0;">Telpon/ Faksimile <span style="font-weight: bold;">(0341) 2319509</span> | Laman: <span style="font-style: italic; color: black;">puskesmasponcokusumo.malangkab.go.id</span></p>
        <p style="font-size: 11pt; margin: 0; font-weight: 500;">Pos-el: <span style="font-style: italic; font-weight: bold;">pkmponcokusumo@gmail.com</span>, Kode Pos: 65157</p>
      </div>
    </div>

    <h3 style="text-align: center; text-decoration: underline; margin-top: 30px; font-size: 14pt;">LAMPIRAN DOKUMENTASI VISUM</h3>
    <table style="width: 100%; margin-bottom: 20px; font-size: 12pt;">
      <tbody>
        <tr>
          <td style="width: 50%; text-align: right; padding-right: 10px;">Atas Nama Korban:</td>
          <td style="font-weight: bold; text-transform: uppercase;">{form.nama_korban}</td>
        </tr>
        <tr>
          <td style="text-align: right; padding-right: 10px;">Berdasarkan Surat Permintaan No:</td>
          <td style="font-weight: bold;">{form.no_surat}</td>
        </tr>
      </tbody>
    </table>

    <div class="foto-grid">
      {#each form.foto_bukti as foto}
        <div class="foto-item">
          <img src="{foto}" alt="Bukti Foto">
        </div>
      {/each}
    </div>
  {/if}

</div>

<style>
  .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  /* ==========================================
     🚀 OPTIMASI UI/UX FORM VISUM KHUSUS MOBILE
     ========================================== */
  @media screen and (max-width: 768px) {
    .max-w-5xl.mx-auto > .text-center.relative { display: flex; flex-direction: column; align-items: center; padding-top: 10px; }
    .max-w-5xl.mx-auto img[alt="Logo Kab Malang"] { position: static !important; width: 70px !important; margin-bottom: 15px; }
    h1.text-3xl { font-size: 1.5rem !important; line-height: 1.2; margin-bottom: 5px; }
    h2.text-2xl { font-size: 1.1rem !important; }

    .flex.justify-between.items-start.mb-6 { flex-direction: column-reverse; gap: 15px; }
    .flex.justify-between.items-start.mb-6 > .text-right { text-align: left; width: 100%; }
    .flex.justify-between.items-start.mb-6 h2 { width: 100%; text-align: center; }

    input[type="date"], input[type="time"], input[type="text"], textarea, select { font-size: 16px !important; }
    p.leading-relaxed input { padding: 4px 8px; background: #f8fafc; border: 1px solid #cbd5e1 !important; border-radius: 6px; margin: 2px 0; }

    table.w-full.ml-8 { margin-left: 0 !important; }
    table.w-full.ml-8 td { display: block; width: 100% !important; padding: 2px 0; }
    table.w-full.ml-8 tr { display: block; margin-bottom: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px; }
    table.w-full.ml-8 input, table.w-full.ml-8 select { width: 100% !important; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 6px; }

    .grid.grid-cols-2 { grid-template-columns: 1fr !important; gap: 12px !important; margin-left: 0 !important; }
    .grid div { display: flex; flex-direction: column; font-size: 14px; color: #334155; }
    .grid div input { width: 100% !important; padding: 10px !important; border: 1px solid #cbd5e1 !important; border-radius: 8px; background: #f8fafc; margin-top: 4px; margin-left: 0 !important; }

    .flex.items-center span.w-24 { width: 100% !important; margin-bottom: 4px; font-weight: 700; color: #0f172a;}
    .flex.items-center { flex-direction: column; align-items: flex-start; }

    .flex.justify-between.mt-12.mb-8 { flex-direction: column; gap: 40px; align-items: center; }
    .w-64 { width: 100% !important; }
    .w-64 input { background: #f8fafc; border: 1px solid #cbd5e1 !important; padding: 5px; border-radius: 6px;}

    .bg-slate-100.p-4.rounded-xl.flex { flex-direction: column; gap: 10px; }
    .bg-slate-100.p-4.rounded-xl.flex button { width: 100%; justify-content: center; padding: 14px 0; }
  }
</style>