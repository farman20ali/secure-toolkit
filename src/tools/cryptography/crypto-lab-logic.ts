export async function aesEncryptText(plaintext: string, passphrase: string): Promise<{ ciphertextBase64: string; ivHex: string; saltHex: string }> {
  const enc = new TextEncoder()
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )

  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('')
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('')

  return { ciphertextBase64, ivHex, saltHex }
}

export async function aesDecryptText(ciphertextBase64: string, passphrase: string, ivHex: string, saltHex: string): Promise<string> {
  const dec = new TextDecoder()
  const enc = new TextEncoder()

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [])
  const encryptedBytes = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0))

  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  )

  return dec.decode(decrypted)
}

export async function generateEcdsaKeyPair(): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )

  const exportedPublic = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
  const exportedPrivate = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

  const pubB64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublic)))
  const privB64 = btoa(String.fromCharCode(...new Uint8Array(exportedPrivate)))

  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${pubB64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privB64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`

  return { publicKeyPem, privateKeyPem }
}
