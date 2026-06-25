import { createWalletClient, createPublicClient, http, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRequire } from "module";
import "dotenv/config";

const require = createRequire(import.meta.url);
const artifact = require("../artifacts/contracts/PrivacyBounty.sol/PrivacyBounty.json");

const ritualChain = {
  id: 1979,
  name: "CratD2C Testnet",
  nativeCurrency: { name: "CRAT", symbol: "CRAT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.ritualfoundation.org"] } },
};

const CONTRACT_ADDRESS = getAddress("0x95ce3fd33c803580b7f486f865042433043704fa");
const account = privateKeyToAccount(process.env.PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: ritualChain,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: ritualChain,
  transport: http(),
});

async function getNonce() {
  return await publicClient.getTransactionCount({ address: account.address });
}

async function main() {
  console.log("╔════════════════════════════════════╗");
  console.log("║     🎮 Bounty Simulator            ║");
  console.log("╚════════════════════════════════════╝");
  console.log("Deployer:", account.address);

  // STEP 1: Buat bounty
  console.log("\n📝 Step 1: Membuat bounty...");

  const { encodeFunctionData } = await import("viem");

  // Deadline harus berupa nilai yang DEKAT untuk testing,
  // supaya kita bisa benar-benar melewati deadline-nya dalam hitungan detik.
  // Sesuaikan submissionDelay/revealDelay di bawah ini dengan waktu tunggu
  // di Step 3 dan Step 5 (saat ini 15 detik & 30 detik).
  // 🔑 PENTING: chain ini (CratD2C Testnet) pakai block.timestamp dalam MILIDETIK,
  // bukan detik seperti EVM standar. Kontrak menghitung:
  //   deadline = block.timestamp(ms) + durasi_yang_dikirim
  // Jadi durasi yang kita kirim juga harus dalam MILIDETIK.
  const submissionDuration = BigInt(15000);  // 15 detik (dalam ms)
  const revealDuration = BigInt(45000);      // 45 detik (dalam ms)

  const data = encodeFunctionData({
    abi: artifact.abi,
    functionName: "createBounty",
    args: [
      "Apa keunggulan utama teknologi blockchain dibanding database tradisional?",
      submissionDuration,
      revealDuration,
    ],
  });

  const hash1 = await walletClient.sendTransaction({
    to: CONTRACT_ADDRESS,
    data: data,
    value: BigInt("1000000000000000"),
    nonce: await getNonce(),
  });

  console.log("TX:", hash1);
  await publicClient.waitForTransactionReceipt({ hash: hash1 });

  // PENTING: jangan hardcode bountyId.
  // Ambil ID bounty yang BARU SAJA dibuat dengan baca bountyCount setelah create.
  const bountyCount = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "bountyCount",
  });
  const bountyId = bountyCount - BigInt(1); // ID terakhir = count - 1
  console.log(`✅ Bounty dibuat! (bountyId: ${bountyId})`);

  // 🔍 DEBUG: baca langsung data bounty dari kontrak untuk cek deadline sebenarnya
  const bountyData = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "bounties",
    args: [bountyId],
  });
  console.log("🔍 Data bounty tersimpan di chain:", bountyData);
  console.log("🔍 block.timestamp saat ini (kira-kira):", Math.floor(Date.now() / 1000));

  // STEP 2: Generate & submit commitment
  console.log("\n🔐 Step 2: Submit commitment...");

  const answer = "Blockchain unggul karena desentralisasi, transparansi, dan immutability data tanpa perlu pihak ketiga.";
  const salt = `0x${"ab".repeat(32)}`;

  const commitment = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "generateCommitment",
    args: [answer, salt, bountyId],
    account: account.address,
  });

  console.log("Commitment hash:", commitment);

  const hash2 = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "submitCommitment",
    args: [bountyId, commitment],
    nonce: await getNonce(),
  });

  console.log("TX:", hash2);
  await publicClient.waitForTransactionReceipt({ hash: hash2 });
  console.log("✅ Commitment submitted!");

  // STEP 3
  console.log("\n⏳ Step 3: Tunggu submission deadline (18 detik nyata)...");
  await new Promise(r => setTimeout(r, 18000));
  console.log("✅ Submission deadline lewat!");

  // STEP 4: Reveal jawaban
  console.log("\n🔓 Step 4: Reveal jawaban...");

  const hash3 = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "revealAnswer",
    args: [bountyId, answer, salt],
    nonce: await getNonce(),
  });

  console.log("TX:", hash3);
  await publicClient.waitForTransactionReceipt({ hash: hash3 });
  console.log("✅ Jawaban di-reveal!");

  // STEP 5
  console.log("\n⏳ Step 5: Tunggu reveal deadline (35 detik nyata lagi)...");
  await new Promise(r => setTimeout(r, 35000));
  console.log("✅ Reveal deadline lewat!");

  console.log("\n🚀 Sekarang jalankan:");
  console.log(`   node scripts/agent.js ${bountyId}`);
}

main().catch(console.error);