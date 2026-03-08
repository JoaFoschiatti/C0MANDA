import { Fragment } from 'react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'modal-lg',
  xl: 'modal-xl',
  full: 'max-w-4xl',
};

export default function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  className,
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
          <div className="modal-overlay" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              className={clsx('modal', sizeClasses[size], className)}
            >
              {title && (
                <div className="modal-header">
                  <h3 className="text-heading-3">{title}</h3>
                  <button
                    onClick={onClose}
                    className="btn btn-ghost btn-icon"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
              <div className="modal-body overflow-y-auto">
                {children}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

Modal.Footer = function ModalFooter({ children, className }) {
  return (
    <div className={clsx('modal-footer', className)}>
      {children}
    </div>
  );
};
