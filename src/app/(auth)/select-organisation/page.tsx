import type { Metadata } from 'next'
import { SelecteurOrganisation } from './selecteur'

export const metadata: Metadata = { title: 'Choisir une organisation' }

export default function SelectionOrganisation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-h1">Choisir une organisation</h1>
        <SelecteurOrganisation />
      </div>
    </div>
  )
}
