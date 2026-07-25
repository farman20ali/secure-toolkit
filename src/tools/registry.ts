export type ToolStatus = 'live' | 'coming-soon'

export type ToolDefinition = {
  id: string
  path: string
  title: string
  description: string
  status: ToolStatus
}

export const tools: ToolDefinition[] = [
  {
    id: 'password',
    path: '/tools/password',
    title: 'Password Generator',
    description:
      'Cryptographically strong passwords with customizable character sets.',
    status: 'live',
  },
  {
    id: 'uuid',
    path: '/tools/uuid',
    title: 'UUID Generator',
    description: 'Generate random UUID v4 identifiers in your browser.',
    status: 'coming-soon',
  },
  {
    id: 'base64',
    path: '/tools/base64',
    title: 'Base64 Encode / Decode',
    description: 'Convert text to and from Base64 with UTF-8 support.',
    status: 'coming-soon',
  },
  {
    id: 'json-beautify',
    path: '/tools/json-beautify',
    title: 'JSON Beautify',
    description: 'Format and minify JSON locally.',
    status: 'coming-soon',
  },
]

export function getToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
