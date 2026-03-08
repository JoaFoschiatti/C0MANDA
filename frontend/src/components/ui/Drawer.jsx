import { Fragment } from 'react'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const placementClasses = {
  right: 'drawer-panel-right',
  bottom: 'drawer-panel-bottom'
}

export default function Drawer({
  open,
  onClose,
  title,
  placement = 'right',
  children,
  className
}) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="drawer-overlay" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="flex h-full w-full items-end justify-end">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom={placement === 'right' ? 'opacity-0 translate-x-8' : 'opacity-0 translate-y-8'}
              enterTo="opacity-100 translate-x-0 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-x-0 translate-y-0"
              leaveTo={placement === 'right' ? 'opacity-0 translate-x-8' : 'opacity-0 translate-y-8'}
            >
              <DialogPanel
                className={clsx(
                  'drawer-panel pointer-events-auto',
                  placementClasses[placement],
                  className
                )}
              >
                <div className="drawer-header">
                  <div>
                    <h3 className="text-heading-3">{title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-ghost btn-icon"
                    aria-label="Cerrar panel"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="drawer-body">
                  {children}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
