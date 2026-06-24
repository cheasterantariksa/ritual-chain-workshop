// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PrivacyBounty {

    // ═══════════════════════════════════
    // STRUKTUR DATA
    // ═══════════════════════════════════

    struct Bounty {
        string question;        // pertanyaan bounty
        uint256 deadline;       // batas waktu commit
        bool finalized;         // sudah ada pemenang?
        address winner;         // alamat pemenang
    }

    struct Commitment {
        bytes32 commitHash;     // hash jawaban (disimpan saat commit)
        string answer;          // jawaban asli (diisi saat reveal)
        bool revealed;          // sudah reveal?
        bool valid;             // hash cocok?
    }

    // ═══════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => address[]) public bountyParticipants;
    mapping(uint256 => mapping(address => Commitment)) public commitments;
    uint256 public bountyCount;
    address public owner;

    // ═══════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════

    event BountyCreated(uint256 bountyId, string question, uint256 deadline);
    event CommitmentSubmitted(uint256 bountyId, address participant);
    event AnswerRevealed(uint256 bountyId, address participant);
    event WinnerFinalized(uint256 bountyId, address winner);

    // ═══════════════════════════════════
    // MODIFIER
    // ═══════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Bukan owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ═══════════════════════════════════
    // FUNGSI UTAMA
    // ═══════════════════════════════════

    // Buat bounty baru
    function createBounty(string calldata question, uint256 durationSeconds) external onlyOwner {
        uint256 id = bountyCount++;
        bounties[id] = Bounty({
            question: question,
            deadline: block.timestamp + durationSeconds,
            finalized: false,
            winner: address(0)
        });
        emit BountyCreated(id, question, bounties[id].deadline);
    }

    // FASE 1: Submit commitment hash
    function submitCommitment(uint256 bountyId, bytes32 commitment) external {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp < b.deadline, "Deadline sudah lewat");
        require(commitments[bountyId][msg.sender].commitHash == bytes32(0), "Sudah commit");

        commitments[bountyId][msg.sender].commitHash = commitment;
        bountyParticipants[bountyId].push(msg.sender);

        emit CommitmentSubmitted(bountyId, msg.sender);
    }

    // FASE 2: Reveal jawaban asli + salt
    function revealAnswer(uint256 bountyId, string calldata answer, bytes32 salt) external {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp >= b.deadline, "Belum waktunya reveal");
        require(!b.finalized, "Sudah finalized");

        Commitment storage c = commitments[bountyId][msg.sender];
        require(c.commitHash != bytes32(0), "Belum commit");
        require(!c.revealed, "Sudah reveal");

        // Verifikasi: hash(answer + salt + sender + bountyId) harus cocok
        bytes32 expectedHash = keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId));
        c.revealed = true;
        c.answer = answer;
        c.valid = (expectedHash == c.commitHash);

        emit AnswerRevealed(bountyId, msg.sender);
    }

    // FASE 3: Judge semua jawaban (dipanggil setelah AI judging off-chain)
    function judgeAll(uint256 bountyId, bytes calldata llmInput) external view returns (address[] memory, string[] memory) {
        address[] memory participants = bountyParticipants[bountyId];
        string[] memory answers = new string[](participants.length);

        for (uint256 i = 0; i < participants.length; i++) {
            Commitment storage c = commitments[bountyId][participants[i]];
            if (c.valid) {
                answers[i] = c.answer;
            }
        }
        return (participants, answers);
    }

    // Finalize pemenang
    function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external onlyOwner {
        Bounty storage b = bounties[bountyId];
        require(!b.finalized, "Sudah finalized");

        address winner = bountyParticipants[bountyId][winnerIndex];
        b.winner = winner;
        b.finalized = true;

        emit WinnerFinalized(bountyId, winner);
    }

    // ═══════════════════════════════════
    // HELPER: generate commitment hash
    // ═══════════════════════════════════

    function generateCommitment(string calldata answer, bytes32 salt) external view returns (bytes32) {
        return keccak256(abi.encodePacked(answer, salt, msg.sender, uint256(0)));
    }
}