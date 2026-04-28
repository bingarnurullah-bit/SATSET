<script>
    // Menerima fungsi pindah halaman dari App.svelte
    export let switchView;

    // Fungsi khusus untuk membuka link eksternal (GAS) di tab baru
    function openExternalApp(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
</script>

<div class="content-view block animate-fade-in no-print py-12 px-6 lg:px-12 max-w-7xl mx-auto">
    <h3 class="text-2xl font-bold mb-2 text-[#1c1d1f]">Solusi untuk Anda agar Lebih SATSET</h3>
    <p class="text-gray-500 mb-8">Pintasan menuju aplikasi yang paling sering digunakan oleh Operator.</p>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6" id="cardContainer">
        
        <div on:click={() => switchView('app-ebilling')} class="course-card flex flex-col bg-white rounded-md overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
            <div class="card-image-container relative h-36 lg:h-40 overflow-hidden border-b border-gray-200">
                <img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" class="w-full h-full object-cover" alt="E-Billing">
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h4 class="font-bold text-base mb-1 line-clamp-2 leading-tight text-[#1c1d1f]">Formulir E-Billing Poncokusumo</h4>
                <p class="text-xs text-gray-500 mb-2">Bagian Administrasi & Kasir</p>
                <div class="font-bold text-sm text-[#1c1d1f] mt-auto">Akses Keuangan</div>
                <div class="mt-2"><span class="bg-[#eceb98] text-[#3d3c0a] text-xs font-bold px-2 py-1 rounded-sm">Bestseller</span></div>
            </div>
        </div>

        <div on:click={() => switchView('app-jaga-menu')} class="course-card flex flex-col bg-white rounded-md overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
            <div class="card-image-container relative h-36 lg:h-40 overflow-hidden border-b border-gray-200">
                <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80" class="w-full h-full object-cover" alt="Laporan Jaga">
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h4 class="font-bold text-base mb-1 line-clamp-2 leading-tight text-[#1c1d1f]">Laporan Shift & Rekap Pasien Jaga</h4>
                <p class="text-xs text-gray-500 mb-2">Bagian Operasional Shift UGD & KABER</p>
                <div class="font-bold text-sm text-[#1c1d1f] mt-auto">Akses Medis</div>
                <div class="mt-2"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-sm">Prioritas</span></div>
            </div>
        </div>

        <div on:click={() => switchView('app-sbar')} class="course-card flex flex-col bg-white rounded-md overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
            <div class="card-image-container relative h-36 lg:h-40 overflow-hidden border-b border-gray-200">
                <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" class="w-full h-full object-cover" alt="SBAR">
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h4 class="font-bold text-base mb-1 line-clamp-2 leading-tight text-[#1c1d1f]">Form Komunikasi SBAR Online</h4>
                <p class="text-xs text-gray-500 mb-2">Pelaporan Terintegrasi UGD/KABER</p>
                <div class="font-bold text-sm text-[#1c1d1f] mt-auto">Akses Medis & Keperawatan</div>
                <div class="mt-2"><span class="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-sm">Baru</span></div>
            </div>
        </div>

        <div on:click={() => switchView('app-insiden')} class="course-card flex flex-col bg-white rounded-md overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
            <div class="card-image-container relative h-36 lg:h-40 overflow-hidden border-b border-gray-200">
                <img src="https://images.unsplash.com/photo-1585435557343-3b092031a831?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" class="w-full h-full object-cover" alt="Insiden K3">
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h4 class="font-bold text-base mb-1 line-clamp-2 leading-tight text-[#1c1d1f]">Buku Laporan Insiden K3</h4>
                <p class="text-xs text-gray-500 mb-2">Manajemen Risiko & Keselamatan Pasien</p>
                <div class="font-bold text-sm text-[#1c1d1f] mt-auto">Akses Internal</div>
                <div class="mt-2"><span class="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-sm">Penting</span></div>
            </div>
        </div>

        <div on:click={() => switchView('visum')} class="course-card flex flex-col bg-white rounded-md overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
            <div class="card-image-container relative h-36 lg:h-40 overflow-hidden border-b border-gray-200 bg-slate-900">
                <img src="https://images.pexels.com/photos/923681/pexels-photo-923681.jpeg?auto=compress&cs=tinysrgb&w=600" class="w-full h-full object-cover" alt="Visum">
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <h4 class="font-bold text-base mb-1 line-clamp-2 leading-tight text-[#1c1d1f]">Laporan Visum (VeR)</h4>
                <p class="text-xs text-gray-500 mb-2">Dokumen Pro Justitia & Approval Kapus</p>
                <div class="font-bold text-sm text-[#1c1d1f] mt-auto">Akses Medis & Hukum</div>
                <div class="mt-2"><span class="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-sm">Rahasia</span></div>
            </div>
        </div>

        <div on:click={() => openExternalApp('https://script.google.com/macros/s/AKfycbwCyORIwdowJpgKUpSmeVp9bZSJT2Ohk5x6t37f0wOA2uAJK1Yf8p8Iy9RsljZrJTzK-w/exec')} 
             class="course-card flex flex-col bg-white rounded-md overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-1 ring-1 ring-emerald-500/30">
            <div class="card-image-container relative h-36 lg:h-40 overflow-hidden border-b border-gray-200 bg-slate-100 flex items-center justify-center group">
                <div class="absolute inset-0 bg-gradient-to-t from-emerald-900/80 to-emerald-800/40 mix-blend-multiply z-10"></div>
                <img src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" class="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-500" alt="Rekam Medis">
                <span class="material-icons text-white text-5xl z-20 drop-shadow-lg group-hover:scale-110 transition-transform">folder_shared</span>
                
                <div class="absolute top-2 right-2 z-20 bg-white/90 backdrop-blur-sm text-emerald-800 text-[10px] font-black px-2 py-1 rounded shadow-sm flex items-center">
                    <span class="material-icons text-[12px] mr-1">open_in_new</span> Google App
                </div>
            </div>
            
            <div class="p-3 flex-1 flex flex-col">
                <h4 class="font-bold text-base mb-1 line-clamp-2 leading-tight text-[#1c1d1f]">Form Input & Cari No. RM</h4>
                <p class="text-xs text-gray-500 mb-2">Pencarian & Registrasi Pasien (External App)</p>
                <div class="font-bold text-sm text-emerald-700 mt-auto flex items-center">
                    <span class="material-icons text-[16px] mr-1">badge</span> Pendaftaran
                </div>
                <div class="mt-2 flex gap-1">
                    <span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-sm">Rahasia</span>
                </div>
            </div>
        </div>

    </div>
</div>

<style>
    /* Animasi dan Shadow Kartu */
    .course-card { transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .course-card:hover { transform: translateY(-4px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    .card-image-container::after { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0); transition: background 0.3s ease; }
    .course-card:hover .card-image-container::after { background: rgba(0,0,0,0.1); }
    .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>