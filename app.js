// ==========================================
// KODE LOGIKA UTAMA KAUMAN CITY (app.js)
// ==========================================

const SUPABASE_URL = 'https://YOUR-SUPABASE-URL.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-SUPABASE-ANON-KEY';

let supabaseClient = null;
let currentUser = null;
let userProfile = null;
let isRegisterMode = false;

// State Demo Lokal (jika belum dikonfigurasi)
let localState = {
    username: 'Tamu',
    role: 'Tamu',
    status: 'guest',
    saldo: 50000,
    energi: 100,
    gizi: 100
};

// Default Bangunan Awal
let defaultBuildings = [
    { name: 'Masjid Kauman', category: 'Pusat', desc: 'Pusat Ibadah, Ketenangan spiritual & Bonus EXP' },
    { name: 'Pasar Kauman', category: 'Ekonomi', desc: 'Pusat Belanja kebutuhan harian dan kuliner Semarang' },
    { name: 'Pemukiman Warga', category: 'Hunian', desc: 'Tempat istirahat, tidur, dan pemulihan energi fisik' },
    { name: 'Busana Muslim', category: 'Fashion', desc: 'Butik pakaian khas Jawa-Islam, Koko, Sarung, dan Batik' }
];

try {
    if (SUPABASE_URL.includes('YOUR-')) {
        console.warn("Supabase belum dikonfigurasi. Berjalan dalam Mode Demo Lokal.");
        renderBuildings(defaultBuildings);
    } else {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        document.getElementById('config-banner').classList.add('hidden');
        checkSession();
        fetchBuildings();
        fetchSocialFeed();
    }
} catch(e) {
    console.error("Gagal menginisialisasi Supabase:", e);
    renderBuildings(defaultBuildings);
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function openLocation(title, desc) {
    document.getElementById('loc-title').innerText = title;
    document.getElementById('loc-desc').innerText = desc;
    openModal('location-modal');
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    if(isRegisterMode) {
        document.getElementById('auth-modal-title').innerHTML = '<i class="fa-solid fa-user-plus mr-1"></i> Daftar Warga Kauman';
        document.getElementById('register-fields').classList.remove('hidden');
        document.getElementById('auth-submit-btn').innerText = 'Daftar Akun Warga';
        document.getElementById('auth-toggle-btn').innerText = 'Sudah punya akun? Masuk di sini';
    } else {
        document.getElementById('auth-modal-title').innerHTML = '<i class="fa-solid fa-user-lock mr-1"></i> Masuk Warga Kauman';
        document.getElementById('register-fields').classList.add('hidden');
        document.getElementById('auth-submit-btn').innerText = 'Masuk ke Kota';
        document.getElementById('auth-toggle-btn').innerText = 'Belum punya akun warga? Daftar di sini';
    }
}

// Autentikasi Supabase
async function handleAuthSubmit() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if(!email || !password) {
        alert('Email dan Password wajib diisi!');
        return;
    }

    if(!supabaseClient) {
        if(isRegisterMode) {
            localState.username = document.getElementById('auth-name').value || 'Warga Baru';
            localState.role = 'Warga';
            localState.status = 'approved';
        } else {
            localState.username = email.split('@')[0];
            localState.role = 'Warga';
            localState.status = 'approved';
        }
        updateUIState();
        closeModal('auth-modal');
        alert('Berhasil masuk dalam Mode Demo Lokal.');
        return;
    }

    try {
        if(isRegisterMode) {
            const name = document.getElementById('auth-name').value;
            const ig = document.getElementById('auth-ig').value;
            if(!name) return alert('Nama karakter wajib diisi!');

            const { data, error } = await supabaseClient.auth.signUp({
                email, password
            });
            if (error) throw error;

            if(data.user) {
                // Buat baris profil di database
                const { error: profileError } = await supabaseClient.from('profiles').insert([
                    { id: data.user.id, username: name, instagram: ig, role: 'citizen', status: 'pending', saldo: 50000 }
                ]);
                if(profileError) throw profileError;
            }
            alert('Pendaftaran berhasil! Akun Anda berstatus PENDING dan menunggu persetujuan Wali Kota.');
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            alert('Berhasil masuk ke Kauman City!');
            await checkSession();
            fetchBuildings();
            fetchSocialFeed();
        }
        closeModal('auth-modal');
    } catch(err) {
        alert('Autentikasi Gagal: ' + err.message);
    }
}

