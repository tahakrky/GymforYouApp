# GymForYou — Windows (.exe) ve Android (.apk) uygulaması

Uygulama iki parçadan oluşur: **arayüz** (uygulamanın içine gömülür) ve **backend + MongoDB** (internette bir yerde çalışmak zorunda).
Telefon ve bilgisayar aynı verileri görsün diye backend'in internette olması gerekir.

## 1) Backend'i yayınla (bir kere)

1. MongoDB Atlas'ta ücretsiz cluster aç, bağlantı adresini al.
2. `backend/` klasörünü Render / Railway / Fly.io gibi Docker destekleyen bir yere yükle (`backend/Dockerfile` hazır).
3. Ortam değişkenleri:

| Değişken | Değer |
|---|---|
| `MONGO_URL` | Atlas bağlantı adresin |
| `DB_NAME` | `gymforyou` |
| `JWT_SECRET` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` çıktısı |
| `CORS_ORIGINS` | `http://localhost:47631,https://localhost` |

4. Egzersiz kütüphanesi için bir kere `backend/.env` içine Atlas adresini yazıp `cd backend && python seed.py` çalıştır.
5. Sunucu adresini not al (örn. `https://gymforyou.onrender.com`).

## 2) Arayüzü uygulama için derle

```bash
cd frontend
copy .env.native.example .env.native      # içine kendi sunucu adresini yaz
yarn install
yarn build:native
```

## 3a) Windows kurulum dosyası (.exe)

```bash
cd desktop
npm install
npm run dist
```

Çıktı: `desktop/release/GymForYou Setup 1.0.0.exe`. Çift tıkla kur, masaüstü ve Başlat menüsüne kısayol ekler.
Hata alırsan terminali yönetici olarak aç ya da Windows'ta Geliştirici Modu'nu aç.
Denemek için kurmadan: `npm start`.

## 3b) Android APK

Bilgisayarında Android Studio (veya JDK 17 + Android SDK) gerekir:

```bash
cd mobile
npm install
npx cap add android
npm run icons
npx cap sync android
cd android
gradlew assembleDebug        # Mac/Linux: ./gradlew assembleDebug
```

Çıktı: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Telefona at, "bilinmeyen kaynaklardan yükle" izni ver, kur.

## Alternatif: Android Studio kurmadan, GitHub ile derle

1. Projeyi bir GitHub reposuna yükle.
2. Repo → Settings → Secrets and variables → Actions → **Variables** → `API_URL` = sunucu adresin.
3. Actions sekmesi → "Uygulamaları derle" → **Run workflow**.
4. Bitince sayfanın altındaki Artifacts'tan `.exe` ve `.apk` dosyalarını indir.

## Kodda ne değişti

- `frontend/src/lib/api.ts`: sunucu adresi ayarlanabilir, giriş artık token ile de çalışır (uygulama içinden çerez güvenilir değil).
- `backend/routers/auth.py`: giriş/kayıt `token` döner, `Authorization: Bearer` kabul edilir, `JWT_SECRET` ortam değişkeninden okunabilir.
- `frontend/vite.config.ts`: Emergent eklentileri kurulu değilse build çökmez.
- `backend/requirements.txt`: `emergentintegrations` yoruma alındı (kullanılmıyor, dışarıda pip'i bozuyor).
- Yeni: `desktop/` (Electron), `mobile/` (Capacitor), `.github/workflows/`, `backend/Dockerfile`.

## Sınırlar

- İnternet yoksa uygulama açılır ama veri gelmez.
- APK "debug" imzalı: kendi telefonlarında çalışır, Play Store'a yüklemek için ayrıca imzalamak gerekir.
- Bu ortamda internet olmadığı için derlemeyi burada çalıştıramadım; dosyaları söz dizimi olarak kontrol ettim ama ilk derlemede küçük bir hata çıkarsa bana yaz.
