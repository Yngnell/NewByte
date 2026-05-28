import pg from 'pg'

const { Pool } = pg

let pool = null

function convertPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

function normalizeSql(sql) {
  return sql
    .replace(/\bINT AUTO_INCREMENT PRIMARY KEY\b/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bAUTO_INCREMENT\b/gi, '')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
    .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    .replace(/ENUM\((?:'[^']+'\s*,?\s*)+\)/gi, 'TEXT')
    .replace(/UNIQUE KEY\s+\w+\s*\(([^)]+)\)/gi, 'UNIQUE ($1)')
}

function shouldReturnId(sql) {
  return /^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)
}

export async function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Create a PostgreSQL database and set DATABASE_URL in your environment.')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    })
  }

  return {
    query: async (sql, params = []) => {
      try {
        let pgSql = convertPlaceholders(normalizeSql(sql))
        const returnInsertedId = shouldReturnId(pgSql)
        if (returnInsertedId) pgSql = `${pgSql} RETURNING id`

        const result = await pool.query(pgSql, params)
        const insertId = result.rows?.[0]?.id
        if (returnInsertedId) return [{ insertId }, { insertId }]

        return [result.rows || [], { insertId }]
      } catch (error) {
        console.error('Database error:', error.message)
        throw error
      }
    },

    end: async () => {
      if (pool) {
        await pool.end()
        pool = null
      }
    },
  }
}
