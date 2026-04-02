import { Link } from 'react-router-dom';
import { Upload, Database, Swords, ClipboardList } from 'lucide-react';

const cards = [
  {
    to: '/admin/import',
    title: 'Import questions',
    description: 'Upload OCR text and parse questions into exams.',
    icon: Upload,
    color: '#4F46E5'
  },
  {
    to: '/admin/bank',
    title: 'Question bank',
    description: 'Manage subjects, sessions, and questions.',
    icon: Database,
    color: '#0F766E'
  },
  {
    to: '/admin/battle/create',
    title: 'Create battle room',
    description: 'Configure a new competition room and question set.',
    icon: Swords,
    color: '#C2410C'
  },
  {
    to: '/admin/battle/manage',
    title: 'Manage rooms',
    description: 'Open or close rooms, view stats and rankings.',
    icon: ClipboardList,
    color: '#7C3AED'
  }
];

export default function AdminHome() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 style={{ margin: 0, fontSize: '1.35rem' }}>Overview</h2>
        <p className="text-sm text-muted" style={{ fontWeight: 600, marginTop: '0.35rem' }}>
          Quick access to administration tools. Use the sidebar to switch sections.
        </p>
      </div>

      <div className="admin-dashboard-grid">
        {cards.map(({ to, title, description, icon: Icon, color }) => (
          <Link key={to} to={to} className="admin-dashboard-card card" style={{ textDecoration: 'none' }}>
            <div className="admin-dashboard-card-icon" style={{ background: `${color}18`, color }}>
              <Icon size={26} />
            </div>
            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              {title}
            </div>
            <div className="text-sm text-muted" style={{ fontWeight: 600, lineHeight: 1.45 }}>
              {description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
