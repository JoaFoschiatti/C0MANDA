import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

api.interceptors.response.use(
  response => response,
  error => {
    const message = error.response?.data?.error?.message || 'Error de conexion'
    const skipToast = Boolean(error.config?.skipToast)

    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('usuario')
      localStorage.removeItem('negocio')
      window.location.assign('/login')
      return Promise.reject(error)
    }

    if (!skipToast) {
      toast.error(message)
    }

    return Promise.reject(error)
  }
)

export default api
