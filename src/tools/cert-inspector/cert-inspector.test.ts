import { describe, expect, it } from 'vitest'
import { parseX509Pem } from './CertTool'

describe('X.509 Certificate Inspector', () => {
  it('throws descriptive error on invalid PEM input', async () => {
    await expect(parseX509Pem('invalid pem data')).rejects.toThrow()
  })
})
