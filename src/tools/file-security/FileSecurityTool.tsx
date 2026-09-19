import { useState } from 'react'
import { CopyButton } from '../../components/CopyButton'

import { calculateEntropy, detectMagicBytes, type MagicByteMatch } from './file-security-logic'

export default function FileSecurityTool() {
  const [file, setFile] = useState<File | null>(null)
  const [hashes, setHashes] = useState<{ sha256: string; sha512: string; sha1: string } | null>(null)
  const [magicReport, setMagicReport] = useState<MagicByteMatch | null>(null)
  const [entropy, setEntropy] = useState<number | null>(null)
  const [expectedHash, setExpectedHash] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setHashes(null)
    setMagicReport(null)
    setEntropy(null)

    const arrayBuffer = await selected.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Calculate magic bytes & entropy
    const magic = detectMagicBytes(uint8Array, selected.name)
    setMagicReport(magic)

    const ent = calculateEntropy(uint8Array)
    setEntropy(ent)

    // Calculate SHA-256, SHA-512, SHA-1 using Web Crypto API
    const sha256Buffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer)
    const sha512Buffer = await window.crypto.subtle.digest('SHA-512', arrayBuffer)
    const sha1Buffer = await window.crypto.subtle.digest('SHA-1', arrayBuffer)

    const toHex = (buf: ArrayBuffer) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

    setHashes({
      sha256: toHex(sha256Buffer),
      sha512: toHex(sha512Buffer),
      sha1: toHex(sha1Buffer),
    })
  }

  const hashMatchVerdict =
    expectedHash && hashes
      ? expectedHash.trim().toLowerCase() === hashes.sha256.toLowerCase() ||
        expectedHash.trim().toLowerCase() === hashes.sha1.toLowerCase() ||
        expectedHash.trim().toLowerCase() === hashes.sha512.toLowerCase()
      : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>📦</span>
          <span>File Integrity & Magic Byte Inspector</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Calculate multi-hash file integrity, verify expected checksums, detect file extension spoofing via magic bytes, and calculate byte entropy—100% locally.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
        <input type="file" id="file-sec-input" onChange={handleFileChange} className="hidden" />
        <label
          htmlFor="file-sec-input"
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors"
        >
          <span>📁 Select Local File to Inspect</span>
        </label>
        {file && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            Selected: {file.name} ({Math.round((file.size / 1024) * 10) / 10} KB)
          </p>
        )}
      </div>

      {file && hashes && magicReport && entropy !== null && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Checksum Verification & Matcher
            </h3>

            <div className="space-y-2">
              <label className="block text-xs text-slate-600 dark:text-zinc-400">Expected Checksum (SHA-256 / SHA-512 / SHA-1)</label>
              <input
                type="text"
                value={expectedHash}
                onChange={(e) => setExpectedHash(e.target.value)}
                placeholder="Paste expected checksum to compare..."
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            {hashMatchVerdict !== null && (
              <div
                className={`rounded-md p-3 text-xs font-semibold border ${
                  hashMatchVerdict
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
                }`}
              >
                {hashMatchVerdict ? '✓ CHECKSUM MATCH CONFIRMED — File integrity verified!' : '❌ CHECKSUM MISMATCH — Expected hash does not match calculated hashes!'}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Calculated Cryptographic Hashes
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span>SHA-256</span>
                  <CopyButton value={hashes.sha256} label="Copy SHA-256" />
                </div>
                <div className="mt-1 rounded bg-white p-2.5 text-emerald-700 font-semibold break-all border border-slate-200 dark:bg-zinc-950 dark:text-emerald-400 dark:border-zinc-800">
                  {hashes.sha256}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span>SHA-512</span>
                  <CopyButton value={hashes.sha512} label="Copy SHA-512" />
                </div>
                <div className="mt-1 rounded bg-white p-2.5 text-slate-800 break-all border border-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:border-zinc-800">
                  {hashes.sha512}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                  <span>SHA-1</span>
                  <CopyButton value={hashes.sha1} label="Copy SHA-1" />
                </div>
                <div className="mt-1 rounded bg-white p-2.5 text-slate-700 break-all border border-slate-200 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800">
                  {hashes.sha1}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 space-y-2 dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Magic Bytes & Format Detection
              </h3>
              <div className="font-mono text-xs space-y-1 text-slate-700 dark:text-zinc-300">
                <div>First 8 Bytes: <span className="text-emerald-700 font-semibold dark:text-emerald-400">{magicReport.magicBytesHex}</span></div>
                <div>Detected MIME: <span className="text-slate-900 font-medium dark:text-zinc-100">{magicReport.actualMime}</span></div>
              </div>

              {magicReport.isMismatch ? (
                <div className="mt-2 rounded border border-red-300 bg-red-50 p-2.5 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  ⚠️ Extension Mismatch Alert: File extension ".{magicReport.extension}" does not match header signature ({magicReport.actualMime})!
                </div>
              ) : (
                <div className="mt-2 text-xs text-emerald-700 font-semibold dark:text-emerald-400">
                  ✓ File signature matches extension.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 space-y-2 dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Byte Entropy Analysis
              </h3>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {entropy} <span className="text-xs text-slate-500 dark:text-zinc-400 font-normal">bits / byte</span>
              </div>
              <div className="text-xs text-slate-600 dark:text-zinc-400">
                {entropy > 7.5
                  ? 'High Entropy (>7.5): Data appears compressed, encrypted, or packed.'
                  : entropy < 4.0
                  ? 'Low Entropy (<4.0): Repetitive text or sparse data structure.'
                  : 'Normal Entropy (4.0 - 7.5): Typical structured binary or source text file.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
