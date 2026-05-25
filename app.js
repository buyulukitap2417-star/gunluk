// KENDİ SUPABASE BİLGİLERİNİ BURAYA GİR
const SUPABASE_URL = 'https://mpqncrkclcprjmaohpgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0TPVUMiQ0_5zLkzhcEe4yQ_xsDSIaF4';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let bookInstance = null; // 3D kitap objesi
let currentUser = null; // Giriş yapan kullanıcı bilgisi

document.addEventListener('DOMContentLoaded', () => {
    // Oturum durumunu dinle
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            currentUser = session.user;
            showApp();
        } else {
            currentUser = null;
            showLogin();
        }
    });

    // Giriş Yapma İşlemi
    document.getElementById('login-btn').addEventListener('click', async () => {
        const email = document.getElementById('email-input').value;
        const password = document.getElementById('password-input').value;
        
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            showToast("Giriş başarısız: Bilgilerinizi kontrol edin.", "error");
        }
    });

    // Çıkış Yapma İşlemi
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
    });
    
    // Yükleme Butonu İşlemi
    document.getElementById('upload-btn').addEventListener('click', uploadPhoto);
    
    // Kitabı Kapatma Butonu İşlemi
    document.getElementById('close-book-btn').addEventListener('click', () => {
        document.getElementById('book-wrapper').classList.add('hidden');
        document.getElementById('app-section').classList.remove('hidden');
        if (bookInstance) {
            bookInstance.destroy(); // Kitabı temizle
            bookInstance = null;
        }
        document.getElementById('book').innerHTML = ''; // HTML'i temizle
    });
    
    // Sticker Ekleme İşlemleri
    document.querySelectorAll('.sticker-btn').forEach(btn => {
        btn.addEventListener('click', addStickerToPage);
    });
});

// Arayüz Geçiş Fonksiyonları
function showApp() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('app-section').classList.remove('hidden');
    loadFolders(); // Giriş yapınca klasörleri getir
}

function showLogin() {
    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('login-section').classList.add('active');
}

// Uyarı Bildirim (Toast) Fonksiyonu
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000); // 3 saniye sonra kaybolur
}

// 1. Klasörleri (Yılları) Supabase'den Çek
async function loadFolders() {
    const { data, error } = await supabaseClient
        .from('diary_entries')
        .select('year')
        .order('year', { ascending: false });

    if (error) return showToast('Klasörler yüklenirken hata oluştu.', 'error');

    // Tekrar eden yılları temizle (Sadece benzersiz yıllar klasör olacak)
    const uniqueYears = [...new Set(data.map(item => item.year))];
    const yearsList = document.getElementById('years-list');
    yearsList.innerHTML = '';

    uniqueYears.forEach(year => {
        const folder = document.createElement('div');
        folder.className = 'folder';
        folder.innerText = year;
        folder.onclick = () => openYearBook(year);
        yearsList.appendChild(folder);
    });
}

// 2. Bir klasöre tıklanınca o yılın fotoğraflarını getir ve kitabı oluştur
async function openYearBook(year) {
    const { data, error } = await supabaseClient
        .from('diary_entries')
        .select('*')
        .eq('year', year)
        .order('photo_date', { ascending: true }); // Tarihe göre kitap gibi okunur

    if (error) return showToast('Fotoğraflar çekilirken hata oluştu.', 'error');

    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('book-wrapper').classList.remove('hidden');

    const bookDiv = document.getElementById('book');
    bookDiv.innerHTML = '';

    // Kapak sayfası
    bookDiv.innerHTML += `<div class="page cover-page"><h2>${year} Günlüğüm</h2></div>`;

    // Fotoğrafları 2'şerli olarak sayfalara böl
    const photosPerPage = 2;
    for (let i = 0; i < data.length; i += photosPerPage) {
        const pagePhotos = data.slice(i, i + photosPerPage);
        let pageHtml = `<div class="page">`;
        
        pagePhotos.forEach((entry, index) => {
            const dateObj = new Date(entry.photo_date);
            const formattedDate = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
            
            // Dağınık görünüm için rastgele açılar ve konumlar
            const randomRotate = Math.floor(Math.random() * 14) - 7; // -7 ile 7 derece arası
            const topPos = index === 0 ? Math.floor(Math.random() * 6) + 4 : Math.floor(Math.random() * 6) + 52; // Üstte veya altta
            const leftPos = Math.floor(Math.random() * 12) + 10; // %10 ile %22 arası sol boşluk
            
            pageHtml += `
                <div class="photo-container" style="top: ${topPos}%; left: ${leftPos}%; transform: rotate(${randomRotate}deg);">
                    <div class="tape"></div>
                    <img src="${entry.image_url}" alt="Anı">
                    <div class="photo-date">${formattedDate}</div>
                </div>
            `;
        });
        
        pageHtml += `</div>`;
        bookDiv.innerHTML += pageHtml;
    }

    // Arka kapak
    bookDiv.innerHTML += `<div class="page cover-page"><h2>Son</h2></div>`;

    // 3D Kitap Animasyonunu Başlat
    bookInstance = new StPageFlip.PageFlip(bookDiv, {
        width: 400, // Sayfa genişliği
        height: 500, // Sayfa yüksekliği
        size: "fixed",
        minWidth: 300,
        maxWidth: 500,
        minHeight: 400,
        maxHeight: 600,
        drawShadow: true, // Sayfa kıvrılma gölgesi
        showCover: true, // İlk ve son sayfanın kapak gibi davranması
        usePortrait: false // Mobilde dikey yerine her zaman kitap görünümü
    });

    bookInstance.loadFromHTML(document.querySelectorAll('.page'));
}

