import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { fetchYouTubeChannel } from '@/lib/youtube'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({
              name,
              value,
              ...options,
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              path: '/',
            })
          } catch (e) {
            // Cookie set may not be supported in some contexts
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({
              name,
              value: '',
              ...options,
              maxAge: 0,
              path: '/',
            })
          } catch (e) {
            // Cookie remove may not be supported in some contexts
          }
        },
      },
    }
  )
  // Exchange PKCE code for session (sets cookies server-side)
  const code = requestUrl.searchParams.get('code')
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      return NextResponse.redirect(new URL('/admin/login?error=auth_failed', requestUrl.origin))
    }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  const { data: { session } } = await supabase.auth.getSession()

  if (authError || !user) {
    console.error('Auth error:', authError)
    return NextResponse.redirect(new URL('/admin/login?error=auth_failed', requestUrl.origin))
  }

  // Fetch YouTube channel data using provider_token if available
  if (session?.provider_token) {
    try {
      const youtubeData = await fetchYouTubeChannel(session.provider_token)

      // Update user profile with YouTube data
      await supabase.from('profiles').upsert({
        id: user.id,
        is_verified: true,
        youtube_channel_id: youtubeData.channelId,
        youtube_handle: youtubeData.handle,
        youtube_channel_url: `https://www.youtube.com/channel/${youtubeData.channelId}`,
        auth_provider: 'google',
        updated_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to fetch YouTube channel:', error)
    }
  }

  // Redirect to admin
  return NextResponse.redirect(new URL('/admin', requestUrl.origin))
}
