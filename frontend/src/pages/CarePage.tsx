import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toApiError } from '../api/client'
import type { CareLink, PersonSummary } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import InviteForm from '../components/InviteForm'
import QueryError from '../components/QueryError'
import StatusTag from '../components/StatusTag'
import { useProfiles } from '../context/profile-context'
import { useCareAction, useCareLinks, type CareAction } from '../hooks/useCare'

const personName = (person: PersonSummary) => person.display_name || person.email

function describeError(error: unknown): string {
  const problem = toApiError(error)
  if (problem.code === 'invalid_state') return 'That request has already changed. Showing the latest.'
  if (problem.status === 403) return "You can't do that with this link."
  if (problem.status === 404) return 'That link is no longer available. Showing the latest.'
  return problem.message
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="mt-2 text-xs font-bold uppercase tracking-wider text-muted">{title}</h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  )
}

function PermissionTag({ link }: { link: CareLink }) {
  return link.permission === 'edit' ? (
    <StatusTag status="taken">Can edit</StatusTag>
  ) : (
    <StatusTag status="skipped">View only</StatusTag>
  )
}

function PersonHeader({ person, tag }: { person: PersonSummary; tag: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold">{personName(person)}</p>
        <p className="truncate text-sm text-muted">{person.email}</p>
      </div>
      {tag}
    </div>
  )
}

const small = 'min-h-9 px-3 text-sm'

export default function CarePage() {
  const { profiles, select } = useProfiles()
  const navigate = useNavigate()
  const query = useCareLinks()
  const action = useCareAction()
  const [confirming, setConfirming] = useState<string | null>(null)

  const me = profiles.find((p) => p.relationship === 'self')?.user_id
  const links = query.data?.results ?? []
  const requests = links.filter((l) => l.recipient.id === me && l.status === 'pending')
  const viewers = links.filter((l) => l.recipient.id === me && l.status === 'active')
  const caringFor = links.filter((l) => l.caregiver.id === me && l.status === 'active')
  const waiting = links.filter((l) => l.caregiver.id === me && l.status === 'pending')
  const nothing = requests.length + viewers.length + caringFor.length + waiting.length === 0

  function run(next: CareAction) {
    setConfirming(null)
    action.mutate(next)
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">Share with people you trust</p>
        <h1 className="font-display text-3xl font-bold">Care circle</h1>
      </header>

      {action.isError && (
        <p role="alert" className="rounded-xl bg-missed-bg px-3 py-2 text-sm text-missed-ink">
          {describeError(action.error)}
        </p>
      )}

      {query.isPending && <p className="text-muted">Loading your care circle…</p>}
      {query.isError && (
        <QueryError message="We couldn't load your care circle." onRetry={() => void query.refetch()} />
      )}

      {query.data && nothing && (
        <p className="text-sm text-muted">
          No one is connected yet. Ask to see someone's profile below, or wait for a request from them.
        </p>
      )}

      {requests.length > 0 && (
        <Section title="Requests for you">
          {requests.map((l) => (
            <li key={l.id}>
              <Card>
                <p>
                  <span className="font-semibold">{personName(l.caregiver)}</span> wants to see your medications
                  and doses.
                </p>
                <p className="text-sm text-muted">
                  Requested access: {l.permission === 'edit' ? 'can edit' : 'view only'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {l.permission === 'edit' ? (
                    <>
                      <Button disabled={action.isPending} onClick={() => run({ type: 'accept', id: l.id })}>
                        Accept: can edit
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={action.isPending}
                        onClick={() => run({ type: 'accept', id: l.id, permission: 'view' })}
                      >
                        Accept: view only
                      </Button>
                    </>
                  ) : (
                    <Button disabled={action.isPending} onClick={() => run({ type: 'accept', id: l.id })}>
                      Accept
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={action.isPending}
                    onClick={() => run({ type: 'decline', id: l.id })}
                  >
                    Decline
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </Section>
      )}

      {viewers.length > 0 && (
        <Section title="People who can see my data">
          {viewers.map((l) => (
            <li key={l.id}>
              <Card>
                <PersonHeader person={l.caregiver} tag={<PermissionTag link={l} />} />
                {confirming === `remove-${l.id}` ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm">
                      Remove {personName(l.caregiver)}'s access? They will no longer see your data.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        className={small}
                        disabled={action.isPending}
                        onClick={() => run({ type: 'revoke', id: l.id })}
                      >
                        Yes, remove
                      </Button>
                      <Button variant="secondary" className={small} onClick={() => setConfirming(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className={small}
                      disabled={action.isPending}
                      onClick={() =>
                        run({ type: 'permission', id: l.id, permission: l.permission === 'view' ? 'edit' : 'view' })
                      }
                    >
                      {l.permission === 'view' ? 'Allow editing' : 'Make view only'}
                    </Button>
                    <Button variant="danger" className={small} onClick={() => setConfirming(`remove-${l.id}`)}>
                      Remove access
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </Section>
      )}

      {caringFor.length > 0 && (
        <Section title="People I care for">
          {caringFor.map((l) => (
            <li key={l.id}>
              <Card>
                <PersonHeader person={l.recipient} tag={<PermissionTag link={l} />} />
                {confirming === `stop-${l.id}` ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm">Stop viewing {personName(l.recipient)}'s profile?</p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        className={small}
                        disabled={action.isPending}
                        onClick={() => run({ type: 'revoke', id: l.id })}
                      >
                        Yes, stop viewing
                      </Button>
                      <Button variant="secondary" className={small} onClick={() => setConfirming(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        select(l.recipient.id)
                        navigate('/')
                      }}
                    >
                      Open {personName(l.recipient)}'s day
                    </Button>
                    <Button
                      variant="danger"
                      className={small}
                      aria-label={`Stop viewing ${personName(l.recipient)}`}
                      onClick={() => setConfirming(`stop-${l.id}`)}
                    >
                      Stop viewing
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </Section>
      )}

      {waiting.length > 0 && (
        <Section title="Waiting for a reply">
          {waiting.map((l) => (
            <li key={l.id}>
              <Card>
                <PersonHeader person={l.recipient} tag={<StatusTag status="skipped">Waiting</StatusTag>} />
                <Button
                  variant="secondary"
                  className={`mt-3 ${small}`}
                  aria-label={`Cancel request to ${personName(l.recipient)}`}
                  disabled={action.isPending}
                  onClick={() => run({ type: 'revoke', id: l.id })}
                >
                  Cancel request
                </Button>
              </Card>
            </li>
          ))}
        </Section>
      )}

      <InviteForm />
    </div>
  )
}