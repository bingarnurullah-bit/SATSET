<script>
  import { supabase } from './supabase.js';

  // Props yang bisa diatur dari file induk
  export let showModal = false;
  export let onSuccess; 
  export let judulAksi = "Otorisasi Administrator";
  export let pesanPeringatan = "Tindakan ini membutuhkan hak akses khusus.";
  export let hanyaAdmin = true; // Jika true, hanya email admin yang boleh masuk

  let email = "";
  let password = "";
  let isProcessing = false;
  let errorMsg = "";

  async function eksekusiAuth() {
    if (!email || !password) return errorMsg = "Email dan Password wajib diisi!";
    
    // Kunci Lapis 1: Cegat jika di-setting hanya untuk admin
    if (hanyaAdmin && email.toLowerCase() !== 'admin@satsetponcokusumo.com') {
      return errorMsg = "Akses Ditolak: Hanya Akun Admin yang diizinkan!";
    }

    isProcessing = true;
    errorMsg = "";

    try {
      // Kunci Lapis 2: Verifikasi via Supabase
      const { error: authError } = await supabase.auth.signInWithPassword({ 
        email: email, 
        password: password 
      });
      
      if (authError) throw new Error("Akses Ditolak! Password/Email Salah.");

      // Jika tembus, jalankan fungsi rahasia dari induk, lalu tutup modal
      showModal = false;
      email = ""; password = "";
      if (onSuccess) onSuccess(); 
      
    } catch (err) {
      errorMsg = err.message;
    } finally {
      isProcessing = false;
    }
  }

  function tutupModal() {
    showModal = false;
    email = ""; password = ""; errorMsg = "";
  }
</script>

{#if showModal}
  <div class="fixed inset-0 bg-slate-900/80 z-[100] flex justify-center items-center backdrop-blur-sm p-4">
    <div class="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full border-t-8 border-red-600 animate-fade-in">
      <div class="text-center mb-6">
        <span class="material-icons text-5xl text-red-600 mb-2">admin_panel_settings</span>
        <h3 class="font-black text-xl text-slate-800">{judulAksi}</h3>
        <p class="text-xs text-slate-500 mt-2 leading-relaxed">{@html pesanPeringatan}</p>
      </div>
      
      {#if errorMsg} 
        <div class="bg-red-100 text-red-700 p-2 rounded text-sm font-bold text-center mb-4 border border-red-200">{errorMsg}</div> 
      {/if}
      
      <input type="email" bind:value={email} placeholder="Email" class="w-full border-2 border-slate-300 p-3 rounded-xl mb-3 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 font-bold text-center text-sm">
      <input type="password" bind:value={password} on:keydown={(e) => e.key === 'Enter' && eksekusiAuth()} placeholder="Password" class="w-full border-2 border-slate-300 p-3 rounded-xl mb-6 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 font-bold text-center tracking-widest text-lg">
      
      <div class="flex gap-3">
        <button on:click={tutupModal} class="bg-slate-200 text-slate-700 hover:bg-slate-300 transition font-bold px-4 py-3 rounded-xl w-full">Batal</button>
        <button on:click={eksekusiAuth} disabled={isProcessing} class="bg-red-600 hover:bg-red-700 transition text-white font-bold px-4 py-3 rounded-xl w-full flex justify-center items-center">
          {#if isProcessing}
            <span class="material-icons animate-spin text-sm mr-1">sync</span> Cek...
          {:else}
            <span class="material-icons text-sm mr-1">verified</span> Otorisasi
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}