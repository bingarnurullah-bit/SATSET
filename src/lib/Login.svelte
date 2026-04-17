<script>
  let email = "";
  let password = "";
  let errorMessage = "";
  let isLoading = false;

  async function handleLogin() {
    isLoading = true;
    errorMessage = "";
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      errorMessage = "Akses Ditolak! Email atau Password salah.";
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900 bg-opacity-95 backdrop-blur-sm">
  <div class="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md mx-4 border-t-8 border-gold">
    <div class="text-center mb-8">
      <h1 class="font-serif-satset text-4xl font-extrabold text-navy mb-2">SATSET</h1>
      <p class="text-sm text-gray-500 font-bold uppercase tracking-widest">Puskesmas Poncokusumo</p>
    </div>
    
    <form on:submit|preventDefault={handleLogin}>
      <div class="mb-5">
        <label class="block text-sm font-bold mb-2 text-navy">Email Petugas</label>
        <input type="email" bind:value={email} required class="w-full border-2 border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:border-udemy-purple" placeholder="contoh: bingbing@poncokusumo.com">
      </div>
      
      <div class="mb-6">
        <label class="block text-sm font-bold mb-2 text-navy">Password</label>
        <input type="password" bind:value={password} required class="w-full border-2 border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:border-udemy-purple" placeholder="••••••••">
      </div>

      {#if errorMessage}
        <div class="mb-4 p-3 bg-red-100 text-red-600 text-xs font-bold rounded-lg text-center">{errorMessage}</div>
      {/if}

      <button type="submit" disabled={isLoading} class="w-full bg-navy hover:bg-black text-white font-bold py-4 rounded-xl shadow-lg">
        {isLoading ? 'Memproses...' : 'Buka Sistem SATSET'}
      </button>
    </form>
  </div>
</div>