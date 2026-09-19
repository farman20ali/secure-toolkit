import * as OTPAuth from 'otpauth'

export function generateTotpCode(
  secret: string,
  algorithm = 'SHA1',
  digits = 6,
  period = 30
): { code: string; secondsRemaining: number } {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm,
      digits,
      period,
      secret: OTPAuth.Secret.fromBase32(secret.replaceAll(/\s/g, '').toUpperCase()),
    })
    const code = totp.generate()
    const now = Math.floor(Date.now() / 1000)
    const secondsRemaining = period - (now % period)
    return { code, secondsRemaining }
  } catch {
    return { code: '------', secondsRemaining: 0 }
  }
}

export function parseOtpauthUri(uri: string) {
  try {
    const parsed = OTPAuth.URI.parse(uri)
    if (parsed instanceof OTPAuth.TOTP) {
      return {
        issuer: parsed.issuer,
        label: parsed.label,
        secret: parsed.secret.base32,
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
      }
    }
  } catch {
    // invalid URI
  }
  return null
}
