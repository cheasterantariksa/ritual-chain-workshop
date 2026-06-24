# Architecture Note: Privacy-Preserving AI Bounty Judge

## Gambaran Sistem

```
[Peserta]                [Blockchain]              [AI / Off-chain]
    |                        |                           |
    |-- submitCommitment --> |                           |
    |   (hanya hash)         |                           |
    |                        |                           |
    |     [deadline]         |                           |
    |                        |                           |
    |-- revealAnswer ------> |                           |
    |   (jawaban + salt)     |-- verifikasi hash         |
    |                        |-- simpan jawaban valid    |
    |                        |                           |
    |                        |-- judgeAll() -----------> |
    |                        |   (semua jawaban valid)   |-- AI scoring
    |                        |                           |-- pilih terbaik
    |                        | <-- winnerIndex ----------|
    |                        |                           |
    |                [finalizeWinner]                    |
    |                        |                           |
```

---

## Komponen Utama

### 1. Smart Contract (`PrivacyBounty.sol`)

**On-chain (tersimpan di blockchain):**
- Commitment hash setiap peserta (`bytes32`)
- Jawaban setelah reveal (`string`)
- Status valid/invalid setiap jawaban
- Pemenang final (`address`)
- Deadline dan status bounty

**Off-chain (tidak di blockchain):**
- Jawaban asli sebelum reveal
- Salt yang digunakan peserta
- Proses AI judging

---

### 2. Commit-Reveal Scheme

**Mengapa diperlukan?**
Tanpa commit-reveal, semua jawaban langsung terlihat publik. Peserta bisa membaca jawaban orang lain dan submit versi yang lebih baik.

**Cara kerja:**
```
commitment = keccak256(answer + salt + msg.sender + bountyId)
```

- `answer` = jawaban peserta
- `salt` = angka random 32 bytes (mencegah brute-force)
- `msg.sender` = alamat peserta (mencegah replay attack)
- `bountyId` = ID bounty (mencegah cross-bounty attack)

---

### 3. AI Judging Flow

**Input ke AI (via `judgeAll`):**
- Array alamat peserta
- Array jawaban valid yang sudah terungkap

**Proses AI (off-chain):**
- Semua jawaban dikirim sekaligus (batch judging)
- AI menilai berdasarkan kriteria bounty
- Mengembalikan index pemenang

**Keuntungan batch judging:**
- Lebih hemat gas (satu call, bukan N call)
- AI bisa membandingkan semua jawaban sekaligus
- Konsisten (model yang sama menilai semua jawaban)

---

### 4. Storage Design

```solidity
mapping(uint256 => Bounty) public bounties;
// bountyId => Bounty

mapping(uint256 => address[]) public bountyParticipants;
// bountyId => list peserta

mapping(uint256 => mapping(address => Commitment)) public commitments;
// bountyId => address => Commitment
```

---

### 5. Security Considerations

| Ancaman | Mitigasi |
|---------|----------|
| Menyontek jawaban | Commit-reveal scheme |
| Brute-force hash | Salt 32 bytes random |
| Replay attack | Address + bountyId dalam hash |
| Manipulasi pemenang | onlyOwner modifier |
| Double submission | Cek `commitHash != bytes32(0)` |
| Early reveal | Cek `block.timestamp >= deadline` |

---

### 6. Alur Data: Plaintext vs Encrypted

```
FASE COMMIT:
Peserta tahu:  "Jakarta" + salt
Blockchain tahu: 0x7f3a... (hash saja)
Publik melihat: hash — TIDAK TAHU jawabannya

FASE REVEAL:
Peserta kirim: "Jakarta" + salt
Blockchain verifikasi: hash("Jakarta" + salt + addr + id) == stored_hash?
Publik melihat: jawaban "Jakarta" — BARU TERUNGKAP

FASE JUDGING:
AI menerima: ["Jakarta", "Yogyakarta", "Bandung"] (semua jawaban valid)
AI memilih: index 0 ("Jakarta") sebagai jawaban terbaik
Blockchain simpan: pemenang = address peserta index 0
```

---

### 7. Trade-offs & Limitasi

**Keterbatasan saat ini:**
- `judgeAll` hanya view function — AI judging dilakukan off-chain
- Owner masih bisa memilih pemenang secara manual (trust issue)
- Tidak ada mekanisme dispute resolution

**Untuk Advanced Track (Ritual TEE):**
- Jawaban bisa tetap ter-enkripsi hingga AI selesai menilai
- Menggunakan Ritual's TEE untuk eksekusi AI yang dapat diverifikasi
- Eliminasi kebutuhan trust terhadap owner
