import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SALT_ROUNDS = 10
const SESSION_DURATION_DAYS = 30
const SESSION_COOKIE_NAME = 'wktv_session'

// Create admin client for auth operations (bypasses RLS)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'wktv' }
    }
  )
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

function generateToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export interface User {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  created_at: string
}

export interface SignupData {
  email: string
  password: string
  name?: string
  phone?: string
}

export interface LoginData {
  email: string
  password: string
}

export async function signup(data: SignupData): Promise<{ user: User; token: string } | { error: string }> {
  const supabase = getSupabaseAdmin()
  
  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', data.email.toLowerCase())
    .single()
  
  if (existingUser) {
    return { error: 'An account with this email already exists' }
  }
  
  // Hash password
  const passwordHash = await hashPassword(data.password)
  
  // Create user
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert({
      email: data.email.toLowerCase(),
      password_hash: passwordHash,
      name: data.name || null,
      phone: data.phone || null,
    })
    .select('id, email, name, phone, role, created_at')
    .single()
  
  if (createError || !newUser) {
    console.error('Signup error:', createError)
    return { error: 'Failed to create account' }
  }
  
  // Create session
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)
  
  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: newUser.id,
      token,
      expires_at: expiresAt.toISOString(),
    })
  
  if (sessionError) {
    console.error('Session creation error:', sessionError)
    return { error: 'Failed to create session' }
  }
  
  return { user: newUser as User, token }
}

export async function login(data: LoginData): Promise<{ user: User; token: string } | { error: string }> {
  const supabase = getSupabaseAdmin()
  
  // Find user
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, email, password_hash, name, phone, role, created_at')
    .eq('email', data.email.toLowerCase())
    .single()
  
  if (findError || !user) {
    return { error: 'Invalid email or password' }
  }
  
  // Verify password
  const valid = await verifyPassword(data.password, user.password_hash)
  if (!valid) {
    return { error: 'Invalid email or password' }
  }
  
  // Create session
  const token = generateToken()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)
  
  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    })
  
  if (sessionError) {
    console.error('Session creation error:', sessionError)
    return { error: 'Failed to create session' }
  }
  
  // Return user without password hash
  const { password_hash, ...safeUser } = user
  return { user: safeUser as User, token }
}

export async function logout(token: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase.from('sessions').delete().eq('token', token)
}

export async function getSession(token: string): Promise<User | null> {
  if (!token) return null
  
  const supabase = getSupabaseAdmin()
  
  // Find session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, user_id, expires_at')
    .eq('token', token)
    .single()
  
  if (sessionError || !session) return null
  
  // Check if expired
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('sessions').delete().eq('token', token)
    return null
  }
  
  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name, phone, role, created_at')
    .eq('id', session.user_id)
    .single()
  
  if (userError || !user) return null
  
  return user as User
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return getSession(token)
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME
}

// Returns the logged-in user only if they are an admin (role = 'admin' in wktv.users).
// Use at the top of every admin API route.
export async function getAdminFromRequest(request: { cookies: { get(name: string): { value: string } | undefined } }): Promise<User | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getSession(token)
  if (!user || user.role !== 'admin') return null
  // Second check: if ADMIN_EMAILS is configured, the email must be on that list too
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (allowed.length && !allowed.includes((user.email || '').toLowerCase())) return null
  return user
}
