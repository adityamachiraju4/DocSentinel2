# Phase 4 — Household Private Vault — Design Doc (v2)

**Status:** DRAFT v2 — household-first reframe, boundary under review, no code yet
**Owner:** Aditya (solo)
**Supersedes:** v1 (business-framed, per-document vault). Crypto spine unchanged; container model + recovery + labeling revised.
**Gate:** DPDP review before any Railway deploy.

---

## 0. What changed from v1, and why

v1 assumed DocSentinel is a business tool where AI extraction (Smart Mode) is the
default and Private Mode is a niche tier. The product goal has shifted: **DocSentinel
should be a "one stop for everything" household drive — a private, secure alternative
to Google Drive.**

That reframe forces three changes:

1. **The vault attaches to folders, not individual documents.** Households think in
   folders ("Photos", "Taxes", "Kids' school"). Mode is chosen per folder; documents
   inherit their folder's mode.
2. **User-owned folders don't exist yet.** The current `collections` table is *global
   system taxonomy* (no `owner_id`, `system_created` flag, global unique slug) — it is
   the document-type categorization, NOT user folders. A user-owned folder primitive
   must be built first. This is Drive-parity groundwork, needed vault or no vault.
3. **Recovery must be designed, not waved away.** Households forget passphrases and are
   the least forgiving audience for "your files are gone forever." Pure no-recovery ZK
   is wrong as a household default. Recovery codes (ZK-preserving) resolve this honestly.

---

## 1. The core tension (stated plainly)

A single file cannot be **both** server-searchable/AI-powered **and** zero-knowledge.
AI extraction needs plaintext; zero-knowledge denies plaintext. This is arithmetic, not
a bug to engineer around. The product's job is to let the user **choose per folder**
which property a folder gets, and to make that choice legible to someone who will never
read documentation.

- **Smart folder** — convenient, server-readable, AI-powered (search, summaries,
  extraction). Same as everything DocSentinel does today. Comparable to Google Drive.
- **Private folder** — zero-knowledge. Server never holds plaintext or a decrypting
  key. No AI, no server-side search inside. The differentiator.

---

## 2. Default model

- **New folders default to Smart** — so the product feels like Drive on day one and
  nobody is locked out of their whole drive by forgetting one passphrase.
- **Creating a Private (Vault) folder is a prominent, celebrated action** — "Create a
  Vault folder — not even we can see inside." The vault is the hero feature: offered,
  never forced.
- A forgotten vault passphrase only affects **that vault folder**, never the whole drive.

Rationale: privacy-by-default-everywhere makes nothing searchable and every forgotten
passphrase catastrophic (too sharp — cuts the user, not the attacker). Smart-everywhere
makes you just an encrypted-at-rest Drive (throws away the differentiator). Per-folder
choice is the honest middle and matches how households already organize.

---

## 3. The guarantee (unchanged crypto spine)

For **Private folders**, the server never holds plaintext and never holds a key capable
of decrypting the contents. Encryption/decryption is entirely client-side (browser) via
Web Crypto. The vault key is derived from a **vault passphrase separate from the bcrypt
login password**, never transmitted to the server.

---

## 4. Crypto boundary — nest, don't replace (unchanged from v1)

Private-folder client-side encryption is an **inner layer**. Existing server-side R2
AES-256-GCM stays as-is and wraps the already-encrypted bytes as an outer layer.

```
Private-folder doc bytes
  -> [client] AES-256-GCM with per-doc key   (inner — key never leaves browser)
  -> uploaded as opaque ciphertext
  -> [server] AES-256-GCM at R2 rest layer    (outer — existing, unchanged)
  -> stored in R2
```

Server peels only the outer layer it manages. Inner key never reaches it; stored bytes
are undecryptable server-side. Nesting keeps the storage layer dumb (encrypts and stores
whatever bytes it is handed) — the structural guarantee falls out of the architecture,
not a flag that can rot on refactor.

---

## 5. Substrate (unchanged from v1)

- **Content:** native `SubtleCrypto` AES-256-GCM. No dependency.
- **KDF:** Argon2id via small audited WASM (hash-wasm / argon2-browser), KDF-only footprint.
- **Why Argon2id not PBKDF2:** human-chosen passphrase vs GPU/ASIC; PBKDF2 not memory-hard.
- **Isolation:** single `deriveVaultKey()` seam; PBKDF2-600k fallback is a one-line swap
  if WASM fights the Vite build.

### KDF params (proposed — confirm at 4b)
- Memory **46 MB**, iterations **3**, parallelism **1**.
  Chosen for a mobile-heavy household base: comfortably memory-hard, still responsive on
  low-end Android browser tabs (64 MB can stutter an interactive unlock). Bump to 64 MB
  if the base proves desktop-first.
- Salt: per-user, random, stored server-side. Useless without the passphrase.

---

## 6. Recovery — the crux, resolved honestly

Three intellectually honest positions (no fourth exists):

1. **Pure ZK, no recovery** — max privacy, max unforgiving. Correct as an *advanced
   opt-in* for a specific vault; WRONG as a household default.
2. **Recovery codes at setup, ZK intact** — at vault creation, generate one-time recovery
   codes that can *independently* unwrap the vault key. User must save them. Server still
   holds nothing that decrypts. Industry standard (Signal, iCloud ADP, password managers).
