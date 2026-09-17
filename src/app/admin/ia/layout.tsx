import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IA & Agents',
  description:
    'Vue plateforme de l’usage IA — modèles appelés, agents et orchestration par organisation. Aucun parc GPU : tout passe par la passerelle LiteLLM devant OpenRouter.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
