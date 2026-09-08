# Secure Chat Application

A web-based secure chat application with **self-destructing messages**, built as a final-year undergraduate cybersecurity project.

## Highlights

- End-to-end encryption (hybrid RSA/ECC key exchange + AES-256-GCM)
- Self-destructing messages (timer-based and read-based)
- Argon2 password hashing, JWT sessions, TOTP 2FA
- Role-Based Access Control (RBAC)
- Encrypted file sharing with time-limited access
- Real-time messaging (Socket.IO)
- Server treated as untrusted intermediary (ciphertext-only storage)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Node.js + Express |
| Real-Time | Socket.IO |
| Database / Storage | Supabase (PostgreSQL + Storage) |
| Security | Argon2, JWT, TOTP, AES-256-GCM, RSA/ECC, TLS 1.3 |

> **Important:** This project implements the hybrid RSA/ECC + AES-256-GCM design described in the project documentation. It is **not** a full Signal Protocol implementation.

## Development Approach

Strictly **phase-by-phase**, with tests and user approval required before each next phase.

See [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for the full plan and phase checklist.

## Getting Started

See individual phase guides as they are developed. Environment requirements are listed in `.env.example`.

## Branch Workflow

```text
main   <- stable, approved work only
develop <- integration branch
feature/<phase> <- active work branches
```

## License

Final-year academic project.
