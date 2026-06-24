# Test Plan: PrivacyBounty Contract

## Lingkungan Test

- **Network:** Hardhat local / CratD2C Testnet (Chain ID: 1979)
- **Solidity:** 0.8.19
- **Framework:** Hardhat 3

---

## Test Cases

### 1. Happy Path — Commit & Reveal Sukses

**Tujuan:** Memastikan flow normal berjalan dengan benar

**Langkah:**
1. Deploy contract
2. Owner buat bounty: `createBounty("Apa ibu kota Indonesia?", 3600)`
3. Peserta generate hash: `keccak256("Jakarta" + salt + address + bountyId)`
4. Peserta submit: `submitCommitment(0, hash)`
5. Tunggu deadline (atau manipulasi `block.timestamp` di test)
6. Peserta reveal: `revealAnswer(0, "Jakarta", salt)`
7. Cek `commitments[0][address].valid == true`

**Expected:** `valid = true`, jawaban tersimpan

---

### 2. Reveal dengan Jawaban Salah

**Tujuan:** Memastikan hash tidak cocok ditolak

**Langkah:**
1. Peserta commit hash dari jawaban "Jakarta"
2. Peserta coba reveal dengan jawaban "Surabaya"
3. Cek hasil `valid`

**Expected:** `valid = false` — hash tidak cocok

---

### 3. Reveal Sebelum Deadline

**Tujuan:** Memastikan reveal tidak bisa dilakukan sebelum deadline

**Langkah:**
1. Buat bounty dengan duration 1 jam
2. Langsung coba `revealAnswer` tanpa menunggu
3. Cek apakah revert terjadi

**Expected:** Transaction revert dengan pesan `"Belum waktunya reveal"`

---

### 4. Commit Setelah Deadline

**Tujuan:** Memastikan commit tidak bisa setelah deadline

**Langkah:**
1. Buat bounty
2. Maju waktu melewati deadline
3. Coba `submitCommitment`

**Expected:** Transaction revert dengan pesan `"Deadline sudah lewat"`

---

### 5. Double Commit

**Tujuan:** Mencegah peserta commit dua kali

**Langkah:**
1. Peserta commit pertama kali (sukses)
2. Peserta coba commit kedua kali

**Expected:** Transaction revert dengan pesan `"Sudah commit"`

---

### 6. Double Reveal

**Tujuan:** Mencegah peserta reveal dua kali

**Langkah:**
1. Peserta commit
2. Peserta reveal pertama (sukses)
3. Peserta coba reveal kedua

**Expected:** Transaction revert dengan pesan `"Sudah reveal"`

---

### 7. Reveal Tanpa Commit

**Tujuan:** Memastikan hanya yang sudah commit bisa reveal

**Langkah:**
1. Peserta baru (yang belum commit) coba `revealAnswer`

**Expected:** Transaction revert dengan pesan `"Belum commit"`

---

### 8. Finalize Setelah Judging

**Tujuan:** Memastikan pemenang tersimpan dengan benar

**Langkah:**
1. Beberapa peserta commit & reveal
2. Owner panggil `judgeAll` untuk lihat semua jawaban
3. Owner panggil `finalizeWinner(0, 1)` (index pemenang = 1)
4. Cek `bounties[0].winner` dan `bounties[0].finalized`

**Expected:** `winner = address peserta index 1`, `finalized = true`

---

### 9. Double Finalize

**Tujuan:** Mencegah pemenang diubah setelah finalized

**Langkah:**
1. Finalize pemenang (sukses)
2. Coba finalize lagi dengan index berbeda

**Expected:** Transaction revert dengan pesan `"Sudah finalized"`

---

### 10. Non-Owner Akses Fungsi Terbatas

**Tujuan:** Memastikan access control berjalan

**Langkah:**
1. Akun bukan owner coba `createBounty`
2. Akun bukan owner coba `finalizeWinner`

**Expected:** Transaction revert dengan pesan `"Bukan owner"`

---

## Cara Jalankan Test

```bash
npx hardhat test
```

Untuk coverage:
```bash
npx hardhat coverage
```

---

## Checklist Sebelum Mainnet

- [ ] Semua 10 test case lulus
- [ ] Tidak ada reentrancy vulnerability
- [ ] Salt entropy cukup (minimal 32 bytes random)
- [ ] Private key tidak ter-expose di code
- [ ] Contract sudah diverifikasi di block explorer
