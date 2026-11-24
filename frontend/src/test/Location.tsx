import { useLocation } from 'react-router'

export default function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>
}