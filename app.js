// KENDİ SUPABASE BİLGİLERİNİ BURAYA GİR
const SUPABASE_URL = 'https://mpqncrkclcprjmaohpgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0TPVUMiQ0_5zLkzhcEe4yQ_xsDSIaF4';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let bookInstance = null; // 3D kitap objesi
let currentUser = null; // Giriş yapan kullanıcı bilgisi
let currentBookYear = null; // Aktif olan defterin yılı

// Sayfa Çevirme Sesi
const flipSound = new Audio('https://www.soundjay.com/misc/sounds/page-flip-01a.mp3');
flipSound.volume = 0.5;

document.addEventListener('DOMContentLoaded', async () => {
    
    // İlk açılışta oturumu kontrol et (Giriş kaydını hatırla)
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        showLogin();
    }

    // Oturum durumunu arka planda dinle
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
        
        try {
            if (bookInstance) {
                bookInstance.destroy(); // Kitabı temizle
                bookInstance = null;
            }
        } catch (e) {
            console.log("Kitap temizlenirken hata oluştu:", e);
        }
        
        // İKİNCİ AÇILIŞ HATASINA KESİN ÇÖZÜM:
        // Eski book alanını (eğer kütüphane silmediyse) biz siliyoruz.
        const oldBook = document.getElementById('book');
        if (oldBook) oldBook.remove();
        
        const wrapper = document.querySelector('.stf__wrapper');
        if (wrapper) wrapper.remove();

        // Yerine her durumda SIFIR kilometre bir book alanı oluşturup ekliyoruz!
        const newBook = document.createElement('div');
        newBook.id = 'book';
        const nextBtn = document.getElementById('next-page-btn');
        if (nextBtn) nextBtn.parentNode.insertBefore(newBook, nextBtn);
    });
    
    // Sticker Ekleme İşlemleri
    document.querySelectorAll('.sticker-btn').forEach(btn => {
        btn.addEventListener('click', addStickerToPage);
    });

    // Ok Butonlarıyla Sayfa Çevirme
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (bookInstance) bookInstance.flipPrev();
    });
    document.getElementById('next-page-btn').addEventListener('click', () => {
        if (bookInstance) bookInstance.flipNext();
    });

    // Klavyedeki Ok Tuşlarıyla Sayfa Çevirme (Sol / Sağ)
    document.addEventListener('keydown', (e) => {
        if (bookInstance && !document.getElementById('book-wrapper').classList.contains('hidden')) {
            if (e.key === 'ArrowRight') {
                bookInstance.flipNext();
            } else if (e.key === 'ArrowLeft') {
                bookInstance.flipPrev();
            }
        }
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
    
    currentBookYear = year; // İşlem yapılan yılı global olarak kaydet

    // Yüklenme Ekranını Göster, Kitabı Gizle
    document.getElementById('book-loader').style.display = 'flex';
    document.querySelector('.book-controls').style.opacity = '0';

    const bookDiv = document.getElementById('book');

    // 1. HTML oluşturma (Sayfa indekslerini data-page-index ile güvenli şekilde HTML'e gömüyoruz)
    let bookHtml = `<div class="page cover-page" data-page-index="0" data-density="hard"><div class="cover-content"><h2>${year} Günlüğüm</h2></div></div>`;
    let pageCount = 1; // Kapak eklendi

    // Fotoğrafları 2'şerli olarak sayfalara böl
    const photosPerPage = 2;
    for (let i = 0; i < data.length; i += photosPerPage) {
        const pagePhotos = data.slice(i, i + photosPerPage);
        bookHtml += `<div class="page" data-page-index="${pageCount}">`;
        
        pagePhotos.forEach((entry, index) => {
            const dateObj = new Date(entry.photo_date);
            const formattedDate = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
            
            // Dağınık görünüm için rastgele açılar ve konumlar
            const randomRotate = Math.floor(Math.random() * 14) - 7; // -7 ile 7 derece arası
            const topPos = index === 0 ? Math.floor(Math.random() * 6) + 4 : Math.floor(Math.random() * 6) + 52; // Üstte veya altta
            const leftPos = Math.floor(Math.random() * 12) + 10; // %10 ile %22 arası sol boşluk
            
            const titleHtml = entry.title ? `<div class="photo-title">${entry.title}</div>` : '';

            bookHtml += `
                <div class="photo-container" style="top: ${topPos}%; left: ${leftPos}%; transform: rotate(${randomRotate}deg);">
                    <div class="tape"></div>
                    <img src="${entry.image_url}" alt="Anı">
                    ${titleHtml}
                    <div class="photo-date">${formattedDate}</div>
                    <button class="delete-photo-btn" onclick="deletePhoto(${entry.id}, '${entry.image_url}')" title="Bu anıyı sil">🗑️</button>
                </div>
            `;
        });
        
        bookHtml += `</div>`;
        pageCount++;
    }

    // 3D Kütüphane Kuralları: Toplam sayfa sayısı ÇİFT olmalı VE minimum 4 sayfa olmalı!
    while ((pageCount + 1) % 2 !== 0 || (pageCount + 1) < 4) {
        bookHtml += `<div class="page" data-page-index="${pageCount}" data-density="soft" style="display:flex; justify-content:center; align-items:center; color:#999; font-family:'Kalam', cursive;"><h3>- Boş Sayfa -</h3></div>`;
        pageCount++;
    }

    // Arka kapak (Yine data-density="hard" zorunlu)
    bookHtml += `<div class="page cover-page" data-page-index="${pageCount}" data-density="hard"><div class="cover-content"><h2>Son</h2></div></div>`;

    // Tüm sayfaları tek seferde DOM'a yazdır
    bookDiv.innerHTML = bookHtml;

    // 2. Stickerları Veritabanından Çek ve Sayfalara Yerleştir
    const { data: stickerData } = await supabaseClient
        .from('stickers')
        .select('*')
        .eq('year', year);

    if (stickerData) {
        const pages = bookDiv.querySelectorAll('.page');
        stickerData.forEach(st => {
            const targetPage = Array.from(pages).find(p => parseInt(p.dataset.pageIndex) === st.page_index);
            if (targetPage) {
                const sticker = buildStickerDOM(st.id, st.emoji, st.left_pos, st.top_pos, st.page_index);
                targetPage.appendChild(sticker);
            }
        });
    }

    // 3D Kitap Animasyonunu Başlat 
    setTimeout(() => {
        try {
            bookInstance = new St.PageFlip(bookDiv, {
                width: 400, // Sayfa genişliği
                height: 500, // Sayfa yüksekliği
                size: "fixed", // Sabit boyutlandırma
                drawShadow: true, // Sayfa kıvrılma gölgesi
                showCover: true, // İlk ve son sayfanın kapak gibi davranması
                usePortrait: false, // Mobilde dikey yerine her zaman kitap görünümü
                useMouseEvents: false // TIKLAYARAK VEYA SÜRÜKLEYEREK ÇEVİRMEYİ KAPATIR (Sadece oklar)
            });

            bookInstance.loadFromHTML(bookDiv.querySelectorAll('.page'));
            
            // Ses efektini sayfaya bağla
            bookInstance.on('flip', () => {
                flipSound.currentTime = 0;
                flipSound.play().catch(e => console.log('Ses engellendi', e));
            });

            // Kitap hazır olunca Yükleme Ekranını gizle
            setTimeout(() => {
                document.getElementById('book-loader').style.display = 'none';
                document.querySelector('.book-controls').style.opacity = '1';
            }, 500); // Yarım saniye derlenmesi için süre tanı

        } catch (e) {
            console.error("Kitap Yükleme Hatası:", e);
            showToast("Kitap animasyonu başlatılamadı!", "error");
        }
    }, 150); // 150ms güvenli bekleme süresi
}

// 3. Yeni Fotoğraf Yükleme İşlemi
async function uploadPhoto() {
    const fileInput = document.getElementById('file-input');
    const titleInput = document.getElementById('title-input').value.trim();
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
        .insert([{ image_url: imageUrl, year: selectedYear, photo_date: dateInput, title: titleInput || null }]);

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

// 4. Fotoğraf Silme İşlemi
async function deletePhoto(id, imageUrl) {
    if (!confirm("Bu anıyı tamamen silmek istediğine emin misin?")) return;

    // Supabase Veritabanından Sil
    const { error: dbError } = await supabaseClient.from('diary_entries').delete().eq('id', id);
    if (dbError) return showToast("Fotoğraf silinirken hata oluştu.", "error");

    // Storage'dan (Depolamadan) Sil (Temizlik için)
    const fileName = imageUrl.split('/').pop();
    await supabaseClient.storage.from('photos').remove([fileName]);

    showToast("Anı başarıyla günlüğünden silindi.", "success");
    
    // Kitabı kapat ve klasörleri yenile
    document.getElementById('close-book-btn').click(); 
    loadFolders();
}

// --- STICKER YÖNETİMİ MANTIĞI ---

// Mevcut veya Yeni Sticker'ın HTML Yapısını ve Olaylarını Oluşturan Fonksiyon
function buildStickerDOM(id, emoji, left, top, pageIndex) {
    const sticker = document.createElement('div');
    sticker.className = 'sticker';
    sticker.innerText = emoji;
    sticker.style.left = left;
    sticker.style.top = top;
    sticker.dataset.id = id;

    let offsetX = 0, offsetY = 0;

    sticker.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        const rect = sticker.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        sticker.style.zIndex = 1000;

        const onMouseMove = (event) => {
            const elementUnderCursor = document.elementFromPoint(event.clientX, event.clientY);
            if (!elementUnderCursor) return;

            const newParentPage = elementUnderCursor.closest('.page');
            if (newParentPage && newParentPage !== sticker.parentElement) {
                newParentPage.appendChild(sticker);
            }
            
            const parentRect = sticker.parentElement.getBoundingClientRect();
            let newLeft = ((event.clientX - parentRect.left - offsetX) / parentRect.width) * 100;
            let newTop = ((event.clientY - parentRect.top - offsetY) / parentRect.height) * 100;
            
            sticker.style.left = `${newLeft}%`;
            sticker.style.top = `${newTop}%`;
        };

        const onMouseUp = async () => {
            sticker.style.zIndex = 50;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Yeni sayfa indeksini bul ve Supabase Veritabanını Güncelle
            const newParentPage = sticker.closest('.page');
            const newPageIndex = newParentPage ? parseInt(newParentPage.dataset.pageIndex) : pageIndex;

            await supabaseClient.from('stickers').update({
                left_pos: sticker.style.left,
                top_pos: sticker.style.top,
                page_index: newPageIndex
            }).eq('id', sticker.dataset.id);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Çift Tıklayarak Veritabanından ve Ekrandan Silme
    sticker.addEventListener('dblclick', async () => {
        sticker.remove();
        await supabaseClient.from('stickers').delete().eq('id', sticker.dataset.id);
        showToast("Sticker kalıcı olarak silindi!", "success");
    });

    return sticker;
}

// Yeni Sticker Eklenmesi İşlemi
async function addStickerToPage(e) {
    if (!bookInstance || !currentBookYear) return;
    
    // Hangi sayfanın açık olduğunu bul
    const activeIndex = bookInstance.getCurrentPageIndex();
    const pages = document.querySelectorAll('#book .page');
    const currentPage = pages[activeIndex];
    if (!currentPage) return;

    const emoji = e.target.innerText;
    const left_pos = '30%'; 
    const top_pos = '30%';

    // Önce Supabase'e Kaydet ki ID'sini alabilelim
    const { data, error } = await supabaseClient.from('stickers').insert([{
        year: currentBookYear,
        page_index: parseInt(currentPage.dataset.pageIndex),
        emoji: emoji,
        left_pos: left_pos,
        top_pos: top_pos
    }]).select();

    if (error || !data || data.length === 0) {
        return showToast("Sticker kaydedilirken hata oluştu!", "error");
    }
    
    // Başarılı olursa Sticker'ı Ekrandaki Sayfaya Yerleştir
    const newSticker = buildStickerDOM(data[0].id, emoji, left_pos, top_pos, data[0].page_index);
    currentPage.appendChild(newSticker);
    
    showToast("Sticker eklendi! Otomatik KAYDEDİLİR. Çift tıklayarak silebilirsin.", "success");
}