async function checkSession() {
    if(!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(session) {
        currentUser = session.user;
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if(profile) {
            userProfile = profile;
            localState.username = profile.username;
            localState.role = profile.role === 'mayor' ? 'Wali Kota' : 'Warga';
            localState.status = profile.status;
            localState.saldo = profile.saldo;
            localState.energi = profile.energi;
            localState.gizi = profile.gizi;
            updateUIState();
        }
    }
}

function updateUIState() {
    document.getElementById('user-role-display').innerText = localState.role;
    document.getElementById('auth-btn-text').innerText = localState.username;
    document.getElementById('header-saldo').innerText = 'Rp. ' + Number(localState.saldo).toLocaleString();
    document.getElementById('bank-saldo-display').innerText = 'Rp. ' + Number(localState.saldo).toLocaleString();
    document.getElementById('widget-status-summary').innerText = `Energi ${localState.energi}%`;
    
    if(localState.status === 'approved') {
        document.getElementById('verified-badge').classList.remove('hidden');
    } else {
        document.getElementById('verified-badge').classList.add('hidden');
    }
}

// Simulasi Kehidupan
async function doSimulation(action) {
    if(localState.status === 'pending' && supabaseClient) {
        alert('Akun Anda masih berstatus PENDING. Tunggu persetujuan Wali Kota untuk melakukan aktivitas penuh.');
        return;
    }

    if(action === 'makan') {
        localState.gizi = Math.min(100, localState.gizi + 20);
        localState.energi = Math.min(100, localState.energi + 5);
        alert('Anda menikmati kuliner khas Pasar Kauman. Gizi bertambah!');
    } else if(action === 'tidur') {
        localState.energi = 100;
        alert('Anda beristirahat di rumah Kauman. Energi fisik pulih penuh.');
    } else if(action === 'ibadah') {
        localState.energi = Math.max(0, localState.energi - 5);
        alert('Alhamdulillah, menunaikan ibadah di Masjid Kauman memberikan ketenangan batin dan bonus EXP permainan.');
    } else if(action === 'kerja') {
        if(localState.energi < 15) {
            alert('Energi terlalu rendah! Silakan tidur atau makan terlebih dahulu.');
            return;
        }
        localState.energi -= 15;
        localState.saldo += 25000;
        alert('Anda bekerja di Alun-Alun Kauman dan mendapatkan penghasilan Rp. 25.000 KAUMANCITY.');
    }

    updateUIState();

    if(supabaseClient && currentUser) {
        await supabaseClient.from('profiles').update({
            energi: localState.energi,
            gizi: localState.gizi,
            saldo: localState.saldo
        }).eq('id', currentUser.id);
    }
}

// Transfer Saldo Atomik Aman via RPC Supabase
async function executeTransfer() {
    const target = document.getElementById('transfer-target').value;
    const amount = parseFloat(document.getElementById('transfer-amount').value);

    if(!target || !amount || amount <= 0) {
        alert('Masukkan tujuan dan nominal transfer yang valid!');
        return;
    }

    if(!supabaseClient) {
        if(amount > localState.saldo) {
            alert('Saldo virtual tidak mencukupi!');
            return;
        }
        localState.saldo -= amount;
        updateUIState();
        closeModal('bank-modal');
        alert(`Berhasil mentransfer Rp. ${amount.toLocaleString()} kepada ${target} (Mode Demo).`);
        return;
    }

    try {
        const { error } = await supabaseClient.rpc('transfer_saldo', {
            recipient_username: target,
            transfer_amount: amount
        });
        if(error) throw error;

        alert('Transfer saldo berhasil dan aman melalui backend!');
        closeModal('bank-modal');
        await checkSession();
    } catch(err) {
        alert('Transfer Gagal: ' + err.message);
    }
}

// Keamanan Panel Wali Kota (Dicek langsung via Database RLS)
async function openMayorPanel() {
    if(!supabaseClient) {
        if(localState.role === 'Wali Kota') {
            openModal('mayor-panel-modal');
            loadPendingUsersDemo();
        } else {
            alert('Akses ditolak! Menu ini khusus untuk Wali Kota.');
        }
        return;
    }

    if(!userProfile || userProfile.role !== 'mayor') {
        alert('Akses Ditolak! Anda bukan Wali Kota yang terverifikasi di database.');
        return;
    }

    openModal('mayor-panel-modal');
    loadPendingUsersDatabase();
}

async function loadPendingUsersDatabase() {
    const container = document.getElementById('pending-users-list');
    container.innerHTML = '<p class="text-gray-400 text-center py-2">Memuat daftar warga...</p>';

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('status', 'pending');

    if(error) {
        container.innerHTML = '<p class="text-red-400 text-center py-2">Gagal memuat data.</p>';
        return;
    }

    if(!data || data.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-2">Tidak ada warga pending.</p>';
        return;
    }

    container.innerHTML = '';
    data.forEach(user => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-kauman-900/80 p-2.5 rounded-xl border border-kauman-gold/20';
        
        const info = document.createElement('div');
        const nameP = document.createElement('p');
        nameP.className = 'font-bold text-kauman-cream';
        nameP.textContent = user.username + ' (' + (user.instagram || 'Tanpa IG') + ')';
        info.appendChild(nameP);

        const btn = document.createElement('button');
        btn.className = 'bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold text-[10px]';
        btn.textContent = 'ACC Warga';
        btn.onclick = () => approveUser(user.id);

        div.appendChild(info);
        div.appendChild(btn);
        container.appendChild(div);
    });
}

