// KENDİ SUPABASE BİLGİLERİNİ BURAYA GİR
const SUPABASE_URL = 'https://mpqncrkclcprjmaohpgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0TPVUMiQ0_5zLkzhcEe4yQ_xsDSIaF4';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let bookInstance = null; // 3D kitap objesi
let currentUser = null; // Giriş yapan kullanıcı bilgisi

document.addEventListener('DOMContentLoaded', () => {
    // Oturum durumunu dinle
    supabase.auth.onAuthStateChange((event, session) => {
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
        const errorEl = document.getElementById('login-error');
        
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            errorEl.innerText = "Giriş başarısız: Bilgilerinizi kontrol edin.";
            errorEl.style.display = "block";
        }
    });

    // Çıkış Yapma İşlemi
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await supabase.auth.signOut();
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

// 1. Klasörleri (Yılları) Supabase'den Çek
async function loadFolders() {
    const { data, error } = await supabase
        .from('diary_entries')
        .select('year')
        .order('year', { ascending: false });

    if (error) return console.error('Veri çekme hatası:', error);

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
    const { data, error } = await supabase
        .from('diary_entries')
        .select('*')
        .eq('year', year)
        .order('created_at', { ascending: true }); // Eskiden yeniye doğru kitap gibi okunur

    if (error) return console.error('Fotoğraf çekme hatası:', error);

    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('book-wrapper').classList.remove('hidden');

    const bookDiv = document.getElementById('book');
    bookDiv.innerHTML = '';

    // Kapak sayfası
    bookDiv.innerHTML += `<div class="page"><h2>${year} Fotoğraf Günlüğüm</h2></div>`;

    // Fotoğrafları sayfa olarak ekle
    data.forEach(entry => {
        bookDiv.innerHTML += `
            <div class="page">
                <img src="${entry.image_url}" alt="Günlük Fotoğrafı">
            </div>
        `;
    });

    // Arka kapak
    bookDiv.innerHTML += `<div class="page"><h2>Son</h2></div>`;

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
    const yearInput = document.getElementById('year-input').value;
    
    if (!fileInput.files.length || !yearInput) {
        alert("Lütfen bir fotoğraf seçin ve yıl girin!");
        return;
    }

    const file = fileInput.files[0];
    const fileName = `${Date.now()}_${file.name}`;

    // Supabase Storage'a görseli yükle
    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('photos')
        .upload(fileName, file);

    if (uploadError) return console.error('Yükleme hatası:', uploadError);

    // Yüklenen görselin public URL'sini al
    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // Veritabanına kaydet
    const { error: dbError } = await supabase
        .from('diary_entries')
        .insert([{ image_url: imageUrl, year: parseInt(yearInput) }]);

    if (dbError) {
        console.error('Veritabanı kayıt hatası:', dbError);
    } else {
        alert("Fotoğraf başarıyla eklendi!");
        loadFolders(); // Klasörleri yenile
    }
}
