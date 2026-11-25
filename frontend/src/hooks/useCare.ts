import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptInvite,
  changeLinkPermission,
  declineInvite,
  inviteToCare,
  listCareLinks,
  revokeLink,
} from '../api/care'
import type { Permission } from '../api/types'

export type CareAction =
  | { type: 'accept'; id: number; permission?: Permission }
  | { type: 'decline'; id: number }
  | { type: 'revoke'; id: number }
  | { type: 'permission'; id: number; permission: Permission }

function perform(action: CareAction) {
  switch (action.type) {
    case 'accept':
      return acceptInvite(action.id, action.permission)
    case 'decline':
      return declineInvite(action.id)
    case 'revoke':
      return revokeLink(action.id)
    case 'permission':
      return changeLinkPermission(action.id, action.permission)
  }
}

export function useCareLinks() {
  return useQuery({ queryKey: ['care-links'], queryFn: listCareLinks })
}

/** Links decide who can see what, so the profile switcher refreshes with them. */
function useRefreshAfter() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['care-links'] }),
      queryClient.invalidateQueries({ queryKey: ['profiles'] }),
    ])
}

export function useCareAction() {
  const refresh = useRefreshAfter()
  return useMutation({ mutationFn: perform, onSettled: refresh })
}

export function useInvite() {
  const refresh = useRefreshAfter()
  return useMutation({
    mutationFn: ({ email, permission }: { email: string; permission: Permission }) =>
      inviteToCare(email, permission),
    onSettled: refresh,
  })
}