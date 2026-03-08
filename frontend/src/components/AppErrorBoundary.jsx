import React from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Frontend runtime error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
          <div className="app-crash-card">
            <div className="app-crash-icon">
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>
            <h1 className="text-heading-2">No pudimos renderizar la interfaz</h1>
            <p className="text-body-sm mt-2">
              La app entro en un estado invalido. Recarga la pantalla para volver a un estado seguro.
            </p>
            <button type="button" onClick={this.handleReload} className="btn btn-primary mt-6 w-full">
              Recargar aplicacion
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
