<script>
  import { onMount } from 'svelte';
  import Login from './lib/Login.svelte';
  import Dashboard from './lib/Dashboard.svelte';
  import EBilling from './lib/EBilling.svelte'; 
  import Sbar from './lib/Sbar.svelte';
  import LaporanJaga from './lib/LaporanJaga.svelte';
  import Insiden from './lib/Insiden.svelte'; 
  import Riwayat from './lib/Riwayat.svelte';
  import Admin from './lib/Admin.svelte';
  import Visum from './lib/Visum.svelte';
  import BonObat from './lib/BonObat.svelte';

  let user = null;
  let currentView = 'dashboard'; 
  
  // Variabel penampung data dari Google Sheets
  let masterData = { identitas: [], kategori: {}, obat: [], kop: {} };
  const API_URL = "https://script.google.com/macros/s/AKfycbyac04k5lum4iD443YfCDjZt13IIbh3dANpBsY-1eYSLa8prx79xV9wnkcaRwhyw26GMw/exec";

  onMount(() => {
    // KUNCI KEAMANAN: Paksa Firebase masuk mode SESSION
    if (window.firebase) {
      window.firebase.auth().setPersistence(window.firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
          window.firebase.auth().onAuthStateChanged((u) => {
            user = u;
            if(user) muatMasterData(); 
            
            setTimeout(() => {
              if(window.lucide) window.lucide.createIcons();
            }, 100);
          });
        })
        .catch((error) => {
          console.error("Gagal mengaktifkan gembok sesi Firebase:", error);
        });
    }

    // FITUR 1: SISTEM NAVIGASI 
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      currentView = hash;
    }
    window.addEventListener('popstate', handlePopState);
  });

  function handlePopState(event) {
    const hash = window.location.hash.replace('#', '');
    currentView = hash ? hash : 'dashboard';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { if(window.lucide) window.lucide.createIcons(); }, 50);
  }

  async function muatMasterData() {
    try {
      const response = await fetch(API_URL + "?action=getMasterData");
      const hasil = await response.json();
      if(hasil.status === "success") {
        masterData = hasil.data;
      }
    } catch (error) {
      console.error("Gagal ambil data database:", error);
    }
  }

  function switchView(target) {
    currentView = target;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        if(window.lucide) window.lucide.createIcons();
    }, 50);
    window.history.pushState(null, '', `#${target}`);
  }

  function logout() {
    if (window.firebase) {
      window.firebase.auth().signOut().then(() => {
        window.history.replaceState(null, '', window.location.pathname);
      });
    }
  }
</script>

