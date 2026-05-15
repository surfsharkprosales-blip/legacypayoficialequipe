import postgres from 'postgres'

// Get database URL from environment - Supabase provides POSTGRES_URL
function getDatabaseUrl(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!url) {
    throw new Error('POSTGRES_URL or DATABASE_URL environment variable is not set')
  }
  return url
}

// Create a reusable SQL client with lazy initialization
let _sql: ReturnType<typeof postgres> | null = null

function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    _sql = postgres(getDatabaseUrl(), {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return _sql
}

// Export sql as a tagged template function for queries
// Usage: sql`SELECT * FROM users WHERE id = ${userId}`
export const sql = getSql()

// Helper function to check if database is configured
export function isDatabaseConfigured(): boolean {
  return !!(process.env.POSTGRES_URL || process.env.DATABASE_URL)
}

// Helper for transactions
export async function withTransaction<T>(
  callback: (sql: ReturnType<typeof postgres>) => Promise<T>
): Promise<T> {
  const client = postgres(getDatabaseUrl(), { ssl: 'require' })
  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}
