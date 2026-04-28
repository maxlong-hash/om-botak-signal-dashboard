# Om Botak Signal Radar

Dashboard interaktif untuk membaca export Telegram `result.json`, mengekstrak signal saham, lalu menampilkan radar trader: top ticker, signal stack, jam signal, kategori setup, heatmap intraday, dan tabel eksplorasi.

## Jalankan lokal

Cara paling mudah di Windows: double-click `buka-dashboard-opera.bat`.

Atau lewat terminal:

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`. Jangan double-click `index.html` langsung, karena browser biasanya memblokir pembacaan `public/data/result.json` dari mode `file://`.

## Update data harian

Ganti file ini setiap sore:

```text
public/data/result.json
```

Commit dan push ke GitHub. Vercel akan build ulang otomatis jika repository sudah terhubung.

## Deploy Vercel

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
