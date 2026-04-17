<script>
  import { supabase } from './supabase.js';
  export let switchView;

  // State Form SBAR
  let editRow = ""; 
  let isSaving = false;
  let showRiwayat = false;
  let riwayatData = [];
  let isRiwayatLoading = false;

  let form = {
    tanggal: "", jam: "", pelapor: "", penerima: "",
    namaPasien: "", rm: "", tgllahir: "", ruang: "", nik: "", alamat: "",
    problem: "", diagnosa: "", riwayat: "", klinis: "", lab: "", alergi: "",
    ku: "", kes: "", gcs: "", tdSistol: "", tdDiastol: "", nadi: "", rr: "", suhu: "", spo2: "",
    terapi: "", assesment: "", usulan: "", instruksi: "",
    ttdPelapor: "", ttdPenerima: "", 
    tbakTgl: "", tbakJam: "", tbakPenerima: "" 
  };

  // ==========================================
  // METODE CETAK: NATIVE PRINT PREVIEW + IFRAME (ANTI-EKSTENSI MAGICAL)
  // ==========================================
  function cetakSBAR() {
    const btn = document.getElementById('btnCetakSbar');
    if (btn) btn.innerHTML = '<span class="material-icons animate-spin mr-2">sync</span> Menyiapkan Kertas...';

    // 1. Ambil HTML Kertas Suci (Layer 2) yang isinya HANYA TEKS, BUKAN INPUT
    const printContent = document.getElementById('print-layer').innerHTML;

    // 2. Buat iFrame (Jendela Isolasi)
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    // 3. Masukkan Kertas Suci ke iFrame beserta CSS Cetak F4
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SBAR_${form.namaPasien || 'Pasien'}</title>
        <script src="https://cdn.tailwindcss.com"><\/script>
        <style>
          /* Kertas F4 Presisi & Margin Standar */
          @page { size: 215.9mm 330.2mm; margin: 10mm 15mm; }
          body { font-family: 'Times New Roman', Times, serif; background: white; color: black; margin: 0; padding: 0; }
          
          /* Blokir Paksa Ekstensi Browser jika nekat masuk */
          magical-app, grammarly-extension, div[id^="magical"] { display: none !important; }

          /* Styling Tabel SBAR */
          .sbar-tabel-utama { border-collapse: collapse; font-size: 10pt; border: 2px solid #000; margin-bottom: 5px; width: 100%; color: black;}
          .sbar-tabel-utama th, .sbar-tabel-utama td { border: 1px solid #000; }
          .sbar-tabel-tanpa-garis { border-collapse: collapse; font-size: 10pt; width: 100%; color: black;}
          .sbar-tabel-tanpa-garis td { border: none; padding: 3px; }
          .sbar-huruf-besar { font-size: 24pt; font-weight: bold; margin-bottom: 3px; color: black;}
          
          /* Gaya Teks Pengganti Input (Garis Bawah Titik-titik) */
          .teks-cetak { display: inline-block; min-height: 1.2em; border-bottom: 1px dotted #000; }
          .teks-cetak-area { display: block; min-height: 1.2em; white-space: pre-wrap; font-family: inherit; }
          .sbar-inline-input { width: auto !important; min-width: 30px; display: inline-block; text-align: center; }
          
          /* Anti-Tabel Terpotong Hancur */
          table { page-break-inside: auto; border-collapse: collapse !important; width: 100% !important; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          td, th { page-break-inside: avoid; color: black !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style>
      </head>
      <body onload="setTimeout(function(){ window.print(); window.parent.postMessage('printSelesai', '*'); }, 1200)">
        ${printContent}
      </body>
      </html>
    `);
    doc.close();

    // 4. Dengarkan sinyal dari iFrame jika Print Preview sudah tertutup
    window.addEventListener('message', function cleanup(e) {
      if (e.data === 'printSelesai') {
        if (btn) btn.innerHTML = '<span class="material-icons mr-2">print</span> Cetak Form / PDF';
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 500);
        window.removeEventListener('message', cleanup);
      }
    });

    // Fallback Darurat (Jika onafterprint browser tidak jalan)
    setTimeout(() => {
      if (btn && btn.innerHTML.includes('Memproses')) btn.innerHTML = '<span class="material-icons mr-2">print</span> Cetak Form / PDF';
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 8000);
  }

  // ==========================================
  // FUNGSI DATABASE SBAR KE SUPABASE
  // ==========================================
  async function kirimDataSBAR() {
    if (!form.namaPasien) return alert("Mohon isi Nama Pasien terlebih dahulu!");
    isSaving = true;

    const tandaVitalTxt = `KU: ${form.ku || '-'}, Kes: ${form.kes || '-'}, GCS: ${form.gcs || '-'} | TD: ${form.tdSistol || '-'}/${form.tdDiastol || '-'} mmHg | Nadi: ${form.nadi || '-'} x/mnt | RR: ${form.rr || '-'} x/mnt | S: ${form.suhu || '-'} °C | SpO2: ${form.spo2 || '-'} %`;
    const ttdPenerimaGabungan = `${form.ttdPenerima || ''}||${form.tbakTgl || ''}||${form.tbakJam || ''}||${form.tbakPenerima || ''}`;

    const payload = {
      tanggal: form.tanggal, jam: form.jam, pelapor: form.pelapor, penerima: form.penerima,
      nama_pasien: form.namaPasien, rm: form.rm, tgl_lahir: form.tgllahir, ruang: form.ruang, 
      nik: form.nik, alamat: form.alamat, problem: form.problem, diagnosa: form.diagnosa, 
      riwayat: form.riwayat, klinis: form.klinis, lab: form.lab, alergi: form.alergi,
      tanda_vital: tandaVitalTxt, terapi: form.terapi, assesment: form.assesment, 
      usulan: form.usulan, instruksi: form.instruksi, ttd_pelapor: form.ttdPelapor, 
      ttd_penerima: ttdPenerimaGabungan
    };

    try {
      if (editRow) {
        const { error } = await supabase.from('riwayat_sbar').update(payload).eq('id', editRow);
        if (error) throw error;
        alert("Sukses! Data SBAR berhasil diupdate.");
        batalEditSBAR();
      } else {
        const { error } = await supabase.from('riwayat_sbar').insert([payload]);
        if (error) throw error;
        alert("Sukses! Data SBAR berhasil disimpan ke Supabase.");
        Object.keys(form).forEach(key => form[key] = "");
      }
      if (showRiwayat) muatRiwayatSBAR();
    } catch (error) {
      alert("Terjadi kesalahan sistem saat mengirim SBAR: " + error.message);
    } finally {
      isSaving = false;
    }
  }

  function toggleRiwayatSBAR() {
    showRiwayat = !showRiwayat;
    if (showRiwayat) {
      muatRiwayatSBAR();
      setTimeout(() => { document.getElementById('sbar-riwayat-section')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
  }

  async function muatRiwayatSBAR() {
    isRiwayatLoading = true;
    try {
      const { data, error } = await supabase.from('riwayat_sbar').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      
      riwayatData = (data || []).map(row => ({
        row: row.id,
        timestamp: new Date(row.created_at).toLocaleString('id-ID'),
        tanggal: row.tanggal, jam: row.jam, pelapor: row.pelapor, penerima: row.penerima,
        namaPasien: row.nama_pasien, rm: row.rm, tgllahir: row.tgl_lahir, ruang: row.ruang,
        nik: row.nik, alamat: row.alamat, problem: row.problem, diagnosa: row.diagnosa,
        riwayat: row.riwayat, klinis: row.klinis, lab: row.lab, alergi: row.alergi,
        tandaVital: row.tanda_vital, terapi: row.terapi, assesment: row.assesment,
        usulan: row.usulan, instruksi: row.instruksi, ttdPelapor: row.ttd_pelapor, ttdPenerima: row.ttd_penerima
      }));
    } catch (err) { alert("Terjadi kesalahan saat memuat riwayat SBAR."); } finally { isRiwayatLoading = false; }
  }

  function editDataSBAR(data) {
    editRow = data.row;
    form.tanggal = data.tanggal || ""; form.jam = data.jam || "";
    form.pelapor = data.pelapor || ""; form.penerima = data.penerima || "";
    form.namaPasien = data.namaPasien || ""; form.rm = data.rm || "";
    form.ruang = data.ruang || ""; form.problem = data.problem || "";
    form.diagnosa = data.diagnosa || ""; form.terapi = data.terapi || "";
    form.assesment = data.assesment || ""; form.usulan = data.usulan || "";
    form.tgllahir = data.tgllahir || ""; form.nik = data.nik || ""; form.alamat = data.alamat || "";
    form.riwayat = data.riwayat || ""; form.klinis = data.klinis || ""; form.lab = data.lab || ""; 
    form.alergi = data.alergi || ""; form.instruksi = data.instruksi || "";
    form.ttdPelapor = data.ttdPelapor || ""; 

    const ttdP = data.ttdPenerima || "";
    const parts = ttdP.split('||');
    form.ttdPenerima = parts[0] || "";
    form.tbakTgl = parts[1] || "";
    form.tbakJam = parts[2] || "";
    form.tbakPenerima = parts[3] || "";

    try {
      const tv = data.tandaVital || "";
      form.ku = tv.match(/KU:\s*([^,]+)/)?.[1] || "";
      form.kes = tv.match(/Kes:\s*([^,]+)/)?.[1] || "";
      form.gcs = tv.match(/GCS:\s*([^ |]+)/)?.[1] || "";
      form.tdSistol = tv.match(/TD:\s*([^/]+)/)?.[1] || "";
      form.tdDiastol = tv.match(/\/([^ |]+)/)?.[1] || "";
      form.nadi = tv.match(/Nadi:\s*([^ |]+)/)?.[1] || "";
      form.rr = tv.match(/RR:\s*([^ |]+)/)?.[1] || "";
      form.suhu = tv.match(/S:\s*([^ |]+)/)?.[1] || "";
      form.spo2 = tv.match(/SpO2:\s*([^ |]+)/)?.[1] || "";
    } catch(e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function batalEditSBAR() {
    editRow = "";
    Object.keys(form).forEach(key => form[key] = "");
  }

  async function hapusSBAR(row_id) {
    if (confirm("Yakin ingin menghapus riwayat form SBAR ini?")) {
      try {
        const { error } = await supabase.from('riwayat_sbar').delete().eq('id', row_id);
        if (error) throw error;
        muatRiwayatSBAR();
      } catch (err) { alert("Gagal menghapus data dari Supabase."); }
    }
  }
</script>

<div class="animate-fade-in bg-slate-50 min-h-screen pt-4 md:pt-8 pb-20">
  
  <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-between items-center">
    <button on:click={() => switchView('dashboard')} class="text-[#a435f0] font-bold text-sm flex items-center hover:underline bg-white px-3 py-2 rounded shadow-sm">
      <span class="material-icons text-sm mr-1">arrow_back</span> Kembali
    </button>
  </div>
  
  <div class="kertas-ui relative bg-white p-6 md:p-10 shadow-md rounded-md max-w-4xl mx-auto">
    {#if isSaving}
      <div class="absolute inset-0 bg-white/80 z-50 flex flex-col justify-center items-center rounded-md">
        <span class="material-icons animate-spin text-4xl text-blue-500">sync</span>
        <h3 class="text-blue-600 font-bold mt-4">Menyimpan ke SATSET...</h3>
      </div>
    {/if}

    <div class="text-right text-[8pt] mb-1 font-bold text-gray-500">Form/087/UKP/II/2022/rev 1</div>

    <table class="sbar-tabel-utama w-full border-black border-2 border-collapse text-[10pt]">
      <tbody>
        <tr>
          <td width="25%" rowspan="2" class="text-center align-middle p-2.5 border border-black">
            <img src="/logo-kab.png" alt="Logo Kab Malang" class="w-[55px] mx-auto mb-1 object-contain">
            <b class="text-[9pt]">UPT PUSKESMAS<br>PONCOKUSUMO</b>
          </td>
          <td width="75%" class="text-center font-bold text-[13pt] align-middle p-2.5 border border-black">
            LEMBAR KOMUNIKASI SBAR
          </td>
        </tr>
        <tr>
          <td class="p-0 border border-black">
            <table class="sbar-tabel-tanpa-garis w-full p-1.5 h-full">
              <tbody>
                <tr>
                  <td width="15%" class="pl-2.5">Tanggal</td><td width="35%">: <input type="date" bind:value={form.tanggal} class="sbar-input w-[80%]"></td>
                  <td width="15%">Jam</td><td width="35%">: <input type="time" bind:value={form.jam} class="sbar-input w-[80%]"></td>
                </tr>
                <tr>
                  <td class="pl-2.5 align-top">Pelapor<br><span class="text-[8pt]">(nama & jabatan)</span></td>
                  <td class="align-top">: <input type="text" bind:value={form.pelapor} class="sbar-input w-[80%]" placeholder="..."></td>
                  <td class="align-top">Penerima<br>Laporan</td>
                  <td class="align-top">: <input type="text" bind:value={form.penerima} class="sbar-input w-[80%]" placeholder="..."></td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>

        <tr>
          <td class="text-center align-middle p-2.5 border border-black">
            <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">S</div><i class="text-[11pt] font-bold">SITUATION</i><br><br>
            <span class="text-[8.5pt] leading-[1.4]">Apa yang terjadi saat ini ?<br>Apa problemnya ?<br>Kapan terjadinya ?<br>Dan bagaimana parahnya ?</span>
          </td>
          <td class="p-0 border border-black">
            <table class="w-full border-collapse h-full">
              <tbody>
                <tr>
                  <td class="border-b border-black p-1.5 px-2.5">
                    <table class="sbar-tabel-tanpa-garis w-full">
                      <tbody>
                        <tr><td width="20%">Nama Pasien</td><td width="40%">: <input type="text" bind:value={form.namaPasien} class="sbar-input w-[80%]" placeholder="..."></td><td width="15%">No. RM</td><td width="25%">: <input type="text" bind:value={form.rm} class="sbar-input w-[80%]" placeholder="..."></td></tr>
                        <tr><td>Tgl. Lahir</td><td>: <input type="date" bind:value={form.tgllahir} class="sbar-input w-[80%]"></td><td>Ruang</td><td>: <input type="text" bind:value={form.ruang} class="sbar-input w-[80%]" placeholder="..."></td></tr>
                        <tr><td>NIK</td><td>: <input type="number" bind:value={form.nik} class="sbar-input w-[80%]" placeholder="..."></td><td>Alamat</td><td>: <input type="text" bind:value={form.alamat} class="sbar-input w-[80%]" placeholder="..."></td></tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr><td class="p-2 h-full align-top">Problem :<br><textarea bind:value={form.problem} class="sbar-textarea min-h-[50px] w-full" placeholder="Tuliskan problem di sini..."></textarea></td></tr>
              </tbody>
            </table>
          </td>
        </tr>

        <tr>
          <td class="text-center align-middle p-2.5 border border-black">
            <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">B</div><i class="text-[11pt] font-bold">BACKGROUND</i><br><br>
            <span class="text-[8.5pt] leading-[1.4]">Informasi yang berkaitan /<br>mungkin berkaitan dengan<br>problemnya</span>
          </td>
          <td class="p-0 border border-black">
            <table class="w-full border-collapse">
              <tbody>
                <tr><td class="border-b border-black py-1 px-2.5">Dirawat dengan diagnosa : <input type="text" bind:value={form.diagnosa} class="sbar-input w-[70%]"></td></tr>
                <tr><td class="border-b border-black py-1 px-2.5">Riwayat penyakit : <input type="text" bind:value={form.riwayat} class="sbar-input w-[80%]"></td></tr>
                <tr><td class="border-b border-black py-1 px-2.5">Informasi klinis : <input type="text" bind:value={form.klinis} class="sbar-input w-[80%]"></td></tr>
                <tr><td class="border-b border-black py-1 px-2.5">Lab. / pemeriksaan penunjang lain : <input type="text" bind:value={form.lab} class="sbar-input w-[60%]"></td></tr>
                <tr><td class="border-b border-black py-1 px-2.5">Riwayat alergi : <input type="text" bind:value={form.alergi} class="sbar-input w-[80%]"></td></tr>
                <tr>
                  <td class="border-b border-black py-1 px-2.5">Tanda vital saat ini :
                    <table class="sbar-tabel-tanpa-garis w-full my-1">
                      <tbody>
                        <tr>
                          <td width="33%">KU: <input type="text" bind:value={form.ku} class="sbar-input sbar-inline-input w-[60%]"></td>
                          <td width="33%">Kes: <input type="text" bind:value={form.kes} class="sbar-input sbar-inline-input w-[60%]"></td>
                          <td width="34%">GCS: <input type="text" bind:value={form.gcs} class="sbar-input sbar-inline-input w-[60%]"></td>
                        </tr>
                        <tr>
                          <td>TD: <input type="text" bind:value={form.tdSistol} class="sbar-input sbar-inline-input w-[35px] text-center"> / <input type="text" bind:value={form.tdDiastol} class="sbar-input sbar-inline-input w-[35px] text-center"> mmHg</td>
                          <td>Nadi: <input type="text" bind:value={form.nadi} class="sbar-input sbar-inline-input w-[40px] text-center"> x/mnt</td>
                          <td>RR: <input type="text" bind:value={form.rr} class="sbar-input sbar-inline-input w-[40px] text-center"> x/mnt</td>
                        </tr>
                        <tr>
                          <td>S: <input type="text" bind:value={form.suhu} class="sbar-input sbar-inline-input w-[40px] text-center"> °C</td>
                          <td colspan="2">SpO2: <input type="text" bind:value={form.spo2} class="sbar-input sbar-inline-input w-[40px] text-center"> %</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr><td class="py-1 px-2.5 align-top">Terapi saat ini : <br><textarea bind:value={form.terapi} class="sbar-textarea min-h-[30px]" placeholder="Tuliskan terapi..."></textarea></td></tr>
              </tbody>
            </table>
          </td>
        </tr>

        <tr>
          <td class="text-center align-middle p-2.5 border border-black">
            <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">A</div><i class="text-[11pt] font-bold">ASSESMENT</i>
          </td>
          <td class="p-1.5 px-2.5 align-top border border-black">
            Problem ini menurut anda disebabkan :<br><textarea bind:value={form.assesment} class="sbar-textarea min-h-[40px] w-full" placeholder="Ketik asesmen di sini..."></textarea>
          </td>
        </tr>

        <tr>
          <td class="text-center align-middle p-2.5 border border-black">
            <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">R</div><i class="text-[11pt] font-bold">RECOMMENDATION</i><br><br>
            <span class="text-[8.5pt] leading-[1.4]">Apa yang dapat dilakukan<br>untuk mengatasi problem ?</span>
          </td>
          <td class="p-1.5 px-2.5 align-top border border-black">
            Usulan dan mohon petunjuk (pemeriksaan / tindakan lebih lanjut) :<br><textarea bind:value={form.usulan} class="sbar-textarea min-h-[50px] w-full" placeholder="Ketik usulan/rekomendasi..."></textarea>
          </td>
        </tr>

        <tr>
          <td colspan="2" class="p-0 border border-black">
            <table class="w-full border-collapse h-full">
              <tbody>
                <tr>
                  <td width="55%" class="border-r border-black py-2 px-2.5 align-top">
                    Instruksi / anjuran dari yang menerima laporan :<br><textarea bind:value={form.instruksi} class="sbar-textarea min-h-[220px]"></textarea>
                  </td>
                  <td width="45%" class="p-2.5 align-top">
                    <table class="w-full border-collapse border border-black mb-3">
                      <tbody>
                        <tr>
                          <td width="50%" class="text-center border-r border-black p-1.5 align-top">
                            <span class="text-[9pt]">Paraf pelapor,</span><br><br><br><br><input type="text" bind:value={form.ttdPelapor} class="sbar-input sbar-inline-input text-center w-[80%] border-b border-dotted border-black text-[9pt]" placeholder="Nama">
                          </td>
                          <td width="50%" class="text-center p-1.5 align-top">
                            <span class="text-[9pt]">Paraf penerima<br>laporan,</span><br><br><br><input type="text" bind:value={form.ttdPenerima} class="sbar-input sbar-inline-input text-center w-[80%] border-b border-dotted border-black text-[9pt]" placeholder="Nama">
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <table class="w-full border-collapse border border-black">
                      <tbody>
                        <tr><td colspan="2" class="text-center border-b border-black font-bold p-1 text-[9.5pt]">Tulis Baca Konfirmasi (TBaK)</td></tr>
                        <tr>
                          <td width="50%" class="border-r border-black p-1.5 align-top">
                            <table class="w-full text-[8.5pt] mb-2 sbar-tabel-tanpa-garis">
                              <tbody>
                                <tr><td width="35%" class="align-middle">Tanggal</td><td class="align-middle">: <input type="date" bind:value={form.tbakTgl} class="sbar-input w-[65%] py-0" style="font-size:8pt;"></td></tr>
                                <tr><td class="align-middle">Jam</td><td class="align-middle">: <input type="time" bind:value={form.tbakJam} class="sbar-input w-[65%] py-0" style="font-size:8pt;"></td></tr>
                              </tbody>
                            </table>
                            <div class="text-center text-[8pt] mt-2">Penerima Instruksi,</div><br><br>
                            <div class="text-center"><input type="text" bind:value={form.tbakPenerima} class="sbar-input sbar-inline-input text-center w-[80%] border-b border-dotted border-black"></div>
                          </td>
                          <td width="50%" class="p-1.5 align-top">
                            <table class="w-full text-[8.5pt] mb-2 sbar-tabel-tanpa-garis">
                              <tbody><tr><td width="35%">Tanggal</td><td class="text-gray-400">: ......................</td></tr><tr><td>Jam</td><td class="text-gray-400">: ......................</td></tr></tbody>
                            </table>
                            <div class="text-center text-[8pt] mt-2">Pemberi Instruksi,</div><br><br>
                            <div class="text-center"><input type="text" class="sbar-input sbar-inline-input text-center w-[80%] border-b border-dotted border-black" placeholder="................................"></div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="text-center text-[9pt] mt-2 italic text-gray-800 font-semibold">
      Terima kasih atas kerjasamanya telah mengisi formulir ini dengan lengkap dan benar
    </div>

    <div class="action-buttons mt-8 pb-8 flex flex-wrap justify-center gap-3">
      <button id="btnCetakSbar" on:click={cetakSBAR} class="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-colors flex items-center justify-center min-w-[200px]">
        <span class="material-icons mr-2">print</span> Cetak Form / PDF
      </button>
      <button on:click={kirimDataSBAR} disabled={isSaving} class="bg-green-600 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-green-700 transition-colors flex items-center justify-center">
        <span class="material-icons mr-2">save</span> {editRow ? 'Update Database' : 'Simpan Database'}
      </button>
      {#if editRow}
        <button on:click={batalEditSBAR} class="bg-red-600 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-red-700 transition-colors flex items-center justify-center">
          <span class="material-icons mr-2">close</span> Batal Edit
        </button>
      {/if}
      <button on:click={toggleRiwayatSBAR} class="bg-[#D4AF37] text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-yellow-600 transition-colors flex items-center justify-center">
        <span class="material-icons mr-2">history</span> Riwayat SBAR
      </button>
    </div>
  </div>

  {#if showRiwayat}
    <div id="sbar-riwayat-section" class="mt-8 mb-20 bg-white border border-gray-200 rounded-xl p-6 shadow-sm max-w-4xl mx-4 md:mx-auto animate-fade-in">
      <div class="flex justify-between items-center mb-4 border-b pb-4">
        <h3 class="font-bold text-xl text-[#0F172A]">Riwayat Form SBAR Terakhir</h3>
        <button on:click={muatRiwayatSBAR} class="text-sm bg-blue-50 text-blue-600 font-bold px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center transition-colors">
          <span class="material-icons text-sm mr-2 {isRiwayatLoading ? 'animate-spin' : ''}">sync</span> Muat Ulang
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left border">
          <thead class="bg-slate-100 border-b text-slate-700">
            <tr>
              <th class="p-3 font-semibold w-1/5">Tgl Lapor</th>
              <th class="p-3 font-semibold w-1/4">Pasien & RM</th>
              <th class="p-3 font-semibold w-1/3">Problem</th>
              <th class="p-3 font-semibold text-center w-1/6">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#if isRiwayatLoading}
              <tr><td colspan="4" class="text-center p-8 text-gray-500"><span class="material-icons animate-spin mr-2 align-middle">sync</span> Memuat data SBAR...</td></tr>
            {:else if riwayatData.length === 0}
              <tr><td colspan="4" class="text-center p-8 text-gray-400 italic">Belum ada data SBAR yang tersimpan.</td></tr>
            {:else}
              {#each riwayatData as it}
                <tr class="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td class="p-3 align-top text-xs text-gray-500">
                    {it.timestamp}<br><span class="font-bold text-gray-800">{it.tanggal || '-'}</span>
                  </td>
                  <td class="p-3 align-top">
                    <div class="font-bold text-[#0F172A] text-sm">{it.namaPasien || '-'}</div>
                    <div class="text-xs text-gray-500 mt-1">RM: {it.rm || '-'} | Ruang: {it.ruang || '-'}</div>
                  </td>
                  <td class="p-3 align-top text-xs text-gray-600 truncate max-w-[200px]" title={it.problem}>
                    {it.problem || '-'}
                  </td>
                  <td class="p-3 align-top text-center space-y-2">
                    <button on:click={() => editDataSBAR(it)} class="text-xs font-bold text-[#a435f0] hover:underline w-full text-center block">Edit Data</button>
                    <button on:click={() => hapusSBAR(it.row)} class="text-xs font-bold text-red-600 hover:underline w-full text-center block">Hapus</button>
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

<div id="print-layer" style="display: none;">
  <div class="text-right text-[8pt] mb-1 font-bold text-gray-500">Form/087/UKP/II/2022/rev 1</div>

  <table class="sbar-tabel-utama w-full border-black border-2 border-collapse text-[10pt]">
    <tbody>
      <tr>
        <td width="25%" rowspan="2" class="text-center align-middle p-2.5 border border-black">
          <img src="/logo-kab.png" alt="Logo Kab Malang" class="w-[55px] mx-auto mb-1 object-contain">
          <b class="text-[9pt]">UPT PUSKESMAS<br>PONCOKUSUMO</b>
        </td>
        <td width="75%" class="text-center font-bold text-[13pt] align-middle p-2.5 border border-black">
          LEMBAR KOMUNIKASI SBAR
        </td>
      </tr>
      <tr>
        <td class="p-0 border border-black">
          <table class="sbar-tabel-tanpa-garis w-full p-1.5 h-full">
            <tbody>
              <tr>
                <td width="15%" class="pl-2.5">Tanggal</td><td width="35%">: <span class="teks-cetak w-[80%]">{form.tanggal || ' '}</span></td>
                <td width="15%">Jam</td><td width="35%">: <span class="teks-cetak w-[80%]">{form.jam || ' '}</span></td>
              </tr>
              <tr>
                <td class="pl-2.5 align-top">Pelapor<br><span class="text-[8pt]">(nama & jabatan)</span></td>
                <td class="align-top">: <span class="teks-cetak w-[80%]">{form.pelapor || ' '}</span></td>
                <td class="align-top">Penerima<br>Laporan</td>
                <td class="align-top">: <span class="teks-cetak w-[80%]">{form.penerima || ' '}</span></td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td class="text-center align-middle p-2.5 border border-black">
          <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">S</div><i class="text-[11pt] font-bold">SITUATION</i><br><br>
          <span class="text-[8.5pt] leading-[1.4]">Apa yang terjadi saat ini ?<br>Apa problemnya ?<br>Kapan terjadinya ?<br>Dan bagaimana parahnya ?</span>
        </td>
        <td class="p-0 border border-black">
          <table class="w-full border-collapse h-full">
            <tbody>
              <tr>
                <td class="border-b border-black p-1.5 px-2.5">
                  <table class="sbar-tabel-tanpa-garis w-full">
                    <tbody>
                      <tr><td width="20%">Nama Pasien</td><td width="40%">: <span class="teks-cetak w-[80%] uppercase">{form.namaPasien || ' '}</span></td><td width="15%">No. RM</td><td width="25%">: <span class="teks-cetak w-[80%]">{form.rm || ' '}</span></td></tr>
                      <tr><td>Tgl. Lahir</td><td>: <span class="teks-cetak w-[80%]">{form.tgllahir || ' '}</span></td><td>Ruang</td><td>: <span class="teks-cetak w-[80%]">{form.ruang || ' '}</span></td></tr>
                      <tr><td>NIK</td><td>: <span class="teks-cetak w-[80%]">{form.nik || ' '}</span></td><td>Alamat</td><td>: <span class="teks-cetak w-[80%]">{form.alamat || ' '}</span></td></tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="p-2 h-full align-top">
                  Problem :<br>
                  <div class="teks-cetak-area min-h-[50px] w-full">{form.problem || ' '}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td class="text-center align-middle p-2.5 border border-black">
          <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">B</div><i class="text-[11pt] font-bold">BACKGROUND</i><br><br>
          <span class="text-[8.5pt] leading-[1.4]">Informasi yang berkaitan /<br>mungkin berkaitan dengan<br>problemnya</span>
        </td>
        <td class="p-0 border border-black">
          <table class="w-full border-collapse">
            <tbody>
              <tr><td class="border-b border-black py-1 px-2.5">Dirawat dengan diagnosa : <span class="teks-cetak w-[70%]">{form.diagnosa || ' '}</span></td></tr>
              <tr><td class="border-b border-black py-1 px-2.5">Riwayat penyakit : <span class="teks-cetak w-[80%]">{form.riwayat || ' '}</span></td></tr>
              <tr><td class="border-b border-black py-1 px-2.5">Informasi klinis : <span class="teks-cetak w-[80%]">{form.klinis || ' '}</span></td></tr>
              <tr><td class="border-b border-black py-1 px-2.5">Lab. / pemeriksaan penunjang lain : <span class="teks-cetak w-[60%]">{form.lab || ' '}</span></td></tr>
              <tr><td class="border-b border-black py-1 px-2.5">Riwayat alergi : <span class="teks-cetak w-[80%]">{form.alergi || ' '}</span></td></tr>
              <tr>
                <td class="border-b border-black py-1 px-2.5">Tanda vital saat ini :
                  <table class="sbar-tabel-tanpa-garis w-full my-1">
                    <tbody>
                      <tr>
                        <td width="33%">KU: <span class="teks-cetak sbar-inline-input w-[60%]">{form.ku || ' '}</span></td>
                        <td width="33%">Kes: <span class="teks-cetak sbar-inline-input w-[60%]">{form.kes || ' '}</span></td>
                        <td width="34%">GCS: <span class="teks-cetak sbar-inline-input w-[60%]">{form.gcs || ' '}</span></td>
                      </tr>
                      <tr>
                        <td>TD: <span class="teks-cetak sbar-inline-input w-[35px] text-center">{form.tdSistol || ' '}</span> / <span class="teks-cetak sbar-inline-input w-[35px] text-center">{form.tdDiastol || ' '}</span> mmHg</td>
                        <td>Nadi: <span class="teks-cetak sbar-inline-input w-[40px] text-center">{form.nadi || ' '}</span> x/mnt</td>
                        <td>RR: <span class="teks-cetak sbar-inline-input w-[40px] text-center">{form.rr || ' '}</span> x/mnt</td>
                      </tr>
                      <tr>
                        <td>S: <span class="teks-cetak sbar-inline-input w-[40px] text-center">{form.suhu || ' '}</span> °C</td>
                        <td colspan="2">SpO2: <span class="teks-cetak sbar-inline-input w-[40px] text-center">{form.spo2 || ' '}</span> %</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr><td class="py-1 px-2.5 align-top">Terapi saat ini : <br><div class="teks-cetak-area min-h-[30px]">{form.terapi || ' '}</div></td></tr>
            </tbody>
          </table>
        </td>
      </tr>

      <tr>
        <td class="text-center align-middle p-2.5 border border-black">
          <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">A</div><i class="text-[11pt] font-bold">ASSESMENT</i>
        </td>
        <td class="p-1.5 px-2.5 align-top border border-black">
          Problem ini menurut anda disebabkan :<br><div class="teks-cetak-area min-h-[40px] w-full">{form.assesment || ' '}</div>
        </td>
      </tr>

      <tr>
        <td class="text-center align-middle p-2.5 border border-black">
          <div class="sbar-huruf-besar text-[24pt] font-bold mb-1">R</div><i class="text-[11pt] font-bold">RECOMMENDATION</i><br><br>
          <span class="text-[8.5pt] leading-[1.4]">Apa yang dapat dilakukan<br>untuk mengatasi problem ?</span>
        </td>
        <td class="p-1.5 px-2.5 align-top border border-black">
          Usulan dan mohon petunjuk (pemeriksaan / tindakan lebih lanjut) :<br><div class="teks-cetak-area min-h-[50px] w-full">{form.usulan || ' '}</div>
        </td>
      </tr>

      <tr>
        <td colspan="2" class="p-0 border border-black">
          <table class="w-full border-collapse h-full">
            <tbody>
              <tr>
                <td width="55%" class="border-r border-black py-2 px-2.5 align-top">
                  Instruksi / anjuran dari yang menerima laporan :<br><div class="teks-cetak-area min-h-[220px]">{form.instruksi || ' '}</div>
                </td>
                <td width="45%" class="p-2.5 align-top">
                  
                  <table class="w-full border-collapse border border-black mb-3">
                    <tbody>
                      <tr>
                        <td width="50%" class="text-center border-r border-black p-1.5 align-top">
                          <span class="text-[9pt]">Paraf pelapor,</span><br><br><br><br>
                          <span class="teks-cetak sbar-inline-input text-center w-[80%] text-[9pt] border-b border-dotted border-black">{form.ttdPelapor || ' '}</span>
                        </td>
                        <td width="50%" class="text-center p-1.5 align-top">
                          <span class="text-[9pt]">Paraf penerima<br>laporan,</span><br><br><br>
                          <span class="teks-cetak sbar-inline-input text-center w-[80%] text-[9pt] border-b border-dotted border-black">{form.ttdPenerima || ' '}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table class="w-full border-collapse border border-black">
                    <tbody>
                      <tr><td colspan="2" class="text-center border-b border-black font-bold p-1 text-[9.5pt]">Tulis Baca Konfirmasi (TBaK)</td></tr>
                      <tr>
                        <td width="50%" class="border-r border-black p-1.5 align-top">
                          <table class="w-full text-[8.5pt] mb-2 sbar-tabel-tanpa-garis">
                            <tbody>
                              <tr><td width="35%" class="align-middle">Tanggal</td><td class="align-middle">: <span class="teks-cetak w-[65%] text-[8pt] border-b border-dotted border-black px-1">{form.tbakTgl || ' '}</span></td></tr>
                              <tr><td class="align-middle">Jam</td><td class="align-middle">: <span class="teks-cetak w-[65%] text-[8pt] border-b border-dotted border-black px-1">{form.tbakJam || ' '}</span></td></tr>
                            </tbody>
                          </table>
                          <div class="text-center text-[8pt] mt-2">Penerima Instruksi,</div><br><br>
                          <div class="text-center"><span class="teks-cetak sbar-inline-input text-center w-[80%] border-b border-dotted border-black">{form.tbakPenerima || '................................'}</span></div>
                        </td>
                        <td width="50%" class="p-1.5 align-top">
                          <table class="w-full text-[8.5pt] mb-2 sbar-tabel-tanpa-garis">
                            <tbody><tr><td width="35%">Tanggal</td><td class="text-gray-400">: ......................</td></tr><tr><td>Jam</td><td class="text-gray-400">: ......................</td></tr></tbody>
                          </table>
                          <div class="text-center text-[8pt] mt-2">Pemberi Instruksi,</div><br><br>
                          <div class="text-center"><span class="teks-cetak sbar-inline-input text-center w-[80%] border-b border-dotted border-black text-gray-400">................................</span></div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>
  <div class="text-center text-[9pt] mt-2 italic text-gray-800 font-semibold">
    Terima kasih atas kerjasamanya telah mengisi formulir ini dengan lengkap dan benar
  </div>
</div>

<style>
  /* CSS UNTUK LAYAR UI (LAPISAN PERTAMA) */
  .sbar-input { border: none; border-bottom: 1px dashed #aaa; background-color: transparent; outline: none; padding: 2px 0; color: #000; width: 100%; }
  .sbar-input:focus, .sbar-textarea:focus { border-bottom: 1px solid #3b82f6; background-color: #f8fafc; }
  .sbar-inline-input { width: auto !important; min-width: 30px; display: inline-block; text-align: center; }
  .sbar-textarea { width: 100%; border: none; padding: 0px; box-sizing: border-box; resize: vertical; outline: none; background-color: transparent; font-family: inherit; font-size: inherit;}
  
  .sbar-tabel-utama { border-collapse: collapse; font-size: 10pt; border: 2px solid #000; margin-bottom: 5px; width: 100%; color: black;}
  .sbar-tabel-utama th, .sbar-tabel-utama td { border: 1px solid #000; }
  .sbar-tabel-tanpa-garis { border-collapse: collapse; font-size: 10pt; width: 100%; color: black;}
  .sbar-tabel-tanpa-garis td { border: none; padding: 3px; }
  .sbar-huruf-besar { font-size: 24pt; font-weight: bold; margin-bottom: 3px; color: black;}

  @media screen and (max-width: 768px) {
    .kertas-ui { padding: 15px 12px !important; border-radius: 12px; }
    .sbar-tabel-utama, .sbar-tabel-utama > tbody, .sbar-tabel-utama > tbody > tr, .sbar-tabel-utama > tbody > tr > td { display: block; width: 100% !important; box-sizing: border-box; }
    .sbar-tabel-utama > tbody > tr > td { border: none; border-bottom: 3px solid #1c1d1f; padding: 15px 10px !important; text-align: left !important; }
    .sbar-tabel-utama > tbody > tr > td:last-child { border-bottom: none; }
    .sbar-huruf-besar { display: inline-block; font-size: 18pt; margin-right: 8px; margin-bottom: 5px; vertical-align: middle; }
    .sbar-input, .sbar-textarea { background: #f1f5f9 !important; border: 1.5px solid #cbd5e1 !important; border-radius: 8px !important; padding: 10px !important; }
  }
</style>