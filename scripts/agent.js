import {
  createWalletClient,
  createPublicClient,
  http,
  getAddress,
  encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createRequire } from "module";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const require = createRequire(import.meta.url);
const artifact = require("../artifacts/contracts/PrivacyBounty.sol/PrivacyBounty.json");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// ───────────────────────────────────────────
// AI Judge: minta Claude pilih jawaban terbaik
// ───────────────────────────────────────────
async function aiJudge(question, participants, answers) {
  // Bangun daftar kandidat HANYA dari yang punya jawaban valid (tidak kosong)
  const candidates = participants
    .map((addr, i) => ({ index: i, address: addr, answer: answers[i] }))
    .filter((c) => c.answer && c.answer.trim().length > 0);

  if (candidates.length === 0) {
    throw new Error("Tidak ada jawaban valid untuk di-judge");
  }

  const candidateList = candidates
    .map((c) => `Index ${c.index}: "${c.answer}"`)
    .join("\n");

  const prompt = `Pertanyaan bounty: "${question}"

Berikut adalah jawaban-jawaban dari peserta:
${candidateList}

Tugasmu: pilih SATU index jawaban TERBAIK berdasarkan kualitas, relevansi, dan kelengkapan jawaban terhadap pertanyaan.
Balas HANYA dengan angka index-nya saja (contoh: 0), tanpa teks lain.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 10,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.map((c) => c.text || "").join("").trim();
  const winnerIndex = parseInt(text.match(/\d+/)?.[0] ?? "-1", 10);

  if (isNaN(winnerIndex) || !candidates.find((c) => c.index === winnerIndex)) {
    throw new Error(`AI mengembalikan index tidak valid: "${text}"`);
  }

  return { winnerIndex, raw: text, candidates };
}

async function main() {
  if (process.argv[2] === undefined) {
    console.error("❌ Pakai: node scripts/agent.js <bountyId>");
    process.exit(1);
  }
  const bountyId = BigInt(process.argv[2]);

  console.log("╔════════════════════════════════════╗");
  console.log("║     🤖 AI Bounty Judge Agent       ║");
  console.log("╚════════════════════════════════════╝");
  console.log("Deployer:", account.address);
  console.log("Bounty ID:", bountyId.toString());

  // Ambil data bounty (untuk pertanyaan & status)
  const bountyData = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "bounties",
    args: [bountyId],
  });
  const question = bountyData[0];
  console.log("\n❓ Pertanyaan:", question);

  const status = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "getBountyStatus",
    args: [bountyId],
  });
  console.log("📊 Status (submission/reveal/judging/finalized):", status);

  if (!status[2]) {
    console.error("❌ Judging belum dibuka (reveal deadline belum lewat, atau sudah di-judge).");
    process.exit(1);
  }

  // STEP 1: Ambil jawaban valid
  console.log("\n📋 Step 1: Mengambil jawaban...");
  const [participants, answers] = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "getValidAnswers",
    args: [bountyId],
  });
  console.log("Peserta:", participants);
  console.log("Jawaban:", answers);

  // STEP 2: AI judging via Claude
  console.log("\n🧠 Step 2: AI menilai jawaban-jawaban...");
  const { winnerIndex, raw, candidates } = await aiJudge(question, participants, answers);
  console.log(`✅ AI memilih index: ${winnerIndex} (raw response: "${raw}")`);
  console.log("Pemenang terpilih:", candidates.find((c) => c.index === winnerIndex));

  // Encode llmInput sesuai abi.decode(llmInput, (uint256)) di kontrak
  const llmInput = encodeAbiParameters(
    [{ type: "uint256" }],
    [BigInt(winnerIndex)]
  );

  // STEP 3: Submit judgeAll
  console.log("\n⚖️  Step 3: Submit judgeAll on-chain...");
  const hashJudge = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "judgeAll",
    args: [bountyId, llmInput],
    nonce: await getNonce(),
  });
  console.log("TX:", hashJudge);
  await publicClient.waitForTransactionReceipt({ hash: hashJudge });
  console.log("✅ judgeAll selesai!");

  // STEP 4: Finalize winner
  console.log("\n🏆 Step 4: Finalize winner...");
  const hashFinalize = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "finalizeWinner",
    args: [bountyId, BigInt(winnerIndex)],
    nonce: await getNonce(),
  });
  console.log("TX:", hashFinalize);
  await publicClient.waitForTransactionReceipt({ hash: hashFinalize });
  console.log("✅ Winner difinalisasi & reward dibayarkan!");

  // STEP 5: Cek hasil akhir
  const finalBounty = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: artifact.abi,
    functionName: "bounties",
    args: [bountyId],
  });
  console.log("\n📄 Data bounty akhir:", finalBounty);
  console.log("🎉 Pemenang:", finalBounty[6]);
}

main().catch((err) => {
  console.error("❌ Error:", err.shortMessage || err.message || err);
  process.exit(1);
});