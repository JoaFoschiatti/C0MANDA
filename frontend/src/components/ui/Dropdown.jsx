import { Fragment } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import clsx from 'clsx';

export default function Dropdown({ trigger, items, align = 'right', className }) {
  return (
    <Menu as="div" className={clsx('relative inline-block text-left', className)}>
      <MenuButton as={Fragment}>{trigger}</MenuButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems
          className={clsx(
            'absolute z-50 mt-2 w-48 rounded-lg bg-surface border border-border-subtle shadow-lg py-1 focus:outline-none',
            align === 'right' && 'right-0',
            align === 'left' && 'left-0',
          )}
        >
          {items.map((item, i) => {
            if (item.divider) {
              return <div key={i} className="divider my-1" />;
            }

            return (
              <MenuItem key={i}>
                {({ active }) => (
                  <button
                    onClick={item.onClick}
                    className={clsx(
                      'flex w-full items-center gap-2 px-3 py-2 text-sm',
                      active ? 'bg-surface-hover text-text-primary' : 'text-text-secondary',
                      item.danger && 'text-error-600',
                    )}
                  >
                    {item.icon && <item.icon className="w-4 h-4" />}
                    {item.label}
                  </button>
                )}
              </MenuItem>
            );
          })}
        </MenuItems>
      </Transition>
    </Menu>
  );
}