3. **Opt-in escrow** — user *chooses* to let a recovery key be held, enabling a true
   reset. Breaks strict ZK for that vault → only ever opt-in, label MUST change when
   chosen ("Recoverable" vs "Zero-knowledge"). Never silent.

**v1 decision: ship option 2 (recovery codes) as the vault default. Design the schema so
option 3 can be added later as explicit opt-in. Do NOT build escrow in v1.**

Mechanism: the per-vault key is wrapped by BOTH the passphrase-derived key AND each
recovery code, so any one unlocks it. Losing the passphrase but keeping a recovery code
= recoverable. Losing both = gone (and the UI says so plainly).

---

## 7. Structural bypass of the extraction pipeline (unchanged)

Private-folder docs must be **structurally incapable** of reaching Groq extraction — not
skipped by a conditional. The server only ever receives ciphertext for them, so there is
no plaintext for the pipeline to act on. The bypass is by construction. Enforced by the
negative test (section 10).

---

## 8. Honest labeling (sharpened for households)

A household user won't read fine print — the label carries the whole truth.

- **Per-folder badge.** Private folders show "Only you can access ✓ — not even us".
  Smart folders show an honest, non-privacy badge (e.g. "Encrypted at rest · AI-enabled").
- "Only you can access ✓" is gated to `vault_type = private` at the folder level, and
  renders ONLY once the negative test (10) is green. Never shown for Smart folders (server
  does AI there — the claim would be false).
- If option-3 escrow is ever enabled for a vault, its label changes to "Recoverable" —
  the zero-knowledge claim is withdrawn for that folder. Never silent.

---

## 9. Phasing — three staged efforts, each independently verifiable

### Phase 4a — User folders (NO crypto) — the Drive-parity foundation
- `folders` table: `owner_id`, `name`, `parent_folder_id` (nesting), `created_at`.
- `documents` gain `folder_id` (NULL = unfiled / root).
- Full **ownership-isolation** test pass: no cross-user folder access on ANY route
  (the single most likely real-world breach for a household drive). Same threat-model
  discipline as sharing v1.
- Ships real value alone: owned, nameable folders = Drive baseline, vault or not.

### Phase 4b — Vault crypto core
- `folders.vault_type` discriminator: `smart` (default) | `private`.
- Nested client-side AES-GCM; Argon2id KDF behind `deriveVaultKey()`.
- Per-user `vault_kdf_salt` (on `users`); per-doc wrapped key (inline `wrapped_dek` on
  `documents`, NULL for smart — 1:1 with doc, no Private-doc sharing in v1, YAGNI on a
  side table).
- Structural extraction bypass.
- **Negative test written FIRST** (section 10).

### Phase 4c — Recovery + labeling
- Recovery codes at vault creation (option 2, ZK-preserving) — vault key wrapped by
  passphrase-key AND each recovery code.
- Per-folder honest labels (section 8), "Only you can access ✓" gated + negative-test-green.

Each phase has a one-sentence guarantee provable before the next begins. Staged
verifiability IS the security posture.

---

## 10. The negative test (write FIRST in 4b)

For an upload into a Private folder, CI asserts:
- Groq is **never** called (spy on the Groq client; assert zero invocations).
- The server **never** receives plaintext (bytes reaching the storage layer contain no
  known plaintext markers).

Fails until 4b's structural bypass exists — correct. Every later commit keeps it green.
The check ships with the change (same spirit as `count===1` anchor guards).

---

## 11. Schema delta summary
- **4a:** new `folders` (`owner_id`, `name`, `parent_folder_id`, `created_at`);
  `documents.folder_id`. Migration `add_folders.sql`.
- **4b:** `folders.vault_type`; `users.vault_kdf_salt`; `documents.wrapped_dek`.
  Migration `add_private_vault.sql`.
- **4c:** recovery-code storage (wrapped-key copies) — table `vault_recovery_wraps`
  (`folder_id` or vault id, `wrapped_key`, `code_hash`, `used_at`). Migration
  `add_vault_recovery.sql`.
- All Category B (owner-only data) in the DPDP batch — but confirm folder-sharing is OUT
  of v1 (if Private folders can be shared, that re-enters Category A).

---

## 12. Locked decisions (v2 — confirmed 2026-08-20)
- **Folder nesting:** FLAT for v1. `parent_folder_id` stays as a nullable column (door
  open for later nesting) but v1 enforces a single level. Keeps ownership-isolation
  tests tractable and matches the household one-level mental model.
- **Private-folder sharing:** OUT for v1. Keeps the whole effort DPDP Category B
  (owner-only data). Smart folders still share via existing sharing v1. Honest truth,
  not just scope: you cannot share what the server cannot decrypt.
- **KDF params:** Argon2id memory **46 MB**, iterations **3**, parallelism **1**.
  Mobile-heavy base; memory-hard but responsive on low-end browser tabs.
- **Recovery codes:** **8 one-time codes**, grouped alphanumeric (Crockford base32,
  no ambiguous 0/O/1/I; `XXXX-XXXX-XXXX` blocks). Vault key wrapped by passphrase-key
  AND each code; any one unlocks. Option-2 (ZK-preserving) is the v1 default; escrow
  (option 3) deferred, schema left open for it.
- **Collections vs folders:** COEXIST as two orthogonal axes. `collections` = automatic
  document-type tags ("this is an invoice"); `folders` = user's own organization
  ("lives in my Taxes folder"). Not reconciled.
