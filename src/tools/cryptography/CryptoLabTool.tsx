import { useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { aesDecryptText, aesEncryptText, generateEcdsaKeyPair } from './crypto-lab-logic'

export default function CryptoLabTool() {
  const [activeTab, setActiveTab] = useState<'aes' | 'ecdsa'>('aes')

  const [aesInput, setAesInput] = useState('Top Secret Sensitive Message 🔐')
  const [aesPassphrase, setAesPassphrase] = useState('MyStrongPassphrase123!')
  const [aesResult, setAesResult] = useState<{ ciphertextBase64: string; ivHex: string; saltHex: string } | null>(null)
  const [aesDecryptResult, setAesDecryptResult] = useState<string>('')
  const [aesError, setAesError] = useState<string>('')

  const [ecdsaKeyPair, setEcdsaKeyPair] = useState<{ publicKeyPem: string; privateKeyPem: string } | null>(null)
  const [signMessage, setSignMessage] = useState('Verify this authentic payload message.')
  const [ecdsaSignatureHex, setEcdsaSignatureHex] = useState('')
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null)
  const [ecdsaError, setEcdsaError] = useState('')

  const handleAesEncrypt = async () => {
    try {
      setAesError('')
      const res = await aesEncryptText(aesInput, aesPassphrase)
      setAesResult(res)
    } catch (err: any) {
      setAesError(err.message || 'Encryption failed')
    }
  }

  const handleAesDecrypt = async () => {
    if (!aesResult) return
    try {
      setAesError('')
      const decrypted = await aesDecryptText(
        aesResult.ciphertextBase64,
        aesPassphrase,
        aesResult.ivHex,
        aesResult.saltHex
      )
      setAesDecryptResult(decrypted)
    } catch {
      setAesError('Decryption failed! Check passphrase or initialization vector.')
    }
  }

  const handleGenerateEcdsa = async () => {
    try {
      setEcdsaError('')
      const kp = await generateEcdsaKeyPair()
      setEcdsaKeyPair(kp)
      setEcdsaSignatureHex('')
      setVerifyResult(null)
    } catch (err: any) {
      setEcdsaError(err.message || 'Key generation failed')
    }
  }

  const handleEcdsaSign = async () => {
    if (!ecdsaKeyPair) return
    try {
      setEcdsaError('')
      const enc = new TextEncoder()
      const privPemClean = ecdsaKeyPair.privateKeyPem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replaceAll(/\s/g, '')
      const privBytes = Uint8Array.from(atob(privPemClean), (c) => c.charCodeAt(0))

      const privateKeyObj = await window.crypto.subtle.importKey(
        'pkcs8',
        privBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      )

      const signature = await window.crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        privateKeyObj,
        enc.encode(signMessage)
      )

      const sigHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      setEcdsaSignatureHex(sigHex)
      setVerifyResult(null)
    } catch (err: any) {
      setEcdsaError('Signature generation failed: ' + err.message)
    }
  }

  const handleEcdsaVerify = async () => {
    if (!ecdsaKeyPair || !ecdsaSignatureHex) return
    try {
      setEcdsaError('')
      const enc = new TextEncoder()
      const pubPemClean = ecdsaKeyPair.publicKeyPem
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replaceAll(/\s/g, '')
      const pubBytes = Uint8Array.from(atob(pubPemClean), (c) => c.charCodeAt(0))

      const publicKeyObj = await window.crypto.subtle.importKey(
        'spki',
        pubBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      )

      const sigBytes = new Uint8Array(
        ecdsaSignatureHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      )

      const isValid = await window.crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        publicKeyObj,
        sigBytes,
        enc.encode(signMessage)
      )

      setVerifyResult(isValid)
    } catch (err: any) {
      setEcdsaError('Verification failed: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🔐</span>
          <span>AES & Digital Signatures Toolkit</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
          Browser-local AES-256-GCM encryption with PBKDF2 key derivation & ECDSA digital signature creation/verification using Web Crypto API.
        </p>
      </div>

      <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('aes')}
          className={`border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'aes'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          AES-256-GCM Encrypt & Decrypt
        </button>
        <button
          onClick={() => setActiveTab('ecdsa')}
          className={`border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'ecdsa'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          ECDSA Digital Sign & Verify
        </button>
      </div>

      {activeTab === 'aes' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Plaintext Message
              </label>
              <textarea
                rows={4}
                value={aesInput}
                onChange={(e) => setAesInput(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Encryption Passphrase
              </label>
              <input
                type="password"
                value={aesPassphrase}
                onChange={(e) => setAesPassphrase(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                onClick={handleAesEncrypt}
                className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 shadow-xs transition-colors"
              >
                🔒 Encrypt with AES-256-GCM
              </button>
            </div>
          </div>

          {aesError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              ⚠️ {aesError}
            </div>
          )}

          {aesResult && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  AES-256-GCM Ciphertext Payload (Base64)
                </h3>
                <CopyButton value={aesResult.ciphertextBase64} label="Copy Ciphertext" />
              </div>
              <div className="rounded-lg bg-slate-100 p-3 font-mono text-xs text-emerald-700 dark:bg-zinc-950 dark:text-emerald-400 break-all border border-slate-200 dark:border-zinc-800">
                {aesResult.ciphertextBase64}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-xs font-mono">
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-500">12-Byte IV (Hex): </span>
                  <span className="text-slate-900 dark:text-zinc-200 font-bold">{aesResult.ivHex}</span>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-200 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-500">16-Byte Salt (Hex): </span>
                  <span className="text-slate-900 dark:text-zinc-200 font-bold">{aesResult.saltHex}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleAesDecrypt}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs"
                >
                  🔓 Test Decryption
                </button>
                {aesDecryptResult && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    Decrypted Result: <strong>{aesDecryptResult}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ecdsa' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-zinc-200">ECDSA (P-256) Key Generator</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Generate a Web Crypto elliptic curve keypair for digital signing</div>
            </div>
            <button
              onClick={handleGenerateEcdsa}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs"
            >
              Generate P-256 Key Pair
            </button>
          </div>

          {ecdsaError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              ⚠️ {ecdsaError}
            </div>
          )}

          {ecdsaKeyPair && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Public Key (PEM / SPKI)
                    </label>
                    <CopyButton value={ecdsaKeyPair.publicKeyPem} label="Copy Public Key" />
                  </div>
                  <textarea
                    rows={5}
                    readOnly
                    value={ecdsaKeyPair.publicKeyPem}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] text-slate-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Private Key (PEM / PKCS8)
                    </label>
                    <CopyButton value={ecdsaKeyPair.privateKeyPem} label="Copy Private Key" />
                  </div>
                  <textarea
                    rows={5}
                    readOnly
                    value={ecdsaKeyPair.privateKeyPem}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-[11px] text-slate-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Message Payload to Sign / Verify
                  </label>
                  <input
                    type="text"
                    value={signMessage}
                    onChange={(e) => setSignMessage(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleEcdsaSign}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs"
                  >
                    ✍️ Sign Payload
                  </button>
                  {ecdsaSignatureHex && (
                    <button
                      onClick={handleEcdsaVerify}
                      className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 shadow-xs"
                    >
                      ✓ Verify Signature
                    </button>
                  )}
                </div>

                {ecdsaSignatureHex && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">ECDSA P-256 Signature (Hex):</span>
                      <CopyButton value={ecdsaSignatureHex} label="Copy Signature" />
                    </div>
                    <div className="rounded-lg bg-slate-100 p-3 font-mono text-xs text-emerald-700 dark:bg-zinc-950 dark:text-emerald-400 break-all border border-slate-200 dark:border-zinc-800">
                      {ecdsaSignatureHex}
                    </div>
                  </div>
                )}

                {verifyResult !== null && (
                  <div
                    className={`rounded-lg p-3 text-xs font-semibold border ${
                      verifyResult
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
                    }`}
                  >
                    {verifyResult ? '✓ VALID SIGNATURE — Message authenticity & integrity verified!' : '❌ INVALID SIGNATURE — Payload modified or key mismatch!'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
