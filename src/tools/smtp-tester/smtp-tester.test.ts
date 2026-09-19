import { describe, expect, it } from 'vitest'
import {
  cleanGoogleAppPassword,
  generateHandshakeSimulation,
  generateNodeJsScript,
  generateOpenSslCommand,
  generatePythonScript,
  validateSmtpConfig,
} from './smtp-tester.logic'

describe('smtp-tester.logic', () => {
  it('cleans space characters from Google App Passwords', () => {
    const rawPass = 'abcd efgh ijkl mnop'
    expect(cleanGoogleAppPassword(rawPass)).toBe('abcdefghijklmnop')
  })

  it('validates Google App Password length and generates security warnings', () => {
    const validConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      security: 'starttls' as const,
      authType: 'app_password' as const,
      username: 'test@gmail.com',
      password: 'abcd efgh ijkl mnop',
      fromEmail: 'test@gmail.com',
      toEmail: 'target@example.com',
    }

    const checks = validateSmtpConfig(validConfig)
    const validNotice = checks.find((c) => c.title === 'Valid App Password Format')
    expect(validNotice).toBeDefined()
    expect(validNotice?.severity).toBe('success')

    const invalidConfig = {
      ...validConfig,
      password: 'shortpassword',
    }
    const invalidChecks = validateSmtpConfig(invalidConfig)
    const warningNotice = invalidChecks.find((c) => c.title === 'Non-Standard Google Password')
    expect(warningNotice).toBeDefined()
    expect(warningNotice?.severity).toBe('warning')
  })

  it('generates correct handshake simulation steps', () => {
    const config = {
      host: 'smtp.gmail.com',
      port: 587,
      security: 'starttls' as const,
      authType: 'app_password' as const,
      username: 'user@gmail.com',
      password: 'abcdefghijklmnop',
      fromEmail: 'user@gmail.com',
      toEmail: 'dest@example.com',
    }

    const steps = generateHandshakeSimulation(config)
    expect(steps.length).toBeGreaterThan(10)
    expect(steps.some((s) => s.text.includes('STARTTLS'))).toBe(true)
    expect(steps.some((s) => s.code === 235)).toBe(true)
    expect(steps.some((s) => s.text.includes('MAIL FROM'))).toBe(true)
  })

  it('generates CLI and script commands', () => {
    const config = {
      host: 'smtp.gmail.com',
      port: 587,
      security: 'starttls' as const,
      authType: 'app_password' as const,
      username: 'user@gmail.com',
      password: 'abcdefghijklmnop',
      fromEmail: 'user@gmail.com',
      toEmail: 'dest@example.com',
    }

    const openssl = generateOpenSslCommand(config)
    expect(openssl).toContain('openssl s_client -connect smtp.gmail.com:587 -starttls smtp')

    const nodeScript = generateNodeJsScript(config)
    expect(nodeScript).toContain('nodemailer.createTransport')
    expect(nodeScript).toContain('abcdefghijklmnop')

    const pythonScript = generatePythonScript(config)
    expect(pythonScript).toContain('import smtplib')
  })
})
