// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PrivacyBounty {

    // ═══════════════════════════════════
    // STRUKTUR DATA
    // ═══════════════════════════════════

    struct Bounty {
        string question;            // pertanyaan bounty
        uint256 submissionDeadline; // batas waktu commit
        uint256 revealDeadline;     // batas waktu reveal
        uint256 reward;             // hadiah dalam wei
        bool judged;                // sudah di-judge?
        bool finalized;             // sudah ada pemenang?
        address winner;             // alamat pemenang
        uint256 winnerIndex;        // index pemenang
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

    event BountyCreated(uint256 bountyId, string question, uint256 submissionDeadline, uint256 revealDeadline, uint256 reward);
    event CommitmentSubmitted(uint256 bountyId, address participant);
    event AnswerRevealed(uint256 bountyId, address participant, bool valid);
    event BountyJudged(uint256 bountyId, uint256 winnerIndex);
    event WinnerFinalized(uint256 bountyId, address winner, uint256 reward);

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

    // Buat bounty baru dengan reward
    function createBounty(
        string calldata question,
        uint256 submissionDuration,
        uint256 revealDuration
    ) external payable onlyOwner {
        require(msg.value > 0, "Reward harus lebih dari 0");
        require(submissionDuration > 0, "Submission duration harus lebih dari 0");
        require(revealDuration > 0, "Reveal duration harus lebih dari 0");

        uint256 id = bountyCount++;
        uint256 subDeadline = block.timestamp + submissionDuration;
        uint256 revDeadline = subDeadline + revealDuration;

        bounties[id] = Bounty({
            question: question,
            submissionDeadline: subDeadline,
            revealDeadline: revDeadline,
            reward: msg.value,
            judged: false,
            finalized: false,
            winner: address(0),
            winnerIndex: 0
        });

        emit BountyCreated(id, question, subDeadline, revDeadline, msg.value);
    }

    // FASE 1: Submit commitment hash (sebelum submissionDeadline)
    function submitCommitment(uint256 bountyId, bytes32 commitment) external {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp < b.submissionDeadline, "Submission deadline sudah lewat");
        require(commitments[bountyId][msg.sender].commitHash == bytes32(0), "Sudah commit");

        commitments[bountyId][msg.sender].commitHash = commitment;
        bountyParticipants[bountyId].push(msg.sender);

        emit CommitmentSubmitted(bountyId, msg.sender);
    }

    // FASE 2: Reveal jawaban (setelah submissionDeadline, sebelum revealDeadline)
    function revealAnswer(
        uint256 bountyId,
        string calldata answer,
        bytes32 salt
    ) external {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp >= b.submissionDeadline, "Belum waktunya reveal");
        require(block.timestamp < b.revealDeadline, "Reveal deadline sudah lewat");
        require(!b.finalized, "Bounty sudah finalized");

        Commitment storage c = commitments[bountyId][msg.sender];
        require(c.commitHash != bytes32(0), "Belum commit");
        require(!c.revealed, "Sudah reveal");

        // Verifikasi hash
        bytes32 expectedHash = keccak256(
            abi.encodePacked(answer, salt, msg.sender, bountyId)
        );
        
        c.revealed = true;
        c.answer = answer;
        c.valid = (expectedHash == c.commitHash);

        emit AnswerRevealed(bountyId, msg.sender, c.valid);
    }

    // FASE 3: Judge semua jawaban (setelah revealDeadline)
    function judgeAll(uint256 bountyId, bytes calldata llmInput) external onlyOwner {
        Bounty storage b = bounties[bountyId];
        require(block.timestamp >= b.revealDeadline, "Reveal deadline belum lewat");
        require(!b.judged, "Sudah di-judge");
        require(!b.finalized, "Sudah finalized");

        // Decode winnerIndex dari llmInput (hasil AI judging)
        uint256 winnerIndex = abi.decode(llmInput, (uint256));

        // Validasi winner index
        require(winnerIndex < bountyParticipants[bountyId].length, "Winner index tidak valid");
        require(
            commitments[bountyId][bountyParticipants[bountyId][winnerIndex]].valid,
            "Pemenang tidak punya jawaban valid"
        );

        b.judged = true;
        b.winnerIndex = winnerIndex;

        emit BountyJudged(bountyId, winnerIndex);
    }

    // FASE 4: Finalize pemenang dan kirim reward
    function finalizeWinner(uint256 bountyId, uint256 winnerIndex) external onlyOwner {
        Bounty storage b = bounties[bountyId];
        require(b.judged, "Belum di-judge");
        require(!b.finalized, "Sudah finalized");
        require(winnerIndex == b.winnerIndex, "Winner index tidak sesuai hasil judging");

        address winner = bountyParticipants[bountyId][winnerIndex];
        b.winner = winner;
        b.finalized = true;

        // Kirim reward ke pemenang
        (bool success, ) = payable(winner).call{value: b.reward}("");
        require(success, "Transfer reward gagal");

        emit WinnerFinalized(bountyId, winner, b.reward);
    }

    // ═══════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════

    // Ambil semua jawaban valid untuk AI judging
    function getValidAnswers(uint256 bountyId) 
        external 
        view 
        returns (address[] memory, string[] memory) 
    {
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

    // Cek status bounty
    function getBountyStatus(uint256 bountyId) 
        external 
        view 
        returns (
            bool isSubmissionOpen,
            bool isRevealOpen,
            bool isJudgingOpen,
            bool isFinalized
        ) 
    {
        Bounty storage b = bounties[bountyId];
        isSubmissionOpen = block.timestamp < b.submissionDeadline;
        isRevealOpen = block.timestamp >= b.submissionDeadline && 
                       block.timestamp < b.revealDeadline;
        isJudgingOpen = block.timestamp >= b.revealDeadline && !b.judged;
        isFinalized = b.finalized;
    }

    // Helper: generate commitment hash
    function generateCommitment(
        string calldata answer, 
        bytes32 salt,
        uint256 bountyId
    ) external view returns (bytes32) {
        return keccak256(abi.encodePacked(answer, salt, msg.sender, bountyId));
    }

    // Cek saldo contract
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
