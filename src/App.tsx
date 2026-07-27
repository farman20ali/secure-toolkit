import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './layout/Layout'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { HomePage } from './pages/HomePage'
import { getToolById, tools } from './tools/registry'

import PasswordTool from './tools/password/PasswordTool'
import UuidTool from './tools/uuid/UuidTool'
import Base64Tool from './tools/base64/Base64Tool'
import CodeBeautifyTool from './tools/code-beautify/CodeBeautifyTool'
import CodeCompareTool from './tools/code-compare/CodeCompareTool'
import HashGeneratorTool from './tools/hash-generator/HashGeneratorTool'
import JwtTool from './tools/jwt-decoder/JwtDecoderTool'
import UrlCodecTool from './tools/url-codec/UrlCodecTool'
import RsaGeneratorTool from './tools/rsa-generator/RsaGeneratorTool'
import CertTool from './tools/cert-inspector/CertTool'
import PasskeyTool from './tools/passkey/PasskeyTool'

function routerBasename(): string | undefined {
  const trimmed = import.meta.env.BASE_URL.replace(/\/$/, '')
  return trimmed === '' ? undefined : trimmed
}

function ToolRoute({ toolId }: { toolId: string }) {
  const tool = getToolById(toolId)
  if (!tool) {
    return <Navigate to="/" replace />
  }
  if (tool.status === 'coming-soon') {
    return (
      <ComingSoonPage title={tool.title} description={tool.description} />
    )
  }
  switch (toolId) {
    case 'password':
      return <PasswordTool />
    case 'uuid':
      return <UuidTool />
    case 'base64':
      return <Base64Tool />
    case 'code-beautify':
      return <CodeBeautifyTool />
    case 'code-compare':
      return <CodeCompareTool />
    case 'hash-generator':
      return <HashGeneratorTool />
    case 'jwt-decoder':
      return <JwtTool />
    case 'url-codec':
      return <UrlCodecTool />
    case 'rsa-generator':
      return <RsaGeneratorTool />
    case 'cert-inspector':
      return <CertTool />
    case 'passkey':
      return <PasskeyTool />
    default:
      return <Navigate to="/" replace />
  }
}

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {tools.map((tool) => (
            <Route
              key={tool.id}
              path={tool.path}
              element={<ToolRoute toolId={tool.id} />}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
