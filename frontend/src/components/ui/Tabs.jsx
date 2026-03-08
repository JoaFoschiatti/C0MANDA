import clsx from 'clsx';

export default function Tabs({ tabs, activeTab, onChange, className }) {
  return (
    <div className={clsx('tabs', className)}>
      {tabs.map((tab) => {
        const key = typeof tab === 'string' ? tab : tab.value;
        const label = typeof tab === 'string' ? tab : tab.label;
        const count = typeof tab === 'object' ? tab.count : undefined;

        return (
          <button
            key={key}
            className={clsx('tab', activeTab === key && 'active')}
            onClick={() => onChange(key)}
          >
            {label}
            {count !== undefined && (
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