// 3. Yeni Fotoğraf Yükleme İşlemi
async function uploadPhoto() {
    const fileInput = document.getElementById('file-input');
    const dateInput = document.getElementById('date-input').value;
    
    if (!fileInput.files.length || !dateInput) {
        showToast("Lütfen bir fotoğraf seçin ve tarih belirleyin!", "error");
        return;
    }

    // Tarihten yılı çıkar (Klasör ismi için)
    const selectedYear = new Date(dateInput).getFullYear();
    const file = fileInput.files[0];
    
    // Dosya adındaki boşluk ve özel karakterleri temizle (Sadece harf, rakam, nokta, tire ve altçizgi kalır)
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const fileName = `${Date.now()}_${cleanFileName}`;

    // Progress Bar Başlat
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '20%';

    // Supabase Storage'a görseli yükle
    const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from('photos')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        progressContainer.classList.add('hidden');
        return showToast('Yükleme hatası oluştu.', 'error');
    }
    progressBar.style.width = '60%';

    // Yüklenen görselin public URL'sini al
    const { data: publicUrlData } = supabaseClient.storage.from('photos').getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;
    progressBar.style.width = '80%';

    // Veritabanına kaydet
    const { error: dbError } = await supabaseClient
        .from('diary_entries')
        .insert([{ image_url: imageUrl, year: selectedYear, photo_date: dateInput }]);

    if (dbError) {
        showToast('Veritabanı kayıt hatası.', 'error');
    } else {
        progressBar.style.width = '100%';
        showToast("Anı başarıyla günlüğe eklendi!", "success");
        loadFolders(); // Klasörleri yenile
    }
    
    setTimeout(() => {
        progressContainer.classList.add('hidden');
        progressBar.style.width = '0%';
    }, 1500);
}

// --- STICKER (SÜSLEME) SÜRÜKLE BIRAK MANTIĞI ---
function addStickerToPage(e) {
    if (!bookInstance) return;
    
    // Hangi sayfanın açık olduğunu bul
    const activeIndex = bookInstance.getCurrentPageIndex();
    const pages = document.querySelectorAll('.page');
    if (!pages[activeIndex]) return;

    // O sayfaya sticker oluştur
    const sticker = document.createElement('div');
    sticker.className = 'sticker';
    sticker.innerText = e.target.innerText;
    sticker.style.left = '30%';
    sticker.style.top = '30%';
    
    // Sürükle bırak olayları
    let isDragging = false;
    sticker.addEventListener('mousedown', () => isDragging = true);
    document.addEventListener('mouseup', () => isDragging = false);
    document.addEventListener('mousemove', (event) => {
        if (isDragging) {
            const rect = sticker.parentElement.getBoundingClientRect();
            sticker.style.left = `${event.clientX - rect.left - 20}px`;
            sticker.style.top = `${event.clientY - rect.top - 20}px`;
        }
    });

    pages[activeIndex].appendChild(sticker);
    showToast("Sticker eklendi! İstediğin yere sürükleyebilirsin.", "success");
}
