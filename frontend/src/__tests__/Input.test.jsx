import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

import Input from '../components/ui/Input'

describe('Input', () => {
  it('aplica la variante compartida cuando recibe icono', () => {
    render(
      <Input
        label="Buscar"
        placeholder="Buscar productos"
        icon={MagnifyingGlassIcon}
      />
    )

    expect(screen.getByRole('textbox', { name: /Buscar/i })).toHaveClass('input-with-icon')
  })
})