{#if !user && currentView !== 'app-insiden'}
  <Login />
{:else}
  
  {#if user}
  <header class="h-20 flex items-center px-6 lg:px-12 border-b border-gray-200 sticky top-0 bg-white z-50 shadow-sm no-print">
      <a href="#dashboard" on:click|preventDefault={() => switchView('dashboard')} class="flex items-center mr-8 cursor-pointer group">
          <div class="w-10 h-10 bg-udemy-black text-white rounded-lg flex items-center justify-center mr-3 group-hover:bg-udemy-purple transition-colors">
              <i data-lucide="zap" class="w-6 h-6 fill-current"></i>
          </div>
          <h1 class="font-serif-satset text-3xl font-extrabold tracking-tight group-hover:text-udemy-purple transition-colors">SATSET</h1>
      </a>

      <div class="hidden md:flex flex-1 max-w-3xl relative group">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <i data-lucide="search" class="w-5 h-5 text-gray-400 group-focus-within:text-udemy-purple transition-colors"></i>
          </div>
          <input type="text" placeholder="Cari Aplikasi (misal: 'Billing', 'Laporan Jaga', 'SBAR')...." 
              class="w-full bg-udemy-light border border-gray-300 rounded-full py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-udemy-purple focus:border-transparent transition-all text-sm placeholder-gray-500" />
      </div>

      <div class="flex items-center ml-auto space-x-6">
          <a href="#dashboard" on:click|preventDefault={() => switchView('dashboard')} class="hidden lg:block text-sm font-medium hover:text-udemy-purple transition-colors">Aplikasi Saya</a>
          
          <a href="#app-admin" on:click|preventDefault={() => switchView('app-admin')} class="hidden md:flex items-center text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
              <span class="material-icons text-sm mr-1">admin_panel_settings</span> Admin
          </a>

          <button on:click={logout} class="text-sm font-bold text-red-500 hover:text-red-700 transition-colors flex items-center cursor-pointer">
              <i data-lucide="log-out" class="w-4 h-4 mr-1"></i> Keluar
          </button>
      </div>
  </header>

  <div class="hidden md:flex justify-center space-x-8 py-3 shadow-[0_4px_6px_-6px_rgba(0,0,0,0.1)] text-sm text-udemy-gray bg-white relative z-40 no-print border-b">
      <a href="#dashboard" on:click|preventDefault={() => switchView('dashboard')} class="pb-1 transition-all {currentView === 'dashboard' ? 'text-udemy-purple font-bold border-b-2 border-udemy-purple' : 'hover:text-udemy-purple hover:font-bold border-b-2 border-transparent'}">
        Semua Aplikasi
      </a>
      
      <a href="https://script.google.com/macros/s/AKfycbwCyORIwdowJpgKUpSmeVp9bZSJT2Ohk5x6t37f0wOA2uAJK1Yf8p8Iy9RsljZrJTzK-w/exec" target="_blank" rel="noopener noreferrer" class="pb-1 flex items-center text-emerald-600 hover:text-emerald-800 hover:font-bold transition-all border-b-2 border-transparent">
          Pendaftaran & RM <span class="material-icons text-[12px] ml-1">open_in_new</span>
      </a>

      <a href="#app-ebilling" on:click|preventDefault={() => switchView('app-ebilling')} class="pb-1 transition-all {currentView === 'app-ebilling' ? 'text-udemy-purple font-bold border-b-2 border-udemy-purple' : 'hover:text-udemy-purple hover:font-bold border-b-2 border-transparent'}">
        Administrasi & Kasir
      </a>

      <a href="#app-jaga-menu" on:click|preventDefault={() => switchView('app-jaga-menu')} class="pb-1 transition-all {currentView.includes('app-jaga') || currentView === 'app-bon-obat' ? 'text-udemy-purple font-bold border-b-2 border-udemy-purple' : 'hover:text-udemy-purple hover:font-bold border-b-2 border-transparent'}">
        Operasional Shift
      </a>

      <a href="#app-sbar" on:click|preventDefault={() => switchView('app-sbar')} class="pb-1 transition-all {currentView === 'app-sbar' ? 'text-udemy-purple font-bold border-b-2 border-udemy-purple' : 'hover:text-udemy-purple hover:font-bold border-b-2 border-transparent'}">
        Form SBAR
      </a>

      <a href="#app-insiden" on:click|preventDefault={() => switchView('app-insiden')} class="pb-1 transition-all {currentView === 'app-insiden' ? 'text-udemy-purple font-bold border-b-2 border-udemy-purple' : 'hover:text-udemy-purple hover:font-bold border-b-2 border-transparent'}">
        Laporan Insiden
      </a>

      <a href="#visum" on:click|preventDefault={() => switchView('visum')} class="pb-1 transition-all {currentView === 'visum' ? 'text-red-600 font-bold border-b-2 border-red-600' : 'hover:text-red-600 hover:font-bold border-b-2 border-transparent'}">
        Laporan Visum
      </a>
  </div>
  {/if}
  
  <main class="min-h-screen pb-20">
    {#if currentView === 'dashboard'}
      <Dashboard {switchView} />
    
    {:else if currentView === 'app-ebilling'}
      <EBilling {switchView} />
    
    {:else if currentView === 'app-jaga-menu'}
      <div class="max-w-4xl mx-auto p-6 pt-16 animate-fade-in">
         <h1 class="text-3xl font-black text-center text-slate-800 mb-2 uppercase">Operasional Shift</h1>
         <p class="text-center text-slate-500 mb-12">Pilih aplikasi operasional yang Ingin Anda Jalankan</p>
         
         <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button on:click={() => switchView('app-jaga-input')} class="bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all group flex flex-col text-left border border-slate-100">
               <div class="w-full h-56 overflow-hidden relative">
                  <div class="absolute inset-0 bg-blue-900/10 group-hover:bg-transparent transition-colors z-10"></div>
                  <img src="/ugd.jpeg" alt="Rawat Inap" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">                  
               </div>
               
               <div class="p-8 border-t-4 border-blue-500 w-full flex-1">
                  <h2 class="text-2xl font-black text-slate-800 mb-3">Laporan Shift UGD</h2>
                  <p class="text-slate-500 font-medium text-sm">Input data pasien UGD/Kaber, rekap shift WA, dan akses buku steling obat.</p>
               </div>
            </button>

            <button on:click={() => switchView('app-bon-obat')} class="bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all group flex flex-col text-left border border-slate-100">
               <div class="w-full h-56 overflow-hidden relative">
                  <div class="absolute inset-0 bg-emerald-900/10 group-hover:bg-transparent transition-colors z-10"></div>
                  <img src="/ranap.jpeg" alt="Rawat Inap" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
               </div>

               <div class="p-8 border-t-4 border-emerald-500 w-full flex-1">
                  <h2 class="text-2xl font-black text-slate-800 mb-3">Bon Obat Inap & Kaber</h2>
                  <p class="text-slate-500 font-medium text-sm">Form khusus bon obat untuk Rawat Inap & Kaber (Terkoneksi ke Steling Utama).</p>
               </div>
            </button>
         </div>
      </div>

    {:else if currentView === 'app-jaga-input'}
      <LaporanJaga {switchView} activeTab="input" />
      
    {:else if currentView === 'app-bon-obat'}
      <BonObat {switchView} />

    {:else if currentView === 'app-jaga-rekap'}
      <LaporanJaga {switchView} activeTab="rekap" />
    
    {:else if currentView === 'app-sbar'}
      <Sbar {switchView} />
    
    {:else if currentView === 'contact'}
      <div class="p-10 text-center animate-fade-in">
        <h2 class="text-2xl font-bold text-navy">Pusat Bantuan (Sedang Proses Migrasi)</h2>
      </div>
    
    {:else if currentView === 'app-insiden'}
      <Insiden {switchView} />
    
    {:else if currentView === 'riwayat'} 
      <Riwayat {switchView} />
    
    {:else if currentView === 'app-admin'}
      <Admin {switchView} />
    
    {:else if currentView === 'visum'}
      <Visum {switchView} />
    {/if}
  </main>
{/if}