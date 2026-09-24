import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="empty-state" style={{ padding: '110px 20px' }}>
      <div className="illo"><Compass size={32} /></div>
      <h3 style={{ fontSize: 44 }}>Page not found</h3>
      <p>This link doesn't lead anywhere, but every tool is one click away.</p>
      <Link to="/" className="btn primary">Back to all tools</Link>
    </div>
  )
}
