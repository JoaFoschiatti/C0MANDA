import clsx from 'clsx'

export default function PublicCategoryTabs({ categories, activeCategory, onSelectCategory, allLabel = 'Todo' }) {
  return (
    <div className="public-category-tabs">
      <button
        type="button"
        onClick={() => onSelectCategory('all')}
        className={clsx('public-category-pill', activeCategory === 'all' && 'is-active')}
      >
        {allLabel}
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelectCategory(category.id)}
          className={clsx('public-category-pill', activeCategory === category.id && 'is-active')}
        >
          {category.nombre}
        </button>
      ))}
    </div>
  )
}
