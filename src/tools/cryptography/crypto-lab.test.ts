import { describe, expect, it } from 'vitest'
import { aesDecryptText, aesEncryptText, generateEcdsaKeyPair } from './crypto-lab-logic'

describe('aesEncryptText and aesDecryptText', () => {
  it('encrypts and decrypts text round-trip with AES-GCM', async () => {
    const original = 'Secret payload string 123!'
    const pass = 'SuperSecretPassphrase'

    const enc = await aesEncryptText(original, pass)
    expect(enc.ciphertextBase64).toBeDefined()
    expect(enc.ivHex).toHaveLength(24) // 12 bytes = 24 hex chars
    expect(enc.saltHex).toHaveLength(32) // 16 bytes = 32 hex chars

    const decrypted = await aesDecryptText(enc.ciphertextBase64, pass, enc.ivHex, enc.saltHex)
    expect(decrypted).toBe(original)
  })

  it('fails decryption if passphrase is wrong', async () => {
    const original = 'Secret payload string 123!'
    const enc = await aesEncryptText(original, 'Pass1')

    await expect(
      aesDecryptText(enc.ciphertextBase64, 'WrongPass', enc.ivHex, enc.saltHex)
    ).rejects.toThrow()
  })
})

describe('generateEcdsaKeyPair', () => {
  it('generates valid PEM format keypair for ECDSA P-256', async () => {
    const kp = await generateEcdsaKeyPair()
    expect(kp.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----')
    expect(kp.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----')
  })
})
