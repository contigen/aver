// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

contract AverRegistry is Ownable2Step {
    error Unauthorized();
    error CertificateAlreadyExists();
    error CertificateNotFound();
    error CertificateNotActive();
    error InvalidCertificateData();
    error InvalidAddress();

    enum Mode {
        Observed,
        Locked
    }

    enum Status {
        Active,
        Breached,
        Revoked
    }

    enum EffectiveStatus {
        Unknown,
        Active,
        Breached,
        Revoked,
        Expired
    }

    struct Certificate {
        bytes32 holderCommitment;
        bytes32 evidenceHash;
        address token;
        uint128 threshold;
        uint64 windowSeconds;
        uint64 issuedAt;
        uint64 expiresAt;
        Mode mode;
        Status status;
        uint64 statusAt;
        uint64 evidenceBlock;
    }

    mapping(bytes32 => Certificate) public certs;
    mapping(address => bool) public isAttestor;
    uint64 public lastHeartbeat;

    event Issued(
        bytes32 indexed certId,
        address indexed token,
        bytes32 evidenceHash,
        uint128 threshold,
        Mode mode,
        uint64 expiresAt
    );
    event StatusChanged(bytes32 indexed certId, Status status, uint64 evidenceBlock);
    event Heartbeat(address indexed attestor, uint64 ts);
    event AttestorUpdated(address indexed attestor, bool status);

    modifier onlyAttestor() {
        if (!isAttestor[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address initialAttestor) Ownable(msg.sender) {
        if (initialAttestor == address(0)) revert InvalidAddress();
        isAttestor[initialAttestor] = true;
        emit AttestorUpdated(initialAttestor, true);
    }

    function issue(bytes32 certId, Certificate calldata c) external onlyAttestor {
        if (certs[certId].holderCommitment != bytes32(0)) revert CertificateAlreadyExists();
        if (c.holderCommitment == bytes32(0)) revert InvalidCertificateData();
        if (c.evidenceHash == bytes32(0)) revert InvalidCertificateData();
        if (c.token == address(0)) revert InvalidCertificateData();
        if (c.threshold == 0) revert InvalidCertificateData();
        if (c.expiresAt <= block.timestamp) revert InvalidCertificateData();
        if (c.issuedAt > block.timestamp) revert InvalidCertificateData();

        Certificate storage cert = certs[certId];
        cert.holderCommitment = c.holderCommitment;
        cert.evidenceHash = c.evidenceHash;
        cert.token = c.token;
        cert.threshold = c.threshold;
        cert.windowSeconds = c.windowSeconds;
        cert.issuedAt = c.issuedAt == 0 ? uint64(block.timestamp) : c.issuedAt;
        cert.expiresAt = c.expiresAt;
        cert.mode = c.mode;
        cert.status = Status.Active;
        cert.statusAt = uint64(block.timestamp);
        cert.evidenceBlock = 0;

        emit Issued(certId, c.token, c.evidenceHash, c.threshold, c.mode, c.expiresAt);
    }

    function markBreached(bytes32 certId, uint64 evidenceBlock) external onlyAttestor {
        if (evidenceBlock == 0) revert InvalidCertificateData();
        Certificate storage cert = certs[certId];
        if (cert.holderCommitment == bytes32(0)) revert CertificateNotFound();
        if (cert.status != Status.Active) revert CertificateNotActive();

        cert.status = Status.Breached;
        cert.statusAt = uint64(block.timestamp);
        cert.evidenceBlock = evidenceBlock;

        emit StatusChanged(certId, Status.Breached, evidenceBlock);
    }

    function revoke(bytes32 certId) external onlyAttestor {
        Certificate storage cert = certs[certId];
        if (cert.holderCommitment == bytes32(0)) revert CertificateNotFound();
        if (cert.status != Status.Active) revert CertificateNotActive();

        cert.status = Status.Revoked;
        cert.statusAt = uint64(block.timestamp);

        emit StatusChanged(certId, Status.Revoked, 0);
    }

    function beat() external onlyAttestor {
        lastHeartbeat = uint64(block.timestamp);
        emit Heartbeat(msg.sender, uint64(block.timestamp));
    }

    function statusOf(bytes32 certId) external view returns (EffectiveStatus) {
        Certificate memory cert = certs[certId];
        if (cert.holderCommitment == bytes32(0)) {
            return EffectiveStatus.Unknown;
        }
        if (cert.status == Status.Breached) {
            return EffectiveStatus.Breached;
        }
        if (cert.status == Status.Revoked) {
            return EffectiveStatus.Revoked;
        }
        if (block.timestamp >= cert.expiresAt) {
            return EffectiveStatus.Expired;
        }
        return EffectiveStatus.Active;
    }

    function setAttestor(address attestor, bool ok) external onlyOwner {
        if (attestor == address(0)) revert InvalidAddress();
        isAttestor[attestor] = ok;
        emit AttestorUpdated(attestor, ok);
    }
}
