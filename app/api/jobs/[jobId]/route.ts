import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    // RLS also enforces this, but scope explicitly so a policy regression
    // can't expose another user's job. Admins may view any job.
    let query = supabase.from('jobs').select('*').eq('id', jobId)
    if (!auth.isAdmin) query = query.eq('user_id', auth.user.id)
    const { data: job, error } = await query.single()

    if (error) {
      console.error('[v0] Job fetch error:', error)
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    return Response.json(job)
  } catch (error) {
    console.error('[v0] API error:', error)
    return Response.json({ error: 'Failed to fetch job' }, { status: 500 })
  }
}