function loadPendingUsersDemo() {
    const container = document.getElementById('pending-users-list');
    container.innerHTML = `
        <div class="flex justify-between items-center bg-kauman-900/80 p-2.5 rounded-xl border border-kauman-gold/20">
            <div>
                <p class="font-bold text-kauman-cream">@budi_santoso (Mode Demo)</p>
            </div>
            <button onclick="alert('Warga di-ACC (Demo)')" class="bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold text-[10px]">ACC Warga</button>
        </div>
    `;
}

async function approveUser(userId) {
    const { error } = await supabaseClient
        .from('profiles')
        .update({ status: 'approved' })
        .eq('id', userId);

    if(error) {
        alert('Gagal menyetujui warga: ' + error.message);
    } else {
        alert('Warga berhasil disetujui (ACC)!');
        loadPendingUsersDatabase();
    }
}

// Tambah Bangunan ke Database
async function addNewBuilding() {
    const name = document.getElementById('new-building-name').value;
    const category = document.getElementById('new-building-category').value;
    if(!name) return alert('Nama bangunan wajib diisi!');

    if(!supabaseClient) {
        defaultBuildings.push({ name, category, desc: 'Bangunan baru hasil pembangunan kota.' });
        renderBuildings(defaultBuildings);
        closeModal('mayor-panel-modal');
        alert(`Sukses membangun "${name}" (Mode Demo).`);
        return;
    }

    const { error } = await supabaseClient
        .from('buildings')
        .insert([{ name, category, created_by: currentUser.id }]);

    if(error) {
        alert('Gagal membangun: ' + error.message);
    } else {
        alert(`Sukses! Bangunan "${name}" berhasil disimpan ke database.`);
        closeModal('mayor-panel-modal');
        fetchBuildings();
    }
}

async function fetchBuildings() {
    if(!supabaseClient) return;
    const { data, error } = await supabaseClient.from('buildings').select('*');
    if(!error && data) {
        const combined = [...defaultBuildings, ...data];
        renderBuildings(combined);
    }
}

function renderBuildings(list) {
    const grid = document.getElementById('buildings-grid');
    grid.innerHTML = '';
    list.forEach(b => {
        const card = document.createElement('div');
        card.className = 'glass-panel p-3 rounded-2xl cursor-pointer hover:border-kauman-gold transition transform hover:-translate-y-1 shadow-md border-l-4 border-l-kauman-gold';
        card.onclick = () => openLocation(b.name, b.desc || 'Lokasi penting di Kauman City.');
        
        card.innerHTML = `
            <div class="flex items-center space-x-2.5">
                <div class="w-10 h-10 rounded-xl bg-kauman-gold text-kauman-900 flex items-center justify-center font-bold text-lg">
                    <i class="fa-solid fa-building"></i>
                </div>
                <div>
                    <span class="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">${b.category || 'Kota'}</span>
                    <h3 class="font-bold text-sm text-kauman-cream">${b.name}</h3>
                    <p class="text-[10px] text-gray-300">Kunjungi Lokasi</p>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Feed Sosial (Aman dari XSS menggunakan textContent)
async function submitSocialPost() {
    const text = document.getElementById('social-post-text').value;
    if(!text) return;

    if(!supabaseClient) {
        appendPostToDOM(localState.username, localState.role, text);
        document.getElementById('social-post-text').value = '';
        alert('Postingan terkirim (Mode Demo).');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('posts')
            .insert([{ user_id: currentUser.id, content: text }]);
        if(error) throw error;

        document.getElementById('social-post-text').value = '';
        fetchSocialFeed();
        alert('Postingan berhasil dikirim!');
    } catch(err) {
        alert('Gagal mengirim postingan: ' + err.message);
    }
}

async function fetchSocialFeed() {
    if(!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('posts')
        .select('content, created_at, profiles(username, role)')
        .order('created_at', { ascending: false })
        .limit(10);

    if(!error && data) {
        const container = document.getElementById('feed-container');
        container.innerHTML = '';
        data.forEach(p => {
            const author = p.profiles ? p.profiles.username : 'Warga';
            const role = p.profiles && p.profiles.role === 'mayor' ? 'Wali Kota' : 'Warga';
            appendPostToDOM(author, role, p.content);
        });
    }
}

function appendPostToDOM(author, role, content) {
    const container = document.getElementById('feed-container');
    const div = document.createElement('div');
    div.className = 'bg-kauman-900/50 p-2.5 rounded-xl border border-kauman-gold/20';

    const pAuthor = document.createElement('p');
    pAuthor.className = 'font-bold text-kauman-gold text-[11px]';
    pAuthor.textContent = '@' + author + ' ';

    const spanRole = document.createElement('span');
    spanRole.className = 'text-gray-400 font-normal';
    spanRole.textContent = '• ' + role;
    pAuthor.appendChild(spanRole);

    const pContent = document.createElement('p');
    pContent.className = 'text-gray-200 text-[11px] mt-1';
    pContent.textContent = content; // Mencegah XSS secara total

    div.appendChild(pAuthor);
    div.appendChild(pContent);
    container.prepend(div);
}

// Inisialisasi awal
updateUIState();
