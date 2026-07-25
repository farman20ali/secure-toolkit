import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './layout/Layout'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { HomePage } from './pages/HomePage'
import PasswordTool from './tools/password/PasswordTool'
import { getToolById, tools } from './tools/registry'

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
  if (toolId === 'password') {
    return <PasswordTool />
  }
  return <Navigate to="/" replace />
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
