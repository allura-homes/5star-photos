import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createClient()

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

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
