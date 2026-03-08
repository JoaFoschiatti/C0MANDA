export default function ConfigSection({ children, className = 'card mb-6', icon: Icon, title }) {
  return (
    <div className={className}>
      {(Icon || title) && (
        <h2 className="text-heading-3 mb-4 flex items-center gap-2">
          {Icon ? <Icon className="w-5 h-5" /> : null}
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}
