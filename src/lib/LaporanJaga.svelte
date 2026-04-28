<script>
  import { onMount } from 'svelte';
  import { supabase } from './supabase.js';
  import AuthAdmin from './AuthAdmin.svelte'; 

  export let switchView;
  export let activeTab = 'input'; 

  // =====================================
  // STATE: TIM JAGA & FORM PASIEN
  // =====================================
  let currentShiftJaga = "";
  let nakesText = "";
  let nakesForm = { s: "PAGI", dr: "", p1: "", p2: "", p3: "", b1: "", b2: "" };

  let jagaNama = ""; let jagaTglLahir = ""; let jagaNorm = "";
  let jagaStatusPasien = "BPJS"; let jagaBiaya = "0"; let jagaDiagnosa = "";
  let jagaRuangan = "UGD"; let jagaTerapi = ""; let jagaKendala = "";
  
  let obatInput = ""; let qtyInput = 1; let listJaga = []; 
  
  // =====================================
  // MASTER DATA OBAT & RADAR
  // =====================================
  let mapStokObat = {}; 
  let jagaObatUmum = [];
  let jagaObatKaber = [];
  
  $: activeObatList = [...new Set(jagaRuangan === "KABER" ? jagaObatKaber : jagaObatUmum)];
  $: listObatDataAll = [...new Set([...jagaObatUmum, ...jagaObatKaber])];

  let showDropdown = false;
  $: filteredObat = activeObatList.filter(o => {
    if (!o) return false;
    if (!obatInput) return true;
    return o.toLowerCase().includes(obatInput.toLowerCase());
  });

  let isSavingJaga = false;

  // =====================================
  // STATE: REKAP JAGA & MODAL
  // =====================================
  let isRekapLoading = false;
  let rekapItems = [];
  let editKendalaShift = "";
  let txtLaporan = "";
  let isSavingKendala = false;

  let showModalEdit = false; let editRow = ""; let editNama = "";
  let editRM = ""; let editTerapi = ""; let editObat = ""; let editJumlah = "";
  let isSavingEdit = false;

  let showModalTambah = false; let addObatRow = ""; let addObatNama = "";
  let addObatRM = ""; let addObatInput = ""; let addObatJumlah = 1;
  let isSavingAdd = false; let showDropdownTambah = false;
  
  $: filteredObatTambah = listObatDataAll.filter(o => {
    if (!o) return false;
    if (!addObatInput) return true;
    return o.toLowerCase().includes(addObatInput.toLowerCase());
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
  // STATE: BUKU STELING OBAT 
  // =====================================
  let stelingStartDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]; 
  let stelingEndDate = new Date().toISOString().split('T')[0]; 
  let stelingFilterObat = "SEMUA"; 
  let stelingItems = [];
  let isStelingLoading = false;

  let isPurgingSteling = false;
  let showPurgeStelingModal = false;

  // =====================================
  // INISIALISASI
  // =====================================
  onMount(async () => {
    checkNakes();
    await fetchObatMaster();
  });

  $: if (activeTab === 'rekap' && currentShiftJaga) muatDataDanLaporan();
  $: if (activeTab === 'rekapObat') {
    if (!filterMulaiObat) setBulanIniObat(); else tarikDataObatTerpadu();
  }
  $: if (activeTab === 'steling') tarikDataSteling(); 

  // =====================================
  // FUNGSI PENYEDOT DATA (DARI STOK JAGA)
  // =====================================
  async function fetchObatMaster() {
    try {
      const { data, error } = await supabase.from('stok_obat_jaga').select('nama, jumlah').order('nama', { ascending: true });
      if (error) throw error;
      if (data) {
        const daftarNama = [];
        data.forEach(d => {
           if (d.nama) {
               daftarNama.push(d.nama);
               mapStokObat[d.nama] = d.jumlah || 0; 
           }
        });
        const unikNama = [...new Set(daftarNama)];
        jagaObatUmum = [...unikNama]; 
        jagaObatKaber = [...unikNama];
      }
    } catch (e) { console.error("Gagal memuat daftar obat:", e.message); }
  }

  function checkNakes() {
    const s = localStorage.getItem('nakesPKM');
    if (s) {
      const d = JSON.parse(s); currentShiftJaga = d.s;
      nakesText = `SESI JAGA AKTIF: ${d.s}<br><span class='font-normal text-xs text-gray-300'>Dr. ${d.dr || '-'} | P: ${d.p || '-'} | B: ${d.b || '-'}</span>`;
    } else { currentShiftJaga = ""; }
  }
  function setNakes() {
    const pArray = [nakesForm.p1, nakesForm.p2, nakesForm.p3].filter(Boolean).join(", ");
    const bArray = [nakesForm.b1, nakesForm.b2].filter(Boolean).join(", ");
    const d = { s: nakesForm.s, dr: nakesForm.dr, p: pArray, b: bArray };
    localStorage.setItem('nakesPKM', JSON.stringify(d)); checkNakes();
  }
  function editNakes() { localStorage.removeItem('nakesPKM'); checkNakes(); }

  function handleFormatRupiah(e) {
    let v = e.target.value.replace(/\D/g, "");
    jagaBiaya = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function addJagaItem() {
    if (!obatInput) return;
    const exactObat = activeObatList.find(o => o.trim().toLowerCase() === obatInput.trim().toLowerCase());
    const finalObatName = exactObat ? exactObat : obatInput.trim().toUpperCase();
    const isStok = !!exactObat;

    listJaga = [...listJaga, { obat: finalObatName, jumlah: qtyInput, sumber: jagaRuangan, status: isStok ? "STOK" : "MANUAL" }];
    obatInput = ""; qtyInput = 1; showDropdown = false;
  }
  function hapusJagaItem(index) { listJaga = listJaga.filter((_, i) => i !== index); }

  async function saveJaga() {
    if (!jagaNama.trim()) return alert("Nama Pasien wajib diisi!");
    isSavingJaga = true;
    const n = JSON.parse(localStorage.getItem('nakesPKM'));
    let itemsToSave = listJaga.length > 0 ? listJaga : [{ obat: "-", jumlah: 0, sumber: jagaRuangan, status: "MANUAL" }];
    const hariIni = new Date().toISOString().split('T')[0];
    const shiftID = `${hariIni}_${n.s}`; 

    try {
      const { error } = await supabase.from('laporan_pasien').insert([{
        tanggal: hariIni, shift_id: shiftID, shift_nama: n.s, nakes_info: `Dr: ${n.dr} | P: ${n.p} | B: ${n.b}`,
        nama: jagaNama.toUpperCase(), tgl_lahir: jagaTglLahir, rm: jagaNorm.trim() || "-", diagnosa: jagaDiagnosa.trim() || "-",
        terapi: jagaTerapi.trim() || "-", ruangan: jagaRuangan, status_pasien: jagaStatusPasien, biaya: Number(jagaBiaya.replace(/\./g, '')) || 0,
        kendala: jagaKendala.trim(), items: itemsToSave
      }]);
      if (error) throw error;

      if (jagaKendala.trim() !== "") {
        const { data: eksisting } = await supabase.from('kendala_shift').select('kendala').eq('shift_id', shiftID).single();
        let newKendala = eksisting && eksisting.kendala ? eksisting.kendala + "\n- " + jagaKendala.trim() : "- " + jagaKendala.trim();
        await supabase.from('kendala_shift').upsert({ shift_id: shiftID, kendala: newKendala });
      }

      for (const item of itemsToSave) {
        if (item.obat !== "-" && item.status === "STOK") {
          const { data: obatDiLaci } = await supabase.from('stok_obat_jaga').select('jumlah').eq('nama', item.obat).single();
          if (obatDiLaci) {
            const sisaBaru = obatDiLaci.jumlah - item.jumlah;
            const { error: errUpdate } = await supabase.from('stok_obat_jaga').update({ jumlah: sisaBaru }).eq('nama', item.obat);
            
            if (!errUpdate) {
              await supabase.from('log_steling_obat').insert({
                nama_obat: item.obat, jenis_mutasi: 'KELUAR', jumlah: item.jumlah, sisa_stok: sisaBaru,
                keterangan: `Keluar UGD/KABER: ${jagaNama.toUpperCase()}`
              });
            }
          }
        }
      }

      alert("Data Tersimpan! Stok Berhasil Terpotong & Tercatat di Steling! 📦✂️");
      resetJaga();
    } catch (err) { alert("Gagal terhubung ke database: " + err.message); } finally { isSavingJaga = false; }
  }
  
  function resetJaga() {
    jagaNama = ""; jagaTglLahir = ""; jagaNorm = ""; jagaDiagnosa = ""; jagaTerapi = ""; jagaKendala = ""; jagaBiaya = "0"; listJaga = [];
  }

  // =====================================
  // FUNGSI BUKU STELING
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
      
      stelingItems = (data || []).map((item, i, arr) => {
        const dt = new Date(item.created_at);
        const currBulanTahun = `${dt.getMonth()}-${dt.getFullYear()}`;
        let isNewMonth = false;
        
        if (i > 0) {
           const prevDt = new Date(arr[i-1].created_at);
           const prevBulanTahun = `${prevDt.getMonth()}-${prevDt.getFullYear()}`;
           isNewMonth = currBulanTahun !== prevBulanTahun;
        }
        return { ...item, isNewMonth };
      });
      
    } catch (e) {
      console.error("Gagal muat steling:", e.message);
    } finally {
      isStelingLoading = false;
    }
  }

  async function jalankanPurgeSteling() {
    isPurgingSteling = true;
    try {
      const { error } = await supabase.from('log_steling_obat').delete().neq('id', 0);
      if (error) throw error;
      alert("🔥 EKSEKUSI BERHASIL!\nDatabase Buku Steling Obat telah dikosongkan.");
      stelingItems = [];
    } catch (err) {
      alert("Gagal menghapus database: " + err.message);
    } finally {
      isPurgingSteling = false;
    }
  }

  // =====================================
  // FUNGSI PDF FINAL (SALDO AWAL)
  // =====================================
  async function cetakStelingPDF(modeArsipLengkap = false) {
    try {
      if (!window.jspdf) return alert("🚨 GAGAL: Mesin PDF belum siap! Refresh (F5) halaman ini.");

      if (modeArsipLengkap) {
          isStelingLoading = true;
          const { data: semuaSteling, error: errSteling } = await supabase.from('log_steling_obat').select('*').order('created_at', { ascending: false });
          if (errSteling) throw errSteling;
          stelingItems = semuaSteling || [];
          isStelingLoading = false;
      } else {
          await tarikDataSteling(); 
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');

      const buatKopSurat = (namaItem) => {
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("PEMERINTAH KABUPATEN MALANG - DINAS KESEHATAN", 105, 15, { align: "center" });
        doc.setFontSize(16); doc.text("UPT PUSKESMAS PONCOKUSUMO", 105, 22, { align: "center" });
        doc.setFontSize(11); doc.setFont("helvetica", "normal");
        doc.text("Buku Catatan Mutasi Laci Jaga (Steling Obat)", 105, 28, { align: "center" });
        
        doc.setFont("helvetica", "italic");
        let teksPeriode = modeArsipLengkap ? "Periode: SELURUH RIWAYAT (ARSIP LENGKAP)" : `Periode: ${stelingStartDate} s/d ${stelingEndDate}`;
        doc.text(teksPeriode, 105, 34, { align: "center" });
        
        doc.setFont("helvetica", "bold");
        doc.text(`Item Obat/BMHP: ${namaItem}`, 105, 40, { align: "center" });
        doc.setLineWidth(0.5); doc.line(14, 43, 196, 43); 
      };

      const tableColumn = ["Waktu", "Mutasi", "Qty", "Sisa Stok", "Keterangan"];
      const autoTableConfig = {
        startY: 48, theme: 'grid',
        headStyles: { fillColor: [28, 29, 31], textColor: 255, halign: 'center' },
        bodyStyles: { textColor: 20 },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 'auto' }
        },
        styles: { fontSize: 9, cellPadding: 3 },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 1) {
            if (data.cell.raw === 'KELUAR') data.cell.styles.textColor = [220, 38, 38]; 
            if (data.cell.raw === 'MASUK') data.cell.styles.textColor = [22, 163, 74];  
            if (data.cell.raw === 'SALDO AWAL') data.cell.styles.textColor = [37, 99, 235]; 
          }
        }
      };

      let daftarObatCetak = [];
      const dataDikelompokkan = {};

      if (modeArsipLengkap || stelingFilterObat === "SEMUA") {
          daftarObatCetak = [...listObatDataAll].sort();
      } else {
          daftarObatCetak = [stelingFilterObat];
      }

      daftarObatCetak.forEach(obat => { dataDikelompokkan[obat] = []; });

      stelingItems.forEach(item => {
          if (item.nama_obat && dataDikelompokkan[item.nama_obat]) {
              dataDikelompokkan[item.nama_obat].push(item);
          }
      });

      daftarObatCetak.forEach((namaObat, index) => {
        if (index > 0) doc.addPage();
        buatKopSurat(namaObat);

        const riwayatAsc = [...dataDikelompokkan[namaObat]].reverse();

        let stokAwal = 0;
        if (riwayatAsc.length > 0) {
            const pertama = riwayatAsc[0];
            stokAwal = pertama.jenis_mutasi === 'KELUAR' 
                ? Number(pertama.sisa_stok) + Number(pertama.jumlah)
                : Number(pertama.sisa_stok) - Number(pertama.jumlah);
        } else {
            stokAwal = mapStokObat[namaObat] || 0;
        }

        const tableRows = [];
        
        tableRows.push([
            modeArsipLengkap ? "-" : stelingStartDate, 
            "SALDO AWAL", 
            "-", 
            stokAwal.toString(), 
            "Stok awal periode berjalan"
        ]);

        if (riwayatAsc.length > 0) {
            riwayatAsc.forEach(item => {
              const dt = new Date(item.created_at);
              const wkt = `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth()+1).toString().padStart(2, '0')}/${dt.getFullYear()}\n${dt.getHours().toString().padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
              tableRows.push([ wkt, item.jenis_mutasi, item.jumlah.toString(), item.sisa_stok.toString(), item.keterangan || "-" ]);
            });
        }

        doc.autoTable({ ...autoTableConfig, head: [tableColumn], body: tableRows });
      });

      let namaFile = modeArsipLengkap ? "Arsip_Tahunan_Semua_Obat" : `Steling_${stelingFilterObat.replace(/\s+/g, '_')}`;
      doc.save(`${namaFile}_${new Date().getTime()}.pdf`);
      
    } catch (error) {
      alert("⚠️ Terjadi kesalahan saat membuat PDF: " + error.message);
      console.error(error);
    }
  }

  // =====================================
  // FUNGSI REKAP & LAPORAN WA
  // =====================================
  async function muatDataDanLaporan() {
    if (!currentShiftJaga) return;
    isRekapLoading = true;
    const n = JSON.parse(localStorage.getItem('nakesPKM'));
    const shiftID = `${new Date().toISOString().split('T')[0]}_${n.s}`;
    
    try {
      const resKendala = await supabase.from('kendala_shift').select('kendala').eq('shift_id', shiftID).single();
      editKendalaShift = resKendala.data ? resKendala.data.kendala : "";
      const { data: pasienData, error } = await supabase.from('laporan_pasien').select('*').eq('shift_id', shiftID).order('created_at', { ascending: true });
      if (error) throw error;

      rekapItems = (pasienData || []).map(p => {
        let obatStr = (p.items || []).filter(i => i.obat !== "-").map(i => `${i.obat} (${i.jumlah})`).join(', ');
        let totalJumlah = (p.items || []).filter(i => i.obat !== "-").reduce((sum, i) => sum + Number(i.jumlah), 0);
        return { row: p.id, nama: p.nama, rm: p.rm, tgl_lahir: p.tgl_lahir, terapi: p.terapi, obat: obatStr || "-", jumlah: totalJumlah, rawItems: p.items };
      });
      rakitLaporanWA(pasienData, n);
    } catch (err) { alert("Terjadi kesalahan saat memuat data rekap."); } finally { isRekapLoading = false; }
  }

  function rakitLaporanWA(pasienList, tim) {
    const dateObj = new Date(); const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0'); const yyyy = dateObj.getFullYear();
    const tglStr = `${dd}/${mm}/${yyyy}`;
    let shiftIcon = "☀️"; if (tim.s.toUpperCase().includes("MALAM") || tim.s.toUpperCase().includes("SORE")) shiftIcon = "🌙";

    const listUGD = (pasienList || []).filter(p => p.ruangan === "UGD");
    const listKABER = (pasienList || []).filter(p => p.ruangan === "KABER");
    const totalUmum = (pasienList || []).filter(p => p.status_pasien === "UMUM").reduce((sum, p) => sum + Number(p.biaya || 0), 0);

    const rekapObatUGD = {};
    listUGD.forEach(p => { (p.items || []).forEach(it => { if (it.obat && it.obat !== "-") rekapObatUGD[it.obat] = (rekapObatUGD[it.obat] || 0) + Number(it.jumlah || 0); }); });
    const rekapObatKABER = {};
    listKABER.forEach(p => { (p.items || []).forEach(it => { if (it.obat && it.obat !== "-") rekapObatKABER[it.obat] = (rekapObatKABER[it.obat] || 0) + Number(it.jumlah || 0); }); });

    const formatTgl = (tgl) => { if (!tgl) return "-"; const parts = tgl.split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : tgl; }
    const renderPasienList = (list) => {
      if (!list || list.length === 0) return `_- Nihil -_\n\n`;
      let str = "";
      list.forEach(p => {
        let obatStr = (p.items || []).filter(it => it.obat && it.obat !== "-").map(it => `${it.obat} (${it.jumlah})`).join(', ');
        str += `👤 *${p.nama}* [💵 ${p.status_pasien}]\n ├ 📂 RM: ${p.rm || '-'} | 🎂 ${formatTgl(p.tgl_lahir)}\n ├ 🩺 Diag: ${p.diagnosa || '-'}\n ├ 💉 Terapi: ${p.terapi || '-'}\n └ 💊 Obat: ${obatStr || '-'}\n\n`;
      });
      return str;
    };
    const renderObatList = (obj) => { const keys = Object.keys(obj).sort(); return keys.length === 0 ? ` • -\n` : keys.map(k => ` • ${k}: ${obj[k]}`).join('\n') + '\n'; };
    let pasienKendalaArr = (pasienList || []).filter(p => p.kendala && p.kendala.trim() !== "").map(p => `• [${p.nama}]: ${p.kendala}`);
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
    isSavingKendala = true; const n = JSON.parse(localStorage.getItem('nakesPKM')); const shiftID = `${new Date().toISOString().split('T')[0]}_${n.s}`;
    try { await supabase.from('kendala_shift').upsert({ shift_id: shiftID, kendala: editKendalaShift }); muatDataDanLaporan(); } catch (e) { alert("Kesalahan Jaringan"); } finally { isSavingKendala = false; }
  }

  async function hapusBaris(row) {
    if (confirm("Hapus data ini secara permanen?")) { try { await supabase.from('laporan_pasien').delete().eq('id', row); muatDataDanLaporan(); } catch (e) { alert("Kesalahan server."); } }
  }

  function kirimWA() { window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(txtLaporan), "_blank"); }

  function bukaModalEdit(it) {
    editRow = it.row; editNama = (it.nama !== "-" ? it.nama : ""); editRM = (it.rm !== "-" ? it.rm : ""); editTerapi = (it.terapi !== "-" ? it.terapi : "");
    editObat = (it.rawItems && it.rawItems.length > 0 && it.rawItems[0].obat !== "-" ? it.rawItems[0].obat : ""); editJumlah = (it.rawItems && it.rawItems.length > 0 && it.rawItems[0].jumlah !== 0 ? it.rawItems[0].jumlah : ""); showModalEdit = true;
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
    addObatRow = row; addObatNama = (nama !== "-" ? nama : ""); addObatRM = (rm !== "-" ? rm : ""); addObatInput = ""; addObatJumlah = 1; showModalTambah = true; showDropdownTambah = false;
  }

  async function simpanTambahObatJaga() {
    if (!addObatInput) return alert("Nama obat kosong!");
    isSavingAdd = true;
    try {
      const exactObat = listObatDataAll.find(o => o.trim().toLowerCase() === addObatInput.trim().toLowerCase());
      const finalObatName = exactObat ? exactObat : addObatInput.trim().toUpperCase();
      const statusInput = exactObat ? "STOK" : "MANUAL";
      
      const { data: pasien } = await supabase.from('laporan_pasien').select('items').eq('id', addObatRow).single();
      let currentItems = pasien.items || [];
      currentItems.push({ obat: finalObatName, jumlah: addObatJumlah, sumber: "SUSULAN", status: statusInput });
      
      await supabase.from('laporan_pasien').update({ items: currentItems }).eq('id', addObatRow);

      if (statusInput === "STOK") {
        const { data: obatDiLaci } = await supabase.from('stok_obat_jaga').select('jumlah').eq('nama', finalObatName).single();
        if (obatDiLaci) {
          const sisaBaru = obatDiLaci.jumlah - addObatJumlah;
          const { error: errUpdate } = await supabase.from('stok_obat_jaga').update({ jumlah: sisaBaru }).eq('nama', finalObatName);
          
          if (!errUpdate) {
            await supabase.from('log_steling_obat').insert({
                nama_obat: finalObatName, jenis_mutasi: 'KELUAR', jumlah: addObatJumlah, sisa_stok: sisaBaru,
                keterangan: `Obat Susulan: Pasien ${addObatNama.toUpperCase()}`
            });
          }
        }
      }
      showModalTambah = false; muatDataDanLaporan();
    } catch(e) { alert("Error jaringan."); } finally { isSavingAdd = false; }
  }

  // =====================================
  // 🔥 FUNGSI TOTAL ITEM OBAT (REKAP TERPADU) 🔥
  // =====================================
  function setHariIniObat() { const d = new Date().toISOString().split('T')[0]; filterMulaiObat = d; filterSelesaiObat = d; tarikDataObatTerpadu(); }
  function setBulanIniObat() { const date = new Date(); const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(new Date(y, date.getMonth() + 1, 0).getDate()).padStart(2, '0'); filterMulaiObat = `${y}-${m}-01`; filterSelesaiObat = `${y}-${m}-${d}`; tarikDataObatTerpadu(); }

  async function tarikDataObatTerpadu() {
    isRekapItemLoading = true;
    try {
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
             rekap[namaObat] = { nama: namaObat, jaga_ugd: 0, jaga_kaber: 0, bon_ranap: 0, bon_kaber: 0, total: 0 };
          }
          
          let qty = Number(it.jumlah) || 0;
          
          if (p.shift_nama === 'BON_OBAT') {
              if (p.ruangan === 'RAWAT INAP') rekap[namaObat].bon_ranap += qty;
              if (p.ruangan === 'KABER') rekap[namaObat].bon_kaber += qty;
          } else {
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
</script>

<AuthAdmin 
  bind:showModal={showPurgeStelingModal} 
  onSuccess={jalankanPurgeSteling} 
  judulAksi="Otorisasi Kosongkan Steling"
  pesanPeringatan="Tindakan ini akan menghapus <b class='text-red-600'>SELURUH</b> riwayat Mutasi Obat secara permanen. Pastikan Anda telah mengunduh PDF untuk arsip."
  hanyaAdmin={true} 
/>

<div class="animate-fade-in bg-[#eef2f5] min-h-screen pb-20 relative">
  
  <div class="max-w-6xl mx-auto px-4 pt-6 pb-2 flex justify-between items-center no-print">
    <button on:click={() => switchView('dashboard')} class="text-[#a435f0] font-bold text-sm flex items-center hover:underline">
      <span class="material-icons text-sm mr-1">arrow_back</span> Kembali ke Dashboard
    </button>
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
    <div class="max-w-4xl mx-auto px-4 mt-2">
      <div class="w-full h-40 overflow-hidden relative border-b-4 border-[#1c1d1f] mb-6 rounded-t-lg">
        <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1200" class="w-full h-full object-cover filter brightness-75" alt="Banner">
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 text-white">
          <h1 class="text-3xl font-extrabold tracking-tight">🏥 PKM PONCOKUSUMO</h1>
          <p class="text-sm opacity-90 uppercase tracking-widest font-bold text-yellow-400 mt-1">Digital Healthcare & Patient Reports</p>
        </div>
      </div>

      {#if !currentShiftJaga}
        <div class="jaga-card animate-fade-in">
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

        <div class="jaga-card animate-fade-in">
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
              <div class="flex-1 relative">
                <input type="text" bind:value={obatInput} on:focus={() => showDropdown = true} on:click={() => showDropdown = true} on:input={() => showDropdown = true} on:blur={() => setTimeout(() => showDropdown = false, 300)} autocomplete="off" class="jaga-input uppercase" placeholder="Ketik atau klik untuk pilih obat...">
                {#if showDropdown}
                  {#if filteredObat.length > 0}
                    <ul class="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 shadow-2xl max-h-56 overflow-y-auto rounded-md custom-scroll">
                      {#each filteredObat as o}
                        <li on:mousedown|preventDefault={() => { obatInput = o; showDropdown = false; }} class="px-4 py-3 hover:bg-[#a435f0] hover:text-white cursor-pointer text-sm font-bold border-b border-gray-100 transition-colors">{o}</li>
                      {/each}
                    </ul>
                  {:else}
                    <ul class="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 shadow-2xl rounded-md p-3"><li class="text-xs text-gray-500 italic text-center">Data obat tidak ditemukan...</li></ul>
                  {/if}
                {/if}
              </div>
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
      {/if}
    </div>

  {:else if activeTab === 'steling'}
    <div class="max-w-6xl mx-auto px-4 mt-2 animate-fade-in">
      <div class="jaga-card p-6">
        <h2 class="font-black text-2xl text-[#1c1d1f] mb-2 flex items-center no-print"><span class="material-icons mr-2 text-emerald-600 text-3xl">receipt_long</span> Buku Catatan Steling Obat</h2>
        <p class="text-sm text-gray-500 mb-6 no-print">Merekam riwayat mutasi Laci Jaga. Fitur ini dirancang khusus untuk kemudahan pelacakan dan audit.</p>
        
        <div class="bg-[#f7f9fa] p-5 rounded-lg border border-[#d1d7dc] mb-6 flex flex-col lg:flex-row gap-4 items-end justify-between no-print">
          <div class="flex flex-col md:flex-row gap-4 w-full">
            <div class="flex-1">
              <span class="jaga-label mt-0 mb-1 text-xs">Tanggal Mulai</span>
              <input type="date" bind:value={stelingStartDate} class="jaga-input py-2 w-full">
            </div>
            <div class="flex-1">
              <span class="jaga-label mt-0 mb-1 text-xs">Tanggal Selesai</span>
              <input type="date" bind:value={stelingEndDate} class="jaga-input py-2 w-full">
            </div>
            <div class="flex-1">
              <span class="jaga-label mt-0 mb-1 text-xs">Filter Spesifik Obat</span>
              <select bind:value={stelingFilterObat} class="jaga-input py-2 font-bold w-full">
                <option value="SEMUA">-- SEMUA OBAT --</option>
                {#each listObatDataAll as obat}
                   <option value={obat}>{obat}</option>
                {/each}
              </select>
            </div>
            <button on:click={tarikDataSteling} class="bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-5 rounded text-sm flex items-center justify-center transition-colors shadow-md mt-auto mb-[1px] h-[42px] flex-none md:w-auto w-full">
              <span class="material-icons text-sm mr-2 {isStelingLoading ? 'animate-spin' : ''}">search</span> Terapkan Filter
            </button>
          </div>
          <button on:click={() => cetakStelingPDF(false)} class="bg-[#1c1d1f] text-white hover:bg-black font-bold px-6 rounded text-sm flex items-center justify-center transition-colors shadow-md flex-none w-full lg:w-auto h-[42px] mb-[1px]">
            <span class="material-icons text-sm mr-2">print</span> Cetak PDF
          </button>
        </div>

        <div class="overflow-x-auto border border-[#d1d7dc] rounded-lg">
          <table class="w-full text-left text-sm border-collapse">
            <thead class="bg-[#1c1d1f] text-white">
              <tr><th class="p-3 font-bold text-center">Waktu</th><th class="p-3 font-bold">Nama Obat</th><th class="p-3 font-bold text-center">Mutasi</th><th class="p-3 font-bold text-center">Qty</th><th class="p-3 font-bold text-center">Sisa Stok</th><th class="p-3 font-bold">Keterangan</th></tr>
            </thead>
            <tbody>
              {#if isStelingLoading}<tr><td colspan="6" class="p-10 text-center text-slate-500 font-bold"><span class="material-icons animate-spin align-middle mr-2">sync</span> Mengambil data buku steling...</td></tr>
              {:else if stelingItems.length === 0}<tr><td colspan="6" class="p-10 text-center text-slate-400 font-bold italic">Belum ada mutasi obat pada rentang/filter ini.</td></tr>
              {:else}
                {#each stelingItems as item}
                  <tr class="border-b border-[#d1d7dc] hover:bg-emerald-50 transition-colors">
                    <td class="p-3 text-xs text-center {item.isNewMonth ? 'bg-blue-100/60 font-black border-l-4 border-blue-500 text-blue-900' : 'text-gray-500'}">
                       {new Date(item.created_at).toLocaleString('id-ID')}
                    </td>
                    <td class="p-3 font-bold text-[#1c1d1f]">{item.nama_obat}</td>
                    <td class="p-3 text-center font-bold {item.jenis_mutasi === 'KELUAR' ? 'text-red-600' : 'text-green-600'}">{item.jenis_mutasi}</td>
                    <td class="p-3 text-center font-black text-lg">{item.jumlah}</td>
                    <td class="p-3 text-center font-bold text-blue-700 bg-blue-50/50">{item.sisa_stok}</td>
                    <td class="p-3 text-xs text-gray-600 max-w-xs">{item.keterangan || '-'}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>

        <div class="max-w-3xl mx-auto mt-12 bg-white border-2 border-red-100 border-dashed rounded-xl p-6 text-center shadow-sm no-print">
           <h3 class="font-bold text-slate-800 mb-2 flex items-center justify-center"><span class="material-icons text-red-500 mr-2">inventory_2</span> Manajemen Arsip Tahunan</h3>
           <p class="text-xs text-slate-500 mb-6">Unduh arsip lengkap untuk audit sebelum melakukan pembersihan/pengosongan database agar server tetap cepat.</p>
           <div class="flex flex-col sm:flex-row justify-center gap-4">
             <button on:click={() => { isStelingLoading = true; cetakStelingPDF(true); }} class="bg-slate-800 hover:bg-black text-white px-6 py-3 rounded-lg font-bold text-sm shadow flex items-center justify-center transition-colors">
               <span class="material-icons text-sm mr-2">picture_as_pdf</span> 1. Unduh Semua Arsip PDF
             </button>
             <button on:click={() => showPurgeStelingModal = true} class="bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 px-6 py-3 rounded-lg font-bold text-sm shadow-sm flex items-center justify-center transition-colors">
               <span class="material-icons text-sm mr-2">delete_sweep</span> 2. Kosongkan Database
             </button>
           </div>
        </div>

      </div>
    </div>

  {:else if activeTab === 'rekap'}
    <div class="max-w-6xl mx-auto px-4 mt-2 animate-fade-in">
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
                        <td class="p-4 align-top"><div class="font-bold text-[#1c1d1f] uppercase">{it.nama}</div><div class="text-xs text-[#6a6f73] mt-1">RM: {it.rm} | Tgl Lahir: {it.tgl_lahir ? it.tgl_lahir.split('-').reverse().join('/') : '-'}</div></td>
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
          <div class="jaga-card p-0 sticky top-20 z-10">
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
    <div class="max-w-6xl mx-auto px-4 mt-2 animate-fade-in">
      <div class="jaga-card p-6 md:p-8 rounded-lg shadow-sm border border-gray-200">
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b pb-4 no-print">
           <h2 class="font-black text-xl text-slate-800 flex items-center"><span class="material-icons mr-2 text-purple-600">inventory_2</span> Total Rekap Obat Terpadu</h2>
           <div class="flex gap-2 w-full md:w-auto">
              <input type="date" bind:value={filterMulaiObat} class="jaga-input py-2 text-sm font-bold w-full md:w-auto">
              <span class="py-2 text-gray-400 font-bold">-</span>
              <input type="date" bind:value={filterSelesaiObat} class="jaga-input py-2 text-sm font-bold w-full md:w-auto">
              <button on:click={tarikDataObatTerpadu} class="bg-[#1c1d1f] text-white px-5 py-2 rounded font-bold text-sm hover:bg-black whitespace-nowrap flex items-center">
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
    </div>
  {/if}

</div>

{#if showModalEdit}
  <div class="fixed inset-0 modal-overlay flex justify-center items-center z-50 p-4 animate-fade-in no-print">
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
      <div class="flex justify-end gap-3 mt-8"><button on:click={() => showModalEdit = false} class="jaga-btn-secondary w-auto px-6 py-2.5">Batal</button><button on:click={simpanEditJaga} disabled={isSavingEdit} class="jaga-btn-primary w-auto px-6 py-2.5 bg-[#a435f0] border-[#a435f0] flex items-center">{#if isSavingEdit}<span class="material-icons animate-spin mr-2 text-sm">sync</span>{/if} Simpan</button></div>
    </div>
  </div>
{/if}

{#if showModalTambah}
  <div class="fixed inset-0 modal-overlay flex justify-center items-center z-50 p-4 animate-fade-in no-print">
    <div class="bg-white jaga-card p-6 w-full max-w-md relative mb-0">
      <button on:click={() => showModalTambah = false} class="absolute top-4 right-4 text-gray-400 hover:text-black"><span class="material-icons">close</span></button>
      <h3 class="font-bold text-xl mb-2 text-[#1c1d1f]">Tambah Obat Susulan</h3>
      <div class="mb-5 text-sm text-[#6a6f73]">Pasien: <span class="font-bold text-black">{addObatNama}</span> (RM: {addObatRM})</div>
      <div class="space-y-4 text-sm">
        <div class="relative">
          <label class="font-bold block mb-1">Ketik Nama Obat</label>
          <input type="text" bind:value={addObatInput} on:focus={() => showDropdownTambah = true} on:click={() => showDropdownTambah = true} on:input={() => showDropdownTambah = true} on:blur={() => setTimeout(() => showDropdownTambah = false, 300)} autocomplete="off" class="jaga-input uppercase" placeholder="Ketik...">
          {#if showDropdownTambah}
            {#if filteredObatTambah.length > 0}
              <ul class="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 shadow-xl max-h-40 overflow-y-auto rounded-md custom-scroll">
                {#each filteredObatTambah as o}
                  <li on:mousedown|preventDefault={() => { addObatInput = o; showDropdownTambah = false; }} class="px-4 py-2 hover:bg-[#a435f0] hover:text-white cursor-pointer text-sm font-bold border-b border-gray-100 transition-colors">{o}</li>
                {/each}
              </ul>
            {:else}
              <ul class="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 shadow-xl rounded-md p-3"><li class="text-xs text-gray-500 italic text-center">Data obat tidak ditemukan...</li></ul>
            {/if}
          {/if}
        </div>
        <div><label class="font-bold block mb-1">Jumlah</label><input type="number" bind:value={addObatJumlah} min="1" class="jaga-input"></div>
      </div>
      <div class="flex justify-end gap-3 mt-8"><button on:click={() => showModalTambah = false} class="jaga-btn-secondary w-auto px-6 py-2.5">Batal</button><button on:click={simpanTambahObatJaga} disabled={isSavingAdd} class="jaga-btn-primary w-auto bg-[#a435f0] border-[#a435f0] px-6 py-2.5 flex items-center">{#if isSavingAdd}<span class="material-icons animate-spin mr-2 text-sm">sync</span>{/if} Tambahkan</button></div>
    </div>
  </div>
{/if}

<style>
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
  .animate-fade-in { animation: fadeIn 0.4s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>