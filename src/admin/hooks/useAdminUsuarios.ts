import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'

export function useAdminUserList(search: string, segment: string, page: number) {
  return useQuery({
    queryKey: ['admin', 'users', search, segment, page],
    queryFn: () => adminApi.listUsers(search, segment, 25, (page - 1) * 25),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.getUser(userId),
    staleTime: 2 * 60 * 1000,
    enabled: !!userId,
  })
}

export function useAdminUserAttempts(userId: string) {
  return useQuery({
    queryKey: ['admin', 'user-attempts', userId],
    queryFn: () => adminApi.getUserAttempts(userId, 10),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  })
}

export function useAdminSetUserSegment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, segment }: { userId: string; segment: 'guest' | 'standard' | 'pro' }) =>
      adminApi.setUserSegment(userId, segment),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useAdminSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role, grant }: { userId: string; role: string; grant: boolean }) =>
      adminApi.setUserRole(userId, role, grant),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
    },
  })
}

export function useAdminResetUserOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.resetUserOnboarding(userId),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', userId] })
    },
  })
}

export function useAdminDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}
