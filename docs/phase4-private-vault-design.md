# Phase 4 — Zero-Knowledge Private Vault — Design Doc

**Status:** DRAFT — boundary under review, no code yet
**Owner:** Aditya (solo)
**Gate:** DPDP review before any Railway deploy (owner-only data; lower exposure than sharing, but still gated)

---

## 1. The guarantee (stated precisely)

For documents in the **Private vault**, the server never holds plaintext and never
holds a key capable of decrypting them. Encryption and decryption happen entirely
client-side (browser) via Web Crypto. The key is derived from a **vault passphrase
that is separate from the bcrypt login password** and is never transmitted to the server.

**Consequence, non-negotiable and stated plainly in the UI:**
> Passphrase loss = permanent, unrecoverable data loss. There is no reset.

This is not a gap to apologize for — it is the definition of zero-knowledge. UX copy
must say so directly and never imply a recovery path exists.

---

## 2. Crypto boundary — nest, don't replace

Private-vault client-side encryption is an **inner layer**. The existing server-side
R2 AES-256-GCM stays exactly as-is and wraps the already-encrypted bytes as an outer layer.

```
Private doc bytes
  -> [client] AES-256-GCM with per-doc key      (inner — key never leaves browser)
  -> uploaded as opaque ciphertext
  -> [server] AES-256-GCM at R2 rest layer       (outer — existing, unchanged)
  -> stored in R2
```

The server can peel only the outer layer it already manages. The inner layer's key
never reaches it, so the stored bytes are undecryptable server-side.

**Why nest over replace:** replacing the server layer for Private docs means a
conditional in the storage path ("skip server encryption here") — the routed-around
pattern that rots on refactor. Nesting keeps the storage layer dumb: it encrypts and
stores whatever bytes it is handed, unaware some arrived pre-encrypted. There is no
branch to break, and no plaintext at the storage layer to leak. The structural
guarantee falls out of the architecture, not a flag.

---

## 3. Substrate

- **Content encryption/decryption:** native `SubtleCrypto` AES-256-GCM. No dependency.
- **Key derivation (KDF):** Argon2id via small audited WASM (hash-wasm / argon2-browser).
  WASM footprint is KDF-only; everything else is native.
- **Why Argon2id, not native PBKDF2:** the threat model is a human-chosen passphrase
  against GPU/ASIC attack. PBKDF2 is not memory-hard. Argon2id is the right tool for
  the one job native crypto does badly.
- **Isolation:** the KDF sits behind a single `deriveVaultKey()` function so swapping
  it (or falling back to PBKDF2-600k if the WASM fights the Vite build) is a one-line change.

### KDF params — TODO confirm before 4.2
- Argon2id memory: **TODO** (target ~64 MB? balance browser/mobile RAM vs strength)
- Argon2id iterations (time cost): **TODO** (~3?)
- Argon2id parallelism: **TODO** (~1 for browser?)
- Salt: per-user, random, stored server-side alongside the account. Useless without passphrase.

---

## 4. Key flow

**Vault unlock (per session):**
`passphrase -> Argon2id(salt) -> vaultKey` (held in memory only, never persisted, never sent)

**Upload (Private doc):**
1. Generate random per-doc key (AES-256-GCM).
2. Encrypt file bytes client-side with per-doc key.
3. Wrap per-doc key with `vaultKey`; store wrapped key as document metadata.
4. Upload inner ciphertext. Server wraps in R2 layer, stores.

**View (Private doc):**
1. Fetch ciphertext; server peels R2 layer, returns inner ciphertext.
2. Unwrap per-doc key with `vaultKey`.
3. AES-GCM decrypt client-side; render.
4. No extraction, no Groq — there is nothing decryptable server-side to feed them.

---

## 5. Structural bypass of the extraction pipeline

Private docs must be **structurally incapable** of reaching Groq extraction, not
merely skipped by a conditional. Because the server only ever receives ciphertext for
these docs, there is no plaintext for the pipeline to act on — the bypass is by
construction. Enforced by the negative test (section 7).

---

## 6. Schema delta (TODO confirm shape)

- `documents.vault_type` — discriminator: `smart` (default, existing behavior) | `private`.
  Existing rows default to `smart`; existing pipeline untouched for them.
- Per-doc **wrapped key** storage — column on `documents` (e.g. `wrapped_dek`) holding
  the vault-key-wrapped per-doc key + IV. NULL for smart docs.
- Per-user **KDF salt** — column on `users` (e.g. `vault_kdf_salt`), set when the user
  first establishes a vault passphrase. NULL until then.
- Migration: `add_private_vault.sql` (Category B — owner-only data — in the DPDP batch).

TODO: confirm column names + whether wrapped key lives inline on `documents` or a side table.

---

## 7. The negative test (write FIRST, Phase 4.1)

Before the feature exists, a CI test asserts, for a Private-vault upload:
- Groq is **never** called (mock/spy on the Groq client; assert zero invocations).
- The server **never** holds plaintext (the bytes reaching the storage layer do not
  contain known plaintext markers).

It fails initially (nothing built) — correct. Every later commit must keep it green.
Same spirit as the `count===1` anchor guards: the check ships with the change.

---

## 8. The label — ships WITH the crypto, never before

"Only you can access ✓" is a single deliverable with the zero-knowledge property.
Gated to `vault_type = private`, and only rendered once the negative test (7) is green.
Never shown for smart-mode docs (server does AI extraction there — the claim would be false).

---

## 9. Phasing

- **4.0** — this design doc (no code).
- **4.1** — negative test first (fails until built).
- **4.2** — passphrase + Argon2id KDF, isolated + testable; irreversible-loss copy.
- **4.3** — client-side encrypt/decrypt path; structural extraction bypass.
- **4.4** — the "Only you can access ✓" label, gated, negative-test-green.

---

## 10. Open questions
- KDF params (section 3).
- Schema column names + inline vs side-table for wrapped keys (section 6).
- Passphrase change flow: re-wrap all per-doc keys with the new vault key (per-doc keys
  unchanged, so no re-encryption of file bytes needed) — confirm this is the v1 approach.
- Multi-device: vault passphrase must be re-entered per device (salt is server-stored,
  passphrase is not) — confirm acceptable for v1.
