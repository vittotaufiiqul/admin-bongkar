export default function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.ok ? 'tok' : 'terr'}`}>
          {t.ok ? '✓' : '✗'} {t.msg}
        </div>
      ))}
    </div>
  )
}
