# Privacy-Preserving AI Bounty Judge

**Contract Address:** `0x36314c00a4957dd745f32879cab2ee9cb0033ede`  
**Network:** CratD2C Testnet (Chain ID: 1979)  
**Deploy TX:** `0x81e630369fb2860eae055b44c2e8be61d15a4f9fa3a28ae53dc606697ecf62ec`  
**Deployer:** `0x6211FA3141CED01C41Df998063a9F803Ad80C9fF`

---

## Overview

PrivacyBounty adalah smart contract commit-reveal yang memastikan jawaban peserta bounty tetap rahasia hingga proses judging selesai. Ini mencegah peserta menyontek atau mengkopi jawaban orang lain sebelum deadline.

---

## Lifecycle Contract

### Fase 1: Commit (Sebelum Deadline)

1. Owner membuat bounty baru dengan `createBounty(question, durationSeconds)`
2. Peserta meng-hash jawaban mereka: `keccak256(answer + salt + address + bountyId)`
3. Peserta submit hash via `submitCommitment(bountyId, commitment)`
4. **Hanya hash yang tersimpan on-chain — jawaban asli tetap rahasia**

### Fase 2: Reveal (Setelah Deadline)

1. Deadline tercapai (`block.timestamp >= deadline`)
2. Peserta reveal jawaban asli + salt via `revealAnswer(bountyId, answer, salt)`
3. Contract memverifikasi: `keccak256(answer + salt + sender + bountyId) == commitment`
4. Jawaban valid ditandai dan disimpan on-chain

### Fase 3: AI Judging

1. Owner/sistem memanggil `judgeAll(bountyId, llmInput)` untuk mengambil semua jawaban valid
2. Jawaban dikirim ke AI (LLM) untuk dinilai secara batch (bukan satu per satu)
3. AI menentukan pemenang berdasarkan kualitas jawaban
4. Owner memanggil `finalizeWinner(bountyId, winnerIndex)` untuk mengunci pemenang on-chain

---

## Fungsi Utama

| Fungsi | Siapa | Kapan |
|--------|-------|-------|
| `createBounty(question, duration)` | Owner | Sebelum semua |
| `submitCommitment(bountyId, hash)` | Peserta | Sebelum deadline |
| `revealAnswer(bountyId, answer, salt)` | Peserta | Setelah deadline |
| `judgeAll(bountyId, llmInput)` | Siapa saja (view) | Setelah reveal |
| `finalizeWinner(bountyId, winnerIndex)` | Owner | Setelah judging |
| `generateCommitment(answer, salt)` | Helper | Kapan saja |

---

## Keamanan

- Jawaban tidak bisa dilihat selama fase commit
- Salt mencegah brute-force attack terhadap hash
- Hanya jawaban yang berhasil diverifikasi yang masuk ke judging
- Pemenang dikunci permanen on-chain setelah finalized

---

## Setup & Deploy

```bash
git clone https://github.com/cheasterantariksa/ritual-chain-workshop
cd ritual-chain-workshop
npm install
cp .env.example .env  # isi PRIVATE_KEY
node scripts/deploy.js
```

---

## Reflection Question

*"What should be public, what should stay hidden, and what should be decided by AI versus by a human in a bounty system?"*

Dalam sistem bounty yang adil, **jawaban peserta harus tetap tersembunyi** selama fase submission untuk mencegah plagiarisme dan menjaga integritas kompetisi. Yang boleh publik hanyalah commitment hash, deadline, dan identitas pemenang setelah judging selesai. Proses **verifikasi hash dan logika commit-reveal harus on-chain** karena bersifat deterministik dan dapat diaudit siapapun. Penilaian kualitas jawaban sebaiknya **diserahkan ke AI** karena lebih objektif, cepat, dan konsisten untuk mengevaluasi banyak jawaban sekaligus. Namun, keputusan final seperti **menetapkan pemenang dan menangani sengketa tetap harus melibatkan manusia** — AI bisa bias atau membuat kesalahan dalam konteks tertentu. Manusia juga diperlukan untuk mendefinisikan kriteria penilaian yang tepat dan memastikan hasilnya adil. Kombinasi AI untuk efisiensi dan manusia untuk akuntabilitas adalah pendekatan terbaik dalam sistem bounty yang transparan dan dapat dipercaya.
