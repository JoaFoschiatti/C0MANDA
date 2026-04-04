import Spinner from './Spinner'
import Alert from './Alert'
import Button from './Button'

export default function PageLoader({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="error">
        {typeof error === 'string' ? error : 'Ocurrio un error al cargar los datos.'}
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry} className="mt-2">
            Reintentar
          </Button>
        )}
      </Alert>
    )
  }

  return children
}
