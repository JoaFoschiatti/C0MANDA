import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

export default function ConfigMessageBanner({ message }) {
  if (!message) {
    return null
  }

  return (
    <div className={`alert ${message.tipo === 'error' ? 'alert-error' : 'alert-success'}`}>
      {message.tipo === 'error' ? (
        <XCircleIcon className="w-5 h-5" />
      ) : (
        <CheckCircleIcon className="w-5 h-5" />
      )}
      {message.texto}
    </div>
  )
}
