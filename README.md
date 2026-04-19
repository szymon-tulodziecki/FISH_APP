# FishLog

Mobilny dziennik połowów zbudowany w Expo (React Native) z backendem Supabase.

## Demo

**[fishlog-mauve.vercel.app](https://fishlog-mauve.vercel.app)**

## Stack

| Warstwa | Technologia |
|---|---|
| Mobile / Web | Expo SDK 54 · React Native |
| Routing | Expo Router |
| Backend / Auth | Supabase (PostgreSQL + Auth + Storage) |
| State | Zustand |
| Ikony | `@expo/vector-icons` (Feather + MaterialCommunityIcons) |
| Zdjęcia | Supabase Storage — bucket `FISH_BUCKET` |
| Deploy web | Vercel |

## Funkcje

- Logowanie i rejestracja (Supabase Auth)
- Dodawanie i edycja połowów (gatunek, waga, długość, łowisko, przynęta, ocena, notatki)
- Zdjęcie ryby — upload do Supabase Storage
- Personal Record (PR) per gatunek — automatycznie oznaczany złotym banerem
- Historia połowów danego gatunku z rankingiem wagowym
- Statystyki — łącznie, w tym roku, rekordy osobiste, najczęściej łowione gatunki
- Wyszukiwanie i sortowanie (data / waga)
- Safe Area — działa poprawnie z notchem / Dynamic Island na iPhone

## Struktura projektu

```
FISH/
├── my-app/                  # Aplikacja Expo
│   ├── src/
│   │   ├── app/             # Expo Router (layout)
│   │   ├── components/
│   │   │   └── fishlog/     # CatchCard, StatusBadge, StarRating, ikony
│   │   ├── screens/
│   │   │   └── fishlog/     # AddCatch, CatchDetail, Stats, Auth
│   │   ├── store/           # Zustand store
│   │   ├── lib/             # Klient Supabase
│   │   └── utils/           # Stałe, kolory, formatowanie dat
│   └── .env                 # Zmienne środowiskowe (nie commitować!)
├── db.sql                   # Pełny schemat bazy + storage + dane testowe
└── README.md
```

## Uruchomienie lokalne

```bash
cd my-app
npm install
# uzupełnij .env (patrz niżej)
npx expo start
```

Zeskanuj QR kod w **Expo Go** (iOS / Android).

## Konfiguracja Supabase

**1.** Wklej `db.sql` w **Supabase Dashboard → SQL Editor → Run**

Skrypt tworzy:
- tabelę `catches` z RLS
- bucket `FISH_BUCKET` z policies dla uploadu zdjęć

**2.** Uzupełnij `my-app/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Deploy web (Vercel)

```bash
cd my-app
npx expo export -p web
npx vercel deploy dist --yes
```
